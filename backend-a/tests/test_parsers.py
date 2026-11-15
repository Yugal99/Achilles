"""Parser tests with sample tool output, so they run without the scanner tools installed."""
import json

from app.tools import arjun, httpx_probe, nmap, nuclei, retire, testssl, trufflehog
from app.tools.secrets import mask, scan_text
from app.targets import TargetError, parse_target, _blocked

NMAP_XML = """<?xml version="1.0"?><nmaprun><host><address addr="203.0.113.5"/><ports>
<port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx"/></port>
<port protocol="tcp" portid="5432"><state state="open"/><service name="postgresql" product="PostgreSQL DB" version="15.4"/></port>
<port protocol="tcp" portid="6379"><state state="open"/><service name="redis"/></port>
<port protocol="tcp" portid="7000"><state state="open"/><service name="afs3-fileserver"/></port>
<port protocol="tcp" portid="22"><state state="closed"/></port>
</ports></host></nmaprun>"""


def test_nmap_parse():
    fs = {f.check_id: f for f in nmap.parse(NMAP_XML, "app.example.com")}
    assert fs["open-port-5432"].severity.value == "high"
    assert fs["open-port-6379"].severity.value == "critical"
    assert fs["open-port-443"].severity.value == "info"
    assert fs["open-port-7000"].severity.value == "low"
    assert "open-port-22" not in fs
    assert "PostgreSQL DB 15.4" in fs["open-port-5432"].evidence


def test_nmap_bad_xml():
    assert nmap.parse("<nmaprun", "x") == []


def test_httpx_parse_both_key_styles():
    out = json.dumps({"url": "https://a.example", "status_code": 200, "title": "App", "webserver": "Vercel",
                      "tech": ["Next.js", "React", "Vercel"]}) + "\n" + \
          json.dumps({"url": "https://a.example", "status-code": 200, "technologies": ["Supabase"]})
    stack, fs = httpx_probe.parse(out, "https://a.example/")
    assert stack.technologies == ["Next.js", "React", "Supabase", "Vercel"]
    assert stack.webserver == "Vercel" and stack.status_code == 200
    assert all(f.severity.value == "info" for f in fs)


def test_nuclei_parse():
    line = json.dumps({"template-id": "generic-env", "info": {"name": "Exposed .env", "severity": "high",
                       "tags": ["exposure", "config"], "reference": "https://example.org",
                       "classification": {"cve-id": None, "cvss-score": 8.3,
                                          "cvss-metrics": "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:L"}},
                       "matched-at": "https://a.example/.env", "extracted-results": ["DB_PASSWORD=hunter2"]})
    secret = json.dumps({"template-id": "openai-key", "info": {"name": "OpenAI key", "severity": "high", "tags": "token,keys"},
                         "matched-at": "https://a.example/app.js",
                         "extracted-results": ["sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"]})
    fs = {f.check_id: f for f in nuclei.parse(line + "\n" + secret + "\nnot json\n")}
    assert fs["generic-env"].category.value == "exposed_file"
    assert fs["generic-env"].references == ["https://example.org"]
    assert fs["openai-key"].category.value == "exposed_secret"
    assert "abcdefghij" not in fs["openai-key"].evidence  # masked
    assert fs["generic-env"].cvss_score == 8.3 and fs["generic-env"].cvss_vector.startswith("CVSS:3.0/AV:N")
    assert fs["openai-key"].cvss_score is None and fs["openai-key"].cvss_vector == ""  # no classification block


def test_nuclei_cvss_is_optional_and_validated():
    def one(classification):
        line = json.dumps({"template-id": "t", "info": {"name": "T", "severity": "info", "classification": classification},
                           "matched-at": "https://a.example/"})
        f = nuclei.parse(line)[0]
        return f.cvss_score, f.cvss_vector

    vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N"
    assert one({"cvss-metrics": vector}) == (None, vector)  # real templates do state a vector without a score
    assert one({"cvss-score": "9.8"}) == (9.8, "")
    assert one({"cvss-score": 42, "cvss-metrics": "not a vector"}) == (None, "")
    assert one({"cvss-score": "n/a"}) == (None, "")
    assert one(None) == (None, "") and one("junk") == (None, "")


def test_testssl_parse():
    raw = json.dumps([
        {"id": "TLS1_1", "severity": "LOW", "finding": "offered (deprecated)"},
        {"id": "cert_expirationStatus", "severity": "OK", "finding": "62 >= 30 days"},
        {"id": "cert_trust", "severity": "HIGH", "finding": "certificate does not match supplied URI", "cwe": "CWE-295"},
        {"id": "scanProblem", "severity": "WARN", "finding": "x"},
    ])
    fs = {f.check_id: f for f in testssl.parse(raw, "a.example:443")}
    assert set(fs) == {"TLS1_1", "cert_trust"}
    assert fs["cert_trust"].severity.value == "high"
    assert fs["cert_trust"].references[0].endswith("/295.html")


