# Phase 2.2B-2 Acceptance — Strength + Gap Core

> 日期：2026-08-10
> 状态：**ENGINEERING STABILIZATION EVIDENCE COMPLETE / STOP FOR PRODUCT OWNER & QA FINAL GATE REVIEW**
> Gate 边界：本文只记录 Strength + Gap Core；不自行宣布 PASS，不授权 Personalized Greeting 或其他后续功能。

## 1. Scope 与事实基线

- 输入唯一事实源：validated `match-core-v1`；必要时只沿 `MI → CF → PF` 与 `MI → JD Evidence` 追溯；
- Recommendation 可作为最终 UI 并列结果，但不得成为 Strength / Gap 的事实来源；
- 禁止重新分析 Raw JD / Raw Profile，禁止新增或修改 Candidate Fact、Match status、requirementType 或 Recommendation；
- 输出目标：validated `strength-gap-core-v1`，包含 strengths、gaps、引用、有限 taxonomy 与 bounded suggested action；
- 禁止 score、confidence、greeting、简历改写、面试建议、学习计划、多岗位比较、自动投递。

## 2. Frozen Gate

- SG-A Strength Evidence Integrity；
- SG-B Strength Truthfulness；
- SG-C Direct Strength Status；
- SG-D Transferable Strength Integrity；
- SG-E Gap Type Integrity；
- SG-F Unknown Integrity；
- SG-G Hard Gap Counter-Evidence；
- SG-H Suggested Action Integrity；
- SG-I Reference Integrity；
- SG-J Source / Fact Isolation；
- SG-K Match / Recommendation Immutability；
- SG-L Final Schema。

## 3. Required Execution

1. SG-TC-01～12 静态测试；
2. regression / lint / build；
3. 固定 implementation commit；
4. SG-TC-01～12 ×1 preflight；
5. 仅 preflight 全绿后执行同一 commit 的 12×3 clean matrix；
6. 六维 internal rubric review；
7. 更新本文与 Handoff，提交 evidence commit，然后停止等待 Product Owner / QA Final Gate。

## 4. Architecture / Schema Evidence

- implementation 起点 `46f5529…`，最终矩阵基线 `e217e09db287a0e6336448fd781a0c0358c7b993`；
- `strength-gap-core-v1` 仅接收 strict `{ matchCore: match-core-v1 }`；Recommendation 不进入 request、prompt 或 output；
- Final Schema 仅含 `schemaVersion`、`matchSchemaVersion`、`strengths[]`、`gaps[]`；服务端分配 `ST-*` / `GP-*`，事实引用仅为 `MI-*`；无 score、confidence、severity、recommendation 或 greeting；
- Strength taxonomy：`direct_match / transferable_strength / supporting_strength`；Gap taxonomy：`hard_constraint / evidence_expression / learnable_skill / information`；Action taxonomy：`structural / evidence / learn / confirm`；
- 独立 prompt、一次有界 repair、fail-closed、API `/api/strength-gap/analyze` 与最小 `/strength-gap` UI 已实现；未修改 Match Core、Recommendation、Candidate Profile 或 Phase 1 pipeline。

## 5. Static / Regression Evidence

- 最终静态结果：16 test files、294/294 tests PASS；包含 SG-TC-01～12、SG-A～SG-L 负例、unknown≠deficiency、hard counter-evidence、transferable polarity、bounded action、injection、upstream immutability、repair/fail-closed 与 API tests；
- `npm run lint` PASS（0 warning）；`npm run build` PASS；production routes 包含 `/api/strength-gap/analyze` 与 `/strength-gap`；
- Phase 1、Phase 2.1、Phase 2.2A 与 Recommendation Core 自动化回归未发现失败。

## 6. 12×1 Preflight — PASS

- 同一固定 commit `e217e09…`，`SG-TC-01～12 ×1`：12/12 HTTP 200；SG-A～SG-L 全部 PASS；
- strengths 7、gaps 10、repair 0/12；Candidate claim upgrade 0、fabrication 0、unknown→deficiency 0、unsupported action 0；
- latency：min 873ms / max 2,325ms / avg 1,254ms；
- artifact：`strength-gap-preflight.json`，SHA-256 `17D8B7FA02F0D0AF38E0CC18F112B1F2554B1C1D8BD4F9DA1E0F4F9C4A47F095`。

