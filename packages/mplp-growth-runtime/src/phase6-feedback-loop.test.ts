/**
 * Phase 6 Feedback Loop Gate Tests
 *
 * Gate tests for v0.1.1 feedback loop closure:
 * - GATE-INTERACTION-STATE-MACHINE-01: pending→responded→archived only
 * - GATE-METRICS-IMMUTABLE-01: MetricSnapshot rejects update
 * - GATE-REVIEW-WRITES-SNAPSHOT-01: /review produces MetricSnapshot + events
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "./glue/event-emitter";
import { createContext, type BrandPolicy, type AudienceSegment } from "./modules/mplp-modules";
import { createInteraction, createMetricSnapshot, createChannelProfile } from "./psg/growth-nodes";
import { InMemoryPSG } from "./psg/in-memory-psg";
import { FileVSL } from "./vsl/file-vsl";
import { transitionInteraction } from "./workflows/wf04-inbox-handler";
import { runInboxHandler } from "./workflows/wf04-inbox-handler";
import { runWeeklyReview } from "./workflows/wf05-weekly-review";

describe("Phase 6 Feedback Loop Gates", () => {
  let basePath: string;
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;

  beforeAll(async () => {
    basePath = path.join(os.tmpdir(), `mplp-phase6-test-${Date.now()}`);

    vsl = new FileVSL({ basePath });
    await vsl.init();

    const brand: BrandPolicy = {
      name: "Test Brand",
      tagline: "Test tagline",
      positioning: "Test positioning",
      forbidden_terms: ["spam"],
      links: { website: "https://test.io" },
    };

    const audiences: AudienceSegment[] = [
      { segment: "developers", pain_points: ["test"], value_proposition: "test", cta: "test" },
    ];

    const context = createContext({
      title: "Phase 6 Test Context",
      domain: "growth",
      environment: "test",
      brand,
      audiences,
    });
    context.status = "active";
    (context.root as any).cadence = { weekly_rhythm: { monday: "content" } };

    contextId = context.context_id;
    eventEmitter = new EventEmitter(contextId);
    psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);

    await psg.putNode(context as any);

    // Create a channel profile for completeness
    const channel = createChannelProfile({
      context_id: contextId,
      platform: "x",
      format_rules: { max_chars: 280 },
    });
    await psg.putNode(channel);
  });

  afterAll(async () => {
    await fs.rm(basePath, { recursive: true, force: true });
  });

  // ========================================================================
  // GATE-INTERACTION-STATE-MACHINE-01
  // ========================================================================
  describe("GATE-INTERACTION-STATE-MACHINE-01: Interaction state machine", () => {
    it("new Interaction starts with status=pending", () => {
      const interaction = createInteraction({
        context_id: contextId,
        platform: "x",
        content: "Great thread!",
        author: "@user1",
      });

      expect(interaction.status).toBe("pending");
      expect(interaction.received_at).toBeDefined();
      expect(interaction.responded_at).toBeUndefined();
    });

    it("allows transition: pending → responded", () => {
      const interaction = createInteraction({
        context_id: contextId,
        platform: "x",
        content: "Nice post",
      });

      const responded = transitionInteraction(interaction, "responded");

      expect(responded.status).toBe("responded");
      expect(responded.responded_at).toBeDefined();
    });

    it("allows transition: responded → archived", () => {
      const interaction = createInteraction({
        context_id: contextId,
        platform: "linkedin",
        content: "Interesting approach",
      });

      const responded = transitionInteraction(interaction, "responded");
      const archived = transitionInteraction(responded, "archived");

      expect(archived.status).toBe("archived");
    });

    it("rejects transition: pending → archived (must go through responded)", () => {
      const interaction = createInteraction({
        context_id: contextId,
        platform: "x",
        content: "Skip straight to archive",
      });

      expect(() => transitionInteraction(interaction, "archived")).toThrow(
        /Invalid Interaction transition: pending → archived/,
      );
    });

    it("rejects transition: archived → pending (no backward)", () => {
      const interaction = createInteraction({
        context_id: contextId,
        platform: "x",
        content: "Try to reopen",
      });

      const responded = transitionInteraction(interaction, "responded");
      const archived = transitionInteraction(responded, "archived");

      expect(() => transitionInteraction(archived, "responded")).toThrow(
        /Invalid Interaction transition: archived/,
      );
    });

    it("Confirm in WF-04 uses target_type=plan (not interaction)", async () => {
      const result = await runInboxHandler(
        {
          context_id: contextId,
          interactions: [{ platform: "x", content: "Hello", author: "@test" }],
        },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.confirm).toBeDefined();
      expect(result.confirm!.target_type).toBe("plan");
      expect(result.confirm!.target_id).toBe(result.plan.plan_id);
    });
  });

  // ========================================================================
  // GATE-METRICS-IMMUTABLE-01
  // ========================================================================
  describe("GATE-METRICS-IMMUTABLE-01: MetricSnapshot is append-only", () => {
    it("creating a new MetricSnapshot succeeds", async () => {
      const snapshot = createMetricSnapshot({
        context_id: contextId,
        period: "weekly",
        metrics: { plans_created: 5, assets_published: 3 },
      });

      await expect(psg.putNode(snapshot)).resolves.not.toThrow();
    });

    it("updating an existing MetricSnapshot throws", async () => {
      const snapshot = createMetricSnapshot({
        context_id: contextId,
        period: "daily",
        metrics: { test_metric: 42 },
      });

      // First write succeeds
      await psg.putNode(snapshot);

      // Second write (update) must be rejected
      const mutated = { ...snapshot, metrics: { test_metric: 999 } };
      await expect(psg.putNode(mutated)).rejects.toThrow(/MetricSnapshot is immutable/);
    });

    it("creating a different MetricSnapshot with a different ID succeeds", async () => {
      const snapshot1 = createMetricSnapshot({
        context_id: contextId,
        period: "weekly",
        metrics: { week1: 10 },
      });
      const snapshot2 = createMetricSnapshot({
        context_id: contextId,
        period: "weekly",
        metrics: { week2: 20 },
      });

      await psg.putNode(snapshot1);
      await expect(psg.putNode(snapshot2)).resolves.not.toThrow();
    });
  });

  // ========================================================================
  // GATE-REVIEW-WRITES-SNAPSHOT-01
  // ========================================================================
  describe("GATE-REVIEW-WRITES-SNAPSHOT-01: /review produces snapshot + events", () => {
    it("WF-05 outputs snapshot_id", async () => {
      const result = await runWeeklyReview({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.success).toBe(true);
      expect(result.outputs.snapshot_id).toBeDefined();
      expect(typeof result.outputs.snapshot_id).toBe("string");
    });

    it("WF-05 produces >= 3 PipelineStageEvents", async () => {
      const result = await runWeeklyReview({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.success).toBe(true);
      expect(result.events.pipeline_stage_count).toBeGreaterThanOrEqual(3);
    });

    it("WF-05 outputs metrics and suggestions", async () => {
      const result = await runWeeklyReview({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.success).toBe(true);
      expect(result.outputs.metrics).toBeDefined();
      expect(typeof result.outputs.metrics).toBe("object");
      expect(result.outputs.suggestions).toBeDefined();
      expect(Array.isArray(result.outputs.suggestions)).toBe(true);
    });

    it("WF-05 produces Plan + Trace", async () => {
      const result = await runWeeklyReview({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan.plan_id).toBeDefined();
      expect(result.trace).toBeDefined();
      expect(result.trace.trace_id).toBeDefined();
    });
  });
});
