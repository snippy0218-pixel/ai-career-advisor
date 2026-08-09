# Phase 2.2A Acceptance — Match Core Foundation

> 日期：2026-08-09
> 状态：**PASS / CLOSED（Product Owner / QA Final Gate，2026-08-09）**
> 说明：Phase 2.2B-1 Recommendation Core 已单独授权；Strength/Gap 与 Phase 2.3 仍未授权。

## 0. Final Gate Decision（2026-08-09）

- Product Owner / QA 接受 30/30 Match Core clean matrix、M-A～M-I 与 M-J Requirement Set Integrity 证据；
- requirement coverage 33/33，missing / duplicate / fabricated / type mutation / content mutation / candidate mutation / cross-source contamination 均为 0；
- Phase 1 / Phase 2.1 regression PASS；
- Phase 2.2A 正式 PASS / CLOSED，随后仅授权 Phase 2.2B-1 Recommendation Core。

## 1. Baseline 与 Scope

- Phase 2.1 implementation baseline：`cfdd13c46b9fa9cb297597481dee0ddc337a664a`；
- Phase 2.1 evidence/docs baseline：`bf8f91487572ae30c707c1f7e10010cc1a112f99`；
- Phase 2.2A 最终代码 commit：`e7d71c1518d34a1f92aaf391a627d3eb4b63d011`；
- Runtime model：`deepseek-v4-flash`（未更换；benchmark 仍为 DEFERRED / NOT REQUIRED）；
- 本轮只实现 Validated Phase 1 JD requirements ＋ Validated Candidate Profile v2 → requirement/dimension-level Match Result；
- 未实现 Recommendation、Strength、Gap、Personalized Greeting、score、confidence、多岗位、数据库、账号、PDF/OCR。

## 2. Architecture

新增独立 Match 分支，不修改 Phase 1 protected pipeline，也不修改 Candidate Profile 生成基础设施：

```text
validated analysis-v1
  → deterministic REQ-* ledger
validated candidate-profile-v2
  → immutable CF-* / PF-* ledgers
REQ + CF/PF read-only ledgers
  → DeepSeek raw dimension judgments
  → strict raw schema
  → evidence/reference/status/aggregate guards
  → at most one bounded Match Repair
  → strict match-core-v1 Final
```

路由：`POST /api/match/analyze`。输入必须同时通过 `jobAnalysisSchema` 与 `finalProfileStructureSchema`；模型不接收 raw JD 重新提取要求，也不能生成/改写 Candidate Profile。

## 3. Match Schema

Final `match-core-v1`：

- `schemaVersion` / `jdSchemaVersion` / `candidateProfileSchemaVersion`；
- `matchItems[]`：`requirementId`、服务端解析的 `requirement`、`requirementType`、validated `jdEvidence`、聚合 `status`；
- `requirementDimensions[]`：`dimensionId`、`dimensionType`、`requirementFragment`、`status`、`reason`、`jdEvidence`、`candidateFactRefs`、`candidateEvidenceRole`、服务端解析的 `pfEvidence`、`missingInformation`、`verificationQuestion`；
- Final Schema strict；Recommendation/Strength/Gap/Greeting/score/confidence 等额外字段会被拒绝。

## 4. Dimension Model 与聚合

冻结 dimension types：`qualification`、`skill`、`proficiency`、`domain`、`role`、`employment_type`、`duration`、`responsibility`、`credential`、`location`、`career_direction`、`other`。

服务端额外强制：

- 明确 `X 年以上/及以上` 必须包含 `duration` 与至少一个非 duration dimension；
- 明确 `全职/正式工作` 必须包含 `employment_type`；
- conservative same-domain explicit positive evidence 不得被 `unknown` 静默忽略；该 guard 只触发 repair，不直接生成 status；
- 顶层 status 由 dimension statuses 确定性复核：任一 `unmet` → `unmet`；全部 `met` → `met`；有正证 dimension 且其余为 met/partial/unknown → `partial`；无正证且全 unknown → `unknown`。

## 5. Evidence 与 Status Contract

- JD：dimension evidence 必须逐项属于对应 validated Phase 1 requirement evidence；
- Candidate：模型只允许引用 CF id；服务端验证 CF 存在，并由 canonical fact 确定性解析 PF ids；
- `met/partial`：至少一个 positive CF；`partial` 同时必须给出 missing information 与 verification question；
- `unmet`：至少一个 explicit counter CF；无反证不得 unmet；
- `unknown`：CF/PF evidence 必须为空，并提供 missing information 与 verification question；
- 多标签 CF 可复用，但 canonical statement 的课程/项目/程度/归属限定优先；
- instruction-like fact 不得成为 Candidate evidence；Candidate Profile 输入在调用前后做 JSON snapshot immutability 检查。