## 7. 12×3 Clean Matrix — FAILED / STOP

- 同一固定 commit `e217e09…`，36 requests：33 HTTP 200 + 3 HTTP 502；未达到 36/36；
- 失败全部集中于 `SG-TC-07 Experience Evidence Gap`：3/3 initial output 与 3/3 唯一 repair 均触发 `SG-B Candidate claim upgrade` + `SG-D transferable strength cannot upgrade a Candidate fact`；repair 3 attempted / 0 succeeded；
- 33 个成功输出：strengths 18（direct 9 / transferable 6 / supporting 3），gaps 27（hard 6 / evidence 6 / learnable 3 / information 12）；accepted Candidate upgrade / fabrication / unknown deficiency / unsupported action 均为 0；latency min 784ms / max 2,390ms / avg 1,274ms；
- 服务端正确 fail-closed，但 Hard Gate failure 不能由成功率或内容平均分覆盖；六维 internal rubric 未进入最终评分；
- 原始 artifact：`strength-gap-clean-matrix.json`，SHA-256 `659C2010C0C0310300EA76F9A3F482DC87FFC85B8DCA07562708F13DE79D7EF3`；修复其 derived repair 计数口径的零模型审计：`strength-gap-clean-matrix-audit.json`。

## 8. ISSUE-027 / Stop & Escalate

**ISSUE-027 — Transferable Strength Candidate Claim Upgrade Stability / P1 Gate Blocker / OPEN.**

- 触发冻结 Stop & Escalate #6：transferable strength 在 SG-TC-07 上稳定产生被 SG-B/SG-D 判定为 Candidate 新能力的表达；
- 证据为 3/3 initial + 3/3 repair，同一 implementation commit、同一模型配置；不是单次随机失败；
- 当前实现没有让 invalid output 穿过 Final Schema，accepted invalid output = 0；但稳定 repair 失败仍阻塞 Gate；
- 后续只能在 Product Owner / QA 明确授权后进行 ISSUE-027 narrow stabilization；不得覆盖本轮失败 artifacts，不得降低 SG-B/SG-D，不得进入 Personalized Greeting。

## 9. Preserved History

- 永久保留 1 次 infrastructure failure、7 次逐 commit preflight failure、最终 12/12 preflight 与本次 33/36 failed clean matrix；
- 本文不宣布 Strength + Gap PASS。Gate recommendation：**NO PASS / NARROW STABILIZATION REQUIRED / WAIT FOR PRODUCT OWNER & QA REVIEW**。

## 10. ISSUE-027 Product Owner / QA Review 后的离线根因审计

Product Owner / QA 已于 2026-08-10 授权 ISSUE-027 narrow stabilization，但要求在任何 Prompt / validator 修改前，对旧 clean matrix 的 3 initial + 3 repair raw output 完成零模型逐条审计。

离线审计确认当前仓库无法完成该前置条件：

- 旧 3 个 HTTP 502 run 的 artifact 均为 `data: null`，没有 initial raw JSON、repair raw JSON 或 rejected statement；
- `StrengthGapDiagnostics` 只保存 issue path/message，没有保存 rejected value；原始 output 在请求进程结束后不可恢复；
- SG-TC-07 acceptance fixture 只保存合成 `CF-001` / `PF-001` 引用与 Match reason，没有 Candidate CF/PF 原文；
- 可确认 MI-001 = `core_requirement / partial / responsibility`，reason 为“Candidate 只提供协助需求整理的正向证据，未证明独立负责完整流程”；可确认三次 initial 与 repair 均报 SG-B/SG-D；但无法确认触发片段与语境；
- 因此 Case A / B / C 必须标记 **INDETERMINATE**。既不能把 validator diagnostics 当作模型真实升级的充分证明，也不能假定是 false positive；重新采样不能替代历史输出。

完整零模型审计见 `issue-027-offline-root-cause-audit-blocked.json`。提出 `ISSUE-028 — Rejected Strength Output Evidence Preservation Gap`（P1 Evidence Blocker candidate）：等待人工提供外部留存的六条原始输出，或明确接受历史分类不可恢复并授权 prospective evidence-capture diagnostic protocol。当前仍 **STOP BEFORE PRODUCT CHANGE**，未修改 Schema、Prompt、validator，未调用模型。

