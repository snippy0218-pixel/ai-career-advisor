# Phase 2.1 Acceptance — Candidate Profile Foundation（执行数据记录，非 Final PASS）

> 生成日期：2026-08-08
> 状态：**Phase 2.1 Stabilization 完成 → STOP & ESCALATE**（PF-H 未达标，详见 §10–§17；本文件不宣称 Final PASS）
> 依据：`docs/PHASE-2-CONTRACT.md`（Phase 2.0 Contract Gate = PASS / CLOSED，baseline `8bf6cf6…`）

## 1. 实现审计结论（复用 / 新增 / 禁改）

| 项 | 结论 |
|---|---|
| 复用 Phase 1 基建 | Raw→Final 分层思想、Zod 校验模式、evidence 逐字/whitespace-normalized 校验（`findNormalizedEvidenceSpans`）、request_id、fail-closed、diagnostics、ApiError 错误映射 |
| 必须新增 | Candidate Profile 事实空间（Profile Schema/PF Evidence/语义校验/Profile Repair），与 JD 事实空间完全隔离 |
| 绝不能修改 | `src/lib/analysis-schema.ts`、`src/lib/deepseek.ts`、`src/lib/prompt.ts`、`src/app/api/analyze/route.ts`、Phase 1 测试执行逻辑 |
| 架构 | **独立 route ＋ 独立 service ＋ 独立 schema/prompt 模块**：`/api/profile/analyze`、`profile-deepseek.ts`、`profile-schema.ts`、`profile-prompt.ts`；不把 JD 与 Profile 混入同一事实空间 |

## 2. 实现文件（Phase 2.1 全部为新增）

- `src/lib/profile-schema.ts`：Raw/Final Profile Schema、PF ledger（`PF-001…`）、evidence 解析（PF id / verbatim / whitespace-normalized）、语义升级检查、可溯性检查（含 near-verbatim 降级判定）；
- `src/lib/profile-prompt.ts`：`profile-structuring-v1` 提示（仅把用户原文当数据、禁止推测/升级、PF 引用、注入视为数据）；
- `src/lib/profile-deepseek.ts`：`analyzeProfileWithDeepSeek` 管线（Raw→normalize→一次受限 repair→Final；`ProfileDiagnostics`）；
- `src/app/api/profile/analyze/route.ts`：POST `{ profileText }`，400/502 结构化错误，request_id，diagnostics 日志；
- `src/app/profile/page.tsx`：最小可验证界面（textarea＋结果 JSON）；
- 测试：`profile-schema.test.ts`、`profile-deepseek.test.ts`、`api/profile/analyze/route.test.ts`。

## 3. Profile 输入限制（实现值）

- `MAX_PROFILE_LENGTH = 12_000`（`configurable validated input limit`，**非 Product Contract 冻结值**）；
- 工程依据：DeepSeek context 充足；profile-structuring 提示＋原文 token 占用远低于 context；12,000 CJK 字符 ≈ 6–9k tokens，latency/repair 预算内；与 Phase 1 JD 上限对称；
- 冻结行为：超限返回结构化 400（无模型调用、无 silent truncation）；PF 始终回溯 Raw Profile。

## 4. 真实请求数据（PF-TC-01～08 × 3 = 24 次；另 TC-05 post-fix 3 次）

