/**
 * Phase 22: Default Role Reset Gate Tests (v0.7.1)
 *
 * GATE-ROLE-RESET-01: set role → clear via null → GET status shows undefined
 */

import { beforeEach, describe, expect, it } from "vitest";
import { StateManager } from "./runner/state";

describe("Phase 22: Default Role Reset (v0.7.1)", () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  describe("GATE-ROLE-RESET-01: set role then clear via null", () => {
    it("should set run_as_role to Responder", () => {
      state.setConfig({ jobs: { inbox: { run_as_role: "Responder" } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBe("Responder");
    });

    it("should clear run_as_role to undefined via null", () => {
      state.setConfig({ jobs: { inbox: { run_as_role: "Responder" } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBe("Responder");

      state.setConfig({ jobs: { inbox: { run_as_role: null } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBeUndefined();
    });

    it("should clear run_as_role in getSnapshot", () => {
      state.setConfig({ jobs: { inbox: { run_as_role: "Editor" } } });
      expect(state.getSnapshot().jobs.inbox.run_as_role).toBe("Editor");

      state.setConfig({ jobs: { inbox: { run_as_role: null } } });
      expect(state.getSnapshot().jobs.inbox.run_as_role).toBeUndefined();
    });

    it("should accept null without throwing", () => {
      expect(() => {
        state.setConfig({ jobs: { inbox: { run_as_role: null } } });
      }).not.toThrow();
    });

    it("should still throw on invalid string role", () => {
      expect(() => {
        // biome-ignore lint/suspicious/noExplicitAny: intentional invalid-type test
        state.setConfig({ jobs: { inbox: { run_as_role: "FakeRole" as any } } });
      }).toThrow("Invalid run_as_role");
    });

    it("should cycle: set → clear → set again", () => {
      state.setConfig({ jobs: { inbox: { run_as_role: "BDWriter" } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBe("BDWriter");

      state.setConfig({ jobs: { inbox: { run_as_role: null } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBeUndefined();

      state.setConfig({ jobs: { inbox: { run_as_role: "Analyst" } } });
      expect(state.getConfig().jobs.inbox.run_as_role).toBe("Analyst");
    });
  });
});
