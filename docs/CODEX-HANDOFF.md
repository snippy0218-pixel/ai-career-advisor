# AI 求职顾问项目交接文档（Codex Handoff）

> 更新日期：2026-08-13
> 用途：让一个**没有当前 conversation history、但可读取本仓库**的新 Codex thread 能准确继续当前任务。
> 工作协议：`docs/CODEX-OPERATING-PROTOCOL.md` 为后续 thread 的**固定工作协议**（自主事项、停止升级条件、禁止事项、Issue 处理原则、冻结 Pass Gate）。
> 事实来源：以仓库当前状态为准（`docs/验收执行报告.md`、`docs/analysis-schema.md`、`docs/测试案例.md`、`docs/更新日志.md`、`src/`）。

## 1. 当前主线任务与下一步

**当前状态：Phase 1 = PASS / CLOSED；Phase 2.0 Contract = PASS / CLOSED；Phase 2.1 Candidate Profile Foundation = PASS / CLOSED；ISSUE-025 = CLOSED；Phase 2.2A Match Core Foundation = PASS / CLOSED；Phase 2.2B-1 Recommendation Core = PASS / CLOSED；ISSUE-026 = CLOSED；Phase 2.2B-2 Strength + Gap Core = PASS / CLOSED；ISSUE-027 = CLOSED；Phase 2.3 Personalized Greeting = PASS / CLOSED；Phase 2 Core Feature Development = COMPLETE；Phase 2.4 Quality & Robustness = PASS / CLOSED；Phase 2.5 Final Regression / Release Gate = **AUTHORIZED / IN PROGRESS**。** baseline-2 Phase 1 30/30 已接受；baseline-8 是永久保留并排除的 infrastructure batch。baseline-11（`7460f02…`）为最新有效完整 Phase 2 content batch：40/42 PASS、41 complete chains、downstream-after-failure 0；baseline-10 两项失败全部 3/3 PASS。剩余 X-F 空白等价比较与 Recommendation 未授权替代示例已做窄恢复，focused 108/108、full 637/637、lint/build PASS。下一步审计、提交新 immutable baseline，再执行完整 Phase 2 `TC-P2-01～14 ×3` replacement matrix。最新裁决见 `PHASE-2-5-BASELINE-11-STABILIZATION.md`。