| TC | 冻结输入（字符 / SHA-256） | HTTP（3 次） | Final Schema | PF Integrity | Fact Integrity | Repair | 备注 |
|---|---|---|---|---|---|---|---|
| PF-TC-01 完整 Profile | 173 / `6cfec6fe…` | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 教育/实习/项目/技能/证书/偏好全部结构化，程度词保留 |
| PF-TC-02 极少信息 | 20 / `2178263e…` | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 仅教育＋Python，未补经历 |
| PF-TC-03 程度词保护 | 73 / `dfa05bc2…` | 200/200/200 | 3/3 | 100% | 0 升级 | 0/3 | 了解/接触过/基础/熟悉/参与/协助全部保留（run3 事实 6/8，见 OBS-001） |
| PF-TC-04 课程 vs 工作 | 88 / `d5e2e1b8…` | 200/200/200 | 3/3 | 100% | 0 升级 | 0/3 | 课程项目仅入 projects；无 experiences；技能保留"（课程作业）"限定（run3 5/6，见 OBS-001） |
| PF-TC-05 团队归属 | 54 / `3608a883…` | 200/200/200（pre-fix） | 3/3 | 100% | 0 幻觉 | 2/3 | **pre-fix：run2 返回空 Profile（0 facts，静默丢失）；run1/3 仅保留 1/2 事实** —— 已修复，见 §6 |
| PF-TC-06 信息缺失 | 61 / `6ddc14b6…` | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 未凭空出现 English/SQL/Figma（run3 3/4，见 OBS-001） |
| PF-TC-07 Prompt Injection | 55 / `cd146adf…` | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 注入文本仅作为 PF 数据保留，未执行，无 5 年经验事实 |
| PF-TC-08 长输入（近上限） | 11,701 / `291d4438…` | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 无 silent truncation；重复行按 Contract 去重；全部不同事实保留 |
| 超限（12,001 字符） | — | 400 | — | — | — | — | 结构化错误，无模型调用 |
| **TC-05 post-fix** | 同一输入 | 200/200/200 | 3/3 | 100% | 0 幻觉 | 0/3 | 3/3 保留全部 2 条事实，无需 repair |

合计：27 次真实请求 27/27 HTTP 200（另有 1 次超限 400 无模型调用）；PF Evidence Integrity 100%（0 verbatim fail、0 ref fail）；Fact Integrity 0 幻觉、0 程度/归属/类型升级。

## 5. Metrics（Phase 2.1）

- `profileRepairRate`：触发 profile repair 的请求 2/27 ≈ **7.4%**（均为 pre-fix TC-05；post-fix TC-05 0/3）；
- repair attempt count：2（每请求 1 次，同请求多次计 1）；repair success 2/2；repair failure 0；
- final fail-closed：0（pre-fix 空 Profile 为"静默通过"缺口，已由零 facts guard 修复；guard 单元测试覆盖）；
- latency：min 1.78s / max 6.64s / 均值 ≈ 3.9s；upstream attempts：25×1、2×2（repair 计入）；
- 阈值未冻结（按 Contract：Phase 2.4 以真实固定回归集数据决定）。

## 6. Violations / 失败记录（不隐藏）

1. **PF-TC-05 pre-fix run2：返回空 Candidate Profile（0 facts）**——输入有效但所有事实在校验中被丢弃，且 repair 未能恢复，管线按"Schema 通过（空数组）"返回。根因：模型事实 evidence 无法解析＋repair 反馈过泛。处置：新增**零 facts fail-closed guard**（输入有内容但最终 0 facts 且 0 derived → 502）＋细化 repair 提示；post-fix 3/3 恢复正常；
2. **PF-TC-05 pre-fix run1/3：项目事实被丢弃（1/2 事实）**——模型把去掉"项目："前缀与"我"的最小标准化标为 `profile_stated`，逐字校验拒绝。处置：**near-verbatim 降级**（非逐字但高可溯性＋无升级的 `profile_stated` → `normalized_stated`，不放宽事实/证据要求）；post-fix 3/3 两条事实全部保留；
3. **OBS-001（P2 候选）：事实完整性波动**——TC-03 run3 6/8、TC-04 run3 5/6、TC-06 run3 3/4、TC-05 pre-fix 1/2：短/简单 Profile 上模型偶发遗漏部分事实（非幻觉、非契约违规）。记录观察，Phase 2.2/2.4 评估（是否对"行数 vs 事实数"做提示/校验强化）；
4. **文案（P3）：** profile route 的 `INVALID_INPUT` 复用 JD 侧文案（"招聘信息"）；建议按 Profile 语境调整（不阻塞）。

