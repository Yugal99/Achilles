"""Scan profiles. "demo" is trimmed to finish in under 2 minutes on a normal connection."""
from __future__ import annotations

# Ports vibe-coded apps tend to leave open: databases, caches, dev servers, admin consoles.
FOCUSED_PORTS = (
    "21,22,23,25,80,443,445,1433,1521,2375,2376,3000,3001,3306,4000,4200,5000,5001,5173,"
    "5432,5601,5984,6379,7474,8000,8080,8081,8443,8888,9000,9090,9200,9229,9300,11211,"
    "15672,27017,28017,50000"
)

PROFILES: dict[str, dict] = {
    "demo": {
        "description": "Judges' demo. Focused ports, curated Nuclei tags, quick TLS. Target: < 2 min.",
        "deadline_s": 110,  # whole scan; tools still running at this point are cut and marked timeout
        "tools": {
            "nmap":    {"timeout": 75, "ports": FOCUSED_PORTS, "host_timeout": "70s"},
            "httpx":   {"timeout": 25},
            "nuclei":  {"timeout": 100, "tags": "achilles,exposure,config,misconfig,cors,debug,panel,token,keys,"
                                                "firebase,supabase,env,git,backup,logs,takeover,swagger,graphql",
                        "severity": "low,medium,high,critical", "rate_limit": 150, "concurrency": 25},
            "testssl": {"timeout": 100, "args": ["-p", "-S"]},
            "jscheck": {"timeout": 60, "max_scripts": 25},
            "trufflehog": {"timeout": 40, "max_scripts": 25},
            "retire":  {"timeout": 40, "max_scripts": 25},
            "arjun":   {"timeout": 5, "skip": "demo profile skips parameter discovery (too slow for 2 min)"},
        },
    },
    "web": {
        "description": "Hosted web apps on shared infrastructure (Railway, Vercel...). No port scan: "
                       "httpx, Nuclei, testssl.sh, the JS key/header checker, TruffleHog, Retire.js and Arjun, at a gentle request rate.",
        "deadline_s": 110,
        "tools": {
            "nmap":    {"timeout": 5, "skip": "web profile never port-scans (shared hosting)"},
            "httpx":   {"timeout": 25},
            "nuclei":  {"timeout": 100, "tags": "achilles,exposure,config,misconfig,cors,debug,panel,token,keys,"
                                                "firebase,supabase,env,git,backup,logs,takeover,swagger,graphql",
                        "severity": "low,medium,high,critical", "rate_limit": 50, "concurrency": 10},
            "testssl": {"timeout": 100, "args": ["-p", "-S"]},
            "jscheck": {"timeout": 60, "max_scripts": 25},
            "trufflehog": {"timeout": 40, "max_scripts": 25},
            "retire":  {"timeout": 40, "max_scripts": 25},
            "arjun":   {"timeout": 100, "max_scripts": 25, "max_api": 4, "threads": 1, "delay": 0.5},
        },
    },
    "standard": {
        "description": "Top 1000 ports, broader Nuclei set, TLS vulnerabilities. ~5-10 min.",
        "deadline_s": 900,
        "tools": {
            "nmap":    {"timeout": 420, "top_ports": 1000, "host_timeout": "400s"},
            "httpx":   {"timeout": 60},
            "nuclei":  {"timeout": 600, "tags": "", "severity": "low,medium,high,critical",
                        "rate_limit": 150, "concurrency": 25},
            "testssl": {"timeout": 420, "args": ["-p", "-S", "-P", "-U"]},
            "jscheck": {"timeout": 120, "max_scripts": 60},
            "trufflehog": {"timeout": 120, "max_scripts": 60},
            "retire":  {"timeout": 120, "max_scripts": 60},
            "arjun":   {"timeout": 420, "max_scripts": 60, "max_api": 5, "threads": 2, "delay": 0.2},
        },
    },
    "deep": {
        "description": "All 65535 ports and the full Nuclei template set. Can take 30+ min.",
        "deadline_s": 3600,
        "tools": {
            "nmap":    {"timeout": 3000, "ports": "-", "host_timeout": "2900s"},
            "httpx":   {"timeout": 90},
            "nuclei":  {"timeout": 3000, "tags": "", "severity": "info,low,medium,high,critical",
                        "rate_limit": 150, "concurrency": 25},
            "testssl": {"timeout": 900, "args": []},
            "jscheck": {"timeout": 180, "max_scripts": 120},
            "trufflehog": {"timeout": 240, "max_scripts": 120},
            "retire":  {"timeout": 240, "max_scripts": 120},
            "arjun":   {"timeout": 1200, "max_scripts": 120, "max_api": 8, "threads": 3, "delay": 0.1},
        },
    },
}

TOOL_NAMES = ["nmap", "httpx", "nuclei", "testssl", "jscheck", "trufflehog", "retire", "arjun"]