- Product Owner / QA 已正式判定 Phase 2.3 Personalized Greeting PASS / CLOSED，并接受 12/12 preflight、36/36 clean matrix、PG-A～PG-M、333/333、lint/build 与 upstream regression 0；
- Phase 2.4 仅治理 backlog、robustness、failure path、cross-module consistency、latency/repair/fallback、input/error、evidence/diagnostics 与小型 raw-input full-chain integration；不得增加用户功能；
- `OBS-005 — Long-tail Phase 2 Latency` = Observe：Phase 2.3 历史 average 约 3,656 ms、max 37,268 ms；先测量各生成阶段，不为单个 outlier 建复杂架构；
- 本阶段主文档与 Gate 状态见 `docs/PHASE-2-4-QUALITY-ROBUSTNESS.md`；即使 Q-A～Q-J 全绿，也只能申请 Phase 2.4 PASS / Ready for Phase 2.5，不得自行进入 Phase 2.5。
- post-029/031 RB-05 的 Match 502 因 acceptance diagnostics 未启用而不可审计，Product Owner / QA 已正式 reopen `ISSUE-028`（P1 / multiple-layer gap）并建立 `ISSUE-032`（P1 / QA Artifact Integrity / Observability Semantics）；
- `4828fae…` 上的 bounded stabilization 已完成：五 route acceptance capability probe 在业务请求前 fail-fast；五 adapter completion lifecycle 区分 raw/no-raw、provider/transport、length/empty/content-filter、parse/schema/semantic/repair；Match 使用独立 rejection evidence；runner 显式保存 called/not_called、completed/failed/not_run、unknown/known zero 与 invariant state；
- deterministic Gate：focused 91/91、ISSUE-029/030/031 targeted 148/148、full 429/429、lint/build/diff PASS，模型调用 0，RB-05 未执行；工程建议 ISSUE-028/032 `LOCAL FIX VERIFIED`，等待 Product Owner / QA 决定是否授权新的 E2E verification；详见 `docs/PHASE-2-4-ISSUE-028-032-STABILIZATION.md`；
- **ISSUE-029 — Cross-CF Candidate Scope Contamination in Match Reason = P1 / OPEN / RELEASE GATE BLOCKER**：final E2E-RB-05 中 Match 把 CF-002 的“课程”作用域传播到独立 CF-003，写成“项目为课程作业”；Strength/Gap 经 SG-B/SG-M 正确 502 fail-closed，但 Match 已产生 unsupported Candidate scope；已触发 Stop & Escalate，证据见 `docs/acceptance-artifacts/phase-2-4/phase-2-4-stop-escalate-audit.json`；
- Product Owner / QA 已授权 ISSUE-029 bounded stabilization：新增逐 CF qualifier ownership validator、Match Prompt v1.1 与 acceptance-only initial/repair raw evidence；Case A～F + positive control、259/259 targeted、363/363 full regression、lint/build 均 PASS；
- 三次 RB-05 worktree rerun 均独立保留且 0/1：第 1 次暴露跨分句 negation 漏拦，第 2 次暴露 JD requirement phrase 误报，第 3 次 Match/Recommendation 已 200 且无 CF-002→CF-003 course scope，但 Strength/Gap initial/repair 均被 SG-E 拒绝并 502，Greeting 未调用；该 SG-E failure 后续已由 Product Owner / QA 裁决为独立 ISSUE-030；
- Product Owner / QA 已裁决 rerun-3 SG initial/repair 为 Classification B — SG-E False Positive，并建立 `ISSUE-030 — SG-E Evidence Boundary False Positive on Valid Long Clause`（P1 / OPEN / Release Gate Blocker）；ISSUE-029 更新为 OPEN / FIX IMPLEMENTED / LOCAL VERIFICATION PASS / FINAL E2E VERIFICATION PENDING，rerun-3 contamination NOT OBSERVED；
- ISSUE-030 bounded stabilization 仅允许修改 Strength/Gap deterministic evidence-boundary validation；不得修改 Match、Prompt、CLOSED Contract 或其他产品模块。完成确定性 Gate 后只允许一次冻结 fixture 的 post-fix RB-05；详见 `docs/PHASE-2-4-ISSUE-030-STABILIZATION.md`；
- ISSUE-030 implementation commit `b30e7be…`：以 sentence/clause semantic unit 结构替换 SG-E fixed window；T1～T10、83/83 targeted、373/373 full、lint/build PASS；
- 唯一 post-fix RB-05 artifact `phase-2-4-issue-030-rb-05-post-fix.json` 为 0/1：JD 在 83 ms 返回 503 `AI_SERVICE_UNAVAILABLE`，Profile 及全部下游调用 0；按 Gate 未 rerun。该次未到达 Match/SG，因此 ISSUE-029 post-fix audit = indeterminate，ISSUE-030 = FIX NOT VERIFIED，Phase 2.4 仍 BLOCKED；
- replacement RB-05 到达 Match 后再次出现 ISSUE-029：MI-003 reason 含 Candidate positive claim、`课程作业` 与 `非正式工作`，但 refs/PF 均为空；随后 Recommendation initial/repair exact raw 因 cross-MI status phrase attribution false positive 被拒绝，正式建立 ISSUE-031；
- ISSUE-029 restabilization 已新增 `M-CANDIDATE-LINEAGE`（空 refs 只允许 evidence boundary；有 refs 必须语义支持）并保留逐 CF qualifier ownership；ISSUE-031 已将 status phrase 绑定到显式 MI/requirement/locality/structured ref，歧义 grouped phrase fail-closed；M1～M10、R1～R10、focused 93/93、targeted 184/184、full 394/394、lint/build/diff PASS；
- ISSUE-030 代码未修改，状态保持 OPEN / LOCAL FIX VERIFIED / E2E PENDING。下一步只允许固定本轮 implementation commit 后执行一次 post-029/031 RB-05；不得追加抽样；
- Product Owner / QA 已明确授权并完成 `044d935…` 上唯一 post-029/031 RB-05：frozen fixture hash 相同；JD 200、Profile 200、Match 502 `AI_OUTPUT_INVALID`，其余阶段未调用，downstream calls after failure=0。Match acceptance diagnostics 未启用/未进入 artifact，rejected raw 与 validation reason 不可恢复；因此底层 failure=`unknown`，ISSUE-029/030/031 均只能建议 `VERIFICATION INCONCLUSIVE`，并暴露 mandatory rejected-evidence preservation regression。Artifact：`phase-2-4-post-029-031-rb-05.json`；禁止 rerun；
- final Phase 2.4 suite 固定 `679268a…`：7/8；六条完整链、RB-08 预期 400、RB-05 blocked；350/350、lint/build PASS；不得用 targeted success 覆盖 final failure；
- `OBS-006 — Full-chain Personalized Greeting Fallback Interaction`：final six greeting requests 中 repair 4/6、personalized safe fallback 4/6、Phase 1 fallback 0/6；均安全但与 isolated Phase 2.3 0/36 显著不同，待 ISSUE-029 review 后复评；
- Product Owner / QA 在 post-028/032 RB-05 review 后仅授权 ISSUE-028 Recommendation structured rule/code completion 与 ISSUE-031 deterministic restabilization；starting baseline `4ec6cb4…`。本轮已新增 Recommendation 专用 rejected-evidence serializer，R-C validation layer/code/rule/MI refs 直接沿 adapter → acceptance diagnostics 保存，歧义不伪造 rejected item，production response 继续不泄漏内部证据；
- ISSUE-031 的确切漏测语序为 `MI-004（学历要求已满足）以及 MI-001、MI-003 的部分匹配`：旧距离启发式把括号内 `已满足` 错归给更近的后置 MI-001，且未建模 `部分匹配`。现按括号 owner、显式 MI group、exact requirement 与 single structured ref 归属，真正歧义 fail-closed；R31-1～R31-16 全绿；
- 本轮 deterministic evidence：focused 79/79、authorized targeted 261/261、full 451/451、lint/build/diff PASS；模型调用 0，未执行 RB-05，未修改 frozen fixture/Prompt/Contract/Match/Strength-Gap/Greeting/runner。工程建议 ISSUE-028 `LOCAL COMPLETION VERIFIED`、ISSUE-031 `LOCAL FIX VERIFIED`，二者均等待新的 full-chain E2E 授权；详见 `docs/PHASE-2-4-ISSUE-028-031-COMPLETION.md`；
- Product Owner / QA 已接受 `901c7b6…` deterministic baseline 并授权唯一一次 post-028/031 completion RB-05；五路 capability 与 frozen fixture hash preflight 全部通过，execution 前 model calls=0；
- 唯一运行结果 0/1：JD 200 / 7,325 ms、Profile 200 / 2,463 ms、Match 502 / 10,624 ms；Match initial 7 条 issues、repair 3 条 issues，Recommendation/Strength-Gap/Greeting `not_called/not_run`，downstream calls after failure=0，invariant audit `not_run/passed=null`；
- Initial 的 `课程->CF-004/CF-003` cross-CF contamination 被 M-K 正确拒绝；repair course contamination=0，但 `无法满足独立负责`、`并非主导角色` 两条 unsupported negative upgrade 仍被 M-CANDIDATE-LINEAGE 正确拒绝。`与正式工作经验要求不符` 由 CF-004 + JD 共同支持却也被拒绝，记录为待 QA 裁决的 possible deterministic false-positive observation；即使排除此项，repair 仍因另外两条合法失败；
- ISSUE-028/031/030 runtime verdict 均 INCONCLUSIVE（相应下游未调用）；ISSUE-029 safety preservation 无 accepted contamination release，但 full-chain closure evidence 未取得；ISSUE-032 preservation PASS。Artifact：`phase-2-4-post-028-031-completion-rb-05.json`；完整审计见 `docs/PHASE-2-4-POST-028-031-COMPLETION-RB-05.md`；
- Product Owner / QA 已完成上述 Match 502 Gate Review：建立 `ISSUE-033 — Match Repair Unsupported Negative-Claim Stability` 与 `ISSUE-034 — Match Lineage False Positive on Supported CF↔JD Relational Conclusion`，均为 P1 / OPEN / Release Gate Blocker；仅授权 ISSUE-033 bounded stabilization 与 ISSUE-034 先裁决后 bounded stabilization；
- ISSUE-034 在 validator 修改前完成 lineage adjudication：`CF-004/PF-004/Raw Profile=没有正式数据产品工作经历` 与 JD `具有独立负责数据产品的正式工作经验` 充分支持同一 employment_type 维度的 `与正式工作经验要求不符`，正式结论 `FALSE POSITIVE CONFIRMED`；
- ISSUE-033 已将 Match core/repair prompt 升级 v1.2：明确 explicit counter-evidence 与 absence of evidence，M-CANDIDATE-LINEAGE repair 必须把 unsupported negative 改为 uncertainty boundary；ISSUE-034 仅新增 employment_type + unmet + all-counter + explicit-negative + exact JD evidence 的窄 relational mismatch recognition，禁止向具体项目/其他维度投射；
- G33-1～10、L34-1～10 全绿；focused 78/78、authorized targeted 281/281、full 471/471、lint/build/diff PASS；模型调用 0、RB-05 0、fixture/Contract/Gate 未修改。工程建议 ISSUE-033/034 `LOCAL FIX VERIFIED`；Phase 2.4 正式状态仍 BLOCKED，下一步等待 Product Owner / QA Review，只有新授权后才可执行一次完整链 E2E。详见 `docs/PHASE-2-4-ISSUE-033-034-STABILIZATION.md`。
- Product Owner / QA 接受 deterministic evidence 并授权在 `cc9fa376…` 上执行唯一 post-033/034 full-chain RB-05；五路 capability 与 frozen fixture hash preflight PASS，execution 前 model calls=0；
- 唯一运行 0/1：JD 200 / 10,464 ms、Profile 200 / 2,799 ms、Match 502 / 12,634 ms；Recommendation/Strength-Gap/Greeting not_called，downstream calls after failure=0，invariants not_run/passed=null；
- Match initial 的 course→CF-004 domain/responsibility contamination 被 M-CANDIDATE-LINEAGE/M-K 正确拒绝；repair 清除 course contamination，但生成 `没有正式数据产品工作经历，与独立负责要求直接冲突`，把 CF-004 employment negative 传播成 responsibility/ownership conclusion，再次被 lineage/M-K 正确拒绝；
- ISSUE-034 employment_type relation 未被拒绝，但 domain sibling 的 `与数据产品领域要求直接冲突` 亦未触发 issue；在“仅限 employment_type narrow relation”Gate 下不能判定 verified。工程建议 ISSUE-033/034 均 `FIX NOT VERIFIED`；ISSUE-029 preservation PASS；ISSUE-028/030/031 inconclusive；ISSUE-032 preservation PASS；
- Artifact `phase-2-4-post-033-034-rb-05.json` 独立保存，SHA-256 `f4b874ef7f9d9a72ba211cc3c65eee2b434f510497a866b4870ce65448ef0f8c`；model-backed executions=1，additional reruns=0。Phase 2.4 仍 BLOCKED，等待 Product Owner / QA Gate Review；不得再运行 RB-05、修改实现或进入 Phase 2.5。完整审计见 `docs/PHASE-2-4-POST-033-034-RB-05.md`。
- Product Owner / QA 将 ISSUE-033/034 更新为 `LOCAL FIX NOT VERIFIED / BOUNDED RESTABILIZATION REQUIRED`，不新建 ISSUE-035，并仅授权 deterministic restabilization；starting HEAD=`be74c95…`；
- 静态 trace 确认 v1.2 未把 explicit negative dimension locality 写成 repair hard rule；domain sibling phrase 因 relation clause 未进入 Candidate assertion selection 而绕过 lineage，前半句又因 generic `数据产品` anchor 被误判支持；该 phrase 没有命中旧 ISSUE-034 exception；
- v1.3 冻结 `EXPLICIT NEGATIVE EVIDENCE IS DIMENSION-LOCAL` 与 `RELATIONAL CONCLUSION MUST BE DIMENSION-LOCAL`：relation clause 强制审查、relation 禁走 generic anchor、employment target 自身必须含正式工作/全职/实习 qualifier；
- G33-1～20、L34-1～20、exact initial/repair artifact replay 全绿；focused 100/100、targeted 303/303、full 493/493、lint/build/diff/forbidden-surface/secret scan PASS；模型调用 0、RB-05 0；
- 工程建议 ISSUE-033/034 `LOCAL FIX VERIFIED`；Phase 2.4 仍 BLOCKED，等待 Product Owner / QA Review 与新的明确 E2E 授权。详见 `docs/PHASE-2-4-ISSUE-033-034-RESTABILIZATION.md`。
- Product Owner / QA 已接受 `eb10e8a…` deterministic baseline 并授权唯一一次 post-033/034 restabilization RB-05；五路 capability 与 frozen fixture hash PASS，execution 前模型调用 0；
- 唯一运行 0/1：JD 200 / 9,578 ms、Profile 200 / 2,107 ms、Match 502 / 12,047 ms；Recommendation/Strength-Gap/Greeting not_called，failure 后下游调用 0，invariants not_run/passed=null；
- Match initial 的 CF-004→domain/responsibility negative reuse 被 M-CANDIDATE-LINEAGE 正确拒绝；repair 将二者改为合法 unknown boundary，但 status validator 又把 CF-004 employment negative 误认成 domain positive evidence，另有 `M-K experience_type:工作->CF-003` 未被 repair 清除，故无 Final Match；
- 工程建议 ISSUE-033=`FIX NOT VERIFIED`、ISSUE-034/031/030=`VERIFICATION INCONCLUSIVE`、ISSUE-028=`INCONCLUSIVE`、ISSUE-029/032 preservation PASS；Phase 2.4 仍 BLOCKED。artifact 与完整 evidence：`docs/PHASE-2-4-POST-033-034-RESTABILIZATION-RB-05.md`。
- Product Owner / QA 已将上述 runtime evidence 裁决为 ISSUE-033=`FIX VERIFIED AT REPAIR RUNTIME`、ISSUE-034=`FIX VERIFIED AT RELATION RUNTIME`，并正式建立 P1 blocker ISSUE-035（counter 被误认 positive）与 ISSUE-036（generic `工作` 被误认 employment qualifier）；
- ISSUE-035 internal polarity helper 排除 explicit-negative/boundary facts 的 positive existence 与 positive-role 使用，同时保留 employment counter relation；ISSUE-036 将裸 `工作` 收敛为 bounded phrase context，并在 claim/evidence 两侧共用 classifier；
- E35-1～10、M36-1～12、exact current initial/repair replay 全绿；focused 110/110、targeted 327/327、full 517/517、lint/build/diff/scope/secret PASS；模型调用 0、RB-05 0；
- 工程建议 ISSUE-035/036 `LOCAL FIX VERIFIED`；Phase 2.4 仍 BLOCKED，等待 Product Owner / QA Review 与新的明确 E2E 授权。详见 `docs/PHASE-2-4-ISSUE-035-036-STABILIZATION.md`。
- Product Owner / QA 接受 ISSUE-035/036 local evidence 后授权在 `ee6ac4c…` 上进行一次 post-035/036 RB-05；frozen JD/Profile length 与 SHA-256 匹配，server 正常启动，但五路 acceptance capability 均因对应 diagnostics flag 未启用而返回 503 `ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE`；
- runner 在第一笔业务请求前 fail-fast，artifact 保存 `requestCount=0 / modelCalls=0 / completedChains=0`；未设置 flag 后重跑，additional reruns=0。ISSUE-035/036/028/030/031 runtime verdict 均 INCONCLUSIVE；
- preflight-failed artifact 未物化六条 `not_called/not_run` stage ledger，也未保存 probe request IDs/latency，因此 ISSUE-032 preservation 不能建议 PASS；不修改 runner、不新建 Issue。Artifact：`phase-2-4-post-035-036-rb-05.json`；完整审计见 `docs/PHASE-2-4-POST-035-036-RB-05.md`。
- Product Owner / QA 将上述缺口正式裁决为 ISSUE-032 `PRECHECK-PATH REGRESSION / BOUNDED RESTABILIZATION REQUIRED`，并确认 capability fail-fast 原则本身正确；不得创建 ISSUE-037、自动启用 flags 或 rerun E2E；
- `f668589…` 新增 preflight-failure artifact builder，复用冻结 `buildExplicitStageLedger([])` 与 invariant state：顶层完整物化六阶段 not_called/not_run、invariant not_run/passed=null、safeFailure=false 与 business/model/downstream known zero；`results=[]` 继续只表示 business case loop 未运行；
- capability ledger 仅补存已有 response 的 `rejectedOutputCapture` boolean，未扩展 request ID/latency Gate；P32-1～12 与 immutable historical artifact reconstruction PASS；focused 26/26、targeted 340/340、full 530/530、lint/build/diff/scope/secret PASS；模型调用/E2E 0；
- 工程建议 ISSUE-032 `LOCAL RESTABILIZATION VERIFIED`，Phase 2.4 ready to request one replacement full-chain E2E；正式状态仍 BLOCKED，等待 Product Owner / QA Review。详见 `docs/PHASE-2-4-ISSUE-032-PRECHECK-RESTABILIZATION.md`。
- Product Owner / QA 正式接受 ISSUE-032 local restabilization，并在 `main / b2c0c726…` 授权一个 replacement post-035/036 RB-05；server 启动前显式启用五个 acceptance-only flags，实际 routes preflight 5/5 为 `enabled=true / rejectedOutputCapture=true`；
- 唯一 replacement 0/1：JD 200 / 9,482 ms、Profile 200 / 2,528 ms、Match 502 / 11,946 ms；Recommendation/StrengthGap/Greeting not_called，downstream calls=0，invariants not_run/passed=null，strictly no rerun；
- initial 的 CF-004→domain/responsibility negatives 与 course→CF-004 contamination 被 lineage/M-K 正确拒绝；repair 已保持 employment unmet、domain/responsibility unknown、course contamination 0，ISSUE-035 old positive-evidence false positive 与 ISSUE-036 old M-K work false positive均未出现；
- repair 被新的 M-CANDIDATE-LINEAGE false positive 终止：合法 boundary reason 的分号后 meta-evidence clause“CF-004 仅否定正式工作经历，不构成……明确反证”被当作无 refs Candidate assertion；这不是 ISSUE-035/036 regression。本轮不修、不编号，等待 PO/QA adjudication；
- 工程建议 ISSUE-035=`FIX VERIFIED`、ISSUE-036/028/030/031=`INCONCLUSIVE`；ISSUE-029/032/033/034 preservation PASS；Phase 2.4 remains BLOCKED。Artifact：`phase-2-4-post-035-036-replacement-rb-05.json`；详见 `docs/PHASE-2-4-POST-035-036-REPLACEMENT-RB-05.md`。
- 新高自治 Gate 允许在冻结 Contract 内自主完成可复现 blocker 闭环与每 baseline 固定三次 E2E batch；此前“不得创建 ISSUE-037”仅约束 ISSUE-032 precheck-path 一轮，不覆盖 replacement artifact 暴露的新 Match failure；
- 已建立 ISSUE-037：punctuation split 后的 CF scope / evidence-force 元证据被误分类为 Candidate assertion。`5dd7d06…` 增加 bounded meta-evidence classifier，要求 CF 存在、负向极性一致、解释 scope 由该 CF 支持；任意证明、缺失 CF、fabricated interpretation、直接 Candidate negative 与 cross-dimension negative 继续 fail-closed；
- ISSUE-037 exact replacement raw replay：initial 仍拒绝，repair PASS 且 domain/responsibility unknown refs 保持 `[]`；focused 9/9、Match targeted 140/140、full 539/539、lint/build/diff/scope/secret PASS；模型调用/E2E 0；详见 `PHASE-2-4-ISSUE-037-STABILIZATION.md`。
- autonomous batch 1 在 `894f3b4…` 固定执行三次 RB-05，0/3 complete：run 1 Match repair 200 后 Recommendation 被合法 status→MI suffix group false-positive 拒绝；run 2 Match 正确拒绝无 refs Candidate negative，但另有 `参与团队项目` weaker claim lexical false positive；run 3 正确拒绝 `课程项目非正式工作` cross-CF contamination。三份 artifact 均保留，详见 `PHASE-2-4-AUTONOMOUS-BATCH-1.md`；
- `f8567f4…` 完成 baseline 2：R-C suffix parentheses 支持显式多 MI 并逐项验证；Match 仅对 team+project+actual involvement 接受 weaker participation entailment；Prompt/repair v1.4 禁止 unknown 空 refs 重复 Candidate negative、`未排除可能性` 和无 CF ownership 的 experience qualifier；focused 9/9、Match 145/145、Recommendation 83/83、full 548/548、lint/build/diff/scope/secret PASS；详见 `PHASE-2-4-AUTONOMOUS-STABILIZATION-2.md`。
- autonomous batch 2 在 baseline 2 固定执行三次，1/3 complete：run 1 full chain PASS；run 2 Recommendation described-prefix MI group 被 R-C 误判；run 3 Match evidence-force boundary 被 lineage/M-K 误判，且 raw 内 deeper explicit-CF ownership/cross-dimension 问题被审计发现；三份 artifact 均保留，详见 `PHASE-2-4-AUTONOMOUS-BATCH-2.md`。
- `4c12ed6…` 完成第 3/3、最后同根因 deterministic stabilization：共享 evidence-force semantics、显式 CF factual narration ownership、R-C described-prefix group attribution；focused 8/8、Match 150/150、Recommendation 86/86、full 556/556、lint/build/diff/scope/secret PASS。下一步仅为固定 batch 3；同一 broad status/lineage root 再阻断即 STOP & ESCALATE。详见 `PHASE-2-4-AUTONOMOUS-STABILIZATION-3.md`。
- autonomous batch 3 严格执行三次 model-backed RB-05，1/3 complete；另保留一份因本地 Greeting flag 拼写错误而产生的 zero-call preflight-failure artifact。run 2 六阶段 200、X-A～X-J PASS；run 1/3 均在 Match repair 502：unknown refs=[] 中重复 positive CF-003 factual narration，且产生 CF-003 不支持的 `个人交付/个人职责` ownership upgrade，lineage/M-K 均正确拒绝。原 ISSUE-037 合法 CF-004 boundary 在两次 repair 均通过；阻断归于 ISSUE-033 repair-generation robustness。3/3 implementation cycle budget 已耗尽，当前 STOP & ESCALATE；详见 `PHASE-2-4-AUTONOMOUS-BATCH-3-STOP-ESCALATE.md`。
- 最新 Product Owner / QA decision 明确上述 3-cycle stop condition 不成立并恢复持续自治。完整 root audit 定位 repair example 与 system unknown rule 冲突，且 M-K ownership failure 没有字段级 transition；v1.5 统一 raw/repair semantics，并在被拒 repair 后加入只降不升、全量重验的 terminal normalization。raw/repair/normalized/model metadata 均可审计；targeted 191/191、full 571/571、lint/build PASS、model calls 0。详见 `PHASE-2-4-MATCH-GENERATION-CONTRACT-STABILIZATION.md`。
- final acceptance batch 1 在 `ca9c65d…` 固定执行 3 次，0/3 complete，但 Match 3/3 HTTP 200；run 1/3 Recommendation 合法 `仅为` / described multi-MI `但均为` 被 R-C 错拒，run 2 Strength/Gap 把协助升级为部分支持 unknown 主导维度并被 SG-B/SG-M 正确拒绝。artifact 已由 `7690573…` 独立保全，无第 4 次；
- ISSUE-031/038 deterministic restabilization：R-C 补齐两个显式 subject-predicate grammar并保持逐 MI contradiction guard；SG prompt 明确 optional/dimension-local relation，一次 repair 后 terminal normalization 只删除 SG-B/SG-M 已拒绝的可选 transferable strength并完整重验。focused 136/136、full 584/584、lint/build PASS、model calls 0。详见 `PHASE-2-4-FINAL-ACCEPTANCE-BATCH-1.md` 与 `PHASE-2-4-ISSUE-031-038-STABILIZATION.md`。
- final acceptance batch 2 在 `803289b…` 上先保留一份受限网络 JD 503 / model output 0 artifact，随后 production-equivalent server 五路 capability PASS；正式 exactly 3 model-backed runs 为 3/3 complete、18/18 stages HTTP 200、X-A～X-J 3/3、下游异常调用 0、无 run 4。ISSUE-028～038 closed；Greeting personalized safe fallback 3/3 安全且 Phase 1 fallback 0，保留 OBS-006 non-blocking。最终 recommendation：`PASS / CLOSE PHASE 2.4`；Phase 2.5 仍未授权。

