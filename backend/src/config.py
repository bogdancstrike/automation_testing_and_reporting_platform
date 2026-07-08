"""QTP application configuration. All env-driven knobs live here."""
import os
import socket

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
    # WORKER_NAME is the Kafka *consumer group* shared by every worker replica.
    # The QF ETL framework uses it as the group id, so Kafka distributes the
    # runs-topic partitions across all replicas that share this value. It is NOT
    # a per-instance identity — that is WORKER_INSTANCE_ID below.
    WORKER_NAME          = os.getenv("WORKER_NAME", "qtp-workers")
    # Per-container identity for the `workers` table / heartbeats / dashboards.
    # Defaults to the container hostname, which is unique per replica.
    WORKER_INSTANCE_ID   = os.getenv("WORKER_INSTANCE_ID") or socket.gethostname()
    WORKER_CAPABILITIES  = tuple(
        c.strip() for c in os.getenv("WORKER_CAPABILITIES", "http,python").split(",") if c.strip()
    )
    # How many runs one worker process executes concurrently (ETL thread pool).
    WORKER_MAX_CONCURRENCY = _int("WORKER_MAX_CONCURRENCY", 4)
    # Browser scenarios (playwright/selenium) run in a separate OS process so the
    # sync browser APIs don't collide with the worker's gevent hub. This bounds
    # how long that child may run before it is killed and the run marked timeout.
    BROWSER_RUN_TIMEOUT_S = _int("BROWSER_RUN_TIMEOUT_S", 180)
    # A browser run launches a full chromium (heavy on CPU/RAM/shm). Cap how many
    # run at once *per worker process* so concurrent runs don't thrash the box or
    # stampede a target — the rest queue for a slot rather than piling on.
    BROWSER_MAX_CONCURRENCY = _int("BROWSER_MAX_CONCURRENCY", 2)
    WORKER_POLL_SECONDS  = float(os.getenv("WORKER_POLL_SECONDS", "1.0"))
    WORKER_HEARTBEAT_SECONDS = float(os.getenv("WORKER_HEARTBEAT_SECONDS", "5.0"))
    WORKER_STALE_SECONDS = float(os.getenv("WORKER_STALE_SECONDS", "30.0"))
    SCHEDULER_POLL_SECONDS = float(os.getenv("SCHEDULER_POLL_SECONDS", "2.0"))
    # Scheduler now runs *inside* the backend (API) process as a background
    # thread. Set false to disable it on a given replica if ever needed.
    SCHEDULER_ENABLED    = _bool("SCHEDULER_ENABLED", True)

    # ── Kafka (worker transport) ───────────────────────────────────────────
    # Runs are dispatched to workers over Kafka: the backend produces one
    # message per enqueued run onto KAFKA_RUNS_TOPIC (keyed by run id, so each
    # run hashes to a single partition), and the worker consumer group splits
    # the partitions across replicas. This is what makes workers horizontally
    # scalable — add a replica and Kafka rebalances partitions onto it.
    KAFKA_BOOTSTRAP_SERVERS   = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094")
    KAFKA_RUNS_TOPIC          = os.getenv("KAFKA_RUNS_TOPIC", "qtp-workers")
    KAFKA_RUNS_PARTITIONS     = _int("KAFKA_RUNS_PARTITIONS", 10)
    # The QF @kafka_handler contract requires a non-empty topics_out; the run
    # executor returns None so nothing is actually published here — it exists
    # only to satisfy the framework and to carry optional worker events later.
    KAFKA_WORKER_EVENTS_TOPIC = os.getenv("KAFKA_WORKER_EVENTS_TOPIC", "qtp-worker-events")
    KAFKA_DLQ_TOPIC           = os.getenv("KAFKA_DLQ_TOPIC", "qtp-workers-dlq")
    # Required by framework.etl._validate_config() at worker startup.
    ERROR_TOPIC               = os.getenv("ERROR_TOPIC", "qtp-errors")

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
    # Scenarios are discovered by recursively scanning backend/scenarios/automation
    # (one dir per target). This explicit module list is only a fallback for when
    # the path scan finds nothing; leave empty in normal operation.
    AUTOMATION_MODULES = tuple(
        m.strip() for m in os.getenv("AUTOMATION_MODULES", "").split(",") if m.strip()
    )

    # QTP's own API base URL, used by the self-tests' 'qtp_self' target.
    SELF_TARGET_URL = os.getenv("SELF_TARGET_URL", "http://api:5100/qtp")
