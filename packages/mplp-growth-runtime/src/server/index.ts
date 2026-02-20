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
import { ExecuteResponse, QueueResponse, RunnerStatusResponse } from "./json-schema.js";

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
  return { status: "ok", version, uptime: process.uptime() };
});

// Runner Status
server.get<{ Reply: RunnerStatusResponse }>("/api/runner/status", async () => {
  const state = runnerState.getSnapshot();
  return {
    enabled: state.enabled,
    policy_level: state.policy_level,
    last_tick_at: state.last_tick_at,
    is_running: state.is_running,
    active_task: state.active_task,
    last_runs: state.last_task_runs,
  };
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

  // 2. Classify each confirm
  for (const c of pending) {
    let category = "other";
    if (c.target_id) {
      const plan = await psg.getNode<any>("domain:Plan", c.target_id);

      if (plan) {
        const stepDescs = (plan.steps || []).map((s: any) => s.description || "").join(" ");
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
        } else if (stepDescs.includes("inbox") || stepDescs.includes("Process interactions")) {
          category = "inbox";
        } else if (stepDescs.includes("review") || stepDescs.includes("Weekly")) {
          category = "review";
        }
      }
    }

    // Add to simplified list
    const item = {
      id: c.id,
      message: c.message,
      context: c.context,
      created_at: c.created_at,
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
