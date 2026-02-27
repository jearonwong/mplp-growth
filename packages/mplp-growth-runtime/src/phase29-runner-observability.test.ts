/**
 * Phase 29: Runner Observability Gate Tests (v0.7.3)
 *
 * GATE-RUNNER-STATUS-PREVIEW-01: status endpoint includes preview and run ID
 * GATE-QUIET-HOURS-SKIP-01: scheduler obeys quiet hours config
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Scheduler, VirtualClock } from "./runner/scheduler";
import { runnerState } from "./runner/state";
import { server } from "./server/index";

describe("Phase 29: Runner Observability (v0.7.3)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-RUNNER-STATUS-PREVIEW-01: status includes preview + run_id", () => {
    it("returns jobs with last_run_id and last_outputs_preview", async () => {
      // Setup mock state
      const state = runnerState as any;
      state.runtime.jobs["inbox"] = {
        last_run_id: "run-123",
        last_outputs_preview: "test output preview",
      };

      const res = await server.inject({ method: "GET", url: "/api/runner/status" });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.jobs["inbox"].last_run_id).toBe("run-123");
      expect(data.jobs["inbox"].last_outputs_preview).toBe("test output preview");

      // cleanup
      state.runtime.jobs["inbox"] = {};
    });
  });

  describe("GATE-QUIET-HOURS-SKIP-01: scheduler obeys quiet hours config", () => {
    it("quiet_hours configuration is parsed correctly", () => {
      runnerState.setConfig({
        jobs: {
          inbox: {
            quiet_hours: { start: "00:00", end: "06:00" },
          },
        },
      });
      const config = runnerState.getConfig();
      expect(config.jobs["inbox"].quiet_hours).toEqual({ start: "00:00", end: "06:00" });
    });

    it("skips task execution during quiet hours", async () => {
      const clock = new VirtualClock();
      const scheduler = new Scheduler(clock);

      let executed = false;
      scheduler.register("0 * * * *", "inbox", async () => {
        executed = true;
      });

      // Set time to 03:00 (inside quiet hours)
      const testTime = new Date("2026-01-01T03:00:00Z");
      await clock.tick(testTime);
      await clock.triggerAll();

      expect(executed).toBe(false);

      const status = runnerState.getSnapshot();
      expect(status.jobs["inbox"].last_status).toBe("skipped");

      // Cleanup
      runnerState.setConfig({ jobs: { inbox: { quiet_hours: null } } });
      runnerState.releaseLock("inbox");
    });
  });
});
