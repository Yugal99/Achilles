"""The one JSON scan-result schema every tool is normalized into. See docs/SCHEMA.md."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"


def now() -> datetime:
    return datetime.now(timezone.utc)


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


SEVERITY_ORDER = {s: i for i, s in enumerate(["critical", "high", "medium", "low", "info"])}
SEVERITY_WEIGHT = {"critical": 40, "high": 20, "medium": 8, "low": 3, "info": 0}


class Category(str, Enum):
    exposed_secret = "exposed_secret"   # API keys / tokens in client code or files
    exposed_file = "exposed_file"       # .env, .git, backups, debug pages reachable
    open_port = "open_port"             # databases, dev servers, admin services on the internet
    tls = "tls"                         # certificate and protocol problems
    headers = "headers"                 # missing security headers, cookie flags
    cors = "cors"                       # permissive cross-origin policy
    misconfig = "misconfig"             # other configuration problems
    vulnerability = "vulnerability"     # known CVE / vulnerable component
    tech = "tech"                       # informational: what the app is built with


class Finding(BaseModel):
    id: str = Field(description="Stable hash of tool+check_id+location; same issue => same id across rescans")
    tool: str = Field(description="nmap | httpx | nuclei | testssl | jscheck")
    check_id: str = Field(description="Tool-specific check name, e.g. nuclei template id")
    title: str
    severity: Severity
    category: Category
    description: str = ""
    location: str = Field("", description="URL, host:port, or file where it was seen")
    evidence: str = Field("", description="Short proof. Secrets are always masked.")
    remediation: str = ""
    references: list[str] = []
    tags: list[str] = []
    cvss_score: Optional[float] = Field(None, ge=0, le=10, description="CVSS base score (0.0-10.0) as stated by the "
                                        "tool. null when the tool gives none; Achilles never estimates one.")
    cvss_vector: str = Field("", description="CVSS vector string, e.g. CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N")

    @staticmethod
    def make_id(tool: str, check_id: str, location: str) -> str:
        return hashlib.sha1(f"{tool}|{check_id}|{location}".encode()).hexdigest()[:12]


class ToolStatus(str, Enum):
    pending = "pending"
    running = "running"
    ok = "ok"
    timeout = "timeout"
    error = "error"
    skipped = "skipped"
    not_installed = "not_installed"


class ToolRun(BaseModel):
    status: ToolStatus = ToolStatus.pending
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_s: Optional[float] = None
    timeout_s: int = 0
    findings_count: int = 0
    message: str = ""
    command: str = ""


class ScanStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"   # every tool finished ok/skipped
    partial = "partial"       # finished, but at least one tool timed out / errored / missing
    failed = "failed"         # nothing usable (e.g. target unreachable, internal error)
    cancelled = "cancelled"


class Target(BaseModel):
    input: str
    url: str
    scheme: str
    host: str
    port: int
    ips: list[str] = []


class Stack(BaseModel):
    technologies: list[str] = []
    webserver: str = ""
    title: str = ""
    status_code: Optional[int] = None
    final_url: str = ""
    content_type: str = ""
    cdn: str = ""


class Summary(BaseModel):
    total: int = 0
    by_severity: dict[str, int] = {s: 0 for s in SEVERITY_ORDER}
    by_category: dict[str, int] = {}
    risk_score: int = Field(0, description="0 (clean) .. 100 (on fire). Weighted by severity, capped.")
    grade: str = Field("A", description="A..F derived from risk_score")


class ScanResult(BaseModel):
    schema_version: str = SCHEMA_VERSION
    scan_id: str
    status: ScanStatus = ScanStatus.queued
    profile: str
    target: Target
    created_at: datetime = Field(default_factory=now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_s: Optional[float] = None
    queue_position: Optional[int] = None
    progress: int = Field(0, description="0..100, share of tools finished")
    tools: dict[str, ToolRun] = {}
    stack: Stack = Stack()
    findings: list[Finding] = []
    summary: Summary = Summary()
    error: str = ""


class ScanStatusView(BaseModel):
    """Light-weight body for polling (no findings)."""
    scan_id: str
    status: ScanStatus
    profile: str
    target: Target
    progress: int
    queue_position: Optional[int]
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration_s: Optional[float]
    tools: dict[str, ToolRun]
    summary: Summary
    error: str


def summarize(findings: list[Finding]) -> Summary:
    s = Summary()
    for f in findings:
        s.by_severity[f.severity.value] = s.by_severity.get(f.severity.value, 0) + 1
        s.by_category[f.category.value] = s.by_category.get(f.category.value, 0) + 1
    s.total = len(findings)
    score = sum(SEVERITY_WEIGHT[f.severity.value] for f in findings)
    s.risk_score = min(100, score)
    s.grade = "A" if score == 0 else "B" if score < 10 else "C" if score < 25 else "D" if score < 50 else "F"
    return s
