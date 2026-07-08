"""Run browser scenarios in a separate OS process.

Playwright's *sync* API drives its own asyncio loop through an internal greenlet.
Inside the worker that machinery collides with gevent's hub (``worker/wsgi.py``
calls ``monkey.patch_all()``): running it in-process hangs or raises greenlet
errors, and a stuck browser run can starve the Kafka-consumer greenlet and the
heartbeat loop. So each browser scenario (``playwright`` / ``selenium``) runs in
a fresh child interpreter that is NOT gevent-patched — the sync browser APIs then
behave normally, and a crashed or hung browser is contained to the child and
bounded by a timeout (its whole process group is killed on expiry).

This module has two roles that share one wire format:
  * **library** — the runner imports :func:`run_scenario_in_subprocess`;
  * **script** — the child. ``python subprocess_exec.py <result_path>`` reads a
    JSON job on stdin, runs the scenario's full lifecycle, and writes a JSON
    result to ``<result_path>``. The result goes to a file, not stdout, because
    scenarios freely ``print()`` (see ``scenarios/.../test_playwright.py``) and
    would otherwise corrupt the contract.

Secrets travel to the child over stdin (a pipe), never on argv or disk.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

# Browser test types that must run out-of-process. Kept local (not imported from
# base) so the child can load this module before touching the rest of the app.
BROWSER_TYPES = frozenset({"playwright", "selenium"})

# Cap concurrent browser subprocesses per worker process. A browser run launches
# a full chromium; letting all WORKER_MAX_CONCURRENCY slots do so at once thrashes
# CPU/RAM/shm and stampedes the target (works 1-by-1, fails concurrently). Under
# gevent the acquire() yields cooperatively, so queued runs don't block the hub.
_browser_slots: threading.BoundedSemaphore | None = None
_slots_init_lock = threading.Lock()


def _browser_semaphore() -> threading.BoundedSemaphore:
    global _browser_slots
    if _browser_slots is None:
        with _slots_init_lock:
            if _browser_slots is None:
                from src.config import Config
                n = max(1, int(getattr(Config, "BROWSER_MAX_CONCURRENCY", 2)))
                _browser_slots = threading.BoundedSemaphore(n)
    return _browser_slots


# ── Wire format (shared by parent and child) ───────────────────────────────
def _encode_job(code_ref: str, ctx: Any) -> str:
    return json.dumps({
        "code_ref": code_ref,
        "correlation_id": ctx.correlation_id,
        "variables": ctx.variables,
        "secrets": ctx.secrets,
        "targets": {
            k: {"key": t.key, "base_url": t.base_url, "default_headers": t.default_headers}
            for k, t in ctx.targets.items()
        },
    })


def _encode_result(result: Any, logs: list[dict]) -> str:
    # default=str keeps a non-JSON expected/actual/response value from aborting
    # the whole run — it degrades to its string form, same as the DB would store.
    return json.dumps({
        "status": result.status,
        "error_category": result.error_category,
        "error_message": result.error_message,
        "response": result.response or {},
        "metrics": result.metrics or {},
        "steps": [
            {"name": s.name, "status": s.status, "duration_ms": s.duration_ms,
             "error": s.error, "step_id": s.step_id}
            for s in result.steps
        ],
        "assertions": [
            {"source": a.source, "operator": a.operator, "expected": a.expected,
             "actual": a.actual, "passed": a.passed, "target": a.target, "message": a.message}
            for a in result.assertions
        ],
        "logs": logs,
    }, default=str)


def _decode_result(payload: dict) -> Any:
    from src.testkit.result import AssertionResult, StepResult, TestResult
    steps = [
        StepResult(name=s["name"], status=s["status"], duration_ms=s.get("duration_ms", 0),
                   error=s.get("error"), step_id=s.get("step_id"))
        for s in payload.get("steps", [])
    ]
    assertions = [
        AssertionResult(source=a["source"], operator=a["operator"], expected=a.get("expected"),
                        actual=a.get("actual"), passed=bool(a.get("passed")),
                        target=a.get("target"), message=a.get("message", ""))
        for a in payload.get("assertions", [])
    ]
    return TestResult(
        status=payload["status"], steps=steps, assertions=assertions,
        error_category=payload.get("error_category"), error_message=payload.get("error_message"),
        response=payload.get("response") or {}, metrics=payload.get("metrics") or {},
    )


# ── Parent side ────────────────────────────────────────────────────────────
def _kill_group(proc: subprocess.Popen) -> None:
    """SIGKILL the child's whole process group (python + node driver + browser)."""
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            proc.kill()
        except OSError:  # pragma: no cover - already gone
            pass


