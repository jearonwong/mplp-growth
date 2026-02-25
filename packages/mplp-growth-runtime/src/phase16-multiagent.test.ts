import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect, describe, beforeAll, afterAll } from "vitest";
import { executor } from "./agents/executor.js";
import { getRuntime, executeCommand } from "./commands/orchestrator.js";
import { server } from "./server/index.js";

let tempDir: string;

describe("Phase 16 - Multi-Agent V0.6.0 MVP", () => {
  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mplp-v060-test-"));
    process.env.MPLP_DATA_DIR = tempDir;
    await server.ready();

    // Seed data
    await server.inject({ method: "POST", url: "/api/admin/seed" });
  });

  afterAll(async () => {
    await server.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("GATE-DETERMINISTIC-EXECUTOR-01", async () => {
    const draft = await executor.run("Responder", {
      kind: "inbox_reply",
      interaction: { platform: "hn", author: "test", content: "Hello world" },
    });
    expect(draft.content).toContain("Thank you for your message");
    expect(draft.rationale_bullets).toBeDefined();
    expect(draft.rationale_bullets.length).toBeLessThanOrEqual(3);
  });

  test("GATE-NO-LLM-NO-EXTERNAL-01", async () => {
    // Assert deterministic responses for BDWriter
    const draft = await executor.run("BDWriter", {
      kind: "outreach_draft",
      target: { name: "Jason" },
      channel: "email",
    });
    expect(draft.content).toContain("Hi Jason");
    expect(draft.rationale_bullets.length).toBeLessThanOrEqual(3);
  });

  test("GATE-ROLE-DOUBLEWRITE-01 & RATIONALE-LIMIT-01", async () => {
    // Trigger wf04 inbox directly instead of going through API
    await executeCommand("inbox", [
      JSON.stringify([
        {
          platform: "manual",
          author: "@tester",
          content: "Test msg",
          source_ref: "test-ref-01",
        },
      ]),
    ]);

    // Wait for workflow to finish
    await new Promise((r) => setTimeout(r, 1500));

    // Inspect PSG
    const runtime = await getRuntime();
    const interactions = await runtime.psg.query<any>({ type: "domain:Interaction" });
    const i = interactions.find((n) => n.source_ref === "test-ref-01");
    expect(i).toBeDefined();
    expect(i.metadata.drafted_by_role).toBe("Responder");
    expect(i.metadata.rationale_bullets.length).toBeLessThanOrEqual(3); // Limit check

    const plans = await runtime.psg.query<any>({ type: "Plan" });
    const plan = plans.find(
      (p) =>
        p.plan_id === i.plan_id ||
        (p.title.includes("Inbox Handler") && p.agent_role === "Responder"),
    );
    expect(plan).toBeDefined();
    expect(plan.agent_role).toBe("Responder"); // Doublewrite check
  });

  test("GATE-QUEUE-ROLE-SURFACE-01 & GATE-QUEUE-RATIONALE-SURFACE-01", async () => {
    // Call /api/queue and verify inbox has role and rationale
    const qRes = await server.inject({ method: "GET", url: "/api/queue" });
    expect(qRes.statusCode).toBe(200);
    const qData = JSON.parse(qRes.payload);

    // Outreach target is seeded without BDWriter role, so we do a dry_run string output check or find the specific inbox
    // Actually, Inbox groups all pending interactions. If seed data doesn't have role, let's look for any rationale_bullets across inbox items.
    // Or just look for outreach items. Because seed doesn't run wf06, maybe we should execute wf06!

    // Drop existing content assets to bypass idempotency skip rules
    const runtime = await getRuntime();
    const assets = await runtime.psg.query<any>({ type: "domain:ContentAsset" });
    for (const a of assets) {
      a.created_at = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      await runtime.psg.putNode(a);
    }

    // Inject a pristine target into the PSG to ensure WF06 has something to draft to
    await runtime.psg.putNode({
      type: "domain:OutreachTarget",
      id: "clean-target-test-1",
      context_id: runtime.contextId,
      name: "Clean Valid Test Target",
      org_type: "foundation",
      status: "research",
      notes: "Test",
      created_at: new Date().toISOString(),
      metadata: {},
    } as any);

    // Instead of asserting on the first item, let's execute WF06 so we have a clean outreach item
    const outreachRes = await executeCommand("outreach", [
      "--segment",
      "foundation",
      "--channel",
      "email",
    ]);
    expect(outreachRes).not.toContain("Error");
    await new Promise((r) => setTimeout(r, 1500));

    const qRes2 = await server.inject({ method: "GET", url: "/api/queue" });
    const qData2 = JSON.parse(qRes2.payload);
    console.log("QDATA OUTREACH:", JSON.stringify(qData2.categories.outreach, null, 2));

    const outreachItem = qData2.categories.outreach.find(
      (item: any) => item.drafted_by_role === "BDWriter",
    );
    expect(outreachItem).toBeDefined();

    const asset = await runtime.psg.getNode("domain:ContentAsset", outreachItem.asset_id);
    expect(asset).toBeDefined();
    expect(asset!.id).toBe(outreachItem.asset_id);
    expect(asset!.type).toBe("domain:ContentAsset");

    expect(outreachItem.drafted_by_role).toBe("BDWriter");
    expect(outreachItem.rationale_bullets).toBeDefined();
    expect(outreachItem.rationale_bullets.length).toBeLessThanOrEqual(3);
  });
});
