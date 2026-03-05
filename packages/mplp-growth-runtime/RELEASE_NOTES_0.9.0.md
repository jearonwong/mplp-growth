# Release Notes — v0.9.0

**Date**: 2026-03-05
**Tag**: `mplp-growth-v0.9.0`
**Baseline**: `mplp-growth-v0.8.0` (sealed)

---

## 1. What Shipped

### A — OpenClaw Skill Spec & Telemetry (P0)

- **`POST /api/ops/openclaw/execute`**: A dedicated API endpoint designed explicitly for the OpenClaw Substrate. It performs pre/post queue counts, executing the underlying Growth Action with `--source openclaw` telemetry.
- **Source Propagation**: The entire command execution pipeline and workflows have been updated to preserve the `source` argument through Node generation (adding `triggered_by` metadata).

### B — Cockpit Attribution Mode (P1)

- **"🤖 OpenClaw" Runner Badges**: The Dashboard's Recent Runs UI now attributes commands correctly (Cron, Manual, OpenClaw).
- **"🤖 Triggered by OpenClaw" Queue Badges**: Replaces the default `Auto` author in the Queue interface to visually highlight tasks autonomously drafted by OpenClaw vs normal Cron cycles.

### C — The 7x24 E2E Verification (P2)

- Full E2E telemetry trace tested via `phase35-openclaw-cockpit.test.ts` covering everything from API triggering to nested queue resolution.

---

## 2. Upgrade Notes (0.8.0 → 0.9.0)

- New endpoint: `POST /api/ops/openclaw/execute` requiring `x-api-key` header logic based on `OPS_TOKEN`.
- Modified interfaces: `Confirm`, `CreateConfirmInput`, and `QueueItem` enriched to support arbitrary metadata.

---

## 3. Verification

### RC-3 — Tests

```
vitest: 32/32 files, 201/201 tests — clean sweep
tsc --noEmit: 0 errors
New gates: phase35 (1/1) = 1/1 green
```
