# MPLP Growth Version 1.0+ Release Discipline

As established by the **v0.9.1 Contract Freeze** and **v0.9.2 Gate Hardening Patch**, all future standard system releases MUST conform to the rigid, inherently auditable pipeline described below. No un-gated or un-endorsed merges may proceed to the `main` tag branch.

## Release Candidate (RC) Milestones

### RC-1: SSOT Version Unification

All human-facing and registry references must strictly align on the designated semantic version.

1. `packages/mplp-growth-runtime/package.json` updated cleanly.
2. `packages/mplp-growth-runtime/src/ui-static/index.html`, `queue.html`, and `settings.html` header `<span>` elements bumped.

### RC-2: Founder 3-Minute Sanity Audit

The core OpenClaw autonomous orchestration loop must demonstrate flawless execution and generate valid SSOT evidence.

1. Spin up the server via `npm start`.
2. Construct and POST an orchestration event to `/api/ops/openclaw/execute`.
3. Capture the returned `run_id`.
4. GET `/api/runner/runs/:run_id/evidence`. Verify the returned Evidence-grade Run Record JSON perfectly matches the expected canonical fields (`input`, `output.queue_delta`, `affected_ids`).

### RC-3: Metric Greenlight

All codebase assertions and type hierarchies must be pristine.

1. Run `npx tsc --noEmit`. **Must yield 0 implicit ANY or typing errors.**
2. Run `npx vitest`. **100% test matrix greenlight.**

---

## 6-Point SEAL Mandatory Structure

A formal `<VERSION>_SEAL.md` artifact must be synthesized by the Copilot upon RC-3 success and committed alongside changes _before_ Git tagging. Every SEAL record MUST include the following 6 Hardened Identifiers (established in v0.9.2):

### 1. Git SHA (Commit Hash)

The precise 40-character `commit hash` the tag will permanently point to.
_Example: `b2379dda4afd58a3f9fa76eb6c250d7dea5e806e`_

### 2. Gate Total PASS Statistics

The explicit ratio of matrix protections guaranteeing the run constraints.
_Example:_ `Total Hardened Gates Evaluated: 6/6 PASS (100% Green)`

### 3. Runner / Node Version Fingerprint

The environment assumption standardizing asynchronous bindings (ALS).
_Example:_ `Runner Ecosystem: Node.js >= v20.x`

### 4. Operational Environment Assertions

The strict bounds within which the artifact is certified (e.g., sequential vs concurrent).
_Example:_ `Automated matrix executions must run sequentially (--no-file-parallelism) to guarantee FileVSL thread isolation.`

### 5. Authorization Policy

The exact protocol constraint preventing structural ops drift.
_Example:_ `A strict 401 Unauthorized rule protects ALL Mutative and restricted /api/ops/* endpoints.`

### 6. Contract Golden Sample

The exact structural JSON snapshot of the autonomous response/evidence package serving as the deterministic truth baseline.

---

_Endorsed Baseline: mplp-growth-v1.0.0_
