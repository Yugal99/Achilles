"""End-to-end API flow in fake mode (no real tools, no network)."""
import os
import tempfile
import time

os.environ["ACHILLES_FAKE_TOOLS"] = "1"
os.environ["ACHILLES_DATA_DIR"] = tempfile.mkdtemp()
os.environ["ACHILLES_API_KEY"] = "k"
os.environ["ACHILLES_LAB_TARGETS"] = "lab.test"

from fastapi.testclient import TestClient  # noqa: E402

from app import fake  # noqa: E402
from app.main import app  # noqa: E402

fake.DELAYS = {k: 0.2 for k in fake.DELAYS}
H = {"X-API-Key": "k"}


def wait(c, sid, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        s = c.get(f"/api/v1/scans/{sid}", headers=H).json()
        if s["status"] not in ("queued", "running"):
            return s
        time.sleep(0.1)
    raise AssertionError("scan did not finish")


def test_auth_and_ownership_gate():
    with TestClient(app) as c:
        assert c.get("/api/v1/health").json()["ok"]
        assert c.post("/api/v1/scans", json={"target": "lab.test"}).status_code == 401
        r = c.post("/api/v1/scans", json={"target": "https://unverified.example"}, headers=H)
        assert r.status_code == 403 and r.json()["error"]["code"] == "ownership_not_verified"
        ch = c.post("/api/v1/ownership/challenge", json={"target": "unverified.example"}, headers=H).json()
        assert ch["methods"]["dns_txt"]["value"].startswith("achilles-verify=")
        assert c.post("/api/v1/scans", json={"target": "lab.test", "profile": "nope"}, headers=H).status_code == 400


def test_full_scan_flow():
    with TestClient(app) as c:
        r = c.post("/api/v1/scans", json={"target": "https://lab.test"}, headers=H)
        assert r.status_code == 202
        sid = r.json()["scan_id"]
        s = wait(c, sid)
        assert s["status"] == "completed" and s["progress"] == 100
        res = c.get(f"/api/v1/scans/{sid}/results", headers=H).json()
        assert res["schema_version"] == "1.0"
        assert res["findings"][0]["severity"] == "critical"  # sorted most severe first
        assert res["summary"]["total"] == len(res["findings"])
        assert "Supabase" in res["stack"]["technologies"]
        assert {t["status"] for t in res["tools"].values()} <= {"ok", "skipped"}  # demo skips arjun (too slow)
        assert res["tools"]["trufflehog"]["status"] == "ok" and res["tools"]["retire"]["status"] == "ok"
        assert any(x["scan_id"] == sid for x in c.get("/api/v1/scans", headers=H).json())


def test_cancel():
    fake.DELAYS = {k: 5 for k in fake.DELAYS}
    try:
        with TestClient(app) as c:
            sid = c.post("/api/v1/scans", json={"target": "https://lab.test"}, headers=H).json()["scan_id"]
            time.sleep(0.3)
            assert c.delete(f"/api/v1/scans/{sid}", headers=H).json()["cancelled"]
            assert wait(c, sid)["status"] == "cancelled"
    finally:
        fake.DELAYS = {k: 0.2 for k in fake.DELAYS}


def test_deadline_gives_partial(monkeypatch):
    from app import profiles
    monkeypatch.setitem(profiles.PROFILES["demo"], "deadline_s", 1)
    fake.DELAYS = {**{k: 0.2 for k in fake.DELAYS}, "nuclei": 5}
    try:
        with TestClient(app) as c:
            sid = c.post("/api/v1/scans", json={"target": "https://lab.test"}, headers=H).json()["scan_id"]
            s = wait(c, sid)
            assert s["status"] == "partial"
            assert s["tools"]["nuclei"]["status"] == "timeout"
            assert s["tools"]["nmap"]["status"] == "ok"
    finally:
        fake.DELAYS = {k: 0.2 for k in fake.DELAYS}


def test_web_profile_skips_nmap():
    with TestClient(app) as c:
        r = c.post("/api/v1/scans", json={"target": "https://lab.test", "profile": "web"}, headers=H)
        assert r.status_code == 202
        s = wait(c, r.json()["scan_id"])
        assert s["tools"]["nmap"]["status"] == "skipped"
        assert all(s["tools"][t]["status"] == "ok" for t in ("httpx", "nuclei", "testssl", "jscheck"))
        res = c.get(f"/api/v1/scans/{s['scan_id']}/results", headers=H).json()
        assert not any(f["tool"] == "nmap" for f in res["findings"])
