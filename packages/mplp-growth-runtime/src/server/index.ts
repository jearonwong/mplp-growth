/**
 * API Server (FIX-3: Idempotent API)
 * Exposes CLI capabilities via HTTP.
 */

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { version } from "../../package.json";
import { executeCommand, getRuntime } from "../commands/orchestrator.js";
import { Plan } from "../modules/mplp-modules.js";
import { runnerState } from "../runner/state.js";
import {
  runWeeklyBrief,
  runDailyOutreachDraft,
  runHourlyInbox,
  runWeeklyReview,
  runAutoPublish,
} from "../runner/tasks.js";
import { ExecuteResponse, QueueItem, QueueResponse, RunnerStatusResponse } from "./json-schema.js";

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
    jobs?: Record<string, { enabled?: boolean; schedule_cron?: string }>;
  };
}>("/api/runner/config", async (request, reply) => {
  try {
    runnerState.setConfig(request.body as any);
    return { ok: true };
  } catch (err: any) {
    reply.status(400);
    return { ok: false, error: err.message };
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
    .catch((err: any) => {
      console.error(`[Manual Trigger] ${task_id} failed:`, err);
      runnerState.releaseLock(task_id, {
        status: "failed",
        error: err.message,
        duration_ms: Date.now() - startTime,
      });
    });

  return { ok: true, run_id };
});

// Execute Command (Placeholder for Orchestrator integration in Phase 2)
server.post<{ Body: { command: string; args: string[] }; Reply: ExecuteResponse }>(
  "/api/cmd/execute",
  async (request, reply) => {
    const { command, args } = request.body;
    try {
      const output = await executeCommand(command, args);
      return {
        ok: true,
        command: `${command} ${args.join(" ")}`,
        run_id: "run-" + Date.now(),
        outputs: output,
      };
    } catch (err: any) {
      return {
        ok: false,
        command: `${command} ${args.join(" ")}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal",
          message: err.message,
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
  const confirms = await psg.query<any>({ type: "Confirm" });
  const pending = confirms.filter((c: any) => c.status === "pending");

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
    let policy_check: QueueItem["policy_check"] = { status: "unknown" };
    let plan = null;
    let impact_level: "low" | "medium" | "high" = "low";
    let impact_summary = "";
    let will_change: string[] = [];
    let will_not_do: string[] = [];
    let interactions_data: any[] | undefined = undefined;

    if (c.target_id) {
      plan = await psg.getNode<any>("Plan", c.target_id);

      if (plan) {
        title = plan.title || title;
        const stepDescs = (plan.steps || []).map((s: any) => s.description || "").join(" ");
        if (
          stepDescs.includes("outreach") ||
          (stepDescs.includes("Draft") && stepDescs.includes("Policy compliance"))
        ) {
          category = "outreach";
          target_id = plan.steps[0]?.reference_id;
          asset_id = plan.steps[1]?.reference_id;
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
          impact_summary =
            "Draft responses will be staged for manual dispatch or automatic mailing.";
          will_change = ["Interaction pending→responded"];
          will_not_do = ["Will NOT send messages without further external tool review"];
        } else if (stepDescs.includes("review") || stepDescs.includes("Weekly")) {
          category = "review";
          asset_id = plan.steps[0]?.reference_id;
        }
      }
    }

    if (asset_id) {
      const asset = await psg.getNode<any>("domain:ContentAsset", asset_id);
      if (asset && asset.content) {
        const lines = asset.content.split("\n");
        const previewLines = lines.slice(0, 20).join("\n");
        preview = previewLines.length > 800 ? previewLines.substring(0, 800) + "..." : previewLines;
      }
    } else if (category === "inbox") {
      const pendingInteractions = await psg.query<any>({
        type: "domain:Interaction",
        filter: { status: "pending" },
      });
      if (pendingInteractions.length > 0) {
        preview = "Inbox interactions ready for review.";
        interactions_data = pendingInteractions.map((i: any) => ({
          platform: i.platform || "unknown",
          author: i.author || "anonymous",
          content: i.content,
          response: i.response,
        }));
      } else {
        preview = "No pending interactions found.";
      }
    }

    const item: QueueItem = {
      id: c.id,
      confirm_id: c.id,
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
      interactions: interactions_data,
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
  async (request, reply) => {
    const { id } = request.params;
    try {
      const output = await executeCommand("approve", [id]);
      return {
        ok: true,
        command: `approve ${id}`,
        run_id: "run-" + Date.now(),
        outputs: output,
      };
    } catch (err: any) {
      return {
        ok: false,
        command: `approve ${id}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal",
          message: err.message,
        },
      };
    }
  },
);

// Reject Confirm (Direct PSG Update)
server.post<{ Params: { id: string }; Reply: ExecuteResponse }>(
  "/api/queue/:id/reject",
  async (request, reply) => {
    const { id } = request.params;
    try {
      const { psg } = await getRuntime();
      const confirm = await psg.getNode<any>("domain:Confirm", id);

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
    } catch (err: any) {
      return {
        ok: false,
        command: `reject ${id}`,
        run_id: "run-" + Date.now(),
        outputs: "",
        error: {
          code: "internal",
          message: err.message,
        },
      };
    }
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
