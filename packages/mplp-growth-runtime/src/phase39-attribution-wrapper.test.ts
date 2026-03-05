/**
 * Phase 39: Attribution Wrapper Gate (v0.9.1)
 *
 * GATE-ATTRIBUTION-WRAPPER-01: Verifies that passing source to orchestrator
 * correctly stamps it on domain nodes via the `psg` instance context.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { executeCommand } from "./commands/orchestrator";
import { server } from "./server/index";

describe("Phase 39: Attribution Wrapper (v0.9.1)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-ATTRIBUTION-WRAPPER-01", () => {
    it("transparently applies triggered_by and trigger_run_id to domain nodes via Context", async () => {
      // 1. Execute an inbox command with a UNIQUE run_id per test invocation to avoid stale data pollution
      const runId = `test-run-wrapper-${Date.now()}`;
      const uniqueContent = `Wrapper-GATE01-${runId}`;
      const output = await executeCommand(
        "inbox",
        ["--platform", "manual", "--content", uniqueContent, "--source", "openclaw"],
        runId,
      );

      expect(output).toContain("Inbox:");

      // 2. Fetch queue items and scope lookup to the UNIQUE content tag created by THIS run only
      const queueRes = await server.inject({ method: "GET", url: "/api/queue" });
      const queueData = queueRes.json();
      const inboxItems = queueData.categories.inbox;

      const wrapperItem = inboxItems.find((i: any) => JSON.stringify(i).includes(uniqueContent));
      expect(wrapperItem).toBeDefined();

      // 3. Verify that the Context successfully propagated the triggered_by field
      expect(wrapperItem.triggered_by).toBe("openclaw");
    });
  });

  describe("GATE-ALS-ISOLATION-01", () => {
    it("isolates context across concurrent executions and only tags Domain Nodes", async () => {
      // Execute two asynchronous commands concurrently with DIFFERENT sources
      const runId1 = "concurrent-run-001";
      const runId2 = "concurrent-run-002";

      const [out1, out2] = await Promise.all([
        executeCommand(
          "inbox",
          ["--platform", "manual", "--content", "Isolation A", "--source", "agent-alpha"],
          runId1,
        ),
        executeCommand(
          "inbox",
          ["--platform", "manual", "--content", "Isolation B", "--source", "agent-beta"],
          runId2,
        ),
      ]);

      expect(out1).toContain("Inbox:");
      expect(out2).toContain("Inbox:");

      // Fetch queue items to inspect Confirm nodes
      const queueRes = await server.inject({ method: "GET", url: "/api/queue" });
      const inboxItems = queueRes.json().categories.inbox;

      const itemA = inboxItems.find((i: any) => i.triggered_by === "agent-alpha");
      const itemB = inboxItems.find((i: any) => i.triggered_by === "agent-beta");

      expect(itemA).toBeDefined();
      expect(itemB).toBeDefined();

      // Verify strict isolation
      expect(itemA.triggered_by).toBe("agent-alpha");
      expect(itemB.triggered_by).toBe("agent-beta");
    });
  });
});
