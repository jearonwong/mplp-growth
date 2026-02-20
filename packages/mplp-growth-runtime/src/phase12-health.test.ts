import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { version } from "../package.json";
import { runnerState } from "./runner/state";
import { server } from "./server/index";

describe("Phase 12 Gates — Health Version SSOT (v0.4.1)", () => {
  beforeAll(async () => {
    await server.ready();
    runnerState.setConfig({ enabled: true, policy_level: "safe" });
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-HEALTH-VERSION-SSOT-01", () => {
    it("health version strictly matches package.json", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/health",
      });
      const data = response.json();
      expect(response.statusCode).toBe(200);
      expect(data.version).toBe(version);
      expect(data.version).toBe("0.4.1");
    });
  });

  describe("GATE-HEALTH-REPORTS-RUNNER-01", () => {
    it("health endpoint delegates properties runner_enabled and policy_level", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/health",
      });
      const data = response.json();
      expect(data.runner_enabled).toBe(true);
      expect(data.policy_level).toBe("safe");
    });
  });
});
