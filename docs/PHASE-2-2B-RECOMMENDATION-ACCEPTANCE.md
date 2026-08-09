# Phase 2.2B-1 Acceptance — Recommendation Core

> 日期：2026-08-10
> 状态：**CONDITIONAL PASS / ISSUE-026 NARROW SEMANTIC STABILIZATION IN PROGRESS**
> Gate 边界：本文只记录 Recommendation Core；不自行宣布 PASS，不授权 Strength/Gap 或 Phase 2.3。

## 1. Scope 与基线

- 输入：validated `match-core-v1`；Match Core 全程只读；
- 输出：validated `recommendation-core-v1`；等级仅为 `priority / try / cautious / not_recommended`；
- runtime model：`deepseek-v4-flash`；benchmark deferred / not required；
- 禁止字段与功能：confidence、score、strength、gap、greeting、简历建议、学习计划、多岗位比较；
- Phase 2.2A Final Gate baseline：`dabe3b513f7062b1ffdafd5cacc3b0eb5e939c08`。
- Final implementation/audit commit：`e2983c6fd4b0e71e1e6abe7209f5a935df6e0a2d`。
- Product Owner / QA Gate Review 将 OBS-003 / OBS-004 合并升级为 `ISSUE-026 — Unsupported Hard-Requirement Waiver Framing`（P1 / Recommendation Core Gate Blocker）；旧 10×1 / 10×3 只保留为历史证据，不得作为 stabilization final matrix。

## 2. Architecture

- `recommendation-schema.ts`：strict Raw/Final Schema、稳定 `MI-*` ledger、allowed-level eligibility、R-A～R-K Final validation；
- `recommendation-prompt.ts`：只读 Match ledger 与 allowed set；禁止重新判定 Match status 或创建事实；
- `recommendation-deepseek.ts`：独立 DeepSeek adapter、一次有界 Recommendation Repair、repair 后 fail-closed、Match Core immutability diagnostics；
- `/api/recommendation/analyze`：独立服务端入口，不修改 Match Core API；
- `run-phase-2-2b-recommendation-matrix.mjs`：RC-TC-01～10 preflight / clean matrix 的统一 runner。

## 3. Final Schema

Final 字段：`schemaVersion`、`matchSchemaVersion`、`allowedRecommendationLevels`、`recommendationLevel`、`summary`、`supportingMatchRefs[]`、`counterMatchRefs[]`、`limitations[]`、`questionsToConfirm[]`。每个 limitation/question 必须携带现有 `MI-*` 引用；不存在新的 JD/Candidate truth layer。

## 4. Deterministic Guardrails

- R-A Priority Eligibility；
- R-B Not Recommended Evidence；
- R-C Match Status Fidelity；
- R-D Unknown Preservation；
- R-E Hard Gap Explanation；
- R-F Preferred Isolation；
- R-G Reference / Evidence Integrity；
- R-H Final Schema；
- R-I Match Core Immutability；
- R-J No Fabricated Candidate/JD Facts。
- R-K Waiver / Flexibility Evidence Integrity。

Allowed-level 层只决定合法区间，不用简单计数公式替代模型判断。模型只能在合法集合内选择；所有 Final 输出再次做确定性验证。

## 5. Static Tests

- Recommendation 专项覆盖十个 RC fixture、allowed levels、R-A～R-J 拒绝路径、一次 repair、repair 后 fail-closed、Match Core immutability，以及 mixed-status 分句与疑问语境 false-positive regression；
- 最终全量自动化：263/263 PASS（13 files）；
- ESLint：PASS；
- Next.js production build：PASS，`/api/recommendation/analyze` 正常纳入动态路由；
- Phase 1 / Phase 2.1 / Phase 2.2A 既有自动测试无回归。

## 6. RC-TC-01～10 ×1 Preflight

- final commit：`e2983c6…`；
- 10/10 HTTP 200、Final Schema 10/10、allowed level 10/10、unknown preservation 10/10；
- R-A～R-J 全部 PASS；fabricated claim 0；repair 0/10；
- latency：min 1,609ms、max 2,440ms、average 1,983ms；
- artifact：`docs/acceptance-artifacts/phase-2-2b/recommendation-core-preflight.json`。

## 7. 10×3 Clean Matrix

