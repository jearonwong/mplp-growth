/**
 * Phase 3 Workflow Tests
 *
 * Tests for WF-01/02/03 including 5 new gates:
 * - GATE-WF-PLAN-TRACE-BINDING-01
 * - GATE-WF-CONFIRM-REQUIRED-01
 * - GATE-ASSET-STATUS-TRANSITION-01
 * - GATE-EXPORT-PACK-EXISTS-01
 * - GATE-EVENT-COUNT-MIN-01
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Context } from "./modules/mplp-modules";
import { EventEmitter } from "./glue/event-emitter";
import { InMemoryPSG } from "./psg/in-memory-psg";
import { FileVSL } from "./vsl/file-vsl";
import { runWeeklyBrief } from "./workflows/wf01-weekly-brief";
import { runContentFactory } from "./workflows/wf02-content-factory";
import { runPublishPack } from "./workflows/wf03-publish-pack";

describe("Phase 3 Workflow Tests", () => {
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;
  const basePath = path.join(os.homedir(), ".openclaw", "mplp-growth");

  beforeAll(async () => {
    // Initialize runtime
    vsl = new FileVSL({ basePath });

    // Load existing context from Phase 2 seed
    const contextKeys = await vsl.listKeys("Context");
    if (contextKeys.length === 0) {
      throw new Error("No seeded Context found. Run npm run seed first.");
    }

    const context = await vsl.get<Context>(contextKeys[0]);
    if (!context) {
      throw new Error("Failed to load Context");
    }
    contextId = context.context_id;

    eventEmitter = new EventEmitter(contextId);
    psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);

    // Load the context into PSG
    await psg.putNode(context as any);

    // Load all seeded nodes
    const channelKeys = await vsl.listKeys("domain:ChannelProfile");
    for (const key of channelKeys) {
      const node = await vsl.get(key);
      if (node) {
        await psg.putNode(node as any);
      }
    }
  });

  describe("WF-01 Weekly Brief", () => {
    it("should create plan and trace", async () => {
      const result = await runWeeklyBrief({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.trace).toBeDefined();
      expect(result.plan.steps.length).toBeGreaterThanOrEqual(1);
    });

    it("GATE-WF-PLAN-TRACE-BINDING-01: trace.plan_id == plan.plan_id", async () => {
      const result = await runWeeklyBrief({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.trace.plan_id).toBe(result.plan.plan_id);
    });

    it("GATE-EVENT-COUNT-MIN-01: PipelineStageEvent >= 4", async () => {
      const result = await runWeeklyBrief({ context_id: contextId }, { psg, vsl, eventEmitter });

      expect(result.events.pipeline_stage_count).toBeGreaterThanOrEqual(4);
    });
  });

  describe("WF-02 Content Factory", () => {
    it("should create asset and confirm", async () => {
      const result = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "thread",
          topic: "Test thread for Phase 3",
        },
        { psg, vsl, eventEmitter },
      );

      expect(result.success).toBe(true);
      expect(result.confirm).toBeDefined();
      expect(result.outputs.asset_id).toBeDefined();
    });

    it("GATE-WF-CONFIRM-REQUIRED-01: must create Confirm with target_type=other", async () => {
      const result = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "post",
        },
        { psg, vsl, eventEmitter },
      );

      expect(result.confirm).toBeDefined();
      expect(result.confirm!.target_type).toBe("other");
    });

    it("GATE-WF-PLAN-TRACE-BINDING-01: trace.plan_id == plan.plan_id", async () => {
      const result = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "thread",
        },
        { psg, vsl, eventEmitter },
      );

      expect(result.trace.plan_id).toBe(result.plan.plan_id);
    });
  });

  describe("WF-03 Publish Pack", () => {
    let testAssetId: string;

    beforeAll(async () => {
      // Create a test asset first
      const createResult = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "thread",
          topic: "Asset for publish test",
        },
        { psg, vsl, eventEmitter },
      );
      testAssetId = createResult.outputs.asset_id as string;
    });

    it("should publish asset and create export", async () => {
      const result = await runPublishPack(
        {
          context_id: contextId,
          asset_id: testAssetId,
          channel: "x",
        },
        { psg, vsl, eventEmitter, basePath },
      );

      if (!result.success) {
        console.log("WF-03 publish failed:", result.error);
      }
      expect(result.success).toBe(true);
      expect(result.outputs.export_path).toBeDefined();
    });

    it("GATE-EXPORT-PACK-EXISTS-01: export file must exist", async () => {
      // Create another asset for this test
      const createResult = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "post",
          topic: "Export test asset",
        },
        { psg, vsl, eventEmitter },
      );

      const result = await runPublishPack(
        {
          context_id: contextId,
          asset_id: createResult.outputs.asset_id as string,
          channel: "linkedin",
        },
        { psg, vsl, eventEmitter, basePath },
      );

      expect(result.success).toBe(true);
      const exportPath = result.outputs.export_path as string;

      const stat = await fs.stat(exportPath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
    });

    it("GATE-WF-CONFIRM-REQUIRED-01: must create Confirm with target_type=other", async () => {
      const createResult = await runContentFactory(
        {
          context_id: contextId,
          asset_type: "thread",
        },
        { psg, vsl, eventEmitter },
      );

      const result = await runPublishPack(
        {
          context_id: contextId,
          asset_id: createResult.outputs.asset_id as string,
          channel: "x",
        },
        { psg, vsl, eventEmitter, basePath },
      );

      expect(result.confirm).toBeDefined();
      expect(result.confirm!.target_type).toBe("other");
      expect(result.confirm!.target_id).toBe(createResult.outputs.asset_id);
    });
  });

  describe("GATE-ASSET-STATUS-TRANSITION-01", () => {
    it("cannot publish already published asset", async () => {
      // Create and publish an asset
      const createResult = await runContentFactory(
        { context_id: contextId, asset_type: "thread" },
        { psg, vsl, eventEmitter },
      );

      const publishResult1 = await runPublishPack(
        {
          context_id: contextId,
          asset_id: createResult.outputs.asset_id as string,
          channel: "x",
        },
        { psg, vsl, eventEmitter, basePath },
      );
      expect(publishResult1.success).toBe(true);

      // Try to publish again
      const publishResult2 = await runPublishPack(
        {
          context_id: contextId,
          asset_id: createResult.outputs.asset_id as string,
          channel: "linkedin",
        },
        { psg, vsl, eventEmitter, basePath },
      );

      expect(publishResult2.success).toBe(false);
      expect(publishResult2.error).toContain("already published");
    });
  });
});
