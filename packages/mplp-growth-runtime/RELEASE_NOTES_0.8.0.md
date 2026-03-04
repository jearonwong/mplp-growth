# MPLP Growth v0.8.0 Release Notes

**Codename**: Reliable Operations & Observability Loop

This patch transitions the Growth App from a pure API backend to a full operational "Cockpit" for 7x24 OpenClaw autonomous running, fulfilling the requirement that the Founder always knows "what the system did, is doing, and will do next."

## Core Features Implemented

1. **A) Runner Runbook Timeline (P0)**
   - Implemented a bounded `RunRecord` execution history queue inside `runnerState`.
   - UI: Added a native "Recent Runs" table to the Dashboard displaying the last 20 tasks, execution times, status, and parsed metadata outputs.

2. **B) Failure Playbook (P1)**
   - Integrated failure scanning into the `fetchStatus` loop.
   - UI: Strongly colored "Runner Alerts" are pushed to the top of the dashboard if a cron or API-triggered task crashes.
   - Recovery: Added an inline "📸 Snapshot State" remedy button so Founders can safely freeze state before forensic queue editing.

3. **C) Export Pack Index (P2)**
   - Added REST API endpoints (`GET /api/admin/exports` and `/api/admin/exports/:filename`) for OpenClaw-generated data extraction.
   - UI: Added an "Export Packs" native list view on the Dashboard for 1-click downloads of `.zip` or `.md` outputs.

## Breaking Changes / Upgrade Notes

- None. `runnerState` transparently defaults `runs` to an empty array for older versions.

## Verification Status

- **Automated Tests**: 32 files, 203 tests passing serially natively.
- **TypeScript**: 0 errors (`tsc --noEmit`).
