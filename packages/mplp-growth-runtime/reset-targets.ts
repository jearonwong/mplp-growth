import { getRuntime } from "./src/server/context.js";

async function run() {
  const runtime = await getRuntime();
  const targets = (await runtime.psg.query({ type: "domain:OutreachTarget" })) as any[];
  for (const t of targets) {
    t.status = "research";
    await runtime.psg.putNode(t);
  }
  console.log("Reset", targets.length, "targets");
}
run();
