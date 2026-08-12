# Phase 2.4 post-035/036 Replacement RB-05 Evidence

> 日期：2026-08-12
> Authorization HEAD：`main / b2c0c726347bf575f80422e9773a28c7a501e8b1`
> Product/runner implementation：`f66858987f89b3c209eda511e51709c1b7ad9f11`
> Run policy：`replacement E2E-RB-05 × exactly 1`
> Result：`0/1 / stoppedAt=match`
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## A. Authorization / Baseline

- pre-run branch=`main`；HEAD=`b2c0c726347bf575f80422e9773a28c7a501e8b1`；status=`clean`；
- previous preflight-only invocation had business/model-backed execution 0，故 Product Owner / QA 授权一个 replacement business sample；
- 本次 formal replacement execution=`1`；business execution 开始后 additional reruns=`0`；
- target artifact 在运行前不存在；没有修改 code、runner、fixture、Prompt、Contract、Schema、validator、diagnostics defaults、model/provider、temperature、retry、timeout、fallback 或 Gate。

## B. Acceptance Environment Configuration

在 server startup command 的进程环境中显式设置以下五项为 frozen enabled value `1`：

- `PROFILE_ACCEPTANCE_DIAGNOSTICS=1`；
- `MATCH_ACCEPTANCE_DIAGNOSTICS=1`；
- `RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS=1`；
- `STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS=1`；
- `GREETING_ACCEPTANCE_DIAGNOSTICS=1`。

这些值只作用于本次 server 进程，没有写入仓库、`.env` 或 production default。Server 已在运行后停止。

## C. Five-route Capability Preflight

| Route | HTTP | enabled | rejectedOutputCapture |
| --- | ---: | --- | --- |
| Profile | 200 | true | true |
| Match | 200 | true | true |
| Recommendation | 200 | true | true |
| Strength/Gap | 200 | true | true |
| Greeting | 200 | true | true |

Preflight=`passed / available=true`，证明实际 routes 采用了显式 acceptance environment；runner 未绕过 probe。

## D. Calls Before Business Execution

`preflight.modelCalls=0`，即 `modelCallsBeforeBusinessExecution=0`。本次 model-backed RB-05 business execution count=`1`；artifact 不提供 JD 的精确 upstream attempts，因此不伪造全链 provider-call total。

## E. Frozen Input Hashes

| Input | Length | SHA-256 | historicalMatch |
| --- | ---: | --- | --- |
| JD | 138 | `bf1eea5f393bb5a9ce7dd5de9ab76a0dc95f90bb4742b656e2916281584f4a60` | true |
| Profile | 80 | `0b19712da6ae0a07c4543fe8d3427a1650c4e711b7c1ed4d33a38e14e2925745` | true |

## F. Full Stage Matrix

| Stage | callState | resultState | HTTP | Latency | Attempts | Repair | Fallback | Request ID |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| JD | called | completed | 200 | 9,482 ms | unknown | unknown | unknown | `147f6134-e47a-4b0c-9d16-0a994a410091` |
| Profile | called | completed | 200 | 2,528 ms | known 1 | not_needed / 0 | not_used | `c0789126-c644-4080-9aa2-4e14b0d54bef` |
| Match | called | failed | 502 | 11,946 ms | known 2 | failed / 1 | not_used | `db63b4d3-a000-4807-baf5-5d08fcb24fa3` |
| Recommendation | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Strength/Gap | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Greeting | not_called | not_run | null | null | not_run | not_run | not_run | null |

Terminal classification=`deterministic semantic validation / AI_OUTPUT_INVALID`；`downstreamCallsAfterFailure=0`；`safeFailure=false`；invariant audit=`not_run / passed=null`。

## G. ISSUE-035 Runtime Audit

Match 实际执行，repair 的 REQ-002 结果为：

| Dimension | Status | Candidate Evidence | Result |
| --- | --- | --- | --- |
| employment_type | unmet | `CF-004:counter` | 合法 counter relation 保留；未被拒绝 |
| domain | unknown | `[]` | 未触发历史 `unknown omitted explicit same-domain positive evidence: CF-004` |
| responsibility | unknown | `[]` | absence 未变 unmet |

- CF-004 没有被计作 domain positive；
- domain unknown 通过 ISSUE-035 positive-existence guard；
- employment counter 继续工作；
- genuine positive omission guard 的 accepted deterministic regression 仍在本 baseline 全绿；本次 fixture 没有 genuine positive same-domain CF，不能单独提供该 negative-control sample；
- terminal failure 是之后的 M-CANDIDATE-LINEAGE clause classification，不是 polarity/status validator。

工程 verdict：**FIX VERIFIED**。

## H. ISSUE-036 Runtime Audit

