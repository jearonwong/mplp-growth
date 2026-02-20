import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { vi } from "vitest";
import { runnerState } from "./runner/state";
import { runAutoPublish } from "./runner/tasks";
import { server } from "./server/index";

describe("Phase 15 Gates — Runner Safety Policy (v0.4.1)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-RUNNER-POLICY-SAFETY-01", () => {
    it("skips auto-publish task when policy is safe or standard", async () => {
      runnerState.setConfig({ policy_level: "safe", auto_publish: true });

      const consoleSpy = vi.spyOn(console, "log");
      await runAutoPublish();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Auto-Publish skipped"));
      consoleSpy.mockRestore();
    });

    it("skips auto-publish task when auto_publish flag is false even if aggressive", async () => {
      runnerState.setConfig({ policy_level: "aggressive", auto_publish: false });

      const consoleSpy = vi.spyOn(console, "log");
      await runAutoPublish();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Auto-Publish skipped"));
      consoleSpy.mockRestore();
    });

    it("POST /api/runner/config updates runner configuration and auto_publish correctly", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/runner/config",
        payload: {
          policy_level: "aggressive",
          auto_publish: true,
        },
      });
      expect(res.statusCode).toBe(200);

      const statusRes = await server.inject({
        method: "GET",
        url: "/api/runner/status",
      });
      expect(statusRes.statusCode).toBe(200);
      const data = statusRes.json();
      expect(data.policy_level).toBe("aggressive");
      expect(data.auto_publish).toBe(true);
    });
  });
});
