# Project Execution Plans

本文件是长期执行入口，不替代冻结 Contract、Handoff 或 Phase acceptance 文档。

## Current plan

- Phase：2.4 Quality & Robustness；Phase 2.5 未授权。
- 目标：关闭或正式处置全部 P1 release blockers，使 Q-A～Q-J 与完整 deterministic / E2E Gate 达到 Final Acceptance Ready。
- 详细执行状态：`PHASE-2-4-AUTONOMOUS-PLAN.md`。
- Issue 状态：`ISSUE-LEDGER.md`。
- Gate 定义与当前证据：`QA-GATES.md`。
- 当前冻结 deterministic implementation：`4c12ed6…`；batch 3 固定三次为 1/3 complete，同一 broad status/lineage/semantic-ownership root 的 3/3 stabilization budget 已耗尽。当前 **STOP & ESCALATE**，等待 Product Owner / QA disposition；不得继续实现、抽样或进入 Phase 2.5。

## Execution discipline

每个 baseline 使用同一闭环：inspect → exact regression → smallest systemic fix → focused/targeted/full/lint/build → immutable commit → fixed three-run E2E batch → evidence adjudication。相同 root cause 最多三个 stabilization cycles；触及 Stop & Escalate 条件则停止。

历史 artifact 永久保存在 `docs/acceptance-artifacts/`，不得覆盖或删除。
