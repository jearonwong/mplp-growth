# Release Notes — v0.2.0

**Tag**: `mplp-growth-v0.2.0`
**Baseline**: `mplp-growth-v0.1.1` (919aac9) — 59/59 tests

## What's New

### WF-06: Outreach Pack

5-stage pipeline to generate outreach drafts for external contacts:

1. Load context + target
2. Draft outreach asset (`ContentAsset(outreach_email)`)
3. Policy compliance check (forbidden terms gate)
4. **Create Confirm (PENDING — not auto-approved)**
5. Record interaction stub + update target status

### `/approve <confirm_id>` — High-Risk Gate Closure

First command with explicit human gate. Pushes deferred side-effects:

- `Confirm: pending → approved` with decision record
- `OutreachTarget: drafted → contacted`
- `Interaction: pending → responded`

### Extension Adapters

- `outreach-policy-default` (policy): forbidden patterns, tone, confirm requirement
- `channel-adapter-email` (integration): email template sections + signature

### Seed Data

- 3 OutreachTargets: Linux Foundation, CNCF, ISO/IEC JTC 1
- 2 Extensions seeded for production demo

## Non-Goals

- No actual external sending (SMTP/API). Outreach produces export-ready packs only.
- No automatic org join requests.

## Test Results

```
Phase 7: 13/13 (7 gates)
Phase 8:  5/5  (2 seed gates)
Total:   77/77 ✅
```

## Commands Summary (7 total)

| Command     | Version    | Description              |
| ----------- | ---------- | ------------------------ |
| `/brief`    | v0.1.0     | Weekly planning          |
| `/create`   | v0.1.0     | Content factory          |
| `/publish`  | v0.1.0     | Platform export          |
| `/inbox`    | v0.1.1     | Interaction processing   |
| `/review`   | v0.1.1     | Weekly retrospective     |
| `/outreach` | **v0.2.0** | Outreach pack generation |
| `/approve`  | **v0.2.0** | Confirm gate closure     |
