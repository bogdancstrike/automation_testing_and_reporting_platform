"""End-to-end lifecycle of a UI request test: create, read, update, run, delete."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"
TOKEN = {"type": "bearer", "token": "system-bearer-token"}


class SelfRequestTestsCrud(HttpTest):
    """Drive the request-test API through its full lifecycle and clean up after."""

    metadata = TestMetadata(
        key="self.auth.request_tests_crud",
        name="QTP · Request Tests CRUD",
        type=TYPE_HTTP,
        tags=["self", "api", "tests", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("Create Test"):
            response = ctx.http.post("/api/request-tests", auth=TOKEN, json={
                "name": "Scenario Auto Test",
                "config": {"method": "GET", "url": "http://example.com"},
            })
            response.should.have_status(201)
            test_id = response.json.get("$.id")
            ctx.set_var("test_id", test_id)

        with ctx.step("Get Test"):
            ctx.http.get(f"/api/tests/{test_id}", auth=TOKEN).should.have_status(200)

        with ctx.step("Update Test"):
            ctx.http.patch(f"/api/request-tests/{test_id}", auth=TOKEN,
                           json={"name": "Scenario Auto Test (renamed)"}).should.have_status(200)

        with ctx.step("Run Test"):
            ctx.http.post(f"/api/tests/{test_id}/run", auth=TOKEN).should.have_status(202)

        with ctx.step("Delete Test"):
            import time
            for attempt in range(5):
                response = ctx.http.delete(f"/api/request-tests/{test_id}", auth=TOKEN)
                if response.status_code == 409:
                    if attempt < 4:
                        time.sleep(5)
                        continue
                response.should.have_status(200)
                break
            ctx.set_var("test_id", "")  # deleted cleanly; nothing for cleanup to do

    def cleanup(self, ctx):
        # Best effort: only fires if the flow failed before its own delete step.
        test_id = ctx.get_var("test_id")
        if test_id:
            ctx.http.delete(f"/api/request-tests/{test_id}", auth=TOKEN)
            ctx.log("info", f"cleanup: removed leftover test {test_id}")
