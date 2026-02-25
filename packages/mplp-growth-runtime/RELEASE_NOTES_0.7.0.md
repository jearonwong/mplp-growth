# Release Notes — v0.7.0

**Date**: 2026-02-25
**Tag**: `mplp-growth-v0.7.0`
**Baseline**: `mplp-growth-v0.6.2` (sealed)

---

## 1. What Shipped

### P1 — Multi-Agent Job Routing

Each background job can now be configured to run as a specific agent role (`Responder`, `BDWriter`, `Editor`, `Analyst`). The role flows end-to-end:

- **Settings UI**: "Run as Role" dropdown column in the Background Jobs table
- **Runner**: `run_as_role` config passes `--role-id` flag through the orchestrator
- **Workflows**: `drafted_by_role` and `Plan.agent_role` are set dynamically from the configured role

### P2 — Queue Redraft as Role

Queue items can be re-drafted with a different agent role without advancing state:

- **"Re-draft as…" button** on every queue card
- **Redraft Modal**: select a role → re-run the deterministic executor → update draft text + metadata
- **No state advance**: `Confirm.status` remains `pending`, document statuses unchanged
- **Bounded rationale**: `rationale_bullets` capped at ≤ 3

---

## 2. Founder Workflow

1. Open **Settings** → Background Jobs → set "Run as Role" for `inbox` or `outreach-draft`
2. Trigger a job via "Run Now" or wait for the cron schedule
3. Go to **Approval Queue** → find the new item → see **Drafted by [Role]** + **Why** bullets
4. Click **Re-draft as…** → choose a different role → confirm → draft text updates in-place
5. **Approve** or **Reject** as usual — the redraft does not change the approval flow

---

## 3. Safety / Non-Goals

- ✅ **No LLM integration** — deterministic executor only
- ✅ **No external sending** — export-pack only, no emails or posts
- ✅ **No new workflows** — only `role_id` parameter added to existing WF inputs
- ✅ **No new domain nodes** — metadata-only extensions (`redrafted_by_role`, `redraft_version`)
- ✅ **Deterministic executor remains SSOT** — same template-based output per role

---

## 4. Upgrade Notes (0.6.2 → 0.7.0)

- `JobConfig` now has optional `run_as_role` field (backward compatible, defaults to undefined)
- `WorkflowInput` base interface now includes `role_id?: AgentRole`
- New API endpoint: `POST /api/queue/:id/redraft` (accepts `{ role_id: string }`)
- `setConfig` signature improved: `Omit<Partial<RunnerConfig>, "jobs">` to avoid intersection type issues
- `phase12-health.test.ts` no longer hardcodes version — uses `package.json` SSOT

---

## 5. Known Limits

- Redraft only changes draft text and metadata — does not advance state machine
- Redraft of inbox items re-drafts all pending interactions in scope (not individually selectable)
- "Default" option in the role dropdown clears the UI but does not reset `run_as_role` on the backend (MVP limitation)
- The deterministic executor produces fixed template text per role — different roles produce demonstrably different output, but the templates are not LLM-generated

---

## 6. Verification

### RC-1 — Version SSOT

```
package.json: 0.7.0
settings.html header: Runtime v0.7.0
/api/health: {"version": "0.7.0"}
tsc --noEmit: 0 errors
```

### RC-2 — Founder 3-min Validation

```
POST /api/runner/config → {"ok":true} (set inbox run_as_role=Responder)
POST /api/inbox/manual → {"ok":true,"queued":true}
POST /api/runner/execute → {"ok":true}
GET /api/queue → drafted_by_role:"Responder", rationale_bullets: 3 items
UI: Drafted by badge ✓, Why bullets ✓, Re-draft as… button ✓, Modal ✓
```

### RC-3 — Tests + Build

```
vitest run: 147/147 passed, 0 failed
tsc --noEmit: 0 errors
```
