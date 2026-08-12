# Phase 2.4 post-033/034 Full-chain RB-05 Evidence

> 日期：2026-08-12
> Authorization baseline：`main / cc9fa37608b532a9fe48927bf4480ff1da3b6a75`
> Run policy：`NEW DETERMINISTIC BASELINE VERIFICATION / E2E-RB-05 × 1`
> Result：`0/1 / stoppedAt=match / Phase 2.4 remains BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## 1. Authorization, Baseline, and Execution Count

- execution 前 branch=`main`、HEAD=`cc9fa37608b532a9fe48927bf4480ff1da3b6a75`、Git status clean；
- target artifact 在运行前不存在；23 个历史 Phase 2.4 artifacts 保持原位；
- process API key 仅确认存在，未读取或记录值；`DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL` 无环境 override，继续使用冻结默认配置；
- model-backed RB-05 executions=`exactly 1`；additional model-backed reruns=`0`；
- 运行后 production server 已停止；未执行其他业务请求或模型抽样。

## 2. Acceptance Preflight

runner 在第一笔业务调用前对五路真实 route 执行 capability probe。`enabled=true` 的实现条件同时要求 HTTP 200、`x-phase-2-acceptance-capability=enabled` 和 body `rejectedOutputCapture=true`。

| Route | HTTP | enabled |
| --- | ---: | --- |
| Profile | 200 | true |
| Match | 200 | true |
| Recommendation | 200 | true |
| Strength/Gap | 200 | true |
| Greeting | 200 | true |

`modelCallsBeforeBusinessExecution=0`；preflight=`passed / available=true`。

## 3. Frozen Input Verification

| Input | Length | SHA-256 | Historical match |
| --- | ---: | --- | --- |
| JD | 138 | `bf1eea5f393bb5a9ce7dd5de9ab76a0dc95f90bb4742b656e2916281584f4a60` | true |
| Profile | 80 | `0b19712da6ae0a07c4543fe8d3427a1650c4e711b7c1ed4d33a38e14e2925745` | true |

## 4. Stage Matrix

| Stage | callState | resultState | HTTP | Latency | Attempts | Repair | Fallback | Request ID |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| JD | called | completed | 200 | 10,464 ms | unknown | unknown | unknown | `ecc4338c-83cb-4633-8276-cced4a846d91` |
| Profile | called | completed | 200 | 2,799 ms | 1 | not_needed | not_used | `492a49b2-92ef-4f80-9cfc-a4544522ca89` |
| Match | called | failed | 502 | 12,634 ms | 2 | failed / 1 repair | not_used | `d74b6c4c-a6ed-4704-9397-4a71c61837c4` |
| Recommendation | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Strength/Gap | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Greeting | not_called | not_run | null | null | not_run | not_run | not_run | null |

Executed-stage latency total=`25,897 ms`。完整链未完成，因此 full-chain success latency=`N/A`。

## 5. Candidate and JD Evidence

Profile 直接 accepted，repair=`not_needed`。PF ledger=4、canonical facts=4、unprocessed PF=0、invalid evidence=0、semantic upgrade=0、untraceable facts=0、layering violations=0、unused PF=0。

| CF | Canonical statement | PF | Raw Profile evidence |
| --- | --- | --- | --- |
| CF-001 | 教育背景：信息管理本科 | PF-001 | 教育背景：信息管理本科 |
| CF-002 | 课程项目：在课程中了解 Python 基础语法 | PF-002 | 课程项目：在课程中了解 Python 基础语法 |
| CF-003 | 与四人团队共同完成数据展示作业，我协助整理需求和测试 | PF-003 | 团队经历：与四人团队共同完成数据展示作业，我协助整理需求和测试 |
| CF-004 | 没有正式数据产品工作经历 | PF-004 | 没有正式数据产品工作经历 |

Match raw 引用的 JD evidence 均逐字存在于 frozen JD：`熟练掌握 Python`、`具有独立负责数据产品的正式工作经验`、`能主导跨团队项目并对个人交付结果负责`、`本科及以上学历`。

## 6. Match Initial Rejection

Initial raw length=`3,820`，completion received、raw available、parse/schema passed、finishReason=`stop`、artifactTruncated=false、failure=`semantic_validation`。unsupported negative initial count=`0`；其失败是两条 cross-CF Candidate lineage / course-scope contamination：

1. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.1.reason`：`且课程项目仅涉及数据展示作业`；
2. `M-K` / same path：`experience_type:课程->CF-004`；
3. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.2.reason`：`且课程项目中仅协助整理需求和测试`；
4. `M-K` / same path：`experience_type:课程->CF-004`。

Initial 的其他关键语义：

- Python=`partial`：`仅在课程中了解 Python 基础语法，未表明达到熟练程度`，合法 uncertainty boundary；
- formal employment=`unmet`：CF-004 counter 支持 `与正式工作经验要求直接冲突`；
- leadership / responsibility=`partial`：CF-003 positive + `未表明` boundary；
- education=`met`：CF-001 positive。

污染被 deterministic guards 拒绝，没有进入 Final accepted Match。

## 7. Match Repair Rejection

Repair raw length=`3,802`，completion received、raw available、parse/schema passed、finishReason=`stop`、artifactTruncated=false、failure=`semantic_validation`。repair 已清除 course-scope contamination，但仍生成：

`候选人明确表示没有正式数据产品工作经历，与独立负责要求直接冲突。`

该 claim 把 CF-004 的 formal-employment negative 传播成 responsibility/ownership negative conclusion；CF-004 不独立证明候选人的独立负责能力与要求“直接冲突”。validator 正确拒绝：

1. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.2.reason`：`与独立负责要求直接冲突`；
2. `M-K` / same path：`ownership:独立->CF-004`。

