/**
 * Phase 2 Gates — Seed Data Integrity
 *
 * GATE-DOMAIN-CONTEXT-BINDING-01: All Domain Nodes must have context_id
 * GATE-CHANNELPROFILE-MINSET-01: active ChannelProfiles ≥ 3
 * GATE-BRAND-FORBIDDEN-TERMS-01: forbidden_terms non-empty
 */

import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import type { Context } from "./modules/mplp-modules";
import type { ChannelProfileNode, OutreachTargetNode, ContentAssetNode } from "./psg/growth-nodes";
import { FileVSL } from "./vsl/file-vsl";

describe("Phase 2 Gates — Seed Data Integrity", () => {
  let vsl: FileVSL;
  let context: Context | null = null;
  let channelProfiles: ChannelProfileNode[] = [];

  beforeAll(async () => {
    const basePath = path.join(os.homedir(), ".openclaw", "mplp-growth");
    vsl = new FileVSL({ basePath });

    // Try to load context
    const contextKeys = await vsl.listKeys("Context");
    if (contextKeys.length > 0) {
      context = await vsl.get<Context>(contextKeys[0]);
    }

    // Load channel profiles
    const channelKeys = await vsl.listKeys("domain:ChannelProfile");
    for (const key of channelKeys) {
      const profile = await vsl.get<ChannelProfileNode>(key);
      if (profile) {
        channelProfiles.push(profile);
      }
    }
  });

  describe("GATE-DOMAIN-CONTEXT-BINDING-01", () => {
    it("all ChannelProfiles must have context_id", async () => {
      expect(channelProfiles.length).toBeGreaterThan(0);
      for (const profile of channelProfiles) {
        expect(profile.context_id).toBeDefined();
        expect(profile.context_id).not.toBe("");
      }
    });

    it("all Domain Nodes must have matching context_id", async () => {
      if (!context) {
        throw new Error("Context not seeded - run seed first");
      }

      for (const profile of channelProfiles) {
        expect(profile.context_id).toBe(context.context_id);
      }
    });
  });

  describe("GATE-CHANNELPROFILE-MINSET-01", () => {
    it("active ChannelProfiles >= 3", async () => {
      const activeProfiles = channelProfiles.filter((p) => p.status === "active");
      expect(activeProfiles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GATE-BRAND-FORBIDDEN-TERMS-01", () => {
    it("forbidden_terms must be non-empty", async () => {
      if (!context) {
        throw new Error("Context not seeded - run seed first");
      }

      const brand = context.root.brand;
      expect(brand).toBeDefined();
      expect(brand?.forbidden_terms).toBeDefined();
      expect(brand?.forbidden_terms.length).toBeGreaterThan(0);
    });
  });

  describe("Seed Data Completeness", () => {
    it("Context exists with brand/audience/cadence", async () => {
      expect(context).not.toBeNull();
      expect(context?.root.brand).toBeDefined();
      expect(context?.root.audiences).toBeDefined();
      expect((context?.root as any).cadence).toBeDefined();
    });

    it(">= 1 OutreachTarget exists", async () => {
      const keys = await vsl.listKeys("domain:OutreachTarget");
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });

    it(">= 1 ContentAsset example exists", async () => {
      const keys = await vsl.listKeys("domain:ContentAsset");
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });
  });
});