- initial/repair 没有 `experience_type:工作->CF-003`；
- current wording 为“团队作业中协助整理需求和测试……仅部分涉及/仅部分相关”，没有生成历史 exact `仅参与部分工作`，因此没有真实触发裸 `工作` classifier；
- genuine explicit employment phrase `正式数据产品工作经历` 仍被 CF-004 counter 合法用于 employment_type；
- M36 deterministic matrix 继续有效，但本次 stochastic output 没有包含需要由 ISSUE-036 新 classifier 裁决的 generic `工作` token。

工程 verdict：**VERIFICATION INCONCLUSIVE**。

## I. ISSUE-033 Preservation

Initial 错误地把 CF-004 employment negative 用于：

- domain=`unmet`：“没有正式数据产品工作经历……不属于数据产品领域”；
- responsibility=`unmet`：“没有正式数据产品工作经历，因此无法满足独立负责”。

两条均被 M-CANDIDATE-LINEAGE 正确拒绝。Repair 改成 domain/responsibility=`unknown`，空 Candidate refs，并明确“现有资料未表明……不构成同维度明确反证”；cross-dimension negative conclusion=`0`。

但 repair 的合法 evidence-boundary explanation 被后续 lineage clause classifier false-positive 拒绝，故无 Final Match。ISSUE-033 dimension-local repair semantics 保持，不能用 terminal failure推翻其既有 `FIX VERIFIED AT REPAIR RUNTIME` 状态。

## J. ISSUE-034 Preservation

- employment_type 的合法 relation “与正式工作经验要求直接冲突”由 CF-004 counter + exact JD evidence 支持，initial/repair 均未被拒绝；
- initial domain/responsibility sibling relations 被拒绝；
- repair sibling relational negative=`0`；
- CF-004→具体 CF-003 project-property projection=`0`。

ISSUE-034 preservation=`PASS / no regression observed`。

## K. ISSUE-029 Preservation

- initial 将“课程项目为数据展示作业”与 CF-004 绑定，触发 M-CANDIDATE-LINEAGE 与 `M-K experience_type:课程->CF-004`；guard 正确 fail-closed；
- repair course→CF-004 contamination=`0`；course→CF-003=`0`；
- ownership/project negative/multi-CF property inheritance 未进入 Final accepted output；
- Final Match 不存在，released contamination=`0`。

ISSUE-029 safety preservation=`PASS`；closure evidence仍未取得。

## L. Final Match Audit

Final Match 不存在，不能执行 accepted-output MI audit。Rejected repair 有 4 requirements / 7 dimensions；所有 JD evidence 均逐字存在于 Raw JD，所有非空 candidate refs 均能 resolve 到 CF，Candidate Profile 的 4 CF→4 PF→Raw Profile lineage 完整。

Repair semantic shape：

- Python skill=`partial / CF-002:positive`；
- employment_type=`unmet / CF-004:counter`；
- domain=`unknown / refs=[]`；
- responsibility=`unknown / refs=[]`；
- team leadership/individual responsibility=`partial / CF-003:positive`；
- education=`met / CF-001:positive`。

### Terminal forensic classification

Repair domain reason：

> 现有资料未表明候选人具有数据产品领域的经验；CF-004 仅否定正式工作经历，不构成对数据产品领域经验的明确反证。

Repair responsibility reason：

> 现有资料未表明候选人具有独立负责数据产品的经验；CF-004 仅否定正式工作经历，不构成对独立负责能力的明确反证。

`candidateAssertionClauses` 先按分号拆分。第一 clause 命中 `未表明` boundary，被正确排除；第二个 meta-evidence clause 不命中 frozen `EVIDENCE_BOUNDARY_PATTERN`，却因含 `正式工作` / `独立负责` 命中 Candidate assertion pattern。Domain/responsibility 按 Contract 必须保持 refs=`[]`，于是产生三条：

- `M-CANDIDATE-LINEAGE ... CF-004 仅否定正式工作经历`（domain）；
- 同文（responsibility）；
- `M-CANDIDATE-LINEAGE ... 不构成对独立负责能力的明确反证`。

这是与 ISSUE-035/036 不同的 deterministic lineage false-positive terminal observation。按 Stop & Escalate，本轮不修改、不编号、不 rerun，等待 Product Owner / QA adjudication。

## M. ISSUE-031 Audit

Recommendation=`not_called/not_run`，无 multi-MI attribution runtime evidence。

Verdict：**VERIFICATION INCONCLUSIVE**。

## N. ISSUE-028 Audit

五路 acceptance preflight runtime PASS；Match initial/repair rejected evidence 完整保存。但 Recommendation 未调用，无法验证 Recommendation R-C structured rejection lifecycle，也没有人为制造 rejection。

Verdict：**INCONCLUSIVE**。

## O. ISSUE-030 Audit

Strength/Gap=`not_called/not_run`，SG-E 未执行。

