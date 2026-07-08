"""SSRF egress guard for the request builder.

The request builder can call arbitrary URLs, so before every outbound request
(and on every redirect hop) we resolve the hostname and validate the *resolved*
IPs against private/loopback/link-local/metadata ranges. A hostname-string
check alone is insufficient — this resolves and inspects the real address.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from src.config import Config
from src.core.errors import ValidationError

# Cloud metadata + always-blocked singletons.
_METADATA_IPS = {"169.254.169.254", "100.100.100.200"}


def _is_blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    if ip in _METADATA_IPS:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def _allowlisted(host: str) -> bool:
    host = (host or "").lower()
    for entry in Config.SSRF_ALLOWLIST:
        entry = entry.lower()
        if not entry:
            continue
        if host == entry:
            return True
        # CIDR allowance
        try:
            net = ipaddress.ip_network(entry, strict=False)
            try:
                if ipaddress.ip_address(host) in net:
                    return True
            except ValueError:
                pass
        except ValueError:
            pass
    return False


def resolve_and_check(url: str) -> None:
    """Raise ValidationError if *url* resolves to a blocked address.

    Skips the block entirely when SSRF_BLOCK_PRIVATE is off, and honors the
    per-deployment allowlist (used for internal test targets inside the compose
    network).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError(f"unsupported scheme: {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise ValidationError("url has no host")

    if not Config.SSRF_BLOCK_PRIVATE or _allowlisted(host):
        return

    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise ValidationError(f"cannot resolve host {host!r}: {exc}")

    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise ValidationError(
                f"host {host!r} resolves to blocked address {ip} "
                f"(private/loopback/link-local/metadata are denied)"
            )