## 7. Gates（Phase 2.1）

| Gate | 结果 |
|---|---|
| PF-A Candidate Fact Integrity | 0 幻觉（27/27 可回溯） |
| PF-B PF Evidence Integrity | 100%（0 verbatim fail、0 ref fail） |
| PF-C Semantic Preservation | 0 程度升级/类型升级/归属升级（扫描 熟练/精通/独立负责/主导/正式工作/全职 等＝0） |
| PF-D Source Isolation | 仅 Raw Profile 来源（本阶段无 JD 输入，隔离由构造保证） |
| PF-E Schema | Final Profile Schema 27/27 PASS |
| PF-F Fail Closed | pre-fix 空 Profile 缺口已修复（零 facts guard，单元测试）；其余校验失败均 fail-closed |
| PF-G Injection Resistance | TC-07 3/3 无协议突破；注入文本仅作数据 |

## 8. Phase 1 Regression

- 全量自动化：**7 文件 177/177 通过**（含全部 Phase 1 测试）；lint 通过；production build 通过（新增 `/api/profile/analyze`、`/profile`）；
- Phase 1 业务文件零修改（新增文件独立，未触碰 analysis-schema.ts / deepseek.ts / prompt.ts / analyze route）；
- 完整 TC-01～TC-10×3 人工 Final Acceptance 按 Contract 留待 Phase 2.5。

## 9. 结论

- 未触发任何 Stop & Escalate 条件（无系统性幻觉、无契约破坏、无 Phase 1 回归、注入未突破、模型可支撑 Contract）；
- 记录 2 个真实失败（均已在实现内修复并验证）＋ 1 个 P2 观察（OBS-001）＋ 1 个 P3 文案项；
- **Gate 建议：CONDITIONAL PASS**（待 QA 复核：① OBS-001 事实完整性波动与 repair 质量；② 接受零 facts fail-closed guard 与 near-verbatim 降级行为；③ 文案 P3 项）。本文件不宣称 Final PASS。

## 10. ISSUE-025（OBS-001 正式升级，P1 / Phase 2.1 Gate Blocker）

- **定义**：Candidate Profile Fact Completeness / Silent Omission——Raw Profile 存在真实候选人事实 → Profile Structuring 未输出 → 最终 Match Engine 不可见 → 可能产生错误 `unknown`/`partial`/recommendation。
- **统计口径核验（2026-08-09）**：Gate 引用的"PF-TC-03 6/8、PF-TC-04 5/6、PF-TC-06 3/4"经真实记录核验为**含 derived observations 的总输出数**口径；按候选事实（不含 derived）重算，TC-03/04/06 在原始 24 次矩阵中候选事实均为 100% 保留（6/6、4/4、3/3）。真实的候选事实遗漏证据为：TC-05 pre-fix（1/2、0/2，已修复）、TC-02 run2（Python）、TC-08（Figma/校园活动部分提取）、TC-04（"没有正式工作经历"未入候选事实）。ISSUE-025 升级成立（遗漏风险模式真实存在），引用数字以本核验为准。
- **状态**：Open / P1 / Gate Blocker（Stabilization 未达到 PF-H）。

## 11. expected manifest（PF-TC-01～08 冻结）

每个 must-preserve fact 记录：类别 / 原始片段 / 关键语义限定 / 是否允许 normalized_stated / 禁止升级。

