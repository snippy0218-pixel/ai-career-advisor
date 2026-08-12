# Project Execution Plans

本文件是长期执行入口，不替代冻结 Contract、Handoff 或 Phase acceptance 文档。

## Current plan

- Phase：2.4 Quality & Robustness；Phase 2.5 未授权。
- 目标：关闭或正式处置全部 P1 release blockers，使 Q-A～Q-J 与完整 deterministic / E2E Gate 达到 Final Acceptance Ready。
- 详细执行状态：`PHASE-2-4-AUTONOMOUS-PLAN.md`。
- Issue 状态：`ISSUE-LEDGER.md`。
- Gate 定义与当前证据：`QA-GATES.md`。
- Product Owner / QA 已废弃 per-cycle stopping model并恢复 Phase 2.4 持续自治。ISSUE-033 generation-contract structural stabilization 已完成 deterministic Gate（571/571）；下一步冻结 implementation commit 后执行新的 exactly-3 final acceptance batch。Phase 2.5 仍未授权。

## Execution discipline

每个 baseline 使用同一闭环：inspect → exact regression → smallest systemic fix → focused/targeted/full/lint/build → immutable commit → fixed three-run E2E batch → evidence adjudication。相同 root cause 最多三个 stabilization cycles；触及 Stop & Escalate 条件则停止。

历史 artifact 永久保存在 `docs/acceptance-artifacts/`，不得覆盖或删除。
