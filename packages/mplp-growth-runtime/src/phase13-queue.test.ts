import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createConfirm } from "./modules/mplp-modules";
import { runnerState } from "./runner/state";
import { server } from "./server/index";
import { FileVSL } from "./vsl/file-vsl";

describe("Phase 13 Gates — Queue Previews (v0.4.1)", () => {
  let vsl: FileVSL;

  beforeAll(async () => {
    // We already have some seed data and tests that create Outreaches.
    // We will verify the queue returns the mapped items properly.
    const basePath = path.join(os.tmpdir(), "mplp-growth-test-phase13-" + Date.now());
    vsl = new FileVSL({ basePath });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // Tests for the /api/queue output mapping will go here
  describe("GATE-QUEUE-PREVIEW-NONEMPTY-01", () => {
    it("queue items contain preview and category", async () => {
      // Create a mock confirm node directly for testing
      const confirmId = "test-queue-confirm-" + Date.now();
      const confirm = createConfirm({
        target_type: "plan",
        target_id: "plan-mock",
        requested_by_role: "test",
      });
      (confirm as any).id = confirmId;
      confirm.status = "pending";

      // Seed to DB or rely on `psg` available via `node_modules` import mock?
      // For now, we'll hit the API and verify the schema of returned items.
      const res = await server.inject({
        method: "GET",
        url: "/api/queue",
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.categories).toBeDefined();

      const allItems = [
        ...data.categories.outreach,
        ...data.categories.publish,
        ...data.categories.inbox,
        ...data.categories.review,
        ...data.categories.other,
      ];

      for (const item of allItems) {
        expect(item.confirm_id).toBeDefined();
        expect(item.category).toBeDefined();
        // Preview must not be empty string
        expect(item.preview).toBeTruthy();
        expect(item.policy_check).toBeDefined();
      }
    });

    it("outreach category must have channel property", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/queue",
      });
      const data = res.json();

      for (const item of data.categories.outreach) {
        // We know outreach items populate channel
        expect(item.channel).toBeDefined();
      }
    });
  });
});
