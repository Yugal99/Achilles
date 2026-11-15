"""Retire.js on the downloaded JS bundle: known-vulnerable front-end libraries (jQuery, lodash, Angular...)."""
from __future__ import annotations

import json
import os

from ..runner import run_cmd
from . import jsfetch
from .base import ToolContext, ToolNotInstalled, ToolOutput, finding, save_raw, proc_timeout

TOOL = "retire"
SEV = {"critical": "critical", "high": "high", "medium": "medium", "moderate": "medium", "low": "low"}


def build_argv(ctx: ToolContext, path: str, outfile: str) -> list[str]:
    return [ctx.bin, "--path", path, "--outputformat", "json", "--outputpath", outfile, "--exitwith", "0"]


def parse(text: str, files: dict[str, str], fallback_url: str) -> list:
    try:
        doc = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []
    entries = doc.get("data", []) if isinstance(doc, dict) else doc  # v5 wraps in {"data": [...]}
    out = {}
    for e in entries or []:
        loc = files.get(os.path.basename(e.get("file", "")), fallback_url)
        for r in e.get("results") or []:
            comp, ver = r.get("component", "library"), r.get("version", "?")
            for v in r.get("vulnerabilities") or []:
                ids = v.get("identifiers") or {}
                cves = ids.get("CVE") or []
                summary = ids.get("summary") or ""
                sev = SEV.get((v.get("severity") or "medium").lower(), "medium")
                key = cves[0] if cves else (summary[:40] or "vuln")
                below = v.get("below")
                f = finding(
                    TOOL, f"{comp}-{ver}-{key}", f"Vulnerable {comp} {ver}", sev, "vulnerability", loc,
                    description=summary or f"{comp} {ver} has a known vulnerability.",
                    evidence=f"{comp} {ver}" + (f" (fixed in {below})" if below else ""),
                    remediation=f"Upgrade {comp}" + (f" to {below} or later" if below else " to its latest version")
                                + " and rebuild, or drop the dependency if you no longer use it.",
                    references=(v.get("info") or [])[:5], tags=["retire", comp] + [c for c in cves[:3]],
                )
                out[f.id] = f
    return list(out.values())


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("retire not found (npm install -g retire)")
    bundle = await jsfetch.get_bundle(ctx)
    if not bundle.files:
        raise RuntimeError("could not download the page or its scripts")
    outfile = ctx.raw_dir / "retire.json"
    res = await run_cmd(build_argv(ctx, str(bundle.dir), str(outfile)), timeout=proc_timeout(ctx),
                        env={"HOME": os.environ.get("HOME", "/root")})
    if res.stderr:
        save_raw(ctx, "retire.stderr.txt", res.stderr)
    text = outfile.read_text() if outfile.exists() else res.stdout
    findings = parse(text, bundle.files, ctx.target.url)
    if res.returncode not in (0, None) and not findings and not res.timed_out:
        raise RuntimeError(f"retire exited {res.returncode}: {res.stderr.strip()[-300:]}")
    msg = f"scanned {len(bundle.files)} files, {len(findings)} vulnerable libraries"
    return ToolOutput(findings=findings, command=res.command, partial=res.timed_out,
                      message=msg + (" (cut at time limit)" if res.timed_out else ""))
