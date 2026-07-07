"""Additional self-tests for QTP platform APIs and request-builder flows."""
from __future__ import annotations

import uuid

from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"
TOKEN = {"type": "bearer", "token": "system-bearer-token"}
ZERO_ID = "00000000-0000-0000-0000-000000000000"


def _meta(key: str, name: str, tags: list[str]) -> TestMetadata:
    return TestMetadata(
        key=key,
        name=name,
        type=TYPE_HTTP,
        tags=["self", *tags],
        owner="admin",
        target=TARGET,
    )


class SelfReadinessEndpoint(HttpTest):
    metadata = _meta("self.readiness", "QTP · readiness endpoint", ["health"])

    def test(self, ctx):
        response = ctx.http.get("/readiness")
        response.should.have_status(200)
        response.should.respond_within_ms(3000)
        response.json.should.have_field("status").exists()


class SelfLivenessEndpoint(HttpTest):
    metadata = _meta("self.liveness", "QTP · liveness endpoint", ["health"])

    def test(self, ctx):
        response = ctx.http.get("/liveness")
        response.should.have_status(200)
        response.should.respond_within_ms(3000)
        response.json.should.have_field("status").exists()


class SelfHealthContentType(HttpTest):
    metadata = _meta("self.health_content_type", "QTP · health response is JSON", ["health"])

    def test(self, ctx):
        response = ctx.http.get("/health")
        response.should.have_status(200)
        response.should.have_header("Content-Type").containing("json")


