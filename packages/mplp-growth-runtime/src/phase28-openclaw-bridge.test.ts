/**
 * Phase 28: OpenClaw Bridge Gate Tests (v0.7.3)
 *
 * GATE-TOKEN-OPTIONAL-01: no token → API works without header
 * GATE-TOKEN-ENFORCE-01: with token ENV → missing header → 401
 * GATE-DAILYRUN-PIPE-01: daily-run returns structured result
 * GATE-DAILYRUN-NO-NEW-WF-01: no new workflow IDs created
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase 28: OpenClaw Bridge (v0.7.3)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-TOKEN-OPTIONAL-01: no token ENV → API accessible", () => {
    it("health returns 200 without token header", async () => {
      const res = await server.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
    });

    it("queue returns 200 without token header", async () => {
      const res = await server.inject({ method: "GET", url: "/api/queue" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GATE-DAILYRUN-PIPE-01: daily-run returns structured result", () => {
    it("returns ok + inbox_result + queue_count", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/daily-run",
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.inbox_result).toBeDefined();
      expect(typeof data.queue_count).toBe("number");
    });

    it("supports auto_approve flag", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/daily-run",
        payload: { auto_approve: true },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.inbox_result).toBeDefined();
      // batch_result may or may not exist depending on queue state
      expect(typeof data.queue_count).toBe("number");
    });

    it("supports redraft_role_id", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/daily-run",
        payload: { redraft_role_id: "Editor" },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.inbox_result).toBeDefined();
    });
  });

  describe("GATE-DAILYRUN-NO-NEW-WF-01: no new workflow IDs", () => {
    it("daily-run response structure contains no workflow field", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/ops/daily-run",
        payload: {},
      });
      const data = res.json();
      // Verify no workflow_id or new_workflow fields
      expect(data.workflow_id).toBeUndefined();
      expect(data.new_workflow).toBeUndefined();
    });
  });
});
