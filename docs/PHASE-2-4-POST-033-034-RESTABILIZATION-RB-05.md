# Phase 2.4 post-033/034 Restabilization RB-05 Evidence

> 日期：2026-08-12
> Authorization baseline：`main / eb10e8a46096265cbc48475c0cf7869dae2e6b01`
> Run policy：`NEW DETERMINISTIC BASELINE VERIFICATION / E2E-RB-05 × exactly 1`
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## A. Authorization / Baseline

- pre-run branch=`main`；HEAD=`eb10e8a46096265cbc48475c0cf7869dae2e6b01`；Git status=`clean`；
- Product Owner / QA 已接受 focused 100/100、targeted 303/303、full 493/493、lint/build/diff 等 deterministic evidence；
- 本次只执行一个 model-backed RB-05 execution；additional model-backed reruns=`0`；
- 未在运行前或运行中修改代码、fixture、Prompt、Contract、Schema、validator、runner、diagnostics、模型/provider 或运行参数。

## B. Acceptance Preflight

| Module | HTTP | enabled | rejectedOutputCapture |
| --- | ---: | --- | --- |
| Profile | 200 | true | true |
| Match | 200 | true | true |
| Recommendation | 200 | true | true |
| Strength/Gap | 200 | true | true |
| Greeting | 200 | true | true |

`modelCallsBeforeBusinessExecution=0`，preflight=`passed / available=true`。

本地 production server 首次启动日志显示 Next.js ready；首次启动没有业务 endpoint/model 调用。随后受控执行发现该 frozen process 已占用 3000，重复启动进程以 `EADDRINUSE` 退出，runner 使用原 frozen process 完成五路 preflight 与唯一业务执行。该 operational detail 没有产生额外 RB-05 或模型抽样；实际 server owner 已在运行后停止。

## C. Frozen Input Verification

| Input | Length | SHA-256 | historicalMatch |
| --- | ---: | --- | --- |
| JD | 138 | `bf1eea5f393bb5a9ce7dd5de9ab76a0dc95f90bb4742b656e2916281584f4a60` | true |
| Profile | 80 | `0b19712da6ae0a07c4543fe8d3427a1650c4e711b7c1ed4d33a38e14e2925745` | true |

Target artifact 在运行前不存在；没有修改输入继续。

## D. Stage Matrix

| Stage | callState | resultState | HTTP | Latency | Attempts | Repair | Fallback | Request ID |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| JD | called | completed | 200 | 9,578 ms | 2（server diagnostics） | HR targeted repair accepted | HR safe fallback used | `8b8672d5-102f-4dee-b290-66dec77149ed` |
| Profile | called | completed | 200 | 2,107 ms | 1 | not_needed / 0 | not_used | `be1397dc-553a-4bc2-8108-da6efba33588` |
| Match | called | failed | 502 | 12,047 ms | 2 | rejected / 1 | not_used | `137986f9-a4e9-4624-9659-b443f87e5079` |
| Recommendation | not_called | not_run | null | null | null | not_run | not_run | null |
| Strength/Gap | not_called | not_run | null | null | null | not_run | not_run | null |
| Greeting | not_called | not_run | null | null | null | not_run | not_run | null |

Match failure=`AI_OUTPUT_INVALID / deterministic semantic validation`；`downstreamCallsAfterFailure=0`；`safeFailure=false`；invariants=`not_run / passed=null`。

## E. ISSUE-033 Audit

Initial raw 再次生成两条 cross-dimension negative：

| Dimension | Status | Claim | Ref | Guard |
| --- | --- | --- | --- | --- |
| domain | unmet | `候选人没有正式数据产品工作经历，且未表明任何数据产品相关经验，无法满足数据产品领域要求。` | CF-004/counter | M-CANDIDATE-LINEAGE REJECT |
| responsibility | unmet | `候选人没有正式数据产品工作经历，无法证明独立负责过数据产品。` | CF-004/counter | M-CANDIDATE-LINEAGE REJECT |

