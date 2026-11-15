"""testssl.sh: certificate and protocol checks (Fedora/Kali binary is `testssl`)."""
from __future__ import annotations

import json
import os
import tempfile

from ..runner import run_cmd
from .base import ToolContext, ToolNotInstalled, ToolOutput, ToolSkipped, finding, save_raw

TOOL = "testssl"
# WARN in testssl means "the test itself had a problem", not a target finding, so it is not mapped.
SEV_MAP = {"CRITICAL": "critical", "HIGH": "high", "MEDIUM": "medium", "LOW": "low"}
FIXES = {
    "cert_expiration": "Renew the certificate. Free automatic renewal: Let's Encrypt / your host's managed TLS.",
    "cert_notAfter": "Renew the certificate.",
    "cert_trust": "Serve a certificate that matches the hostname and chains to a public CA.",
    "cert_chain_of_trust": "Install the full certificate chain (leaf + intermediates).",
    "SSLv2": "Disable SSLv2.", "SSLv3": "Disable SSLv3.",
    "TLS1": "Disable TLS 1.0; allow only TLS 1.2 and 1.3.",
    "TLS1_1": "Disable TLS 1.1; allow only TLS 1.2 and 1.3.",
}


def build_argv(ctx: ToolContext, jsonfile: str) -> list[str]:
    t = ctx.target
    return [ctx.bin, "--quiet", "--color", "0", "--warnings", "off", "--ip", "one",
            "--connect-timeout", "8", "--openssl-timeout", "8",
            *ctx.opts.get("args", []), "--jsonfile", jsonfile, f"{t.host}:{t.port}"]


def parse(raw: str, loc: str) -> list:
    try:
        items = json.loads(raw) if raw.strip() else []
    except json.JSONDecodeError:
        return []
    if isinstance(items, dict):  # --jsonfile-pretty style
        items = [f for sr in items.get("scanResult", []) for k, v in sr.items() if isinstance(v, list) for f in v]
    findings = []
    for it in items:
        sev = SEV_MAP.get(str(it.get("severity", "")).upper())
        if not sev:
            continue
        cid = it.get("id", "unknown")
        if cid in ("scanProblem", "engine_problem", "scanTime", "service", "optimal_proto", "QUIC") or cid.startswith(("cmdline_", "pre_")):
            continue
        text = it.get("finding", "")
        cat = "tls"
        findings.append(finding(
            TOOL, cid, _title(cid, text), sev, cat, loc, evidence=text[:200],
            description=f"testssl.sh check '{cid}' reported: {text}"[:400],
            remediation=FIXES.get(cid, "Use your host's managed TLS (Vercel/Netlify/Cloudflare do this for you) "
                                       "or a modern Mozilla TLS config."),
            references=[f"https://cwe.mitre.org/data/definitions/{it['cwe'].split('-')[-1]}.html"]
            if str(it.get("cwe", "")).startswith("CWE-") else [],
            tags=["tls"],
        ))
    return findings


def _fatal(raw: str) -> str:
    try:
        items = json.loads(raw) if raw.strip() else []
    except json.JSONDecodeError:
        return ""
    for it in items if isinstance(items, list) else []:
        if it.get("id") == "scanProblem" and str(it.get("severity")).upper() == "FATAL":
            return it.get("finding", "fatal error")
    return ""


def _title(cid: str, text: str) -> str:
    if cid.startswith("cert_"):
        return f"Certificate problem: {text[:80]}"
    if cid in ("SSLv2", "SSLv3", "TLS1", "TLS1_1"):
        return f"Outdated protocol {cid.replace('_', '.')} enabled"
    return f"TLS issue: {cid}"


async def run(ctx: ToolContext) -> ToolOutput:
    if ctx.target.scheme != "https":
        raise ToolSkipped("target is http://, no TLS to test")
    if not ctx.bin:
        raise ToolNotInstalled("testssl not found (dnf install testssl)")
    fd, jf = tempfile.mkstemp(prefix="achilles-testssl-", suffix=".json")
    os.close(fd)
    os.unlink(jf)  # testssl refuses to overwrite an existing file
    try:
        res = await run_cmd(build_argv(ctx, jf), timeout=ctx.opts["timeout"] - 2)
        raw = open(jf).read() if os.path.exists(jf) else ""
        # When cut by timeout the json file is unterminated; try to close it.
        if res.timed_out and raw.strip() and not raw.rstrip().endswith("]"):
            raw = raw.rstrip().rstrip(",") + "]"
    finally:
        if os.path.exists(jf):
            os.unlink(jf)
    save_raw(ctx, "testssl.json", raw)
    save_raw(ctx, "testssl.stdout.txt", res.stdout)
    findings = parse(raw, f"{ctx.target.host}:{ctx.target.port}")
    fatal = _fatal(raw)
    if fatal and not findings:
        raise RuntimeError(f"testssl could not run: {fatal}")
    if not raw and not res.timed_out:
        raise RuntimeError(f"testssl produced no output (exit {res.returncode}): {(res.stdout + res.stderr).strip()[-200:]}")
    msg = f"{len(findings)} TLS issues"
    if res.timed_out:
        msg += " (cut at time limit)"
    return ToolOutput(findings=findings, command=res.command, partial=res.timed_out, message=msg)