- TC-09（TikTok 生活服务活动/综合运营）已于 2026-08-08 通过：3/3 HTTP 200、Final Schema/evidence 3/3、候选人事实幻觉 0、八维综合 4.50、运营岗位专项 4.73；ISSUE-022 经真实回归验证后关闭；
- ISSUE-023 = P2 / Open / Observe（任职要求偶发重复，TC-09 第1次 1/3），当前不修复、不阻塞；
- Recommendation Core Final Gate 已由 Product Owner / QA 正式判定 PASS / CLOSED；ISSUE-026 CLOSED；其全部失败历史与 artifacts 永久保留；
- Phase 2.2B-2 已完成 schema/prompt/validator/repair/API/UI、294/294 regression/lint/build 与 `e217e09…` 的 12/12 preflight；但 12×3 clean matrix 仅 33/36；
- 历史 failed-matrix 记录：`ISSUE-027 — Transferable Strength Candidate Claim Upgrade Stability` 当时为 P1 Gate Blocker / OPEN，SG-TC-07 的 3/3 initial + 3/3 repair 均被 SG-B/SG-D 拒绝并 fail-closed；当前已完成下述 Case B stabilization evidence，Issue 状态为等待 Product Owner / QA closure review；
- Product Owner / QA 已接受历史 A/B/C 分类不可恢复，正式建立 `ISSUE-028 — Rejected AI Output Evidence Preservation Gap`（P1 / QA Evidence Integrity Blocker），并授权 prospective evidence-capture diagnostic protocol；
- ISSUE-028 Stage 1 已实现 acceptance-only initial/repair rejected raw evidence、deterministic secret scrub、12,000 字符有界 raw、完整 rejected fragment、SG-TC-07 CF/PF canonical context、单 artifact MI/CF/PF trace 与失败 repair aggregate；EC-TC-01～06、全量 301/301、lint/build 均 PASS，Prompt/Schema 无 diff，未调用模型；
- 已在固定 `6459795…` 上完成 prospective SG-TC-07 ×3：2 HTTP 200 + 1 HTTP 502；第 3 次 initial/repair rejected evidence 完整保存并均定性为 **Case B — Validator False Positive**。新证据不替换旧 33/36，旧六条 raw 仍为不可恢复 / INDETERMINATE；
- Stage 2 最小修复仅调整 validator 的 bounded target-relation recognition，并新增 SG-M ownership/proficiency/employment/context boundary；Prompt/Contract/model 未变，SG-B/SG-D 原则未降低；静态 307/307、lint/build PASS；
- 固定 `10cb901…` 已严格完成 SG-TC-07 ×3（3/3）→ 12×1（12/12）→ 新 12×3（36/36），SG-A～SG-M 全绿，post-fix repair 0/51，五类 Candidate boundary upgrade、fabrication、unknown deficiency、unsupported action 全 0；六维 internal review 综合 4.77、最低 3.8、P0=0、systemic P1=0；
- Product Owner / QA 已正式判定 Strength + Gap Core PASS / CLOSED，并关闭 ISSUE-027 / ISSUE-028；旧 33/36 六条 raw 仍保持 `INDETERMINATE / HISTORICAL EVIDENCE UNRECOVERABLE`，新 prospective Case B 不替换历史事实；ISSUE-028 evidence-capture 行为继续保留；
- Phase 2.3 Personalized Greeting Core 工程证据已完成：固定 `b2751c0…` 的 12×1 为 12/12、12×3 为 36/36，PG-A～PG-M 全绿；clean matrix normal 33、repair 0、personalized fallback 0、PG-TC-12 预期 Phase 1 fallback 3；333/333、lint、build PASS；完整证据与失败历史见 `docs/PHASE-2-3-GREETING-ACCEPTANCE.md` 及 `docs/acceptance-artifacts/phase-2-3-greeting/`；
- 当前允许动作仅为 Phase 2.4 Quality & Robustness 已授权范围；Phase 2.5 Final Regression / Release Gate 仍未授权；
- 新增观察 `OBS-002 — Semantic Tag Classification Correction Frequency`：Phase 2.1 final matrix 为 11 corrections / 7 of 24 requests；只要 correction 不修改 canonical statement、不制造 Candidate Fact 且 PF-I 保持 100%，暂不升级 Issue；若影响 downstream match status，再升级并停止评审；
- **Phase 2.4 禁止新增功能、重做 UI、账户/数据库/上传/OCR/Agent/多岗位比较，不得降低既有 Gate、更换 `deepseek-v4-flash`、删除负向事实或历史失败、把 safe failure 改成任意坏输入自动修复，亦不得提前执行 Phase 2.5 的 14 TC × 3 Final Matrix。**

