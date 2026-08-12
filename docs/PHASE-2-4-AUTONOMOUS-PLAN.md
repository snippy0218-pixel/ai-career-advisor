# Phase 2.4 Autonomous Execution Plan

> Updated: 2026-08-12
> Branch / starting HEAD: `main / 9ac1537778e346c4616df92b988ac5bd2efd928a`
> Deterministic implementation commit: `f8567f4…`
> Formal phase state: `FAIL / BLOCKED`; Phase 2.5 `NOT AUTHORIZED`

## Objective

在冻结 Phase 2 Contract 与现有架构内完成 Quality & Robustness closure：Candidate Truth、Match、Recommendation、Strength/Gap、Greeting、diagnostics、runner、failure semantics、regression 和 full-chain E2E 全部达到可审计稳定状态。

## Current blocker and hypothesis

Autonomous batch 1 在 ISSUE-037 初始修复 baseline 上完成固定 3-run，0/3 complete：run 1 到达 Recommendation 后暴露 ISSUE-031 status suffix group false positive；run 2 暴露较弱 participation claim 的 Match lexical entailment false positive，同时正确拒绝无引用 Candidate negative；run 3 正确拒绝 CF-003 的课程/非正式工作污染。

- `CF-004 仅否定正式工作经历`
- `不构成对独立负责能力的明确反证`

第二 deterministic baseline 已完成 systemic bounded fix：R-C suffix group 逐 MI 检查、Match team-project weaker entailment、Match prompt/repair v1.4 unknown/qualifier ownership constraints。当前 hypothesis：该 baseline 应使 Match/Recommendation 稳定进入后续 Strength/Gap；任何新 failure 以 batch 2 全部 evidence 裁决。

## Execution sequence

1. 建立 ISSUE-037 exact artifact replay 与正/反例 matrix。（完成）
2. 实现 bounded meta-evidence boundary classifier；不改 Contract/public Schema/prompt/provider/fixture。（完成）
3. 运行 focused → Match targeted → full suite → lint → build → diff/scope/secret checks。（完成）
4. 更新 issue/gate/handoff/changelog，提交新的 deterministic baseline。（baseline 2 完成）
5. 在同一 baseline、同一 frozen RB-05 fixture、无代码间改动下执行固定三次 model-backed E2E batch；每次保存独立 artifact。（batch 1 完成；batch 2 pending）
6. 审计三次完整 stage ledger、raw/rejected evidence、Candidate/JD lineage、repair/fallback/latency 与所有 open Issue closure evidence。
7. 若出现新的 Contract 内 deterministic defect，保存整批 evidence 后建立新 baseline 并循环；若满足 Stop & Escalate 或 Final Acceptance 条件则提交最终 package。

## Baseline validation

- Pre-change full suite: 23 files / 530 tests PASS。
- Post-fix: ISSUE-037 focused 9/9、Match targeted 140/140、full 23 files / 539 tests、lint、production build、diff/scope/secret checks PASS。
- Baseline 2: focused 9/9、Match targeted 145/145、Recommendation targeted 83/83、full 23 files / 548 tests、lint、production build、diff/scope/secret checks PASS。
- Batch 1: exactly 3 runs / 0 completed chains; all artifacts preserved in `PHASE-2-4-AUTONOMOUS-BATCH-1.md`。
- Git worktree before plan creation: clean。
- Latest artifact SHA-256: `5febd1400a781771d5f5cccb5414e2ef3ac40bfbc9ed9843f970f00afcb8fb82`。

## Remaining work

- Frozen three-run E2E batch 2 on `f8567f4…` implementation baseline。
- ISSUE-028～037 closure/disposition audit。
- Phase 2.4 Final Closure Audit；不得进入 Phase 2.5。
