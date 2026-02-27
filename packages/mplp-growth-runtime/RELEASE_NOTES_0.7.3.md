# MPLP Growth v0.7.3 Release Notes

**Codename**: OpenClaw Bridge + Runner Observability + Speed Keys

This patch enables 7x24 OpenClaw operations and enhances system observability for the founder.

## Core Features Implemented

1. **A) OpenClaw Control Bridge (P0)**
   - Added secure API boundary using `MPLP_GROWTH_API_TOKEN` (exempts `/api/health`).
   - Created `POST /api/ops/daily-run` composite endpoint (combines inbox execute, queue fetch, and optional batch actions).
   - Shipped `openclaw/skill-mplp-growth` package with SKILL.md, API spec, and JSON examples for agent ingestion.
2. **B) Runner Observability (P1)**
   - Expanded `/api/runner/status` endpoint to include `last_run_id` and `last_outputs_preview` per-job.
   - Implemented `quiet_hours` configuration (scheduler and engine state) to suspend jobs during specified UTC windows.
   - Added UI controls in `settings.html` to configure Quiet Hours and expand execution previews.
3. **C) Queue Speed Keys (P2)**
   - Added `Shift + A` (Approve Selected), `Shift + R` (Redraft Selected), and `Shift + X` (Clear Selection) shortcuts to the queue.
   - Added "Copy Summary" button to the batch result modal for easy pasting into reports.

## Breaking Changes / Upgrade Notes

- **API Token**: Setting `MPLP_GROWTH_API_TOKEN` in the environment will now lock down all `/api/` endpoints (except health) in the runtime.
- **Config JSON Schema**: `JobConfig` now accepts an optional `quiet_hours` object `{ start: "HH:MM", end: "HH:MM" }`.

## Verification Status

- **Automated Tests**: 31 files, 199 tests passing natively.
- **New Gates**: 18 new constraints successfully passing covering OpenClaw Bridge (Phase 28), Runner Observability (Phase 29), and Queue Speed Keys (Phase 30).
