import { api } from "./client";
import type {
  CommentItem, Failures, Me, Overview, Page, QueryParams, RunDetail, RunSummary,
  Schedule, SendResult, Target, TargetDetail, TargetStats, TestDef, TestDetail, WorkerInfo,
  TargetStatsReset,
} from "./types";

const list = <T>() => (r: { items: T[] }) => r.items;

function qs(params: QueryParams = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function fromLegacyQuery(query = ""): QueryParams {
  if (!query) return {};
  const raw = query.startsWith("?") ? query.slice(1) : query;
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export const qtp = {
  me: () => api.get<Me>("/api/me"),

  targetsPage: (params: QueryParams = {}) => api.get<Page<Target>>(`/api/targets${qs(params)}`),
  targets: () => api.get<Page<Target>>(`/api/targets${qs({ page_size: 100, sort: "name", order: "asc" })}`).then(list<Target>()),
  targetDetail: (id: string) => api.get<TargetDetail>(`/api/targets/${id}`),
  targetStats: (id: string, hours = 168) => api.get<TargetStats>(`/api/targets/${id}/stats${qs({ hours })}`),
  targetTests: (id: string, params: QueryParams = {}) => api.get<Page<TestDef>>(`/api/targets/${id}/tests${qs(params)}`),
  targetRuns: (id: string, params: QueryParams = {}) => api.get<Page<RunSummary>>(`/api/targets/${id}/runs${qs(params)}`),
  resetTargetStats: (id: string) => api.post<TargetStatsReset>(`/api/targets/${id}/reset-stats`),
  createTarget: (b: Partial<Target>) => api.post<Target>("/api/targets", b),
  updateTarget: (id: string, b: Partial<Target>) => api.patch<Target>(`/api/targets/${id}`, b),
  deleteTarget: (id: string) => api.del<any>(`/api/targets/${id}`),
  runAllTargetTests: (id: string, environment = "default", sync = false) => api.post<any>(`/api/targets/${id}/run-all${sync ? "?sync=true" : ""}`, { environment }),

  testsPage: (params: QueryParams = {}) => api.get<Page<TestDef>>(`/api/tests${qs(params)}`),
  tests: (query = "") => api.get<Page<TestDef>>(`/api/tests${qs({ page_size: 100, ...fromLegacyQuery(query) })}`).then(list<TestDef>()),
  test: (id: string) => api.get<TestDetail>(`/api/tests/${id}`),
  updateTestTags: (id: string, tags: string[]) => api.put<{ id: string; tags: string[] }>(`/api/tests/${id}/tags`, { tags }),
  testComments: (id: string) => api.get<{ items: CommentItem[] }>(`/api/tests/${id}/comments`).then(list<CommentItem>()),
  createTestComment: (id: string, body: string, tags: string[] = []) => api.post<CommentItem>(`/api/tests/${id}/comments`, { body, tags }),
  discover: () => api.post<any>("/api/tests/discover"),
  runTest: (id: string, environment = "default") => api.post<RunSummary>(`/api/tests/${id}/run`, { environment }),

  tags: (q = "") => api.get<{ items: string[] }>(`/api/tags${qs({ q })}`).then(list<string>()),

  sendRequest: (config: Record<string, any>) => api.post<SendResult>("/api/request-tests/send", config),
  createRequestTest: (b: { name: string; config: Record<string, any>; key?: string }) => api.post<TestDetail>("/api/request-tests", b),
  updateRequestTest: (id: string, b: { name?: string; config?: Record<string, any> }) => api.patch<TestDetail>(`/api/request-tests/${id}`, b),
  deleteRequestTest: (id: string) => api.del<any>(`/api/request-tests/${id}`),

  runsPage: (params: QueryParams = {}) => api.get<Page<RunSummary>>(`/api/runs${qs(params)}`),
  runs: (query = "") => api.get<Page<RunSummary>>(`/api/runs${qs({ page_size: 100, ...fromLegacyQuery(query) })}`).then(list<RunSummary>()),
  run: (id: string) => api.get<RunDetail>(`/api/runs/${id}`),
  runLogs: (id: string) => api.get<{ items: any[] }>(`/api/runs/${id}/logs`).then(list<any>()),
  runComments: (id: string) => api.get<{ items: CommentItem[] }>(`/api/runs/${id}/comments`).then(list<CommentItem>()),
  createRunComment: (id: string, body: string, tags: string[] = []) => api.post<CommentItem>(`/api/runs/${id}/comments`, { body, tags }),
  cancelRun: (id: string) => api.post<any>(`/api/runs/${id}/cancel`),
  setDefect: (id: string, defect_type: string) => api.put<any>(`/api/runs/${id}/defect`, { defect_type }),
  rerunRun: (id: string) => api.post<any>(`/api/runs/${id}/re-run`),
  rerunQueuedRuns: () => api.post<any>("/api/runs/re-run-queued"),

  schedulesPage: (params: QueryParams = {}) => api.get<Page<Schedule>>(`/api/schedules${qs(params)}`),
  schedules: () => api.get<Page<Schedule>>(`/api/schedules${qs({ page_size: 100 })}`).then(list<Schedule>()),
  schedule: (id: string) => api.get<any>(`/api/schedules/${id}`),
  createSchedule: (b: Partial<Schedule>) => api.post<Schedule>("/api/schedules", b),
  updateSchedule: (id: string, b: Partial<Schedule>) => api.patch<Schedule>(`/api/schedules/${id}`, b),
  deleteSchedule: (id: string) => api.del<any>(`/api/schedules/${id}`),

  workers: () => api.get<{ items: WorkerInfo[] }>("/api/workers").then(list<WorkerInfo>()),

  overview: (params: QueryParams = {}) => api.get<Overview>(`/api/dashboards/overview${qs(params)}`),
  failures: (params: QueryParams = {}) => api.get<Failures>(`/api/dashboards/failures${qs(params)}`),
};
