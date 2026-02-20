import { describe, it, expect, vi, beforeEach } from "vitest";
import { Scheduler, VirtualClock } from "./runner/scheduler.js";
import { runnerState } from "./runner/state.js";

describe("GATE-RUNNER-SCHEDULE-01: Scheduler Abstraction", () => {
  let clock: VirtualClock;
  let scheduler: Scheduler;

  beforeEach(() => {
    clock = new VirtualClock();
    scheduler = new Scheduler(clock);
    runnerState.releaseLock();
    // Clear logs
    (runnerState as any).state.last_task_runs = [];
  });

  it("triggers task when virtual clock matches rule (simulated by explicit trigger)", async () => {
    const taskMock = vi.fn().mockResolvedValue(undefined);

    // Register task
    scheduler.register("0 9 * * *", "brief-task", taskMock);

    // Initial state
    expect(runnerState.getSnapshot().last_task_runs.length).toBe(0);

    // Tick clock (simulated trigger for test)
    await clock.triggerAll();

    expect(taskMock).toHaveBeenCalled();

    // Check Observability (FIX-1)
    const logs = runnerState.getSnapshot().last_task_runs;
    expect(logs.length).toBe(1);
    expect(logs[0].task_id).toBe("brief-task");
    expect(logs[0].status).toBe("success");
    expect(logs[0].started_at).toBeDefined();
    expect(logs[0].finished_at).toBeDefined();
  });

  it("prevents concurrent execution (Locking)", async () => {
    // Manually acquire lock
    runnerState.acquireLock("manual-lock");

    const taskMock = vi.fn().mockResolvedValue(undefined);
    scheduler.register("0 10 * * *", "locked-task", taskMock);

    // Trigger
    await clock.triggerAll();

    // Should NOT run
    expect(taskMock).not.toHaveBeenCalled();

    // Logs should NOT contain new run (skip log logic resides in scheduler but we don't record skips in state currently to avoid noise, just console warn)
    const logs = runnerState.getSnapshot().last_task_runs;
    expect(logs.length).toBe(0);
  });
});
