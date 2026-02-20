# 📦 MPLP Growth Runtime - v0.4.1 Patch Release

This release establishes the baseline Ops Cockpit experience, resolving critical MVP blockers and stabilizing the `Queue` logic ahead of multi-agent handoffs in v0.5.0.

## 🚀 Key Improvements & Features

### P0 - Version/Status SSOT (Blocker)

- **Unified Versioning**: Read version numbers dynamically from `package.json` across API, UI, and Daemon.
- **Global Headers**: The UI Dashboard, Queue, and Settings now display live environment states including `Version`, `Runner Status`, and `Policy Level`.
- **API `GET /api/health`**: Added a reliable uptime and endpoint tracking query.

### P1 - Queue Preview Quality

- **Rich Context Display**: `QueueItems` exposed via `/api/queue` now bundle the initial asset text content (preview), associated `channel`, and contextual `target_id`.
- **Card Enhancements**: The UI handles displaying Expandable Previews for generated outreach scripts inside the Queue view.
- **Immediate Inline Actions**: Users can effortlessly hit "Approve" and "Reject" to resolve workflow confirmations on the same Queue page to keep interaction cycles short.

### P2 - Robust Deduplication & Runner Defenses

- **Metadata Fingerprinting**: Transitioned the Deduplication behavior of Outreach away from title string matching, replacing it with a definitive, 7-day cooldown hash tied natively to the `metadata` context properties (Target ID + Channel).
- **Safety Mode Enforcement**: For runner policies `Safe` or `Standard`, runner tasks involving "Auto-Publish" inherently skip operation workflows, barring aggressive dissemination behaviors. The Settings API has been surfaced to give a human explicit control overriding this state (`POST /api/runner/config`).

## 🧪 Testing and CI Checks

- Passing locally on 108 tests (`GATE-HEALTH`, `GATE-QUEUE-PREVIEW`, `GATE-OUTREACH-DEDUP`).
- Fixed persistent `vsl-state` data boundary bleeding inside Vitest processes to harden `InMemoryPSG` concurrent behaviors across the suite.