- initial absence→negative count=`2`；cross-dimension explicit-negative reuse=`2`；两条均未释放；
- repair 将 domain 与 responsibility 都改为 `unknown`，candidateEvidence 清空，并使用“现有资料未表明……但缺乏明确反证”的 uncertainty boundary；repair cross-dimension negative reuse=`0`；
- employment_type 仍保持 `unmet`，CF-004/counter 支持合法 relation：`与正式工作经验要求直接冲突`；该 dimension 没有 validation issue；
- 但 status validator 随后把 CF-004 错称为 domain 的 `explicit same-domain positive evidence`，拒绝合法 domain unknown；静态路径确认 `explicitSameDimensionPositiveFacts` 仅按 semanticTags=`experience/project_experience` + “产品”识别，未排除 CF-004 的 explicit negative；
- 因 deterministic validator 自身仍跨 dimension 将 employment negative 当成 domain positive，且不存在 Final accepted Match，工程建议：**ISSUE-033 = FIX NOT VERIFIED**。

## F. ISSUE-034 Audit

- valid employment relation：initial/repair 的 `与正式工作经验要求直接冲突` 均未被 relation/lineage validator 拒绝；
- broad-domain relation：initial `无法满足数据产品领域要求` 被 M-CANDIDATE-LINEAGE 拒绝；
- sibling responsibility relation：initial `无法证明独立负责过数据产品` 被 M-CANDIDATE-LINEAGE 拒绝；
- repair invalid sibling relation count=`0`；project-property projection=`0`；
- relation dimension-local guard 的 valid/invalid runtime 路径均按预期工作，但 Match 因其他 terminal issues 没有 Final accepted relation state；
- 工程建议：**ISSUE-034 = VERIFICATION INCONCLUSIVE**。

## G. ISSUE-029 Preservation

- initial course→CF-003/CF-004 contamination=`0`；repair=`0`；
- initial/repair 的 `候选人在团队项目中协助整理需求和测试，未表明主导角色，仅参与部分工作。` 均触发 `M-K experience_type:工作->CF-003`；under frozen vocabulary，“工作”被视为未由 CF-003 独立拥有的 experience-type qualifier；
- guard 在 initial 与 repair 均 fail-closed；Final accepted contamination=`0`；
- ISSUE-029 safety preservation=`PASS / no unsupported output released`。本次不改变其正式 `FIX VERIFIED AT MATCH RUNTIME / closure pending` 状态。

## H. ISSUE-031 Audit

Recommendation=`not_called / not_run`，没有 multi-MI attribution runtime evidence。工程建议：**VERIFICATION INCONCLUSIVE**。

## I. ISSUE-028 Audit

Recommendation 未调用，因此没有新的 Recommendation structured rejection evidence，也没有人为制造 rejection。工程建议：**INCONCLUSIVE**。

## J. ISSUE-030 Audit

Strength/Gap=`not_called / not_run`，SG-E 未执行。工程建议：**VERIFICATION INCONCLUSIVE**。

## K. ISSUE-032 Preservation

- Recommendation、Strength/Gap、Greeting 均显式 `not_called / not_run`，不是 absent/pass；
- attempts/repair/fallback 保持 `null + not_run`，没有将 unknown 伪造为 0；
- `invariantAudit.status=not_run`、`passed=null`；
- `downstreamCallsAfterFailure=0`；`safeFailure=false`；
- lifecycle aggregate 对三个下游均保存 `notRunCount=1`。ISSUE-032 preservation=`PASS`。

## L. Greeting / OBS-006

Greeting 未调用；repair/fallback/evidence 均 `not_run`。本次不产生新的 OBS-006 runtime sample，也不修改 OBS-006。

## M. Global Evidence Audit

