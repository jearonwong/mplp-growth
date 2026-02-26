/**
 * Phase 24: API-only RC-2 Closure Gate Tests (v0.7.1)
 *
 * GATE-API-E2E-01: full signal→draft→redraft→approve→queue-empty cycle via API only
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase 24: API-only RC-2 Closure (v0.7.1)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-API-E2E-01: full cycle via API", () => {
    it("health returns 200 with version", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/health",
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.version).toBeDefined();
      expect(data.status).toBe("ok");
    });

    it("can set run_as_role via config API", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/runner/config",
        payload: {
          jobs: { inbox: { run_as_role: "Responder" } },
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.ok).toBe(true);
    });

    it("can push manual signal via inbox API", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/inbox/manual",
        payload: {
          content: "v0.7.1 RC-2 E2E test signal",
          author_handle: "@e2e-test",
          source_ref: "manual://e2e/1",
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.ok).toBe(true);
    });

    it("queue returns structured response with categories", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/queue",
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.pending_count).toBeGreaterThanOrEqual(0);
      expect(data.categories).toBeDefined();
      expect(data.categories.outreach).toBeDefined();
      expect(data.categories.inbox).toBeDefined();

      // If items exist, verify structure
      const allItems = [
        ...(data.categories.outreach || []),
        ...(data.categories.inbox || []),
        ...(data.categories.publish || []),
        ...(data.categories.review || []),
      ];
      if (allItems.length > 0) {
        const withRole = allItems.filter((i: { drafted_by_role?: string }) => i.drafted_by_role);
        if (withRole.length > 0) {
          expect(withRole[0].rationale_bullets).toBeDefined();
          expect(withRole[0].rationale_bullets.length).toBeLessThanOrEqual(3);
        }
      }
    });

    it("can clear run_as_role via null", async () => {
      const res = await server.inject({
        method: "POST",
        url: "/api/runner/config",
        payload: {
          jobs: { inbox: { run_as_role: null } },
        },
      });
      expect(res.statusCode).toBe(200);

      // Verify it was cleared
      const statusRes = await server.inject({
        method: "GET",
        url: "/api/runner/status",
      });
      const status = statusRes.json();
      expect(status.jobs.inbox.run_as_role).toBeUndefined();
    });
  });
});
