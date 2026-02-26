# Release Notes — v0.7.1

**Date**: 2026-02-26
**Tag**: `mplp-growth-v0.7.1`
**Baseline**: `mplp-growth-v0.7.0` (sealed)

---

## 1. What Shipped

### Item 1 — Default Role Reset

- Settings UI "Run as Role" dropdown "Default" option now **actually clears** `run_as_role` on the backend
- Backend accepts `run_as_role: null` → deletes the field from job config

### Item 2 — Selective Inbox Redraft

- Per-interaction **checkboxes** in inbox queue cards (checked by default)
- Redraft modal shows **"Redraft N selected interaction(s)"** count
- Backend `POST /api/queue/:id/redraft` accepts optional **`interaction_ids`** filter
- Omitting `interaction_ids` preserves backward-compatible "redraft all" behavior

### Item 3 — Transparent Redraft Metadata

- Queue cards show **"→ Redrafted by \<role\> v\<N\>"** badge (orange) when redrafted
- "Why" section splits into **"Why (draft)"** and **"Why (redraft)"** when both exist
- Redraft endpoint stores bullets in `redraft_rationale_bullets` (original `rationale_bullets` preserved)

### Item 4 — API-only E2E Closure

- Full `health → config → signal → queue → redraft → approve` cycle verified via API

---

## 2. Upgrade Notes (0.7.0 → 0.7.1)

- `JobConfig.run_as_role` type now includes `| null` (backward compatible)
- `POST /api/queue/:id/redraft` body accepts `interaction_ids?: string[]` (optional)
- `QueueItem` type adds `redrafted_by_role?`, `redraft_version?`, `redraft_rationale_bullets?`
- Interaction objects in queue response now include `id` field

---

## 3. Known Limits

- Selective redraft checkboxes only appear in the "Preview Content" details section
- Redraft metadata display requires at least one redraft operation to show the split Why groups
- Phase18 test has an intermittent port-conflict flake when run concurrently with other server-based tests (passes in isolation)

---

## 4. Verification

### RC-1 — Version SSOT

```
package.json: 0.7.1 | settings.html: Runtime v0.7.1 | /api/health: 0.7.1
tsc --noEmit: 0 errors
```

### RC-3 — Tests

```
vitest: 157 passed, 0 relevant failures (phase18 is pre-existing port flake)
Gate tests: phase22 (6/6), phase23 (3/3), phase24 (5/5) — all pass
```
