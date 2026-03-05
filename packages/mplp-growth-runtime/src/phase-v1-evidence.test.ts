/**
 * Phase D: v1.0 Evidence-grade Run Record Tests
 *
 * GATE-RUN-EVIDENCE-CONTRACT-01: Verifies the telemetry output of an autonomous OpenClaw execution
 * can be deterministically pulled as a canonical JSON evidence asset, matching the structural frozen contract.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server/index";

describe("Phase D: Evidence-grade Run Record (v1.0.0)", () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GATE-RUN-EVIDENCE-CONTRACT-01", () => {
    it("can export canonical structural evidence for a given run_id", async () => {
      // 1. Trigger autonomous task
      const triggerRes = await server.inject({
        method: "POST",
        url: "/api/ops/openclaw/execute",
        headers: { "x-mplp-token": "ops-token-dev", authorization: "Bearer ops-token-dev" },
        payload: { task: "/inbox --platform web --content 'evidence trace test'" },
      });

      expect(triggerRes.statusCode).toBe(200);
      const data = triggerRes.json();
      expect(data.run_id).toBeDefined();
      expect(data.queue_delta).toBeDefined();

      const runId = data.run_id;

      // 2. Fetch evidence footprint
      const evidenceRes = await server.inject({
        method: "GET",
        url: `/api/runner/runs/${runId}/evidence`,
      });

      expect(evidenceRes.statusCode).toBe(200);
      const evidence = evidenceRes.json();

      // 3. Verify structural schema invariants
      expect(evidence.run_id).toBe(runId);

      // Input verification
      expect(evidence.input).toBeDefined();
      expect(evidence.input.source).toBe("openclaw");
      expect(evidence.input.command).toBe("/inbox --platform web --content 'evidence trace test'");
      expect(typeof evidence.input.timestamp).toBe("string"); // ISO Date

      // Output verification (should perfectly match the trigger payload's queue_delta)
      expect(evidence.output).toBeDefined();
      expect(evidence.output.queue_delta).toBeDefined();
      expect(evidence.output.queue_delta.diff.pending_total).toBe(
        data.queue_delta.diff.pending_total,
      );

      // Affected references verification
      expect(evidence.affected_ids).toBeDefined();
      expect(Array.isArray(evidence.affected_ids.created_ids)).toBe(true);
      expect(Array.isArray(evidence.affected_ids.consumed_ids)).toBe(true);
      expect(evidence.affected_ids.created_ids.length).toBe(data.created_ids.length);

      // Snapshot ref
      expect(evidence.snapshot_ref === null || typeof evidence.snapshot_ref === "string").toBe(
        true,
      );
    });

    it("rejects invalid or legacy runs missing structural bindings", async () => {
      const evidenceRes = await server.inject({
        method: "GET",
        url: `/api/runner/runs/invalid-run-123/evidence`,
      });
      expect(evidenceRes.statusCode).toBe(404);
      expect(evidenceRes.json().error).toContain("not found");
    });
  });
});
