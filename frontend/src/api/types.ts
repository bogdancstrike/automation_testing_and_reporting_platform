export interface Me {
  subject: string;
  username: string;
  email: string;
  roles: string[];
  is_admin: boolean;
}

export interface Target {
  id: string;
  key: string;
  name: string;
  base_url: string;
  health_url?: string;
  environment: string;
  tags: string[];
}

export interface TestDef {
  id: string;
  key: string;
  name: string;
  type: string;
  source: string;
  owner?: string;
  target_key: string;
  tags: string[];
  status: string;
  last_run_status?: string;
  last_run_at?: string;
}

export interface Revision {
  id: string;
  revision_number: number;
  code_ref?: string;
  config: Record<string, any>;
  created_at: string;
}

export interface TestDetail extends TestDef {
  revisions: Revision[];
  config?: Record<string, any>;
  method?: string;
  url_template?: string;
  code_ref?: string;
  assertions?: any[];
  target?: { key: string; name: string; base_url: string; health_url?: string } | null;
  source_code?: string | null;
  source_language?: string;
}

export interface AssertionResult {
  source: string;
  operator: string;
  target?: string;
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface RunSummary {
  id: string;
  test_definition_id: string;
  test_name?: string;
  target_key?: string;
  status: string;
  trigger: string;
  environment: string;
  worker_name?: string;
  error_category?: string;
  error_message?: string;
  defect_type?: string;
  failure_signature?: string;
  duration_ms?: number;
  queued_at?: string;
  started_at?: string;
  finished_at?: string;
  metrics?: Record<string, any>;
}

export interface RunDetail extends RunSummary {
  steps: { name: string; status: string; duration_ms: number; error?: string }[];
  assertions: AssertionResult[];
  response: Record<string, any>;
}

export interface Schedule {
  id: string;
  test_definition_id: string;
  test_name?: string;
  name: string;
  recurrence_type: string;
  interval_seconds?: number;
  cron_expression?: string;
  timezone: string;
  is_enabled: boolean;
  next_run_at?: string;
  last_enqueued_at?: string;
}

export interface WorkerInfo {
  name: string;
  capabilities: string[];
  status: string;
  current_run_id?: string;
  runs_completed: number;
  last_heartbeat?: string;
}

export interface Overview {
  window_hours: number;
  totals: Record<string, number>;
  pass_rate?: number;
  error_rate?: number;
  duration_ms: { p50?: number; p95?: number; avg?: number };
  queue_backlog: number;
  active_workers: number;
  trend: Record<string, any>[];
  per_target: { target_key?: string; total: number; passed: number; failed: number }[];
}

export interface Failures {
  window_hours: number;
  signatures: {
    signature_hash: string;
    category: string;
    sample_message?: string;
    occurrences: number;
    last_defect_type?: string;
  }[];
  defect_distribution: Record<string, number>;
  recent_failed: {
    id: string;
    test_name?: string;
    status: string;
    error_category?: string;
    defect_type?: string;
  }[];
}

export interface SendResult {
  status: string;
  response: Record<string, any>;
  assertions: AssertionResult[];
  logs: { level: string; message: string }[];
  error_category?: string;
  error_message?: string;
}