## 11. ISSUE-028 Prospective Evidence Capture — Static Gate PASS

Product Owner / QA 已接受历史 A/B/C 分类不可恢复，并正式建立 `ISSUE-028 — Rejected AI Output Evidence Preservation Gap`（P1 / QA Evidence Integrity Blocker），授权先修 Evidence Capture、不得先改产品语义。

- acceptance-only diagnostics 现在可保留 initial / repair 两阶段的 scrubbed raw output、parse error、validation issues、完整 rejected item、statement/type/matchRefs/rule/code/reason；不可解析输出限制为 12,000 字符并显式记录 `artifactTruncated`，rejection-relevant parsed fragment 独立完整保存；
- API 仅在 `STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS=1` 时把完整 evidence 放入响应体；header 只保留无 raw output 的摘要；正常产品响应不变；
- SG-TC-07 frozen semantic fixture 显式补齐 `CF-001 → 协助需求整理`、`PF-001 → 协助需求整理`；MI-001 仍为 `独立负责完整需求流程 / partial / responsibility`，未降低案例难度；
- acceptance runner 可从单一 artifact 追踪 Candidate Fact → Match → rejected Strength → validator rule，并把 HTTP 502 的 repair attempt 纳入 aggregate；
- EC-TC-01～06 全部 PASS；focused 14/14、全量 301/301、lint 0 warning、production build、`git diff --check` 全部 PASS；Prompt / Schema diff 为空；未调用模型；
- 静态证据：`issue-028-evidence-capture-static.json`。旧 33/36 与六条不可恢复历史输出的限制保持原样，新采样不得替代历史失败。

当前 `ISSUE-028 = IMPLEMENTED / STATIC GATE PASS / PROSPECTIVE ARTIFACT PENDING`；`ISSUE-027 = OPEN / P1 PRODUCT GATE BLOCKER`。下一步仅允许在固定本 Stage 1 commit 后执行 `ISSUE-027 Prospective Diagnostic`：同一 SG-TC-07 ×3、`deepseek-v4-flash`、产品行为基线不变。该诊断不是 Acceptance rerun；在完成 A/B/C 根因定性前不得修改 Prompt / validator / Schema。

## 12. ISSUE-027 Prospective Diagnostic / Case B

- 固定 Stage 1 commit `6459795…`，使用未修改的 `e217e09…` Prompt/validator 产品行为、同一 SG-TC-07 frozen semantic fixture 与 `deepseek-v4-flash` 执行 3 次独立 diagnostic；结果 2 HTTP 200 + 1 HTTP 502；
- 第 3 次 request_id `31db76bf-3489-4d2a-b82c-555acff4ab3e` 的 initial 与 repair 均完整捕获，statement 相同：“候选人在需求整理方面的协助经验可迁移至需求流程相关工作，部分支持独立负责完整需求流程的要求。”；
- 两阶段均保留“协助”Candidate scope，并把“独立负责完整需求流程”明确放在“部分支持……要求”的 JD target relation 中，没有声称 Candidate 已独立负责；因此 initial = Case B、repair = Case B，overall = **Case B — Validator False Positive**；
- 根因：strong-claim detector 只识别“对/与/面向/针对 + target”关系，未识别“部分支持 + JD target requirement”，把 requirement 内的“独立负责”误当 Candidate predicate；
- source artifact：`issue-027-prospective-diagnostic-01.json`，SHA-256 `0EB469E7A5A46BC51620D10D5283FC0BD608F1A4BE9590241D696D62B438AB60`；A/B/C audit：`issue-027-prospective-root-cause-audit.json`；secret scan PASS；命中 rejected evidence 后按协议停止，未执行额外 3 次；
- 旧 33/36 的六条 raw output 仍不可恢复且保持 INDETERMINATE；本次 prospective Case B 不替换、不重写历史失败。

## 13. Case B Minimal Fix / SG-M Static Gate