| TC | manifest（category | 语义限定） |
|---|---|
| PF-TC-01 | education|计算机+本科；experiences|产品运营实习生；projects|推荐系统；skills|Python+了解；skills|Excel+熟悉；skills|Figma+接触；certificates|CET；preferences|杭州；careerTarget|产品运营 |
| PF-TC-02 | education|计算机本科；skills|Python+了解 |
| PF-TC-03 | skills|Python+了解；skills|SQL+接触；skills|HTML+基础；skills|Excel+熟悉；projects|校园活动策划；experiences|课程资料整理 |
| PF-TC-04 | education|信息管理本科；projects|推荐系统课程项目；projects|数据分析课程作业；skills|Python+课程作业；experiences|没有正式工作经历（负向事实） |
| PF-TC-05 | projects|校园二手平台（保留团队/负责限定，禁止独立/主导）；experiences|数学建模（保留队伍归属） |
| PF-TC-06 | education|市场营销本科；skills|Python+了解；experiences|市场部实习生 |
| PF-TC-07 | education|计算机本科；skills|Python+了解；projects|课程项目（注入行 NOT must-preserve） |
| PF-TC-08 | education|计算机本科；skills|Python+了解；projects|推荐系统课程项目；experiences|运营实习生；projects|校园活动；skills|SQL+接触；skills|Figma+接触；experiences|协助老师 |

均允许 `normalized_stated`；禁止程度/经历类型/归属升级（了解→熟练、参与→负责、团队→独立、课程→工作等）。

## 12. profileFactRecall 与 Gate PF-H

- 定义：numerator = 最终 Validated Candidate Profile 中保留的 must-preserve facts 数量；denominator = 冻结 manifest 总数；Gate = **100%**；仅用于人工冻结 QA 集，生产环境不自动认定全部真实事实。
- 双重口径：content recall（事实内容保留于任一候选事实类别）与 category recall（内容保留且类别正确）。

## 13. Normalization 审计（near-verbatim）

- **最终机制**：严格 allowlisted normalization——仅允许删除字段标签、空白、标点与主语代词（我/我们）后的 substring 校验；无替换、无编辑距离、无 similarity threshold。
- **曾评估 token-containment**（允许程度词重排，如"了解 Python"→"Python：了解"）：因同一 PF 行其他片段含"负责"时"参与→负责"可通过包含检查（跨片段替换回门），无法证明语义安全，**已拒绝**；保留严格 substring 版本（paired 单测：合法标签剥离/空白/标点/代词删除通过；参与→负责、协助→主导、了解→熟练、团队→独立、课程→工作、约1年→2年、未明确→确定全部拒绝）。
- 代价：程度词重排且被模型误标 `profile_stated` 时会被保守丢弃（触发 repair；repair 不稳定）。

## 14. 修复尝试与结果轨迹（recall = content 口径）

| 版本 | 机制 | HTTP | content recall | 备注 |
|---|---|---|---|---|
| 原始 24＋TC-05 fix | 无 completeness 机制 | 27 次含 pre-fix 失败 | — | 不作为最终矩阵 |
| v2 | PF-unused 触发 repair | 24/24 | 91.2% | TC-05 completeness schema 失败 |
| v3 | always-on 二次核对＋prompt 强化 | 19/24（5×瞬时上游 502，重试 6/6 200） | — | 上游故障，非代码失败 |
| v4 | always-on 自由二次核对 | 24/24 | 93.9% | TC-04/05/08 残留 |
| v5 | 逐行 verdict | 24/24 | 85.1% | 严格 allowlist 丢弃 profile_stated 技能 |
| **v6（最终代码）** | 逐行 verdict＋严格 allowlist | **24/24** | **84.2%** | **PF-H 未达标 → Stop & Escalate** |

## 15. Final Clean Matrix（v6，同一最终 commit 代码）

- 24/24 HTTP 200；Final Schema 24/24；PF Evidence Integrity 100%（0 verbatim fail、0 ref fail）；Fact Integrity 0 幻觉、0 语义升级（扫描 熟练/精通/独立/主导/正式工作/全职＝0）；Prompt Injection 3/3 未突破；
- **profileFactRecall：content 96/114 = 84.2%；category 89/114 = 78.1%**；
- 稳定遗漏：TC-04 "没有正式工作经历" 3/3；TC-08 Figma 3/3（部分 run 还缺 校园活动/协助老师）；TC-01 技能 2/3 runs；TC-02 Python 2/3 runs；
- Metrics：profileRepairRate 11/24 ≈ **45.8%**；completenessRepairSucceeded 18/24 = 75%；droppedCandidateFactCount 8；upstream 每请求 2–3 次调用；latency 2.9–9.1s；final fail-closed 0。

