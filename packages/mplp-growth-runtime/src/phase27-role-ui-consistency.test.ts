/**
 * Phase 27: Role UI Consistency Gate Tests (v0.7.2)
 *
 * GATE-ROLE-AUTO-LABEL-01: settings dropdown shows "(Auto)" not "Default"
 * GATE-ROLE-DEFAULT-CLEARS-01: selecting (Auto) posts run_as_role:null
 * GATE-REDRAFT-REQUIRES-ROLE-01: redraft without role cannot submit
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, beforeAll } from "vitest";

describe("Phase 27: Role UI Consistency (v0.7.2)", () => {
  let appJs: string;

  beforeAll(() => {
    appJs = readFileSync(resolve(__dirname, "ui-static/app.js"), "utf-8");
  });

  describe("GATE-ROLE-AUTO-LABEL-01: settings dropdown shows (Auto)", () => {
    it("settings role dropdown uses (Auto) label", () => {
      expect(appJs).toContain("(Auto)");
      expect(appJs).not.toContain('"Default"');
      expect(appJs).not.toContain(">Default<");
    });
  });

  describe("GATE-ROLE-BADGE-FALLBACK-01: queue badge shows Auto when no role", () => {
    it("badge falls back to 'Auto' when drafted_by_role is missing", () => {
      // The renderQueueItem function should use || "Auto" for the badge
      expect(appJs).toContain('item.drafted_by_role || "Auto"');
    });
  });

  describe("GATE-ROLE-DEFAULT-CLEARS-01: (Auto) selection posts null", () => {
    it("changeJobRole handler sends null on empty value", () => {
      // The handler should post run_as_role: null when value is empty
      expect(appJs).toContain('run_as_role: roleVal === "" ? null : roleVal');
    });
  });

  describe("GATE-REDRAFT-REQUIRES-ROLE-01: no role → cannot submit", () => {
    it("confirmRedraft checks roleId and shows error message", () => {
      // The confirmRedraft handler should check for empty roleId and show hint
      expect(appJs).toContain("Select a role to redraft");
    });

    it("returns early without making API call", () => {
      // After showing error, the handler should return before fetch
      const confirmRedraftMatch = appJs.match(
        /confirmRedraft[\s\S]*?Select a role to redraft[\s\S]*?return;/,
      );
      expect(confirmRedraftMatch).not.toBeNull();
    });
  });
});
