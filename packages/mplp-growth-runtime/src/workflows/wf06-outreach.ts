/**
 * WF-06: Outreach Pack Workflow
 *
 * Input: context_id, target_id, channel, goal?, tone?
 * Output: Plan (pending Confirm) + Trace + ContentAsset(outreach_email) + Interaction stub
 *
 * Pipeline stages (5):
 * 1. load_context_and_target: Read Context.root + OutreachTarget
 * 2. draft_outreach_asset: Create ContentAsset(outreach_email)
 * 3. policy_check: Scan draft against forbidden_terms + Extension policy
 * 4. confirm_outreach_plan: Create Plan + Confirm(target_type='plan') — NOT auto-approved
 * 5. record_interaction_stub: Create Interaction(pending) + OutreachTarget.status→drafted
 *
 * Key: Confirm stays 'pending' — user must call /approve to proceed.
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter";
import type { ProjectSemanticGraph } from "../psg/types";
import type { ValueStateLayer } from "../vsl/types";
import { executor } from "../agents/executor.js";
import {
  createPlan,
  createTrace,
  createConfirm,
  type Plan,
  type Trace,
  type Confirm,
  type Context,
  type Extension,
} from "../modules/mplp-modules";
import {
  createContentAsset,
  createInteraction,
  type OutreachTargetNode,
  type ContentAssetNode,
  type InteractionNode,
} from "../psg/growth-nodes";
import { type OutreachInput, type WorkflowRunResult, createStep, generateRunId } from "./types";

interface OutreachContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
}

/**
 * WF-06 Outreach Pack Workflow
 */
