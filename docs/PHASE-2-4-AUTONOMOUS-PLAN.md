# Phase 2.4 Autonomous Execution Plan

> Updated: 2026-08-12
> Branch / starting HEAD: `main / 9ac1537778e346c4616df92b988ac5bd2efd928a`
> Deterministic implementation commit: `4c12ed6…`
> Formal phase state: `FAIL / BLOCKED / AUTONOMOUS STABILIZATION ACTIVE`; Phase 2.5 `NOT AUTHORIZED`

## Objective

在冻结 Phase 2 Contract 与现有架构内完成 Quality & Robustness closure：Candidate Truth、Match、Recommendation、Strength/Gap、Greeting、diagnostics、runner、failure semantics、regression 和 full-chain E2E 全部达到可审计稳定状态。

## Current blocker and hypothesis

Autonomous batch 1 在 ISSUE-037 初始修复 baseline 上完成固定 3-run，0/3 complete：run 1 到达 Recommendation 后暴露 ISSUE-031 status suffix group false positive；run 2 暴露较弱 participation claim 的 Match lexical entailment false positive，同时正确拒绝无引用 Candidate negative；run 3 正确拒绝 CF-003 的课程/非正式工作污染。

- `CF-004 仅否定正式工作经历`
- `不构成对独立负责能力的明确反证`

Batch 2 在第二 deterministic baseline 上固定执行 3 次，1/3 complete。run 1 完成全链；run 2 的 Recommendation 合法 described-prefix MI group 被 R-C 误判；run 3 的 Match evidence-force boundary 被 M-CANDIDATE-LINEAGE/M-K 误判，同时 raw 中更深的 explicit-CF narration/structured-ref 与跨维度问题原本可能绕过 lineage。三份 artifact 均已保存，无第 4 次。

第三 deterministic baseline 完成 bounded architecture review：Match 与 M-K 共用 evidence-force 语义；显式 `CF-xxx 表明/涉及/...` factual narration 强制进入 structured-ref ownership 与 dimension-local review；Recommendation R-C 解析带描述括号的 prefix MI group 并逐项校验。这是同一 broad status/lineage lexical root 的第 3/3、最后 implementation cycle。

Batch 3 固定执行 3 次，1/3 complete。run 2 完成全链且 X-A～X-J PASS；run 1/3 均在 Match repair 后 502。两次 repair 都在 unknown refs=[] 中重复 positive CF-003 factual narration，违反 frozen unknown-reason rule，并都包含 CF-003 无法支持的 `个人交付/个人职责` ownership upgrade；lineage/M-K 均正确 fail-closed。原 ISSUE-037 合法 CF-004 explicit-negative meta boundary 在两次 repair 均被接受。该 broad root 的 3-cycle budget 已耗尽，正式 STOP & ESCALATE。

最新 Product Owner / QA Gate 已明确废弃 3-cycle stop condition，并要求将 ISSUE-033 作为完整 Match generation-contract robustness problem治理。结构性修复已完成：raw/repair v1.5 共享 status-language matrix；一次被拒 repair 后仅对 lineage/M-K reason 进行 bounded conservative normalization，之后重跑全部 validator；raw/repair/normalized/model metadata 分层保全。deterministic 571/571、lint/build PASS，模型调用 0。

## Execution sequence

1. 建立 ISSUE-037 exact artifact replay 与正/反例 matrix。（完成）
2. 实现 bounded meta-evidence boundary classifier；不改 Contract/public Schema/prompt/provider/fixture。（完成）
3. 运行 focused → Match targeted → full suite → lint → build → diff/scope/secret checks。（完成）
4. 更新 issue/gate/handoff/changelog，提交新的 deterministic baseline。（baseline 2 完成）
5. 在同一 baseline、同一 frozen RB-05 fixture、无代码间改动下执行固定三次 model-backed E2E batch；每次保存独立 artifact。（batch 1～3 完成）
6. 审计三次完整 stage ledger、raw/rejected evidence、Candidate/JD lineage、repair/fallback/latency 与所有 open Issue closure evidence。
7. 若出现新的 Contract 内 deterministic defect，保存整批 evidence 后建立新 baseline 并循环；若满足 Stop & Escalate 或 Final Acceptance 条件则提交最终 package。

## Baseline validation

- Pre-change full suite: 23 files / 530 tests PASS。
- Post-fix: ISSUE-037 focused 9/9、Match targeted 140/140、full 23 files / 539 tests、lint、production build、diff/scope/secret checks PASS。
- Baseline 2: focused 9/9、Match targeted 145/145、Recommendation targeted 83/83、full 23 files / 548 tests、lint、production build、diff/scope/secret checks PASS。
- Batch 1: exactly 3 runs / 0 completed chains; all artifacts preserved in `PHASE-2-4-AUTONOMOUS-BATCH-1.md`。
- Batch 2: exactly 3 runs / 1 completed chain; all artifacts preserved in `PHASE-2-4-AUTONOMOUS-BATCH-2.md`。
- Baseline 3: focused 8/8、Match targeted 150/150、Recommendation targeted 86/86、full 23 files / 556 tests、lint、production build、diff/scope/secret checks PASS。
- Batch 3: exactly 3 model-backed runs / 1 completed chain；另有一份 zero-call local preflight failure artifact，四份均 immutable preserved。完整裁决见 `PHASE-2-4-AUTONOMOUS-BATCH-3-STOP-ESCALATE.md`。
- Git worktree before plan creation: clean。
- Latest artifact SHA-256: `5febd1400a781771d5f5cccb5414e2ef3ac40bfbc9ed9843f970f00afcb8fb82`。

## Remaining work

- Commit the deterministic implementation and durable records, then run one new fixed exactly-three RB-05 final acceptance batch with no inter-run code changes。
- If 3/3 clean, execute full Phase 2.4 closure audit and create `PHASE-2-4-FINAL-ACCEPTANCE.md`; otherwise preserve evidence and continue autonomous implementation-level stabilization。
