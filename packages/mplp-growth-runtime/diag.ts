import os from "os";
import path from "path";
import { EventEmitter } from "./src/glue/event-emitter";
import { InMemoryPSG } from "./src/psg/in-memory-psg";
import { FileVSL } from "./src/vsl/file-vsl";

async function run() {
  const basePath = path.join(os.homedir(), ".openclaw", "mplp-growth");
  const vsl = new FileVSL({ basePath });
  const psg = new InMemoryPSG({ contextId: "ignore" }, vsl, new EventEmitter("ignore"));

  const ctxs = await psg.query<any>({ type: "Context" });
  if (ctxs.length === 0) {
    return console.log("NO CONTEXT");
  }
  const cid = ctxs[0].id;

  const confirms = await psg.query<any>({ type: "Confirm", context_id: cid });
  console.log(
    "Confirms:",
    confirms.map((c: any) => ({ status: c.status, type: c.source_node_type })),
  );
}
run().catch(console.error);
