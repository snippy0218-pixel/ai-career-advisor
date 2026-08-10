# Phase 2.2B-2 Acceptance — Strength + Gap Core

> 日期：2026-08-10
> 状态：**STOP & ESCALATE / ISSUE-027 P1 GATE BLOCKER**
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
