import { startServer } from "./src/server/index";

async function run() {
  await startServer(3000);

  const healthRes = await fetch("http://localhost:3000/api/health");
  const healthJson = await healthRes.json();
  console.log("\n=== /api/health ===");
  console.log(JSON.stringify(healthJson, null, 2));

  const queueRes = await fetch("http://localhost:3000/api/queue");
  const queueJson = await queueRes.json();
  console.log("\n=== /api/queue ===");
  console.log(JSON.stringify(queueJson[0], null, 2)); // Just the first item

  process.exit(0);
}

run().catch(console.error);