同一 final commit `e2983c6…`，未经挑选的 RC-TC-01～10 ×3：

| TC | Final level 分布 | Allowed | Support refs | Counter refs | Repair | 结果 |
|---|---|---|---:|---:|---:|---|
| RC-TC-01 | priority 3/3 | priority / try | 6 | 0 | 0 | PASS |
| RC-TC-02 | cautious 3/3 | cautious / not_recommended | 0 | 3 | 0 | PASS |
| RC-TC-03 | cautious 3/3 | cautious | 0 | 0 | 0 | PASS |
| RC-TC-04 | try 3/3 | try / cautious | 3 | 0 | 0 | PASS |
| RC-TC-05 | try 2/3；priority 1/3 | priority / try | 3 | 0 | 0 | PASS |
| RC-TC-06 | cautious 3/3 | cautious | 0 | 0 | 0 | PASS |
| RC-TC-07 | cautious 3/3 | cautious | 0 | 3 | 0 | PASS |
| RC-TC-08 | not_recommended 3/3 | cautious / not_recommended | 0 | 3 | 0 | PASS |
| RC-TC-09 | try 3/3 | try / cautious | 3 | 0 | 0 | PASS |
| RC-TC-10 | cautious 3/3 | cautious | 0 | 0 | 0 | PASS |

汇总：30/30 HTTP 200、Final Schema 30/30、allowed level 30/30、unknown preservation 30/30、R-A～R-J 全部 PASS、fabricated claim 0、repair 0/30；latency min 1,074ms、max 2,493ms、average 1,664ms。artifact：`recommendation-core-clean-matrix.json`。

### 7.1 R-A～R-J

| Gate | 结果 |
|---|---|
| R-A Priority Eligibility | PASS |
| R-B Not Recommended Evidence | PASS（适用输出 100%） |
| R-C Match Status Fidelity | PASS（0 contradiction） |
| R-D Unknown Preservation | PASS（100%） |
| R-E Hard Gap Explanation | PASS（适用输出 100%） |
| R-F Preferred Isolation | PASS |
| R-G Reference / Evidence Integrity | PASS（100%） |
| R-H Final Schema | PASS（30/30） |
| R-I Match Core Immutability | PASS（30/30） |
| R-J No Fabricated Candidate/JD Facts | PASS（0） |

### 7.2 保留的失败与修复证据

- `preflight-infrastructure-failure-01`：受限沙箱网络导致 10/10 503，不计产品 Gate；
- `preflight-failed-ec6bf76`：纯 unknown 场景仍允许 try，与 try 必须有正向核心证据冲突；修复为无正向核心证据时只允许 cautious；
- `clean-matrix-failed-c0f5cff`：RC-TC-05 1/30 repair 后 fail-closed；随后引入 validation issue diagnostics，并把合法/必需 MI refs 明确传给初稿与 repair；定向诊断 12/12 通过；
- `preflight-failed-05c3331`：疑问句被 Candidate Fact 正则误报、mixed-status summary 被整段 status 校验误报；修复为疑问/未知语境豁免及按 MI 分句校验；
- 两轮 runner false-positive artifact：独立 audit 先后对 mixed-status 与疑问语境误报；runner 与 runtime validator 同步后从头重跑最终 Gate；
- 所有历史 artifact 均永久保留，未覆盖或挑选结果。

## 8. Human Content Scores

逐条审阅 30 个持久化输出，共 180 个评分；评分为 Codex 按冻结 rubric 的人工式内容审阅，不冒充独立 Product Owner / QA 评分。

| 维度 | 平均 | 最低 |
|---|---:|---:|
| 推荐等级合理性 | 4.82 | 3.8 |
| 理由与 Match 一致性 | 4.91 | 4.5 |
| 信息克制 | 4.77 | 3.8 |
| unknown 处理 | 4.96 | 4.5 |
| 可执行性 | 4.56 | 3.8 |
| 表达自然度 | 4.37 | 4.0 |

综合平均 4.73，最低单项 3.8，达到 ≥4.0 / ≥3.0 标准。完整逐输出记录：`recommendation-core-human-scores.json`。Hard Gates 独立判定，未被评分覆盖。

### 8.1 新观察