- Candidate Profile：4 个 PF 全部进入 4 个 CF；CF→PF→Raw Profile lineage 完整；semantic upgrade/untraceable/layering/unused PF 均 0；
- rejected Match 中的 JD evidence 均为 frozen Raw JD 的原文片段；JD server diagnostics 为 final schema/evidence/validation PASS；
- runner 的 failureContext 保存 accepted Candidate Profile，但不复制 accepted JD body；因此完整 global invariant 不能据此判为 PASS，只能保持 `not_run / passed=null`；
- 无 Final Match、Recommendation、Strength/Gap 或 Greeting；unsupported output released=`false`；
- 所有 full-chain Hard Gates 均不得以 Profile/JD 成功覆盖，整体 E2E=`0/1`。

## N. Rejected Evidence

`rejected outputs=2`，均 `rawAvailable=true`、`finishReason=stop`、`parsedOutputAvailable=true`、`artifactTruncated=false`。

| Output | Raw length | Code / rule | Path | Exact reason |
| --- | ---: | --- | --- | --- |
| initial | 3,845 | M-CANDIDATE-LINEAGE | `matchItems.1.dimensions.1.reason` | CF-004 不支持 domain negative claim |
| initial | 3,845 | M-CANDIDATE-LINEAGE | `matchItems.1.dimensions.2.reason` | CF-004 不支持 responsibility negative claim |
| initial | 3,845 | M-K | `matchItems.2.dimensions.0.reason` | `experience_type:工作->CF-003` |
| repair | 3,409 | MATCH_VALIDATION_REJECTED | `matchItems.1.dimensions.1.status` | `unknown omitted explicit same-domain positive evidence: CF-004` |
| repair | 3,409 | M-K | `matchItems.2.dimensions.0.reason` | `experience_type:工作->CF-003` |

Initial/repair raw、parsed output、validation layer/code/rule/path/message/rejected item 均完整保存在 artifact。

## O. Repair / Fallback Metrics

- JD：upstream attempts=2；HR targeted repair attempted/succeeded；HR safe fallback used；
- Profile：repair 0，fallback 0；
- Match：repair 1 / failed；fallback 0；
- Recommendation/Strength-Gap/Greeting：repair/fallback not_run；
- personalized Greeting fallback、Phase 1 Greeting fallback：not_run。

## P. Latency

- JD：9,578 ms；Profile：2,107 ms；Match：12,047 ms；
- executed-stage latency total：23,732 ms；
- 完整链未完成，不报告 successful full-chain latency。

## Q. Artifact

- 新 artifact：`docs/acceptance-artifacts/phase-2-4/phase-2-4-post-033-034-restabilization-rb-05.json`；
- SHA-256：`c4ae77132e1f9be830b7629633528b2b726e9c901dd7722537c09db28afa28f3`；
- 历史 `phase-2-4-post-033-034-rb-05.json` 仍为 SHA-256 `f4b874ef7f9d9a72ba211cc3c65eee2b434f510497a866b4870ce65448ef0f8c`，未覆盖；
- model-backed executions=`1`；additional reruns=`0`。

## R. Scope Audit

- no code changes；no fixture changes；no Contract/Prompt/Schema/validator/runner/Gate changes；
- no model/provider/temperature/retry/timeout/fallback changes；
- exactly one model-backed RB-05；no rerun；no Phase 2.5 work；
- 本次只新增 artifact、post-run forensic audit 与证据文档。

## S. Git

- frozen implementation HEAD=`eb10e8a46096265cbc48475c0cf7869dae2e6b01`；
- evidence-only commit：运行证据完成后按项目协议提交；
- evidence commit 前仅包含本 artifact 与相关 docs，无产品代码 diff。

## T. Gate Recommendation

建议：**Phase 2.4 仍 BLOCKED**。

不得自行关闭 ISSUE-028～034、Phase 2.4，不得授权 Phase 2.5 或宣布 Ready for Release。等待 Product Owner / QA Gate Review。
