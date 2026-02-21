# Release Notes — v0.5.0 Founder 7×24 App

## What Shipped

### Runner Job Dashboard (Epic B)

Full visibility into automated job scheduling with live status, manual "Run Now" triggers, and configuration via API or Settings UI. Jobs display `next_run_at`, `last_status`, and `last_duration_ms`.

### Impact Modal Approvals (Epic C)

Every approve action now shows an impact panel: what will change, what will NOT happen, and the policy check status. Nothing executes without explicit confirmation through the modal.

### Signals Ingestion (Epic A)

Real signal capture from two sources:

- **HN Algolia Connector** — Pulls comment mentions by keyword (`opensource`, `mplp`, `openclaw`)
- **Manual Push** — `POST /api/inbox/manual` for ad-hoc signals

Each interaction carries `platform`, `source_ref`, and `author` metadata. Platform badges render in the Queue UI.

### One-Click Docker Deployment (Epic D)

Production-ready container with:

- Multi-stage build (node:20-alpine)
- Healthcheck (`curl /api/health` every 30s)
- Persistent data via `./data` bind mount
- ENV-driven configuration (`RUNNER_ENABLED`, `POLICY_LEVEL`, `AUTO_PUBLISH`)

## Founder Workflow

```
Manual push / HN pull → Queue appears → Open Impact modal → Approve → Review delta
```

1. Signals arrive automatically (HN) or manually (API push)
2. System generates draft responses and queues them for review
3. Founder opens Queue, inspects Impact panel, approves or rejects
4. Weekly review shows metrics delta and suggests next actions

## Safety & Non-Goals

- **No external sending** — No email API, no social media API. Outreach produces export packs only.
- **Runner OFF by default** — Must be explicitly enabled via ENV or Settings UI.
- **Safe policy** — Conservative content generation; no auto-publish.
- **No LLM integration** — Draft responses are deterministic templates (LLM integration is a future milestone).

## Upgrade Notes (from v0.4.1)

| Change                                     | Impact                                                    |
| ------------------------------------------ | --------------------------------------------------------- |
| `package.json` version → `0.5.0`           | `/api/health` now reports `0.5.0`                         |
| `daemon.ts` no longer force-enables runner | Runner respects `RUNNER_ENABLED` ENV (default: `false`)   |
| `PlanStep.reference_id` added              | Optional field, backward compatible                       |
| `Confirm.message` / `created_at` added     | Optional fields, backward compatible                      |
| `tsconfig.json` lib → ES2023               | Required for `Array.toSorted()`                           |
| `Interaction.source_ref` dedup at ingest   | Duplicate signals are now skipped automatically           |
| Queue item `id` = `confirm_id`             | API approve/reject endpoints now work with queue item IDs |

## Known Limits

- HN connector uses a fixed keyword list (`opensource`, `mplp`, `openclaw`) — customization requires code change
- Draft responses are deterministic templates, not LLM-generated
- `seed` must be run manually on first container start (`docker exec ... node dist/commands/cli.js seed`)

## Verification

The following steps verify the full founder workflow in Docker:

```bash
# 0. Baseline
docker compose up -d && curl -s http://localhost:3000/api/health
# Expect: version=0.5.0, runner_enabled=false

# 1. Seed + Manual push
docker exec mplp-growth-runtime node dist/commands/cli.js seed
curl -s -X POST http://localhost:3000/api/inbox/manual \
  -H 'content-type: application/json' \
  -d '{"content":"Demo signal","author_handle":"@test","source_ref":"manual://test/1"}'

# 2. Run inbox
curl -s -X POST http://localhost:3000/api/runner/execute \
  -H 'content-type: application/json' -d '{"task_id":"inbox"}'

# 3. Check queue
curl -s http://localhost:3000/api/queue

# 4. Approve
docker exec mplp-growth-runtime node dist/commands/cli.js approve --all

# 5. Review
docker exec mplp-growth-runtime node dist/commands/cli.js review --since-last
```
