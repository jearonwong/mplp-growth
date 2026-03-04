# MPLP Growth v0.7.4 Release Notes

**Codename**: Snapshot / Restore (Founder Trust Anchor)

This patch provides a critical foundation for running OpenClaw 7x24 by giving the Founder a deterministic "undo button" via one-click Snapshot and Restore.

## Core Features Implemented

1. **A) Snapshot / Restore API (P0)**
   - `POST /api/admin/snapshot` (Creates an immutable tar.gz snapshot of the data dir excluding transient locks)
   - `GET /api/admin/snapshots` (Lists available snapshots by reading index.json metadata)
   - `POST /api/admin/restore` (Safely stops the runner, backs up current state, extracts tar.gz, and ensures runner remains OFF)

2. **B) UI: Settings Snapshot Panel (P1)**
   - Added a new Snapshots panel in Settings to list available snapshots.
   - Added "Snapshot Now" button and visual feedback.
   - Added per-snapshot "Restore" button with a strict confirmation flow that subsequently refreshes the UI state upon success.

3. **C) CLI Access (P2)**
   - Added `cli snapshot`, `cli snapshots`, and `cli restore <id>` subcommands for out-of-band state management and easier RC testing.

## Breaking Changes / Upgrade Notes

- None. Snapshot directories are inherently isolated in `${MPLP_GROWTH_STATE_DIR}/snapshots`. Backups taken during a rollback are dumped into `.restore-backup/` safely.

## Verification Status

- **Automated Tests**: 32 files, 203 tests passing natively.
- **New Gates**: `GATE-SNAPSHOT-CREATES-ARCHIVE-01`, `GATE-RESTORE-ROLLS-BACK-01`, `GATE-RESTORE-RUNNER-OFF-01`, `GATE-SNAPSHOT-LIST-01` ensuring snapshot payload fidelity and semantic safety.
