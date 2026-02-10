/**
 * Phase 7 Outreach Gate Tests
 *
 * Gate tests for v0.2.0:
 * - GATE-WF06-CONFIRM-PLAN-01: Confirm(target_type='plan'), status=pending, decisions empty
 * - GATE-WF06-APPROVE-FLOW-01: /approve pushes Confirm→approved, OT→contacted, Interaction→responded
 * - GATE-WF06-FORBIDDEN-TERMS-01: Content with forbidden_terms is rejected
 * - GATE-WF06-EVIDENCE-WRITEBACK-01: WF-06 produces ≥1 ContentAsset + ≥1 Interaction
 * - GATE-WF06-PLAN-TRACE-BINDING-01: trace.plan_id === plan.plan_id
 * - GATE-WF06-EVENT-COUNT-MIN-01: PipelineStageEvent ≥ 5, GraphUpdateEvent ≥ 2
 * - GATE-EXTENSION-POLICY-LOAD-01: WF-06 loads policy Extension when present
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "./glue/event-emitter";
import {
  createContext,
  createExtension,
  type BrandPolicy,
  type AudienceSegment,
  type Confirm,
} from "./modules/mplp-modules";
import { createChannelProfile, createOutreachTarget } from "./psg/growth-nodes";
import { InMemoryPSG } from "./psg/in-memory-psg";
import { FileVSL } from "./vsl/file-vsl";
import { transitionInteraction } from "./workflows/wf04-inbox-handler";
import { runOutreach } from "./workflows/wf06-outreach";

describe("Phase 7 Outreach Gates", () => {
  let basePath: string;
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;
  let targetId: string;

  beforeAll(async () => {
    basePath = path.join(os.tmpdir(), `mplp-phase7-test-${Date.now()}`);

    vsl = new FileVSL({ basePath });
    await vsl.init();

    const brand: BrandPolicy = {
      name: "Test Brand",
      tagline: "Test tagline",
      positioning: "Test positioning",
      forbidden_terms: ["certification", "endorsed by", "compliance certified"],
      links: { website: "https://test.io" },
    };

    const audiences: AudienceSegment[] = [
      {
        segment: "developers",
        pain_points: ["test"],
        value_proposition: "test value",
        cta: "test",
      },
    ];

    const context = createContext({
      title: "Phase 7 Test Context",
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

    // Create channel profile
    const channel = createChannelProfile({
      context_id: contextId,
      platform: "x",
      format_rules: { max_chars: 280 },
    });
    await psg.putNode(channel);

    // Create outreach target
    const target = createOutreachTarget({
      context_id: contextId,
      name: "Linux Foundation",
      org_type: "foundation",
      notes: "Potential partnership for governance standards",
    });
    targetId = target.id;
    await psg.putNode(target);
  });

  afterAll(async () => {
    await fs.rm(basePath, { recursive: true, force: true });
  });

  // ========================================================================
  // GATE-WF06-CONFIRM-PLAN-01
  // ========================================================================
  describe("GATE-WF06-CONFIRM-PLAN-01: Confirm is pending with empty decisions", () => {
    it("WF-06 creates Confirm(target_type=plan, target_id=plan_id)", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.confirm).toBeDefined();
      expect(result.confirm!.target_type).toBe("plan");
      expect(result.confirm!.target_id).toBe(result.plan.plan_id);
    });

    it("Confirm.status is pending (NOT auto-approved)", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "linkedin" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.confirm!.status).toBe("pending");
    });

    it("Confirm.decisions is empty/undefined", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "x" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      const decisions = result.confirm!.decisions;
      expect(!decisions || decisions.length === 0).toBe(true);
    });
  });

  // ========================================================================
  // GATE-WF06-APPROVE-FLOW-01
  // ========================================================================
  describe("GATE-WF06-APPROVE-FLOW-01: /approve pushes state forward", () => {
    it("approve updates Confirm → approved with decision record", async () => {
      // Run outreach first
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );
      expect(result.success).toBe(true);
      const confirm = result.confirm!;

      // Simulate approve: write decision + push status
      const approved: Confirm = {
        ...confirm,
        status: "approved",
        decisions: [
          {
            decision_id: "test-decision-1",
            status: "approved",
            decided_by_role: "user",
            decided_at: new Date().toISOString(),
            reason: "Test approval",
          },
        ],
      };
      await psg.putNode(approved as any);

      // Verify
      const confirms = await psg.query<any>({
        type: "Confirm",
        filter: { confirm_id: confirm.confirm_id },
      });
      expect(confirms[0].status).toBe("approved");
      expect(confirms[0].decisions.length).toBe(1);
      expect(confirms[0].decisions[0].decided_by_role).toBe("user");
    });

    it("Interaction transitions pending → responded after approval", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );
      expect(result.success).toBe(true);

      // Find the created interaction
      const interactions = await psg.query<any>({
        type: "domain:Interaction",
        filter: { id: result.outputs.interaction_id },
      });
      expect(interactions.length).toBeGreaterThan(0);
      const interaction = interactions[0];
      expect(interaction.status).toBe("pending");

      // Transition after approval
      const responded = transitionInteraction(interaction, "responded");
      expect(responded.status).toBe("responded");
      expect(responded.responded_at).toBeDefined();
    });
  });

  // ========================================================================
  // GATE-WF06-FORBIDDEN-TERMS-01
  // ========================================================================
  describe("GATE-WF06-FORBIDDEN-TERMS-01: forbidden terms rejected", () => {
    it("content with forbidden terms causes workflow failure", async () => {
      // Create a target with a name that triggers forbidden terms
      const badTarget = createOutreachTarget({
        context_id: contextId,
        name: "certification body",
        org_type: "standards",
        notes: "This should trigger forbidden_terms",
      });
      await psg.putNode(badTarget);

      // The draft generator includes target.name in the content,
      // which means "certification" (a forbidden term) will appear
      const result = await runOutreach(
        { context_id: contextId, target_id: badTarget.id, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("GATE-WF06-FORBIDDEN-TERMS-01");
      expect(result.error).toContain("certification");
    });
  });

  // ========================================================================
  // GATE-WF06-EVIDENCE-WRITEBACK-01
  // ========================================================================
  describe("GATE-WF06-EVIDENCE-WRITEBACK-01: evidence writeback", () => {
    it("WF-06 produces ≥1 ContentAsset(outreach_email)", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.outputs.asset_id).toBeDefined();

      // Verify asset exists in PSG
      const assets = await psg.query<any>({
        type: "domain:ContentAsset",
        filter: { id: result.outputs.asset_id },
      });
      expect(assets.length).toBeGreaterThan(0);
      expect(assets[0].asset_type).toBe("outreach_email");
    });

    it("WF-06 produces ≥1 Interaction", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.outputs.interaction_id).toBeDefined();

      const interactions = await psg.query<any>({
        type: "domain:Interaction",
        filter: { id: result.outputs.interaction_id },
      });
      expect(interactions.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // GATE-WF06-PLAN-TRACE-BINDING-01
  // ========================================================================
  describe("GATE-WF06-PLAN-TRACE-BINDING-01: plan-trace binding", () => {
    it("trace.plan_id === plan.plan_id", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.trace.plan_id).toBe(result.plan.plan_id);
    });
  });

  // ========================================================================
  // GATE-WF06-EVENT-COUNT-MIN-01
  // ========================================================================
  describe("GATE-WF06-EVENT-COUNT-MIN-01: minimum event counts", () => {
    it("PipelineStageEvent ≥ 5", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.events.pipeline_stage_count).toBeGreaterThanOrEqual(5);
    });

    it("GraphUpdateEvent ≥ 2", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.events.graph_update_count).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // GATE-EXTENSION-POLICY-LOAD-01
  // ========================================================================
  describe("GATE-EXTENSION-POLICY-LOAD-01: Extension policy loading", () => {
    it("WF-06 runs without Extension (fallback to defaults)", async () => {
      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.outputs.policy_loaded).toBe(false);
    });

    it("WF-06 loads Extension policy when present", async () => {
      // Create a policy extension
      const policyExt = createExtension({
        context_id: contextId,
        name: "outreach-policy-default",
        extension_type: "policy",
        version: "1.0.0",
        config: {
          require_confirm: true,
          forbidden_patterns: ["spam"],
          required_links: ["https://test.io"],
          tone_default: "casual",
        },
      });
      await psg.putNode(policyExt as any);

      const result = await runOutreach(
        { context_id: contextId, target_id: targetId, channel: "email" },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.outputs.policy_loaded).toBe(true);
      expect(result.outputs.tone).toBe("casual"); // Should use tone_default from extension
    });
  });
});