## 2. Phase 1 当前产品范围与边界

- 产品：单页 Demo——用户粘贴招聘 JD → 服务端调 DeepSeek → 返回经校验的 `analysis-v1` 结构化岗位分析 → 页面展示；
- 目标用户：应届生 / 0–1 年经验求职者；
- Phase 1 明确不做：登录、数据库、文件上传、OCR、历史记录、会员/权限、投递管理、SSE、人岗匹配、个性化优势分析、自动投递、语音/视频面试、多模型路由、管理后台、公开部署；
- **不进入 Phase 2**；所有 AI 结论必须可解释（JD 明示 / 推断 / 待确认），关键结论带 JD 原文 evidence，不编造候选人经历。

## 3. 当前技术架构与 requirement normalization 链路

技术栈：Next.js 16.2.12（App Router）、React 19.2.8、TypeScript 6.0.3（strict）、Tailwind CSS 4、Zod 4.4.3、Vitest 4.1.10 + Testing Library。单体应用，无数据库/认证/状态库；DeepSeek 通过原生 fetch 调用（非思考、非流式、`response_format=json_object`、温度 0.2、`max_tokens=4096`）。

关键文件：

- `src/app/api/analyze/route.ts`：Phase 1 JD API（request_id、错误映射，protected）；
- `src/app/api/profile/analyze/route.ts`：Phase 2.1 Candidate Profile API；
- `src/app/api/match/analyze/route.ts`：Phase 2.2A Match Core API；
- `src/lib/analysis-schema.ts`：Raw/Final 两阶段 Zod Schema、限定词判定、章节作用域检测、evidence 校验；
- `src/lib/deepseek.ts`：DeepSeek 适配器 + 完整 normalization/修复管线；
- `src/lib/prompt.ts`：主 Prompt `jd-analysis-v1.2` + 4 个修复 Prompt（evidence/core-evidence/requirement-evidence/HR-greeting）；
- `src/lib/match-schema.ts` / `match-prompt.ts` / `match-deepseek.ts`：独立 Match Raw/Final Schema、只读 REQ/CF/PF prompt、一次有界 Match Repair 与 fail-closed 管线；
- `src/lib/greeting-schema.ts` / `greeting-prompt.ts` / `greeting-deepseek.ts` / `greeting-evidence.ts`：独立 Personalized Greeting schema、CF/PF/MI/JD selection ledger、PG-A～PG-M、一次有界 repair、双 fallback 与 rejected-output evidence；
- `src/app/api/greeting/analyze/route.ts` / `src/app/greeting/page.tsx`：Greeting API 与只显示最终可复制 greeting 的最小 UI；
- `src/components/*`：前端展示。