Verdict：**VERIFICATION INCONCLUSIVE**。

## P. ISSUE-032 Preservation

- 正常 business-failure path 输出完整六阶段 ledger；
- downstream 三阶段为 `not_called/not_run`，不是 absent/pass；
- attempts/repair/fallback=`not_run/null`；
- known/unknown/notRun aggregates 正确分开；
- `downstreamCallsAfterFailure=0`；
- invariant=`not_run/passed=null`；
- `safeFailure=false`。

ISSUE-032 runtime preservation=`PASS`。

## Q. Greeting / OBS-006

Greeting=`not_called/not_run`；repair/fallback reason 不存在。本次不产生 OBS-006 sample，不修改 OBS-006。

## R. JD / HR Fallback Observation

JD HTTP 200 / 9,482 ms。Runner 没有 JD acceptance diagnostics header/body，因此 attempts、HR repair 与 HR safe fallback 为 `unknown`；不得由 latency 或结果反推。

## S. Global Hard Gate Audit

- Candidate Profile：4 CF / 4 PF，CF→PF→Raw Profile valid；semantic upgrade=0；untraceable=0；
- rejected Match 的 JD evidence 全部 verbatim；非空 Candidate refs 全部 resolve；
- initial unsupported cross-dimension negative/course contamination 被正确拒绝；
- repair semantic output 保持 unknown≠unmet、absence≠negative、polarity/dimension locality；但因 false-positive validator terminal，未成为 Final output；
- no unsupported Match/downstream output released；
- Recommendation/StrengthGap/Greeting 与 full-chain invariants 未执行，整体 Hard Gate 不得标记 PASS。

## T. Rejected-output Evidence

Match 保存 2 个 output evidence records：

| Attempt | rawAvailable | Raw length | Finish | Parsed | Layer/category | Issues | Truncated |
| --- | --- | ---: | --- | --- | --- | ---: | --- |
| initial | true | 3,848 | stop | true | semantic_validation | 5 | false |
| repair | true | 3,440 | stop | true | semantic_validation | 3 | false |

Initial codes：M-CANDIDATE-LINEAGE ×4、M-K ×1；repair：M-CANDIDATE-LINEAGE ×3。每条均保存 validation layer/code/rule/path/message/rejected dimension；initial/repair raw、parsed output、finish reason 与 lifecycle 均完整。Public error 仅含 `AI_OUTPUT_INVALID`、通用 message、request_id、retryable，未泄漏 raw/internal code/rule。

## U. Repair / Fallback Metrics

- Profile repair=`0 / not_needed`；fallback=0；
- Match repair=`1 / failed`；fallback=0；
- Recommendation/StrengthGap/Greeting repair/fallback=`not_run`；
- personalized/Phase 1 Greeting fallback=`not_run`；
- JD repair/fallback=`unknown`（缺少 frozen diagnostics）。

## V. Latency

- JD：9,482 ms；Profile：2,528 ms；Match：11,946 ms；
- executed-stage total：23,956 ms；
- successful full-chain latency 不存在；样本不足，不报告 p95。

## W. Artifact

- `docs/acceptance-artifacts/phase-2-4/phase-2-4-post-035-036-replacement-rb-05.json`；
- SHA-256：`5febd1400a781771d5f5cccb5414e2ef3ac40bfbc9ed9843f970f00afcb8fb82`。

## X. Historical Artifact Preservation

- preflight-failure artifact `phase-2-4-post-035-036-rb-05.json` SHA-256=`a84f4a1ee4731481b587a7ae207cd2de3f0635badbf5ef80e8064399253db509`；
- post-033/034 restabilization artifact SHA-256=`c4ae77132e1f9be830b7629633528b2b726e9c901dd7722537c09db28afa28f3`；
- 所有历史 artifacts 未覆盖或删除。

## Y. Scope Audit

- no source/runner/fixture/Prompt/Contract/public Schema/validator/diagnostics-default changes；
- no model/provider/temperature/retry/timeout/fallback/Gate changes；
- flags 只显式存在于本次 server process；server 已停止；
- exactly one replacement business execution；additional reruns=0；
- no Phase 2.5、14×3、Phase 1 regression、content scoring、Issue closure 或 Final Release Gate work。

## Z. Git / Gate Recommendation

- frozen execution HEAD=`b2c0c726347bf575f80422e9773a28c7a501e8b1`；
- product/runner implementation=`f66858987f89b3c209eda511e51709c1b7ad9f11`；
- evidence-only commit 在 artifact/docs 审计后创建；
- 本轮不关闭 ISSUE-028～036 或 Phase 2.4。

Final recommendation：**Phase 2.4 remains BLOCKED**。

不得授权 Phase 2.5 或宣布 Phase 2 Ready for Release。等待 Product Owner / QA Gate Review。
