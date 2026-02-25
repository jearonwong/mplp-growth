/**
 * Common workflow types and utilities
 */

import { v4 as uuidv4 } from "uuid";
import type { AgentRole } from "../agents/roles";
import type { Plan, Trace, Confirm, Context, PlanStep } from "../modules/mplp-modules";
import type { ContentAssetNode, ChannelProfileNode } from "../psg/growth-nodes";

/** Workflow run result */
export interface WorkflowRunResult {
  run_id: string;
  workflow_id: string;
  success: boolean;
  plan: Plan;
  trace: Trace;
  confirm?: Confirm;
  outputs: Record<string, unknown>;
  events: {
    pipeline_stage_count: number;
    graph_update_count: number;
    runtime_execution_count: number;
  };
  error?: string;
}

/** Workflow input base */
export interface WorkflowInput {
  context_id: string;
  role_id?: AgentRole;
}

/** WF-03 Publish Pack Input */
export interface PublishPackInput extends WorkflowInput {
  asset_id: string;
  channel: ChannelProfileNode["platform"];
}

/** WF-02 Content Factory Input */
export interface ContentFactoryInput extends WorkflowInput {
  asset_type: ContentAssetNode["asset_type"];
  audience?: "developers" | "enterprise" | "standards";
  channels?: ChannelProfileNode["platform"][];
  topic?: string;
}

/** WF-01 Weekly Brief Input */
export interface WeeklyBriefInput extends WorkflowInput {
  week_start?: string; // ISO date, defaults to current week
}

/** WF-04 Inbox Handler Input */
export interface InboxInteractionInput {
  platform: string;
  content: string;
  author?: string;
  source_ref?: string;
}

export interface InboxHandlerInput extends WorkflowInput {
  interactions: InboxInteractionInput[];
}

/** WF-05 Weekly Review Input */
export interface WeeklyReviewInput extends WorkflowInput {
  week_start?: string; // ISO date, defaults to current week Monday
  since_last?: boolean; // v0.3.0: diff vs previous MetricSnapshot
}

/** WF-06 Outreach Input */
export interface OutreachInput extends WorkflowInput {
  target_id: string;
  channel: "email" | "linkedin" | "x";
  goal?: string;
  tone?: string;
  dry_run?: boolean; // v0.3.0: draft + policy check only, no Confirm/Interaction writes
}

/** Create workflow step with auto-generated step_id */
export function createStep(
  description: string,
  action: PlanStep["action"],
  target_node_id?: string,
  extra?: Partial<PlanStep>,
): Omit<PlanStep, "step_id" | "order_index"> {
  return {
    description,
    status: "pending",
    action,
    target_node_id,
    ...extra,
  };
}

/** Generate run ID */
export function generateRunId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `run-${dateStr}-${timeStr}-${uuidv4().slice(0, 8)}`;
}
