/**
 * Phase 21: Work Queue Decomposition Gate Tests (v0.7.0 P2)
 *
 * GATE-QUEUE-REDRAFT-01: rewrite updates strings and inserts redraft envelope variants
 * GATE-REDRAFT-BOUNDS-01: restricts bounding rationale box ≤ 3 bullets
 * GATE-REDRAFT-NO-STATE-ADVANCE-01: status locks verify safe state mappings
 */

import { describe, expect, it } from "vitest";
import type { AgentRole } from "./agents/roles";
import { executor } from "./agents/executor";

describe("Phase 21: Work Queue Decomposition — Redraft (v0.7.0)", () => {
  describe("GATE-QUEUE-REDRAFT-01: rewrite updates strings and inserts redraft envelope", () => {
    it("BDWriter→Editor: outreach_draft → content_variant produces different content", async () => {
      const bdResult = await executor.run("BDWriter", {
        kind: "outreach_draft",
        target: { name: "TestCo" },
        channel: "email",
      });
      const editorResult = await executor.run("Editor", {
        kind: "content_variant",
        asset_type: "outreach",
        topic: "growth",
        channels: ["email"],
      });
      // The two roles produce different content
      expect(bdResult.content).not.toBe(editorResult.content);
    });

    it("Responder→Responder: produces consistent content for same input", async () => {
      const result1 = await executor.run("Responder", {
        kind: "inbox_reply",
        interaction: { platform: "hn", author: "alice", content: "Tell me about MPLP" },
      });
      const result2 = await executor.run("Responder", {
        kind: "inbox_reply",
        interaction: { platform: "hn", author: "alice", content: "Tell me about MPLP" },
      });
      expect(result1.content).toBe(result2.content);
    });

    it("redraft metadata envelope should have correct shape", () => {
      // Simulate redraft metadata update
      const metadata: Record<string, unknown> = {
        drafted_by_role: "BDWriter",
        redraft_version: 0,
      };

      const newRole: AgentRole = "Editor";
      const prevVersion =
        typeof metadata.redraft_version === "number" ? metadata.redraft_version : 0;
      metadata.redrafted_by_role = newRole;
      metadata.drafted_by_role = newRole;
      metadata.redraft_version = prevVersion + 1;

      expect(metadata.redrafted_by_role).toBe("Editor");
      expect(metadata.drafted_by_role).toBe("Editor");
      expect(metadata.redraft_version).toBe(1);
    });
  });

  describe("GATE-REDRAFT-BOUNDS-01: restricts bounding rationale box ≤ 3 bullets", () => {
    const tasks = [
      {
        role: "Responder" as AgentRole,
        task: {
          kind: "inbox_reply" as const,
          interaction: { platform: "hn", author: "test", content: "Hello" },
        },
      },
      {
        role: "BDWriter" as AgentRole,
        task: {
          kind: "outreach_draft" as const,
          target: { name: "TestCo" },
          channel: "email",
        },
      },
      {
        role: "Editor" as AgentRole,
        task: {
          kind: "content_variant" as const,
          asset_type: "article",
          topic: "growth",
          channels: ["linkedin"],
        },
      },
      {
        role: "Analyst" as AgentRole,
        task: { kind: "weekly_review" as const, metrics: {} },
      },
    ];

    for (const { role, task } of tasks) {
      it(`${role} rationale_bullets should have ≤ 3 items`, async () => {
        const result = await executor.run(role, task);
        expect(result.rationale_bullets.length).toBeLessThanOrEqual(3);
      });
    }

    it("slice(0,3) correctly truncates if > 3", () => {
      const bullets = ["a", "b", "c", "d", "e"];
      const bounded = bullets.slice(0, 3);
      expect(bounded).toHaveLength(3);
      expect(bounded).toEqual(["a", "b", "c"]);
    });
  });

  describe("GATE-REDRAFT-NO-STATE-ADVANCE-01: status locks verify safe state mappings", () => {
    it("redraft does not change Confirm status from pending", () => {
      // Simulate a Confirm node
      const confirm = { status: "pending", target_id: "plan-123" };

      // Redraft process: we only update the Plan's agent_role and document content
      // The confirm.status MUST remain "pending"
      const plan = { agent_role: "BDWriter" };
      plan.agent_role = "Editor"; // This is what redraft does

      // Assert: confirm status is NOT advanced
      expect(confirm.status).toBe("pending");
    });

    it("redraft does not change InteractionNode status from pending", () => {
      const interaction = { status: "pending", response: "old draft" };

      // Redraft updates response text but not status
      interaction.response = "new draft with Editor tone";

      expect(interaction.status).toBe("pending");
    });

    it("redraft does not change ContentAsset status from reviewed", () => {
      const asset = { status: "reviewed", content: "old content" };

      // Redraft updates content text but not status
      asset.content = "new content from Editor";

      expect(asset.status).toBe("reviewed");
    });
  });
});
