# Project Execution Plans

本文件是长期执行入口，不替代冻结 Contract、Handoff 或 Phase acceptance 文档。

## Current plan

- Phase：2.4 Quality & Robustness = PASS / CLOSED；Phase 2.5 未授权。
- 目标：已完成；等待 Product Owner / QA review 或单独的 Phase 2.5 authorization。
- 详细执行状态：`PHASE-2-4-AUTONOMOUS-PLAN.md`。
- Issue 状态：`ISSUE-LEDGER.md`。
- Gate 定义与当前证据：`QA-GATES.md`。
- final acceptance batch 2 在 `803289b…` 上完成 3/3 complete chains，X-A～X-J 全绿；ISSUE-028～038 closed，Q-A～Q-J PASS。最终证据见 `PHASE-2-4-FINAL-ACCEPTANCE.md`。Phase 2.5 仍未授权。
- Phase 2.5 Pre-Authorization Audit 已完成，见 `PHASE-2-5-PRE-AUTHORIZATION-AUDIT.md`。当前 recommendation：`NOT READY — PO DECISION REQUIRED`；仅等待 release surface、冻结 acceptance material/model authorization、final fallback-rate rule 三项 PO 决策，不得提前实施 Phase 2.5。

## Execution discipline

每个 baseline 使用同一闭环：inspect → exact regression → smallest systemic fix → focused/targeted/full/lint/build → immutable commit → fixed three-run E2E batch → evidence adjudication。若触及冻结 Contract/架构冲突、无法裁决证据或其他真实 Stop & Escalate 条件则停止。

历史 artifact 永久保存在 `docs/acceptance-artifacts/`，不得覆盖或删除。
