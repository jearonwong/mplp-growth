/**
 * Phase 8 Seed Production Gate Tests
 *
 * Verifies that seed.ts produces the expected production baseline:
 * - GATE-SEED-EXTENSIONS-01: ≥2 Extensions with expected names
 * - GATE-SEED-OUTREACHTARGETS-01: ≥3 OutreachTargets
 */

import { describe, it, expect } from "vitest";
import { OUTREACH_TARGETS, EXTENSION_CONFIGS } from "./seed";

describe("Phase 8 Seed Production Gates", () => {
  // ========================================================================
  // GATE-SEED-EXTENSIONS-01
  // ========================================================================
  describe("GATE-SEED-EXTENSIONS-01: Extension seed data", () => {
    it("EXTENSION_CONFIGS contains ≥ 2 entries", () => {
      expect(EXTENSION_CONFIGS.length).toBeGreaterThanOrEqual(2);
    });

    it("includes outreach-policy-default (policy)", () => {
      const policy = EXTENSION_CONFIGS.find((e) => e.name === "outreach-policy-default");
      expect(policy).toBeDefined();
      expect(policy!.extension_type).toBe("policy");
      expect(policy!.version).toBe("1.0.0");
      expect(policy!.config.require_confirm).toBe(true);
      expect(policy!.config.forbidden_patterns).toBeDefined();
    });

    it("includes channel-adapter-email (integration)", () => {
      const adapter = EXTENSION_CONFIGS.find((e) => e.name === "channel-adapter-email");
      expect(adapter).toBeDefined();
      expect(adapter!.extension_type).toBe("integration");
      expect(adapter!.config.channel).toBe("email");
    });
  });

  // ========================================================================
  // GATE-SEED-OUTREACHTARGETS-01
  // ========================================================================
  describe("GATE-SEED-OUTREACHTARGETS-01: OutreachTarget seed data", () => {
    it("OUTREACH_TARGETS contains ≥ 3 entries", () => {
      expect(OUTREACH_TARGETS.length).toBeGreaterThanOrEqual(3);
    });

    it("includes Linux Foundation, CNCF, and ISO/IEC JTC 1", () => {
      const names = OUTREACH_TARGETS.map((t) => t.name);
      expect(names).toContain("Linux Foundation");
      expect(names).toContain("CNCF (Cloud Native Computing Foundation)");
      expect(names).toContain("ISO/IEC JTC 1");
    });
  });
});