## 16. Gate PF-H 结论与 Stop & Escalate

- **PF-H = FAIL**（84.2% < 100%）。
- 触发条件：Gate §十五 **#3**（near-verbatim 无法在不引入语义回门的前提下达到所需 recall——程度词重排需 token-containment，存在跨片段替换风险，无法证明安全）与 **#4**（冻结短 Profile 在最终版本稳定遗漏 must-preserve fact：TC-04/TC-08/TC-01/TC-02）。
- 未选择绕过：未放宽 PF evidence、未放宽 semantic preservation、未强制 Raw 行转 Fact、未把注入当 Fact、未降 PF-H。
- 升级包：① 根因——模型提取/分类随机性与严格校验的互斥（首轮偶发遗漏＋sourceType 误标，repair 不稳定，二次核对仍残留）；② 影响——recall<100% 时后续 Match Engine 可能得到错误 unknown/partial；③ 建议人工决策方向——模型能力评估/换模型、completeness 机制重新设计（per-fact 分段提取或 checklist 融合）、对 manifest"负向事实"条目（TC-04"没有正式工作经历"）的产品裁定、或经人工批准接受有界 recall 目标（即放宽 PF-H，需人工 Gate）。

## 17. 历史失败保留

- pre-fix 证据（TC-05 空 Profile、TC-05 1/2）与 v1–v6 各版本矩阵原始响应/日志均保留于 `%TEMP%\p21-regression\`；不删除、不替换、不弱化。

## 18. Coverage diagnostic baseline（2026-08-09）

- coverage-driven extraction、PF disposition、atomic claims、一次有界局部 repair、冻结 fixtures、clean-matrix runner 与 diagnostics 已保存为 commit `653383e75dafd22e1807799273fc469e9e476769`；commit 明确为 **failed-gate diagnostic baseline**，不代表 Phase 2.1 PASS；
- 最新零挑样 8×1 preflight：7/8 HTTP 200，33/38 must-preserve facts，TC04 HTTP 502 / PF-H FAIL；Candidate Fact hallucination 0、semantic upgrade 0、source contamination 0；
- TC04 v4 request_id：`b7d361d5-45a9-4887-b87d-9e877e89beff`；持久化机器可读证据见 `docs/acceptance-artifacts/phase-2-1/stop-escalate-preflight-v4.json`；
- 原始 coverage/repair JSON 未被当时 diagnostics 保存，不能事后猜测；此证据限制已写入 artifact。

## 19. TC04 taxonomy audit（0 additional model requests）

- 正式区分 `semanticContentRecall`（完整语义是否存在于任一 validated fact）与 `categoryProjectionRecall`（是否进入 expected Schema/UI category），不修改 PF-H 或 frozen manifest；
- v4 API 边界因 fail-closed 表现为 Case A；诊断同时证明一次 Case C course-scope violation；历史同输入输出曾完整保留 PF-003 语义但只在 projects 中，证明 Case B 路径存在；因此当前失败不能定性为纯 runtime-model semantic omission；
- 当前 category 数组同时承担 canonical storage、UI projection 与未来 Match Engine evidence index，且 atomic claim 只允许单 category，记录为 architecture concern；
- 建议先由 Product/QA 裁定 Contract amendment：canonical atomic semantic fact 与 typed/multi-label projection 是否分离。runtime model benchmark 暂停；完整逐事实映射见 `docs/acceptance-artifacts/phase-2-1/TC04-TAXONOMY-AUDIT.md`。

## 20. Contract Amendment 2.0.1 与 canonical implementation

- Product Owner / QA 批准 Candidate Fact Canonicalization Amendment：`Raw → PF → Validated Atomic Claim → Canonical Candidate Fact → Semantic Classification → Typed Projection`；完整协议见 `docs/PHASE-2-CONTRACT.md` §3.3/§16.1；
- implementation commit：`cfdd13c46b9fa9cb297597481dee0ddc337a664a`；`candidate-profile-v2` 以 `canonicalFacts[]` 为唯一 Candidate Fact truth layer，`CF-001…` 由服务端稳定生成；
- atomic claim 改为一份 `statement` ＋ 多值 `semanticTags[]`；typed category arrays 只保存 CF references，projection 不再生成 statement/evidence/qualifier；
- PF-H 正式澄清为 `semanticContentRecall = 100%`；新增 PF-I `categoryProjectionRecall = 100%`。冻结 Raw Profile、38 条 expected semantic facts、负向事实与历史失败均未删除或改写；仅显式增加 39 个 expected projections。

## 21. Static / deterministic validation

- TC04 fixture 证明：`完成数据分析课程作业，使用 Python 处理 CSV 数据` 确定性成为唯一一条 canonical fact，同时带 `project_experience + skill_usage`，projects/skills 均引用同一 CF；
- schema tests 覆盖 stable CF IDs、multi-tag、projection/tag 双向完整性、无第二事实源、`profile_inferred` 禁入 CF；normalization 与 injection/negative/fail-closed tests 保持；
- 完整自动化：8 files / **199/199 PASS**；lint PASS；production build PASS；Phase 1 protected pipeline 未修改。

## 22. Canonical 8×1 preflight（同 implementation commit）

- artifact：`docs/acceptance-artifacts/phase-2-1/canonical-preflight.json`；commit `cfdd13c…`；8/8 HTTP 200、Final Schema 8/8、PF Evidence 8/8；
- `semanticContentRecall = 38/38 = 100%`；`categoryProjectionRecall = 39/39 = 100%`；0 hallucination、0 semantic upgrade、0 source contamination；Injection PASS；
- TC04：semantic 5/5、projection 6/6；课程工具事实为一条 CF，多标签且同时投影到 projects/skills；
- repair：profile/semantic repair 0；deterministic projection corrections 4；course-tool canonicalization 1；upstream attempts 8；平均 latency 2735 ms；
- PF-A～PF-I 全绿，满足继续 24-request matrix 的前置条件。

## 23. Canonical Final Clean Matrix（8×3 = 24）

- artifact：`docs/acceptance-artifacts/phase-2-1/canonical-final-matrix.json`；同一 implementation commit `cfdd13c…`；24 个 request_id 全部保存；
- HTTP 24/24；Final Schema 24/24；PF Evidence 24/24；Candidate Fact hallucination 0；semantic upgrade 0；source contamination 0；Injection 3/3 PASS；
- **PF-H：semanticContentRecall = 114/114 = 100%**；
- **PF-I：categoryProjectionRecall = 117/117 = 100%**；
- TC04 三轮均为 semantic 5/5、projection 6/6；每轮只有一条课程工具 canonical fact `CF-003`，statement 完整保留课程作用域，tags=`project_experience + skill_usage`，projects/skills 引用同一 CF；
- Metrics：profile/semantic repair 0/24；deterministic projection corrections 11（7/24 requests）；course-tool canonicalization 3；upstream attempts 24（每请求 1 次）；平均 latency 2532 ms。

## 24. Gate recommendation（不自行宣布 PASS）

- 当前工程证据：PF-A～PF-I 全部达到冻结目标，Phase 1 tests/lint/build 无回归；ISSUE-025 的 semantic completeness 与 category projection failure mode 在冻结集上均得到覆盖；
- **建议 Product Owner / QA 进行 Phase 2.1 Final Gate Review**。本文件仍不宣称 Phase 2.1 PASS；ISSUE-025 在人工 Gate 前保持 Open / P1 / Gate Blocker；Phase 2.2 仍未授权。
