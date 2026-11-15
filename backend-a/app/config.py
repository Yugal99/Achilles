"""Runtime settings, all overridable with ACHILLES_* environment variables."""
from __future__ import annotations

import os
import shutil
from pathlib import Path


def _env(name: str, default: str) -> str:
    return os.environ.get(f"ACHILLES_{name}", default)


def _bool(name: str, default: bool) -> bool:
    return _env(name, "1" if default else "0").lower() in ("1", "true", "yes", "on")


def _list(name: str) -> list[str]:
    return [x.strip().lower() for x in _env(name, "").split(",") if x.strip()]


class Settings:
    def __init__(self) -> None:
        self.data_dir = Path(_env("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
        # Shared secret for the API. Empty = no auth (fine on a laptop, set it before exposing on LAN).
        self.api_key = _env("API_KEY", "")
        # Comma-separated browser origins allowed to call the API ("*" for any).
        self.cors_origins = _list("CORS_ORIGINS") or ["*"]
        # Scans that may run at the same time. Each scan already runs its tools in parallel.
        self.max_concurrent_scans = int(_env("MAX_CONCURRENT_SCANS", "1"))
        self.max_queue = int(_env("MAX_QUEUE", "20"))
        # Fake mode returns canned results without running any tool, for frontend work without the scanner tools installed.
        self.fake_tools = _bool("FAKE_TOOLS", False)
        # Hosts/IPs you run yourself (e.g. Juice Shop on the LAN). Skips the ownership check
        # AND the private-address block. Never put a third-party host here.
        self.lab_targets = _list("LAB_TARGETS")
        # Skip ownership verification entirely. Only for local development against lab targets.
        self.skip_ownership = _bool("SKIP_OWNERSHIP", False)
        # Ownership proof stays valid this long.
        self.ownership_ttl_s = int(_env("OWNERSHIP_TTL_S", str(24 * 3600)))
        self.raw_retention_days = int(_env("RAW_RETENTION_DAYS", "7"))

        self.bins = {
            "nmap": _env("NMAP_BIN", "") or _which("nmap"),
            # ProjectDiscovery httpx is "httpx" (Fedora, via go install) or "httpx-toolkit" (Debian/Kali); plain "httpx" may also be the Python client, checked below.
            "httpx": _env("HTTPX_BIN", "") or _which("httpx-toolkit", "pd-httpx"),
            "nuclei": _env("NUCLEI_BIN", "") or _which("nuclei"),
            "testssl": _env("TESTSSL_BIN", "") or _which("testssl", "testssl.sh"),
            "trufflehog": _env("TRUFFLEHOG_BIN", "") or _which("trufflehog"),
            "retire": _env("RETIRE_BIN", "") or _which("retire"),
            "arjun": _env("ARJUN_BIN", "") or _which("arjun") or _venv_bin("arjun"),
        }
        if not self.bins["httpx"]:
            cand = _which("httpx")
            if cand and _is_pd_httpx(cand):
                self.bins["httpx"] = cand


def _which(*names: str) -> str:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return ""


def _venv_bin(name: str) -> str:
    """pip-installed tools live in the project's .venv/bin, which isn't on PATH when run.sh uses it by path."""
    p = Path(__file__).resolve().parent.parent / ".venv" / "bin" / name
    return str(p) if p.is_file() else ""


def _is_pd_httpx(path: str) -> bool:
    import subprocess

    try:
        out = subprocess.run([path, "-version"], capture_output=True, text=True, timeout=5)
        return "projectdiscovery" in (out.stdout + out.stderr).lower()
    except Exception:
        return False


settings = Settings()
