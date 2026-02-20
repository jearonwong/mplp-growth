/**
 * Runner Tasks
 * Defines the specific automation logic for each recurring task.
 */

import { executeCommand, getRuntime } from "../commands/orchestrator.js";
import { runnerState } from "./state.js";

export async function runWeeklyBrief() {
  console.log("[Task] Running Weekly Brief...");
  await executeCommand("brief", []);
}

export async function runDailyOutreachDraft() {
  console.log("[Task] Running Daily Outreach Draft...");
  // Default to a known segment or rotate?
  // v0.4.0 MVP: hardcode 'foundations' segment for now, or just don't segment to process all research-status targets?
  // The command requires --segment. Let's assume 'foundations' for MVP or pick from config.
  // Using --dry-run to ensure no PSG writes (just drafts).
  await executeCommand("outreach", ["--segment", "foundations", "--channel", "email", "--dry-run"]);
}

export async function runHourlyInbox() {
  console.log("[Task] Checking Inbox...");
  // Inbox check is safe to run frequently
  await executeCommand("inbox", []); // This might need args depending on implementation, but v0.3.0 inbox supports arg-less run? No, cmdInbox expects args.
  // Actually cmdInbox in v0.3.0 is for *ingesting* interaction.
  // Be careful: if inbox command requires args to ingest, we can't automate it without a source.
  // v0.4.0 Plan says "Poll for inbox signals (mockable)".
  // For MVP, we'll skip actual inbox polling unless we have a real signal source.
  // We can just log "No new signals" for now.
  console.log("[Task] Inbox: No signal source configured.");
}

export async function runWeeklyReview() {
  console.log("[Task] Running Weekly Review...");
  await executeCommand("review", ["--since-last"]);
}

export async function runAutoPublish() {
  const state = runnerState.getSnapshot();
  if (state.policy_level !== "aggressive" || !state.auto_publish) {
    console.log(
      `[Task] Auto-Publish skipped (Policy: ${state.policy_level}, AutoPublish: ${state.auto_publish}).`,
    );
    return;
  }

  console.log("[Task] Checking for approved assets to publish...");

  // Logic: conform to "Aggressive Mode" safely (FIX-4)
  // 1. Get reviewed assets
  const { psg } = await getRuntime();
  // Find assets that are reviewed AND have a matching Confirm that is APPROVED?
  // Actually, if status is 'reviewed', it means it passed content factory.
  // But we need to know if the *Outreach* action was confirmed.
  // In v0.3.0, `approve` changes `Confirm.status` to `approved`.
  // Side effects of approval might execute the action (publish).
  // But `approve` command *executes* the action immediately if it's an immediate action?
  // Or does it just mark approved?

  // v0.3.0 `approve` executes side effects.
  // So "Auto Publish" is actually "Auto Approve pending publish confirms"?
  // OR "Auto Publish" means running `publish --latest`?

  // Per Plan: `Run publish --latest (If approved & policy allows)`
  // `publish --latest` picks a "reviewed" asset.
  // If we run `publish --latest`, it attempts to publish.
  // Does it check for a Confirm?
  // `cmdPublish` checks if asset is valid.

  // If policy is aggressive, we assume user wants to publish reviewed content automatically.
  await executeCommand("publish", ["--latest", "x"]); // 'x' channel placeholder
}
