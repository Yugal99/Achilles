"""Parser tests with sample tool output, so they run without the scanner tools installed."""
import json

from app.tools import httpx_probe, nmap, nuclei, testssl
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
                       "tags": ["exposure", "config"], "reference": "https://example.org"},
                       "matched-at": "https://a.example/.env", "extracted-results": ["DB_PASSWORD=hunter2"]})
    secret = json.dumps({"template-id": "openai-key", "info": {"name": "OpenAI key", "severity": "high", "tags": "token,keys"},
                         "matched-at": "https://a.example/app.js",
                         "extracted-results": ["sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"]})
    fs = {f.check_id: f for f in nuclei.parse(line + "\n" + secret + "\nnot json\n")}
    assert fs["generic-env"].category.value == "exposed_file"
    assert fs["generic-env"].references == ["https://example.org"]
    assert fs["openai-key"].category.value == "exposed_secret"
    assert "abcdefghij" not in fs["openai-key"].evidence  # masked


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
