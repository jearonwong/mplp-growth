/**
 * WF-04: Inbox Handler Workflow
 *
 * Input: context_id, interactions[]
 * Output: Plan + Trace + Confirm(target_type='plan') + InteractionNodes with draft replies
 *
 * Stages:
 * 1. ingest_interactions: Create InteractionNode for each input (status: pending)
 * 2. generate_drafts: Generate draft reply for each interaction
 * 3. confirm_responses: Create Confirm for batch approval (target_type='plan')
 *
 * On confirm approval: batch transition pending→responded with responded_at
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter";
import type { ProjectSemanticGraph, PSGNode } from "../psg/types";
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
} from "../modules/mplp-modules";
import { createInteraction, type InteractionNode } from "../psg/growth-nodes";
import { type InboxHandlerInput, type WorkflowRunResult, createStep, generateRunId } from "./types";

interface InboxHandlerContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
}

/**
 * WF-04 Inbox Handler Workflow
 */
export async function runInboxHandler(
  input: InboxHandlerInput,
  ctx: InboxHandlerContext,
): Promise<WorkflowRunResult> {
  const run_id = generateRunId();
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
    const event = ctx.eventEmitter.createPipelineStageEvent(
      `wf04_${stageId}_${status}`,
      run_id,
      stageId,
      status,
      stageName,
      stageOrder,
    );
    ctx.eventEmitter.emit(event);
    await ctx.vsl.appendEvent(event);
    if (status === "completed") {
      pipelineStageCount++;
    }
  }

  try {
    // Validate input
    if (!input.interactions || input.interactions.length === 0) {
      throw new Error("WF-04: interactions must contain at least 1 interaction");
    }

    // ========================================================================
    // Stage 1: ingest_interactions
    // ========================================================================
    const stage1Id = uuidv4();
    await emitStage(stage1Id, "ingest_interactions", "running", 0);

    const interactionNodes: InteractionNode[] = [];

    for (const interactionInput of input.interactions) {
      // FIX-A-2: Primary dedup — skip if source_ref already exists in PSG
      if (interactionInput.source_ref) {
        const existing = await ctx.psg.query<InteractionNode>({
          type: "domain:Interaction",
          filter: { source_ref: interactionInput.source_ref },
        });
        if (existing.length > 0) {
          continue; // Already ingested, skip
        }
      }

      const node = createInteraction({
        context_id: input.context_id,
        platform: interactionInput.platform,
        content: interactionInput.content,
        author: interactionInput.author,
        source_ref: interactionInput.source_ref,
      });
      await ctx.psg.putNode(node);
      interactionNodes.push(node);
      graphUpdateCount++;
    }

    await emitStage(stage1Id, "ingest_interactions", "completed", 0);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 2: generate_drafts
    // ========================================================================
    const stage2Id = uuidv4();
    await emitStage(stage2Id, "generate_drafts", "running", 1);

    // Generate draft replies for each interaction
    for (const node of interactionNodes) {
      const draft = await executor.run("Responder", {
        kind: "inbox_reply",
        interaction: {
          platform: node.platform,
          author: node.author || "Unknown",
          content: node.content,
        },
      });

      node.response = draft.content;
      // Add agent metadata
      node.metadata = node.metadata || {};
      node.metadata.drafted_by_role = "Responder";
      node.metadata.rationale_bullets = draft.rationale_bullets;

      // Status stays 'pending' until confirmed
      await ctx.psg.putNode(node);
      graphUpdateCount++;
    }

    await emitStage(stage2Id, "generate_drafts", "completed", 1);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 3: confirm_responses
    // ========================================================================
    const stage3Id = uuidv4();
    await emitStage(stage3Id, "confirm_responses", "running", 2);

    // Create Plan for this inbox run
    const plan: Plan = createPlan({
      context_id: input.context_id,
      title: `Inbox Handler — ${interactionNodes.length} interactions`,
      objective: `Process ${interactionNodes.length} incoming interactions, generate draft replies, and await confirmation`,
      agent_role: "Responder",
      steps: [
        createStep("Ingest interactions into PSG", "create", "Responder"),
        createStep("Generate draft replies", "update", "Responder"),
        createStep("Confirm batch response", "update", "Responder"),
      ],
    });

    // Mark steps as completed
    plan.steps[0].status = "completed";
    plan.steps[1].status = "completed";
    plan.steps[2].status = "pending"; // Awaiting confirmation

    await ctx.psg.putNode(plan as unknown as PSGNode);
    graphUpdateCount++;

    // Create Trace
    const trace: Trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: "WF-04 Inbox Handler",
    });
    trace.status = "running";
    await ctx.psg.putNode(trace as unknown as PSGNode);
    graphUpdateCount++;

    // Create Confirm — target_type='plan' per SSOT (FIX-1)
    const confirm: Confirm = createConfirm({
      target_type: "plan",
      target_id: plan.plan_id,
      requested_by_role: "growth-copilot",
    });
    await ctx.psg.putNode(confirm as unknown as PSGNode);
    graphUpdateCount++;

    await emitStage(stage3Id, "confirm_responses", "completed", 2);
    runtimeExecutionCount++;

    return {
      run_id,
      workflow_id: "WF-04",
      success: true,
      plan,
      trace,
      confirm,
      outputs: {
        plan_id: plan.plan_id,
        trace_id: trace.trace_id,
        confirm_id: confirm.confirm_id,
        interaction_ids: interactionNodes.map((n) => n.id),
        draft_count: interactionNodes.length,
      },
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: runtimeExecutionCount,
      },
    };
  } catch (error) {
    return {
      run_id,
      workflow_id: "WF-04",
      success: false,
      plan: {} as Plan,
      trace: {} as Trace,
      outputs: {},
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: runtimeExecutionCount,
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Transition an Interaction from pending→responded
 * Used after Confirm approval
 */
export function transitionInteraction(
  node: InteractionNode,
  targetStatus: "responded" | "archived",
): InteractionNode {
  const validTransitions: Record<string, string[]> = {
    pending: ["responded"],
    responded: ["archived"],
    archived: [],
  };

  const allowed = validTransitions[node.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid Interaction transition: ${node.status} → ${targetStatus}. ` +
        `Allowed: ${allowed.join(", ") || "none"}`,
    );
  }

  return {
    ...node,
    status: targetStatus,
    responded_at: targetStatus === "responded" ? new Date().toISOString() : node.responded_at,
  };
}

export { InboxHandlerInput };
