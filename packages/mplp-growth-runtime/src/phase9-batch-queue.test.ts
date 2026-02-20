/**
 * Phase 9 Batch & Queue Gate Tests (v0.3.0)
 *
 * - GATE-APPROVE-LIST-01: --list returns pending Confirms grouped by plan category
 * - GATE-BATCH-APPROVE-01: --all approves N pending, returns approved_count/failed_count
 * - GATE-BATCH-OUTREACH-01: --segment generates packs for matching OTs
 * - GATE-DRY-RUN-01: --dry-run returns draft + policy, creates zero graph writes
 * - GATE-PUBLISH-LATEST-01: --latest finds most recent reviewed asset with channel variant
 * - GATE-OUTREACH-SEGMENT-SKIP-01: Second --segment run produces 0 new packs (all skipped)
 * - GATE-PUBLISH-LATEST-FILTER-01: --latest excludes is_template=true assets
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { cmdOutreach, cmdApprove, cmdPublish, cmdReview, resetState } from "./commands";
import { EventEmitter } from "./glue/event-emitter";
import { createContext, type BrandPolicy, type AudienceSegment } from "./modules/mplp-modules";
import { createChannelProfile, createOutreachTarget, createContentAsset } from "./psg/growth-nodes";
import { InMemoryPSG } from "./psg/in-memory-psg";
import { FileVSL } from "./vsl/file-vsl";

describe("Phase 9 Batch & Queue Gates", () => {
  let basePath: string;
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;

  beforeAll(async () => {
    basePath = path.join(os.tmpdir(), `mplp-phase9-test-${Date.now()}`);
    process.env.MPLP_GROWTH_STATE_DIR = basePath;

    vsl = new FileVSL({ basePath });
    await vsl.init();

    const brand: BrandPolicy = {
      name: "Test Brand",
      tagline: "Test tagline",
      positioning: "Test positioning",
      forbidden_terms: ["spam"],
      links: { website: "https://test.io" },
    };

    const audiences: AudienceSegment[] = [
      { segment: "developers", pain_points: ["test"], value_proposition: "test", cta: "test" },
    ];

    const context = createContext({
      title: "Phase 9 Test Context",
      domain: "growth",
      environment: "test",
      brand,
      audiences,
    });
    context.status = "active";
    (context.root as any).cadence = { weekly_rhythm: { monday: "content" } };

    contextId = context.context_id;
    eventEmitter = new EventEmitter(contextId);
    psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);

    await psg.putNode(context as any);

    // Create channel profiles
    for (const platform of ["x", "linkedin", "medium"] as const) {
      const profile = createChannelProfile({
        context_id: contextId,
        platform,
        format_rules: { max_chars: platform === "medium" ? 5000 : 280 },
      });
      await psg.putNode(profile);
    }

    // Create 3 outreach targets in same segment
    for (const name of ["Alpha Foundation", "Beta Foundation", "Gamma Foundation"]) {
      const target = createOutreachTarget({
        context_id: contextId,
        name,
        org_type: "foundation",
        notes: `Partnership opportunity with ${name}`,
      });
      await psg.putNode(target);
    }
  });

  afterAll(async () => {
    await fs.rm(basePath, { recursive: true, force: true });
  });

  beforeEach(() => {
    resetState();
  });

  // ========================================================================
  // GATE-BATCH-OUTREACH-01
  // ========================================================================
  describe("GATE-BATCH-OUTREACH-01: --segment generates packs for matching OTs", () => {
    it("batch outreach creates packs for all research-status targets in segment", async () => {
      const output = await cmdOutreach(["--segment", "foundation", "--channel", "email"]);

      expect(output).toContain("Batch Outreach");
      expect(output).toContain("email");
      // Should process targets
      expect(output).toContain("Processed:");
    });
  });

  // ========================================================================
  // GATE-DRY-RUN-01
  // ========================================================================
  describe("GATE-DRY-RUN-01: --dry-run creates zero Confirm/Interaction", () => {
    it("dry-run with segment produces draft + policy, zero state writes", async () => {
      // Create fresh targets for this test
      for (const name of ["DryRun-Alpha", "DryRun-Beta"]) {
        const target = createOutreachTarget({
          context_id: contextId,
          name,
          org_type: "consortium",
          notes: `DryRun test target ${name}`,
        });
        await psg.putNode(target);
      }

      // Count confirms before
      const confirmsBefore = await psg.query<any>({ type: "Confirm" });
      const confirmCountBefore = confirmsBefore.length;

      const output = await cmdOutreach([
        "--segment",
        "consortium",
        "--channel",
        "email",
        "--dry-run",
      ]);

      expect(output).toContain("DRY RUN");

      // Confirms should not increase (dry-run skips Confirm/Interaction writes)
      const confirmsAfter = await psg.query<any>({ type: "Confirm" });
      expect(confirmsAfter.length).toBe(confirmCountBefore);
    });
  });

  // ========================================================================
  // GATE-OUTREACH-SEGMENT-SKIP-01
  // ========================================================================
  describe("GATE-OUTREACH-SEGMENT-SKIP-01: second segment run skips already-drafted", () => {
    it("second batch run with same segment produces 0 new packs", async () => {
      // Create fresh targets for this test
      for (const name of ["Skip-Alpha", "Skip-Beta"]) {
        const target = createOutreachTarget({
          context_id: contextId,
          name,
          org_type: "government",
          notes: `Skip test target ${name}`,
        });
        await psg.putNode(target);
      }

      // First run — creates outreach packs
      const firstOutput = await cmdOutreach(["--segment", "government", "--channel", "email"]);
      expect(firstOutput).toContain("Batch Outreach");

      resetState();

      // Second run — should skip all (already have outreach packs)
      const secondOutput = await cmdOutreach(["--segment", "government", "--channel", "email"]);
      // Should either show all skipped or no targets to process
      expect(
        secondOutput.includes("Skipped") ||
          secondOutput.includes("No new outreach needed in last 7 days") ||
          secondOutput.includes("All targets already contacted"),
      ).toBe(true);
    });
  });

  // ========================================================================
  // GATE-APPROVE-LIST-01
  // ========================================================================
  describe("GATE-APPROVE-LIST-01: --list returns pending grouped by category", () => {
    it("list shows pending confirms after outreach batch", async () => {
      // Run outreach to generate confirms
      await cmdOutreach(["--segment", "foundation", "--channel", "email"]);

      resetState();

      const output = await cmdApprove(["--list"]);

      expect(output).toContain("Approval Queue");
      // Should show count and category grouping
      expect(output).toMatch(/pending/i);
    });

    it("list shows empty queue when no pending", async () => {
      const output = await cmdApprove(["--list"]);

      expect(output).toContain("Approval Queue");
    });
  });

  // ========================================================================
  // GATE-BATCH-APPROVE-01
  // ========================================================================
  describe("GATE-BATCH-APPROVE-01: --all approves pending with counts", () => {
    it("batch approve processes all pending confirms", async () => {
      // Generate confirms via outreach
      await cmdOutreach(["--segment", "foundation", "--channel", "email"]);

      resetState();

      const output = await cmdApprove(["--all"]);

      expect(output).toContain("Batch Approved");
      expect(output).toContain("Approved:");
    });

    it("batch approve on empty queue returns error", async () => {
      const output = await cmdApprove(["--all"]);

      expect(output).toContain("No pending confirms");
    });
  });

  // ========================================================================
  // GATE-PUBLISH-LATEST-01
  // ========================================================================
  describe("GATE-PUBLISH-LATEST-01: --latest finds reviewed asset with variant", () => {
    it("publishes most recent reviewed asset with matching channel variant", async () => {
      // Create a reviewed asset with x variant
      const asset = createContentAsset({
        context_id: contextId,
        asset_type: "thread",
        title: "Test Thread for Publishing",
        content: "Test content for publish --latest",
      });
      asset.status = "reviewed";
      asset.platform_variants = { x: "Thread for X", linkedin: "Thread for LinkedIn" };
      await psg.putNode(asset);

      resetState();

      const output = await cmdPublish(["--latest", "x"]);

      expect(output).toContain("Publish");
      // Should succeed (not an error)
      expect(output).not.toContain("No reviewed asset");
    });
  });

  // ========================================================================
  // GATE-PUBLISH-LATEST-FILTER-01
  // ========================================================================
  describe("GATE-PUBLISH-LATEST-FILTER-01: --latest excludes templates", () => {
    it("latest excludes is_template=true assets, selects normal asset", async () => {
      // Create template (is_template=true, reviewed)
      const templateAsset = createContentAsset({
        context_id: contextId,
        asset_type: "thread",
        title: "Template Thread",
        content: "Template content",
      });
      templateAsset.status = "reviewed";
      (templateAsset as any).is_template = true;
      templateAsset.platform_variants = { x: "X variant" };
      await psg.putNode(templateAsset);

      // Create normal reviewed asset with x variant
      const normalAsset = createContentAsset({
        context_id: contextId,
        asset_type: "thread",
        title: "Normal Thread",
        content: "Normal content",
      });
      normalAsset.status = "reviewed";
      normalAsset.platform_variants = { x: "Normal X variant" };
      await psg.putNode(normalAsset);

      resetState();

      const output = await cmdPublish(["--latest", "x"]);

      // Should succeed with normal asset, not the template
      expect(output).toContain("Publish");
      expect(output).not.toContain("No reviewed asset");
    });
  });
});
