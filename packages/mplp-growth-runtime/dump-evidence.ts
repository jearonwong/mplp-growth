import { executeCommand } from "./src/commands/orchestrator.js";
import { getRuntime } from "./src/server/context.js";

async function run() {
  const runtime = await getRuntime();

  // Create a clean target
  await runtime.psg.putNode({
    type: "domain:OutreachTarget",
    id: "clean-target-ev",
    context_id: "test-context",
    name: "Clean Target Event",
    status: "research",
  } as any);

  // Run outreach
  await executeCommand("outreach", ["clean-target-ev", "email"]);

  // Fetch Queue natively
  const confirms = (await runtime.psg.query({ type: "Confirm" })) as any[];
  const pending = confirms.filter((c) => c.status === "pending");

  if (pending.length > 0) {
    const lastConfirm = pending[pending.length - 1];
    const plan = (await runtime.psg.getNode("Plan", lastConfirm.target_id)) as any;
    const assetId = plan.steps[1].target_node_id;

    const asset = (await runtime.psg.getNode("domain:ContentAsset", assetId)) as any;

    console.log("=== EVIDENCE-1: Queue Item Mock (from index.ts mapping) ===");
    console.log(
      JSON.stringify(
        {
          id: lastConfirm.id,
          category: "outreach",
          asset_id: asset?.id,
          target_id: "clean-target-ev",
          drafted_by_role: asset?.metadata?.drafted_by_role,
          rationale_bullets: asset?.metadata?.rationale_bullets,
        },
        null,
        2,
      ),
    );

    console.log("=== EVIDENCE-2: VSL Object ===");
    console.log(JSON.stringify(asset, null, 2));

    console.log("=== EVIDENCE-3: Underlying Plan ===");
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log("No pending confirms found.");
  }
}

run().catch(console.error);
