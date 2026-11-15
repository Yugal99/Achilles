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
        assert {t["status"] for t in res["tools"].values()} <= {"ok", "skipped"}
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


def test_host_history_newest_first_and_gated():
    with TestClient(app) as c:
        ids = []
        for _ in range(2):
            sid = c.post("/api/v1/scans", json={"target": "https://lab.test"}, headers=H).json()["scan_id"]
            wait(c, sid)
            ids.append(sid)
        hist = c.get("/api/v1/hosts/lab.test/scans", headers=H).json()
        got = [h["scan_id"] for h in hist]
        assert got.index(ids[1]) < got.index(ids[0])  # newest first
        assert all(h["target"]["host"] == "lab.test" for h in hist)
        assert "findings" not in hist[0] and "summary" in hist[0]
        r = c.get("/api/v1/hosts/unverified.example/scans", headers=H)
        assert r.status_code == 403 and r.json()["error"]["code"] == "ownership_not_verified"
        assert c.get("/api/v1/hosts/lab.test/scans").status_code == 401


def test_deep_profile_has_no_time_limits():
    """Deep scans report 0 (no limit) for every tool and finish only when every tool has."""
    with TestClient(app) as c:
        prof = c.get("/api/v1/profiles", headers=H).json()["deep"]
        assert prof["deadline_s"] == 0 and set(prof["tool_timeouts_s"].values()) == {0}
        sid = c.post("/api/v1/scans", json={"target": "https://lab.test", "profile": "deep"}, headers=H).json()["scan_id"]
        s = wait(c, sid)
        assert s["status"] == "completed" and s["profile"] == "deep"
        assert {t["status"] for t in s["tools"].values()} == {"ok"}
        assert {t["timeout_s"] for t in s["tools"].values()} == {0}


def test_repeat_request_joins_the_scan_in_progress():
    """Asking twice for the same URL and profile follows one scan; another profile gets its own."""
    fake.DELAYS = {k: 1 for k in fake.DELAYS}
    try:
        with TestClient(app) as c:
            body = {"target": "https://lab.test", "profile": "deep"}
            first = c.post("/api/v1/scans", json=body, headers=H).json()
            again = c.post("/api/v1/scans", json=body, headers=H).json()
            assert not first["joined"] and again["joined"] and again["scan_id"] == first["scan_id"]
            other = c.post("/api/v1/scans", json={"target": "https://lab.test", "profile": "demo"}, headers=H).json()
            assert not other["joined"] and other["scan_id"] != first["scan_id"]
            assert wait(c, first["scan_id"])["status"] == "completed"
            assert wait(c, other["scan_id"])["status"] == "completed"
            fresh = c.post("/api/v1/scans", json=body, headers=H).json()  # the first one is over, so this is new
            assert not fresh["joined"] and fresh["scan_id"] != first["scan_id"]
            wait(c, fresh["scan_id"])
    finally:
        fake.DELAYS = {k: 0.2 for k in fake.DELAYS}
