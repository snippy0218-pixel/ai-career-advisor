# Project Execution Plans

本文件是长期执行入口，不替代冻结 Contract、Handoff 或 Phase acceptance 文档。

## Current plan

- Phase：2.4 Quality & Robustness = PASS / CLOSED；Phase 2.5 Final Regression / Release Gate = AUTHORIZED / IN PROGRESS。
- 目标：交付统一 `JD + Candidate Profile -> Personalized Match Result` 用户流，冻结并执行 Phase 1 10×3 与 Phase 2 14×3 最终矩阵，完成 Release Gate。
- 详细执行状态：`PHASE-2-5-AUTONOMOUS-PLAN.md`。
- Issue 状态：`ISSUE-LEDGER.md`。
- Gate 定义与当前证据：`QA-GATES.md`。
- Phase 2.4 final acceptance batch 2 在 `803289b…` 上完成 3/3 complete chains，X-A～X-J 全绿；ISSUE-028～038 closed，Q-A～Q-J PASS。最终证据见 `PHASE-2-4-FINAL-ACCEPTANCE.md`。
- Product Owner / QA 已于 2026-08-13 关闭 Pre-Authorization Audit §K 三项决策并授权 Phase 2.5；release surface、fixture/model budget、fallback rule 已冻结在 `PHASE-2-5-AUTONOMOUS-PLAN.md`。
- Stage 1 已逐字恢复 Phase 1 TC-01～10（全部历史字符数与 SHA-256 匹配），并建立 TC-P2-01～14 raw JD/Profile 覆盖集；当前模型调用 0。
- 统一 `/personalized-match` 用户流、六 API fail-closed 编排、完整结果展示及 Phase 2.5 runner 已实现；初始 deterministic/product smoke Gate 已通过并形成 committed baseline。
- Formal baseline-1 在 capability 5/5 后因 server 位于 restricted network sandbox 而产生 72 个极速 `AI_SERVICE_UNAVAILABLE`；provider completion/content sample 均为 0，完整 artifact 保留并由 `infrastructure-adjudication.json` 排除出内容矩阵。ISSUE-039 已修复 runner infrastructure fail-fast，full Gate 更新为 599/599；下一 baseline 将使用已授权的网络环境运行 server。
- Formal baseline-2（`35b92ca…`）为有效完整 batch：Phase 1 30/30 PASS，Phase 2 11/42 PASS、19 条 complete chain、失败后下游调用 0。Phase 1 兼容性证据继续接受。
- baseline-3（`f7838a1…`）是 `0` model call/content sample 的 route-flag preflight failure；baseline-4 在同一 implementation 上完整执行 Phase 2 14×3，结果为 21/42 PASS、26 条 complete chain、失败后下游调用 0。全部 artifacts 已永久保留且未 cherry-pick。ISSUE-041/042/044 扩展及 ISSUE-046/047 已完成 deterministic stabilization；当前 full suite `618/618`、lint/build PASS。下一步提交新的 immutable baseline，并重跑完整 Phase 2 14×3 replacement matrix。

## Execution discipline

每个 baseline 使用同一闭环：inspect → exact regression → smallest systemic fix → focused/targeted/full/lint/build → immutable commit → fixed three-run E2E batch → evidence adjudication。若触及冻结 Contract/架构冲突、无法裁决证据或其他真实 Stop & Escalate 条件则停止。

历史 artifact 永久保存在 `docs/acceptance-artifacts/`，不得覆盖或删除。
