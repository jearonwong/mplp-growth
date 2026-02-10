/**
 * WF-01: Weekly Brief Workflow
 *
 * Input: context_id, week_start?
 * Output: Plan (weekly) + Trace + Confirm (plan approval) + placeholder asset UUIDs
 *
 * Steps:
 * 1. load_context: Load cadence, brand, audiences, channels
 * 2. analyze_cadence: Determine weekly rhythm and themes
 * 3. select_theme: Choose this week's main theme
 * 4. draft_assets: Plan placeholder ContentAsset IDs
 * 5. schedule_publish: Set publish schedule
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter";
import type { ChannelProfileNode } from "../psg/growth-nodes";
import type { ProjectSemanticGraph } from "../psg/types";
import type { ValueStateLayer } from "../vsl/types";
import {
  createPlan,
  createTrace,
  createConfirm,
  type Plan,
  type Trace,
  type Confirm,
  type Context,
} from "../modules/mplp-modules";
import { type WeeklyBriefInput, type WorkflowRunResult, createStep, generateRunId } from "./types";

interface WeeklyBriefContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
}

/**
 * WF-01 Weekly Brief Workflow
 */
export async function runWeeklyBrief(
  input: WeeklyBriefInput,
  ctx: WeeklyBriefContext,
): Promise<WorkflowRunResult> {
  const run_id = generateRunId();
  const { psg, vsl, eventEmitter } = ctx;

  let pipelineStageCount = 0;
  let graphUpdateCount = 0;

  // Track graph updates
  eventEmitter.on("graph_update", () => {
    graphUpdateCount++;
  });

  // Helper to emit stage event
  const emitStage = async (
    stageId: string,
    stageName: string,
    status: "running" | "completed" | "failed",
    stageOrder: number,
  ) => {
    const event = eventEmitter.createPipelineStageEvent(
      `wf01_${stageId}_${status}`,
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
  };

  try {
    // Determine week
    const weekStart = input.week_start ? new Date(input.week_start) : getMonday(new Date());
    const weekStr = weekStart.toISOString().slice(0, 10);

    // ========================================================================
    // Stage 1: load_context
    // ========================================================================
    await emitStage("load_context", "Load Context", "running", 0);

    const contexts = await psg.query<Context>({
      type: "Context",
      filter: { context_id: input.context_id },
    });

    if (contexts.length === 0) {
      throw new Error(`Context not found: ${input.context_id}`);
    }
    const context = contexts[0];

    const brand = context.root.brand;
    const audiences = context.root.audiences || [];
    const cadence = (context.root as any).cadence;

    if (!brand || !cadence) {
      throw new Error("Context missing brand or cadence configuration");
    }

    // Load active channels
    const channels = await psg.query<ChannelProfileNode>({
      type: "domain:ChannelProfile",
      context_id: input.context_id,
      filter: { status: "active" },
    });

    await emitStage("load_context", "Load Context", "completed", 0);

    // ========================================================================
    // Stage 2: analyze_cadence
    // ========================================================================
    await emitStage("analyze_cadence", "Analyze Cadence", "running", 1);

    // Extract publish cadence
    const publishCadence = cadence.publish_cadence || {};
    const weeklyRhythm = cadence.weekly_rhythm || {};

    // Determine content targets for the week
    const weeklyTargets: Array<{ channel: string; count: number; type: string }> = [];
    for (const [channel, schedule] of Object.entries(publishCadence)) {
      const match = (schedule as string).match(/(\d+)/);
      const count = match ? parseInt(match[1], 10) : 1;
      weeklyTargets.push({
        channel,
        count,
        type: channel === "medium" ? "article" : channel === "youtube" ? "video_script" : "thread",
      });
    }

    await emitStage("analyze_cadence", "Analyze Cadence", "completed", 1);

    // ========================================================================
    // Stage 3: select_theme
    // ========================================================================
    await emitStage("select_theme", "Select Theme", "running", 2);

    // Simple theme selection based on rotation
    const themes = [
      `${brand.name} for ${audiences[0]?.segment || "developers"}`,
      `Why ${brand.tagline}`,
      "Technical deep-dive: Observable governance",
      "Case study: Evidence-first validation",
      `Getting started with ${brand.name}`,
    ];
    const weekNum = Math.floor(weekStart.getTime() / (7 * 24 * 60 * 60 * 1000));
    const selectedTheme = themes[weekNum % themes.length];

    await emitStage("select_theme", "Select Theme", "completed", 2);

    // ========================================================================
    // Stage 4: draft_assets (placeholder UUIDs)
    // ========================================================================
    await emitStage("draft_assets", "Draft Assets", "running", 3);

    // Generate placeholder asset UUIDs for the week
    const plannedAssets: Array<{
      id: string;
      type: string;
      channel: string;
      planned_day: string;
    }> = [];

    for (const target of weeklyTargets) {
      for (let i = 0; i < target.count; i++) {
        plannedAssets.push({
          id: uuidv4(),
          type: target.type,
          channel: target.channel,
          planned_day: getDayOfWeek(weekStart, target.channel === "x_twitter" ? 2 : 3 + i),
        });
      }
    }

    // Create Plan with all steps
    const plan = createPlan({
      context_id: input.context_id,
      title: `Weekly Brief — ${weekStr}`,
      objective: `Plan content for week of ${weekStr}. Theme: ${selectedTheme}`,
      steps: [
        createStep("Load cadence and brand context", "create", input.context_id),
        createStep("Analyze weekly rhythm and publish schedule", "create", input.context_id),
        createStep(`Select theme: ${selectedTheme}`, "create", input.context_id),
        ...plannedAssets.map((asset, i) =>
          createStep(
            `Draft ${asset.type} for ${asset.channel} (${asset.planned_day})`,
            "create",
            asset.id,
          ),
        ),
        createStep("Schedule publish sequence", "update", input.context_id),
      ],
    });
    plan.status = "in_progress";
    await psg.putNode(plan as any);

    await emitStage("draft_assets", "Draft Assets", "completed", 3);

    // ========================================================================
    // Stage 5: confirm & persist
    // ========================================================================
    await emitStage("confirm_plan", "Confirm Plan", "running", 4);

    // Create Confirm for plan approval (target_type=plan for MPLP modules)
    const confirm = createConfirm({
      target_type: "plan",
      target_id: plan.plan_id,
      requested_by_role: "growth-copilot",
    });
    await psg.putNode(confirm as any);

    // Create Trace with plan_id binding
    const trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: `wf01-weekly-brief-${run_id}`,
    });
    trace.status = "running";
    await psg.putNode(trace as any);

    // For MVP: auto-approve plan
    const approvedConfirm: Confirm = {
      ...confirm,
      status: "approved",
      decisions: [
        {
          decision_id: uuidv4(),
          status: "approved",
          decided_by_role: "growth-copilot",
          decided_at: new Date().toISOString(),
          reason: "Weekly brief auto-approved",
        },
      ],
    };
    await psg.putNode(approvedConfirm as any);

    // Complete Plan
    plan.status = "completed";
    await psg.putNode(plan as any);

    // Complete Trace
    trace.status = "completed";
    trace.finished_at = new Date().toISOString();
    if (trace.root_span) {
      trace.root_span.finished_at = trace.finished_at;
    }
    await psg.putNode(trace as any);

    await emitStage("confirm_plan", "Confirm Plan", "completed", 4);

    return {
      run_id,
      workflow_id: "WF-01",
      success: true,
      plan,
      trace,
      confirm: approvedConfirm,
      outputs: {
        week: weekStr,
        theme: selectedTheme,
        planned_assets: plannedAssets,
        channels: channels.map((c) => c.platform),
        weekly_rhythm: weeklyRhythm,
      },
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      run_id,
      workflow_id: "WF-01",
      success: false,
      plan: null as any,
      trace: null as any,
      outputs: {},
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0,
      },
      error: errorMsg,
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

/** Get day name for offset from week start */
function getDayOfWeek(weekStart: Date, offset: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset);
  return days[d.getDay()];
}

export { WeeklyBriefInput };
