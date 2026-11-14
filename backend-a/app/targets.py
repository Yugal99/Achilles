"""Parse targets and refuse anything that is not a public, owner-verified host."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

from .config import settings
from .models import Target


class TargetError(ValueError):
    pass


def parse_target(raw: str) -> Target:
    raw = (raw or "").strip()
    if not raw:
        raise TargetError("target is empty")
    if "://" not in raw:
        raw_url = "https://" + raw
    else:
        raw_url = raw
    parts = urlsplit(raw_url)
    if parts.scheme not in ("http", "https"):
        raise TargetError("only http:// and https:// targets are supported")
    if parts.username or parts.password:
        raise TargetError("credentials in the URL are not allowed")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise TargetError("could not find a host name in the target")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    default_port = (parts.scheme == "https" and port == 443) or (parts.scheme == "http" and port == 80)
    netloc = host if default_port else f"{host}:{port}"
    if ":" in host and not host.startswith("["):  # IPv6 literal
        netloc = f"[{host}]" if default_port else f"[{host}]:{port}"
    url = f"{parts.scheme}://{netloc}{parts.path or '/'}"
    return Target(input=raw, url=url, scheme=parts.scheme, host=host, port=port)


def is_lab_target(host: str) -> bool:
    return host.lower() in settings.lab_targets


def resolve(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise TargetError(f"cannot resolve {host}: {e.strerror or e}") from e
    return sorted({i[4][0] for i in infos})


def _blocked(ip: str) -> bool:
    a = ipaddress.ip_address(ip)
    if a.version == 6 and a.ipv4_mapped:
        a = a.ipv4_mapped
    return (
        a.is_private or a.is_loopback or a.is_link_local or a.is_multicast
        or a.is_reserved or a.is_unspecified
        or str(a) in ("169.254.169.254", "100.100.100.200")  # cloud metadata endpoints
        or (a.version == 4 and a in ipaddress.ip_network("100.64.0.0/10"))  # CGNAT
    )


def check_network_policy(t: Target) -> Target:
    """Resolve the host and block private/loopback/metadata addresses unless it is a lab target."""
    t.ips = resolve(t.host)
    if is_lab_target(t.host):
        return t
    bad = [ip for ip in t.ips if _blocked(ip)]
    if bad:
        raise TargetError(
            f"{t.host} resolves to a private/internal address ({', '.join(bad)}). "
            "Add it to ACHILLES_LAB_TARGETS only if it is a lab box you run yourself."
        )
    return t
