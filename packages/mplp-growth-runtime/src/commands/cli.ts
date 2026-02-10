/**
 * MPLP Growth Copilot - CLI Entry Point
 *
 * Standalone CLI for testing commands outside OpenClaw:
 *   npx tsx src/commands/cli.ts brief
 *   npx tsx src/commands/cli.ts create thread
 *   npx tsx src/commands/cli.ts create thread --template <id> --topic "observability"
 *   npx tsx src/commands/cli.ts publish <asset_id> x
 *   npx tsx src/commands/cli.ts publish --latest x
 *   npx tsx src/commands/cli.ts inbox --platform x --content "Great thread!"
 *   npx tsx src/commands/cli.ts review [--since last]
 *   npx tsx src/commands/cli.ts outreach <target_id> email [--dry-run]
 *   npx tsx src/commands/cli.ts outreach --segment foundations --channel email [--limit 5]
 *   npx tsx src/commands/cli.ts approve <confirm_id>
 *   npx tsx src/commands/cli.ts approve --list
 *   npx tsx src/commands/cli.ts approve --all
 */

import {
  cmdBrief,
  cmdCreate,
  cmdPublish,
  cmdInbox,
  cmdReview,
  cmdOutreach,
  cmdApprove,
} from "./orchestrator";

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.log(`
MPLP Growth Copilot CLI (v0.3.0)

Usage:
  cli brief                                                - Generate weekly brief
  cli create <type> [audience] [ch]                        - Create content
  cli create <type> --template <id> [--topic <t>]          - Create from template
  cli publish <asset_id> <channel>                         - Publish to platform
  cli publish --latest <channel>                           - Publish most recent reviewed asset
  cli inbox --platform <p> --content <c> [--author]        - Process interactions
  cli review [--week <ISO date>] [--since-last]            - Weekly retrospective
  cli outreach <target_id> <channel> [--goal] [--tone]     - Generate outreach
  cli outreach --segment <type> --channel <ch> [--limit N] - Batch outreach
  cli outreach <target_id> <ch> --dry-run                  - Draft only (no state)
  cli approve <confirm_id>                                 - Approve pending confirm
  cli approve --list                                       - List pending confirms
  cli approve --all                                        - Batch approve all pending

Examples:
  cli brief
  cli create thread --template abc123 --topic "observability"
  cli publish --latest x
  cli outreach --segment foundations --channel email --limit 5
  cli approve --all
  cli review --since-last
`);
    process.exit(0);
  }

  let output: string;

  switch (command) {
    case "brief":
      output = await cmdBrief();
      break;
    case "create":
      output = await cmdCreate(args);
      break;
    case "publish":
      output = await cmdPublish(args);
      break;
    case "inbox":
      output = await cmdInbox(args);
      break;
    case "review":
      output = await cmdReview(args);
      break;
    case "outreach":
      output = await cmdOutreach(args);
      break;
    case "approve":
      output = await cmdApprove(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  console.log(output);
}

main().catch(console.error);
