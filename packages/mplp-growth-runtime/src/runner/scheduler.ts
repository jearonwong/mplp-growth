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
