/**
 * Workflows Index
 *
 * Export all workflows for the MPLP Growth Copilot
 */

// Workflow types
export type {
  WorkflowRunResult,
  WorkflowInput,
  PublishPackInput,
  ContentFactoryInput,
  WeeklyBriefInput,
  InboxHandlerInput,
  InboxInteractionInput,
  WeeklyReviewInput,
  OutreachInput,
} from "./types";
export { createStep, generateRunId } from "./types";

// WF-01: Weekly Brief
export { runWeeklyBrief } from "./wf01-weekly-brief";

// WF-02: Content Factory
export { runContentFactory } from "./wf02-content-factory";

// WF-03: Publish Pack
export { runPublishPack } from "./wf03-publish-pack";

// WF-04: Inbox Handler
export { runInboxHandler, transitionInteraction } from "./wf04-inbox-handler";

// WF-05: Weekly Review
export { runWeeklyReview } from "./wf05-weekly-review";

// WF-06: Outreach Pack
export { runOutreach } from "./wf06-outreach";
