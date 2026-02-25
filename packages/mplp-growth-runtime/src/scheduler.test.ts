import { describe, it, expect, vi, beforeEach } from "vitest";
import { Scheduler, VirtualClock } from "./runner/scheduler.js";
import { runnerState } from "./runner/state.js";

describe("GATE-RUNNER-SCHEDULE-01: Scheduler Abstraction", () => {
  let clock: VirtualClock;
  let scheduler: Scheduler;

  beforeEach(() => {
    clock = new VirtualClock();
    scheduler = new Scheduler(clock);
    runnerState.releaseLock("dummy");
    // Clear logs (handled by dropping state mutator in new jobs map logic)
  });

  it("triggers task when virtual clock matches rule (simulated by explicit trigger)", async () => {
    const taskMock = vi.fn().mockResolvedValue(undefined);

    // Register task
    scheduler.register("0 9 * * *", "brief", taskMock);

    // Initial state
    expect(runnerState.getSnapshot().jobs["brief"]?.last_status).toBeUndefined();

    // Tick clock (simulated trigger for test)
    await clock.triggerAll();

    expect(taskMock).toHaveBeenCalled();

    // Check Observability (FIX-1)
    const job = runnerState.getSnapshot().jobs["brief"];
    expect(job.last_status).toBe("success");
    expect(job.last_tick_at).toBeDefined();
  });

  it("prevents concurrent execution (Locking)", async () => {
    // Manually acquire lock
    runnerState.acquireLock("manual-lock");

    const taskMock = vi.fn().mockResolvedValue(undefined);
    scheduler.register("0 10 * * *", "outreach-draft", taskMock);

    // Trigger
    await clock.triggerAll();

    // Should NOT run
    expect(taskMock).not.toHaveBeenCalled();

    // Logs should NOT contain new run (skip log logic resides in scheduler but we don't record skips in state currently to avoid noise, just console warn)
    const job = runnerState.getSnapshot().jobs["outreach-draft"];
    expect(job?.last_status).toBeUndefined();
  });
});
