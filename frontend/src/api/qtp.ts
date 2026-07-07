import { api } from "./client";
import type {
  Failures, Me, Overview, RunDetail, RunSummary, Schedule, SendResult,
  Target, TestDef, TestDetail, WorkerInfo,
} from "./types";

const list = <T>(key: string) => (r: { items: T[] }) => r.items;

export const qtp = {
  me: () => api.get<Me>("/api/me"),

  targets: () => api.get<{ items: Target[] }>("/api/targets").then(list<Target>("items")),
  createTarget: (b: Partial<Target>) => api.post<Target>("/api/targets", b),

  tests: (q = "") => api.get<{ items: TestDef[] }>(`/api/tests${q}`).then(list<TestDef>("items")),
  test: (id: string) => api.get<TestDetail>(`/api/tests/${id}`),
  discover: () => api.post<any>("/api/tests/discover"),
  runTest: (id: string, environment = "default") =>
    api.post<RunSummary>(`/api/tests/${id}/run`, { environment }),

  sendRequest: (config: Record<string, any>) => api.post<SendResult>("/api/request-tests/send", config),
  createRequestTest: (b: { name: string; config: Record<string, any>; key?: string }) =>
    api.post<TestDetail>("/api/request-tests", b),
  updateRequestTest: (id: string, b: { name?: string; config?: Record<string, any> }) =>
    api.patch<TestDetail>(`/api/request-tests/${id}`, b),

  runs: (q = "") => api.get<{ items: RunSummary[] }>(`/api/runs${q}`).then(list<RunSummary>("items")),
  run: (id: string) => api.get<RunDetail>(`/api/runs/${id}`),
  runLogs: (id: string) => api.get<{ items: any[] }>(`/api/runs/${id}/logs`).then(list<any>("items")),
  cancelRun: (id: string) => api.post<any>(`/api/runs/${id}/cancel`),
  setDefect: (id: string, defect_type: string) => api.put<any>(`/api/runs/${id}/defect`, { defect_type }),

  schedules: () => api.get<{ items: Schedule[] }>("/api/schedules").then(list<Schedule>("items")),
  createSchedule: (b: Partial<Schedule>) => api.post<Schedule>("/api/schedules", b),
  updateSchedule: (id: string, b: Partial<Schedule>) => api.patch<Schedule>(`/api/schedules/${id}`, b),
  deleteSchedule: (id: string) => api.del<any>(`/api/schedules/${id}`),

  workers: () => api.get<{ items: WorkerInfo[] }>("/api/workers").then(list<WorkerInfo>("items")),

  overview: (hours = 24) => api.get<Overview>(`/api/dashboards/overview?hours=${hours}`),
  failures: (hours = 168) => api.get<Failures>(`/api/dashboards/failures?hours=${hours}`),
};
