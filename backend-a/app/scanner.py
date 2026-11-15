"""Job queue + scan orchestration.

- Scans wait in an asyncio queue; ACHILLES_MAX_CONCURRENT_SCANS workers pull from it.
- Inside a scan, all tools run in parallel, each with its own timeout from the profile.
- A profile-wide deadline cuts whatever is still running, so the demo always returns in time.
- The deep profile sets no timeouts and no deadline: its tools run until they exit or the scan is cancelled.
- A tool that times out / errors / is missing never fails the scan: the scan ends "partial".
- State is written to data/scans/<id>.json after every change, so restarts keep history.
- With ACHILLES_MONGODB_URI set, every change is also upserted to MongoDB (see store.py), and history
  is loaded from there at startup, so it survives a new machine.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import shutil
import time
from pathlib import Path

from . import fake, store as store_mod
from .config import settings
from .models import (SEVERITY_ORDER, ScanResult, ScanStatus, Stack, Target, ToolRun, ToolStatus,
                     now, summarize)
from .profiles import PROFILES, TOOL_NAMES
from .tools import arjun, httpx_probe, jscheck, nmap, nuclei, retire, testssl, trufflehog
from .tools.base import ToolContext, ToolNotInstalled, ToolOutput, ToolSkipped

log = logging.getLogger("achilles.scanner")

TOOL_MODULES = {"nmap": nmap, "httpx": httpx_probe, "nuclei": nuclei, "testssl": testssl, "jscheck": jscheck,
                "trufflehog": trufflehog, "retire": retire, "arjun": arjun}
BIN_KEY = {"nmap": "nmap", "httpx": "httpx", "nuclei": "nuclei", "testssl": "testssl", "jscheck": None,
           "trufflehog": "trufflehog", "retire": "retire", "arjun": "arjun"}


class QueueFull(Exception):
    pass


class ScanManager:
    def __init__(self) -> None:
        self.scans: dict[str, ScanResult] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.waiting: list[str] = []
        self.tasks: dict[str, asyncio.Task] = {}
        self.workers: list[asyncio.Task] = []
        self.scans_dir = settings.data_dir / "scans"
        self.raw_root = settings.data_dir / "raw"
        self.db: store_mod.MongoStore | None = None

    # --- lifecycle --------------------------------------------------------------
    async def start(self) -> None:
        # (re)create loop-bound objects here, not in __init__, so the manager works under any event loop
        self.queue = asyncio.Queue()
        self.waiting, self.tasks, self.workers = [], {}, []
        self.scans_dir.mkdir(parents=True, exist_ok=True)
        self.raw_root.mkdir(parents=True, exist_ok=True)
        self.db = await asyncio.to_thread(store_mod.connect)
        self._load()
        if self.db:
            await asyncio.to_thread(self._load_db)
        self._purge_old_raw()
        for i in range(max(1, settings.max_concurrent_scans)):
            self.workers.append(asyncio.create_task(self._worker(i), name=f"scan-worker-{i}"))

    async def stop(self) -> None:
        for t in list(self.tasks.values()) + self.workers:
            t.cancel()
        await asyncio.gather(*self.workers, *self.tasks.values(), return_exceptions=True)
        if self.db:
            await asyncio.to_thread(self.db.close)
            self.db = None

    def _load(self) -> None:
        for p in sorted(self.scans_dir.glob("*.json")):
            try:
                s = ScanResult.model_validate_json(p.read_text())
            except Exception:
                continue
            if s.status in (ScanStatus.queued, ScanStatus.running):  # interrupted by a restart
                s.status = ScanStatus.failed
                s.error = "scanner restarted while this scan was in progress"
            self.scans[s.scan_id] = s

    def _load_db(self) -> None:
        """Bring in history from MongoDB (the durable copy). Local files win for scans this host is running."""
        for s in self.db.load_recent(500):
            if s.scan_id in self.scans:
                continue
            if s.status in (ScanStatus.queued, ScanStatus.running):  # another instance's, or interrupted
                s.status = ScanStatus.failed
                s.error = s.error or "scanner restarted while this scan was in progress"
            self.scans[s.scan_id] = s

    def _purge_old_raw(self) -> None:
        cutoff = time.time() - settings.raw_retention_days * 86400
        for d in self.raw_root.iterdir():
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d, ignore_errors=True)

    def _save(self, s: ScanResult) -> None:
        p = self.scans_dir / f"{s.scan_id}.json"
        tmp = p.with_suffix(".tmp")
        tmp.write_text(s.model_dump_json(indent=2))
        tmp.replace(p)
        if self.db:
            self.db.save_scan(s)

    # --- public API -----------------------------------------------------------
    def active_scan(self, target: Target, profile: str) -> ScanResult | None:
        """A queued or running scan of the same URL with the same profile, if there is one."""
        for s in self.scans.values():
            if (s.status in (ScanStatus.queued, ScanStatus.running) and s.profile == profile
                    and s.target.url == target.url):
                return s
        return None

    def submit(self, target: Target, profile: str) -> ScanResult:
        # Asking again for a scan that is already queued or running joins it. Otherwise every return to the
        # scan page would queue a duplicate behind the first, and the queue would stall.
        existing = self.active_scan(target, profile)
        if existing:
            return existing
        if len(self.waiting) >= settings.max_queue:
            raise QueueFull(f"queue is full ({settings.max_queue} scans waiting)")
        scan_id = "scn_" + secrets.token_hex(6)
        s = ScanResult(scan_id=scan_id, profile=profile, target=target,
                       tools={n: ToolRun(timeout_s=PROFILES[profile]["tools"][n]["timeout"] or 0) for n in TOOL_NAMES})
        self.scans[scan_id] = s
        self.waiting.append(scan_id)
        self._update_positions()
        self._save(s)
        self.queue.put_nowait(scan_id)
        return s

    def get(self, scan_id: str) -> ScanResult | None:
        s = self.scans.get(scan_id)
        if s is None and self.db:  # older than the startup window, or written by another instance
            s = self.db.get_scan(scan_id)
            if s and s.status not in (ScanStatus.queued, ScanStatus.running):
                self.scans[s.scan_id] = s
        return s

    def for_host(self, host: str, limit: int = 20) -> list[ScanResult]:
        """Scans of one host, newest first. MongoDB when configured (complete history), else memory."""
        if self.db:
            try:
                found = {s.scan_id: s for s in self.db.host_scans(host, limit)}
                for s in self.scans.values():  # include in-flight scans not yet flushed
                    if s.target.host == host:
                        found[s.scan_id] = s
                return sorted(found.values(), key=lambda s: s.created_at, reverse=True)[:limit]
            except Exception as e:
                log.warning("mongo history query failed (%s); falling back to memory", type(e).__name__)
        return sorted((s for s in self.scans.values() if s.target.host == host),
                      key=lambda s: s.created_at, reverse=True)[:limit]

    def list(self, limit: int = 50) -> list[ScanResult]:
        return sorted(self.scans.values(), key=lambda s: s.created_at, reverse=True)[:limit]

    def cancel(self, scan_id: str) -> bool:
        s = self.scans.get(scan_id)
        if not s or s.status not in (ScanStatus.queued, ScanStatus.running):
            return False
        if scan_id in self.waiting:
            self.waiting.remove(scan_id)
            s.status = ScanStatus.cancelled
            s.finished_at = now()
            self._update_positions()
            self._save(s)
            return True
        task = self.tasks.get(scan_id)
        if task:
            task.cancel()
        return True

    def raw_dir(self, scan_id: str) -> Path:
        return self.raw_root / scan_id

    # --- internals ----------------------------------------------------------------
    def _update_positions(self) -> None:
        for i, sid in enumerate(self.waiting):
            self.scans[sid].queue_position = i + 1

    async def _worker(self, n: int) -> None:
        while True:
            scan_id = await self.queue.get()
            try:
                if scan_id not in self.waiting:  # cancelled while queued
                    continue
                self.waiting.remove(scan_id)
                self._update_positions()
                task = asyncio.create_task(self._run_scan(self.scans[scan_id]))
                self.tasks[scan_id] = task
                try:
                    await task
                except asyncio.CancelledError:
                    if not task.cancelled():
                        raise
                finally:
                    self.tasks.pop(scan_id, None)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("worker %s crashed on %s", n, scan_id)
            finally:
                self.queue.task_done()

    async def _run_scan(self, s: ScanResult) -> None:
        prof = PROFILES[s.profile]
        s.status = ScanStatus.running
        s.started_at = now()
        s.queue_position = None
        self._save(s)
        raw = self.raw_dir(s.scan_id)
        raw.mkdir(parents=True, exist_ok=True)
        tool_tasks = {name: asyncio.create_task(self._run_tool(s, name, prof["tools"][name], raw), name=name)
                      for name in TOOL_NAMES}
        try:
            done, pending = await asyncio.wait(tool_tasks.values(), timeout=prof["deadline_s"])
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for name, t in tool_tasks.items():
                if t in pending:
                    tr = s.tools[name]
                    tr.status = ToolStatus.timeout
                    tr.message = f"cut by the {prof['deadline_s']}s profile deadline"
                    self._finish_tool(s, tr)
            self._finalize(s)
        except asyncio.CancelledError:
            for t in tool_tasks.values():
                t.cancel()
            await asyncio.gather(*tool_tasks.values(), return_exceptions=True)
            s.status = ScanStatus.cancelled
            s.finished_at = now()
            s.duration_s = round((s.finished_at - s.started_at).total_seconds(), 1)
            self._save(s)
        except Exception as e:
            log.exception("scan %s failed", s.scan_id)
            s.status = ScanStatus.failed
            s.error = f"internal error: {e}"
            s.finished_at = now()
            self._save(s)

    async def _run_tool(self, s: ScanResult, name: str, opts: dict, raw: Path) -> None:
        tr = s.tools[name]
        tr.status = ToolStatus.running
        tr.started_at = now()
        self._save(s)
        key = BIN_KEY[name]
        ctx = ToolContext(scan_id=s.scan_id, target=s.target, opts=opts, raw_dir=raw,
                          bin=settings.bins.get(key, "") if key else "")
        try:
            if opts.get("skip"):  # profile switches this tool off (e.g. nmap in the web profile)
                raise ToolSkipped(opts["skip"])
            if settings.fake_tools:
                out: ToolOutput = await asyncio.wait_for(fake.run(name, ctx), timeout=opts["timeout"])
            else:
                out = await asyncio.wait_for(TOOL_MODULES[name].run(ctx), timeout=opts["timeout"])
            tr.status = ToolStatus.timeout if out.partial else ToolStatus.ok
            tr.message = out.message
            tr.command = out.command
            self._merge(s, out)
        except ToolSkipped as e:
            tr.status, tr.message = ToolStatus.skipped, str(e)
        except ToolNotInstalled as e:
            tr.status, tr.message = ToolStatus.not_installed, str(e)
        except asyncio.TimeoutError:
            tr.status, tr.message = ToolStatus.timeout, f"no result within {opts['timeout']}s"
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("tool %s failed on %s: %s", name, s.scan_id, e)
            tr.status, tr.message = ToolStatus.error, str(e)[:500]
        self._finish_tool(s, tr)

    def _finish_tool(self, s: ScanResult, tr: ToolRun) -> None:
        tr.finished_at = now()
        if tr.started_at:
            tr.duration_s = round((tr.finished_at - tr.started_at).total_seconds(), 1)
        finished = sum(t.status not in (ToolStatus.pending, ToolStatus.running) for t in s.tools.values())
        s.progress = int(100 * finished / len(s.tools))
        s.summary = summarize(s.findings)
        self._save(s)

    def _merge(self, s: ScanResult, out: ToolOutput) -> None:
        if out.stack:
            s.stack = _merge_stack(s.stack, out.stack)
        by_id = {f.id: f for f in s.findings}
        for f in out.findings:
            by_id[f.id] = f
        s.findings = _dedupe(list(by_id.values()))
        for name in s.tools:
            s.tools[name].findings_count = sum(f.tool == name for f in s.findings)

    def _finalize(self, s: ScanResult) -> None:
        s.findings.sort(key=lambda f: (SEVERITY_ORDER[f.severity.value], f.category.value, f.title))
        s.summary = summarize(s.findings)
        s.finished_at = now()
        s.duration_s = round((s.finished_at - s.started_at).total_seconds(), 1)
        s.progress = 100
        statuses = [t.status for t in s.tools.values()]
        if all(st in (ToolStatus.ok, ToolStatus.skipped) for st in statuses):
            s.status = ScanStatus.completed
        elif any(st == ToolStatus.ok for st in statuses) or s.findings:
            s.status = ScanStatus.partial
        else:
            s.status = ScanStatus.failed
            s.error = "no tool produced a result; is the target reachable from the scanner?"
        self._save(s)


def _merge_stack(a: Stack, b: Stack) -> Stack:
    d = a.model_dump()
    for k, v in b.model_dump().items():
        if k == "technologies":
            d[k] = sorted(set(d[k]) | set(v))
        elif v:
            d[k] = v
    return Stack(**d)


def _dedupe(findings: list) -> list:
    """The same exposed file can be reported by nuclei and jscheck, and the same leaked key by jscheck and
    trufflehog (masked evidence is identical); keep the most severe one, preferring trufflehog's verified hit."""
    keep: dict[tuple, object] = {}
    rest = []
    rank = lambda f: (SEVERITY_ORDER[f.severity.value], f.tool != "trufflehog")
    for f in findings:
        if f.category.value in ("exposed_file",):
            k = (f.category.value, f.location.rstrip("/").lower())
        elif f.category.value == "exposed_secret" and f.evidence:
            k = (f.category.value, f.location, f.evidence.split(" (")[0])
        else:
            k = None
        if k:
            cur = keep.get(k)
            if cur is None or rank(f) < rank(cur):
                keep[k] = f
        else:
            rest.append(f)
    return rest + list(keep.values())


manager = ScanManager()
