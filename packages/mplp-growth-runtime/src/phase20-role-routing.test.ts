/**
 * Phase 20: Multi-Agent Job Routing Gate Tests (v0.7.0 P1)
 *
 * GATE-JOB-ROLE-ROUTING-01: config role injects into drafted_by_role
 * GATE-RUNNER-STATUS-ROLE-01: status API returns role mapping
 * GATE-CONFIG-ROLE-VALIDATION-01: invalid role enum yields 400
 */

import { beforeEach, describe, expect, it } from "vitest";
import { executor } from "./agents/executor";
import { StateManager } from "./runner/state";

describe("Phase 20: Multi-Agent Job Routing (v0.7.0)", () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  describe("GATE-JOB-ROLE-ROUTING-01: config role injects into drafted_by_role", () => {
    it("should set run_as_role on a job config", () => {
      state.setConfig({ jobs: { "outreach-draft": { run_as_role: "Editor" } } });
      const config = state.getConfig();
      expect(config.jobs["outreach-draft"].run_as_role).toBe("Editor");
    });

    it("executor.run with BDWriter role produces outreach_draft content", async () => {
      const result = await executor.run("BDWriter", {
        kind: "outreach_draft",
        target: { name: "TestCo" },
        channel: "email",
      });
      expect(result.content).toBeTruthy();
      expect(result.content).toContain("MPLP");
      expect(result.rationale_bullets).toBeDefined();
      expect(result.rationale_bullets.length).toBeGreaterThan(0);
      expect(result.rationale_bullets.length).toBeLessThanOrEqual(3);
    });

    it("executor.run with Responder role produces inbox_reply content", async () => {
      const result = await executor.run("Responder", {
        kind: "inbox_reply",
        interaction: { platform: "hn", author: "test", content: "Hello world" },
      });
      expect(result.content).toBeTruthy();
      expect(result.rationale_bullets).toBeDefined();
      expect(result.rationale_bullets.length).toBeLessThanOrEqual(3);
    });

    it("executor.run with Editor role produces content_variant", async () => {
      const result = await executor.run("Editor", {
        kind: "content_variant",
        asset_type: "article",
        topic: "growth",
        channels: ["linkedin"],
      });
      expect(result.content).toBeTruthy();
      expect(result.rationale_bullets).toBeDefined();
    });

    it("executor.run with Analyst role produces weekly_review", async () => {
      const result = await executor.run("Analyst", {
        kind: "weekly_review",
        metrics: {},
      });
      expect(result.content).toBeTruthy();
      expect(result.rationale_bullets).toBeDefined();
    });
  });

  describe("GATE-RUNNER-STATUS-ROLE-01: status API returns role mapping", () => {
    it("should expose run_as_role in getSnapshot after config set", () => {
      state.setConfig({ jobs: { inbox: { run_as_role: "Responder" } } });
      const snapshot = state.getSnapshot();
      expect(snapshot.jobs.inbox.run_as_role).toBe("Responder");
    });

    it("should expose run_as_role as undefined when not set", () => {
      const snapshot = state.getSnapshot();
      expect(snapshot.jobs.inbox.run_as_role).toBeUndefined();
    });
  });

  describe("GATE-CONFIG-ROLE-VALIDATION-01: invalid role enum yields error", () => {
    it("should throw on invalid run_as_role", () => {
      expect(() => {
        state.setConfig({
          // biome-ignore lint/suspicious/noExplicitAny: intentional invalid-type test
          jobs: { "outreach-draft": { run_as_role: "InvalidRole" as any } },
        });
      }).toThrow("Invalid run_as_role");
    });

    it("should accept all valid roles", () => {
      const validRoles = ["Responder", "BDWriter", "Editor", "Analyst"] as const;
      for (const role of validRoles) {
        expect(() => {
          state.setConfig({ jobs: { "outreach-draft": { run_as_role: role } } });
        }).not.toThrow();
      }
    });
  });
});
