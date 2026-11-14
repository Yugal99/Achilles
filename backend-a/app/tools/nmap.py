"""Nmap: open ports and service versions. Non-root TCP connect scan (-sT), no scripts."""
from __future__ import annotations

import xml.etree.ElementTree as ET

from ..runner import run_cmd
from .base import ToolContext, ToolNotInstalled, ToolOutput, finding, save_raw

TOOL = "nmap"

# port -> (severity, short title, why it matters, fix)
RISKY = {
    3306: ("high", "MySQL database exposed to the internet", "Anyone can try to log in to your database directly."),
    5432: ("high", "PostgreSQL database exposed to the internet", "Anyone can try to log in to your database directly."),
    1433: ("high", "SQL Server database exposed to the internet", "Anyone can try to log in to your database directly."),
    1521: ("high", "Oracle database exposed to the internet", "Anyone can try to log in to your database directly."),
    27017: ("critical", "MongoDB exposed to the internet", "Exposed MongoDB instances are routinely wiped and ransomed."),
    28017: ("high", "MongoDB HTTP interface exposed", "Legacy MongoDB admin interface reachable."),
    6379: ("critical", "Redis exposed to the internet", "Redis often has no password; attackers can read data or get code execution."),
    11211: ("high", "Memcached exposed to the internet", "Cache contents can be read and the service abused for DDoS."),
    9200: ("critical", "Elasticsearch exposed to the internet", "Indexes can usually be read and deleted without login."),
    9300: ("high", "Elasticsearch transport port exposed", "Cluster transport should never be public."),
    5984: ("high", "CouchDB exposed to the internet", "Database API reachable from anywhere."),
    7474: ("high", "Neo4j browser exposed", "Graph database console reachable from anywhere."),
    2375: ("critical", "Docker API exposed without TLS", "Anyone can start containers on this host, i.e. full takeover."),
    2376: ("medium", "Docker API port exposed", "Docker daemon reachable from the internet."),
    9229: ("critical", "Node.js debugger exposed", "The inspector lets anyone run code inside your app."),
    5601: ("high", "Kibana exposed", "Log/analytics console reachable from anywhere."),
    15672: ("medium", "RabbitMQ management console exposed", "Admin UI reachable; default guest login is common."),
    23: ("high", "Telnet open", "Unencrypted remote login."),
    21: ("medium", "FTP open", "Unencrypted file transfer; often allows anonymous login."),
    445: ("high", "SMB open to the internet", "Windows file sharing should never be public."),
    3000: ("medium", "Dev server port 3000 open", "Looks like a development server (Next.js/React/Express) left running."),
    3001: ("medium", "Dev server port 3001 open", "Looks like a development server left running."),
    4200: ("medium", "Angular dev server port open", "Development server left running."),
    5000: ("medium", "Dev server port 5000 open", "Flask/Express dev servers default here; debug mode may be on."),
    5001: ("medium", "Dev server port 5001 open", "Development server left running."),
    5173: ("medium", "Vite dev server open", "Vite dev server can serve your source files and env."),
    8000: ("low", "Alternate HTTP port 8000 open", "Often a dev server (Django/uvicorn) or admin panel."),
    8080: ("low", "Alternate HTTP port 8080 open", "Often a dev server, proxy, or admin panel."),
    8081: ("low", "Alternate HTTP port 8081 open", "Often a dev server or admin panel."),
    8888: ("medium", "Port 8888 open (often Jupyter)", "Jupyter notebooks allow running arbitrary code."),
    9000: ("low", "Port 9000 open", "Often PHP-FPM, Portainer, or SonarQube."),
    9090: ("low", "Port 9090 open", "Often Prometheus or Cockpit admin UI."),
    50000: ("low", "Port 50000 open", "Often Jenkins agent port."),
}
EXPECTED = {80, 443}


def build_argv(ctx: ToolContext) -> list[str]:
    o = ctx.opts
    argv = [ctx.bin, "-Pn", "-sT", "-sV", "--version-light", "-T4", "--max-retries", "1",
            "--host-timeout", o.get("host_timeout", "70s"), "--open", "-oX", "-"]
    if o.get("ports") == "-":
        argv += ["-p-"]
    elif o.get("ports"):
        ports = o["ports"].split(",")
        if str(ctx.target.port) not in ports:  # always include the app's own port
            ports.append(str(ctx.target.port))
        argv += ["-p", ",".join(ports)]
    else:
        argv += ["--top-ports", str(o.get("top_ports", 1000))]
    argv.append(ctx.target.host)
    return argv


def parse(xml_text: str, host: str, app_port: int = 443) -> list:
    findings = []
    if not xml_text.strip():
        return findings
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return findings
    for port_el in root.iter("port"):
        state = port_el.find("state")
        if state is None or state.get("state") != "open":
            continue
        port = int(port_el.get("portid"))
        proto = port_el.get("protocol", "tcp")
        svc = port_el.find("service")
        name = svc.get("name", "") if svc is not None else ""
        product = " ".join(x for x in [
            svc.get("product", "") if svc is not None else "",
            svc.get("version", "") if svc is not None else "",
        ] if x).strip()
        loc = f"{host}:{port}/{proto}"
        evidence = f"{port}/{proto} open {name} {product}".strip()
        if port in RISKY:
            sev, title, why = RISKY[port]
            findings.append(finding(
                TOOL, f"open-port-{port}", title, sev, "open_port", loc,
                description=why, evidence=evidence,
                remediation=f"Close port {port} in your firewall / cloud security group, or bind the service to "
                            "127.0.0.1 or a private network. Only 80/443 should face the internet.",
                tags=["port", str(port), name] if name else ["port", str(port)],
            ))
        elif port in EXPECTED or port == app_port:
            findings.append(finding(
                TOOL, f"open-port-{port}", f"Web port {port} open ({name or 'http'})", "info", "open_port", loc,
                description="Expected for a web app.", evidence=evidence, tags=["port", str(port)],
            ))
        else:
            findings.append(finding(
                TOOL, f"open-port-{port}", f"Unexpected open port {port} ({name or 'unknown'})", "low", "open_port",
                loc, description="A service other than the website is reachable from the internet.",
                evidence=evidence, remediation="If this service isn't meant to be public, firewall it.",
                tags=["port", str(port)],
            ))
    return findings


async def run(ctx: ToolContext) -> ToolOutput:
    if not ctx.bin:
        raise ToolNotInstalled("nmap not found (apt install nmap)")
    argv = build_argv(ctx)
    res = await run_cmd(argv, timeout=ctx.opts["timeout"] - 2)
    save_raw(ctx, "nmap.xml", res.stdout)
    if res.stderr:
        save_raw(ctx, "nmap.stderr.txt", res.stderr)
    out = ToolOutput(findings=parse(res.stdout, ctx.target.host, ctx.target.port), command=res.command, partial=res.timed_out)
    if res.timed_out:
        out.message = "nmap hit its time limit; port list may be incomplete"
    elif res.returncode not in (0, None):
        raise RuntimeError(f"nmap exited {res.returncode}: {res.stderr.strip()[:300]}")
    else:
        out.message = f"{len(out.findings)} open ports"
    return out
