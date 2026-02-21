/**
 * Runner Daemon
 * Orchestrates the scheduling of tasks.
 */

import schedule from "node-schedule";
import { version } from "../../package.json";
import { Scheduler, SystemClock } from "./scheduler.js";
import { runnerState } from "./state.js";
import {
  runWeeklyBrief,
  runDailyOutreachDraft,
  runHourlyInbox,
  runWeeklyReview,
  runAutoPublish,
} from "./tasks.js";

export class RunnerDaemon {
  private scheduler: Scheduler;

  constructor() {
    this.scheduler = new Scheduler(new SystemClock());
  }

  start() {
    console.log(`[Runner] v${version} Starting daemon...`);
    runnerState.setConfig({ runner_enabled: true });

    // Monday 09:00 - Weekly Brief
    this.scheduler.register("0 9 * * 1", "weekly-brief", runWeeklyBrief);

    // Daily 10:00 - Outreach Draft
    this.scheduler.register("0 10 * * *", "daily-outreach", runDailyOutreachDraft);

    // Hourly - Inbox Check (09:00 - 18:00)
    this.scheduler.register("0 9-18 * * *", "hourly-inbox", runHourlyInbox);

    // Daily 17:00 - Auto Publish (Policy Checked inside task)
    this.scheduler.register("0 17 * * *", "auto-publish", runAutoPublish);

    // Friday 16:00 - Weekly Review
    this.scheduler.register("0 16 * * 5", "weekly-review", runWeeklyReview);

    console.log("[Runner] Daemon started. Schedule active.");
  }

  stop() {
    console.log("[Runner] Stopping daemon...");
    runnerState.setConfig({ runner_enabled: false });
    schedule.gracefulShutdown();
  }
}

export const runnerDaemon = new RunnerDaemon();
