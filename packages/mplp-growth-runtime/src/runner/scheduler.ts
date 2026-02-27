/**
 * Abstract Scheduler (FIX-2: Testability)
 * Decouples task scheduling from system clock for unit testing.
 */

import schedule from "node-schedule";
import { runnerState } from "./state.js";

type TaskCallback = () => Promise<void>;

export interface Clock {
  scheduleJob(rule: string, callback: TaskCallback): void;
  now(): Date;
}

/**
 * Real system clock using node-schedule
 */
export class SystemClock implements Clock {
  scheduleJob(rule: string, callback: TaskCallback) {
    schedule.scheduleJob(rule, callback);
  }
  now(): Date {
    return new Date();
  }
}

/**
 * Virtual clock for testing
 */
export class VirtualClock implements Clock {
  private jobs: { rule: string; callback: TaskCallback }[] = [];
  private currentTime: Date = new Date();

  scheduleJob(rule: string, callback: TaskCallback) {
    this.jobs.push({ rule, callback });
  }

  now(): Date {
    return this.currentTime;
  }

  /**
   * Helper for tests: advance time and trigger jobs
   */
  async tick(newTime: Date) {
    this.currentTime = newTime;
    // Simple mock logic: if rule matches (in a real test we'd need cron parser), run callback
    // For MVP tests, we might trigger manually via job index
  }

  async triggerAll() {
    for (const job of this.jobs) {
      await job.callback();
    }
  }
}

export class Scheduler {
  private clock: Clock;

  constructor(clock: Clock = new SystemClock()) {
    this.clock = clock;
  }

  register(rule: string, taskId: string, task: TaskCallback) {
    this.clock.scheduleJob(rule, async () => {
      // B2: Quiet Hours Check
      const jobConfig = runnerState.getConfig().jobs[taskId];
      if (jobConfig && jobConfig.quiet_hours) {
        const nowTime = this.clock.now();
        const startParts = jobConfig.quiet_hours.start.split(":").map(Number);
        const endParts = jobConfig.quiet_hours.end.split(":").map(Number);

        const startMins = startParts[0] * 60 + startParts[1];
        const endMins = endParts[0] * 60 + endParts[1];
        const currentMins = nowTime.getUTCHours() * 60 + nowTime.getUTCMinutes();

        let inQuietHours = false;
        if (startMins <= endMins) {
          inQuietHours = currentMins >= startMins && currentMins <= endMins;
        } else {
          // Crosses midnight
          inQuietHours = currentMins >= startMins || currentMins <= endMins;
        }

        if (inQuietHours) {
          console.log(`[Runner] Task ${taskId} skipped (quiet hours).`);
          if (runnerState.acquireLock(taskId)) {
            runnerState.releaseLock(taskId, { status: "skipped", error: "Quiet hours" });
          }
          return;
        }
      }

      // FIX-1: Lock
      if (!runnerState.acquireLock(taskId)) {
        console.warn(`[Runner] Task ${taskId} skipped (locked).`);
        return;
      }

      console.log(`[Runner] Starting task: ${taskId} at ${this.clock.now().toISOString()}`);
      const start = new Date().toISOString();

      const startTime = Date.now();

      try {
        await task();
        runnerState.releaseLock(taskId, {
          status: "success",
          duration_ms: Date.now() - startTime,
        });
      } catch (err: any) {
        console.error(`[Runner] Task ${taskId} failed:`, err);
        runnerState.releaseLock(taskId, {
          status: "failed",
          error: err.message,
          duration_ms: Date.now() - startTime,
        });
      }
    });
  }
}