- 仅修 validator target-relation recognition：接受“部分/有限/基础支持 + 明确 JD target suffix”；同时移除过宽的单独“流程/工作”suffix，避免把 Candidate capability 误当 target relation；Prompt、output Contract、runtime model 均不变，SG-B/SG-D Candidate Truthfulness 原则未放宽；
- 新增 `SG-M — Transferable Relation Boundary Integrity`：要求 valid partial positive Candidate evidence、valid bounded Match relation、Candidate scope/numeric boundary 保留，以及 unsupported ownership/proficiency/employment/context upgrade 全为 0；
- 新增实际 Case B statement 正例和 ownership/proficiency/employment/context 四类负例；全量 17 files / 307 tests、lint 0 warning、production build、diff check 全部 PASS；
- 下一步必须固定最小修复 commit，再按顺序执行 SG-TC-07 ×3 targeted validation → 12×1 preflight；只有两者 Hard Gates 全绿才允许新 12×3 matrix。

## 14. Post-fix Validation Chain — PASS

全部验证使用固定 implementation commit `10cb9013c7083b606652e7dab6e0f8975a4b0702` 与 `deepseek-v4-flash`，顺序未跳级：

1. static：17 files / 307 tests、lint 0 warning、production build、diff check PASS；
2. SG-TC-07 ×3 targeted：3/3 HTTP 200，SG-A～SG-M 全 PASS，repair 0，Candidate/ownership/proficiency/employment/context upgrade 全 0；artifact `issue-027-targeted-sg-tc-07.json`，SHA-256 `6D357063DDE54BBEF7FC481EA3A7279F3C2416BFF2C83BF094A06B9CCAADC985`；
3. 12×1 preflight：12/12 HTTP 200，SG-A～SG-M 全 PASS，repair 0，upgrade/fabrication/unknown deficiency/unsupported action 全 0；artifact `issue-027-post-fix-preflight.json`，SHA-256 `96A6BD89E82D168258104E1C543C92C80D530FEA799E9C6F77E8E432A4C99175`；
4. 新 12×3 clean matrix：36/36 HTTP 200，SG-A～SG-M 全 PASS；strengths 21（direct 9 / transferable 9 / supporting 3），gaps 30（hard 6 / evidence 9 / learnable 3 / information 12）；Candidate/ownership/proficiency/employment/context upgrade、fabrication、unknown deficiency、unsupported action 均 0；repair 0/36；latency min 778ms / max 2,159ms / avg 1,284ms；artifact `issue-027-post-fix-clean-matrix.json`，SHA-256 `DD075C3ACA07410D799C808B69224B94DE051AE178715D902DAD9E41E91AB2AA`。

post-fix 合计 targeted + preflight + matrix = 51 requests，repair 0/51；未采用 No-Strength omission，SG-TC-07 的安全 Strength 与 Gap 均保留。旧 `strength-gap-clean-matrix.json` 33/36 及失败 request IDs 永久保留，未覆盖、未重命名为成功矩阵。

## 15. Internal Content Review / Gate Recommendation

- 36/36 outputs 完成六维 internal review：Candidate Fact Accuracy 5.0、Match Logic 4.8、Strength Truthfulness 5.0、Gap Accuracy 4.7、Information Restraint 4.8、Expression Quality 4.3；综合 4.77，最低 request/dimension 3.8，P0=0，systemic P1=0；
- SG-TC-06 的 evidence/learnable 双 Gap 存在轻微冗余，SG-TC-10 “资料缺少”表达较泛，但均不构成事实、边界或 Hard Gate 失败；详见 `issue-027-post-fix-internal-review.json`；
- ISSUE-028 已在真实 502 上证明 initial/repair evidence、rejected fragment、MI/CF/PF trace、failure repair aggregate 与 secret scrub 可用，Exit Criteria 满足；建议 Product Owner / QA 关闭 ISSUE-028；
- ISSUE-027 Case B 最小修复已完成全部工程验证，建议 Product Owner / QA 关闭 ISSUE-027 并判定 Phase 2.2B-2 Strength + Gap Core PASS；本文件不自行做该 Gate 决定；
- 当前动作：**STOP FOR PRODUCT OWNER / QA FINAL GATE REVIEW**。Phase 2.3 继续 NOT AUTHORIZED。
