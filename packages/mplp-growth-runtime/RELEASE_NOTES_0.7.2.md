# Release Notes — v0.7.2

**Date**: 2026-02-26
**Tag**: `mplp-growth-v0.7.2`
**Baseline**: `mplp-growth-v0.7.1` (sealed)

---

## 1. What Shipped

### A — Queue Batch Actions (P0)

- **`POST /api/queue/batch`**: batch approve/reject/redraft with per-item failure isolation
- **Batch toolbar**: visible when items selected, with Approve / Reject / Redraft buttons
- **Per-card checkboxes**: cross-category selection
- **Batch result modal**: processed/skipped/failed summary with error details
- **Batch redraft modal**: role selection + confirmation
- Supports `interaction_ids_map` for selective inbox redraft within batch

### B — Keyboard Flow (P1)

- `/` focuses search input
- `Esc` closes any open modal
- `A` opens impact modal for first visible item
- `R` opens redraft modal for first visible item
- Keys ignored when focus is in input/textarea/select

### C — Role UI Consistency (P2)

- Settings dropdown: **"(Auto)"** instead of "Default"
- Queue badge: **"Drafted by Auto"** fallback when `drafted_by_role` is empty
- Redraft modal: **role required** — inline error "⚠ Select a role to redraft." when attempting submit without role

---

## 2. Upgrade Notes (0.7.1 → 0.7.2)

- New endpoint: `POST /api/queue/batch` (BatchRequest/BatchResponse types)
- No breaking changes to existing API

---

## 3. Verification

### RC-3 — Tests

```
vitest: 28/28 files, 185/185 tests — clean sweep
tsc --noEmit: 0 errors
New gates: phase25 (9/9), phase26 (10/10), phase27 (5/5) = 24/24 green
```
