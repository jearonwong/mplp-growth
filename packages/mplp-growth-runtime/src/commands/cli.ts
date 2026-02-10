/**
 * MPLP Growth Copilot - CLI Entry Point
 *
 * Standalone CLI for testing commands outside OpenClaw:
 *   npx tsx src/commands/cli.ts brief
 *   npx tsx src/commands/cli.ts create thread
 *   npx tsx src/commands/cli.ts publish <asset_id> x
 *   npx tsx src/commands/cli.ts inbox --platform x --content "Great thread!"
 *   npx tsx src/commands/cli.ts review
 *   npx tsx src/commands/cli.ts outreach <target_id> email
 *   npx tsx src/commands/cli.ts approve <confirm_id>
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
MPLP Growth Copilot CLI

Usage:
  cli brief                                          - Generate weekly brief
  cli create <type> [audience] [ch]                  - Create content
  cli publish <asset_id> <channel>                   - Publish to platform
  cli inbox --platform <p> --content <c> [--author]  - Process interactions
  cli review [--week <ISO date>]                     - Weekly retrospective
  cli outreach <target_id> <channel> [--goal] [--tone] - Generate outreach
  cli approve <confirm_id>                           - Approve pending confirm

Examples:
  cli brief
  cli create thread
  cli publish abc123-uuid x
  cli inbox --platform x --content "Great thread!"
  cli outreach abc123 email --goal "Explore partnership"
  cli approve def456-confirm-id
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
