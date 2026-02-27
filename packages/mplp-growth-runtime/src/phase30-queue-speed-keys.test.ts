/**
 * Phase 30: Queue Speed Keys Gate Tests (v0.7.3)
 *
 * GATE-KB-SHIFT-A-01: Shift+A triggers batch approve
 * GATE-KB-SHIFT-R-01: Shift+R triggers batch redraft
 * GATE-KB-SHIFT-X-01: Shift+X triggers clear selection
 * GATE-COPY-SUMMARY-01: batch copy summary button exists
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Phase 30: Queue Speed Keys (v0.7.3)", () => {
  let queueHtml: string;
  let appJs: string;

  beforeAll(() => {
    queueHtml = readFileSync(resolve(__dirname, "ui-static/queue.html"), "utf-8");
    appJs = readFileSync(resolve(__dirname, "ui-static/app.js"), "utf-8");
  });

  describe("GATE-KB-SHIFT-A-01: Shift+A mapping exists", () => {
    it("queue.html checks shiftKey for A", () => {
      expect(queueHtml).toContain("e.shiftKey");
      expect(queueHtml).toContain('e.key === "A"');
      expect(queueHtml).toContain("app.handlers.batchApprove()");
    });
  });

  describe("GATE-KB-SHIFT-R-01: Shift+R mapping exists", () => {
    it("queue.html checks shiftKey for R", () => {
      expect(queueHtml).toContain("e.shiftKey");
      expect(queueHtml).toContain('e.key === "R"');
      expect(queueHtml).toContain("app.handlers.openBatchRedraftModal()");
    });
  });

  describe("GATE-KB-SHIFT-X-01: Shift+X mapping exists", () => {
    it("queue.html checks shiftKey for X", () => {
      expect(queueHtml).toContain("e.shiftKey");
      expect(queueHtml).toContain('e.key === "X"');
      expect(queueHtml).toContain("app.handlers.clearSelection()");
    });
  });

  describe("GATE-COPY-SUMMARY-01: copy summary exists in app.js + queue.html", () => {
    it("queue.html has Copy Summary button", () => {
      expect(queueHtml).toContain("app.handlers.copyBatchSummary()");
    });

    it("app.js has copyBatchSummary handler", () => {
      expect(appJs).toContain("copyBatchSummary:");
      expect(appJs).toContain("navigator.clipboard.writeText");
    });
  });
});
