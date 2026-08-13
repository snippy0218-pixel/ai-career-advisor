# Phase 2.4 QA Gates

本文件是执行索引，Gate 的正式定义仍以 `PHASE-2-4-QUALITY-ROBUSTNESS.md` 与 `PHASE-2-CONTRACT.md` 为准。

## Hard invariants

- Candidate claim → CF → PF → Raw Profile；JD claim → JD Evidence → Raw JD。
- `unknown != unmet`; absence of evidence != negative evidence; counter evidence != positive evidence。
- Explicit negative evidence and relational conclusions are dimension-local。
- Candidate semantic/qualifier upgrade、JD→Candidate contamination、unsupported waiver、cross-CF qualifier propagation 均为 0。
- 失败后下游调用为 0；rejected output 与 stage lifecycle 必须可审计。

## Deterministic gate per baseline

1. Exact rejected-raw replay and focused matrix PASS。
2. Relevant module targeted tests PASS。
3. Full automated suite PASS。
4. `npm run lint` PASS。
5. `npm run build` PASS。
6. Diff/scope/secret scan PASS；frozen Contract/public Schema/fixture/provider settings无未授权变更。
7. Worktree clean at committed milestone。

## Model-backed gate

- 每个 committed deterministic baseline 使用同一 frozen RB-05 fixture执行固定三次 evaluation batch。
- 三次之间不得修改代码、输入、model、temperature、retry 或 timeout；全部独立 artifact 均保留。
- 每次先做实际五 route acceptance capability preflight，业务执行前 model calls 必须为 0。
- 任何结果都纳入结论；不得追加运行选择绿色样本。

## Current status

- Q-A backlog disposition：PASS / final ledger closed。
- Q-B blocker closure：PASS，ISSUE-028～038 closed on deterministic + final runtime evidence。
- Q-C full-chain robustness：PASS，final acceptance batch 2 为 3/3 complete / X-A～X-J PASS。
- Q-D safe failure：PASS on recorded paths。
- Q-E metrics：PASS / OBS-006 retained non-blocking（personalized safe fallback 3/3，safety guards PASS）。
- Q-F evidence auditability：PASS on infrastructure + final 3-run artifacts。
- Q-G cross-module integrity：PASS on final 3/3 complete chains。
- Q-H automated regression：current ISSUE-031/038 baseline has 584/584、lint、production build PASS。
- Q-I input/error handling：PASS。
- Q-J release blockers：PASS；no open Phase 2.4 P0/P1。Phase 2.5 still NOT AUTHORIZED。

Current disposition: **PASS / CLOSE PHASE 2.4**. Final evidence: `PHASE-2-4-FINAL-ACCEPTANCE.md`. Phase 2.5 remains NOT AUTHORIZED pending separate Product Owner / QA authorization.

## Phase 2.5 Release Gate

Phase 2.5 is **AUTHORIZED / IN PROGRESS** as of 2026-08-13. The governing addendum and run policy are `PHASE-2-5-AUTONOMOUS-PLAN.md`.

- Product surface Gate: ordinary user can submit raw JD + raw Candidate Profile and receive one validated Personalized Match Result without producing internal JSON.
- Fixture Gate: exact Phase 1 TC-01～10 hashes plus frozen TC-P2-01～14 JD/Profile hashes and coverage manifest.
- Deterministic Gate: focused/targeted/full/lint/build/production smoke/diff/scope/secret/history audit all PASS on a committed clean baseline.
- Model Gate: Phase 1 10×3 and Phase 2 14×3, complete immutable matrices, all artifacts retained, no cherry-pick or fourth run.
- Hard Contract Gate: Candidate/JD lineage, status, dimension locality, modifier/ownership/waiver integrity, schema, fail-closed, downstream-stop, and Phase 1 compatibility all PASS.
- Gate F: eight-dimension average >=4.0/5, minimum dimension >=3.0/5, P0=0, systemic/release-blocking P1=0.
- `hrSafeFallbackRate` and OBS-006: mandatory report-only metrics; non-blocking absent a hard correctness failure.

Current Phase 2.5 disposition: **DETERMINISTIC GATE PASS / CANDIDATE BASELINE COMMIT PENDING — model calls 0**.

Current evidence: fixture/runner/UI focused `19/19`; full automated suite `32 files / 598 tests`; lint zero warnings; production build and TypeScript PASS; `/`, `/personalized-match`, invalid-input API, and five acceptance capability probes PASS; server stopped after smoke; diff/whitespace/scope/secret/history audits PASS. Only the committed-clean-baseline audit remains before formal model execution.

Infrastructure batch disposition: `phase-2-5-baseline-1-0373ad4` is **NOT A CONTENT MATRIX**. Five probes passed, but all 72 local requests returned JD-stage `AI_SERVICE_UNAVAILABLE` before provider completion (`completion tokens=0`, completed chains=0, downstream calls=0, max latency 35 ms). Artifacts are retained; content sample count is 0. ISSUE-039 fail-fast correction passes focused 8/8, full 599/599, lint/build. A complete replacement matrix on a new committed runner baseline is required.