**requirement normalization 链路（按执行顺序）**：

1. `normalizeEvidence`：trim → JD 逐字匹配 → whitespace-normalized span recovery（ISSUE-012 已实施能力，唯一原文 span 恢复、多候选不猜测）→ 去重 → 最多 3 条；
2. 句中起点启发式 `startsInsideUnseparatedClause`：evidence 起点前一字符非分隔符且**无明确 hard/preferred 限定词**时归 `unclear`（ISSUE-015 修改后，明确限定词优先）；
3. 章节作用域 `findRequirementSectionContext`：`加分项/加分条件/优先条件/优先项` 章节内条目 → `preferred_requirement` 并将章节标题并入 evidence（ISSUE-016）；
4. 复合句拆分 `findSeparableQualifierSplit`（经 `normalizeRequirementItems`）：hard＋preferred / hard＋core / core＋preferred 在可分离从句时拆分；`并/且/以及/并且` 开头的组合条件不拆分（ISSUE-020/022）；
5. 确定性分类：`hasUnclearQualifierScope` → `unclear`；`hasPreferredQualifier`（含"尤佳"）→ `preferred`；`hasHardQualifier`（含"X年以上/X年及以上/至少[有]X年"）→ `hard`；否则 `core`；
6. 修复路径：requirements evidence 空 → 一次定向修复；coreResponsibilities evidence 空 → 一次定向修复；投递理由全部失效 → 一次定向修复；HR 越界 → 一次修复 + 固定安全兜底；均服从 60s 总超时；
7. Final Schema + JD 原文 evidence 终检；失败一律 `AI_OUTPUT_INVALID`(502)，不返回模型原文。

