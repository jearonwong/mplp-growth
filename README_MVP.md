# MPLP Growth Copilot — MVP README

> **Version**: 0.1.0 (MVP)  
> **Status**: 46/46 Tests Passing  
> **Runtime**: OpenClaw + MPLP v1.0 Kernel

---

## What It Is

**MPLP Growth Copilot** = OpenClaw UI + MPLP Runtime Kernel (PSG/VSL/AEL)

A governed content lifecycle for multi-agent marketing. Create, format, and publish content across platforms with observable governance.

```
┌───────────────────────────────────────────────────────┐
│                  OpenClaw (UI Layer)                   │
│            /brief  /create  /publish                  │
├───────────────────────────────────────────────────────┤
│               MPLP Growth Runtime (L3)                 │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────┐   │
│  │  Commands   │──│ Workflows │──│   Modules     │   │
│  │ orchestrator│  │ WF-01/02/03│  │10 MPLP types  │   │
│  └─────────────┘  └─────┬─────┘  └───────────────┘   │
│                    ┌────┴────┐                        │
│                    │ PSG/VSL │                        │
│                    └─────────┘                        │
└───────────────────────────────────────────────────────┘
```

---

## Why MPLP Matters

| Concept | Benefit |
|---------|---------|
| **PSG** (Project Semantic Graph) | Single source of truth for brand, audience, content |
| **VSL** (Value State Layer) | Durable storage with replay capability |
| **Plan/Trace/Confirm** | Every action is traceable and auditable |
| **Events** | Observable execution via GraphUpdateEvent + PipelineStageEvent |

---

## Commands

### OpenClaw UI
```
/brief                      — Generate weekly content plan
/create <type>              — Create content asset
/publish <asset_id> <ch>    — Publish to platform
```

### CLI (Standalone)
```bash
npm run cli brief
npm run cli create thread
npm run cli publish <asset_id> x
```

---

## Data Artifacts

### Storage Location
```
~/.openclaw/mplp-growth/
```

### VSL Objects
| Path | Content |
|------|---------|
| `vsl/objects/Context/` | Brand, audiences, cadence |
| `vsl/objects/Plan/` | Weekly plans, content plans |
| `vsl/objects/Trace/` | Execution traces |
| `vsl/objects/Confirm/` | Approval records |
| `vsl/objects/domain:ChannelProfile/` | X, LinkedIn, Medium, HN, YouTube |
| `vsl/objects/domain:ContentAsset/` | Generated content |

### Exports
| Path | Content |
|------|---------|
| `exports/<run_id>/<channel>.md` | Paste-ready content for platform |

### Events Log
| File | Families |
|------|----------|
| `vsl/events.ndjson` | `graph_update`, `pipeline_stage` |

---

## MPLP Compliance

### Required Events (v1.0)

| Event | When | Purpose |
|-------|------|---------|
| `GraphUpdateEvent` | Node create/update/delete | Audit graph mutations |
| `PipelineStageEvent` | Workflow stage start/complete | Trace execution |

### Module Usage

| Module | Usage |
|--------|-------|
| Context | Brand policy, audiences, cadence |
| Plan | Workflow steps with status |
| Trace | Root span + segments per run |
| Confirm | Approval gates for publish |

---

## Demo

See [DEMO_MVP.md](./DEMO_MVP.md) for step-by-step walkthrough.

**Quick Start:**
```bash
npm run seed
npm run cli brief
npm run cli create thread
# Copy asset_id from output
npm run cli publish <asset_id> x
```

---

## Tests & Gates

### Test Summary (46/46)
```
 ✓ gates.test.ts              (18 tests) - Phase 1
 ✓ phase2-gates.test.ts        (7 tests) - Phase 2
 ✓ phase3-workflows.test.ts   (10 tests) - Phase 3
 ✓ phase4-commands.test.ts     (8 tests) - Phase 4
 ✓ phase5-demo-readme.test.ts  (3 tests) - Phase 5
```

### Key Gates
- **GATE-TRACE-ROOTSPAN-01**: Trace must have root_span
- **GATE-CONFIRM-TARGETTYPE-01**: Valid target_type enum
- **GATE-EXPORT-PACK-EXISTS-01**: Export file created
- **GATE-CMD-WIRES-WF-***: Commands wire to workflows

---

## License

Apache-2.0
