"""Run an external tool, with a hard timeout unless the profile sets none, keeping whatever output it produced."""
from __future__ import annotations

import asyncio
import os
import shlex
import signal
from dataclasses import dataclass


@dataclass
class ProcResult:
    returncode: int | None
    stdout: str
    stderr: str
    timed_out: bool
    command: str


async def run_cmd(argv: list[str], timeout: float | None, env: dict | None = None) -> ProcResult:
    """Start argv in its own process group. timeout=None waits for the tool to exit by itself.
    On timeout (or cancel) kill the whole group,
    and return the stdout collected so far so streaming tools (nuclei, httpx) still yield results."""
    cmd_str = " ".join(shlex.quote(a) for a in argv)
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.DEVNULL,
        start_new_session=True,
        env={**os.environ, **(env or {})},
    )
    out_chunks: list[bytes] = []
    err_chunks: list[bytes] = []

    async def pump(stream, sink):
        while True:
            chunk = await stream.read(65536)
            if not chunk:
                break
            sink.append(chunk)

    pumps = asyncio.gather(pump(proc.stdout, out_chunks), pump(proc.stderr, err_chunks))
    timed_out = False
    try:
        await asyncio.wait_for(asyncio.shield(pumps), timeout=timeout)
        await asyncio.wait_for(proc.wait(), timeout=5)
    except asyncio.TimeoutError:
        timed_out = True
        _kill(proc)
    except asyncio.CancelledError:
        _kill(proc)
        raise
    finally:
        if proc.returncode is None:
            _kill(proc)
            try:
                await asyncio.wait_for(proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                pass
        try:
            await asyncio.wait_for(pumps, timeout=2)
        except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
            pumps.cancel()
    return ProcResult(
        returncode=proc.returncode,
        stdout=b"".join(out_chunks).decode(errors="replace"),
        stderr=b"".join(err_chunks).decode(errors="replace"),
        timed_out=timed_out,
        command=cmd_str,
    )


def _kill(proc) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
