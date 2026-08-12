# Phase 2.4 Autonomous Execution Plan

> Updated: 2026-08-12  
> Branch / starting HEAD: `main / 9ac1537778e346c4616df92b988ac5bd2efd928a`
> Deterministic implementation commit: `5dd7d06…`
> Formal phase state: `FAIL / BLOCKED`; Phase 2.5 `NOT AUTHORIZED`

## Objective

在冻结 Phase 2 Contract 与现有架构内完成 Quality & Robustness closure：Candidate Truth、Match、Recommendation、Strength/Gap、Greeting、diagnostics、runner、failure semantics、regression 和 full-chain E2E 全部达到可审计稳定状态。

## Current blocker and hypothesis

最新 immutable artifact `phase-2-4-post-035-036-replacement-rb-05.json` 在 Match repair 终止。Repair 已正确产生 employment `unmet` 以及 domain/responsibility `unknown`，但 `candidateAssertionClauses` 将 evidence-boundary explanation 按分号/逗号拆散后，把以下元证据子句误判为无 lineage 的 Candidate assertion：

- `CF-004 仅否定正式工作经历`
- `不构成对独立负责能力的明确反证`

Hypothesis：这是 clause classification 缺少“evidence relation / polarity explanation”语义类别造成的 deterministic false positive。修复应分类元证据，而不是把具体业务词加入放行列表；直接 Candidate negative、cross-dimension negative、混合 boundary + unsupported assertion 必须继续 fail-closed。

## Execution sequence

1. 建立 ISSUE-037 exact artifact replay 与正/反例 matrix。（完成）
2. 实现 bounded meta-evidence boundary classifier；不改 Contract/public Schema/prompt/provider/fixture。（完成）
3. 运行 focused → Match targeted → full suite → lint → build → diff/scope/secret checks。（完成）
4. 更新 issue/gate/handoff/changelog，提交新的 deterministic baseline。
5. 在同一 baseline、同一 frozen RB-05 fixture、无代码间改动下执行固定三次 model-backed E2E batch；每次保存独立 artifact。
6. 审计三次完整 stage ledger、raw/rejected evidence、Candidate/JD lineage、repair/fallback/latency 与所有 open Issue closure evidence。
7. 若出现新的 Contract 内 deterministic defect，保存整批 evidence 后建立新 baseline 并循环；若满足 Stop & Escalate 或 Final Acceptance 条件则提交最终 package。

## Baseline validation

- Pre-change full suite: 23 files / 530 tests PASS。
- Post-fix: ISSUE-037 focused 9/9、Match targeted 140/140、full 23 files / 539 tests、lint、production build、diff/scope/secret checks PASS。
- Git worktree before plan creation: clean。
- Latest artifact SHA-256: `5febd1400a781771d5f5cccb5414e2ef3ac40bfbc9ed9843f970f00afcb8fb82`。

## Remaining work

- Frozen three-run E2E batch on the new baseline。
- ISSUE-028～037 closure/disposition audit。
- Phase 2.4 Final Closure Audit；不得进入 Phase 2.5。
