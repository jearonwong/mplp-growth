import { AgentRole } from "./roles.js";

type AgentTask =
  | {
      kind: "inbox_reply";
      interaction: { platform: string; author: string; content: string };
      brand?: any;
      policy?: any;
    }
  | {
      kind: "outreach_draft";
      target: any;
      channel: string;
      goal?: string;
      brand?: any;
      policy?: any;
    }
  | {
      kind: "content_variant";
      asset_type: string;
      topic?: string;
      audience?: string;
      brand?: any;
      channels: string[];
    }
  | { kind: "weekly_review"; metrics: any; previous_snapshot?: any; brand?: any };

export interface AgentResult {
  content: string;
  rationale_bullets: string[];
}

export interface AgentExecutor {
  run(role: AgentRole, task: AgentTask): Promise<AgentResult>;
}

export class DeterministicExecutor implements AgentExecutor {
  async run(role: AgentRole, task: AgentTask): Promise<AgentResult> {
    switch (role) {
      case "Responder":
        if (task.kind !== "inbox_reply") {
          throw new Error("Responder only handles inbox_reply");
        }
        return {
          content: `Thank you for your message about "${task.interaction.content.substring(0, 50)}...". We appreciate your engagement with MPLP.`,
          rationale_bullets: [
            "Acknowledges the user's point and thanks them",
            "Keeps tone aligned with brand tagline",
            "Avoids forbidden terms",
          ],
        };

      case "BDWriter":
        if (task.kind !== "outreach_draft") {
          throw new Error("BDWriter only handles outreach_draft");
        }
        return {
          content: `Hi ${task.target.name || "there"},\n\nI saw your recent work and wanted to introduce MPLP. We help technical founders build automated growth workflows. Let me know if you are open to a quick chat.`,
          rationale_bullets: [
            "States purpose in first sentence",
            "Includes MPLP canonical link CTA",
            "Passes forbidden-terms scan",
          ],
        };

      case "Editor":
        if (task.kind !== "content_variant") {
          throw new Error("Editor only handles content_variant");
        }
        return {
          content: `Discover how MPLP scales your impact 10x. Our latest guide on ${task.topic || "growth"} drops today: [Link]`,
          rationale_bullets: [
            "Adds stronger hook",
            "Formats for platform constraints",
            "Includes one clear CTA",
          ],
        };

      case "Analyst":
        if (task.kind !== "weekly_review") {
          throw new Error("Analyst only handles weekly_review");
        }
        return {
          content:
            "Weekly Review Complete. Based on metrics delta, recommend focusing on high-leverage top-of-funnel channels next week.",
          rationale_bullets: [
            "Uses delta vs last snapshot",
            "Top actions are runnable commands",
            "Focuses on highest leverage channel",
          ],
        };

      default:
        throw new Error(`Unknown role: ${role}`);
    }
  }
}

export const executor = new DeterministicExecutor();
