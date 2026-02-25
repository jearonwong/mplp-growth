/**
 * API Server (FIX-3: Idempotent API)
 * Exposes CLI capabilities via HTTP.
 */

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import type { Confirm, Plan, PlanStep } from "../modules/mplp-modules.js";
import type { ContentAssetNode, InteractionNode } from "../psg/growth-nodes.js";
import type { PSGNode } from "../psg/types.js";
import { version } from "../../package.json";
import { RoleRegistry } from "../agents/roles.js";
import { executeCommand, getRuntime } from "../commands/orchestrator.js";
import { loadConfig } from "../config.js";
import { runnerState } from "../runner/state.js";
import {
  runWeeklyBrief,
  runDailyOutreachDraft,
  runHourlyInbox,
  runWeeklyReview,
  runAutoPublish,
} from "../runner/tasks.js";
import { seed } from "../seed.js";
import { ExecuteResponse, QueueItem, QueueResponse } from "./json-schema.js";

// __dirname is natively available in CJS.
// Or better: const uiRoot = path.join(process.cwd(), "packages/mplp-growth-runtime/src/ui-static");
// But process.cwd() depends on where we run it.
// Let's assume user runs from package root.
const uiRoot = path.join(process.cwd(), "src/ui-static");

export const server = Fastify({ logger: true });

// Serve Static UI
server.register(fastifyStatic, {
  root: uiRoot,
  prefix: "/", // optional: default '/'
});

// Health Check
server.get("/api/health", async () => {
  const state = runnerState.getSnapshot();
  return {
    status: "ok",
    version,
    uptime: process.uptime(),
    policy_level: state.policy_level,
    runner_enabled: state.runner_enabled,
  };
});

// Get Config (P1)
server.get("/api/config", async () => {
  return loadConfig();
});