## 6. Match Repair

- 最多一次、独立于 Phase 1/Profile repair；
- 只修 schema、requirement coverage、JD evidence、CF/PF reference、status evidence role、missing information、aggregate、composite dimension 与 contamination；
- repair prompt 重新提供只读 REQ/CF/PF ledger；禁止生成 Candidate Fact、改写 Candidate Profile 或加入结果层产品字段；
- repair 后仍不合格 → `AI_OUTPUT_INVALID` fail-closed；
- Final preflight 与 clean matrix 均未触发 repair（真实 `matchRepairRate = 0%`）；repair 成功/失败路径由自动化测试覆盖。

## 7. Static Tests

- 最终回归：11 test files，**229/229 PASS**；
- 新增 schema、aggregate、JD/CF/PF evidence、unmet/unknown、immutability、contamination、bounded repair 与 route fail-closed 测试；
- MC-TC-01～10 十个冻结专项边界均有静态覆盖；
- M-J 新增 MJ-TC-01～06：4-requirement full coverage、missing、duplicate、fabricated ref、type mutation、compound requirement top-level uniqueness；另有 service test 证明 missing coverage 触发一次 repair，repair 后重新执行完整 deterministic validation；
- lint PASS；Next.js production build PASS；`/api/analyze`、`/api/profile/analyze`、`/api/match/analyze` 均成功构建。

## 8. Preflight（10 × 1）

Artifact：`docs/acceptance-artifacts/phase-2-2a/match-core-preflight.json`。

- implementation commit：`e7d71c1…`；
- 10/10 HTTP 200；10/10 Final Schema；10/10 JD Evidence；10/10 Candidate Evidence；10/10 expected status；
- 16 dimensions；top statuses：met 3、partial 3、unmet 2、unknown 3（MC-TC-08 有两个 requirements）；
- dimension statuses：met 4、partial 2、unmet 4、unknown 6；
- repair 0/10；upstream attempts 10；completion tokens 1,611；
- latency：min 1,344ms / max 3,126ms / average 1,951ms；
- M-A～M-I 全部 true。

## 9. 历史失败证据

永久保留，不替换、不隐藏：

- `match-core-preflight-failed-3211eb0.json`：MC-TC-05 未拆年限；MC-TC-08 将无额外限定的 scoped course evidence 降为 partial；
- `match-core-preflight-failed-5a77451.json`：MC-TC-05 已拆 dimension，但把“产品相关经验”错误收窄为正式工作经验，遗漏明确 domain 正证；
- `match-core-preflight-infrastructure-failure*.json`：三轮均为 sandbox/background execution context 导致的 10/10 `AI_SERVICE_UNAVAILABLE`；不含有效模型结果，不计入产品 Gate。PowerShell 与 Node 的最小 DeepSeek 请求均另行确认 HTTP 200，最终在同一获准 execution context 完成有效矩阵。

上述失败分别促成 composite-dimension guard 与 conservative same-domain omission guard；未降低 Contract。

## 10. Clean Matrix（10 × 3 = 30）

Artifact：`docs/acceptance-artifacts/phase-2-2a/match-core-clean-matrix.json`。

- 与 preflight 使用相同最终代码 commit `e7d71c1…`；
- 30/30 HTTP 200；30/30 Final Schema；30/30 JD Evidence；30/30 Candidate Evidence；30/30 expected status；
- 33 top-level match items：met 9、partial 9、unmet 6、unknown 9；
- 48 dimensions：met 12、partial 6、unmet 12、unknown 18；
- repair 0/30；upstream attempts 30；completion tokens 4,879；
- latency：min 1,347ms / max 2,855ms / average 1,928ms；
- 每个 MC-TC 三次状态稳定：TC01 met；TC02 unmet；TC03 unknown；TC04 partial；TC05 partial；TC06 partial（允许 partial/unknown，且从未 unmet）；TC07 unmet；TC08 met＋met；TC09 unknown；TC10 unknown；
- 0 cross-source contamination；0 Candidate Profile mutation；0 unmet without counter-evidence；0 absence→unmet。

## 11. M-A～M-J

