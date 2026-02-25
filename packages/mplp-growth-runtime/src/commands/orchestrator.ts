/**
 * MPLP Growth Copilot - Command Orchestrator
 *
 * Bridges OpenClaw commands to mplp-growth-runtime workflows.
 * Handles:
 * - Runtime initialization
 * - Command parsing
 * - Workflow execution
 * - Output formatting
 */

import os from "node:os";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { Context, Confirm, Plan, PlanStep, Trace } from "../modules/mplp-modules";
import type {
  ChannelProfileNode,
  ContentAssetNode,
  OutreachTargetNode,
  InteractionNode,
} from "../psg/growth-nodes";
import type { PSGNode } from "../psg/types";
import type { OutreachInput } from "../workflows/types";
import { EventEmitter } from "../glue/event-emitter";
import { InMemoryPSG } from "../psg/in-memory-psg";
import { FileVSL } from "../vsl/file-vsl";
import { runWeeklyBrief } from "../workflows/wf01-weekly-brief";
import { runContentFactory, type ContentFactoryInput } from "../workflows/wf02-content-factory";
import { runPublishPack } from "../workflows/wf03-publish-pack";
import { runInboxHandler, type InboxHandlerInput } from "../workflows/wf04-inbox-handler";
import { transitionInteraction } from "../workflows/wf04-inbox-handler";
import { runWeeklyReview } from "../workflows/wf05-weekly-review";
import { runOutreach } from "../workflows/wf06-outreach";
import {
  formatBriefCard,
  formatCreateCard,
  formatPublishCard,
  formatInboxCard,
  formatReviewCard,
  formatOutreachCard,
  formatApproveCard,
  formatApproveListCard,
  formatBatchApproveCard,
  formatBatchOutreachCard,
  formatErrorCard,
  renderCardToMarkdown,
} from "./cards";

/** Command orchestrator state */
interface OrchestratorState {
  vsl: FileVSL;
  psg: InMemoryPSG;
  eventEmitter: EventEmitter;
  contextId: string;
  basePath: string;
}

let state: OrchestratorState | null = null;

/**
 * Initialize the orchestrator
 */
export async function getRuntime(): Promise<OrchestratorState> {
  return init();
}

/**
 * Initialize the orchestrator
 */
