import os

TEST_FILE = "tests/automations/api/test_qtp_self.py"

tests = [
    # Pagination & Filtering
    ("TargetsListPagination", "targets_pagination", "QTP · Targets Pagination", "GET", "{{base_url}}/api/targets?page=1&page_size=2", None, 200),
    ("TargetsListSorting", "targets_sorting", "QTP · Targets Sorting", "GET", "{{base_url}}/api/targets?sort=name&order=desc", None, 200),
    ("TestsListPagination", "tests_pagination", "QTP · Tests Pagination", "GET", "{{base_url}}/api/tests?page_size=1", None, 200),
    ("TestsListFilterSource", "tests_filter_source", "QTP · Tests Filter Source", "GET", "{{base_url}}/api/tests?source=ui", None, 200),
    ("TestsListFilterTarget", "tests_filter_target", "QTP · Tests Filter Target", "GET", "{{base_url}}/api/tests?target=demo", None, 200),
    ("RunsListPagination", "runs_pagination", "QTP · Runs Pagination", "GET", "{{base_url}}/api/runs?page=1&page_size=5", None, 200),
    ("RunsListStatusFilter", "runs_filter_status", "QTP · Runs Filter Status", "GET", "{{base_url}}/api/runs?status=passed", None, 200),
    ("SchedulesListPagination", "schedules_pagination", "QTP · Schedules Pagination", "GET", "{{base_url}}/api/schedules?page_size=5", None, 200),
    ("WorkersListPagination", "workers_pagination", "QTP · Workers Pagination", "GET", "{{base_url}}/api/workers?page_size=10", None, 200),
    ("TagsListPagination", "tags_pagination", "QTP · Tags Pagination", "GET", "{{base_url}}/api/tags?page_size=10", None, 200),

    # 404s
    ("TargetNotFound", "target_404", "QTP · Target 404", "GET", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000", None, 404),
    ("TargetStatsNotFound", "target_stats_404", "QTP · Target Stats 404", "GET", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/stats", None, 404),
    ("TargetTestsNotFound", "target_tests_404", "QTP · Target Tests 404", "GET", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/tests", None, 404),
    ("TargetRunsNotFound", "target_runs_404", "QTP · Target Runs 404", "GET", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/runs", None, 404),
    ("TestNotFound", "test_404", "QTP · Test 404", "GET", "{{base_url}}/api/tests/missing-test-123", None, 404),
    ("TestCommentsNotFound", "test_comments_404", "QTP · Test Comments 404", "GET", "{{base_url}}/api/tests/missing-test-123/comments", None, 404),
    ("RunNotFound", "run_404", "QTP · Run 404", "GET", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000", None, 404),
    ("RunLogsNotFound", "run_logs_404", "QTP · Run Logs 404", "GET", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/logs", None, 404),
    ("ScheduleNotFound", "schedule_404", "QTP · Schedule 404", "GET", "{{base_url}}/api/schedules/00000000-0000-0000-0000-000000000000", None, 404),
    ("RunCommentsNotFound", "run_comments_404", "QTP · Run Comments 404", "GET", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/comments", None, 404),

    # 400s
    ("CreateTargetMissingName", "create_target_400_name", "QTP · Create Target missing name", "POST", "{{base_url}}/api/targets", '{"mode":"json","raw":"{\\"key\\":\\"test\\"}"}', 400),
    ("CreateTargetMissingKey", "create_target_400_key", "QTP · Create Target missing key", "POST", "{{base_url}}/api/targets", '{"mode":"json","raw":"{\\"name\\":\\"test\\"}"}', 400),
    ("CreateTargetMissingBaseUrl", "create_target_400_url", "QTP · Create Target missing URL", "POST", "{{base_url}}/api/targets", '{"mode":"json","raw":"{\\"key\\":\\"test\\",\\"name\\":\\"test\\"}"}', 400),
    ("CreateTestMissingName", "create_test_400_name", "QTP · Create Test missing name", "POST", "{{base_url}}/api/request-tests", '{"mode":"json","raw":"{\\"config\\":{}}"}', 400),
    ("CreateTestMissingConfig", "create_test_400_config", "QTP · Create Test missing config", "POST", "{{base_url}}/api/request-tests", '{"mode":"json","raw":"{\\"name\\":\\"test\\"}"}', 400),
    ("AddTestCommentEmpty", "add_test_comment_400", "QTP · Add Test Comment empty", "POST", "{{base_url}}/api/tests/ui.httpbin_get/comments", '{"mode":"json","raw":"{}"}', 400),
    ("AddRunCommentEmpty", "add_run_comment_400", "QTP · Add Run Comment empty", "POST", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/comments", '{"mode":"json","raw":"{}"}', 400),
    ("PutDefectMissingId", "put_defect_400", "QTP · Put Defect missing id", "PUT", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/defect", '{"mode":"json","raw":"{}"}', 400),
    ("CreateScheduleMissingTestId", "create_schedule_400_testid", "QTP · Create Schedule missing test_id", "POST", "{{base_url}}/api/schedules", '{"mode":"json","raw":"{\\"recurrence_type\\":\\"interval\\"}"}', 400),
    ("CreateScheduleMissingRecurrence", "create_schedule_400_recurrence", "QTP · Create Schedule missing recurrence", "POST", "{{base_url}}/api/schedules", '{"mode":"json","raw":"{\\"test_definition_id\\":\\"ui.httpbin_get\\"}"}', 400),
    ("DashboardOverviewBadHours", "dashboard_overview_400", "QTP · Overview bad hours", "GET", "{{base_url}}/api/dashboards/overview?hours=abc", None, 400),
    ("DashboardFailuresBadHours", "dashboard_failures_400", "QTP · Failures bad hours", "GET", "{{base_url}}/api/dashboards/failures?hours=abc", None, 400),
    ("TargetStatsBadHours", "target_stats_400", "QTP · Target Stats bad hours", "GET", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/stats?hours=abc", None, 400),
    ("UpdateTestBadPayload", "update_test_400", "QTP · Update Test bad payload", "PATCH", "{{base_url}}/api/request-tests/ui.httpbin_get", '{"mode":"json","raw":"[]"}', 400),
    ("UpdateScheduleBadPayload", "update_schedule_400", "QTP · Update Schedule bad payload", "PATCH", "{{base_url}}/api/schedules/00000000-0000-0000-0000-000000000000", '{"mode":"json","raw":"[]"}', 400),

    # 405s
    ("TargetsMethodNotAllowed", "targets_405", "QTP · Targets 405", "PUT", "{{base_url}}/api/targets", None, 405),
    ("TargetsIdMethodNotAllowed", "targets_id_405", "QTP · Targets ID 405", "POST", "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000", None, 405),
    ("TestsMethodNotAllowed", "tests_405", "QTP · Tests 405", "PUT", "{{base_url}}/api/tests", None, 405),
    ("TestsIdMethodNotAllowed", "tests_id_405", "QTP · Tests ID 405", "POST", "{{base_url}}/api/tests/ui.httpbin_get", None, 405),
    ("RunsMethodNotAllowed", "runs_405", "QTP · Runs 405", "POST", "{{base_url}}/api/runs", None, 405),
    ("RunsIdMethodNotAllowed", "runs_id_405", "QTP · Runs ID 405", "DELETE", "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000", None, 405),
    ("SchedulesMethodNotAllowed", "schedules_405", "QTP · Schedules 405", "PUT", "{{base_url}}/api/schedules", None, 405),
    ("WorkersMethodNotAllowed", "workers_405", "QTP · Workers 405", "POST", "{{base_url}}/api/workers", None, 405),
    ("DashboardsOverviewMethodNotAllowed", "dashboards_overview_405", "QTP · Dashboards Overview 405", "POST", "{{base_url}}/api/dashboards/overview", None, 405),
    ("TagsMethodNotAllowed", "tags_405", "QTP · Tags 405", "POST", "{{base_url}}/api/tags", None, 405),

    # Extras
    ("DashboardOverviewValidHours", "dashboard_overview_valid", "QTP · Overview Valid Hours", "GET", "{{base_url}}/api/dashboards/overview?hours=24", None, 200),
    ("DashboardFailuresValidHours", "dashboard_failures_valid", "QTP · Failures Valid Hours", "GET", "{{base_url}}/api/dashboards/failures?hours=24", None, 200),
    ("MeEndpointValid", "me_endpoint_valid", "QTP · Me Endpoint 200", "GET", "{{base_url}}/api/me", None, 200),
    ("AuthWithoutBearerPrefix", "auth_no_bearer", "QTP · Auth w/o Bearer", "GET", "{{base_url}}/api/me", None, 401, '{"Authorization": "Token {{auth_token}}"}'),
    ("AuthInvalidBearer", "auth_invalid_bearer", "QTP · Auth Invalid Bearer", "GET", "{{base_url}}/api/me", None, 401, '{"Authorization": "Bearer invalidtoken123"}'),
]

with open(TEST_FILE, "a") as f:
    for t in tests:
        class_name, key, name, method, url, body, expected_status = t[:7]
        custom_headers_dict = t[7] if len(t) > 7 else None
        
        f.write(f"\nclass {class_name}(AuthHttpTest):\n")
        f.write(f'    """{name}"""\n')
        
        headers_str = ""
        if custom_headers_dict:
            # specifically for auth testing where we override the standard bearer token insertion
            headers = []
            import json
            custom_headers = json.loads(custom_headers_dict)
            for k, v in custom_headers.items():
                headers.append(f'{{"name": "{k}", "value": "{v}"}}')
            headers_str = f', "headers": [{", ".join(headers)}]'
            auth_str = ''
        else:
            auth_str = ', "auth": {"type": "bearer", "token": "{{auth_token}}"}'

        body_str = f', "body": {body}' if body else ""
        
        f.write(f'    metadata = TestMetadata(\n')
        f.write(f'        key="self.auth.{key}", name="{name}", type=TYPE_HTTP,\n')
        f.write(f'        tags=["self", "api", "automated"], owner="admin", target=TARGET,\n')
        f.write(f'        default_config={{"method": "{method}", "url": "{url}"{auth_str}{headers_str}{body_str}, "assertions": [status({expected_status})]}}\n')
        f.write(f'    )\n')

print("Generated 50+ tests successfully")
