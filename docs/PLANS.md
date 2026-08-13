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
- baseline-3（`f7838a1…`）是 `0` model call/content sample 的 route-flag preflight failure；baseline-4 在同一 implementation 上完整执行 Phase 2 14×3，结果为 21/42 PASS、26 条 complete chain。
- baseline-5（`83a1810…`）完整执行同一冻结 Phase 2 14×3，结果为 30/42 PASS、31 条 complete chain、失败后下游调用 0；全部 artifacts 已永久保留且未 cherry-pick。ISSUE-041/044 相邻扩展及 ISSUE-048/049 已完成 focused `161/161`、相关 targeted `228/228`、full `625/625`、lint/build、diff/scope/secret；下一步提交新的 immutable baseline，再运行完整 Phase 2 14×3 replacement matrix。
- baseline-6（`8b8cae6…`）完整执行 Phase 2 14×3：35/42 PASS、39 条 complete chain、失败后下游调用 0，未追加 run 4。ISSUE-042/044/048 相邻 stabilization 与新 ISSUE-050 artifact completeness 当前 focused `139/139`、full `630/630`、lint/build/diff/scope/secret/process PASS；下一步提交 baseline-6 artifacts 与新 immutable implementation，再运行完整 replacement matrix。
- baseline-7（`13900bf…`）完整执行 Phase 2 14×3：39/42 PASS、40 条 complete chain、失败后下游调用 0，未追加 run 4。仅剩 mixed-status Recommendation 粒度与 X-F 缺失年限证据措辞两个根因；focused `103/103`、full `631/631`、lint/build/diff/scope/secret/process PASS。下一步提交 immutable baseline，再运行完整 replacement matrix。
- baseline-8（`6f0eab7…`）因本地生产 server 进程在 TC-P2-01 R3 Match 期间退出而被裁定为 infrastructure-interrupted batch：2 个完整 content samples 后为 1 个 Match transport failure + 39 个 JD transport failures；全部 42 records 保留，禁止复用其中 2 个成功样本。ISSUE-039 fail-fast 的 category/code mismatch 已修复，exact `8/8`、full `631/631`、lint/build PASS；新 immutable commit 与持久 server 后运行完整 replacement matrix。
- baseline-9（`2b8bc40…`）是有效完整 Phase 2 14×3 content batch：39/42 PASS、40 complete chains、失败后下游调用 0，server 全程存活且无 run 4。三项失败分别为 threshold/proficiency 否定边界、Recommendation hypothetical status、numeric duration shortfall；相邻稳定化 focused `272/272`、full `634/634`、lint/build PASS。下一步完成审计、提交 immutable baseline 并运行完整 replacement matrix。
- baseline-10（`28c0ccf…`）是有效完整 Phase 2 14×3 content batch：40/42 PASS、40 complete chains、失败后下游调用 0，baseline-9 三项失败均 3/3 PASS。仅 TC-P2-11 R1、TC-P2-14 R1 在 Strength/Gap 失败；窄词法边界修复 focused `90/90`、full `636/636`、lint/build PASS。下一步完成审计、提交 immutable baseline 并运行完整 replacement matrix。

## Execution discipline

每个 baseline 使用同一闭环：inspect → exact regression → smallest systemic fix → focused/targeted/full/lint/build → immutable commit → fixed three-run E2E batch → evidence adjudication。若触及冻结 Contract/架构冲突、无法裁决证据或其他真实 Stop & Escalate 条件则停止。

历史 artifact 永久保存在 `docs/acceptance-artifacts/`，不得覆盖或删除。