async function init(): Promise<OrchestratorState> {
  if (state) {
    return state;
  }

  const basePath =
    process.env.MPLP_GROWTH_STATE_DIR || path.join(os.homedir(), ".openclaw", "mplp-growth");

  const vsl = new FileVSL({ basePath });
  await vsl.init();

  // Load existing context
  const contextKeys = await vsl.listKeys("Context");
  if (contextKeys.length === 0) {
    throw new Error("No context found. Run seed first: npm run seed");
  }

  const context = await vsl.get<Context>(contextKeys[0]);
  if (!context) {
    throw new Error("Failed to load context");
  }

  const contextId = context.context_id;
  const eventEmitter = new EventEmitter(contextId);
  const psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);

  // Load context into PSG
  await psg.putNode(context as unknown as PSGNode);

  // Load channel profiles
  const channelKeys = await vsl.listKeys("domain:ChannelProfile");
  for (const key of channelKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  // Load content assets
  const assetKeys = await vsl.listKeys("domain:ContentAsset");
  for (const key of assetKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  // Load interactions
  const interactionKeys = await vsl.listKeys("domain:Interaction");
  for (const key of interactionKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  // Load outreach targets
  const targetKeys = await vsl.listKeys("domain:OutreachTarget");
  for (const key of targetKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  // Load extensions
  const extensionKeys = await vsl.listKeys("Extension");
  for (const key of extensionKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  // Load confirms (for /approve)
  const confirmKeys = await vsl.listKeys("Confirm");
  for (const key of confirmKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as unknown as PSGNode);
    }
  }

  state = { vsl, psg, eventEmitter, contextId, basePath };
  return state;
}

/**
 * /brief command handler
 */
export async function cmdBrief(): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    const result = await runWeeklyBrief({ context_id: contextId }, { psg, vsl, eventEmitter });

    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard("Weekly Brief", result.error || "Unknown error"));
    }

    return renderCardToMarkdown(formatBriefCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Weekly Brief", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * /create command handler
 * @param args - Command arguments: <type> [audience] [channel] [--template <id>] [--topic <t>]
 */
export async function cmdCreate(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    // Parse --template and --topic flags
    let templateId: string | undefined;
    let topic: string | undefined;
    const positional: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--template" && args[i + 1]) {
        templateId = args[++i];
      } else if (args[i] === "--topic" && args[i + 1]) {
        topic = args[++i];
      } else {
        positional.push(args[i]);
      }
    }

    // Template mode: clone existing template asset
    if (templateId) {
      const templateAsset = await psg.getNode<ContentAssetNode>("domain:ContentAsset", templateId);
      if (!templateAsset) {
        return renderCardToMarkdown(
          formatErrorCard("Content Factory", `Template not found: ${templateId}`),
        );
      }
      if (!templateAsset.is_template) {
        return renderCardToMarkdown(
          formatErrorCard("Content Factory", `Asset ${templateId} is not a template`),
        );
      }

      // Clone template content with placeholder substitution
      let clonedContent = templateAsset.content;
      const clonedTitle = topic
        ? templateAsset.title.replace(/template/i, topic)
        : templateAsset.title;
      if (topic) {
        clonedContent = clonedContent.replace(/\{\{topic\}\}/gi, topic);
      }
      const audience = positional[1] as string | undefined;
      if (audience) {
        clonedContent = clonedContent.replace(/\{\{audience\}\}/gi, audience);
      }

      // Detect unreplaced placeholders and warn
      const unreplaced = clonedContent.match(/\{\{\w+\}\}/g);
      const warnings = unreplaced
        ? `Unreplaced placeholders: ${[...new Set(unreplaced)].join(", ")}`
        : undefined;

      // Clone inherits the REAL asset_type from template
      const { createContentAsset } = await import("../psg/growth-nodes.js");
      const newAsset = createContentAsset({
        context_id: contextId,
        asset_type: templateAsset.asset_type,
        title: clonedTitle,
        content: clonedContent,
      });
      (newAsset as unknown as Record<string, unknown>).template_id = templateId;
      (newAsset as unknown as Record<string, unknown>).is_template = false;
      newAsset.platform_variants = { ...templateAsset.platform_variants };
      await psg.putNode(newAsset);

      return renderCardToMarkdown(
        formatCreateCard({
          run_id: `template-clone-${newAsset.id.slice(0, 8)}`,
          workflow_id: "WF-02",
          success: true,
          plan: {} as unknown as Plan,
          trace: {} as unknown as Trace,
          outputs: {
            asset_id: newAsset.id,
            asset_type: newAsset.asset_type,
            title: newAsset.title,
            content_preview: newAsset.content.slice(0, 100),
            variants: Object.keys(newAsset.platform_variants),
            template_id: templateId,
            warnings,
          },
          events: { pipeline_stage_count: 0, graph_update_count: 1, runtime_execution_count: 0 },
        }),
      );
    }

    // Standard mode
    const assetType = positional[0] as ContentFactoryInput["asset_type"];
    if (!assetType) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Content Factory",
          "Missing asset type. Usage: /create <type> [audience] [channel] [--template <id>]",
        ),
      );
    }

    const validTypes = ["thread", "post", "article", "video_script", "outreach_email"];
    if (!validTypes.includes(assetType)) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Content Factory",
          `Invalid type: ${assetType}. Valid: ${validTypes.join(", ")}`,
        ),
      );
    }

    const audience = positional[1] as ContentFactoryInput["audience"] | undefined;
    const channels = positional[2] ? [positional[2] as ChannelProfileNode["platform"]] : undefined;

    const result = await runContentFactory(
      {
        context_id: contextId,
        asset_type: assetType,
        audience,
        channels,
        topic,
      },
      { psg, vsl, eventEmitter },
    );

    if (!result.success) {
      return renderCardToMarkdown(
        formatErrorCard("Content Factory", result.error || "Unknown error"),
      );
    }

    return renderCardToMarkdown(formatCreateCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Content Factory", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * /publish command handler
 * @param args - Command arguments: <asset_id> <channel> | --latest <channel>
 */
export async function cmdPublish(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId, basePath } = await init();

    // v0.3.0: --latest mode
    let assetId: string;
    let channel: ChannelProfileNode["platform"];

    if (args[0] === "--latest") {
      channel = args[1] as ChannelProfileNode["platform"];
      if (!channel) {
        return renderCardToMarkdown(
          formatErrorCard("Publish Pack", "Missing channel. Usage: /publish --latest <channel>"),
        );
      }
      // Find most recent reviewed, non-template asset with matching channel variant
      const reviewedAssets = await psg.query<ContentAssetNode>({
        type: "domain:ContentAsset",
        context_id: contextId,
        filter: { status: "reviewed" },
      });
      // Filter: exclude templates, require channel variant
      const eligible = reviewedAssets.filter(
        (a) => !a.is_template && a.platform_variants[channel] !== undefined,
      );
      if (eligible.length === 0) {
        const reason =
          reviewedAssets.length === 0
            ? "No reviewed assets found. Run /create first."
            : `No reviewed asset with variant for channel '${channel}'. Available: ${
                reviewedAssets
                  .filter((a) => !a.is_template)
                  .map((a) => `${a.title} [${Object.keys(a.platform_variants).join(",")}]`)
                  .join("; ") || "none"
              }`;
        return renderCardToMarkdown(formatErrorCard("Publish Pack", reason));
      }
      // Sort by created_at descending, pick most recent eligible
      const sorted = eligible
        .slice()
        .toSorted((a: ContentAssetNode, b: ContentAssetNode) =>
          b.created_at.localeCompare(a.created_at),
        );
      assetId = sorted[0].id;
    } else {
      assetId = args[0];
      channel = args[1] as ChannelProfileNode["platform"];
    }

    if (!assetId || !channel) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Publish Pack",
          "Missing arguments. Usage: /publish <asset_id> <channel> | /publish --latest <channel>",
        ),
      );
    }

    const validChannels = ["x", "linkedin", "medium", "hn", "youtube"];
    if (!validChannels.includes(channel)) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Publish Pack",
          `Invalid channel: ${channel}. Valid: ${validChannels.join(", ")}`,
        ),
      );
    }

    const result = await runPublishPack(
      {
        context_id: contextId,
        asset_id: assetId,
        channel,
      },
      { psg, vsl, eventEmitter, basePath },
    );

    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard("Publish Pack", result.error || "Unknown error"));
    }

    return renderCardToMarkdown(formatPublishCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Publish Pack", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Reset orchestrator state (for testing)
 */
export function resetState(): void {
  state = null;
}

/**
 * /inbox command handler
 * @param args - Command arguments: JSON array or --platform <p> --content <c> [--author <a>]
 */
export async function cmdInbox(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    // Parse arguments — support JSON or flag-based input
    let interactions: InboxHandlerInput["interactions"] = [];

    if (args[0]?.startsWith("[")) {
      // JSON array input
      try {
        interactions = JSON.parse(args.join(" "));
      } catch {
        return renderCardToMarkdown(
          formatErrorCard(
            "Inbox",
            'Invalid JSON. Usage: /inbox [{"platform":"x","content":"..."}]',
          ),
        );
      }
    } else {
      // Flag-based input: --platform <p> --content <c> [--author <a>]
      let platform = "";
      let content = "";
      let author: string | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--platform" && args[i + 1]) {
          platform = args[++i];
        } else if (args[i] === "--content" && args[i + 1]) {
          content = args[++i];
        } else if (args[i] === "--author" && args[i + 1]) {
          author = args[++i];
        }
      }

      if (!platform || !content) {
        return renderCardToMarkdown(
          formatErrorCard(
            "Inbox",
            "Missing args. Usage: /inbox --platform <p> --content <c> [--author <a>]",
          ),
        );
      }

      interactions = [{ platform, content, author }];
    }

    const result = await runInboxHandler(
      { context_id: contextId, interactions },
      { psg, vsl, eventEmitter },
    );

    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard("Inbox", result.error || "Unknown error"));
    }

    return renderCardToMarkdown(formatInboxCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Inbox", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * /review command handler
 * @param args - Optional: --week <ISO date> | --since-last
 */
export async function cmdReview(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    let weekStart: string | undefined;
    let sinceLast = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--week" && args[i + 1]) {
        weekStart = args[++i];
      } else if (args[i] === "--since-last") {
        sinceLast = true;
      }
    }

    const result = await runWeeklyReview(
      { context_id: contextId, week_start: weekStart, since_last: sinceLast },
      { psg, vsl, eventEmitter },
    );

    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard("Review", result.error || "Unknown error"));
    }

    return renderCardToMarkdown(formatReviewCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Review", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * /outreach command handler
 * @param args - <target_id> <ch> | --segment <org_type> --channel <ch> [--limit N] [--dry-run]
 */
export async function cmdOutreach(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    // Parse all flags
    let segment: string | undefined;
    let channel: OutreachInput["channel"] | undefined;
    let limit = 10;
    let dryRun = false;
    let goal: string | undefined;
    let tone: string | undefined;
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--segment" && args[i + 1]) {
        segment = args[++i];
      } else if (args[i] === "--channel" && args[i + 1]) {
        channel = args[++i] as OutreachInput["channel"];
      } else if (args[i] === "--limit" && args[i + 1]) {
        limit = parseInt(args[++i], 10) || 10;
      } else if (args[i] === "--dry-run") {
        dryRun = true;
      } else if (args[i] === "--goal" && args[i + 1]) {
        goal = args[++i];
      } else if (args[i] === "--tone" && args[i + 1]) {
        tone = args[++i];
      } else {
        positional.push(args[i]);
      }
    }

    const validChannels = ["email", "linkedin", "x"];

    // v0.3.0: Batch mode (--segment)
    if (segment) {
      if (!channel) {
        return renderCardToMarkdown(
          formatErrorCard(
            "Outreach",
            "Batch mode requires --channel. Usage: /outreach --segment <org_type> --channel <ch>",
          ),
        );
      }
      if (!validChannels.includes(channel)) {
        return renderCardToMarkdown(
          formatErrorCard(
            "Outreach",
            `Invalid channel: ${channel}. Valid: ${validChannels.join(", ")}`,
          ),
        );
      }

      // Query matching OTs (only research status)
      const allTargets = await psg.query<OutreachTargetNode>({
        type: "domain:OutreachTarget",
        context_id: contextId,
        filter: { status: "research", org_type: segment },
      });

      if (allTargets.length === 0) {
        return renderCardToMarkdown(
          formatErrorCard(
            "Outreach",
            "All targets already contacted. Reset targets to research to rerun.",
          ),
        );
      }

      // Skip rule: exclude targets that already have a drafted/reviewed outreach asset within 7 days
      const existingAssets = await psg.query<ContentAssetNode>({
        type: "domain:ContentAsset",
        context_id: contextId,
        filter: { asset_type: "outreach_email" },
      });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const eligible = allTargets.filter((t) => {
        const hasRecentAsset = existingAssets.some((a) => {
          if (!["draft", "reviewed", "published"].includes(a.status)) {
            return false;
          }
          if (a.created_at < sevenDaysAgo) {
            return false;
          }

          // 1. Primary: metadata fingerprint (P2)
          if (a.metadata?.target_id) {
            return a.metadata.target_id === t.id && a.metadata.channel === channel;
          }
          // 2. Fallback: title pattern (backwards compat)
          return (
            a.title === `Outreach to ${t.name} via ${channel}` ||
            a.title === `Outreach Draft: ${t.name} via ${channel}` ||
            a.title === `Outreach: ${t.name} via ${channel}`
          );
        });
        if (hasRecentAsset) {
          console.log("HAS RECENT ASSET:", t.id);
        }
        return !hasRecentAsset;
      });
      console.log("ELIGIBLE COUNT:", eligible.length);

      const targets = eligible.slice(0, limit);
      const _skippedCount = allTargets.length - eligible.length;

      if (targets.length === 0) {
        return renderCardToMarkdown(
          formatErrorCard(
            "Outreach",
            `No new outreach needed in last 7 days. All ${allTargets.length} targets skipped.`,
          ),
        );
      }

      // Run WF-06 per target
      const results: Array<{
        target_name: string;
        success: boolean;
        skipped: boolean;
        confirm_id?: string;
        error?: string;
      }> = [];
      for (const target of targets) {
        const result = await runOutreach(
          { context_id: contextId, target_id: target.id, channel, goal, tone, dry_run: dryRun },
          { psg, vsl, eventEmitter },
        );
        const outputs = result.outputs as Record<string, unknown>;
        results.push({
          target_name: target.name,
          success: result.success,
          skipped: false,
          confirm_id: outputs.confirm_id as string | undefined,
          error: result.error,
        });
      }
      // Add skipped entries
      for (const t of allTargets.filter((t) => !eligible.includes(t)).slice(0, 5)) {
        results.push({ target_name: t.name, success: true, skipped: true });
      }

      return renderCardToMarkdown(formatBatchOutreachCard(results, channel, dryRun));
    }

    // Single mode
    const targetId = positional[0];
    channel = channel || (positional[1] as OutreachInput["channel"]);

    if (!targetId || !channel) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Outreach",
          "Missing args. Usage: /outreach <target_id> <channel> | /outreach --segment <org_type> --channel <ch>",
        ),
      );
    }

    if (!validChannels.includes(channel)) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Outreach",
          `Invalid channel: ${channel}. Valid: ${validChannels.join(", ")}`,
        ),
      );
    }

    const result = await runOutreach(
      { context_id: contextId, target_id: targetId, channel, goal, tone, dry_run: dryRun },
      { psg, vsl, eventEmitter },
    );

    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard("Outreach", result.error || "Unknown error"));
    }

    return renderCardToMarkdown(formatOutreachCard(result));
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Outreach", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * /approve command handler
 * @param args - <confirm_id> | --list | --all
 */
