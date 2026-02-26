/**
 * Runner State Management (FIX-1: Observability)
 * Tracks execution history, locks, and status.
 */

export interface JobConfig {
  enabled: boolean;
  schedule_cron: string;
  run_as_role?: "Responder" | "BDWriter" | "Editor" | "Analyst" | null;
}

export interface JobRuntime {
  last_tick_at?: string; // ISO
  next_run_at?: string | null; // ISO
  last_status?: "success" | "failed" | "skipped";
  last_error?: string;
  last_duration_ms?: number;
}

export interface RunnerConfig {
  runner_enabled: boolean;
  policy_level: "safe" | "standard" | "aggressive";
  auto_publish: boolean;
  jobs: Record<string, JobConfig>;
}

export interface RunnerRuntime {
  is_running: boolean;
  active_task?: string;
  jobs: Record<string, JobRuntime>;
}

export interface UnifiedJobModel extends JobConfig, JobRuntime {}

export interface UnifiedRunnerState
  extends Omit<RunnerConfig, "jobs">, Omit<RunnerRuntime, "jobs"> {
  jobs: Record<string, UnifiedJobModel>;
}

export class StateManager {
  private config: RunnerConfig = {
    runner_enabled: process.env.RUNNER_ENABLED === "true",
    policy_level: (process.env.POLICY_LEVEL as RunnerConfig["policy_level"]) || "safe",
    auto_publish: process.env.AUTO_PUBLISH === "true",
    jobs: {
      brief: { enabled: true, schedule_cron: "0 9 * * 1" }, // Monday 9am
      "outreach-draft": { enabled: true, schedule_cron: "0 10 * * *" }, // Daily 10am
      inbox: { enabled: true, schedule_cron: "0 * * * *" }, // Hourly
      review: { enabled: true, schedule_cron: "0 17 * * 5" }, // Friday 5pm
      publish: { enabled: false, schedule_cron: "*/15 * * * *" }, // Every 15m
    },
  };

  private runtime: RunnerRuntime = {
    is_running: false,
    jobs: {
      brief: {},
      "outreach-draft": {},
      inbox: {},
      review: {},
      publish: {},
    },
  };

  constructor() {
    this.recalculateNextRuns();
  }

  /**
   * Recalculates `next_run_at` for all jobs based on server timezone.
   */
  private recalculateNextRuns() {
    const now = new Date();
    for (const [jobId, jobConfig] of Object.entries(this.config.jobs)) {
      const jobRuntime = this.runtime.jobs[jobId] || {};
      if (!jobConfig.enabled) {
        jobRuntime.next_run_at = null;
      } else {
        try {
          const schedule = jobConfig.schedule_cron;
          let next = new Date(now.getTime());

          if (schedule === "0 9 * * 1") {
            // Monday 9am
            next.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
            next.setHours(9, 0, 0, 0);
            if (next.getTime() <= now.getTime()) {
              next.setDate(next.getDate() + 7);
            }
          } else if (schedule === "0 10 * * *") {
            // Daily 10am
            next.setHours(10, 0, 0, 0);
            if (next.getTime() <= now.getTime()) {
              next.setDate(next.getDate() + 1);
            }
          } else if (schedule === "0 * * * *") {
            // Hourly
            next.setHours(now.getHours() + 1, 0, 0, 0);
          } else if (schedule === "0 17 * * 5") {
            // Friday 5pm
            next.setDate(now.getDate() + ((5 + 7 - now.getDay()) % 7 || 7));
            next.setHours(17, 0, 0, 0);
            if (next.getTime() <= now.getTime()) {
              next.setDate(next.getDate() + 7);
            }
          } else if (schedule === "*/15 * * * *") {
            // 15m
            next.setMinutes(next.getMinutes() + 15 - (next.getMinutes() % 15), 0, 0);
          } else {
            throw new Error(`Unsupported CRON: ${schedule}`);
          }
          jobRuntime.next_run_at = next.toISOString();
        } catch (err) {
          jobRuntime.next_run_at = null;
          jobRuntime.last_error = `Invalid CRON: ${jobConfig.schedule_cron}`;
        }
      }
      this.runtime.jobs[jobId] = jobRuntime;
    }
  }

