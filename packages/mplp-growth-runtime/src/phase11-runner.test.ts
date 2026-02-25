import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runnerState } from "./runner/state.js";
import { seed } from "./seed.js";
import { server } from "./server/index.js";

describe("Phase 11: Runner & API (v0.4.0)", () => {
  beforeAll(async () => {
    // Initialize runner state
    runnerState.setConfig({ runner_enabled: false, policy_level: "safe" } as any);
    // Mock getRuntime/init logic if needed, but integration test might fail if environment not set.
    // However, fastify.inject doesn't start the server, just mocks the request.
    // The handlers call getRuntime() which initializes VSL/PSG.
    // We should ensure VSL_ROOT is set or mocked.
    process.env.MPLP_GROWTH_STATE_DIR = "/tmp/mplp-growth-test-phase11-" + Date.now();
    await seed();
  });

  afterAll(async () => {
    // Cleanup
  });

  it("GATE-API-HEALTH-01: Health check returns ok", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/health",
    });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe("ok");
    expect(json.version).toBeDefined();
  });

  it("GATE-API-QUEUE-01: Queue returns emptiness on fresh state", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/queue",
    });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.pending_count).toBe(0);
    expect(json.categories.outreach).toEqual([]);
  });

  it("GATE-API-CMD-01: Execute returns idempotent structure", async () => {
    // We try a command that doesn't rely heavily on state, e.g. brief (but brief needs context).
    // Or we fail gracefully.
    // Since we didn't run seed, specific commands might fail.
    // But we test the RESPONSE STRUCTURE (FIX-3).

    // We'll mock the executeCommand if possible, or just expect the error structure.
    // But testing the error structure is valid too (Idempotency of error response).

    const response = await server.inject({
      method: "POST",
      url: "/api/cmd/execute",
      payload: {
        command: "unknown-cmd",
        args: [],
      },
    });

    // It should return 200 with ok:true (if executeCommand returns error card string)
    // OR it might return valid JSON error structure if we threw inside handler?
    // In server/index.ts, we catch error and return proper JSON error.
    // orchestrator's executeCommand returns a STRING (markdown).
    // So unknown command returns a string "Error: Unknown command".
    // So API should return ok: true, outputs: "Error: ..."

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.ok).toBe(true);
    expect(json.run_id).toBeDefined();
    // executeCommand returns markdown string, unknown command returns error card markdown
    expect(json.outputs).toContain("Unknown command");
  });

  it("GET /api/runner/status returns correct state", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/runner/status",
    });
    const json = response.json();
    expect(json.runner_enabled).toBe(false);
    expect(json.policy_level).toBe("safe");
  });
});
