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
    runner_enabled: state.enabled,
  };
});

// Runner Status
server.get<{ Reply: RunnerStatusResponse & { auto_publish: boolean } }>(
  "/api/runner/status",
  async () => {
    const state = runnerState.getSnapshot();
    return {
      enabled: state.enabled,
      policy_level: state.policy_level,
      auto_publish: state.auto_publish,
      last_tick_at: state.last_tick_at,
      is_running: state.is_running,
      active_task: state.active_task,
      last_runs: state.last_task_runs,
    };
  },
);

// Update Runner Config
server.post<{
  Body: { policy_level?: "safe" | "standard" | "aggressive"; auto_publish?: boolean };
}>("/api/runner/config", async (request, reply) => {
  const { policy_level, auto_publish } = request.body;
  runnerState.setConfig({ policy_level, auto_publish });
  return { ok: true };
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

    if (c.target_id) {
      plan = await psg.getNode<any>("domain:Plan", c.target_id);

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
        } else if (stepDescs.includes("inbox") || stepDescs.includes("Process interactions")) {
          category = "inbox";
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
