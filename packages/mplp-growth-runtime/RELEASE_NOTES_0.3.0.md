# MPLP Growth Copilot — v0.3.0 Release Notes

> **Codename**: Growth Ops Cockpit  
> **Date**: 2026-02-10  
> **Tests**: 93/93 (16 new, 77 existing — zero regressions)  
> **Tag**: `mplp-growth-v0.3.0`

---

## 1. What Shipped

### Pillar 1: Queue + Batch Mode

- `/approve --list` groups pending confirms by **plan category** (outreach / publish / inbox / review)
- `/approve --all` processes all pending with **failure isolation** — one failure doesn't block others
- `/outreach --segment <org_type> --channel <ch>` batch-generates outreach with **skip rules** (existing outreach within 7d → auto-skip)

### Pillar 2: Template System

- Templates are real content assets (`asset_type: "thread"`) with `is_template: true`
- `/create <type> --template <id> --topic "..." --audience "..."` clones with **placeholder substitution**
- Unreplaced placeholders produce visible **warnings** in output

### Pillar 3: Actionable Review

- `--since-last` computes **delta metrics** vs previous week snapshot
- Action items now include **`expected_effect`** — users see what each suggestion will do
- First-ever review gracefully handles "no previous snapshot" state

---

## 2. New Command Modes

| Command     | Flag                                  | Behavior                                             |
| ----------- | ------------------------------------- | ---------------------------------------------------- |
| `/outreach` | `--segment <org_type> --channel <ch>` | Batch outreach with skip rules                       |
| `/outreach` | `--dry-run`                           | Zero state writes, draft + policy only               |
| `/outreach` | `--limit N`                           | Cap batch size                                       |
| `/publish`  | `--latest <channel>`                  | Auto-select most recent reviewed, non-template asset |
| `/approve`  | `--list`                              | Queue view grouped by plan category                  |
| `/approve`  | `--all`                               | Batch approve with failure isolation                 |
| `/review`   | `--since-last`                        | Delta metrics vs previous snapshot                   |
| `/create`   | `--template <id>`                     | Clone from template with placeholder substitution    |

---

## 3. Template Model

```
ContentAssetNode {
  asset_type: "thread" | "outreach_email" | ...  // real type preserved
  is_template?: boolean                           // true = reusable source
  template_id?: string                            // link to source template
}
```

**Placeholder keys**: `{{topic}}`, `{{audience}}`, `{{target_name}}`, `{{goal}}`  
**Behavior**: Matched keys replaced; unmatched keys kept as-is + warning emitted.

---

## 4. Review Improvements

- **Delta computation**: Read previous snapshot → create current → diff = current - prev
- **No previous snapshot**: `no_previous_snapshot: true` flag in outputs, delta is empty
- **Action items schema**: `{ command, reason, priority, expected_effect }`

---

## 5. Non-Goals (Unchanged)

- No real-world sending (email, social) — `/publish` creates export packs only
- No scheduling / cron — all operations are user-initiated
- No web UI dependency — CLI is the product; OpenClaw is an optional frontend

---

## 6. Upgrade Notes (v0.2.0 → v0.3.0)

| Change                          | Impact                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| `ContentAssetNode.is_template`  | New optional field; existing assets unaffected                      |
| `--since last` → `--since-last` | Single-token flag (CLI breaking change)                             |
| `seed.ts` templates             | Re-running seed adds 2 template assets                              |
| `publish --latest` filtering    | Now excludes `is_template=true` assets and requires channel variant |
| `approve --list` grouping       | Now groups by plan category instead of target_type                  |

---

## Files Changed

| File                              | Delta                              |
| --------------------------------- | ---------------------------------- |
| `growth-nodes.ts`                 | +`is_template`, +`template_id`     |
| `orchestrator.ts`                 | 6 behavioral fixes                 |
| `cards.ts`                        | 3 formatter upgrades               |
| `wf05-weekly-review.ts`           | expected_effect, snapshot ordering |
| `wf06-outreach.ts`                | dry_run support                    |
| `seed.ts`                         | 2 template assets                  |
| `cli.ts`                          | --since-last flag                  |
| `types.ts`                        | dry_run on WF06 input              |
| `package.json`                    | 0.2.0 → 0.3.0                      |
| `commands/index.ts`               | New exports                        |
| `phase9-batch-queue.test.ts`      | **9 new tests**                    |
| `phase10-template-review.test.ts` | **7 new tests**                    |
