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
import type { Context, Confirm } from "../modules/mplp-modules";
import type {
  ChannelProfileNode,
  ContentAssetNode,
  OutreachTargetNode,
  InteractionNode,
} from "../psg/growth-nodes";
import type { OutreachInput } from "../workflows/types";
import { EventEmitter } from "../glue/event-emitter";
import { InMemoryPSG } from "../psg/in-memory-psg";
import { FileVSL } from "../vsl/file-vsl";
import { runWeeklyBrief } from "../workflows/wf01-weekly-brief";
import { runContentFactory, type ContentFactoryInput } from "../workflows/wf02-content-factory";
import { runPublishPack, type PublishPackInput } from "../workflows/wf03-publish-pack";
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
  formatErrorCard,
  renderCardToMarkdown,
  type CommandCard,
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
  await psg.putNode(context as any);

  // Load channel profiles
  const channelKeys = await vsl.listKeys("domain:ChannelProfile");
  for (const key of channelKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
    }
  }

  // Load content assets
  const assetKeys = await vsl.listKeys("domain:ContentAsset");
  for (const key of assetKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
    }
  }

  // Load interactions
  const interactionKeys = await vsl.listKeys("domain:Interaction");
  for (const key of interactionKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
    }
  }

  // Load outreach targets
  const targetKeys = await vsl.listKeys("domain:OutreachTarget");
  for (const key of targetKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
    }
  }

  // Load extensions
  const extensionKeys = await vsl.listKeys("Extension");
  for (const key of extensionKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
    }
  }

  // Load confirms (for /approve)
  const confirmKeys = await vsl.listKeys("Confirm");
  for (const key of confirmKeys) {
    const node = await vsl.get(key);
    if (node) {
      await psg.putNode(node as any);
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
 * @param args - Command arguments: <type> [audience] [channel]
 */
export async function cmdCreate(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    // Parse arguments
    const assetType = args[0] as ContentFactoryInput["asset_type"];
    if (!assetType) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Content Factory",
          "Missing asset type. Usage: /create <type> [audience] [channel]",
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

    const audience = args[1] as ContentFactoryInput["audience"] | undefined;
    const channels = args[2] ? [args[2] as ChannelProfileNode["platform"]] : undefined;

    const result = await runContentFactory(
      {
        context_id: contextId,
        asset_type: assetType,
        audience,
        channels,
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
 * @param args - Command arguments: <asset_id> <channel>
 */
export async function cmdPublish(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId, basePath } = await init();

    const assetId = args[0];
    const channel = args[1] as ChannelProfileNode["platform"];

    if (!assetId || !channel) {
      return renderCardToMarkdown(
        formatErrorCard("Publish Pack", "Missing arguments. Usage: /publish <asset_id> <channel>"),
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
 * @param args - Optional: --week <ISO date>
 */
export async function cmdReview(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    let weekStart: string | undefined;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--week" && args[i + 1]) {
        weekStart = args[++i];
      }
    }

    const result = await runWeeklyReview(
      { context_id: contextId, week_start: weekStart },
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
 * @param args - Command arguments: <target_id> <channel:email|linkedin|x>
 */
export async function cmdOutreach(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();

    const targetId = args[0];
    const channel = args[1] as OutreachInput["channel"];

    if (!targetId || !channel) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Outreach",
          "Missing args. Usage: /outreach <target_id> <channel:email|linkedin|x>",
        ),
      );
    }

    const validChannels = ["email", "linkedin", "x"];
    if (!validChannels.includes(channel)) {
      return renderCardToMarkdown(
        formatErrorCard(
          "Outreach",
          `Invalid channel: ${channel}. Valid: ${validChannels.join(", ")}`,
        ),
      );
    }

    // Optional flags
    let goal: string | undefined;
    let tone: string | undefined;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--goal" && args[i + 1]) {
        goal = args[++i];
      } else if (args[i] === "--tone" && args[i + 1]) {
        tone = args[++i];
      }
    }

    const result = await runOutreach(
      { context_id: contextId, target_id: targetId, channel, goal, tone },
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
 * @param args - Command arguments: <confirm_id>
 */
export async function cmdApprove(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter } = await init();

    const confirmId = args[0];
    if (!confirmId) {
      return renderCardToMarkdown(
        formatErrorCard("Approve", "Missing args. Usage: /approve <confirm_id>"),
      );
    }

    // Find the Confirm
    const confirms = await psg.query<any>({
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
    await psg.putNode(approved as any);

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
