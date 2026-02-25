/**
 * Growth Copilot v0.6.0: Multi-Agent Role Registry
 * Single Source of Truth for available agent roles and their capabilities.
 */

export type AgentRole = "Responder" | "BDWriter" | "Editor" | "Analyst";

export const RoleRegistry: Record<AgentRole, { id: AgentRole; name: string; description: string }> =
  {
    Responder: {
      id: "Responder",
      name: "Customer Responder",
      description: "Generates inbox replies and community engagement drafts.",
    },
    BDWriter: {
      id: "BDWriter",
      name: "Business Development Writer",
      description: "Crafts personalized outreach emails and DMs based on targeted signals.",
    },
    Editor: {
      id: "Editor",
      name: "Content Editor",
      description: "Transforms raw drafts into optimized content variants for publishing.",
    },
    Analyst: {
      id: "Analyst",
      name: "Growth Analyst",
      description: "Evaluates metrics and proposes actionable weekly plans.",
    },
  };
