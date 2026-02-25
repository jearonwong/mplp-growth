import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Confirm } from "./modules/mplp-modules.js";
import type { ContentAssetNode, OutreachTargetNode } from "./psg/growth-nodes.js";
import { getRuntime } from "./commands/orchestrator.js";
import { server } from "./server/index.js";

describe("Phase 18: Founder Edit & Attribution (v0.6.1)", () => {
  beforeAll(async () => {
    await server.ready();
    const { psg } = await getRuntime();

    // Seed some target data for testing
    await psg.putNode({
      type: "domain:ContentAsset",
      id: "test-edit-asset-1",
      context_id: "test-cx",
      content: "Original Draft Content",
      status: "draft",
      metadata: { drafted_by_role: "BDWriter" },
    } as any);

    await psg.putNode({
      type: "Confirm",
      id: "test-edit-confirm-1",
      context_id: "test-cx",
      confirm_id: "test-edit-confirm-1",
      target_id: "test-edit-plan-1",
      status: "pending",
      message: "Test confirm for edit",
    } as any);

    await psg.putNode({
      type: "domain:OutreachTarget",
      id: "test-edit-ot-1",
      context_id: "test-cx",
      name: "Test OT",
      status: "draft",
    } as any);
  });

  afterAll(async () => {
    await server.close();
  });

  it("GATE-EDIT-WRITEBACK-01: edit updates ContentAsset.content and metadata", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/assets/test-edit-asset-1/edit",
      body: { content: "Revised Draft Content" },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.ok).toBe(true);
    expect(data.edit_version).toBe(1);

    const { psg } = await getRuntime();
    const asset = await psg.getNode<ContentAssetNode>("domain:ContentAsset", "test-edit-asset-1");
    expect(asset).toBeDefined();
    expect(asset!.content).toBe("Revised Draft Content");
    expect(asset!.metadata!.edited_by).toBe("founder");
    expect(asset!.metadata!.edited_at).toBeDefined();
    expect(asset!.metadata!.edit_version).toBe(1);
  });

  it("GATE-EDIT-NO-STATE-ADVANCE-01: editing does not modify Confirm/OT statuses", async () => {
    const { psg } = await getRuntime();
    const confirm = await psg.getNode<Confirm>("Confirm", "test-edit-confirm-1");
    expect(confirm).toBeDefined();
    expect(confirm!.status).toBe("pending"); // unmodified

    const ot = await psg.getNode<OutreachTargetNode>("domain:OutreachTarget", "test-edit-ot-1");
    expect(ot).toBeDefined();
    expect(ot!.status).toBe("draft"); // unmodified
  });

  it("GATE-INBOX-ATTRIB-SURFACE-01: inbox QueueItem returns drafted_by_role + bounded bullets", async () => {
    // Generate an interaction to test inbox
    const { psg } = await getRuntime();
    await psg.putNode({
      type: "domain:Interaction",
      id: "test-inbox-interaction-1",
      context_id: "test-cx",
      platform: "hn",
      author: "pg",
      content: "Interesting post",
      response: "Thanks PG!",
      status: "pending",
    } as any);

    await psg.putNode({
      type: "Confirm",
      id: "test-inbox-confirm-1",
      context_id: "test-cx",
      confirm_id: "test-inbox-confirm-1",
      target_id: "test-inbox-plan-1",
      status: "pending",
      message: "Inbox Handler",
    } as any);

    await psg.putNode({
      type: "Plan",
      id: "test-inbox-plan-1",
      context_id: "test-cx",
      title: "Inbox Handler - Auto Draft",
      steps: [{ description: "Process interactions" }],
    } as any);

    const response = await server.inject({
      method: "GET",
      url: "/api/queue",
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    const inboxItems = data.categories.inbox;

    const targetItem = inboxItems.find((i: any) => i.id === "test-inbox-confirm-1");
    expect(targetItem).toBeDefined();

    // Verify attribution surface default properties
    expect(targetItem.drafted_by_role).toBe("Responder");
    expect(targetItem.rationale_bullets).toBeDefined();
    expect(targetItem.rationale_bullets.length).toBeLessThanOrEqual(3);
    expect(targetItem.rationale_bullets[0]).toBe("Summarizes inbound signal");
  });

  it("GATE-ROLES-API-01: /api/roles returns at least: Responder, BDWriter, Editor, Analyst", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/roles",
    });

    expect(response.statusCode).toBe(200);
    const roles = response.json();
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThanOrEqual(4);

    const roleIds = roles.map((r: any) => r.role_id);
    expect(roleIds).toContain("Responder");
    expect(roleIds).toContain("BDWriter");
    expect(roleIds).toContain("Editor");
    expect(roleIds).toContain("Analyst");

    // Check structure
    expect(roles[0].name).toBeDefined();
    expect(roles[0].capabilities).toBeDefined();
    expect(Array.isArray(roles[0].capabilities)).toBe(true);
  });
});
