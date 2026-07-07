"""QTP application configuration. All env-driven knobs live here."""
import os

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class Config:
    # ── Application ────────────────────────────────────────────────────────
    SERVICE_NAME = os.getenv("SERVICE_NAME", "qtp")
    API_PORT     = _int("API_PORT", 5100)
    DEV_MODE     = _bool("DEV_MODE", True)
    LOG_LEVEL    = os.getenv("LOG_LEVEL", "INFO")
    ROLE         = os.getenv("ROLE", "api")  # api | worker | scheduler

    ALLOWED_ORIGINS = [
        o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]

    # ── PostgreSQL ─────────────────────────────────────────────────────────
    DATABASE_URL    = os.getenv("DATABASE_URL", "postgresql+psycopg2://qtp:qtp@localhost:5432/qtp")
    DB_POOL_SIZE    = _int("DB_POOL_SIZE", 5)
    DB_MAX_OVERFLOW = _int("DB_MAX_OVERFLOW", 10)
    DB_POOL_TIMEOUT = _int("DB_POOL_TIMEOUT", 30)

    # ── Redis (only read by the QF ETL import chain; QTP does not use it) ──
    REDIS_URL  = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = os.getenv("REDIS_PORT", "6379")
    REDIS_DB   = os.getenv("REDIS_DB", "0")

    # ── Keycloak ───────────────────────────────────────────────────────────
    # PUBLIC url = what the browser and issuer claim use (host-reachable).
    # INTERNAL url = what the API container uses to fetch JWKS (compose network).
    KEYCLOAK_PUBLIC_URL   = os.getenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080")
    KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://localhost:8080")
    KEYCLOAK_REALM        = os.getenv("KEYCLOAK_REALM", "qtp")
    KEYCLOAK_SPA_CLIENT_ID = os.getenv("KEYCLOAK_SPA_CLIENT_ID", "qtp-spa")
    KEYCLOAK_AUDIENCE      = os.getenv("KEYCLOAK_AUDIENCE", "qtp-api")
    # Issuer as it appears in tokens minted for the browser.
    KEYCLOAK_ISSUER = os.getenv(
        "KEYCLOAK_ISSUER",
        f"{KEYCLOAK_PUBLIC_URL.rstrip('/')}/realms/{KEYCLOAK_REALM}",
    )
    # Where the API actually fetches JWKS (internal DNS name in docker).
    KEYCLOAK_JWKS_URL = os.getenv(
        "KEYCLOAK_JWKS_URL",
        f"{KEYCLOAK_INTERNAL_URL.rstrip('/')}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs",
    )
    JWKS_CACHE_TTL = _int("JWKS_CACHE_TTL", 3600)
    # When true, /api/me and auth are bypassed with a synthetic admin principal.
    # Handy for local API smoke tests without Keycloak. Never enable in prod.
    AUTH_DISABLED = _bool("AUTH_DISABLED", False)

    # ── Keycloak admin bootstrap (used only by seed tooling) ───────────────
    KEYCLOAK_ADMIN_USER     = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
    KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")

    # ── Execution / worker ─────────────────────────────────────────────────
    WORKER_NAME          = os.getenv("WORKER_NAME", "qtp-worker-1")
    WORKER_CAPABILITIES  = tuple(
        c.strip() for c in os.getenv("WORKER_CAPABILITIES", "http,python").split(",") if c.strip()
    )
    WORKER_POLL_SECONDS  = float(os.getenv("WORKER_POLL_SECONDS", "1.0"))
    WORKER_HEARTBEAT_SECONDS = float(os.getenv("WORKER_HEARTBEAT_SECONDS", "5.0"))
    WORKER_STALE_SECONDS = float(os.getenv("WORKER_STALE_SECONDS", "30.0"))
    SCHEDULER_POLL_SECONDS = float(os.getenv("SCHEDULER_POLL_SECONDS", "2.0"))

    # ── Request-test execution limits / SSRF ───────────────────────────────
    REQUEST_MAX_TIMEOUT_MS = _int("REQUEST_MAX_TIMEOUT_MS", 60000)
    REQUEST_MAX_BODY_BYTES = _int("REQUEST_MAX_BODY_BYTES", 5 * 1024 * 1024)
    REQUEST_MAX_REDIRECTS  = _int("REQUEST_MAX_REDIRECTS", 5)
    # Block requests that resolve to private/loopback/link-local ranges.
    SSRF_BLOCK_PRIVATE = _bool("SSRF_BLOCK_PRIVATE", True)
    # Comma-separated hostnames/CIDRs explicitly allowed to bypass the block
    # (e.g. the demo target running inside the compose network).
    SSRF_ALLOWLIST = tuple(
        h.strip() for h in os.getenv("SSRF_ALLOWLIST", "").split(",") if h.strip()
    )

    # ── Tracing ────────────────────────────────────────────────────────────
    ENABLE_TRACING = _bool("ENABLE_TRACING", False)
    OTLP_ENDPOINT  = os.getenv("OTLP_ENDPOINT", "http://localhost:4317")
    SECRET_ENCRYPTION_KEY = os.getenv("SECRET_ENCRYPTION_KEY", "qtp-fallback-key-32bytes-long-123")

    # ── Test discovery ─────────────────────────────────────────────────────
    AUTOMATION_MODULES = tuple(
        m.strip() for m in os.getenv(
            "AUTOMATION_MODULES",
            "tests.automations.api.test_healthcheck,"
            "tests.automations.api.test_qtp_self,"
            "tests.automations.api.test_httpbin_methods,"
            "tests.automations.api.test_httpbin_responses",
        ).split(",") if m.strip()
    )

    # QTP's own API base URL, used by the self-tests' 'qtp_self' target.
    SELF_TARGET_URL = os.getenv("SELF_TARGET_URL", "http://api:5100/qtp")