export async function runOutreach(
  input: OutreachInput,
  ctx: OutreachContext,
): Promise<WorkflowRunResult> {
  const run_id = generateRunId();
  const { psg, vsl, eventEmitter } = ctx;

  let pipelineStageCount = 0;
  let graphUpdateCount = 0;
  let runtimeExecutionCount = 0;

  /** Helper to emit stage event */
  async function emitStage(
    stageId: string,
    stageName: string,
    status: "running" | "completed" | "failed",
    stageOrder: number,
  ) {
    const event = eventEmitter.createPipelineStageEvent(
      `wf06_${stageId}_${status}`,
      run_id,
      stageId,
      status,
      stageName,
      stageOrder,
    );
    eventEmitter.emit(event);
    await vsl.appendEvent(event);
    if (status === "completed") {
      pipelineStageCount++;
    }
  }

  try {
    // ========================================================================
    // Stage 1: load_context_and_target
    // ========================================================================
    const stage1Id = uuidv4();
    await emitStage(stage1Id, "load_context_and_target", "running", 0);

    // Load context
    const contexts = await psg.query<any>({
      type: "Context",
      filter: { context_id: input.context_id },
    });

    if (contexts.length === 0) {
      throw new Error(`Context not found: ${input.context_id}`);
    }
    const context = contexts[0] as Context;
    const brand = context.root.brand;
    const audiences = context.root.audiences || [];

    if (!brand) {
      throw new Error("Context has no brand defined");
    }

    // Load outreach target
    const targets = await psg.query<OutreachTargetNode>({
      type: "domain:OutreachTarget",
      filter: { id: input.target_id },
    });

    if (targets.length === 0) {
      throw new Error(`OutreachTarget not found: ${input.target_id}`);
    }
    const target = targets[0];

    // Load policy extension (optional)
    const policyExtensions = await psg.query<any>({
      type: "Extension",
      context_id: input.context_id,
      filter: { extension_type: "policy", name: "outreach-policy-default" },
    });
    const policy = policyExtensions.length > 0 ? (policyExtensions[0] as Extension) : null;
    const policyConfig = policy?.config as Record<string, unknown> | null;

    await emitStage(stage1Id, "load_context_and_target", "completed", 0);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 2: draft_outreach_asset
    // ========================================================================
    const stage2Id = uuidv4();
    await emitStage(stage2Id, "draft_outreach_asset", "running", 1);

    const tone = input.tone || (policyConfig?.tone_default as string) || "professional";
    const goal = input.goal || `Introduce ${brand.name} and explore partnership opportunities`;

    // Generate outreach content based on channel using BDWriter
    const draft = await executor.run("BDWriter", {
      kind: "outreach_draft",
      target,
      channel: input.channel,
      goal,
      brand,
      policy: policyConfig,
    });

    const draftContent = draft.content;

    // Create ContentAsset for the outreach
    const asset: ContentAssetNode = createContentAsset({
      context_id: input.context_id,
      asset_type: "outreach_email",
      title: `Outreach to ${target.name} via ${input.channel}`,
      content: draftContent,
      metadata: {
        target_id: input.target_id,
        channel: input.channel,
        workflow: "wf06-outreach",
        generated_at: new Date().toISOString(),
        drafted_by_role: "BDWriter",
        rationale_bullets: draft.rationale_bullets,
      },
    });
    asset.status = "reviewed"; // Draft complete, awaiting confirm
    await psg.putNode(asset);
    graphUpdateCount++;

    await emitStage(stage2Id, "draft_outreach_asset", "completed", 1);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 3: policy_check
    // ========================================================================
    const stage3Id = uuidv4();
    await emitStage(stage3Id, "policy_check", "running", 2);

    // Collect forbidden terms from brand + extension policy
    const forbiddenTerms = [...(brand.forbidden_terms || [])];
    if (policyConfig?.forbidden_patterns) {
      const policyPatterns = policyConfig.forbidden_patterns as string[];
      for (const p of policyPatterns) {
        if (!forbiddenTerms.includes(p)) {
          forbiddenTerms.push(p);
        }
      }
    }

    // GATE-WF06-FORBIDDEN-TERMS-01: scan content
    const violations: string[] = [];
    const contentLower = draftContent.toLowerCase();
    for (const term of forbiddenTerms) {
      if (contentLower.includes(term.toLowerCase())) {
        violations.push(term);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Policy violation: outreach content contains forbidden terms: [${violations.join(", ")}] (GATE-WF06-FORBIDDEN-TERMS-01)`,
      );
    }

    await emitStage(stage3Id, "policy_check", "completed", 2);
    runtimeExecutionCount++;

    // ========================================================================
    // DRY-RUN EXIT: return draft + policy result without state writes
    // ========================================================================
    if (input.dry_run) {
      return {
        run_id,
        workflow_id: "WF-06",
        success: true,
        plan: null as any,
        trace: null as any,
        outputs: {
          target_id: input.target_id,
          target_name: target.name,
          channel: input.channel,
          asset_id: asset.id,
          draft_content: draftContent,
          goal,
          tone,
          policy_loaded: !!policy,
          dry_run: true,
        },
        events: {
          pipeline_stage_count: pipelineStageCount,
          graph_update_count: graphUpdateCount,
          runtime_execution_count: runtimeExecutionCount,
        },
      };
    }

    // ========================================================================
    // Stage 4: confirm_outreach_plan
    // ========================================================================
    const stage4Id = uuidv4();
    await emitStage(stage4Id, "confirm_outreach_plan", "running", 3);

    // Create Plan
    const plan: Plan = createPlan({
      context_id: input.context_id,
      title: `Outreach — ${target.name} via ${input.channel}`,
      objective: goal,
      agent_role: "BDWriter",
      steps: [
        createStep("Load context and outreach target", "create", input.target_id),
        createStep(`Draft ${input.channel} outreach to ${target.name}`, "create", asset.id),
        createStep("Policy compliance check", "update", asset.id),
        createStep("Await confirmation", "update", asset.id),
        createStep("Record interaction evidence", "create", input.target_id),
      ],
    });
    plan.steps[0].status = "completed";
    plan.steps[1].status = "completed";
    plan.steps[2].status = "completed";
    plan.steps[3].status = "pending"; // Awaiting /approve
    plan.steps[4].status = "pending";
    plan.status = "in_progress";
    await psg.putNode(plan as any);
    graphUpdateCount++;

    // Create Trace
    const trace: Trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: `WF-06 Outreach — ${target.name}`,
    });
    trace.status = "running";
    await psg.putNode(trace as any);
    graphUpdateCount++;

    // Create Confirm — NOT auto-approved (high-risk gate)
    const confirm: Confirm = createConfirm({
      target_type: "plan",
      target_id: plan.plan_id,
      requested_by_role: "growth-copilot",
    });
    // confirm.status defaults to 'pending', decisions is empty/undefined
    await psg.putNode(confirm as any);
    graphUpdateCount++;

    await emitStage(stage4Id, "confirm_outreach_plan", "completed", 3);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 5: record_interaction_stub
    // ========================================================================
    const stage5Id = uuidv4();
    await emitStage(stage5Id, "record_interaction_stub", "running", 4);

    // Create Interaction stub (pending — will move to responded after /approve)
    const interaction: InteractionNode = createInteraction({
      context_id: input.context_id,
      platform: input.channel,
      content: `Outreach to ${target.name}: ${goal}`,
      author: brand.name,
    });
    // Link to asset in response field (draft is ready)
    interaction.response = `[Draft asset: ${asset.id}]`;
    await psg.putNode(interaction);
    graphUpdateCount++;

    // Update OutreachTarget status: research → drafted
    if (target.status === "research") {
      target.status = "drafted";
      target.last_contact_at = new Date().toISOString();
      await psg.putNode(target);
      graphUpdateCount++;
    }

    await emitStage(stage5Id, "record_interaction_stub", "completed", 4);
    runtimeExecutionCount++;

    return {
      run_id,
      workflow_id: "WF-06",
      success: true,
      plan,
      trace,
      confirm,
      outputs: {
        target_id: input.target_id,
        target_name: target.name,
        channel: input.channel,
        asset_id: asset.id,
        interaction_id: interaction.id,
        confirm_id: confirm.confirm_id,
        confirm_status: confirm.status, // 'pending'
        goal,
        tone,
        policy_loaded: !!policy,
      },
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: runtimeExecutionCount,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      run_id,
      workflow_id: "WF-06",
      success: false,
      plan: null as any,
      trace: null as any,
      outputs: {},
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: runtimeExecutionCount,
      },
      error: errorMsg,
    };
  }
}

// ============================================================================
// Outreach Draft Generator
// ============================================================================

function generateOutreachDraft(
  brand: NonNullable<Context["root"]["brand"]>,
  audiences: Context["root"]["audiences"],
  target: OutreachTargetNode,
  channel: string,
  goal: string,
  tone: string,
): string {
  const audienceDesc = audiences?.[0]?.segment || "technology professionals";
  const valueProps = audiences?.[0]?.value_proposition || brand.tagline;

  if (channel === "email") {
    return [
      `Subject: Exploring Collaboration — ${brand.name} × ${target.name}`,
      "",
      `Dear ${target.contact || target.name} Team,`,
      "",
      `I'm reaching out from the ${brand.name} project — ${brand.tagline}.`,
      "",
      `${goal}.`,
      "",
      `We believe ${target.name}, as a leading ${target.org_type} organization, shares our commitment to ${valueProps}.`,
      "",
      `I'd welcome the opportunity to discuss how ${brand.name} could complement ${target.name}'s work in serving ${audienceDesc}.`,
      "",
      `Best regards,`,
      `${brand.name} Project`,
      brand.links?.website || "",
    ].join("\n");
  }

  if (channel === "linkedin") {
    return [
      `Hi ${target.contact || target.name} Team —`,
      "",
      `${brand.name}: ${brand.tagline}`,
      "",
      `${goal}. Would love to connect and explore synergies between ${brand.name} and ${target.name}.`,
      "",
      `${valueProps}`,
      "",
      brand.links?.website || "",
    ].join("\n");
  }

  // Default: x / other
  return [
    `Reaching out to @${target.name.replace(/\s+/g, "")} — `,
    `${brand.name} is ${brand.tagline}.`,
    "",
    `${goal}. Let's connect!`,
    "",
    brand.links?.website || "",
  ].join("\n");
}