def test_secret_patterns_and_masking():
    import base64
    payload = base64.urlsafe_b64encode(b'{"iss":"supabase","role":"service_role"}').decode().rstrip("=")
    jwt = f"eyJhbGciOiJIUzI1NiJ9.{payload}.c2lnbmF0dXJlMTIzNDU2"
    text = f'const k="sk_live_{"a"*24}"; const s="{jwt}"; const g="AIza{"B"*35}";'
    ids = {pid: sev for pid, v, sev, *_ in scan_text(text)}
    assert ids == {"stripe-secret": "critical", "supabase-service-role": "critical", "google-api-key": "low"}
    assert mask("sk_" + "live_" + "a" * 24) == "sk_liv…aaaa"


def test_target_parsing_and_blocking():
    t = parse_target("myapp.example.com")
    assert t.url == "https://myapp.example.com/" and t.port == 443
    assert parse_target("http://a.example:8080/x").url == "http://a.example:8080/x"
    for bad in ["", "ftp://x", "https://user:pw@x.example"]:
        try:
            parse_target(bad)
            assert False, bad
        except TargetError:
            pass
    for ip in ["127.0.0.1", "10.1.2.3", "192.168.1.5", "169.254.169.254", "::1", "100.64.1.1"]:
        assert _blocked(ip), ip
    assert not _blocked("8.8.8.8")


FILES = {"001_app.js": "https://a.example/assets/app.js"}


def test_trufflehog_parse_only_verified():
    live = {"DetectorName": "OpenAI", "Verified": True, "Raw": "sk-proj-" + "a" * 50,
            "SourceMetadata": {"Data": {"Filesystem": {"file": "/tmp/x/js/001_app.js"}}}}
    dead = dict(live, Verified=False, DetectorName="Stripe")
    fs = trufflehog.parse(json.dumps(live) + "\n" + json.dumps(dead) + "\nnot json", FILES, "https://a.example/")
    assert len(fs) == 1
    f = fs[0]
    assert f.severity.value == "critical" and f.category.value == "exposed_secret"
    assert f.location == "https://a.example/assets/app.js"
    assert "a" * 20 not in f.evidence and "verified live" in f.evidence


def test_retire_parse_v5_and_legacy():
    entry = {"file": "/tmp/js/001_app.js", "results": [{"component": "jquery", "version": "3.4.1", "vulnerabilities": [
        {"severity": "medium", "below": "3.5.0", "identifiers": {"CVE": ["CVE-2020-11022"], "summary": "XSS"},
         "info": ["https://example.org/a"]}]}]}
    for doc in ({"version": "5", "data": [entry]}, [entry]):
        fs = retire.parse(json.dumps(doc), FILES, "https://a.example/")
        assert len(fs) == 1 and fs[0].severity.value == "medium" and fs[0].category.value == "vulnerability"
        assert "3.5.0" in fs[0].evidence and fs[0].location == "https://a.example/assets/app.js"
    assert retire.parse("garbage", FILES, "x") == []


def test_arjun_parse_flags_sensitive_params():
    doc = {"https://a.example/api/users": {"params": ["debug", "page"], "method": "GET"},
           "https://a.example/": {"params": ["utm"], "method": "GET"},
           "https://a.example/api/x": {"params": [], "method": "GET"}}
    fs = {f.location: f for f in arjun.parse(json.dumps(doc))}
    assert fs["https://a.example/api/users"].severity.value == "medium"
    assert fs["https://a.example/"].severity.value == "info"
    assert "https://a.example/api/x" not in fs
    assert arjun.parse("") == []


def test_deep_profile_runs_tools_without_limits(tmp_path):
    import asyncio
    import sys

    from app.profiles import PROFILES
    from app.runner import run_cmd
    from app.tools.base import ToolContext, proc_timeout

    deep, demo = PROFILES["deep"], PROFILES["demo"]
    assert deep["deadline_s"] is None and all(o["timeout"] is None for o in deep["tools"].values())
    t = parse_target("https://example.com")
    ctx = lambda prof, tool: ToolContext(scan_id="scn_x", target=t, opts=prof["tools"][tool], raw_dir=tmp_path, bin=tool)
    assert all(proc_timeout(ctx(deep, n)) is None for n in deep["tools"])
    assert proc_timeout(ctx(demo, "nmap")) == demo["tools"]["nmap"]["timeout"] - 2
    assert "--host-timeout" not in nmap.build_argv(ctx(deep, "nmap")) and "-p-" in nmap.build_argv(ctx(deep, "nmap"))
    assert "--host-timeout" in nmap.build_argv(ctx(demo, "nmap"))
    # With no timeout the runner waits for the process to exit by itself.
    res = asyncio.run(run_cmd([sys.executable, "-c", "import time; time.sleep(0.3); print('done')"], timeout=None))
    assert res.stdout.strip() == "done" and not res.timed_out and res.returncode == 0
