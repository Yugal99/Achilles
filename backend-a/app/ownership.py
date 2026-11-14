"""Ownership verification: DNS TXT record or a file at /.well-known/achilles.txt.

Flow:
  1. POST /api/v1/ownership/challenge {"target": "myapp.example.com"} -> token + instructions
  2. The owner publishes the token (either method).
  3. POST /api/v1/ownership/verify {"target": "..."} -> verified true/false
  4. POST /api/v1/scans is refused for hosts that are not verified (or listed as lab targets).
"""
from __future__ import annotations

import json
import secrets
import ssl
import threading
import time
import urllib.request
from pathlib import Path
from typing import Optional

from .config import settings

TXT_PREFIX = "achilles-verify="
WELL_KNOWN = "/.well-known/achilles.txt"

_lock = threading.Lock()


def _path() -> Path:
    p = settings.data_dir / "ownership.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _load() -> dict:
    p = _path()
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save(d: dict) -> None:
    tmp = _path().with_suffix(".tmp")
    tmp.write_text(json.dumps(d, indent=2))
    tmp.replace(_path())


def challenge(host: str) -> dict:
    with _lock:
        d = _load()
        entry = d.get(host)
        if not entry or not entry.get("token"):
            entry = {"token": secrets.token_urlsafe(18), "verified_at": None, "method": None}
            d[host] = entry
            _save(d)
    token = entry["token"]
    return {
        "host": host,
        "token": token,
        "verified": is_verified(host),
        "methods": {
            "dns_txt": {
                "record_names": [host, f"_achilles.{host}"],
                "type": "TXT",
                "value": f"{TXT_PREFIX}{token}",
            },
            "well_known_file": {
                "urls": [f"https://{host}{WELL_KNOWN}", f"http://{host}{WELL_KNOWN}"],
                "content": token,
            },
        },
    }


def _check_dns(host: str, token: str) -> bool:
    try:
        import dns.resolver
    except ImportError:
        return False
    want = f"{TXT_PREFIX}{token}"
    for name in (host, f"_achilles.{host}"):
        try:
            answers = dns.resolver.resolve(name, "TXT", lifetime=5)
        except Exception:
            continue
        for rr in answers:
            txt = b"".join(rr.strings).decode(errors="ignore").strip()
            if txt == want:
                return True
    return False


def _check_file(host: str, token: str) -> bool:
    ctx = ssl.create_default_context()
    for scheme in ("https", "http"):
        url = f"{scheme}://{host}{WELL_KNOWN}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Achilles-Verify/1.0"})
            with urllib.request.urlopen(req, timeout=6, context=ctx if scheme == "https" else None) as r:
                body = r.read(4096).decode(errors="ignore")
            if token in body.split():
                return True
        except Exception:
            continue
    return False


def verify(host: str) -> dict:
    with _lock:
        d = _load()
        entry = d.get(host)
    if not entry:
        return {"host": host, "verified": False, "method": None,
                "message": "No challenge yet. Call /api/v1/ownership/challenge first."}
    token = entry["token"]
    method: Optional[str] = None
    if _check_dns(host, token):
        method = "dns_txt"
    elif _check_file(host, token):
        method = "well_known_file"
    if method:
        with _lock:
            d = _load()
            d[host] = {**d.get(host, entry), "verified_at": time.time(), "method": method}
            _save(d)
        return {"host": host, "verified": True, "method": method, "message": "Ownership verified."}
    return {"host": host, "verified": False, "method": None,
            "message": "Token not found in DNS TXT or /.well-known/achilles.txt yet. DNS can take a few minutes."}


def is_verified(host: str) -> bool:
    entry = _load().get(host) or {}
    ts = entry.get("verified_at")
    return bool(ts) and (time.time() - ts) < settings.ownership_ttl_s