export async function cmdApprove(args: string[]): Promise<string> {
  try {
    const { psg } = await init();

    // v0.3.0: --list mode — group by plan category
    if (args[0] === "--list") {
      const allConfirms = await psg.query<Confirm & PSGNode>({
        type: "Confirm",
      });
      const pending = allConfirms.filter((c) => c.status === "pending");

      // Classify each confirm by loading its linked Plan
      const classified: Array<{ confirm_id: string; category: string; status: string }> = [];
      for (const c of pending) {
        let category = "other";
        if (c.target_id) {
          const plans = await psg.query<Plan & PSGNode>({
            type: "Plan",
            filter: { plan_id: c.target_id },
          });
          if (plans.length > 0) {
            const stepDescs = (plans[0].steps || [])
              .map((s: PlanStep) => s.description || "")
              .join(" ");
            if (
              stepDescs.includes("outreach") ||
              (stepDescs.includes("Draft") && stepDescs.includes("Policy compliance"))
            ) {
              category = "outreach";
            } else if (
              stepDescs.includes("Format content for channel") ||
              stepDescs.includes("Record published")
            ) {
              category = "publish";
            } else if (
              stepDescs.includes("Ingest interactions") ||
              stepDescs.includes("Generate draft replies")
            ) {
              category = "inbox";
            } else if (
              stepDescs.includes("Collect metrics") ||
              stepDescs.includes("MetricSnapshot")
            ) {
              category = "review";
            }
          }
        }
        classified.push({ confirm_id: c.confirm_id, category, status: c.status });
      }

      return renderCardToMarkdown(formatApproveListCard(classified));
    }

    // v0.3.0: --all mode (batch approve with failure isolation)
    if (args[0] === "--all") {
      const allConfirms = await psg.query<Confirm & PSGNode>({
        type: "Confirm",
      });
      const pending = allConfirms.filter((c) => c.status === "pending");

      if (pending.length === 0) {
        return renderCardToMarkdown(formatErrorCard("Approve", "No pending confirms to approve"));
      }

      const results: Array<{
        confirm_id: string;
        status: string;
        target_name?: string;
        error?: string;
      }> = [];

      for (const confirm of pending) {
        try {
          // Approve each confirm
          const approved: Confirm = {
            ...confirm,
            status: "approved",
            decisions: [
              ...(confirm.decisions || []),
              {
                decision_id: uuidv4(),
                status: "approved",
                decided_by_role: "user",
                decided_at: new Date().toISOString(),
                reason: "Batch approved via /approve --all",
              },
            ],
          };
          await psg.putNode(approved as unknown as PSGNode);

          // Side-effects: transition drafted OTs to contacted
          const targets = await psg.query<OutreachTargetNode>({
            type: "domain:OutreachTarget",
            filter: { status: "drafted" },
          });
          let targetName: string | undefined;
          if (targets.length > 0) {
            const target = targets[0];
            targetName = target.name;
            target.status = "contacted";
            target.last_contact_at = new Date().toISOString();
            await psg.putNode(target);
          }

          // Side-effects: transition pending interactions to responded
          const interactions = await psg.query<InteractionNode>({
            type: "domain:Interaction",
            filter: { status: "pending" },
          });
          for (const interaction of interactions) {
            if (interaction.response?.includes("[Draft asset:")) {
              const transitioned = transitionInteraction(interaction, "responded");
              await psg.putNode(transitioned);
              break;
            }
          }

          results.push({
            confirm_id: confirm.confirm_id,
            status: "approved",
            target_name: targetName,
          });
        } catch (err) {
          // Failure isolation: single confirm failure doesn't block others
          results.push({
            confirm_id: confirm.confirm_id,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return renderCardToMarkdown(formatBatchApproveCard(results));
    }

    // Single mode
    const confirmId = args[0];
    if (!confirmId) {
      return renderCardToMarkdown(
        formatErrorCard("Approve", "Missing args. Usage: /approve <confirm_id> | --list | --all"),
      );
    }

    // Find the Confirm
    const confirms = await psg.query<Confirm & PSGNode>({
      type: "Confirm",
      filter: { confirm_id: confirmId },
    });

    if (confirms.length === 0) {
      return renderCardToMarkdown(formatErrorCard("Approve", `Confirm not found: ${confirmId}`));
    }
    const confirm = confirms[0] as Confirm;

    if (confirm.status !== "pending") {
      return renderCardToMarkdown(formatErrorCard("Approve", `Confirm already ${confirm.status}`));
    }

    // Write decision and update status
    const approved: Confirm = {
      ...confirm,
      status: "approved",
      decisions: [
        ...(confirm.decisions || []),
        {
          decision_id: uuidv4(),
          status: "approved",
          decided_by_role: "user",
          decided_at: new Date().toISOString(),
          reason: "Manually approved via /approve command",
        },
      ],
    };
    await psg.putNode(approved as unknown as PSGNode);

    // Execute deferred side-effects for the linked plan
    let targetName: string | undefined;
    let interactionStatus: string | undefined;
    let targetStatus: string | undefined;

    // Find OutreachTargets with status=drafted and update to contacted
    const targets = await psg.query<OutreachTargetNode>({
      type: "domain:OutreachTarget",
      filter: { status: "drafted" },
    });
    if (targets.length > 0) {
      const target = targets[0];
      targetName = target.name;
      target.status = "contacted";
      target.last_contact_at = new Date().toISOString();
      await psg.putNode(target);
      targetStatus = "contacted";
    }

    // Find pending Interactions linked to outreach and transition to responded
    const interactions = await psg.query<InteractionNode>({
      type: "domain:Interaction",
      filter: { status: "pending" },
    });
    for (const interaction of interactions) {
      if (interaction.response?.includes("[Draft asset:")) {
        const transitioned = transitionInteraction(interaction, "responded");
        await psg.putNode(transitioned);
        interactionStatus = "responded";
        break; // Only transition the most recent matching one
      }
    }

    return renderCardToMarkdown(
      formatApproveCard({
        confirm_id: confirmId,
        status: "approved",
        target_name: targetName,
        interaction_status: interactionStatus,
        target_status: targetStatus,
      }),
    );
  } catch (error) {
    return renderCardToMarkdown(
      formatErrorCard("Approve", error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Programmatic entry point for API/Runner
 */
export async function executeCommand(command: string, args: string[]): Promise<string> {
  await init();

  switch (command) {
    case "brief":
      return cmdBrief();
    case "create":
      return cmdCreate(args);
    case "publish":
      return cmdPublish(args);
    case "inbox":
      return cmdInbox(args);
    case "review":
      return cmdReview(args);
    case "outreach":
      return cmdOutreach(args);
    case "approve":
      return cmdApprove(args);
    default:
      return renderCardToMarkdown(formatErrorCard("System", `Unknown command: ${command}`));
  }
}
