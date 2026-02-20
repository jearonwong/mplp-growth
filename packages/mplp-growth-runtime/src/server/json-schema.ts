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

export interface QueueResponse {
  pending_count: number;
  categories: {
    outreach: any[];
    publish: any[];
    inbox: any[];
    review: any[];
    other: any[];
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
