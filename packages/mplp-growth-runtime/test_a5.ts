import { startServer } from "./src/server/index";

async function run() {
  console.log("Starting server...");
  await startServer(3000);

  // 1. Send data to Manual Inbox API
  console.log("Pushing manual interaction...");
  const pushRes = await fetch("http://localhost:3000/api/inbox/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author_handle: "jasonwang",
      content: "Great post about the validation lab!",
      source_ref: "manual-ref-123",
    }),
  });
  console.log("Push Result:", await pushRes.json());

  // 2. Execute inbox worker via API to share memory state
  console.log("Running inbox polling task via API...");
  await fetch("http://localhost:3000/api/runner/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: "inbox" }),
  });

  // Wait to let PSG hooks resolve side-effects and queue updates
  await new Promise((r) => setTimeout(r, 4000));

  // 3. Fetch queue to verify the badge exists in the HTML preview response
  console.log("Fetching /api/queue...");
  const queueRes = await fetch("http://localhost:3000/api/queue");
  const queueData = await queueRes.json();

  if (queueData.categories.inbox.length > 0) {
    const inboxItem = queueData.categories.inbox[0];
    console.log("\n=== GATE-INBOX-BADGES-01 ===");
    console.log("Preview:\n", inboxItem.preview);

    if (inboxItem.preview.includes('class="badge"') && inboxItem.preview.includes("MANUAL")) {
      console.log("✅ GATE PASS");
    } else {
      console.log("❌ GATE FAIL - Badges missing from preview payload");
    }
  } else {
    console.log("❌ GATE FAIL - Inbox queue is empty");
  }

  process.exit(0);
}

run().catch(console.error);
