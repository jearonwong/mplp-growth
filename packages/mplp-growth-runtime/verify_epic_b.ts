import { startServer } from "./src/server/index";

async function run() {
  await startServer(3000);

  // 1. Get initial status
  const statusRes = await fetch("http://localhost:3000/api/runner/status");
  const statusJson = await statusRes.json();
  console.log("\n=== /api/runner/status (Initial) ===");
  console.log(JSON.stringify(statusJson, null, 2));

  // 2. Trigger "brief" task via Run Now
  console.log("\n=== Triggering 'brief' via /api/runner/execute ===");
  const triggerRes = await fetch("http://localhost:3000/api/runner/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: "brief" }),
  });
  console.log(await triggerRes.json());

  // Wait a moment for execution
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Get updated status
  const updatedRes = await fetch("http://localhost:3000/api/runner/status");
  const updatedJson = await updatedRes.json();
  console.log("\n=== /api/runner/status (After Run) ===");
  const briefJob = updatedJson.jobs["brief"];
  console.log(JSON.stringify({ brief: briefJob }, null, 2));

  process.exit(0);
}

run().catch(console.error);