| Gate | Preflight | 30-request Matrix |
|---|---:|---:|
| M-A JD Evidence Integrity | PASS | PASS（30/30） |
| M-B Candidate Evidence Integrity | PASS | PASS（30/30） |
| M-C Cross-source Isolation | PASS | PASS（0 contamination） |
| M-D Status Integrity | PASS | PASS（30/30 expected） |
| M-E Unmet Counter-Evidence | PASS | PASS（all unmet explicit counter CF） |
| M-F Unknown Integrity | PASS | PASS（0 absence→unmet） |
| M-G Aggregate Integrity | PASS | PASS（30/30） |
| M-H Final Schema | PASS | PASS（30/30） |
| M-I Candidate Profile Immutability | PASS | PASS（30/30） |
| M-J Requirement Set Integrity | PASS（离线补审） | PASS（30/30；33/33 requirements） |

### 11.1 M-J — Requirement Set Integrity

**Expected match-eligible set 定义：**当前 Phase 1 validated `analysis-v1.roleProfile.requirements[]` 中的每一项均进入 Match Core；不新增 taxonomy、不重新提取、不做 Match 侧过滤。因此 validated schema 中实际存在的 `hard_requirement`、`core_requirement`、`preferred_requirement`、`unclear` 均为 eligible，具体集合完全由该次 validated array 决定。

**Requirement identity：**Phase 1 当前没有持久 requirement id；Match 服务端按 validated array 稳定顺序确定性生成 `REQ-001…`。Raw model output 只允许引用 `requirementId`，不允许生成 requirement 文本或类型；Final 的 `requirement`、`requirementType`、`jdEvidence` 均从 validated ledger 回填。

**现有 deterministic enforcement 审计：**

- Coverage：Raw IDs 的 set/length 必须与 expected REQ set 完全相等；
- Uniqueness：duplicate ID 会被 `new Set(ids).size` 拒绝；
- No Fabrication：不存在于 ledger 的 REQ ref 会产生 `unknown requirement reference`；
- Type Fidelity：Raw Schema 不接受 `requirementType`；Final type 只取 Phase 1 ledger 原值；
- Repair：缺失/重复/虚构/type extra 均进入一次 bounded Match Repair；repair response 重新通过 `rawMatchCoreSchema → finalizeRawMatchCore → finalMatchCoreSchema`；仍失败则 `AI_OUTPUT_INVALID` fail-closed；
- Dimension decomposition 不改变顶层 identity：一个 REQ 可有多个 dimensions，但 Final 仍只有一个顶层 match item。

**既有 30-request artifact 离线审计：**读取原始 `match-core-clean-matrix.json`，未调用模型、未修改历史结果；证据保存于 `requirement-set-audit.json`。

- requests：30/30 M-J PASS；
- expected requirements：33；Final matchItems：33；coverage `100%`；
- missing：0；duplicate：0；fabricated：0；
- type mutation：0；content identity mutation：0；
- source implementation commit 仍为 `e7d71c1…`。

本轮没有修改 Match runtime behavior、Prompt 或 frozen MC inputs，因此按 Gate 指令不执行新的 10×1 或 30-request real-model matrix。

## 12. Regression

- 最终 `npm test`：11 files / 229 tests PASS；
- `npm run lint`：PASS；
- `npm run build`：PASS；
- Phase 1 protected files未修改；Phase 1 自动化回归 PASS；
- Candidate Profile 基础设施未修改；Phase 2.1 PF-A～PF-I 自动化回归 PASS；因此按授权未重跑 Phase 2.1 24-request real matrix。

## 13. Issues / Observations / Stop

- 新增产品 Issue：无；
- `OBS-002`：本轮未修改 canonical statement/semantic tag/projection；专项矩阵未观察到 downstream contamination 或 profile mutation；继续 Observe；
- 工程观察：真实 Final 矩阵 repair rate 0%，说明 repair 真实频率尚无非零样本；静态测试已覆盖 repair 成功与 fail-closed，不构成 Gate blocker；
- 未触发 Stop & Escalate 条件：最终 commit 未出现 Candidate Profile 修改、unknown/unmet 失真、无 evidence met、无 counter evidence unmet、dual evidence failure、contamination、aggregate 误导、Contract 降级、Phase 1/2.1 regression 或 model incapability。

## 14. Gate Recommendation

工程建议：Product Owner / QA 基于原 M-A～M-I 证据与本轮 M-J 30/30 离线补审，对 Phase 2.2A 作出最终 Gate 决定。本文在此停止；**不自行宣布 PASS，不进入 Phase 2.2B Recommendation/Strength/Gap，不进入 Phase 2.3**。
