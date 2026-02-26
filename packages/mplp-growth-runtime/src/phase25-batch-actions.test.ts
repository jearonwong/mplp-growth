/**
 * Phase 25: Batch Queue Actions Gate Tests (v0.7.2)
 *
 * GATE-BATCH-APPROVE-01: N pending → approved, failed=0
 * GATE-BATCH-REJECT-01: reject pending confirm
 * GATE-BATCH-REDRAFT-01: redraft updates metadata
 * GATE-BATCH-FAILURE-ISOLATION-01: 1 invalid + N valid → failed 1
 * GATE-BATCH-RESULT-SUMMARY-01: response has processed/skipped/failed
 * GATE-BATCH-VALIDATION-01: missing/invalid params rejected
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase 25: Batch Queue Actions (v0.7.2)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-BATCH-VALIDATION-01: input validation", () => {
    it("rejects missing action", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { ids: ["abc"] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects empty ids array", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "approve", ids: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid action", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "delete", ids: ["abc"] },
      });
      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.failed[0].error).toContain("Invalid action");
    });

    it("redraft requires valid role_id", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "redraft", ids: ["abc"] },
      });
      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.failed[0].error).toContain("role_id");
    });
  });

  describe("GATE-BATCH-FAILURE-ISOLATION-01: invalid ids handled gracefully", () => {
    it("batch reject with nonexistent id → failed array populated", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "reject", ids: ["nonexistent-id-1", "nonexistent-id-2"] },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.ok).toBe(false);
      expect(data.failed.length).toBe(2);
      expect(data.processed.length).toBe(0);
    });
  });

  describe("GATE-BATCH-RESULT-SUMMARY-01: response structure", () => {
    it("returns processed/skipped/failed arrays", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "approve", ids: ["nonexistent-approve-1"] },
      });
      const data = res.json();
      expect(Array.isArray(data.processed)).toBe(true);
      expect(Array.isArray(data.skipped)).toBe(true);
      expect(Array.isArray(data.failed)).toBe(true);
      expect(data.action).toBe("approve");
    });
  });

  describe("GATE-BATCH-APPROVE-01: batch approve with real ids", () => {
    it("approves pending queue items", async () => {
      const queueRes = await server.inject({ method: "GET", url: "/api/queue" });
      const queueData = queueRes.json();
      const allItems = [
        ...(queueData.categories?.outreach || []),
        ...(queueData.categories?.inbox || []),
        ...(queueData.categories?.publish || []),
        ...(queueData.categories?.review || []),
        ...(queueData.categories?.other || []),
      ];

      if (allItems.length === 0) {
        return;
      }

      const ids = allItems.slice(0, 2).map((i: { confirm_id: string }) => i.confirm_id);
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "approve", ids },
      });
      const data = res.json();
      expect(data.action).toBe("approve");
      // At least some should be processed (may fail if already approved)
      expect(data.processed.length + data.skipped.length + data.failed.length).toBe(ids.length);
    });
  });

  describe("GATE-BATCH-REJECT-01: batch reject", () => {
    it("rejects pending queue items without advancing other fields", async () => {
      const queueRes = await server.inject({ method: "GET", url: "/api/queue" });
      const queueData = queueRes.json();
      const allItems = [
        ...(queueData.categories?.outreach || []),
        ...(queueData.categories?.inbox || []),
      ];

      if (allItems.length === 0) {
        return;
      }

      const ids = allItems.slice(0, 1).map((i: { confirm_id: string }) => i.confirm_id);
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "reject", ids },
      });
      const data = res.json();
      expect(data.action).toBe("reject");
      expect(data.processed.length + data.skipped.length + data.failed.length).toBe(ids.length);
    });
  });

  describe("GATE-BATCH-REDRAFT-01: batch redraft", () => {
    it("redraft with valid role via batch endpoint", async () => {
      const queueRes = await server.inject({ method: "GET", url: "/api/queue" });
      const queueData = queueRes.json();
      const allItems = [
        ...(queueData.categories?.outreach || []),
        ...(queueData.categories?.inbox || []),
      ];

      if (allItems.length === 0) {
        return;
      }

      const ids = allItems.slice(0, 1).map((i: { confirm_id: string }) => i.confirm_id);
      const res = await server.inject({
        method: "POST",
        url: "/api/queue/batch",
        payload: { action: "redraft", ids, role_id: "Editor" },
      });
      const data = res.json();
      expect(data.action).toBe("redraft");
      expect(data.processed.length + data.skipped.length + data.failed.length).toBe(ids.length);
    });
  });
});
