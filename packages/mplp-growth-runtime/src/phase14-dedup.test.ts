import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { executeCommand, getRuntime, resetState } from "./commands/orchestrator";
import { createOutreachTarget, createContentAsset, createChannelProfile } from "./psg/growth-nodes";
import { runnerState } from "./runner/state";
import { FileVSL } from "./vsl/file-vsl";

describe("Phase 14 Gates — Outreach Deduplication (v0.4.1)", () => {
  let vsl: FileVSL;
  let activeContextId: string;

  beforeAll(async () => {
    const basePath = path.join(os.tmpdir(), "mplp-growth-test-phase14-" + Date.now());
    process.env.MPLP_GROWTH_STATE_DIR = basePath;
    vsl = new FileVSL({ basePath });

    // Setup clean runtime context
    resetState();

    // Create base context and profiles so command can run
    const contextNode = {
      type: "Context",
      id: "context-p14",
      context_id: "context-p14",
      brand: {
        name: "TestBrand",
        forbidden_terms: [],
      },
    };
    await vsl.set("Context/context-p14", contextNode);

    // Now init orchestrator state
    const { psg } = await getRuntime();
    activeContextId = "context-p14";

    await psg.putNode(createChannelProfile({ context_id: activeContextId, platform: "x" }));
  });

  describe("GATE-OUTREACH-DEDUP-METADATA-01", () => {
    it("deduplicates using newly added metadata properties", async () => {
      const { psg } = await getRuntime();
      // Insert targeted OT
      const target = createOutreachTarget({
        context_id: activeContextId,
        name: "Acme Corp P14",
        org_type: "company",
      });
      await psg.putNode(target);

      // Insert recent metadata asset
      const asset = createContentAsset({
        context_id: activeContextId,
        asset_type: "outreach_email",
        title: "Random unrelated title string", // Intentional to prove metadata deduplicates
        content: "Drafting",
        metadata: {
          target_id: target.id,
          channel: "x",
        },
      });
      await psg.putNode(asset);

      // Run orchestrator
      const output = await executeCommand("outreach", ["--segment", "company", "--channel", "x"]);
      expect(output).toContain("No new outreach needed in last 7 days");
      expect(output).toContain("All 1 targets skipped");
    });
  });

  describe("GATE-OUTREACH-DEDUP-FALLBACK-01", () => {
    it("falls back to title when metadata is absent", async () => {
      const { psg } = await getRuntime();
      // Insert targeted OT
      const target = createOutreachTarget({
        context_id: activeContextId,
        name: "Globe Inc P14",
        org_type: "foundation",
      });
      await psg.putNode(target);

      // Insert older asset format (Title only)
      const asset = createContentAsset({
        context_id: activeContextId,
        asset_type: "outreach_email",
        title: `Outreach to Globe Inc P14 via x`,
        content: "Drafting based on title matching",
      });
      await psg.putNode(asset);

      // Run orchestrator
      const output = await executeCommand("outreach", [
        "--segment",
        "foundation",
        "--channel",
        "x",
      ]);
      expect(output).toContain("No new outreach needed in last 7 days");
      expect(output).toContain("All 1 targets skipped");
    });
  });
});
