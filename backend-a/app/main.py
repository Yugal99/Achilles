"""Achilles Backend A: scanner API. Run with `./run.sh` or `uvicorn app.main:app`."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import ownership, tips
from .config import settings
from .models import SCHEMA_VERSION, ScanResult, ScanStatusView
from .profiles import PROFILES
from .scanner import QueueFull, manager
from .targets import TargetError, check_network_policy, is_lab_target, parse_target

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await manager.start()
    yield
    await manager.stop()


app = FastAPI(title="Achilles Scanner API (Backend A)", version=SCHEMA_VERSION, lifespan=lifespan,
              description="Owner-verified, non-destructive recon. See docs/API.md and docs/SCHEMA.md.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=False)


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(status_code=status, detail={"code": code, "message": message})


@app.exception_handler(HTTPException)
async def _err(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


def require_key(x_api_key: Optional[str] = Header(default=None)):
    if settings.api_key and x_api_key != settings.api_key:
        raise ApiError(401, "unauthorized", "missing or wrong X-API-Key header")


Auth = Depends(require_key)


# --- request bodies ---------------------------------------------------------------
class TargetBody(BaseModel):
    target: str = Field(examples=["https://myapp.example.com"])


class ScanBody(BaseModel):
    target: str = Field(examples=["https://myapp.example.com"])
    profile: str = Field("demo", examples=["demo"])


def _parse(raw: str):
    try:
        return parse_target(raw)
    except TargetError as e:
        raise ApiError(400, "bad_target", str(e))


# --- meta -------------------------------------------------------------------------
@app.get("/api/v1/health")
def health():
    return {
        "ok": True,
        "schema_version": SCHEMA_VERSION,
        "fake_tools": settings.fake_tools,
        "auth_required": bool(settings.api_key),
        "tools": {k: {"installed": bool(v) or settings.fake_tools, "path": v} for k, v in settings.bins.items()}
                 | {"jscheck": {"installed": True, "path": "builtin"}},
        "queue": {"waiting": len(manager.waiting), "running": len(manager.tasks)},
        "storage": "mongodb" if manager.db else "files",
        # Which AI providers have a key (names only, never the keys). Rules are always the last fallback.
        "ai": {"order": tips.provider_order(), "configured": tips.configured_providers(), "fallback": "rules"},
    }


@app.get("/api/v1/profiles", dependencies=[Auth])
def profiles():
    return {name: {"description": p["description"], "deadline_s": p["deadline_s"],
                   "tool_timeouts_s": {t: o["timeout"] for t, o in p["tools"].items()}}
            for name, p in PROFILES.items()}


@app.get("/api/v1/schema")
def schema():
    return ScanResult.model_json_schema()


# --- ownership --------------------------------------------------------------------
@app.post("/api/v1/ownership/challenge", dependencies=[Auth])
def ownership_challenge(body: TargetBody):
    t = _parse(body.target)
    return ownership.challenge(t.host)


@app.post("/api/v1/ownership/verify", dependencies=[Auth])
def ownership_verify(body: TargetBody):
    t = _parse(body.target)
    return ownership.verify(t.host)


@app.get("/api/v1/ownership/{host}", dependencies=[Auth])
def ownership_status(host: str):
    host = host.lower()
    return {"host": host, "verified": ownership.is_verified(host), "lab_target": is_lab_target(host)}


# --- scans ------------------------------------------------------------------------
@app.post("/api/v1/scans", status_code=202, dependencies=[Auth])
def start_scan(body: ScanBody):
    if body.profile not in PROFILES:
        raise ApiError(400, "bad_profile", f"profile must be one of {', '.join(PROFILES)}")
    t = _parse(body.target)
    lab = is_lab_target(t.host)
    if not (lab or settings.skip_ownership or ownership.is_verified(t.host)):
        raise ApiError(403, "ownership_not_verified",
                       f"Prove you own {t.host} first: POST /api/v1/ownership/challenge, publish the token, "
                       "then POST /api/v1/ownership/verify.")
    if not settings.fake_tools:
        try:
            check_network_policy(t)
        except TargetError as e:
            raise ApiError(400, "target_blocked", str(e))
    try:
        s = manager.submit(t, body.profile)
    except QueueFull as e:
        raise ApiError(429, "queue_full", str(e))
    return {"scan_id": s.scan_id, "status": s.status, "profile": s.profile, "target": s.target,
            "queue_position": s.queue_position,
            "links": {"status": f"/api/v1/scans/{s.scan_id}", "results": f"/api/v1/scans/{s.scan_id}/results"}}


def _get(scan_id: str) -> ScanResult:
    s = manager.get(scan_id)
    if not s:
        raise ApiError(404, "not_found", f"no scan {scan_id}")
    return s


def _view(s: ScanResult) -> ScanStatusView:
    return ScanStatusView(**s.model_dump(exclude={"findings", "stack", "schema_version"}))


@app.get("/api/v1/scans", response_model=list[ScanStatusView], dependencies=[Auth])
def list_scans(limit: int = 50):
    return [_view(s) for s in manager.list(limit)]


@app.get("/api/v1/hosts/{host}/scans", response_model=list[ScanStatusView], dependencies=[Auth])
def host_scans(host: str, limit: int = 20):
    """Scan history for one host, newest first. Only for hosts whose ownership is currently proven
    (or lab targets), so one person can't browse the scan history of an app they don't control."""
    host = host.lower().strip()
    if not (is_lab_target(host) or settings.skip_ownership or ownership.is_verified(host)):
        raise ApiError(403, "ownership_not_verified", f"Verify ownership of {host} to see its scan history.")
    return [_view(s) for s in manager.for_host(host, max(1, min(limit, 50)))]


@app.get("/api/v1/scans/{scan_id}", response_model=ScanStatusView, dependencies=[Auth])
def scan_status(scan_id: str):
    return _view(_get(scan_id))


@app.get("/api/v1/scans/{scan_id}/results", response_model=ScanResult, dependencies=[Auth])
def scan_results(scan_id: str):
    return _get(scan_id)


@app.get("/api/v1/scans/{scan_id}/tips", dependencies=[Auth])
def scan_tips(scan_id: str, refresh: bool = False):
    """Plain-English fixes per finding: Grok -> Gemini -> Claude -> built-in rules. Cached per scan.
    Sync on purpose: FastAPI runs it in a worker thread, so the slow provider calls do not block other requests."""
    s = _get(scan_id)
    if s.status not in ("completed", "partial"):
        raise ApiError(409, "scan_not_finished", f"scan is {s.status}; tips are available once it is completed or partial")
    return tips.get_tips(s, settings.data_dir / "tips", refresh=refresh, db=manager.db)


@app.delete("/api/v1/scans/{scan_id}", dependencies=[Auth])
def cancel_scan(scan_id: str):
    _get(scan_id)
    if not manager.cancel(scan_id):
        raise ApiError(409, "not_cancellable", "scan already finished")
    return {"scan_id": scan_id, "cancelled": True}


@app.get("/api/v1/scans/{scan_id}/raw", dependencies=[Auth])
def raw_list(scan_id: str):
    _get(scan_id)
    d = manager.raw_dir(scan_id)
    return {"files": sorted(p.name for p in d.iterdir()) if d.exists() else []}


@app.get("/api/v1/scans/{scan_id}/raw/{name}", dependencies=[Auth])
def raw_file(scan_id: str, name: str):
    _get(scan_id)
    d = manager.raw_dir(scan_id)
    allowed = {p.name: p for p in d.iterdir()} if d.exists() else {}
    if name not in allowed:
        raise ApiError(404, "not_found", "no such raw file")
    return FileResponse(allowed[name], media_type="text/plain")
