/**
 * Phase 40: API Security Hardening (v0.9.1)
 *
 * GATE-AUTH-BLOCKS-OPS-01: Verifies that unified middleware blocks unauthorized
 * calls to OpenClaw / mutative endpoints with explicit 401s.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase 40: API Security Hardening (v0.9.1)", () => {
  beforeAll(async () => {
    await server.ready();
    await server.inject({
      method: "POST",
      url: "/api/admin/seed",
      headers: { "x-mplp-token": "ops-token-dev" },
    });
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-AUTH-BLOCKS-OPS-01", () => {
    it("rejects unauthorized access to mutative OPS APIs with 401", async () => {
      // 1. No token -> 401
      let res = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        payload: { task: "/inbox --platform test --content test" },
      });
      expect(res.statusCode).toBe(401);

      // 2. Invalid token -> 401
      res = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        headers: { authorization: "Bearer invalid-token-123" },
        payload: { task: "/inbox --platform test --content test" },
      });
      expect(res.statusCode).toBe(401);

      // 3. Valid Token -> 200 (and checks base contract execution)
      res = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        headers: { "x-mplp-token": "ops-token-dev" },
        payload: { task: "/inbox --platform test --content auth-test" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
      expect(res.json().queue_delta).toBeDefined();
    });
  });

  describe("GATE-AUTH-COVERAGE-01", () => {
    it("protects all critical mutative endpoints across namespaces", async () => {
      const endpoints = [
        "/api/admin/seed",
        "/api/admin/snapshot",
        "/api/admin/restore",
        "/api/runner/config",
        "/api/runner/execute",
        "/api/ops/daily-run",
        "/api/ops/batch/action",
      ];

      for (const ep of endpoints) {
        const res = await server.inject({ method: "POST", url: ep, payload: {} });
        expect(res.statusCode, `Endpoint ${ep} should be protected`).toBe(401);
      }
    });
  });
});
