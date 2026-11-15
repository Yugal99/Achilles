"""ProjectDiscovery httpx: tech stack fingerprint (binary is `httpx` from go install, or `httpx-toolkit` on Kali)."""
from __future__ import annotations

import json

from ..models import Stack
from ..runner import run_cmd
from .base import ToolContext, ToolNotInstalled, ToolOutput, finding, save_raw

TOOL = "httpx"

NOTABLE = {
    "supabase": "Supabase", "firebase": "Firebase", "next.js": "Next.js", "vercel": "Vercel",
    "netlify": "Netlify", "react": "React", "vite": "Vite", "express": "Express",
    "nuxt": "Nuxt", "vue": "Vue", "svelte": "Svelte", "replit": "Replit", "cloudflare": "Cloudflare",
}


def build_argv(ctx: ToolContext) -> list[str]:
    return [ctx.bin, "-u", ctx.target.url, "-json", "-silent", "-no-color",
            "-tech-detect", "-title", "-status-code", "-web-server", "-content-type",
            "-location", "-cdn", "-follow-redirects", "-timeout", "10", "-retries", "1"]


def parse(stdout: str, url: str) -> tuple[Stack, list]:
    stack = Stack()
    findings = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        stack.technologies = sorted(set(stack.technologies) | set(d.get("tech") or d.get("technologies") or []))
        stack.webserver = d.get("webserver") or d.get("web-server") or stack.webserver
        stack.title = d.get("title") or stack.title
        stack.status_code = d.get("status_code") or d.get("status-code") or stack.status_code
        stack.final_url = d.get("final_url") or d.get("url") or stack.final_url
        stack.content_type = d.get("content_type") or d.get("content-type") or stack.content_type
        cdn = d.get("cdn_name") or (d.get("cdn") if isinstance(d.get("cdn"), str) else "")
        stack.cdn = cdn or stack.cdn
    for tech in stack.technologies:
        findings.append(finding(
            TOOL, f"tech-{tech.lower().split(':')[0].replace(' ', '-')}", f"Built with {tech}", "info", "tech", url,
            description="Detected technology. Used to choose which checks matter.", evidence=tech, tags=["tech"],
        ))
    return stack, findings


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("ProjectDiscovery httpx not found (go install github.com/projectdiscovery/httpx/cmd/httpx@latest)")
    res = await run_cmd(build_argv(ctx), timeout=ctx.opts["timeout"] - 2)
    save_raw(ctx, "httpx.jsonl", res.stdout)
    stack, findings = parse(res.stdout, ctx.target.url)
    if not stack.status_code and not res.timed_out:
        raise RuntimeError("httpx got no response from the target" + (f": {res.stderr.strip()[:200]}" if res.stderr else ""))
    return ToolOutput(findings=findings, stack=stack, command=res.command, partial=res.timed_out,
                      message=", ".join(stack.technologies) or f"HTTP {stack.status_code}")
