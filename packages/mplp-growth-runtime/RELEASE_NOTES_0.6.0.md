# Release Notes v0.6.0

## What shipped

- Core `AgentRole` registry and mapping established for explicit role boundaries (e.g., `BDWriter`, `Editor`).
- Transitioned the entire stack to a unified Multi-Agent Executor. 所有 draft 文本统一由 deterministic executor 产出.
- Implemented new UI frameworks and "Approval Impact" modal structures natively exposing `Drafted by` and `Why:` attribution vectors.
- Built the semantic validation gate (`GATE-QUEUE-VSL-RESOLUTION-01`) enforcing rigid persistence of draft identifiers directly to the memory VSL arrays.

## Founder flow

When interacting with the system, Founders now directly observe:

- **Who** drafted the component (e.g., explicitly tagged `Drafted by BDWriter`).
- **Why** the component was built that way (visible up to 3 bullet explanations).
  This surfaces exactly what reasoning steps the agent took, bridging the gap between mechanical execution and human-auditable trust.

## Safety

- Retains the strict no-LLM and no-external-communication execution constraints.
- Zero unreviewed payloads can be distributed externally automatically.
- Enforced by rigid deterministic executors eliminating hallucination drift.

## Upgrade notes

- Bumps the global SSOT configurations across `package.json` and REST API endpoints natively to `0.6.0`.
- Rebuilt docker images validating the DOM generation scripts on port 3000.

## Known limits

- Only single-agent single-hop orchestration is completed at this phase. The `Agent Executor` is bounded with rigid static mappings rather than dynamic swarms for now.

## Verification

1. **SSOT Version Validation:** Checked `/api/health` output guaranteeing exact `v0.6.0` bindings.
2. **Founder 3-Min Acceptance (RC-2):** Seeding the test matrix successfully generated an exact `outreach` draft carrying the attribution payload. DOM extraction via Puppeteer confirmed absolute render fidelity.
3. **P0 Reliability Gate:** Docker images compiled successfully mirroring the SSOT version internally. 100% of the unified regression test suite triggered fully green pipelines.
