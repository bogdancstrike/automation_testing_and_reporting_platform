"""End-to-end CRUD over the Targets API, authenticated with the system token.

Shows the imperative style at its best: capture an id from one response and use
it in the next as a plain Python variable, then undo the side effect in cleanup().
"""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"
TOKEN = {"type": "bearer", "token": "system-bearer-token"}


class SelfTargetsCrud(HttpTest):
    """Create → read → list → stats over /api/targets, then delete what we made."""

    metadata = TestMetadata(
        key="self.auth.targets_crud",
        name="QTP · Targets CRUD",
        type=TYPE_HTTP,
        tags=["self", "api", "targets", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("Create Target"):
            response = ctx.http.post("/api/targets", auth=TOKEN, json={
                "key": "scn_tgt", "name": "Scenario Target", "base_url": "http://example.com",
            })
            response.should.have_status(201)
            target_id = response.json.get("$.id")
            ctx.set_var("target_id", target_id)

        with ctx.step("Get Target"):
            response = ctx.http.get(f"/api/targets/{target_id}", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("target.key").equal_to("scn_tgt")

        with ctx.step("List Targets"):
            response = ctx.http.get("/api/targets", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("items").exists()

        with ctx.step("Target Stats"):
            ctx.http.get(f"/api/targets/{target_id}/stats", auth=TOKEN).should.have_status(200)

    def cleanup(self, ctx):
        target_id = ctx.get_var("target_id")
        if not target_id:
            return
        from sqlalchemy import delete

        from src.catalog.models import Target
        from src.core.db import session_scope
        with session_scope() as db:
            db.execute(delete(Target).where(Target.id == target_id))
        ctx.log("info", f"cleanup: deleted scenario target {target_id}")
