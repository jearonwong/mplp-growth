# MPLP Growth v1.0.0 Release Notes

## Overview

This is the milestone **v1.0.0** release of the internal MPLP Growth Orchestrator. It formally cements the infrastructure, API contracts, evidence generation, and procedural discipline established during the v0.9.x cycles.

## Key Features & Hardening

### 1. API Contract Manifestation

The previously implicit interface for the autonomous execution engine is now an auditable code asset (`contracts/openclaw-api-manifest.yaml`). This document maps the frozen telemetry bounds, baseline version, and the matrices validating it, treating the contract as a physical artifact rather than a behavioral assumption.

### 2. Evidence-grade Run Record

Added a Single Source of Truth (SSOT) endpoint (`GET /api/runner/runs/:run_id/evidence`) that acts as the canonical JSON representation of any execution.

- Generates a "minimum reproducible package" capturing input commands, the deterministic delta output, and snapshot references.
- Ensures absolute auditability of Orchestrator actions for compliance/recovery pipelines.
- Validated rigorously by the new `GATE-RUN-EVIDENCE-CONTRACT-01`.

### 3. Release Discipline Codification

Formalized the RC-1/2/3 staging process and 6-Point SEAL record mandatory requirements into a permanent specification (`docs/RELEASE_DISCIPLINE_V1.md`). All future releases must cryptographically and procedurally map to this framework.

## Verification & Trust Metrics

- **TypeScript**: 0 Implicit ANY errors (`tsc --noEmit` pass).
- **Hardened Gate Coverage**: Includes `GATE-RUN-EVIDENCE-CONTRACT-01` to ensure the evidence payload structure remains deterministic and un-driftable. All 211 Vitest assertions passed perfectly across strict sequential boundaries.
- **Dependency & UI Alignment**: `package.json` and static Dashboard/Queue templates strictly uniformly synchronized to `v1.0.0`.

## Next Steps

This version concludes the infrastructure/observability stabilization. Subsequent patches will adhere strictly to the `V1+ Release Discipline` guidelines herein.