因此 ISSUE-033 repair 没有稳定转成 unknown/partial uncertainty boundary，one repair 后合法 terminal fail-closed。

## 8. ISSUE-034 Runtime Boundary

正向 narrow relation 在 initial 与 repair 均未被 validator 拒绝：

- dimension=`employment_type`；status=`unmet`；
- Candidate evidence=`CF-004 / counter`；
- CF/PF/Raw Profile=`没有正式数据产品工作经历`；
- JD evidence=`具有独立负责数据产品的正式工作经验`；
- reason=`候选人明确表示没有正式数据产品工作经历，与正式工作经验要求直接冲突。`

但 repair 同时输出 domain dimension：

`候选人明确表示没有正式数据产品工作经历，与数据产品领域要求直接冲突。`

该非-`employment_type` relational conclusion 未产生 validation issue；随后 responsibility 同族传播才被拒绝。由于冻结 Gate 要求 narrow conclusion 仅在同一 `employment_type` dimension 成立、不得形成 general sibling-dimension bypass，且本次没有 Final accepted Match，ISSUE-034 不能判定 runtime verified。

## 9. Issue Verdicts

- ISSUE-033：`FIX NOT VERIFIED`。initial 的 unsupported negative count=0；initial contamination 正确拒绝；repair 把 formal-work negative 升级为 responsibility conflict，正确 terminal fail-closed，但 repair robustness 目标未达成；
- ISSUE-034：`FIX NOT VERIFIED`。employment_type positive path 被识别，但 domain sibling relation 未被拒绝，且不存在 Final accepted Match；
- ISSUE-029：preservation PASS / no accepted regression。initial course→CF-004 contamination 正确拒绝；repair course contamination=0；repair ownership propagation 继续被 M-K 拒绝；Final accepted contamination=`N/A`，released contamination=0；
- ISSUE-031：`VERIFICATION INCONCLUSIVE`；Recommendation not_called；
- ISSUE-028：`INCONCLUSIVE`；五路 capability PASS，但 Recommendation runtime / structured rejection path not_run；
- ISSUE-030：`VERIFICATION INCONCLUSIVE`；Strength/Gap not_called；
- ISSUE-032：preservation PASS。未调用 stage 显式 not_called/not_run；repair/fallback not_run 不计 0；invariants=`not_run/passed=null`；downstreamCallsAfterFailure=0；safeFailure=false；aggregation 保留 known/not_run 区别。

