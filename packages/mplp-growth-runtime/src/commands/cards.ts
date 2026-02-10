/**
 * MPLP Growth Copilot - Command Output Cards
 *
 * Standard output format for OpenClaw integration:
 * - Plan Summary
 * - Confirm (if any)
 * - Next Actions
 * - Trace Reference
 */

import type { WorkflowRunResult } from "../workflows/types";

export interface CommandCard {
  emoji: string;
  title: string;
  summary: string;
  planId?: string;
  traceId?: string;
  confirmId?: string;
  assetId?: string;
  exportPath?: string;
  nextActions: string[];
  metadata: Record<string, unknown>;
}

/**
 * Format WF-01 Weekly Brief output
 */
export function formatBriefCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;

  return {
    emoji: "📅",
    title: "Weekly Brief",
    summary: `Theme: ${outputs.theme}\nWeek: ${outputs.week}`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    nextActions: [
      "`/create thread` — Generate a thread",
      "`/create article` — Generate an article",
    ],
    metadata: {
      planned_assets: outputs.planned_assets,
      channels: outputs.channels,
      run_id: result.run_id,
    },
  };
}

/**
 * Format WF-02 Content Factory output
 */
export function formatCreateCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;

  return {
    emoji: "✍️",
    title: `Content Created: ${outputs.asset_type}`,
    summary: `Asset: ${outputs.title}\nStatus: reviewed\nVariants: ${(outputs.variants as string[])?.join(", ")}`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    confirmId: result.confirm?.confirm_id,
    assetId: outputs.asset_id as string,
    nextActions: [
      `\`/publish ${outputs.asset_id} x\` — Publish to X`,
      `\`/publish ${outputs.asset_id} linkedin\` — Publish to LinkedIn`,
    ],
    metadata: {
      asset_type: outputs.asset_type,
      content_preview: outputs.content_preview,
      run_id: result.run_id,
    },
  };
}

/**
 * Format WF-03 Publish Pack output
 */
export function formatPublishCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;

  return {
    emoji: "🚀",
    title: `Published to ${outputs.channel}`,
    summary: `Asset: ${outputs.asset_id}\nStatus: published\nExport: ${outputs.export_path}`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    confirmId: result.confirm?.confirm_id,
    assetId: outputs.asset_id as string,
    exportPath: outputs.export_path as string,
    nextActions: [
      `Open \`${outputs.export_path}\` and copy content`,
      "Paste into platform and publish",
    ],
    metadata: {
      channel: outputs.channel,
      run_id: result.run_id,
    },
  };
}

/**
 * Format WF-04 Inbox Handler output
 */
export function formatInboxCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;
  const interactionIds = (outputs.interaction_ids as string[]) || [];

  return {
    emoji: "📥",
    title: `Inbox: ${outputs.draft_count} interactions processed`,
    summary: `Interactions: ${interactionIds.length}\nDraft replies: ${outputs.draft_count}\nStatus: awaiting confirmation`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    confirmId: result.confirm?.confirm_id,
    nextActions: [
      "Review draft replies and approve Confirm",
      "`/review` — Generate weekly retrospective",
    ],
    metadata: {
      interaction_ids: interactionIds,
      draft_count: outputs.draft_count,
      run_id: result.run_id,
    },
  };
}

/**
 * Format WF-05 Weekly Review output
 */
export function formatReviewCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;
  const metrics = outputs.metrics as Record<string, number> | undefined;
  const suggestions = (outputs.suggestions as string[]) || [];

  const metricsSummary = metrics
    ? `Published: ${metrics.assets_published} | Interactions: ${metrics.interactions_responded}/${metrics.interactions_total} | Plans: ${metrics.plans_created}`
    : "No metrics available";

  return {
    emoji: "📊",
    title: `Weekly Review — ${outputs.week_start}`,
    summary: `${metricsSummary}\nSnapshot: ${outputs.snapshot_id}\nSuggestions: ${suggestions.length}`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    assetId: outputs.review_asset_id as string,
    nextActions: [...suggestions.map((s) => `💡 ${s}`), "`/brief` — Start next week planning"],
    metadata: {
      snapshot_id: outputs.snapshot_id,
      review_asset_id: outputs.review_asset_id,
      metrics,
      run_id: result.run_id,
    },
  };
}

/**
 * Format WF-06 Outreach output
 */
export function formatOutreachCard(result: WorkflowRunResult): CommandCard {
  const outputs = result.outputs as Record<string, unknown>;

  return {
    emoji: "📨",
    title: `Outreach — ${outputs.target_name} via ${outputs.channel}`,
    summary: `Target: ${outputs.target_name}\nChannel: ${outputs.channel}\nGoal: ${outputs.goal}\n⏳ Confirm: PENDING`,
    planId: result.plan?.plan_id,
    traceId: result.trace?.trace_id,
    confirmId: result.confirm?.confirm_id,
    assetId: outputs.asset_id as string,
    nextActions: [
      `\`/approve ${result.confirm?.confirm_id}\` — Approve outreach`,
      "`/review` — Check weekly metrics",
    ],
    metadata: {
      target_id: outputs.target_id,
      asset_id: outputs.asset_id,
      interaction_id: outputs.interaction_id,
      confirm_status: outputs.confirm_status,
      policy_loaded: outputs.policy_loaded,
      run_id: result.run_id,
    },
  };
}

/**
 * Format /approve output
 */
export function formatApproveCard(result: {
  confirm_id: string;
  status: string;
  target_name?: string;
  interaction_status?: string;
  target_status?: string;
}): CommandCard {
  return {
    emoji: "✅",
    title: `Approved — ${result.confirm_id.slice(0, 8)}...`,
    summary: `Confirm: ${result.status}\nTarget: ${result.target_name || "N/A"} → ${result.target_status || "contacted"}\nInteraction: → ${result.interaction_status || "responded"}`,
    confirmId: result.confirm_id,
    nextActions: [
      "`/review` — Check updated metrics",
      "`/outreach <target_id> <channel>` — Reach another target",
    ],
    metadata: result,
  };
}

/**
 * Format error output
 */
export function formatErrorCard(workflow: string, error: string): CommandCard {
  return {
    emoji: "❌",
    title: `${workflow} Failed`,
    summary: `Error: ${error}`,
    nextActions: ["Check the error message", "Run `/brief` to verify context exists"],
    metadata: {},
  };
}

/**
 * Render card to markdown (for OpenClaw output)
 */
export function renderCardToMarkdown(card: CommandCard): string {
  const lines: string[] = [];

  lines.push(`## ${card.emoji} ${card.title}`);
  lines.push("");
  lines.push(card.summary);
  lines.push("");

  if (card.assetId) {
    lines.push(`**Asset ID**: \`${card.assetId}\``);
  }
  if (card.exportPath) {
    lines.push(`**Export**: \`${card.exportPath}\``);
  }
  if (card.planId) {
    lines.push(`**Plan**: \`${card.planId.slice(0, 8)}...\``);
  }
  if (card.traceId) {
    lines.push(`**Trace**: \`${card.traceId.slice(0, 8)}...\``);
  }

  if (card.nextActions.length > 0) {
    lines.push("");
    lines.push("**Next Actions**:");
    for (const action of card.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join("\n");
}
