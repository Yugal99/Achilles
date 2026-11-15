"""TruffleHog on the downloaded JS bundle: reports only secrets it could VERIFY are live.

Verification makes a read-only authenticated call to the key's provider (e.g. Stripe, OpenAI), never to the
target. Turn it off with ACHILLES_TRUFFLEHOG_VERIFY=0 (the tool is then skipped, as unverified hits are noise
next to the jscheck patterns)."""
from __future__ import annotations

import json
import os

from ..runner import run_cmd
from . import jsfetch
from .base import ToolContext, ToolNotInstalled, ToolOutput, ToolSkipped, finding, save_raw, proc_timeout
from .secrets import mask

TOOL = "trufflehog"


def build_argv(ctx: ToolContext, path: str) -> list[str]:
    return [ctx.bin, "filesystem", path, "--json", "--no-update", "--results=verified", "--concurrency=4"]


def parse(stdout: str, files: dict[str, str], fallback_url: str) -> list:
    out = {}
    for line in stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not d.get("Verified"):
            continue
        det = d.get("DetectorName") or "secret"
        fs = ((d.get("SourceMetadata") or {}).get("Data") or {}).get("Filesystem") or {}
        name = os.path.basename(fs.get("file") or "")
        loc = files.get(name, fallback_url)
        raw = d.get("Raw") or d.get("RawV2") or ""
        f = finding(
            TOOL, f"verified-{det.lower()}", f"Live {det} credential in client code", "critical", "exposed_secret", loc,
            description=f"TruffleHog tested this {det} credential against its provider and it WORKS. "
                        "Anyone who opens your site can copy and use it.",
            evidence=f"{mask(raw)} (verified live)" if raw else "verified live",
            remediation=f"Revoke and rotate this {det} credential now, then move the calls that need it to a server or "
                        "edge function and read it from a server-side environment variable.",
            tags=["secret", "verified", det.lower()],
        )
        out[f.id] = f
    return list(out.values())


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("trufflehog not found (see setup_fedora.sh, or https://github.com/trufflesecurity/trufflehog)")
    if os.environ.get("ACHILLES_TRUFFLEHOG_VERIFY", "1") == "0":
        raise ToolSkipped("secret verification disabled (ACHILLES_TRUFFLEHOG_VERIFY=0)")
    bundle = await jsfetch.get_bundle(ctx)
    if not bundle.files:
        raise RuntimeError("could not download the page or its scripts")
    res = await run_cmd(build_argv(ctx, str(bundle.dir)), timeout=proc_timeout(ctx),
                        env={"HOME": os.environ.get("HOME", "/root")})
    save_raw(ctx, "trufflehog.jsonl", res.stdout)
    if res.stderr:
        save_raw(ctx, "trufflehog.stderr.txt", res.stderr)
    findings = parse(res.stdout, bundle.files, ctx.target.url)
    if res.returncode not in (0, None) and not findings and not res.timed_out:
        raise RuntimeError(f"trufflehog exited {res.returncode}: {res.stderr.strip()[-300:]}")
    msg = f"scanned {len(bundle.files)} files, {len(findings)} live secrets"
    return ToolOutput(findings=findings, command=res.command, partial=res.timed_out,
                      message=msg + (" (cut at time limit)" if res.timed_out else ""))
