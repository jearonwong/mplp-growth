# MPLP Growth v0.6.1 (Patch Release)

## Release Scope: Founder Experience Upgrades

This patch introduces strictly bounded surface-level observability and manual mutation tools to enhance the founder's experience managing the output of the automated orchestrator. The underlying workflow, LLM integration routines, and schema structures remain unmodified.

## Key Features

**1. Queue Dashboard: Edit Draft Writeback**

- Founders can now manually edit generated drafts directly within a Queue card before approval.
- An "Edit Draft" overlay lets the user rewrite or amend content, writing natively back to the VSL `domain:ContentAsset` graph node.
- Modifying a draft increments the `edit_version` and imprints an immutable `edited_by: "founder"` metadata stamp without prematurely advancing confirm status states.

**2. Inbox Triage: Pre-Approval Attribution Context**

- Inbox responder drafts now share the exact attribution architecture as outbound workflows.
- Inbox cards feature explicitly rendered badges specifying the Agent role mapping (e.g., `Drafted by Responder`) accompanied by three top-level deterministic "Why" rationality bullets (e.g., "Summarizes inbound signal", "Drafts a safe response", "Requires manual approval").

**3. Settings: Global Role Registry**

- Introduced a read-only table interface beneath Runner Configuration outlining the core 4 Agent Roles driving the autonomous engine (`Responder`, `BDWriter`, `Editor`, `Analyst`) mapped explicitly to their operational capabilities.

## Verification & Integrity (RC-3 / Seal Gates)

- `GATE-EDIT-WRITEBACK-01`: Confirmed node metadata updates persistently.
- `GATE-EDIT-NO-STATE-ADVANCE-01`: Confirmed confirm execution boundary isolations.
- `GATE-INBOX-ATTRIB-SURFACE-01`: Confirmed dynamic array slice limiting parameters.
- Built via Docker environment validating cleanly against deterministic tests, rendering a 119/119 passing verification suite.
