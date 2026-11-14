from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from ..models import Category, Finding, Severity, Stack, Target


@dataclass
class ToolContext:
    scan_id: str
    target: Target
    opts: dict
    raw_dir: Path
    bin: str = ""


@dataclass
class ToolOutput:
    findings: list[Finding] = field(default_factory=list)
    stack: Stack | None = None
    message: str = ""
    command: str = ""
    partial: bool = False  # True when the tool was cut by its timeout but still produced results


class ToolSkipped(Exception):
    """Raise to mark a tool as skipped (e.g. no TLS on an http:// target)."""


class ToolNotInstalled(Exception):
    pass


def finding(tool: str, check_id: str, title: str, severity: str | Severity, category: str | Category,
            location: str, **kw) -> Finding:
    return Finding(
        id=Finding.make_id(tool, check_id, location),
        tool=tool,
        check_id=check_id,
        title=title,
        severity=Severity(severity) if isinstance(severity, str) else severity,
        category=Category(category) if isinstance(category, str) else category,
        location=location,
        **kw,
    )


def save_raw(ctx: ToolContext, name: str, text: str) -> None:
    ctx.raw_dir.mkdir(parents=True, exist_ok=True)
    (ctx.raw_dir / name).write_text(text or "")
