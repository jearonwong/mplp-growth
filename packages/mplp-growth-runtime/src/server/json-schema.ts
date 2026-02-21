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
    details?: any;
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
  last_runs: any[];
}
