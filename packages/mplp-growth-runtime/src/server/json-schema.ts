/**
 * API JSON Schemas (FIX-3: Idempotency)
 * Defines structured response types for API endpoints.
 */

export interface ExecuteResponse {
  ok: boolean;
  command: string;
  run_id: string; // Idempotency key
  outputs: string; // CLI output (markdown)
  error?: {
    code: "validation_error" | "not_found" | "conflict" | "internal" | "policy_violation";
    message: string;
    details?: unknown;
  };
}

export interface QueueItem {
  id: string;
  confirm_id: string;
  created_at?: string;
  category: string;
  plan_id?: string;
  asset_id?: string;
  channel?: string;
  target_id?: string;
  title: string;
  preview: string;
  export_path?: string;
  policy_check: {
    status: "pass" | "fail" | "unknown";
    reasons?: string[];
  };
  impact_level?: "low" | "medium" | "high";
  impact_summary?: string;
  will_change?: string[];
  will_not_do?: string[];
  interactions?: {
    id?: string;
    platform: string;
    author?: string;
    content: string;
    response?: string;
  }[];
  interactions_count?: number;
  interaction_summaries?: {
    platform: string;
    author: string;
    excerpt: string;
    source_ref?: string;
  }[];
  drafted_by_role?: string;
  rationale_bullets?: string[];
  redrafted_by_role?: string;
  redraft_version?: number;
  redraft_rationale_bullets?: string[];
}

export interface BatchRequest {
  action: "approve" | "reject" | "redraft";
  ids: string[];
  role_id?: string;
  interaction_ids_map?: Record<string, string[]>;
}

export interface BatchResultItem {
  id: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
  error?: string;
}

export interface BatchResponse {
  ok: boolean;
  action: string;
  processed: BatchResultItem[];
  skipped: BatchResultItem[];
  failed: BatchResultItem[];
}

export interface QueueResponse {
  pending_count: number;
  categories: {
    outreach: QueueItem[];
    publish: QueueItem[];
    inbox: QueueItem[];
    review: QueueItem[];
    other: QueueItem[];
  };
}

export interface RunnerStatusResponse {
  enabled: boolean;
  policy_level: "safe" | "standard" | "aggressive";
  last_tick_at?: string;
  is_running: boolean;
  active_task?: string;
  last_runs: unknown[];
}
