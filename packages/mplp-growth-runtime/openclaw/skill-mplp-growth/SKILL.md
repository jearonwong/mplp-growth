---
name: MPLP Growth Runtime Control
description: Drive the MPLP Growth Runtime via its local API (daily run, queue management, role routing)
---

# MPLP Growth Runtime — OpenClaw Skill

## Prerequisites

- Runtime running at `http://localhost:3000` (Docker or dev server)
- Optional: `MPLP_GROWTH_API_TOKEN` ENV for secured access

## Quick Start: Daily Run

```bash
curl -X POST http://localhost:3000/api/ops/daily-run \
  -H "Content-Type: application/json" \
  -d '{"auto_approve": false}'
```

## Key Endpoints

| Method | Path                   | Description                                       |
| ------ | ---------------------- | ------------------------------------------------- |
| GET    | /api/health            | Health check + version                            |
| POST   | /api/ops/daily-run     | Composite: inbox execute → queue → optional batch |
| GET    | /api/queue             | List pending approval items                       |
| POST   | /api/queue/batch       | Batch approve/reject/redraft                      |
| POST   | /api/queue/:id/redraft | Redraft single item                               |
| POST   | /api/runner/config     | Update runner config                              |
| GET    | /api/runner/status     | Runner state + job status                         |
| POST   | /api/inbox/manual      | Push manual signal                                |

## Authentication

If `MPLP_GROWTH_API_TOKEN` is set, include header:

```
x-mplp-token: <your-token>
```

Health endpoint is always public.

## See Also

- [endpoints.md](endpoints.md) — full payload reference
- [examples.json](examples.json) — copy-paste examples
