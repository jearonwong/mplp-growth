# Release Notes — MPLP Growth Copilot v0.1.0

> **Release Date**: 2026-02-10  
> **Tag**: `mplp-growth-v0.1.0`  
> **Tests**: 46/46 Passing

---

## What Shipped

### Workflows
- **WF-01 Weekly Brief** (`/brief`) — Generate weekly content plan
- **WF-02 Content Factory** (`/create`) — Create content with platform variants
- **WF-03 Publish Pack** (`/publish`) — Format and export for platform

### MPLP Runtime Kernel
- **PSG** (Project Semantic Graph) — Unified node storage
- **VSL** (Value State Layer) — Durable file-based storage
- **AEL** (Agent Execution Layer) — Event emission

### MPLP Compliance (v1.0 Required)
- `GraphUpdateEvent` — Emitted on all node mutations
- `PipelineStageEvent` — Emitted on workflow stage transitions
- `Plan/Trace/Confirm` — Full binding and governance chain

### Commands
- `/brief` → WF-01
- `/create <type>` → WF-02
- `/publish <id> <channel>` → WF-03
- CLI: `npm run cli <command>`

---

## Non-Goals (v0.1.0)

The following are **not** included in this release:

| Feature | Status |
|---------|--------|
| Auto-publish to live platforms | Not implemented |
| BYO-API key integration | Not implemented |
| WF-04 HN Launch | Deferred to v0.2.0 |
| WF-05 YouTube Kit | Deferred |
| WF-06 Outreach | Deferred |
| `/inbox` command | Deferred |
| `/review` command | Deferred |

---

## Compatibility

| Requirement | Version |
|-------------|---------|
| Node.js | ≥18 |
| npm | ≥8 |

---

## Data Contract

| Path | Content |
|------|---------|
| `~/.openclaw/mplp-growth/vsl/objects/` | Plans, Traces, ContentAssets |
| `~/.openclaw/mplp-growth/vsl/events.ndjson` | Event log |
| `~/.openclaw/mplp-growth/exports/<run_id>/` | Paste-ready content |

---

## Roadmap (v0.2.0)

- WF-04 HN Launch (high-risk confirm flow)
- WF-06 Outreach (Linux Foundation target chain)
- `/inbox` + `/review` commands
- Metrics snapshot domain node

---

## Disclaimer

> **This is a developer tool, not an official MPLP certification or endorsement.**  
> MPLP Growth Copilot demonstrates MPLP protocol usage patterns but does not constitute conformance verification or compliance attestation.

---

## Files

| File | Purpose |
|------|---------|
| `README_MVP.md` | User documentation |
| `DEMO_MVP.md` | 5-minute walkthrough |
| `MVP_SEAL_0.1.0.md` | Immutability anchor |
| `skills/mplp-growth/SKILL.md` | OpenClaw skill |