## 4. 冻结的单案例 Pass Gate

（单案例判定；案例级与 Phase 级区分见 `产品验收记录.md` §7.1）

- 3/3 HTTP 200（同一原始 JD 连续 3 次）；
- Final Schema 通过（3/3）；
- 原文 evidence 校验通过（3/3）；
- candidate hallucination = 0；
- 当前案例无由该案例新发现或直接触发的未关闭 P0/P1（已隔离的已知 P1 不阻塞）；
- 八维综合平均 ≥ 3.8；
- 任一单项 ≥ 3.0；
- 无确定性协议错误（高评分不得掩盖）；
- P2/一般优化项进问题池，不阻塞但必须记录。

八维口径：核心职责提炼准确性、任职要求分类准确性、岗位真实画像价值、风险信号合理性、投递建议边界与行动价值、HR 安全通用话术自然程度、可编辑模板实用性、结论与原文证据一致性。

## 5. TC-01～TC-09 最终状态

| 案例 | 类型 | 最终状态 | 八维综合 | 备注 |
|---|---|---|---|---|
| TC-01 | 高匹配 | 通过 | 4.13 | ISSUE-001/002/003/009 等已修复 |
| TC-02 | 非AI技术岗 | 通过 | 4.27 | ISSUE-010/011 修复后累计 6/6 |
| TC-03 | 低匹配/高门槛 | 通过 | 4.35 | 第二轮 771 字符 JD；首份 1149 字符为 ISSUE-012 robustness 样本 |
| TC-04 | 信息不足 | 通过 | 4.35 | 信息克制专项 4.75；ISSUE-014 来源案例 |
| TC-05 | AI/Agent 产品经理 | 通过 | 4.48 | ISSUE-015 修复后重评；AI 岗位理解专项 4.93；首份 1284 字符为 ISSUE-012 第二样本 |
| TC-06 | 前端技术岗 | 通过 | 4.42 | ISSUE-016 修复后；技术忠实度专项 4.80；ISSUE-017 首现（整条遗漏） |
| TC-07 | 食品/餐饮产品岗 | 通过 | 4.48 | ISSUE-018（"尤佳"）验证后关闭；职责拆分与责任边界专项 5.0 |
| TC-08 | 工业自动化 B2B 销售 | 通过 | 4.38 | ISSUE-020 修复后回归；修复前第一轮 3 次为失败证据永久保留；薪酬与风险审慎专项 4.5 |
| TC-09 | TikTok 生活服务活动/综合运营 | 通过 | 4.50 | ISSUE-022 修复后正式回归；运营岗位专项 4.73；ISSUE-023 首现（B 句偶发重复 1/3） |

各案例评分与问题清单详见 `docs/验收执行报告.md`（TC-01~08 分别见 4.x/5.10/6.10/7.8/8.10/9.8/10.8/11.8，TC-09 见 12.8）。

## 6. 已关闭的重要 Issue 及其协议修改

| Issue | 等级 | 修复内容（协议/实现） |
|---|---|---|
| ISSUE-010 | P0 | 列表编号边界：分隔符集合增加 `\s、.．)）` 等；`1.本科及以上` 不再被误判粘连为 `unclear` |
| ISSUE-011 | P2 | `hasHardQualifier` 年限分支增加"X年及以上" |
| ISSUE-013 | P2 | `max_tokens` 3000→4096；截断诊断 `truncatedByLength` |
| ISSUE-015 | P1 | `hasHardQualifier` 增加"至少[有]X年"；句中起点启发式对明确 hard/preferred 限定词不再强制 `unclear` |
| ISSUE-016 | P1 | 章节级 preferred 作用域：`findRequirementSectionContext`（加分项/加分条件/优先条件/优先项），章节标题并入 evidence；协议见 `analysis-schema.md` |
| ISSUE-018 | P1 | `hasPreferredQualifier` 增加"尤佳"；协议/Prompt 规则10 示例同步 |
| ISSUE-020 | P1 | 复合句 hard＋preferred 拆分：`findSeparableQualifierSplit`（现为通用 helper 前身 `findMixedQualifierSplit`）；协议新增混合限定词复合句规则 |
| ISSUE-022 | P1 | 复合句 qualifier＋core 拆分：`findSeparableQualifierSplit` 覆盖 hard＋core / core＋preferred，`并/且/以及/并且` 组合条件保护；经 TC-09 回归验证后关闭（见 §8） |
| ISSUE-024 | P1 | `hasHardQualifier` 增加明确证照/资格持有（驾驶证/驾照/资格证/从业/执业/职业资格/上岗证/操作证/执业证）与明确数值年龄上下限（X岁以下/年龄不超过X岁/年龄不低于X岁/年满X周岁）分支，排除否定表述；协议同步 `analysis-schema.md` §2.2；经 TC-10 修复后回归 3/3 验证后关闭 |

