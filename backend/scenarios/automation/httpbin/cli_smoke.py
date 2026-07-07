"""A CLI scenario (Testkube-style): run a command and assert on exit code + output.

This runs the interpreter that ships in the worker image; the same pattern runs
a container CLI such as ``newman run collection.json`` or ``k6 run script.js`` —
QTP captures stdout/stderr/exit code and you assert on them.
"""
from src.testkit import TYPE_CLI, CliTest, TestMetadata

TARGET = "demo"


class HttpbinCliSmoke(CliTest):
    """The worker can execute a CLI tool and QTP asserts on its result."""

    metadata = TestMetadata(
        key="httpbin.cli_smoke",
        name="httpbin · CLI adapter smoke (python --version)",
        type=TYPE_CLI,
        tags=["httpbin", "cli"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("python interpreter runs"):
            result = ctx.cli.run(["python3", "--version"])
            result.should.succeed()
            result.should.output_matches(r"Python 3\.\d+")

        with ctx.step("a failing command is detected"):
            ctx.cli.run("python3 -c 'import sys; sys.exit(3)'").should.have_exit_code(3)
