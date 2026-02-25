/**
 * WF-05: Weekly Review Workflow
 *
 * Input: context_id, week_start?
 * Output: Plan + Trace + immutable MetricSnapshot + review memo ContentAsset
 *
 * Stages:
 * 1. collect_metrics: Query PSG for this week's activity
 * 2. generate_snapshot: Create immutable MetricSnapshotNode
 * 3. write_review: Create review memo ContentAsset + suggestions
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter";
import type { ProjectSemanticGraph } from "../psg/types";
import type { ValueStateLayer } from "../vsl/types";
import { executor } from "../agents/executor.js";
import {
  createPlan,
  createConfirm,
  createTrace,
  type Plan,
  type Trace,
  type Context,
  type Confirm,
} from "../modules/mplp-modules";
import {
  createMetricSnapshot,
  createContentAsset,
  type MetricSnapshotNode,
  type ContentAssetNode,
} from "../psg/growth-nodes";
import { type WeeklyReviewInput, type WorkflowRunResult, createStep, generateRunId } from "./types";

interface WeeklyReviewContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
}

/**
 * WF-05 Weekly Review Workflow
 */
export async function runWeeklyReview(
  input: WeeklyReviewInput,
  ctx: WeeklyReviewContext,
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
      `wf05_${stageId}_${status}`,
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
    // Determine week start (default: current week Monday)
    const weekStart = input.week_start || getMonday(new Date()).toISOString().slice(0, 10);

    // ========================================================================
    // Stage 1: collect_metrics
    // ========================================================================
    const stage1Id = uuidv4();
    await emitStage(stage1Id, "collect_metrics", "running", 0);

    // Query PSG for this week's activity
    const plans = await ctx.psg.query<any>({ type: "Plan", context_id: input.context_id });
    const traces = await ctx.psg.query<any>({ type: "Trace", context_id: input.context_id });
    const confirms = await ctx.psg.query<any>({ type: "Confirm" });
    const assets = await ctx.psg.query<ContentAssetNode>({
      type: "domain:ContentAsset",
      context_id: input.context_id,
    });
    const interactions = await ctx.psg.query<any>({
      type: "domain:Interaction",
      context_id: input.context_id,
    });

    // Compute metrics
    const metrics: Record<string, number> = {
      plans_created: plans.length,
      traces_logged: traces.length,
      confirms_total: confirms.length,
      confirms_approved: confirms.filter((c: any) => c.status === "approved").length,
      assets_total: assets.length,
      assets_published: assets.filter((a) => a.status === "published").length,
      assets_draft: assets.filter((a) => a.status === "draft").length,
      interactions_total: interactions.length,
      interactions_responded: interactions.filter((i: any) => i.status === "responded").length,
      interactions_pending: interactions.filter((i: any) => i.status === "pending").length,
    };

    await emitStage(stage1Id, "collect_metrics", "completed", 0);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 2: generate_snapshot
    // ========================================================================
    const stage2Id = uuidv4();
    await emitStage(stage2Id, "generate_snapshot", "running", 1);

    // Create immutable MetricSnapshot
    const snapshot: MetricSnapshotNode = createMetricSnapshot({
      context_id: input.context_id,
      period: "weekly",
      metrics,
    });
    await ctx.psg.putNode(snapshot);
    graphUpdateCount++;

    await emitStage(stage2Id, "generate_snapshot", "completed", 1);
    runtimeExecutionCount++;

    // ========================================================================
    // Stage 2.5: compute delta (v0.3.0 since_last)
    // Read prev FIRST, then diff against just-created current snapshot
    // ========================================================================
    let delta: Record<string, number> | undefined;
    let noPreviousSnapshot = false;
    if (input.since_last) {
      const allSnapshots = await ctx.psg.query<MetricSnapshotNode>({
        type: "domain:MetricSnapshot",
        context_id: input.context_id,
        filter: { period: "weekly" },
      });
      // Sort by snapshot_at descending, skip current (just created)
      const sorted = allSnapshots
        .filter((s) => s.id !== snapshot.id)
        .slice()
        .toSorted((a: MetricSnapshotNode, b: MetricSnapshotNode) =>
          b.snapshot_at.localeCompare(a.snapshot_at),
        );
      if (sorted.length > 0) {
        const prev = sorted[0].metrics;
        delta = {};
        for (const key of Object.keys(metrics)) {
          delta[key] = metrics[key] - (prev[key] || 0);
        }
      } else {
        noPreviousSnapshot = true;
      }
    }

    // ========================================================================
    // Stage 3: write_review
    // ========================================================================
    const stage3Id = uuidv4();
    await emitStage(stage3Id, "write_review", "running", 2);

    // Generate suggestions based on metrics
    const suggestions: string[] = [];
    const actionItems: Array<{
      command: string;
      reason: string;
      priority: number;
      expected_effect: string;
    }> = [];

    if (metrics.assets_published === 0) {
      suggestions.push("No content published this week — consider running /create and /publish");
      actionItems.push({
        command: "/create thread",
        reason: "No content published this week",
        priority: 1,
        expected_effect: "Creates a new draft content asset ready for review",
      });
    }
    if (metrics.interactions_pending > 0) {
      suggestions.push(
        `${metrics.interactions_pending} interactions pending — run /inbox to process`,
      );
      actionItems.push({
        command: "/inbox",
        reason: `${metrics.interactions_pending} interactions pending`,
        priority: 2,
        expected_effect: "Processes pending interactions and generates draft replies",
      });
    }
    if (metrics.assets_draft > 2) {
      suggestions.push(`${metrics.assets_draft} drafts queued — review and publish or archive`);
      actionItems.push({
        command: "/publish --latest x",
        reason: `${metrics.assets_draft} drafts queued`,
        priority: 3,
        expected_effect: "Publishes most recent reviewed asset to X with export pack",
      });
    }
    if (suggestions.length === 0) {
      suggestions.push("Strong execution this week — maintain current cadence");
    }

    // Call Analyst Agent
    const draft = await executor.run("Analyst", {
      kind: "weekly_review",
      metrics,
      previous_snapshot: delta ? "exists" : undefined,
    });

    // Create review memo as ContentAsset
    const reviewLines = [
      `# Weekly Review — ${weekStart}`,
      "",
      draft.content,
      "",
      "## Metrics",
      `- Plans: ${metrics.plans_created}`,
      `- Traces: ${metrics.traces_logged}`,
      `- Assets published: ${metrics.assets_published} / ${metrics.assets_total}`,
      `- Interactions: ${metrics.interactions_responded} responded / ${metrics.interactions_total} total`,
      `- Confirms: ${metrics.confirms_approved} approved / ${metrics.confirms_total} total`,
    ];

    if (delta) {
      reviewLines.push("", "## Delta (vs previous week)");
      for (const [key, val] of Object.entries(delta)) {
        const sign = val >= 0 ? "+" : "";
        reviewLines.push(`- ${key}: ${sign}${val}`);
      }
    }

    reviewLines.push("", "## Suggestions", ...suggestions.map((s) => `- ${s}`));

    if (actionItems.length > 0) {
      reviewLines.push("", "## Action Items");
      for (const item of actionItems) {
        reviewLines.push(`- [P${item.priority}] \`${item.command}\` — ${item.reason}`);
      }
    }

    const reviewContent = reviewLines.join("\n");

    const reviewAsset: ContentAssetNode = createContentAsset({
      context_id: input.context_id,
      asset_type: "article",
      title: `Weekly Review — ${weekStart}`,
      content: reviewContent,
      metadata: {
        drafted_by_role: "Analyst",
        rationale_bullets: draft.rationale_bullets,
      },
    });
    reviewAsset.status = "reviewed"; // Not auto-published
    await ctx.psg.putNode(reviewAsset);
    graphUpdateCount++;

    // Create Plan
    const plan: Plan = createPlan({
      context_id: input.context_id,
      title: `Weekly Review — ${weekStart}`,
      objective: "Collect metrics, generate snapshot, and produce review memo",
      agent_role: "Analyst",
      steps: [
        createStep("Collect metrics from PSG", "create", "Analyst"),
        createStep("Generate immutable MetricSnapshot", "create", "Analyst"),
        createStep("Write review memo", "create", "Analyst"),
      ],
    });
    plan.steps.forEach((s) => (s.status = "completed"));
    plan.status = "approved";
    await ctx.psg.putNode(plan as any);
    graphUpdateCount++;

    // Create Trace
    const trace: Trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: "WF-05 Weekly Review",
    });
    trace.status = "completed";
    trace.root_span.finished_at = new Date().toISOString();
    await ctx.psg.putNode(trace as any);
    graphUpdateCount++;

    await emitStage(stage3Id, "write_review", "completed", 2);
    runtimeExecutionCount++;

    return {
      run_id,
      workflow_id: "WF-05",
      success: true,
      plan,
      trace,
      outputs: {
        snapshot_id: snapshot.id,
        review_asset_id: reviewAsset.id,
        metrics,
        delta,
        no_previous_snapshot: noPreviousSnapshot,
        suggestions,
        action_items: actionItems,
        week_start: weekStart,
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
      workflow_id: "WF-05",
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

/** Get Monday of the week for a given date */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export { WeeklyReviewInput };
