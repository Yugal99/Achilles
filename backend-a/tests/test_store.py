"""MongoStore round-trip against an in-memory stand-in for a pymongo collection (no network)."""
from concurrent.futures import ThreadPoolExecutor

from app.tools.base import finding
from app.models import ScanResult, Target, ToolRun
from app.store import MongoStore


class FakeColl:
    def __init__(self, name):
        self.name, self.docs = name, {}

    def replace_one(self, flt, doc, upsert=False):
        self.docs[flt["_id"]] = dict(doc)

    def find_one(self, flt):
        d = self.docs.get(flt["_id"])
        return dict(d) if d else None

    def find(self, flt, sort=None, limit=0):
        docs = [d for d in self.docs.values() if all(_get(d, k) == v for k, v in flt.items())]
        if sort:
            key, direction = sort[0]
            docs.sort(key=lambda d: _get(d, key), reverse=direction == -1)
        return [dict(d) for d in docs[: limit or None]]


def _get(d, dotted):
    for part in dotted.split("."):
        d = d.get(part) if isinstance(d, dict) else None
    return d


def make_store():
    st = MongoStore.__new__(MongoStore)
    st.scans, st.tips = FakeColl("scans"), FakeColl("tips")
    st._writer = ThreadPoolExecutor(max_workers=1)
    return st


def scan(sid, host, created):
    t = Target(input=host, url=f"https://{host}/", scheme="https", host=host, port=443, ips=[])
    s = ScanResult(scan_id=sid, profile="demo", target=t, tools={"nmap": ToolRun(timeout_s=10)})
    s.created_at = created
    return s


def test_scan_round_trip_and_host_history():
    from datetime import datetime, timezone

    st = make_store()
    a = scan("scn_a", "app.test", datetime(2026, 11, 1, tzinfo=timezone.utc))
    b = scan("scn_b", "app.test", datetime(2026, 11, 2, tzinfo=timezone.utc))
    other = scan("scn_c", "other.test", datetime(2026, 11, 3, tzinfo=timezone.utc))
    a.findings = [finding("jscheck", "openai-key", "OpenAI key in client JS", "critical", "exposed_secret",
                          location="https://app.test/a.js", evidence="sk-...9xQ2")]
    for s in (a, b, other):
        st.save_scan(s)
    st.save_scan(b)  # upsert, not duplicate
    st.flush()

    got = st.get_scan("scn_a")
    assert got is not None and got.findings == a.findings and got.created_at == a.created_at
    assert [s.scan_id for s in st.host_scans("app.test", 10)] == ["scn_b", "scn_a"]
    assert [s.scan_id for s in st.load_recent(2)] == ["scn_c", "scn_b"]
    assert st.get_scan("missing") is None


def test_tips_round_trip():
    st = make_store()
    st.save_tips("scn_a", {"version": "1", "source": "rules", "tips": {"x": {"summary": "s"}}})
    st.flush()
    assert st.get_tips("scn_a")["tips"]["x"]["summary"] == "s"
    assert st.get_tips("nope") is None
