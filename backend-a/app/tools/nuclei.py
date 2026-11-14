"""Nuclei with curated, non-intrusive templates. Interactsh (out-of-band) is disabled."""
from __future__ import annotations

import json
import os
from pathlib import Path

from ..runner import run_cmd
from .base import ToolContext, ToolNotInstalled, ToolOutput, finding, save_raw
from .secrets import mask

TOOL = "nuclei"
EXCLUDE_TAGS = "intrusive,dos,fuzz,fuzzing,bruteforce,brute-force,osint,headless,rce,sqli,xss,lfi,ssrf,default-login"


def _category(tags: list[str], tid: str) -> str:
    t = set(tags) | {tid}
    if t & {"token", "keys", "secret", "secrets", "api-key"} or "token" in tid or "key" in tid:
        return "exposed_secret"
    if t & {"exposure", "env", "git", "backup", "logs", "files", "config", "debug"}:
        return "exposed_file"
    if "cors" in t:
        return "cors"
    if "ssl" in t or "tls" in t:
        return "tls"
    if t & {"cve", "vuln", "kev"}:
        return "vulnerability"
    if "tech" in t:
        return "tech"
    return "misconfig"


CUSTOM_DIR = Path(__file__).resolve().parents[2] / "templates" / "achilles"


def template_dirs() -> list[str]:
    """Our curated templates + the community set (~/nuclei-templates, from `nuclei -update-templates`).
    Passing -t replaces nuclei's default, so the community dir must be listed explicitly."""
    dirs = [str(CUSTOM_DIR)] if CUSTOM_DIR.is_dir() else []
    community = os.environ.get("ACHILLES_NUCLEI_TEMPLATES_DIR") or os.path.expanduser("~/nuclei-templates")
    if os.path.isdir(community) and any(Path(community).glob("*/")):  # skip empty/failed installs
        dirs.append(community)
    extra = os.environ.get("ACHILLES_NUCLEI_TEMPLATES", "")
    dirs += [x.strip() for x in extra.split(",") if x.strip()]
    return dirs


def build_argv(ctx: ToolContext) -> list[str]:
    o = ctx.opts
    argv = [ctx.bin, "-u", ctx.target.url, "-jsonl", "-silent", "-no-color", "-disable-update-check",
            "-ni", "-or",  # no interactsh, omit raw req/resp; -ni: never makes the target call out to third-party servers
            "-rl", str(o.get("rate_limit", 150)), "-c", str(o.get("concurrency", 25)),
            "-timeout", "7", "-retries", "1", "-etags", EXCLUDE_TAGS]
    for t in template_dirs():
        argv += ["-t", t]
    if o.get("tags"):
        argv += ["-tags", o["tags"]]
    if o.get("severity"):
        argv += ["-severity", o["severity"]]
    return argv


def parse(stdout: str) -> list:
    findings = {}
    for line in stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        info = d.get("info") or {}
        tid = d.get("template-id") or d.get("templateID") or "unknown"
        tags = info.get("tags") or []
        if isinstance(tags, str):
            tags = [x.strip() for x in tags.split(",") if x.strip()]
        loc = d.get("matched-at") or d.get("matched") or d.get("host") or ""
        sev = (info.get("severity") or "info").lower()
        if sev not in ("critical", "high", "medium", "low", "info"):
            sev = "info"
        cat = _category(tags, tid)
        extracted = d.get("extracted-results") or []
        evidence = ", ".join(mask(x) if cat == "exposed_secret" else x[:120] for x in extracted[:3])
        if d.get("matcher-name"):
            evidence = f"{d['matcher-name']}: {evidence}" if evidence else d["matcher-name"]
        refs = info.get("reference") or []
        if isinstance(refs, str):
            refs = [refs]
        f = finding(
            TOOL, tid, info.get("name") or tid, sev, cat, loc,
            description=(info.get("description") or "").strip(),
            evidence=evidence, remediation=(info.get("remediation") or "").strip(),
            references=[r for r in refs if r][:5], tags=tags[:10],
        )
        findings[f.id] = f
    return list(findings.values())


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("nuclei not found (go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && nuclei -update-templates)")
    res = await run_cmd(build_argv(ctx), timeout=ctx.opts["timeout"] - 2, env={"HOME": os.environ.get("HOME", "/root")})
    save_raw(ctx, "nuclei.jsonl", res.stdout)
    if res.stderr:
        save_raw(ctx, "nuclei.stderr.txt", res.stderr)
    findings = parse(res.stdout)
    if res.returncode not in (0, None) and not findings and not res.timed_out:
        raise RuntimeError(f"nuclei exited {res.returncode}: {res.stderr.strip()[-300:]}")
    msg = f"{len(findings)} template matches"
    if res.timed_out:
        msg += " (cut at time limit, results so far kept)"
    return ToolOutput(findings=findings, command=res.command, partial=res.timed_out, message=msg)
