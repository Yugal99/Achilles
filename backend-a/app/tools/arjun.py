"""Arjun: discovers undocumented query parameters (debug, admin, role, id...) on the app and the /api routes
found in its JavaScript. GET only, bounded request rate, no exploit payloads: it only checks whether a
parameter name changes the response."""
from __future__ import annotations

import json
import os
import re

from ..runner import run_cmd
from . import jsfetch
from .base import ToolContext, ToolNotInstalled, ToolOutput, finding, save_raw, proc_timeout

TOOL = "arjun"
RISKY = re.compile(r"debug|admin|test|dev|role|is_?admin|superuser|token|secret|key|password|pass|auth|"
                   r"impersonate|user_?id|uid|internal|bypass|verbose|trace|sudo", re.I)


def build_argv(ctx: ToolContext, urls_file: str, outfile: str) -> list[str]:
    o = ctx.opts
    return [ctx.bin, "-i", urls_file, "-oJ", outfile, "-m", "GET", "-q",
            "-t", str(o.get("threads", 2)), "-d", str(o.get("delay", 0.2)), "-T", "8", "-c", str(o.get("chunk", 250))]


def parse(text: str) -> list:
    try:
        doc = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(doc, dict):
        return []
    out = {}
    for url, info in doc.items():
        params = (info or {}).get("params") if isinstance(info, dict) else info
        params = [p for p in (params or []) if isinstance(p, str)]
        if not params:
            continue
        risky = [p for p in params if RISKY.search(p)]
        plist = ", ".join(params[:10]) + (" …" if len(params) > 10 else "")
        if risky:
            f = finding(
                TOOL, "hidden-sensitive-param", "Hidden parameter with a sensitive name", "medium", "misconfig", url,
                description="The endpoint reacts to an undocumented parameter that looks like a debug, admin or access "
                            "switch. Forgotten flags like these often bypass checks.",
                evidence=f"sensitive: {', '.join(risky[:6])}; all: {plist}",
                remediation="Remove debug/admin parameters from production code, and enforce authorization on the "
                            "server instead of trusting a request parameter.",
                tags=["arjun", "params"])
        else:
            f = finding(
                TOOL, "hidden-params", "Undocumented parameters accepted", "info", "misconfig", url,
                description="The endpoint accepts parameters that are not part of the normal UI.",
                evidence=plist, remediation="Review whether each parameter is intended and validated server-side.",
                tags=["arjun", "params"])
        out[f.id] = f
    return list(out.values())


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("arjun not found (pip install arjun)")
    bundle = await jsfetch.get_bundle(ctx)
    t = ctx.target
    base = f"{t.scheme}://{t.host}" + ("" if t.port in (80, 443) else f":{t.port}")
    urls = [t.url] + [base + p for p in bundle.api_paths[: int(ctx.opts.get("max_api", 5))]]
    ctx.raw_dir.mkdir(parents=True, exist_ok=True)
    urls_file, outfile = ctx.raw_dir / "arjun_urls.txt", ctx.raw_dir / "arjun.json"
    urls_file.write_text("\n".join(urls))
    res = await run_cmd(build_argv(ctx, str(urls_file), str(outfile)), timeout=proc_timeout(ctx),
                        env={"HOME": os.environ.get("HOME", "/root")})
    if res.stderr:
        save_raw(ctx, "arjun.stderr.txt", res.stderr)
    text = outfile.read_text() if outfile.exists() else ""
    findings = parse(text)
    if res.returncode not in (0, None) and not findings and not res.timed_out:
        raise RuntimeError(f"arjun exited {res.returncode}: {res.stderr.strip()[-300:]}")
    msg = f"probed {len(urls)} endpoints, {len(findings)} with hidden parameters"
    return ToolOutput(findings=findings, command=res.command, partial=res.timed_out,
                      message=msg + (" (cut at time limit)" if res.timed_out else ""))
