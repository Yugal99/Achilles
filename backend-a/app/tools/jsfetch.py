"""Download the target page and its same-origin scripts (+ source maps) once per scan, so
trufflehog, retire and arjun can all scan the same files. GET requests only, same-origin only."""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from .base import ToolContext
from .jscheck import CHUNK_REF, SCRIPT_SRC, SOURCEMAP, Checker

API_REF = re.compile(r"[\"'`](/(?:api|rest/v1|graphql|trpc)/[A-Za-z0-9_\-/.]{1,60})[\"'`]")
MAX_MAPS = 5

_cache: dict[str, "asyncio.Future[JsBundle]"] = {}


@dataclass
class JsBundle:
    dir: Path
    files: dict[str, str] = field(default_factory=dict)  # saved filename -> source URL
    api_paths: list[str] = field(default_factory=list)


def _safe_name(i: int, url: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]", "_", urlsplit(url).path.strip("/").split("/")[-1] or "index")
    return f"{i:03d}_{base[:80]}"


def _download(ctx: ToolContext, max_scripts: int) -> JsBundle:
    c = Checker(ctx)
    out = ctx.raw_dir / "js"
    out.mkdir(parents=True, exist_ok=True)
    bundle = JsBundle(dir=out)
    status, _, _, html, final = c.get(ctx.target.url)
    texts: list[tuple[str, str]] = [(final, html)]
    queue = [urljoin(final, s) for s in SCRIPT_SRC.findall(html)]
    seen: set[str] = set()
    maps: list[str] = []
    fetched = 0
    while queue and fetched < max_scripts:
        u = queue.pop(0).split("#")[0]
        if u in seen or not c.same_site(u):
            continue
        seen.add(u)
        try:
            st, _, _, body, _ = c.get(u)
        except Exception:
            continue
        fetched += 1
        if st != 200:
            continue
        texts.append((u, body))
        for ref in CHUNK_REF.findall(body):
            queue.append(urljoin(u if ref.startswith(".") else final, ref))
        maps += [urljoin(u, m) for m in SOURCEMAP.findall(body[-500:])]
    for m in maps[:MAX_MAPS]:
        if not c.same_site(m):
            continue
        try:
            st, _, _, body, _ = c.get(m)
        except Exception:
            continue
        if st == 200 and '"sources"' in body[:5000]:
            texts.append((m, body))
    api: list[str] = []
    for i, (url, text) in enumerate(texts):
        name = _safe_name(i, url)
        (out / name).write_text(text)
        bundle.files[name] = url
        for p in API_REF.findall(text):
            if "${" not in p and p not in api:
                api.append(p)
    bundle.api_paths = api[:8]
    (ctx.raw_dir / "js_manifest.json").write_text(json.dumps(bundle.files, indent=1))
    return bundle


async def get_bundle(ctx: ToolContext) -> JsBundle:
    """One shared download per scan; concurrent tools await the same future."""
    fut = _cache.get(ctx.scan_id)
    if fut is None:
        if len(_cache) > 50:
            _cache.pop(next(iter(_cache)))
        fut = asyncio.ensure_future(asyncio.to_thread(_download, ctx, int(ctx.opts.get("max_scripts", 25))))
        _cache[ctx.scan_id] = fut
    return await asyncio.shield(fut)
