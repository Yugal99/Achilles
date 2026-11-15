"""Tips engine: provider fallback chain, guardrails, endpoint. No network: providers are faked."""
import json
import os
import tempfile
import time

os.environ["ACHILLES_FAKE_TOOLS"] = "1"
os.environ["ACHILLES_DATA_DIR"] = tempfile.mkdtemp()
os.environ["ACHILLES_API_KEY"] = "k"
os.environ["ACHILLES_LAB_TARGETS"] = "lab.test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import fake, tips  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Finding, ScanResult  # noqa: E402
from app.tips import ProviderError  # noqa: E402

fake.DELAYS = {k: 0.2 for k in fake.DELAYS}
H = {"X-API-Key": "k"}

KEYS = ["ACHILLES_XAI_API_KEY", "ACHILLES_GEMINI_API_KEY", "ACHILLES_ANTHROPIC_API_KEY"]


def mkscan() -> ScanResult:
    f = lambda tool, cid, title, sev, cat, loc, **kw: Finding(  # noqa: E731
        id=Finding.make_id(tool, cid, loc), tool=tool, check_id=cid, title=title, severity=sev, category=cat, location=loc, **kw)
    return ScanResult.model_validate({
        **ScanResult(scan_id="scn_aaaaaaaaaaaa", profile="demo", target={"input": "x", "url": "https://x/", "scheme": "https", "host": "x", "port": 443, "ips": []}).model_dump(),
        "findings": [
            f("jscheck", "openai-key", "OpenAI API key in client code", "critical", "exposed_secret", "https://x/app.js", evidence="sk-pro…9xQa"),
            f("nmap", "open-port-5432", "PostgreSQL exposed", "high", "open_port", "x:5432/tcp"),
            f("httpx", "tech-nextjs", "Built with Next.js", "info", "tech", "https://x/"),
        ],
    })


@pytest.fixture(autouse=True)
def clean_keys(monkeypatch):
    for k in KEYS:
        monkeypatch.delenv(k, raising=False)


def ai_reply(scan, ids=None, extra_id=None):
    ids = ids or [f.id for f in scan.findings if f.severity.value != "info"]
    items = [{"id": i, "summary": f"AI summary for {i}", "impact": "AI impact",
              "fix_prompt": "Please do this specific and safe fix in my app, then explain the change."} for i in ids]
    if extra_id:
        items.append({"id": extra_id, "summary": "invented", "impact": "x", "fix_prompt": "x" * 60})
    return json.dumps({"tips": items})


def test_no_keys_means_rules_for_every_actionable_finding():
    s = mkscan()
    r = tips.build_tips(s, post=lambda *a: pytest.fail("must not call the network"))
    assert r["source"] == "rules"
    assert set(r["tips"]) == {f.id for f in s.findings if f.severity.value != "info"}  # info excluded
    assert all(t["source"] == "rules" and t["fix_prompt"] for t in r["tips"].values())
    assert [a["error"] for a in r["attempts"]] == ["no API key set"] * 3


def test_falls_through_grok_failure_to_gemini(monkeypatch):
    s = mkscan()
    monkeypatch.setenv("ACHILLES_XAI_API_KEY", "x")
    monkeypatch.setenv("ACHILLES_GEMINI_API_KEY", "g")
    calls = []

    def post(url, headers, body, timeout):
        calls.append(url)
        if "x.ai" in url:
            raise ProviderError("HTTP 500")
        return {"candidates": [{"content": {"parts": [{"text": ai_reply(s)}]}}]}

    r = tips.build_tips(s, post=post)
    assert r["source"] == "gemini"
    assert any("x.ai" in c for c in calls) and any("generativelanguage" in c for c in calls)
    assert all(t["source"] == "gemini" for t in r["tips"].values())
    assert r["attempts"][0] == {"provider": "grok", "ok": False, "error": "HTTP 500"}
    assert all("epithet" in t for t in r["tips"].values())  # rule epithet is kept


def test_claude_is_last_ai_provider_and_all_failing_gives_rules(monkeypatch):
    s = mkscan()
    for k in KEYS:
        monkeypatch.setenv(k, "k")

    def boom(*a):
        raise ProviderError("down")

    r = tips.build_tips(s, post=boom)
    assert r["source"] == "rules" and [a["provider"] for a in r["attempts"]] == ["grok", "gemini", "claude"]
    assert all(t["source"] == "rules" for t in r["tips"].values())