其余已关闭：ISSUE-001/002/003（P0）、ISSUE-004/005/009（P1）、ISSUE-006/008（P2），详见 `docs/更新日志.md` 与 `docs/验收执行报告.md` §15。

## 7. 当前打开的 Issue

| Issue | 等级 | 状态 | 观察/处置规则 |
|---|---|---|---|
| ISSUE-012A | P1 | **Closed（2026-08-08 人工确认）** | 标准 JD 中局部可恢复 typo 被模型纠错导致 evidence 无法 exact-match：唯一单字符替换高置信回落（同长度、1 个 Unicode 字符替换、JD 唯一候选；不支持 insertion/deletion/fuzzy；多候选 fail-closed；Final evidence 仍为 JD 原文）；经 TC-10 修复后回归验证（run2 remap 回落原文、3/3 HTTP 200）；总验收核验全部通过 |
| ISSUE-012B | P1 | **Deferred / Out of Phase 1 Scope / Phase 2 Robustness Backlog（已批准）** | 语义截断/字符缺失/片段乱序等真损坏输入的 evidence 鲁棒性；不属于 Phase 1 支持范围，fail-closed（输入门禁＋502）；转入 Phase 2 Robustness Track；已有两个真实样本（TC-03 1149 字符、TC-05 1284 字符） |
| ISSUE-014 | P2 | Open / Accepted Backlog | 信息不足场景 recommendation level 缺少判定边界（TC-04 3/3 `worth_exploring`）；Phase 2.0 Contract 设计前置输入 |
| ISSUE-017 | P2 | Open / Accepted Backlog | Requirement extraction completeness：仅统计 content 片段化 + 独立要求整条遗漏（累计：片段化 2 次＋整条遗漏 1 次，均 TC-06）；Phase 2.4 复评 |
| ISSUE-019 | P2 | Open / Accepted Backlog / Phase 2 Quality Optimization Priority | HR safeGreeting fallback 高频（累计 15 次 / 33 有效请求 ≈45.5%）；Phase 2 目标：固定回归集 fallback rate ≤20%，禁止放宽约束达成 |
| ISSUE-021 | P2 | Open / P2 High Priority / Phase 2 Committed Review | 工作特征强度无依据升级（frequency amplification）：TC-03 2/3、TC-08 6/6、TC-10 有效请求 5/5，跨案例累计 13 次；全部为审慎推断措辞、未进 riskSignals、未影响 level；维持 P2 理由与升级阈值见 `docs/PHASE-1-ACCEPTANCE.md` §5.4 |
| ISSUE-023 | P2 | Open / Accepted Backlog | 任职要求偶发重复（TC-09 第1次 1 次）；当前不修复；Phase 2.4 复评 |

## 8. ISSUE-022 详情（已 Closed，2026-08-08）

**ISSUE-022 / P1：复合 requirement 中 qualifier 与 core 分属独立从句时，整句分类导致限定词作用域跨从句污染。**

### 根因

`normalizeRequirement` 基于整条 evidence 做限定词判定：hard＋core 整句归 hard、core＋preferred 整句归 preferred，限定词作用域跨从句污染；旧 `findMixedQualifierSplit` 仅覆盖 hard＋preferred（ISSUE-020），未覆盖 hard＋core 与 core＋preferred。

### 两个实际触发句（TC-09）

- **A**：`拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景`
- **B**：`能流利使用英语进行专业交流，熟悉印尼语者优先`

### 已确认的正确产品语义

- A → `hard_requirement`（拥有4年以上…工作经验）＋ `core_requirement`（具备预测、计划制定及活动策划背景）；"4年以上"只限定前一独立从句，不得把背景要求升级为 hard；
- B → `core_requirement`（能流利使用英语进行专业交流）＋ `preferred_requirement`（熟悉印尼语者优先）；不得把英语必备降级为 preferred。

### 修复状态（已在本仓库完成，勿重复实现）

- **状态：Closed**（2026-08-08：自动测试 116/116 ＋ TC-09 三次真实回归 3/3 正确拆分 A → hard＋core、B → core＋preferred；TC-08 反例由自动化回归保持整体 preferred）；
- 协议：`docs/analysis-schema.md` 新增"混合限定词复合句规则"与"限定词 + core 复合句规则"；
- Prompt：`src/lib/prompt.ts` 规则22（复合句拆分指引）；
- 实现：`src/lib/deepseek.ts` 新增 `findSeparableQualifierSplit`（经 `normalizeRequirementItems` 接入 `prepareAnalysis`），覆盖 hard＋preferred / hard＋core / core＋preferred；**`并/且/以及/并且` 开头从句跳过（组合条件保护）**；
- 测试：`src/lib/deepseek.test.ts` 新增 2 项（A→hard＋core、B→core＋preferred）；`npm test` 116/116、lint、build 通过；
- 记录：`docs/更新日志.md`（ISSUE-022 一节与 TC-09 通过与关闭）、`docs/验收执行报告.md` §12.8/§15。

### 最小修复范围（已实施）与禁止扩大事项

- 只做"单条 verbatim evidence、从句边界明确、两片段可独立成立"的窄场景拆分；拆分片段复用现有 `normalizeRequirement`；
- **禁止**：全局 hard/preferred precedence 调整、重构整个 JD parser、新增 requirementType、放宽 evidence/sourceType/Final Schema、把"core＋preferred 命中逗号即拆分"做成机械规则。

### 必须保护的 TC-08 反例

`有烟草行业或工业大企业销售经验，并有落地项目经验者优先` —— 必须保持整体 `preferred_requirement`，不得拆成 core＋preferred（"并有"为组合条件连接词，优先作用于组合条件）。

### 自动化测试（已补 + 必须保持）

- TC-09 A → hard＋core；
- TC-09 B → core＋preferred；
- TC-08 反例（有A，并有B者优先）→ 整体 preferred；
- "有5年以上销售经验者优先" → 整体 preferred；
- ISSUE-020 hard＋preferred 继续正确拆分；
- ISSUE-010/011/015/016/018/020 回归；
- 拆分后 evidence 逐字、sourceType、顺序、重复、确认问题、repair candidate index 均需检查。

### TC-09 冻结输入

- 836 字符；UTF-8 SHA-256：`99083d9833b1b65b2055773239402d1b550164f66b1964ec3d50c5c129a70fd0`
- 已执行三次真实回归（request_id 与结果见 `docs/验收执行报告.md` §12.8）；输入文件在 `%TEMP%\tc09-regression\tc09-jd.txt`（临时目录不可长期依赖，以本节全文为准）。

