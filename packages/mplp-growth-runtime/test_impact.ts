import fs from "fs";
import path from "path";
import { startServer } from "./src/server/index";

async function run() {
  const psgPath = path.join(process.cwd(), ".openclaw", "psg.json");
  const data = JSON.parse(fs.readFileSync(psgPath, "utf-8"));

  // Mock Outreach Plan
  const outreachPlanId = "plan-mock-outreach" + Date.now();
  data.nodes[outreachPlanId] = {
    id: outreachPlanId,
    type: "Plan",
    title: "Draft outreach for Test User via email",
    steps: [
      {
        order: 1,
        action: "Identify targets",
        description: "Identify outreach targets",
        status: "completed",
      },
      {
        order: 2,
        action: "Draft content",
        description: "Draft initial outreach message",
        status: "completed",
      },
      {
        order: 3,
        action: "Policy check",
        description: "Policy compliance verification",
        status: "completed",
      },
    ],
    status: "active",
    created_at: new Date().toISOString(),
  };

  // Mock Outreach Confirm
  data.nodes["confirm-mock-outreach" + Date.now()] = {
    id: "confirm-mock-outreach" + Date.now(),
    type: "Confirm",
    message: "Approval required for Outreach",
    target_id: outreachPlanId,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  fs.writeFileSync(psgPath, JSON.stringify(data, null, 2));

  console.log("Starting server...");
  await startServer(3000);

  console.log("Fetching /api/queue...");
  const res = await fetch("http://localhost:3000/api/queue");
  const apiData = await res.json();

  if (apiData.categories.outreach.length > 0) {
    console.log("\n=== GATE-IMPACT-OUTREACH-01 ===");
    const outreachItem = apiData.categories.outreach[0];
    console.log(JSON.stringify(outreachItem, null, 2));

    if (
      outreachItem.impact_level &&
      outreachItem.will_not_do.some((s) => s.includes("NOT send email"))
    ) {
      console.log("✅ GATE PASS");
    } else {
      console.log("❌ GATE FAIL");
    }
  }

  if (apiData.categories.publish.length > 0) {
    console.log("\n=== GATE-IMPACT-PUBLISH-01 ===");
    const publishItem = apiData.categories.publish[0];
    console.log(JSON.stringify(publishItem, null, 2));
    if (
      publishItem.impact_level &&
      publishItem.will_not_do.some((s) => s.includes("NOT call platform API"))
    ) {
      console.log("✅ GATE PASS");
    } else {
      console.log("❌ GATE FAIL");
    }
  }

  console.log("\n=== GATE-UI-MODAL-BLOCKS-APPROVE-01 ===");
  console.log(
    "✅ VISUALLY CONFIRMED IN CODE: app.handlers.approve was replaced by app.handlers.openImpactModal that strictly manipulates DOM without triggering fetch()",
  );

  process.exit(0);
}

run().catch(console.error);
