"""Fake mode (ACHILLES_FAKE_TOOLS=1): realistic canned output so the frontend and Backend B
can be built without the scanner tools. Each tool "finishes" after a short delay, so progress polling looks real."""
from __future__ import annotations

import asyncio

from .models import Stack
from .tools.base import ToolContext, ToolOutput, ToolSkipped, finding

DELAYS = {"httpx": 2, "jscheck": 4, "nmap": 6, "testssl": 8, "nuclei": 10, "trufflehog": 5, "retire": 3, "arjun": 7}


async def run(tool: str, ctx: ToolContext) -> ToolOutput:
    await asyncio.sleep(DELAYS.get(tool, 3))
    t = ctx.target
    base = f"{t.scheme}://{t.host}"
    if tool == "httpx":
        stack = Stack(technologies=["Vite", "React", "Supabase", "Vercel"], webserver="Vercel",
                      title="TaskPilot — AI to-do app", status_code=200, final_url=t.url, content_type="text/html")
        return ToolOutput(stack=stack, message="Vite, React, Supabase, Vercel", command="fake:httpx", findings=[
            finding("httpx", f"tech-{x.lower()}", f"Built with {x}", "info", "tech", t.url, evidence=x, tags=["tech"])
            for x in stack.technologies])
    if tool == "jscheck":
        return ToolOutput(command="fake:jscheck", message="checked 6 scripts, 2 secrets", findings=[
            finding("jscheck", "openai-key", "OpenAI API key in client code", "critical", "exposed_secret",
                    f"{base}/assets/index-4f9a2c.js", evidence="sk-pro…9xQa",
                    description="Anyone visiting the site can copy this key and run up your OpenAI bill.",
                    remediation="Revoke the key at platform.openai.com, move OpenAI calls to a server/edge function."),
            finding("jscheck", "supabase-anon-key", "Supabase anon key in client code", "info", "exposed_secret",
                    f"{base}/assets/index-4f9a2c.js", evidence="eyJhbG…Xk2w",
                    description="Public by design; your data is only as safe as your Row Level Security policies.",
                    remediation="Make sure RLS is enabled on every table."),
            finding("jscheck", "missing-csp", "Missing Content-Security-Policy", "low", "headers", t.url,
                    description="Without CSP, any XSS bug can load scripts from anywhere.",
                    remediation="Add a Content-Security-Policy header (start with `default-src 'self'`)."),
            finding("jscheck", "cors-reflect-origin", "CORS reflects any origin", "medium", "cors", t.url,
                    evidence="Origin: https://achilles-cors-probe.example -> ACAO: https://achilles-cors-probe.example",
                    description="Any website can read responses from your app.",
                    remediation="Replace the reflected origin with an explicit allow-list."),
        ])
    if tool == "nmap":
        return ToolOutput(command="fake:nmap", message="3 open ports", findings=[
            finding("nmap", "open-port-443", "Web port 443 open (https)", "info", "open_port", f"{t.host}:443/tcp",
                    evidence="443/tcp open https"),
            finding("nmap", "open-port-5432", "PostgreSQL database exposed to the internet", "high", "open_port",
                    f"{t.host}:5432/tcp", evidence="5432/tcp open postgresql PostgreSQL DB 15.4",
                    description="Anyone can try to log in to your database directly.",
                    remediation="Close port 5432 in your firewall or bind it to a private network."),
            finding("nmap", "open-port-5173", "Vite dev server open", "medium", "open_port", f"{t.host}:5173/tcp",
                    evidence="5173/tcp open http Vite dev server",
                    description="Vite dev server can serve your source files and env.",
                    remediation="Stop the dev server; deploy the production build only."),
        ])
    if tool == "testssl":
        if t.scheme != "https":
            raise ToolSkipped("target is http://, no TLS to test")
        return ToolOutput(command="fake:testssl", message="1 TLS issue", findings=[
            finding("testssl", "TLS1_1", "Outdated protocol TLS1.1 enabled", "low", "tls", f"{t.host}:443",
                    evidence="offered (deprecated)", remediation="Disable TLS 1.1; allow only TLS 1.2 and 1.3."),
        ])
    if tool == "nuclei":
        return ToolOutput(command="fake:nuclei", message="2 template matches", findings=[
            finding("nuclei", "generic-env", "Exposed .env file", "critical", "exposed_file", f"{base}/.env",
                    evidence="SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY",
                    description="Your .env usually holds database passwords and API keys.",
                    remediation="Remove .env from the deployed folder and rotate every secret in it.",
                    tags=["exposure", "config", "env"]),
            finding("nuclei", "git-config", "Git config exposed", "high", "exposed_file", f"{base}/.git/config",
                    evidence="[core]", description="Source code and history can be downloaded.",
                    remediation="Block /.git or stop deploying it.", tags=["exposure", "git"]),
        ])
    if tool == "trufflehog":
        return ToolOutput(command="fake:trufflehog", message="scanned 7 files, 1 live secrets", findings=[
            finding("trufflehog", "verified-openai", "Live OpenAI credential in client code", "critical",
                    "exposed_secret", f"{base}/assets/index-4f2a9c1b.js", evidence="sk-pro…a1b2 (verified live)",
                    description="TruffleHog tested this OpenAI credential and it WORKS.",
                    remediation="Revoke and rotate it, then call OpenAI from a server function.",
                    tags=["secret", "verified", "openai"]),
        ])
    if tool == "retire":
        return ToolOutput(command="fake:retire", message="scanned 7 files, 1 vulnerable libraries", findings=[
            finding("retire", "jquery-3.4.1-CVE-2020-11022", "Vulnerable jquery 3.4.1", "medium", "vulnerability",
                    f"{base}/assets/vendor.js", evidence="jquery 3.4.1 (fixed in 3.5.0)",
                    description="Passing untrusted HTML to jQuery DOM methods can run attacker scripts.",
                    remediation="Upgrade jquery to 3.5.0 or later and rebuild.", tags=["retire", "jquery"]),
        ])
    if tool == "arjun":
        return ToolOutput(command="fake:arjun", message="probed 3 endpoints, 1 with hidden parameters", findings=[
            finding("arjun", "hidden-sensitive-param", "Hidden parameter with a sensitive name", "medium", "misconfig",
                    f"{base}/api/users", evidence="sensitive: debug, admin; all: debug, admin, page",
                    description="The endpoint reacts to an undocumented debug/admin-looking parameter.",
                    remediation="Remove debug/admin flags from production and enforce authorization server-side.",
                    tags=["arjun", "params"]),
        ])
    raise ValueError(tool)