class SelfCurrentUserProfile(HttpTest):
    metadata = _meta("self.me_profile", "QTP · current user profile", ["auth"])

    def test(self, ctx):
        response = ctx.http.get("/api/me", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("username").exists()
        response.json.should.have_field("roles").with_length_at_least(1)


class SelfCurrentUserAdminExpansion(HttpTest):
    metadata = _meta("self.me_roles_admin_expansion", "QTP · admin roles expand", ["auth"])

    def test(self, ctx):
        response = ctx.http.get("/api/me", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("is_admin").exists()
        response.json.should.have_field("roles").with_length_at_least(1)


class SelfTargetsPagination(HttpTest):
    metadata = _meta("self.targets_pagination", "QTP · targets pagination", ["targets"])

    def test(self, ctx):
        response = ctx.http.get("/api/targets?page=1&page_size=2", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)
        response.json.should.have_field("page_size").equal_to(2)


class SelfTargetsSearchSelf(HttpTest):
    metadata = _meta("self.targets_search_self", "QTP · target search finds self target", ["targets"])

    def test(self, ctx):
        response = ctx.http.get("/api/targets?q=qtp_self", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items[0].key").equal_to("qtp_self")


class SelfTargetsSortByNameDesc(HttpTest):
    metadata = _meta("self.targets_sort_name_desc", "QTP · targets sort by name", ["targets"])

    def test(self, ctx):
        response = ctx.http.get("/api/targets?sort=name&order=desc", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)


class SelfTargetDetailFromList(HttpTest):
    metadata = _meta("self.targets_detail_from_list", "QTP · target detail from list id", ["targets", "multi-step"])

    def test(self, ctx):
        with ctx.step("Find qtp_self target"):
            response = ctx.http.get("/api/targets?q=qtp_self", auth=TOKEN)
            response.should.have_status(200)
            target_id = response.json.get("items[0].id")
            ctx.set_var("target_id", target_id)

        with ctx.step("Read target detail"):
            response = ctx.http.get(f"/api/targets/{target_id}", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("target.key").equal_to("qtp_self")


class SelfTargetStatsFromList(HttpTest):
    metadata = _meta("self.targets_stats_from_list", "QTP · target stats from list id", ["targets", "stats", "multi-step"])

    def test(self, ctx):
        with ctx.step("Find qtp_self target"):
            response = ctx.http.get("/api/targets?q=qtp_self", auth=TOKEN)
            response.should.have_status(200)
            target_id = response.json.get("items[0].id")

        with ctx.step("Read target stats"):
            response = ctx.http.get(f"/api/targets/{target_id}/stats?hours=24", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("target_id").equal_to(target_id)


class SelfTargetTestsFromList(HttpTest):
    metadata = _meta("self.targets_tests_from_list", "QTP · target tests from list id", ["targets", "tests", "multi-step"])

    def test(self, ctx):
        with ctx.step("Find qtp_self target"):
            response = ctx.http.get("/api/targets?q=qtp_self", auth=TOKEN)
            response.should.have_status(200)
            target_id = response.json.get("items[0].id")

        with ctx.step("List target tests"):
            response = ctx.http.get(f"/api/targets/{target_id}/tests?page_size=5", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("items").with_length_at_least(1)


class SelfTargetRunsFromList(HttpTest):
    metadata = _meta("self.targets_runs_from_list", "QTP · target runs from list id", ["targets", "runs", "multi-step"])

    def test(self, ctx):
        with ctx.step("Find qtp_self target"):
            response = ctx.http.get("/api/targets?q=qtp_self", auth=TOKEN)
            response.should.have_status(200)
            target_id = response.json.get("items[0].id")

        with ctx.step("List target runs"):
            response = ctx.http.get(f"/api/targets/{target_id}/runs?page_size=5", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("items").exists()


class SelfTestsCatalogPagination(HttpTest):
    metadata = _meta("self.tests_catalog_pagination", "QTP · test catalog pagination", ["tests"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?page=1&page_size=5", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)
        response.json.should.have_field("page_size").equal_to(5)


class SelfTestsCatalogSearchHealth(HttpTest):
    metadata = _meta("self.tests_search_health", "QTP · test catalog search health", ["tests"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?q=health", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)


class SelfTestsFilterSourceCode(HttpTest):
    metadata = _meta("self.tests_filter_source_code", "QTP · code test filter", ["tests"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?source=code&page_size=10", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)
        response.json.should.have_field("items[0].source").equal_to("code")


class SelfTestsFilterTargetDemo(HttpTest):
    metadata = _meta("self.tests_filter_target_demo", "QTP · demo target test filter", ["tests"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?target=demo&page_size=10", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)
        response.json.should.have_field("items[0].target_key").equal_to("demo")


class SelfTestsFilterTargetSelf(HttpTest):
    metadata = _meta("self.tests_filter_target_self", "QTP · self target test filter", ["tests"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?target=qtp_self&page_size=10", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)
        response.json.should.have_field("items[0].target_key").equal_to("qtp_self")


class SelfTestsFilterTagSelf(HttpTest):
    metadata = _meta("self.tests_filter_tag_self", "QTP · self tag test filter", ["tests", "tags"])

    def test(self, ctx):
        response = ctx.http.get("/api/tests?tag=self&page_size=10", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)


class SelfTestDetailFromCatalog(HttpTest):
    metadata = _meta("self.tests_detail_from_catalog", "QTP · test detail from catalog", ["tests", "multi-step"])

    def test(self, ctx):
        with ctx.step("Find a code test"):
            response = ctx.http.get("/api/tests?source=code&page_size=1", auth=TOKEN)
            response.should.have_status(200)
            test_id = response.json.get("items[0].id")

        with ctx.step("Read test detail"):
            response = ctx.http.get(f"/api/tests/{test_id}", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("id").equal_to(test_id)
            response.json.should.have_field("revisions").with_length_at_least(1)


class SelfRunsPagination(HttpTest):
    metadata = _meta("self.runs_pagination", "QTP · runs pagination", ["runs"])

    def test(self, ctx):
        response = ctx.http.get("/api/runs?page=1&page_size=5", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").exists()
        response.json.should.have_field("page_size").equal_to(5)


class SelfRunsFilterTargetSelf(HttpTest):
    metadata = _meta("self.runs_filter_target_self", "QTP · runs filter by self target", ["runs"])

    def test(self, ctx):
        response = ctx.http.get("/api/runs?target=qtp_self&page_size=5", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").exists()


class SelfRunsSortQueuedDesc(HttpTest):
    metadata = _meta("self.runs_sort_queued_desc", "QTP · runs sort by queued time", ["runs"])

    def test(self, ctx):
        response = ctx.http.get("/api/runs?sort=queued_at&order=desc&page_size=5", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").exists()


class SelfDashboardOverview(HttpTest):
    metadata = _meta("self.dashboard_overview", "QTP · dashboard overview", ["dashboard"])

    def test(self, ctx):
        response = ctx.http.get("/api/dashboards/overview?hours=24", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("totals.total_runs").exists()
        response.json.should.have_field("trend").exists()


class SelfDashboardFailures(HttpTest):
    metadata = _meta("self.dashboard_failures", "QTP · dashboard failures", ["dashboard"])

    def test(self, ctx):
        response = ctx.http.get("/api/dashboards/failures?hours=168", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("signatures").exists()
        response.json.should.have_field("defect_distribution").exists()


class SelfTagsList(HttpTest):
    metadata = _meta("self.tags_list", "QTP · tags list", ["tags"])

    def test(self, ctx):
        response = ctx.http.get("/api/tags", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)


class SelfTagsSearchSelf(HttpTest):
    metadata = _meta("self.tags_search_self", "QTP · tag search self", ["tags"])

    def test(self, ctx):
        response = ctx.http.get("/api/tags?q=self", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").with_length_at_least(1)


class SelfWorkersList(HttpTest):
    metadata = _meta("self.workers_list", "QTP · workers list", ["workers"])

    def test(self, ctx):
        response = ctx.http.get("/api/workers", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").exists()


class SelfSchedulesList(HttpTest):
    metadata = _meta("self.schedules_list", "QTP · schedules list", ["schedules"])

    def test(self, ctx):
        response = ctx.http.get("/api/schedules?page_size=5", auth=TOKEN)
        response.should.have_status(200)
        response.json.should.have_field("items").exists()


class SelfInvalidTargetReturns404(HttpTest):
    metadata = _meta("self.invalid_target_404", "QTP · invalid target returns 404", ["negative"])

    def test(self, ctx):
        response = ctx.http.get(f"/api/targets/{ZERO_ID}", auth=TOKEN)
        response.should.have_status(404)


class SelfInvalidTestReturns404(HttpTest):
    metadata = _meta("self.invalid_test_404", "QTP · invalid test returns 404", ["negative"])

    def test(self, ctx):
        response = ctx.http.get(f"/api/tests/{ZERO_ID}", auth=TOKEN)
        response.should.have_status(404)


class SelfResetStatsInvalidTargetReturns404(HttpTest):
    metadata = _meta("self.reset_stats_invalid_target_404", "QTP · reset stats invalid target returns 404", ["negative", "targets"])

    def test(self, ctx):
        response = ctx.http.post(f"/api/targets/{ZERO_ID}/reset-stats", auth=TOKEN)
        response.should.have_status(404)


class SelfRequestBuilderSendHealth(HttpTest):
    metadata = _meta("self.request_builder_send_health", "QTP · request builder sends health check", ["request-builder"])

    def test(self, ctx):
        response = ctx.http.post("/api/request-tests/send", auth=TOKEN, json={
            "target": "qtp_self",
            "method": "GET",
            "url": "/health",
            "assertions": [
                {"type": "status_code", "operator": "equals", "expected": 200},
                {"type": "json_path", "path": "$.status", "operator": "equals", "expected": "ok"},
            ],
        })
        response.should.have_status(200)
        response.json.should.have_field("status").equal_to("passed")


class SelfRequestBuilderFlowCapture(HttpTest):
    metadata = _meta("self.request_builder_flow_capture", "QTP · request builder flow captures data", ["request-builder", "multi-step"])

    def test(self, ctx):
        response = ctx.http.post("/api/request-tests/send", auth=TOKEN, json={
            "target": "qtp_self",
            "steps": [
                {
                    "id": "health",
                    "name": "Read health",
                    "method": "GET",
                    "url": "/health",
                    "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}],
                    "captures": [{"name": "service", "source": "json_path", "path": "$.service"}],
                },
                {
                    "id": "tags",
                    "name": "Use captured service in query",
                    "method": "GET",
                    "url": "/api/tags?q={{service}}",
                    "auth": TOKEN,
                    "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}],
                },
            ],
        })
        response.should.have_status(200)
        response.json.should.have_field("status").equal_to("passed")
        response.json.should.have_field("response.steps").with_length(2)


class SelfRequestTestLifecycle(HttpTest):
    metadata = _meta("self.request_test_lifecycle", "QTP · request test create update delete", ["request-builder", "multi-step"])

    def test(self, ctx):
        key = f"ui.scenario_{uuid.uuid4().hex[:10]}"
        with ctx.step("Create request test"):
            response = ctx.http.post("/api/request-tests", auth=TOKEN, json={
                "key": key,
                "name": "Scenario managed request",
                "config": {
                    "target": "qtp_self",
                    "method": "GET",
                    "url": "/health",
                    "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}],
                },
            })
            response.should.have_status(201)
            test_id = response.json.get("id")
            ctx.set_var("test_id", test_id)

        with ctx.step("Read created request test"):
            response = ctx.http.get(f"/api/tests/{test_id}", auth=TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("key").equal_to(key)

        with ctx.step("Update request test"):
            response = ctx.http.patch(f"/api/request-tests/{test_id}", auth=TOKEN, json={
                "name": "Scenario managed request updated",
                "config": {
                    "target": "qtp_self",
                    "method": "GET",
                    "url": "/liveness",
                    "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}],
                },
            })
            response.should.have_status(200)
            response.json.should.have_field("name").equal_to("Scenario managed request updated")

        with ctx.step("Delete request test"):
            response = ctx.http.delete(f"/api/request-tests/{test_id}", auth=TOKEN)
            response.should.have_status(200)

    def cleanup(self, ctx):
        test_id = ctx.get_var("test_id")
        if not test_id:
            return
        from src.core.db import session_scope
        from src.catalog.service import delete_request_test

        try:
            with session_scope() as db:
                delete_request_test(db, test_id)
        except Exception:
            pass
