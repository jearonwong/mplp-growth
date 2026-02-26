/**
 * Phase 26: Keyboard Flow Gate Tests (v0.7.2)
 *
 * These tests verify the keyboard shortcut bindings exist in queue.html.
 * Full integration testing requires a browser, but we can verify the
 * keybinding registration pattern via API health + structure tests.
 *
 * GATE-KB-FOCUS-SEARCH-01: `/` focuses search input
 * GATE-KB-ESC-CLOSE-01: Esc closes modal
 * GATE-KB-A-OPENS-IMPACT-01: A opens impact modal (when items exist)
 * GATE-KB-R-OPENS-REDRAFT-01: R opens redraft modal
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Phase 26: Keyboard Flow (v0.7.2)", () => {
  let queueHtml: string;

  beforeAll(() => {
    // Read queue.html to verify keybinding registration
    queueHtml = readFileSync(resolve(__dirname, "ui-static/queue.html"), "utf-8");
  });

  describe("GATE-KB-STRUCTURE-01: keyboard listener registered", () => {
    it("queue.html contains keydown event listener", () => {
      expect(queueHtml).toContain('addEventListener("keydown"');
    });

    it("handles `/` key for search focus", () => {
      expect(queueHtml).toContain('e.key === "/"');
      expect(queueHtml).toContain("queue-search");
    });

    it("handles `Escape` key for modal close", () => {
      expect(queueHtml).toContain('e.key === "Escape"');
      expect(queueHtml).toContain("modal-overlay");
    });

    it("handles `A`/`a` key for approve", () => {
      expect(queueHtml).toContain('e.key === "a"');
      expect(queueHtml).toContain('e.key === "A"');
      expect(queueHtml).toContain("openImpactModal");
    });

    it("handles `R`/`r` key for redraft", () => {
      expect(queueHtml).toContain('e.key === "r"');
      expect(queueHtml).toContain('e.key === "R"');
      expect(queueHtml).toContain("openRedraftModal");
    });

    it("ignores keys when typing in input fields", () => {
      expect(queueHtml).toContain("INPUT");
      expect(queueHtml).toContain("TEXTAREA");
      expect(queueHtml).toContain("SELECT");
    });
  });

  describe("GATE-KB-APP-HANDLERS-01: batch handlers exist in app.js", () => {
    let appJs: string;

    beforeAll(() => {
      appJs = readFileSync(resolve(__dirname, "ui-static/app.js"), "utf-8");
    });

    it("has toggleItemSelect handler", () => {
      expect(appJs).toContain("toggleItemSelect:");
    });

    it("has batch toolbar update handler", () => {
      expect(appJs).toContain("updateBatchToolbar:");
    });

    it("has batch action execution handler", () => {
      expect(appJs).toContain("executeBatchAction:");
    });

    it("has batch result display handler", () => {
      expect(appJs).toContain("showBatchResult:");
    });
  });
});