  /**
   * Get full state snapshot merging config and runtime
   */
  getSnapshot(): UnifiedRunnerState {
    const unifiedJobs: Record<string, UnifiedJobModel> = {};
    for (const jobId of Object.keys(this.config.jobs)) {
      unifiedJobs[jobId] = {
        ...this.config.jobs[jobId],
        ...this.runtime.jobs[jobId],
      };
    }
    return {
      runner_enabled: this.config.runner_enabled,
      policy_level: this.config.policy_level,
      auto_publish: this.config.auto_publish,
      is_running: this.runtime.is_running,
      active_task: this.runtime.active_task,
      jobs: unifiedJobs,
    };
  }

  /**
   * Attempt to acquire lock for a task
   */
  acquireLock(taskId: string): boolean {
    if (this.runtime.is_running) {
      return false;
    }
    this.runtime.is_running = true;
    this.runtime.active_task = taskId;
    return true;
  }

  /**
   * Release lock and optionally record run outcome
   */
  releaseLock(
    taskId: string,
    runData?: { status: "success" | "failed" | "skipped"; error?: string; duration_ms?: number },
  ) {
    this.runtime.is_running = false;
    this.runtime.active_task = undefined;

    if (runData && this.runtime.jobs[taskId]) {
      this.runtime.jobs[taskId].last_tick_at = new Date().toISOString();
      this.runtime.jobs[taskId].last_status = runData.status;
      this.runtime.jobs[taskId].last_error = runData.error;
      if (runData.duration_ms !== undefined) {
        this.runtime.jobs[taskId].last_duration_ms = runData.duration_ms;
      }
      this.recalculateNextRuns();
    }
  }

  /**
   * Get mutable config (Internal only, for API updates)
   */
  getConfig(): RunnerConfig {
    return this.config;
  }

  /**
   * Update configuration and recalculate crons
   */
  setConfig(
    newConfig: Omit<Partial<RunnerConfig>, "jobs"> & {
      jobs?: Partial<Record<string, Partial<JobConfig>>>;
    },
  ) {
    if (newConfig.runner_enabled !== undefined) {
      this.config.runner_enabled = newConfig.runner_enabled;
    }
    if (newConfig.policy_level !== undefined) {
      this.config.policy_level = newConfig.policy_level;
    }
    if (newConfig.auto_publish !== undefined) {
      this.config.auto_publish = newConfig.auto_publish;
    }

    if (newConfig.jobs) {
      for (const [jobId, jobUpdates] of Object.entries(newConfig.jobs)) {
        if (!this.config.jobs[jobId] || !jobUpdates) {
          continue;
        }
        if (jobUpdates.enabled !== undefined) {
          this.config.jobs[jobId].enabled = jobUpdates.enabled;
        }
        if (jobUpdates.schedule_cron !== undefined) {
          // pre-validate lightweight regex maps
          const valid = ["0 9 * * 1", "0 10 * * *", "0 * * * *", "0 17 * * 5", "*/15 * * * *"];
          if (!valid.includes(jobUpdates.schedule_cron)) {
            throw new Error(`Invalid or unsupported CRON for MVP: ${jobUpdates.schedule_cron}`);
          }
          this.config.jobs[jobId].schedule_cron = jobUpdates.schedule_cron;
        }
        if (jobUpdates.run_as_role !== undefined) {
          if (jobUpdates.run_as_role === null) {
            delete this.config.jobs[jobId].run_as_role;
          } else {
            const validRoles = ["Responder", "BDWriter", "Editor", "Analyst"];
            if (!validRoles.includes(jobUpdates.run_as_role)) {
              throw new Error(`Invalid run_as_role: ${jobUpdates.run_as_role}`);
            }
            this.config.jobs[jobId].run_as_role = jobUpdates.run_as_role;
          }
        }
      }
    }

    this.recalculateNextRuns();
  }
}

export const runnerState = new StateManager();
