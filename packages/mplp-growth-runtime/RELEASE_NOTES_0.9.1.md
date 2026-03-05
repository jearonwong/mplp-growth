# Release Notes for MPLP Growth v0.9.1

## Overview

v0.9.1 serves as the **Contract Freeze** release for OpenClaw telemetry integration. It formalizes the telemetry schemas, establishes single-point attribution for autonomous events, and hardens authorization for operations APIs to prevent drift leading up to the v1.0 milestone.

### Key Changes

1. **Contract Freeze for OpenClaw Executions (Phase 38)**
   - The `/api/ops/openclaw/execute` returns a rigid `queue_delta` structure containing explicit `before`, `after`, and `diff` snapshots.
   - Exact numerical deltas per-category (`inbox`, `outreach`, `publish`, etc.) are now returned natively.
   - Returned fields properly include `created_ids` and `consumed_ids`.

2. **Single-point Attribution Wrapper (Phase 39)**
   - All explicitly manual metadata logic (e.g. tracking `triggered_by`) has been unified utilizing Node.js `AsyncLocalStorage`.
   - Modifying workflows via the Orchestrator with the `--source` flag seamlessly guarantees domain nodes (Confirms, etc.) are painted with `triggered_by: <source>` without dirtying business logic.

3. **API Security Hardening (Phase 40)**
   - Authorization checking algorithms underwent strict overhaul.
   - Generic mutative endpoints AND all `/api/ops/*` namespace endpoints correctly return deterministic 401 Unauthorized status when valid `OPS_TOKEN` / `x-mplp-token` headers are omitted or malformed.
   - Backward-compatible opt-in behavior remains preserved for local-testing scenarios.

## Technical Details

- All corresponding tests implementations are sealed: `GATE-OPENCLAW-DELTA-CONTRACT-01`, `GATE-ATTRIBUTION-WRAPPER-01`, `GATE-AUTH-BLOCKS-OPS-01`.
- Project cleanly compiles under `tsc --noEmit`.