def run_scenario_in_subprocess(code_ref: str, ctx: Any, *, timeout_s: float) -> Any:
    """Execute a browser scenario in a fresh child process and fold its evidence
    back into ``ctx``. Returns a ``TestResult`` the runner persists as usual."""
    from src.testkit.result import ERROR, TIMEOUT, TestResult

    job = _encode_job(code_ref, ctx)
    fd, result_path = tempfile.mkstemp(prefix="qtp-browser-", suffix=".json")
    os.close(fd)

    # Wait for a browser slot before spawning chromium. The acquire yields under
    # gevent, so other (e.g. HTTP) runs keep progressing while this one queues.
    sem = _browser_semaphore()
    waited = time.monotonic()
    sem.acquire()
    queued_ms = int((time.monotonic() - waited) * 1000)
    if queued_ms > 50:
        ctx.log("info", f"waited {queued_ms}ms for a browser slot")
    try:
        proc = subprocess.Popen(
            [sys.executable, os.path.abspath(__file__), result_path],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,  # own process group so the timeout can reap the browser
        )
        try:
            out, err = proc.communicate(input=job, timeout=timeout_s)
        except subprocess.TimeoutExpired:
            _kill_group(proc)
            proc.wait()
            ctx.log("error", f"browser scenario exceeded {timeout_s:.0f}s; process group killed")
            return TestResult(status=TIMEOUT, error_category="timeout",
                              error_message=f"browser scenario timed out after {timeout_s:.0f}s")

        # Child stdout/stderr are scenario prints and browser chatter — never the
        # result. Keep a trimmed copy to surface as evidence / diagnose crashes.
        noise = ((out or "") + (err or "")).strip()

        try:
            with open(result_path) as f:
                payload = json.load(f)
        except (OSError, json.JSONDecodeError):
            ctx.log("error", f"browser subprocess produced no result (exit {proc.returncode})")
            return TestResult(
                status=ERROR, error_category="infra_error",
                error_message=f"browser subprocess exited {proc.returncode} without a result: {noise[-500:]}",
            )

        # Child logs are already redacted (the child called ctx.log with the same
        # secrets); splice them in so _persist writes them like an in-process run.
        for entry in payload.get("logs", []):
            ctx._logs.append(entry)
        if noise:
            ctx.log("debug", f"browser subprocess output: {noise[-1000:]}")
        return _decode_result(payload)
    finally:
        sem.release()
        try:
            os.unlink(result_path)
        except OSError:  # pragma: no cover
            pass


# ── Child side ─────────────────────────────────────────────────────────────
def _run_lifecycle(code_ref: str, ctx: Any) -> Any:
    """Mirror of ``runner._run_code_test`` — same validate/setup/execute/cleanup/
    teardown contract, but self-contained so the child needs no DB/kafka imports."""
    import importlib

    from src.testkit.result import ERROR, TestResult

    module_name, _, class_name = code_ref.partition(":")
    try:
        module = importlib.import_module(module_name)
        cls = getattr(module, class_name)
        instance = cls()
    except Exception as e:  # noqa: BLE001
        return TestResult(status=ERROR, error_category="script_error",
                          error_message=f"could not load {code_ref}: {e}")

    result: Any
    try:
        instance.validate_config(dict(getattr(cls.metadata, "default_config", {})))
        instance.setup(ctx)
        result = instance.execute(ctx)
    except Exception as e:  # noqa: BLE001
        result = TestResult(status=ERROR, error_category="script_error", error_message=str(e))
    finally:
        if hasattr(ctx, '_browser') and getattr(ctx._browser, '_driver', None):
            try:
                logs = ctx._browser._driver.get_log("performance")
                for entry in logs:
                    msg = json.loads(entry.get("message", "{}")).get("message", {})
                    if msg.get("method") == "Network.responseReceived":
                        resp = msg.get("params", {}).get("response", {})
                        url = resp.get("url", "")
                        status = resp.get("status", 0)
                        timing = resp.get("timing", {})
                        if url and timing:
                            dns = max(0, timing.get("dnsEnd", 0) - timing.get("dnsStart", 0))
                            ttfb = max(0, timing.get("receiveHeadersEnd", 0) - timing.get("connectStart", 0))
                            # CDP timings don't directly have duration, just use relative estimates
                            download = 0
                            dur = ttfb + dns
                            
                            headers = resp.get("headers", {})
                            lower_headers = {k.lower(): v for k, v in headers.items()}
                            content_type = resp.get("mimeType", "").split(";")[0]
                            content_length = int(lower_headers.get("content-length", 0)) if str(lower_headers.get("content-length", "0")).isdigit() else 0

                            ctx.record_network_call(
                                method="GET", # approximation for Selenium logs without full request parsing
                                url=url,
                                status_code=status,
                                duration_ms=int(dur),
                                dns=int(dns),
                                ttfb=int(ttfb),
                                download=int(download),
                                content_type=content_type,
                                content_length=content_length
                            )
            except Exception:
                pass

        try:
            instance.cleanup(ctx)
        except Exception as e:  # noqa: BLE001
            ctx.log("warning", f"cleanup() failed: {e}")
        try:
            instance.teardown(ctx)
        except Exception as e:  # noqa: BLE001
            ctx.log("warning", f"teardown() failed: {e}")
    return result


def _child_main() -> int:
    # Bootstrap sys.path from our own location (.../backend/src/testkit/…) so
    # `src` and `scenarios` import regardless of the launcher's PYTHONPATH/cwd.
    backend_dir = str(Path(__file__).resolve().parents[2])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    result_path = sys.argv[1] if len(sys.argv) > 1 else None
    job = json.loads(sys.stdin.read())

    from src.testkit.context import ResolvedTarget, TestContext

    ctx = TestContext(
        correlation_id=job.get("correlation_id"),
        variables=dict(job.get("variables") or {}),
        secrets=dict(job.get("secrets") or {}),
        targets={
            k: ResolvedTarget(key=t["key"], base_url=t.get("base_url", ""),
                              default_headers=dict(t.get("default_headers") or {}))
            for k, t in (job.get("targets") or {}).items()
        },
    )
    # No cancel_check in the child: mid-run cancellation of a browser is not
    # supported; the parent's subprocess timeout bounds a runaway run.

    result = _run_lifecycle(job["code_ref"], ctx)
    data = _encode_result(result, ctx.logs())
    if result_path:
        with open(result_path, "w") as f:
            f.write(data)
    else:  # pragma: no cover - only when run by hand without a result path
        sys.stdout.write(data)
    return 0


if __name__ == "__main__":
    sys.exit(_child_main())