## 10. Greeting / OBS-006

Greeting not_called/not_run。repair、personalized fallback、Phase 1 fallback 均为 not_run；本次没有新的 OBS-006 runtime metric，不修改 OBS-006 disposition。

## 11. Global Hard Gates

- accepted JD/Profile evidence continuity PASS；CF→PF→Raw Profile 4/4 完整；
- Match initial/repair 中的非法 cross-CF scope 与 responsibility/ownership propagation 均未成为 accepted output；
- Final Match、Recommendation、Strength/Gap、Greeting 不存在，因此完整链 Candidate/JD/semantic invariants=`not_run`，不得宣称 PASS；
- unsupported waiver、Candidate semantic upgrade、JD→Candidate contamination、frequency/intensity/scope/duration/quantity/certainty/ownership/proficiency/responsibility upgrade 的 **released accepted count=0**；这不等于未执行阶段 PASS；
- terminal failure 分类：`model repair retained unsupported Candidate responsibility/ownership relation; deterministic Match guards rejected it`。不是 provider、transport、timeout、parse、schema 或 evidence-loss failure。

## 12. Rejected-output Evidence

rejected outputs=`2`：Match initial + Match repair。两者均保存 raw、raw length、finish reason、failure stage/category、stable validation layer/code/rule、path/message、rejected item/dimension 与 repair lifecycle；rawAvailable=true，artifactTruncated=false。Profile initial accepted，不制造人工 rejection；其 repair not_run。

## 13. Repair / Fallback and Failure Semantics

- Profile repair=0 / not_needed；
- Match repair=1 / failed；
- Recommendation、Strength/Gap、Greeting repair=not_run；
- all executed-stage fallbacks=not_used；Greeting fallback variants=not_run；
- Match 502 后下游调用=0，符合 Failure Stop Rule；
- `safeFailure=false`：RB-05 expected success，但在 deterministic semantic validation 后终止；不能把 fail-closed 等同案例 PASS。

## 14. Artifact and Scope

- Artifact：`docs/acceptance-artifacts/phase-2-4/phase-2-4-post-033-034-rb-05.json`；
- SHA-256：`f4b874ef7f9d9a72ba211cc3c65eee2b434f510497a866b4870ce65448ef0f8c`；
- size=`80,577 bytes`；历史 artifacts 23 → 24，未覆盖旧 artifact；
- no code/fixture/Prompt/Contract/Schema/validator/runner/diagnostics/model/provider/temperature/retry/timeout/fallback/Gate changes；
- exactly one model-backed run；additional reruns=0；no Phase 2.5。

## 15. Gate Recommendation

建议：`Phase 2.4 仍 BLOCKED`。不得自行关闭 ISSUE-028～034、Phase 2.4，不得授权 Phase 2.5 或宣布 Phase 2 Ready for Release。等待 Product Owner / QA Gate Review。

## 16. Subsequent Product Owner / QA Disposition

Product Owner / QA 接受本次归因，将 ISSUE-033/034 均更新为 `LOCAL FIX NOT VERIFIED / BOUNDED RESTABILIZATION REQUIRED`，不新建 ISSUE-035。正式 invariant 为 explicit negative evidence 与 relational conclusion 均必须 dimension-local。

后续 deterministic restabilization 的静态 allow-path trace、v1.3 fix、G33/L34 matrix 与 exact raw replay 见 `PHASE-2-4-ISSUE-033-034-RESTABILIZATION.md`。本节不改变或覆盖本次 0/1 runtime artifact；没有追加 RB-05。
