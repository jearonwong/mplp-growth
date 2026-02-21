import fs from "fs";
import path from "path";

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
  console.log("Mock data queued successfully.");
}

run().catch(console.error);
