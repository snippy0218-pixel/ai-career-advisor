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