```text
职位描述
团队介绍：TikTok是一个覆盖150个国家和地区的国际短视频平台，我们希望通过TikTok发现真实、有趣的瞬间,让生活更美好。TikTok在全球各地设有办公室，全球总部位于洛杉矶和新加坡，办公地点还包括纽约、伦敦、都柏林、巴黎、柏林、迪拜、雅加达、首尔和东京等多个城市。
TikTok生活服务业务在国际化布局早期阶段，我们聚焦生服领域三大行业（餐饮Dine-in、酒旅Hotel和景点门票ThingsToDo）。通过兴趣点（POI）、视频、直播、搜索等多种方式，链接海外线下商家、创作者与用户，并致力于成为海外用户首选的本地服务内容和产品探索平台。团队目前积极扩张中，当前成员分布和Base地点在上海、北京、新加坡、日本东京、印尼雅加达和美国洛杉矶6个城市。大航海时代，我们欢迎大家一起加入国际化早期征程，共同打造TikTok生活服务业务!

1、制定活动框架：明确活动目标和时间线，建立核心主题，设定总体目标和预算，分解具体目标，并将职责分配给跨职能团队；
2、市场分析：持续监控市场趋势和市场动态，从卖家和买家中获取认知，同时借鉴其他国家或地区的最佳实践，建立信息库并发掘新的增长机会；
3、生成洞察：整合内部数据、市场研究以及来自卖家和买家的反馈，挖掘可执行的洞察，以解锁新的增长机会或提升运营效率；
4、促进跨职能协作：作为知识中心，与业务发展团队、创作者团队及其他团队（包括产品经理）合作，设计并执行一致且有影响力的活动。
职位要求
1、拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景；
2、有主人翁意识，能够对项目结果负责、保持积极乐观的工作心态，并在规定时间内完成任务；
3、具备管理和同时执行多个项目的专业能力，包括制定时间表、管理预算以及高效协调团队；
4、熟练分析数据和指标，评估营销活动效果，并运用经验进行持续改进；
5、能流利使用英语进行专业交流，熟悉印尼语者优先；
6、愿意定期进行国际出差。
```

### 验证结果（已执行完毕）

1. 工程验证：targeted tests → `npm test`（4 文件 116/116）→ lint → build 全部通过；
2. TC-09 三次真实回归（2026-08-08）：3/3 HTTP 200、Final Schema/evidence 3/3、候选人事实幻觉 0、八维综合 4.50、运营岗位专项 4.73；TC-09 A/B 拆分 3/3 正确；TC-08 反例自动化回归保持整体 preferred；
3. 观察项：ISSUE-023 首现（第1次 B 句偶发重复，P2/Observe）；ISSUE-019 累计 14 次；ISSUE-021 本案例 0/3；ISSUE-014/017 本案例 0/3；
4. 结果：TC-09 通过、ISSUE-022 Closed，记录已更新，流程停止待人工确认后续。

## 9. TC-09 专项检查要点（历史记录，回归时已核对）

- 岗位本质：国际化生活服务（TikTok 生服）活动/综合运营岗，**不补造内容运营/用户运营模块**；不因"产品经理"协作对象把岗位产品化；不因"业务发展团队"把岗位销售/BD 化；
- 不补造 SQL/Python/Tableau/BI 等数据工具；不编造业绩/薪酬/客户来源；
- basicInfo 事实边界：团队介绍中的总部/成员分布（洛杉矶、新加坡、上海、北京、东京、雅加达等）**不得视为本岗位明确工作地点**；JD 未明确 location 时不得推断；"预算"指活动/项目预算，不得解释为薪资；
- "愿意定期进行国际出差"：允许"定期国际出差/存在国际出差要求"；**不得**出现频繁/高频/长期/大量等升级（ISSUE-021）；
- 输入资格检查沿用"普通换行 vs 语义截断"区分（见 `docs/测试案例.md` 执行规则第 8 条）。

## 10. 当前绝对不能做的事情

- Phase 2.4 继续 BLOCKED；不得在新授权前执行 RB-05、模型调用、stochastic sampling 或 Phase 2.5；不实现简历改写、Cover Letter、面试回答、多轮 HR Agent、自动发送、招聘网站接入、模板库、多人格风格、score 或 confidence；
- 不修改 Phase 1 protected pipeline、Candidate Profile canonical facts、Match Core、Recommendation 或 Strength/Gap；不更换 `deepseek-v4-flash`；
- 不放宽 PG-A～PG-M、Candidate Claim/PF/JD evidence、unknown、semantic upgrade、waiver 或 fail-closed Gate；不以 internal score 掩盖 Hard Gate failure；
- 不删除 `greeting-preflight-infrastructure-failure-01.json`、`greeting-preflight-failed-bce6280.json`、`greeting-preflight-invalid-stale-server-b2751c0.json` 或此前任何负向历史；
- 不自行把 Phase 2.3 更新为 PASS；必须等待 Product Owner / QA Final Gate；不顺手修复 ISSUE-023、ISSUE-012B 或做无关重构。

## 11. 工程命令与环境

```powershell
npm test          # 当前 20 文件 333 项
npm run lint
npm run build
npm run dev       # 本地开发
```

- 环境变量：`DEEPSEEK_API_KEY`（服务端，用户级环境变量，`.env.local` 不存在）、`DEEPSEEK_MODEL`（默认 deepseek-v4-flash）、`DEEPSEEK_BASE_URL`（默认 https://api.deepseek.com）；
- 真实回归方式：`npm run build` 后启动生产服务器（`node node_modules/next/dist/bin/next start`，端口 3000），向 `POST /api/analyze` 发送冻结 JD（UTF-8），服务端日志包含逐请求 diagnostics（evidence 恢复/删除、各类修复、Final Schema/evidence、output tokens、truncatedByLength 等）；
- Greeting acceptance：设置 `GREETING_ACCEPTANCE_DIAGNOSTICS=1` 后启动 production server；`node scripts/run-phase-2-3-greeting-matrix.mjs --runs 1 ...` 仅在全绿后再用 `--runs 3`；必须确认端口不是旧 server，artifact 中 implementation commit 与实际 build/process 一致；
- 历史回归样本与日志保存在 `%TEMP%\tc0X-regression\`（临时目录，勿作为唯一证据；正式记录以 `docs/验收执行报告.md` 为准）。

## 12. 版本控制基线（Phase 1 baseline）

- 仓库于 2026-08-08 初始化 Git，首次 baseline commit：`chore: establish Phase 1 baseline after TC-09`；
- branch：`main`；commit hash：`8b4df69cd34b9b76ff10bf67a9124db2a3b6bd4e`（41 文件，20,660 行）；工作区状态：clean；
- 被忽略的主要内容：`node_modules/`、`.next/`、`tsconfig.tsbuildinfo`（`.gitignore` 同时覆盖 `.env*`（保留 `.env.example`）、`/build`、`/out/`、npm/yarn/pnpm 日志、编辑器/OS 文件）；
- 敏感信息扫描：真实 `DEEPSEEK_API_KEY` 值反查 0 命中；41 个待提交文件凭据模式扫描 0 命中；`.env.example` 为占位模板（`DEEPSEEK_API_KEY=` 为空值），可安全提交；
- 后续提交规则：业务变更与文档变更按常规提交；`.env*`（除 `.env.example`）与回归临时文件永不提交；TC 临时响应与 server logs 保存在 `%TEMP%\tc0X-regression\`，不进仓库。
