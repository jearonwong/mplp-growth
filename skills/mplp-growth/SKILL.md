---
name: mplp-growth
description: "MPLP Growth Copilot - AI-powered content lifecycle for multi-agent governance marketing. Commands: /brief /create /publish /inbox /review /outreach /approve"
metadata:
  { "openclaw": { "emoji": "🌲", "requires": { "node": ">=18" }, "skill_version": "0.2.0" } }
---

# MPLP Growth Copilot

Marketing content lifecycle for the MPLP protocol. Create, format, publish content, process interactions, generate outreach, and review weekly metrics — all with observable governance.

## Commands

### `/brief` — Weekly Planning

Generate a weekly content plan based on brand cadence.

```
/brief
```

**Output:** Weekly theme, planned assets, placeholder IDs, Trace reference.

### `/create <type>` — Content Factory

Generate content with platform variants.

```
/create thread
/create thread developers x
/create article enterprise medium
```

**Parameters:**

- `type`: thread | post | article | video_script | outreach_email
- `audience` (optional): developers | enterprise | standards
- `channel` (optional): x | linkedin | medium | hn | youtube

**Output:** ContentAsset ID, status: reviewed, platform variants.

### `/publish <asset_id> <channel>` — Publish Pack

Format and export content for a platform.

```
/publish abc123-uuid-here x
/publish abc123-uuid-here linkedin
```

**Output:** Export file path (paste-ready markdown), status: published.

### `/inbox` — Interaction Handler _(v0.1.1)_

Process incoming interactions and generate draft replies.

```
/inbox --platform x --content "Great thread!" --author "@user1"
/inbox [{"platform":"linkedin","content":"Interesting post","author":"@dev1"}]
```

**Output:** Interaction IDs, draft count, Confirm (awaiting approval).

### `/review` — Weekly Retrospective _(v0.1.1)_

Generate weekly metrics snapshot and review memo.

```
/review
/review --week 2026-02-03
```

**Output:** MetricSnapshot (immutable), review memo, suggestions, Plan/Trace.

### `/outreach <target_id> <channel>` — Outreach Pack _(v0.2.0)_

Generate outreach draft to an external contact. Creates a **pending Confirm** — user must explicitly approve via `/approve`.

```
/outreach abc123-target-id email
/outreach abc123-target-id linkedin --goal "Explore partnership" --tone casual
```

**Parameters:**

- `target_id`: OutreachTarget ID
- `channel`: email | linkedin | x
- `--goal` (optional): specific outreach goal
- `--tone` (optional): professional | casual

**Output:** ContentAsset (outreach_email), ⏳ Confirm (PENDING), Interaction stub, Plan/Trace.

### `/approve <confirm_id>` — Approve Confirm _(v0.2.0)_

Explicitly approve a pending Confirm. Pushes deferred side-effects (e.g. OutreachTarget → contacted, Interaction → responded).

```
/approve def456-confirm-id
```

**Output:** ✅ Confirm approved, target/interaction status updates.

## Workflow

1. `/brief` → Plan the week
2. `/create thread` → Generate content
3. `/publish <asset_id> x` → Export to platform
4. `/inbox` → Process interactions
5. `/review` → Weekly retrospective
6. `/outreach <target_id> email` → Generate outreach pack
7. `/approve <confirm_id>` → Approve & push state

## Data Location

Content stored at: `~/.openclaw/mplp-growth/`

- `vsl/objects/` — Plans, Traces, ContentAssets, Interactions, MetricSnapshots, Extensions
- `exports/<run_id>/` — Paste-ready content files