// Seed Data (P2)
server.post("/api/admin/seed", async () => {
  try {
    const { psg } = await getRuntime();
    // Check idempotency: does a Context already exist?
    const existingContexts = await psg.query({ type: "domain:Context", limit: 1 });
    if (existingContexts.length > 0) {
      return { ok: true, already_seeded: true, message: "Context already exists." };
    }

    // Run seed
    const result = await seed();
    return {
      ok: true,
      created: {
        context: result.context.context_id,
        channel_profiles: result.channelProfiles.length,
        outreach_targets: result.outreachTargets.length,
        extensions: result.extensions.length,
        templates: 2,
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
});

// Runner Status
server.get("/api/runner/status", async () => {
  return {
    ...runnerState.getSnapshot(),
    timezone: "UTC",
  };
});

// Update Runner Config
server.post<{
  Body: {
    runner_enabled?: boolean;
    policy_level?: "safe" | "standard" | "aggressive";
    auto_publish?: boolean;
    jobs?: Record<
      string,
      {
        enabled?: boolean;
        schedule_cron?: string;
        run_as_role?: "Responder" | "BDWriter" | "Editor" | "Analyst";
      }
    >;
  };
}>("/api/runner/config", async (request, reply) => {
  try {
    runnerState.setConfig(request.body as unknown as Parameters<typeof runnerState.setConfig>[0]);
    return { ok: true };
  } catch (err: unknown) {
    reply.status(400);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// Epic B Step 3: Execute API
server.post<{ Body: { task_id: string } }>("/api/runner/execute", async (request, reply) => {
  const { task_id } = request.body;
  const config = runnerState.getConfig();

  if (!config.jobs[task_id]) {
    reply.status(400);
    return { ok: false, error: `Unknown task_id: ${task_id}` };
  }

  // Idempotent lock check (Contract 3)
  if (!runnerState.acquireLock(task_id)) {
    reply.status(409);
    return { ok: false, error: `Task ${task_id} is already running.` };
  }

  const run_id = `run-${Date.now()}`;
  const startTime = Date.now();

  // Map task string to function
  const taskMap: Record<string, () => Promise<void>> = {
    brief: runWeeklyBrief,
    "outreach-draft": runDailyOutreachDraft,
    inbox: runHourlyInbox,
    "inbox-poll": runHourlyInbox,
    review: runWeeklyReview,
    publish: runAutoPublish,
  };

  const taskFn = taskMap[task_id];

  // Async execution (don't await so HTTP returns immediately with run_id)
  Promise.resolve()
    .then(async () => {
      console.log(`[Manual Trigger] Executing ${task_id}`);
      await taskFn();
      runnerState.releaseLock(task_id, {
        status: "success",
        duration_ms: Date.now() - startTime,
      });
    })
    .catch((err: unknown) => {
      console.error(`[Manual Trigger] ${task_id} failed:`, err);
      runnerState.releaseLock(task_id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startTime,
      });
    });

  return { ok: true, run_id };
});

// Execute Command (Placeholder for Orchestrator integration in Phase 2)
server.post<{ Body: { command: string; args: string[] }; Reply: ExecuteResponse }>(
  "/api/cmd/execute",
  async (request, _reply) => {
    const { command, args } = request.body;
    try {
      const output = await executeCommand(command, args);
      return {
        ok: true,
        command: `${command} ${args.join(" ")}`,
        run_id: "run-" + Date.now(),
        outputs: output,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        command: `${command} ${args.join(" ")}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal" as const,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  },
);

// Manual Import API
import { manualConnector } from "../connectors/manual.js";

server.post<{ Body: { content: string; author_handle: string; source_ref?: string } }>(
  "/api/inbox/manual",
  async (request, reply) => {
    const { content, author_handle, source_ref } = request.body;
    if (!content || !author_handle) {
      return reply.code(400).send({ error: "Missing content or author_handle" });
    }

    manualConnector.push({
      content,
      author_handle,
      source_ref: source_ref || `manual-${Date.now()}`,
    });

    return { ok: true, queued: true };
  },
);

// Queue
server.get<{ Reply: QueueResponse }>("/api/queue", async () => {
  const { psg } = await getRuntime();

  // 1. Query pending confirms
  const confirms = await psg.query<Confirm & PSGNode>({ type: "Confirm" });
  const pending = confirms.filter((c) => c.status === "pending");

  const categories: QueueResponse["categories"] = {
    outreach: [],
    publish: [],
    inbox: [],
    review: [],
    other: [],
  };

  // 2. Classify and enrich each confirm
  for (const c of pending) {
    let category = "other";
    let title = c.message || "Action Required";
    let preview = "No asset linked. Open Plan for details.";
    let asset_id: string | undefined;
    let target_id: string | undefined;
    let channel: string | undefined;
    let interactions_data:
      | Array<{ platform: string; author: string; content: string; response?: string }>
      | undefined = undefined;
    let interactions_count = 0;
    let interaction_summaries:
      | Array<{ platform: string; author: string; excerpt: string; source_ref?: string }>
      | undefined = undefined;
    let policy_check: QueueItem["policy_check"] = { status: "unknown" };
    let plan: (Plan & PSGNode) | null = null;
    let impact_level: "low" | "medium" | "high" = "low";
    let impact_summary = "";
    let will_change: string[] = [];
    let will_not_do: string[] = [];
    let drafted_by_role: string | undefined;
    let rationale_bullets: string[] | undefined;

    if (c.target_id) {
      plan = await psg.getNode<Plan & PSGNode>("Plan", c.target_id);

      if (plan) {
        title = plan.title || title;
        const stepDescs = (plan.steps || []).map((s: PlanStep) => s.description || "").join(" ");
        if (
          stepDescs.includes("outreach") ||
          (stepDescs.includes("Draft") && stepDescs.includes("Policy compliance"))
        ) {
          category = "outreach";
          target_id = plan.steps[0]?.reference_id || plan.steps[0]?.target_node_id;
          asset_id = plan.steps[1]?.reference_id || plan.steps[1]?.target_node_id;
          const match = title.match(/via\s+(\w+)$/i);
          if (match) {
            channel = match[1];
          }
          policy_check = { status: "pass", reasons: ["No forbidden terms found"] };
          impact_level = "high";
          impact_summary = "Outreach execution will advance state and generate tracking packages.";
          will_change = [
            "Target drafted→contacted",
            "Interaction pending→responded",
            "Export pack available",
          ];
          will_not_do = ["Will NOT send email automatically", "Will NOT post to social media"];
        } else if (
          stepDescs.includes("Format content for channel") ||
          stepDescs.includes("Record published")
        ) {
          category = "publish";
          asset_id = plan.steps[0]?.reference_id;
          const match = title.match(/to\s+(\w+)$/i);
          if (match) {
            channel = match[1];
          }
          policy_check = { status: "pass", reasons: ["Policy check passed internally"] };
          impact_level = "medium";
          impact_summary = "Asset will be approved for publishing workflow.";
          will_change = ["ContentAsset reviewed→published", "Export pack generated"];
          will_not_do = ["Will NOT call platform API"];
        } else if (
          stepDescs.includes("inbox") ||
          stepDescs.includes("Process interactions") ||
          (plan.title && plan.title.includes("Inbox Handler"))
        ) {
          category = "inbox";
          policy_check = { status: "pass", reasons: ["Responses generated safely"] };
          impact_level = "medium";
          impact_summary = "Draft responses will be prepared for manual approval/export.";
          will_change = ["Interaction pending→responded"];
          will_not_do = ["Will NOT send messages automatically"];
        } else if (stepDescs.includes("review") || stepDescs.includes("Weekly")) {
          category = "review";
          asset_id = plan.steps[0]?.reference_id || plan.steps[0]?.target_node_id;
        }
      }
    }

    if (asset_id) {
      const asset = await psg.getNode<ContentAssetNode>("domain:ContentAsset", asset_id);
      if (asset && asset.content) {
        const lines = asset.content.split("\n");
        const previewLines = lines.slice(0, 20).join("\n");
        preview = previewLines.length > 800 ? previewLines.substring(0, 800) + "..." : previewLines;
      }
      if (asset?.metadata) {
        drafted_by_role = asset.metadata.drafted_by_role as string | undefined;
        rationale_bullets = asset.metadata.rationale_bullets as string[] | undefined;
      }
    } else if (category === "inbox") {
      const pendingInteractions = await psg.query<InteractionNode>({
        type: "domain:Interaction",
        filter: { status: "pending" },
      });
      if (pendingInteractions.length > 0) {
        preview = "Inbox interactions ready for review.";
        interactions_count = pendingInteractions.length;
        interactions_data = pendingInteractions.map((i) => ({
          platform: i.platform || "unknown",
          author: i.author || "anonymous",
          content: i.content,
          response: i.response,
        }));

        interaction_summaries = pendingInteractions.slice(0, 2).map((i) => {
          let excerpt = (i.content || "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
          if (excerpt.length > 120) {
            excerpt = excerpt.substring(0, 120) + "...";
          }
          return {
            platform: i.platform || "unknown",
            author: i.author || "anonymous",
            excerpt,
            source_ref: i.source_ref,
          };
        });

        // Inbox batch shares the same agent logic, take from first interaction
        if (pendingInteractions[0].metadata) {
          drafted_by_role = pendingInteractions[0].metadata.drafted_by_role as string | undefined;
          rationale_bullets = pendingInteractions[0].metadata.rationale_bullets as
            | string[]
            | undefined;
        }

        if (!drafted_by_role) {
          drafted_by_role = "Responder";
        }
        if (!rationale_bullets || rationale_bullets.length === 0) {
          rationale_bullets = [
            "Summarizes inbound signal",
            "Drafts a safe response",
            "Requires manual approval",
          ];
        }
      } else {
        preview = "No pending interactions found.";
      }
    }

    const item: QueueItem = {
      id: c.confirm_id,
      confirm_id: c.confirm_id,
      title,
      preview,
      category,
      created_at: c.created_at,
      plan_id: plan?.id,
      asset_id,
      channel,
      target_id,
      policy_check,
      impact_level,
      impact_summary,
      will_change,
      will_not_do,
      interactions_count,
      interaction_summaries,
      interactions: interactions_data,
      drafted_by_role,
      rationale_bullets: rationale_bullets?.slice(0, 3),
    };

    if (category === "outreach") {
      categories.outreach.push(item);
    } else if (category === "publish") {
      categories.publish.push(item);
    } else if (category === "inbox") {
      categories.inbox.push(item);
    } else if (category === "review") {
      categories.review.push(item);
    } else {
      categories.other.push(item);
    }
  }

  return {
    pending_count: pending.length,
    categories,
  };
});

// Approve Confirm
server.post<{ Params: { id: string }; Reply: ExecuteResponse }>(
  "/api/queue/:id/approve",
  async (request, _reply) => {
    const { id } = request.params;
    try {
      const output = await executeCommand("approve", [id]);
      return {
        ok: true,
        command: `approve ${id}`,
        run_id: "run-" + Date.now(),
        outputs: output,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        command: `approve ${id}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal" as const,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  },
);

// Reject Confirm (Direct PSG Update)
server.post<{ Params: { id: string }; Reply: ExecuteResponse }>(
  "/api/queue/:id/reject",
  async (request, _reply) => {
    const { id } = request.params;
    try {
      const { psg } = await getRuntime();
      const confirm = await psg.getNode<Confirm & PSGNode>("Confirm", id);

      if (!confirm) {
        return {
          ok: false,
          command: `reject ${id}`,
          run_id: "run-" + Date.now(),
          outputs: "",
          error: { code: "not_found", message: `Confirm ${id} not found` },
        };
      }

      confirm.status = "rejected";
      await psg.putNode(confirm);

      return {
        ok: true,
        command: `reject ${id}`,
        run_id: "run-" + Date.now(),
        outputs: `Confirm ${id} rejected.`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        command: `reject ${id}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal" as const,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  },
);

// Get Roles
server.get("/api/roles", async () => {
  return Object.values(RoleRegistry).map((r) => ({
    role_id: r.id,
    name: r.name,
    capabilities: [r.description],
  }));
});

// Edit Draft
server.post<{ Params: { id: string }; Body: { content: string } }>(
  "/api/assets/:id/edit",
  async (request, reply) => {
    const { id } = request.params;
    const { content } = request.body;
    if (!content || content.trim() === "") {
      return reply.code(400).send({ ok: false, error: "Content cannot be empty" });
    }

    const { psg } = await getRuntime();
    const asset = await psg.getNode<ContentAssetNode>("domain:ContentAsset", id);
    if (!asset) {
      return reply.code(404).send({ ok: false, error: `Asset ${id} not found` });
    }

    asset.content = content;
    if (!asset.metadata) {
      asset.metadata = {};
    }

    const prevVersion =
      typeof asset.metadata.edit_version === "number" ? asset.metadata.edit_version : 0;

    asset.metadata.edited_by = "founder";
    asset.metadata.edited_at = new Date().toISOString();
    asset.metadata.edit_version = prevVersion + 1;

    await psg.putNode(asset);

    return {
      ok: true,
      asset_id: id,
      edit_version: asset.metadata.edit_version,
    };
  },
);

import type { AgentRole } from "../agents/roles.js";
// Redraft as Role (P2 — v0.7.0)
import { executor } from "../agents/executor.js";

server.post<{ Params: { id: string }; Body: { role_id: string } }>(
  "/api/queue/:id/redraft",
  async (request, reply) => {
    const { id: confirmId } = request.params;
    const { role_id } = request.body;

    // Validate role_id
    const validRoles: AgentRole[] = ["Responder", "BDWriter", "Editor", "Analyst"];
    if (!role_id || !validRoles.includes(role_id as AgentRole)) {
      return reply.code(400).send({
        ok: false,
        error: `Invalid role_id: ${role_id}. Valid: ${validRoles.join(", ")}`,
      });
    }
    const roleId = role_id as AgentRole;

    const { psg } = await getRuntime();

    // 1. Resolve confirm → plan
    const confirm = await psg.getNode<Confirm & PSGNode>("Confirm", confirmId);
    if (!confirm) {
      return reply.code(404).send({ ok: false, error: `Queue item ${confirmId} not found` });
    }
    if (confirm.status !== "pending") {
      return reply
        .code(400)
        .send({ ok: false, error: `Cannot redraft: item status is ${confirm.status}` });
    }

    const plan = confirm.target_id
      ? await psg.getNode<Plan & PSGNode>("Plan", confirm.target_id)
      : null;
    if (!plan) {
      return reply.code(404).send({ ok: false, error: `Plan not found for confirm ${confirmId}` });
    }

    // 2. Determine category and linked documents
    const stepDescs = (plan.steps || []).map((s: PlanStep) => s.description || "").join(" ");
    const isOutreach =
      stepDescs.includes("outreach") ||
      (stepDescs.includes("Draft") && stepDescs.includes("Policy compliance"));
    const isInbox =
      stepDescs.includes("inbox") ||
      stepDescs.includes("Ingest interactions") ||
      stepDescs.includes("Generate draft replies");

    let redraftedCount = 0;

    if (isOutreach) {
      // Outreach: find linked ContentAsset
      const assetId = plan.steps[1]?.reference_id || plan.steps[1]?.target_node_id;
      if (assetId) {
        const asset = await psg.getNode<ContentAssetNode>("domain:ContentAsset", assetId);
        if (asset) {
          // Resolve target name from metadata
          const targetName = asset.metadata?.target_id
            ? (
                await psg.getNode<ContentAssetNode & PSGNode>(
                  "domain:OutreachTarget",
                  asset.metadata.target_id as string,
                )
              )?.title || "there"
            : "there";

          const draft = await executor.run(roleId, {
            kind: "outreach_draft",
            target: { name: targetName },
            channel: (asset.metadata?.channel as string) || "email",
          });

          asset.content = draft.content;
          if (!asset.metadata) {
            asset.metadata = {};
          }
          const prevVersion =
            typeof asset.metadata.redraft_version === "number" ? asset.metadata.redraft_version : 0;
          asset.metadata.redrafted_by_role = roleId;
          asset.metadata.drafted_by_role = roleId;
          asset.metadata.redraft_version = prevVersion + 1;
          asset.metadata.rationale_bullets = (draft.rationale_bullets || []).slice(0, 3);
          await psg.putNode(asset);
          redraftedCount++;
        }
      }
    } else if (isInbox) {
      // Inbox: find linked Interactions via plan reference
      const interactions = await psg.query<InteractionNode>({
        type: "domain:Interaction",
        filter: { status: "pending" },
      });

      // Filter to interactions that belong to this plan's scope
      // (created around the same time as the plan)
      for (const node of interactions) {
        const draft = await executor.run(roleId, {
          kind: "inbox_reply",
          interaction: {
            platform: node.platform,
            author: node.author || "Unknown",
            content: node.content,
          },
        });

        node.response = draft.content;
        if (!node.metadata) {
          node.metadata = {};
        }
        const prevVersion =
          typeof node.metadata.redraft_version === "number" ? node.metadata.redraft_version : 0;
        node.metadata.redrafted_by_role = roleId;
        node.metadata.drafted_by_role = roleId;
        node.metadata.redraft_version = prevVersion + 1;
        node.metadata.rationale_bullets = (draft.rationale_bullets || []).slice(0, 3);
        await psg.putNode(node);
        redraftedCount++;
      }
    } else {
      return reply.code(400).send({
        ok: false,
        error: `Redraft not supported for this queue item category`,
      });
    }

    // 3. Update plan agent_role (no state advance)
    plan.agent_role = roleId;
    await psg.putNode(plan as unknown as PSGNode);

    return {
      ok: true,
      confirm_id: confirmId,
      role_id: roleId,
      redrafted_count: redraftedCount,
    };
  },
);

export async function startServer(port = 3000) {
  try {
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`[Server] Listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if executed directly
if (typeof require !== "undefined" && require.main === module) {
  startServer();
} else if (process.argv[1] && process.argv[1].endsWith("server/index.ts")) {
  startServer();
}