def test_claude_response_shape_and_code_fence(monkeypatch):
    s = mkscan()
    monkeypatch.setenv("ACHILLES_ANTHROPIC_API_KEY", "a")
    monkeypatch.setenv("ACHILLES_AI_ORDER", "claude")
    seen = {}

    def post(url, headers, body, timeout):
        seen.update(url=url, headers=headers, body=body)
        return {"content": [{"type": "text", "text": "```json\n" + ai_reply(s) + "\n```"}]}

    r = tips.build_tips(s, post=post)
    assert r["source"] == "claude" and seen["url"].startswith("https://api.anthropic.com")
    assert seen["headers"]["x-api-key"] == "a" and seen["body"]["system"] == tips.SYSTEM_PROMPT


def test_invented_ids_are_dropped_and_missing_ones_keep_rules(monkeypatch):
    s = mkscan()
    monkeypatch.setenv("ACHILLES_XAI_API_KEY", "x")
    monkeypatch.setenv("ACHILLES_AI_ORDER", "grok")
    first = next(f.id for f in s.findings if f.severity.value == "critical")
    reply = ai_reply(s, ids=[first], extra_id="deadbeef0000")
    r = tips.build_tips(s, post=lambda *a: {"choices": [{"message": {"content": reply}}]})
    assert "deadbeef0000" not in r["tips"]  # the model cannot add findings
    assert r["tips"][first]["source"] == "grok"
    other = next(f.id for f in s.findings if f.severity.value == "high")
    assert r["tips"][other]["source"] == "rules"  # omitted by the model, rule tip kept


def test_prompt_marks_findings_untrusted_and_sends_only_compact_fields(monkeypatch):
    s = mkscan()
    monkeypatch.setenv("ACHILLES_XAI_API_KEY", "x")
    monkeypatch.setenv("ACHILLES_AI_ORDER", "grok")
    sent = {}

    def post(url, headers, body, timeout):
        sent["user"] = body["messages"][1]["content"]
        return {"choices": [{"message": {"content": ai_reply(s)}}]}

    tips.build_tips(s, post=post)
    assert "untrusted" in sent["user"].lower() and "untrusted" in tips.SYSTEM_PROMPT.lower()
    assert "tags" not in sent["user"] and "references" not in sent["user"]
    assert "Built with Next.js" not in sent["user"]  # info findings are never sent


def test_bad_replies_are_rejected():
    ids = {"a"}
    for bad in ('{"tips": "nope"}', '{"tips": [{"id": "zzz", "summary": "s", "fix_prompt": "x"}]}',
                '{"tips": [{"id": "a", "summary": "s", "fix_prompt": "short"}]}'):
        with pytest.raises(ProviderError):
            tips.validate(json.loads(bad), ids)


def wait(c, sid):
    end = time.time() + 10
    while time.time() < end:
        s = c.get(f"/api/v1/scans/{sid}", headers=H).json()
        if s["status"] not in ("queued", "running"):
            return s
        time.sleep(0.1)
    raise AssertionError("scan did not finish")


def test_tips_endpoint_end_to_end_and_cache():
    with TestClient(app) as c:
        h = c.get("/api/v1/health").json()
        assert h["ai"]["fallback"] == "rules" and h["ai"]["configured"] == []
        sid = c.post("/api/v1/scans", json={"target": "lab.test"}, headers=H).json()["scan_id"]
        early = c.get(f"/api/v1/scans/{sid}/tips", headers=H)
        assert early.status_code in (200, 409)
        if early.status_code == 409:
            assert early.json()["error"]["code"] == "scan_not_finished"
        wait(c, sid)
        r = c.get(f"/api/v1/scans/{sid}/tips", headers=H)
        assert r.status_code == 200
        body = r.json()
        res = c.get(f"/api/v1/scans/{sid}/results", headers=H).json()
        actionable = {f["id"] for f in res["findings"] if f["severity"] != "info"}
        assert set(body["tips"]) == actionable and body["source"] == "rules"
        assert c.get(f"/api/v1/scans/{sid}/tips", headers={}).status_code == 401
        assert c.get("/api/v1/scans/scn_000000000000/tips", headers=H).status_code == 404