- `OBS-003 — Cautious Hard-Unmet Waiver Rationale Specificity`：RC-TC-02 3/3 在 JD 无显式豁免语句时选择 allowed set 内的 cautious，并使用通用 HR 豁免确认理由；Contract 合法，但等级合理性最低 3.8，建议 Gate Review 关注是否需收紧未来文案，不在本轮改 Contract；
- `OBS-004 — Unknown Limitation Wording Precision`：RC-TC-06 run 2 对 hard unknown 使用了“豁免/口径”措辞；unknown 仍被正确保留且未转成 unmet/not_recommended，信息克制 4.0，不构成 Hard Gate failure。

## 9. ISSUE-026 Stabilization

### 9.1 Root Cause 与离线审计

- 根因：旧 prompt 规则 6 要求 cautious hard unmet 解释“豁免/口径”，旧 R-E 又只检查 `HR/招聘方/豁免/放宽/口径/确认` 词面存在，二者均未验证同一 MI 的 JD waiver evidence；
- 对既有 30-request clean matrix 做零模型调用离线审计：hard 相关请求 15 条（hard unmet 6、hard unknown 9）；Candidate-information confirmation 9、supported waiver claim 3、unsupported waiver claim 4、unknown→unmet drift 0；
- 4 条无依据 claim：RC-TC-02 三次（request_id `5dc53d3a-6531-43c2-8e36-cd2c10b815fe`、`cbcfb511-d148-40bd-b22a-7a7febb5b3ea`、`bd6c7891-4d29-4e45-bfc2-98bfa582f83c`）及 RC-TC-06 run 2（`b8aa4b81-78f8-41ad-9a52-2d3f5ef3d340`）；原始措辞永久保存在 `recommendation-waiver-audit.json`；
- 历史 OBS-003 / OBS-004 与初始 ISSUE-026 evidence 保留，没有覆盖旧 artifact。

### 9.2 Implementation 与 Static Gate

- 公开 `recommendation-core-v1` Final Schema 不变；内部新增 explicit waiver / alternative qualification 分类与可追溯 MI constraints；
- prompt / repair prompt 最终升至 v1.2；hard unknown 优先 Candidate fact，hard unmet 无 waiver 只允许 strictness confirmation，alternative qualification 不称为 waiver；无 evidence 的 MI 连否定式 waiver/substitution 套话也删除，避免 repair 重复违规；
- R-E 收敛为 hard gap 明示与结构引用；新增 R-K 服务端 fail-closed validator、diagnostics 与 acceptance runner；
- 新增 RK-TC-01～06，覆盖 hard unknown、无 waiver hard unmet、明示 waiver、强 Candidate 不推出 waiver、明示 alternative qualification、unknown + JD waiver；
- 当前静态结果：269/269 PASS（13 files）、lint PASS、production build PASS；Match Core 未修改。

### 9.3 Fresh Runtime Evidence

首轮固定 commit `cd0a0a9…` 的新 preflight 为 9/10：RC-TC-02 request_id `1ea51d98-f80a-40f5-8da0-07799f5981c0` 初稿与一次 repair 均触发 R-K unsupported waiver/substitution，服务端正确 fail-closed；完整失败 artifact 保留。另有一次未开启 diagnostics header 的 runner 假阴性 artifact，及开启 header 后 RC-TC-02 定向 1/1 PASS artifact，均保留不覆盖。针对 repair 重复使用否定套话实施 prompt v1.2 最小修复后，必须固定新 implementation commit 并从头执行新的 RC-TC-01～10 ×1；仅全绿后执行同一 commit 的 ×3。

## 10. Regression 与 Gate Recommendation

- 最终 regression：263/263、lint、production build PASS；Phase 1 / Phase 2.1 / Phase 2.2A 自动测试无回归；
- Match Core 未修改；Strength/Gap、Personalized Greeting、score/confidence 等未实现；runtime model 未更换；
- 工程 Gate 建议：**Recommendation Core evidence ready for Product Owner / QA review**；本文不自行宣布 Phase 2.2B-1 PASS；
- Stop & Escalate：最终版本未发现系统性 level/status/unknown/counter-evidence 矛盾、事实幻觉或既有 Phase regression；
- 在 Product Owner / QA 明确决策前，停止产品实现，不进入 Strength/Gap 或 Phase 2.3。
