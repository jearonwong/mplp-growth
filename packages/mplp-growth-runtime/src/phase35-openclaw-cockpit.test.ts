/**
 * Phase 35: OpenClaw Cockpit Mode Tests (v0.9.0)
 *
 * GATE-OPENCLAW-TELEMETRY-01: queue_delta accurate
 * GATE-OPENCLAW-ATTRIBUTION-01: triggered_by metadata on created items
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase 35: OpenClaw Cockpit Mode (v0.9.0)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-OPENCLAW-TELEMETRY-01 & GATE-OPENCLAW-ATTRIBUTION-01", () => {
    it("executes task, returns queue_delta, and sets triggered_by", async () => {
      // 1. Initial queue check
      const q1 = await server.inject({ method: "GET", url: "/api/queue" });
      const q1Data = q1.json();
      const initialCount = q1Data.pending_count;

      // 2. Execute via openclaw endpoint
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        headers: { "x-mplp-token": "ops-token-dev", authorization: "Bearer ops-token-dev" },
        payload: { task: "/inbox --platform x --content 'hello openclaw telemetry test'" },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();

      expect(data.ok).toBe(true);
      expect(data.run_id).toBeDefined();
      expect(data.queue_delta).toBeDefined();
      expect(data.queue_delta.before.pending_total).toBe(initialCount);
      expect(data.queue_delta.after.pending_total).toBeGreaterThanOrEqual(initialCount);
      expect(data.queue_delta.diff.pending_total).toBe(
        data.queue_delta.after.pending_total - data.queue_delta.before.pending_total,
      );

      expect(Array.isArray(data.created_ids)).toBe(true);
      expect(Array.isArray(data.consumed_ids)).toBe(true);
      expect(data.source).toBe("openclaw");

      // 3. Verify triggered_by on queue items
      const q2 = await server.inject({ method: "GET", url: "/api/queue" });
      const q2Data = q2.json();
      const allItems = [
        ...q2Data.categories.inbox,
        ...q2Data.categories.outreach,
        ...q2Data.categories.publish,
        ...q2Data.categories.review,
        ...q2Data.categories.other,
      ];

      // Look for the newly created item (which should have triggered_by: "openclaw")
      const hasOpenclawTriggered = allItems.some((i: any) => i.triggered_by === "openclaw");
      expect(hasOpenclawTriggered).toBe(true);
    });
  });

  describe("GATE-OPENCLAW-DELTA-ALG-01", () => {
    it("handles queue_delta math correctly for boundary conditions", async () => {
      // 1. Get exact before state
      const beforeRes = await server.inject({ method: "GET", url: "/api/queue" });
      const beforeData = beforeRes.json();

      // 2. Trigger task
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        headers: { "x-mplp-token": "ops-token-dev" },
        payload: { task: "/inbox --platform math-test --content math" },
      });

      const data = res.json();

      // 3. Verify math algorithms
      const afterRes = await server.inject({ method: "GET", url: "/api/queue" });
      const afterData = afterRes.json();

      // Exactly matches category counts algebraically
      expect(data.queue_delta.diff.by_category.inbox).toBe(
        data.queue_delta.after.by_category.inbox - data.queue_delta.before.by_category.inbox,
      );

      expect(data.queue_delta.diff.pending_total).toBe(
        data.queue_delta.after.pending_total - data.queue_delta.before.pending_total,
      );

      // newly minted confirm nodes will hit queue
      expect(data.created_ids.length).toBeGreaterThanOrEqual(1);

      // The arrays should explicitly contain the new items
      const newItems = afterData.categories.inbox.filter(
        (i: any) => !beforeData.categories.inbox.find((b: any) => b.id === i.id),
      );

      expect(data.created_ids).toContain(newItems[0].id);
    });
  });
});
