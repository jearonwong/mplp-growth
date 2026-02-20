/**
 * Runner State Management (FIX-1: Observability)
 * Tracks execution history, locks, and status.
 */

export interface TaskRun {
  task_id: string;
  started_at: string; // ISO
  finished_at?: string; // ISO
  status: "running" | "success" | "failed" | "skipped";
  message?: string;
  error?: string;
}

export interface RunnerState {
  enabled: boolean;
  policy_level: "safe" | "standard" | "aggressive";
  auto_publish: boolean;
  last_tick_at?: string;
  is_running: boolean;
  active_task?: string;
  last_task_runs: TaskRun[]; // Circular buffer of recent runs
}

const MAX_LOG_SIZE = 50;

export class StateManager {
  private state: RunnerState = {
    enabled: false,
    policy_level: "safe", // Default safe
    auto_publish: false,
    is_running: false,
    last_task_runs: [],
  };

  /**
   * Get full state snapshot
   */
  getSnapshot(): RunnerState {
    return { ...this.state };
  }

  /**
   * Update configuration
   */
  setConfig(config: {
    enabled?: boolean;
    policy_level?: "safe" | "standard" | "aggressive";
    auto_publish?: boolean;
  }) {
    if (config.enabled !== undefined) {
      this.state.enabled = config.enabled;
    }
    if (config.policy_level !== undefined) {
      this.state.policy_level = config.policy_level;
    }
    if (config.auto_publish !== undefined) {
      this.state.auto_publish = config.auto_publish;
    }
  }

  /**
   * Attempt to acquire lock for a task
   */
  acquireLock(taskId: string): boolean {
    if (this.state.is_running) {
      return false;
    }
    this.state.is_running = true;
    this.state.active_task = taskId;
    return true;
  }

  /**
   * Release lock
   */
  releaseLock() {
    this.state.is_running = false;
    this.state.active_task = undefined;
  }

  /**
   * Record a task run completion
   */
  recordRun(run: TaskRun) {
    this.state.last_tick_at = new Date().toISOString();
    this.state.last_task_runs.unshift(run);
    if (this.state.last_task_runs.length > MAX_LOG_SIZE) {
      this.state.last_task_runs.pop();
    }
  }
}

export const runnerState = new StateManager();
