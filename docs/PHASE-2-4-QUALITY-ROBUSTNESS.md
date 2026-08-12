# Phase 2.4 Quality & Robustness

> 状态：FAIL / STOP & ESCALATE / BLOCKED ON ISSUE-028～ISSUE-036
> Starting baseline：`fbca3a468dd064e05b461964fd25266ea4975faa`  
> Phase 2.5：NOT AUTHORIZED  
> 定位：已完成 Phase 2 核心功能的质量与鲁棒性治理；不是 Feature Development。

## 1. Backlog Audit

下表基于真实 Issue Ledger、Acceptance docs、Contract 与当前代码审计。`当前覆盖` 只表示已有机制，不替代本阶段验证证据。

| 项目 | 原始问题 / 触发条件 / 历史证据 | 当前覆盖与可复现性 | Phase 2.4 disposition | Final Release |
| --- | --- | --- | --- | --- |
| ISSUE-001～006、008～011、013、015、016、018、020、022、024 | Phase 1 evidence、schema、候选人幻觉、分类、限定词与复合句问题；历史修复及真实回归见 Phase 1 Acceptance | 已由冻结实现和自动化覆盖；本轮仅上游回归 | Close / regression only | 不阻塞，回归失败则阻塞 |
| ISSUE-007 | 学历/身份被作为经验要求展示；TC-01 后未复现 | 当前 basic info 与 requirements 分离；无新复现 | Obsolete / Superseded | 否 |
| ISSUE-012A | 标准 JD 单字符 typo 导致 evidence mismatch | 唯一单字符替换、唯一候选、Final 原文回落已覆盖 | Close / regression only | 否 |
| ISSUE-012B | malformed/corrupted/truncated/reordered JD 造成 evidence 无法可靠恢复；历史 TC-03 1149 字符、TC-05 1284 字符坏输入 | 输入 min/max、evidence exact match、502 fail-closed 已有；坏输入 qualification 与全链 stop semantics 尚需系统验证 | Fix safe-failure coverage；不承诺任意坏输入修复 | 是：不得返回未经验证结果 |
| ISSUE-014 | 信息严重不足时 Phase 1 recommendation level 3/3 固定 `worth_exploring`，缺少决策边界 | Phase 2 Recommendation Core 已冻结 allowed-level/status/unknown/hard-gap 决策协议；Phase 1 legacy 输出不作为 Phase 2 决策 | Obsolete / Superseded by Recommendation Core | 否；Phase 1 回归保留 |
| ISSUE-017 | requirement extraction completeness；TC-06 片段化 2 次、preferred 独立从句遗漏 1 次 | 已实现仅在模型命中同一 requirement line 的一个 exact clause 时补全另一个 verbatim separable sibling；不扩展为通用 JD parser | Fix implemented / static regression PASS；建议 Close，待 Gate review | 否；新 hard/systemic 遗漏则 reopen |
| ISSUE-019 | Phase 1 `safeGreeting` 历史 fallback 15/33≈45.5%，主要影响自然度 | Phase 2.3 personalized repair/fallback 均 0，指标不可混合；无 Candidate Profile 仍走 Phase 1 | Observe / targeted reassessment；除非价值明确，不动冻结 Phase 1 greeting | 当前不阻塞；若信息损失/幻觉则阻塞 |
| ISSUE-021 | 无 JD 依据增加 frequency/intensity/duration/scope/quantity/certainty；历史 13 次 | 已新增共享 deterministic modifier integrity，并接入 JD normalization + Match M-K + Recommendation R-L + Strength SG-N + Greeting PG-N；`拜访客户` 不得升级 `频繁拜访客户` | Fix implemented / static + E2E completed-chain regression PASS；建议 Close | 新 modifier output 则阻塞 |
| ISSUE-023 | TC-09 1/3：模型同时输出拆分项与整句，服务端二次拆分后产生重复 | 已在 normalized requirement final set 按 type/content/evidence 稳定去重；原始机制已有静态复现与回归 | Fix implemented；建议 Close | 否，除非影响 hard/type/evidence |
| ISSUE-025 | Candidate Profile fact completeness / silent omission | Canonical CF/PF ledger、24-run matrix 与 downstream evidence 已关闭该问题 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-026 | unsupported hard waiver | Recommendation R-K 与 downstream waiver guard 已关闭 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-027 | transferable Strength validator / Candidate claim upgrade stability | SG-M、post-fix 51 requests repair 0，已正式关闭 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-028 | rejected AI output evidence preservation gap | Match/route/runner E2E 已部分验证；本轮补齐 Recommendation 专用 evidence serializer，R-C layer/code/rule/MI refs 可直接进入 acceptance diagnostics，歧义不伪造 ref，production response 不泄漏 | **Open / P1 / E2E Partially Verified / Local Completion Verified / New Full-chain E2E Pending** | **是** |
| OBS-002 | Semantic Tag projection correction：11 corrections / 7 of 24 requests，PF-I 100% | correction 不改 canonical statement；需检查 downstream Match、repair、latency | Observe | 否，除非影响 truth/status |
| OBS-005 | Phase 2.3 long-tail latency：average≈3,656 ms、max 37,268 ms | 尚无阶段级归因 | Observe / measure first | 单一 upstream outlier 不阻塞 |
| ISSUE-029 | E2E-RB-05：Match reason 把 CF-002 的“课程”作用域传播到独立 CF-003“团队数据展示作业” | post-028/032 runtime Match 已验证原 contamination 与等价 paraphrase 为 0；仍等待完整链 closure evidence | **Open / P1 / Fix Verified at Match Runtime / Closure Pending Full-chain** | **是** |
| ISSUE-030 | SG-E fixed `{0,20}` window 错误拒绝包含完整合法 Candidate positive clause 的 evidence boundary | bounded structure fix 本地 Gate 通过；post-028/032 未到达可裁决 SG-E 情形 | **Open / P1 / Local Fix Verified / E2E Inconclusive / Release Gate Blocker** | **是** |
| ISSUE-031 | Recommendation 把 `MI-004（已满足）` 的 status 错归给后置 partial MI，并漏建模 `部分匹配` | 改为 parenthetical owner、显式 MI group、exact requirement、single structured ref；真实歧义 fail-closed；R31-1～R31-16、full 451/451 PASS | **Open / P1 / Local Fix Verified / New Full-chain E2E Pending / Release Gate Blocker** | **是** |
| ISSUE-032 | runner 将 missing diagnostics 聚合为 repair/fallback 0、未运行 invariants 判为 pass、未调用 stage 省略且 safeFailure 口径不一致 | 显式 stage ledger、known/unknown/not_run、invariant state 与 acceptance capability 已在 post-028/032 E2E 验证；等待完整链 closure | **Open / P1 / E2E Verified / Closure Pending Full-chain** | **是** |
| ISSUE-033 | Match repair 将 absence of evidence 持续改写为 unsupported negative claim | post-restabilization runtime initial 被拒绝、repair 改为 domain/responsibility unknown、cross-dimension reuse=0，employment unmet 保留 | **Open / P1 / Fix Verified at Repair Runtime / Closure Pending** | **是** |
| ISSUE-034 | supported formal-work relation false positive 与 sibling relation leakage | runtime 合法 employment relation 未拒绝，非法 domain/responsibility relation 未进入 repaired path | **Open / P1 / Fix Verified at Relation Runtime / Closure Pending** | **是** |
| ISSUE-035 | explicit-negative CF-004 因 experience tag + 产品 anchor 被 `explicitSameDimensionPositiveFacts` 误认 domain positive | internal polarity classifier + positive-role guard；E35-1～10 与 exact repair replay PASS | **Open / P1 / Local Fix Verified / E2E Pending / Release Gate Blocker** | **是** |
| ISSUE-036 | `仅参与部分工作` 的 generic noun 被 M-K 裸 `工作` regex 误认 employment_type | bounded phrase classifier；claim/evidence 两侧同一 ownership 语义；M36-1～12 与 exact replay PASS | **Open / P1 / Local Fix Verified / E2E Pending / Release Gate Blocker** | **是** |
| OBS-006 | final full-chain 中 Personalized Greeting repair + safe fallback 4/6（Phase 1 fallback 0/6） | 均安全，无 Candidate hallucination released；显著高于 Phase 2.3 isolated baseline 0/36 | Observe；ISSUE-029 review 后复评 | 当前非独立 blocker |

## 2. Robustness 与 Safe Failure Plan

- 明确区分：语法/长度/控制字符类 invalid input、语义稀疏但合法输入、evidence 损坏、模型 invalid output。
- 不 silent truncation；超限返回清楚的 400；evidence 不可验证或 repair 后仍失败返回 502；timeout 保持 504。
- partial copy/paste 若满足输入 Contract，允许以 unknown 表达缺失，不虚构缺口；无法建立可信 evidence 时 fail-closed。
- E2E runner 负责 pipeline stop semantics：JD/Profile 失败不进入 Match；Match 失败不进入 Recommendation/Strength/Greeting；Strength/Gap 失败是否允许 Greeting 仅按已冻结 Greeting request Contract 决定，不把 `null` 当空成功数据。

## 3. Cross-module Invariants

- X-A Candidate Truth：Candidate claim 可追溯 CF → PF。
- X-B JD Truth：Job claim 可追溯 validated JD evidence。
- X-C Status Stability：Recommendation / Gap / Greeting 不改写 Match status。
- X-D Unknown Stability：unknown 不变 unmet、deficiency 或 Candidate fact。
- X-E Negative Evidence Stability：counterEvidence 不被下游写成 met。
- X-F Modifier Integrity：无来源不得升级 frequency/intensity/duration/scope/quantity/certainty。
- X-G Waiver Integrity：无 waiver evidence 不生成 waiver。
- X-H Candidate Semantic Preservation：ownership/proficiency/duration/course/team 限定不升级。
- X-I Reference Continuity：REQ/MI/CF/PF/JD evidence 引用连续。
- X-J No Circular Truth：Recommendation/Strength/Gap 不反向成为 Candidate Fact 或 Match truth。

## 4. Phase 2 End-to-End Robustness Suite

本阶段冻结 `E2E-RB-01～08 × 1`，输入必须从 raw JD + raw Profile 起步，依次调用 JD → Profile → Match → Recommendation → Strength/Gap → Greeting；不得用预校验下游 fixture 冒充 full-chain。

| Case | 目的 |
| --- | --- |
| E2E-RB-01 | High Match，全链正常 |
| E2E-RB-02 | Hard Unmet 的 status/tone/gap 一致性 |
| E2E-RB-03 | Unknown-heavy 不漂移 |
| E2E-RB-04 | Minimal Profile / information gap |
| E2E-RB-05 | Course + Team + Limited Proficiency 全链不升级 |
| E2E-RB-06 | JD + Profile prompt injection 隔离 |
| E2E-RB-07 | 接近允许上限且不 silent truncation |
| E2E-RB-08 | Malformed / unsupported input safe failure |

这不是 Phase 2.5 的 14 TC × 3 Final Acceptance。

## 5. Metrics、Limits 与 Evidence

- 分开记录 `profileRepairRate`、`matchRepairRate`、`recommendationRepairRate`、`strengthGapRepairRate`、`personalizedGreetingRepairRate`、`personalizedGreetingSafeFallbackRate`、`phase1GreetingSafeFallbackRate` 与 `requestFallbackRate`。
- 各生成阶段记录 min/average/median/p95（样本足够时）/max、upstream attempts、repair、timeout。
- 当前输入 implementation limit：JD 12,000；Profile 12,000。两者均不得 silent truncation。
- 当前 output budget：JD/Profile 4,096；Match 8,192；Recommendation 4,096；Strength/Gap 8,192；Greeting 4,096 tokens。
- 当前 timeout：JD/Profile 60s；Match/Recommendation/Strength/Gap/Greeting 90s。
- 正常产品响应不得泄漏 raw model output；完整 rejected evidence 只允许 acceptance diagnostics/artifact。

## 6. Phase 2.4 Gate

- Q-A Backlog Disposition Complete
- Q-B Cross-Module Integrity（X-A～X-J）
- Q-C End-to-End Integration
- Q-D Safe Failure
- Q-E Repair/Fallback Observability
- Q-F Evidence Auditability
- Q-G Modifier/Waiver Regression
- Q-H Upstream Regression
- Q-I Error/Input Integrity
- Q-J No New P0/P1

## 7. Final Static / Integration Evidence

### ISSUE-028 / ISSUE-031 bounded completion（2026-08-11）

- starting baseline：`4ec6cb499a1db0c2cbff4a3e8fe4d792b6b666e0`；仅修改 Recommendation validator/evidence adapter 与相应测试、文档；
- ISSUE-028：Recommendation R-C 结构化 `validationLayer/validationCode/rule/matchItemRefs` 由 validator 直接产生并通过专用 serializer 保存；不从 message 猜测，不可靠时 `rejectedItem=null`，production response 不泄漏；
- ISSUE-031：删除 status-to-MI 字符距离猜测；支持 `MI（status）` owner、`status（MI）`、显式 MI group、partial status、exact requirement 与单 ref fallback；真正歧义 fail-closed；
- E28-R1～R8、R31-1～R31-16 全绿；focused 79/79、authorized targeted 261/261、full 451/451、lint/build/diff PASS；模型调用 0、E2E 0；
- 工程建议 ISSUE-028 `LOCAL COMPLETION VERIFIED`、ISSUE-031 `LOCAL FIX VERIFIED`；Phase 2.4 仍 BLOCKED，等待 Product Owner / QA 决定是否授权新的 full-chain E2E。完整记录见 `docs/PHASE-2-4-ISSUE-028-031-COMPLETION.md`。

- implementation commits：`30012f6` → `0d28da6` → `ce745ac` → `62a29a1` → `679268a`；失败、stale-server、targeted 与 final artifacts 全部保留。
- automated regression：350/350 PASS；lint PASS；production build PASS。
- targeted：RB-01/05/07 在 `ce745ac` 1/1；RB-06 在 `62a29a1` 1/1；RB-03 在 `679268a` 1/1。
- final `E2E-RB-01～08 ×1`：7/8；完整链 6；RB-08 预期 400；RB-05 Strength/Gap 502；上游失败后下游调用 0；timeout 0。
- final latency（ms）：JD avg 6,249/max 7,905；Profile avg 2,370/max 3,092；Match avg 3,445/max 5,847；Recommendation avg 2,192/max 2,775；Strength/Gap avg 3,510/max 5,695；Greeting avg 3,011/max 4,609；完整链总耗时 avg 20,790/max 24,049；样本不足 20，不报告 p95。
- repairs：Profile 0/7；Match 0/7；Recommendation 0/7；Strength/Gap 3/7；Personalized Greeting 4/6；Personalized Greeting safe fallback 4/6；Phase 1 Greeting fallback 0/6；overall request fallback 4/8（或 greeting-stage 4/6）。
- OBS-002：projection correction 6 次 / 4 of 7 Profile requests，deterministic canonicalization 4；完成链未见 tag 导致的错误 Match status，维持 Observe。
- Evidence：Profile/Recommendation/Strength-Gap/Greeting rejected raw 为 acceptance-only body，header/正常产品响应不含 raw；final RB-05 的 Profile/Match/Recommendation context 与 SG initial/repair rejection 均可由单 artifact 审计。

## 8. Gate Result / Open Risks

| Gate | Result | Evidence |
| --- | --- | --- |
| Q-A | PASS | 所有 carry-over 与新项有 disposition |
| Q-B | **FAIL** | ISSUE-028～034 尚未完成 Product Owner / QA closure；ISSUE-033/034 仅有 local deterministic evidence |
| Q-C | **FAIL** | final suite 7/8，RB-05 未完成 |
| Q-D | PASS | malformed input 400；failure 后下游调用 0 |
| Q-E | PASS / quality risk | 指标可区分；OBS-006 需后续复评 |
| Q-F | CONDITIONAL PASS | 关键失败可审计；JD/Match rejected-output parity 仍是记录差距 |
| Q-G | PASS | completed chains unsupported JD modifier / waiver 0 |
| Q-H | PASS | 350/350、lint、build |
| Q-I | PASS | no silent truncation；limits/error mapping 通过 |
| Q-J | **FAIL** | release-blocking P1 ISSUE-028～034 仍 OPEN；Phase 2.5 未授权 |

当前 Gate：**FAIL / STOP & ESCALATE / PHASE 2.4 BLOCKED / NOT READY FOR PHASE 2.5**。ISSUE-033/034 bounded stabilization 已取得 local deterministic evidence，但没有 runtime/E2E closure evidence；不得自行运行 RB-05、关闭 Issue、授权 Phase 2.5 或降低 Gate。下一步仅能等待 Product Owner / QA Review 与新的明确 E2E 授权。

## 9. ISSUE-029 Bounded Stabilization Result（2026-08-11）

- 实现 deterministic per-CF qualifier ownership，覆盖 scope / experience type / duration / frequency / intensity / quantity / certainty / ownership / proficiency / responsibility；同一 CF positive control 保留原 qualifier。
- Match acceptance diagnostics 补齐 initial rejected raw、validation issues、repair raw 与 repair acceptance/rejection；完整 raw 仅进入 acceptance body/artifact。
- static：47/47 ISSUE-029/Match focused、259/259 targeted、363/363 full regression、lint/build PASS。
- RB-05 三次独立 artifact 均保留且未覆盖：`rerun` 在 SG-B/SG-M 502；`rerun-2` 在 Match bounded repair 502；`rerun-3` 的 Match/Recommendation 200 且 cross-CF course scope 0，但 SG initial/repair 均被 SG-E 拒绝并 502，Greeting 未调用。
- 当时 Gate 保持 Q-B/Q-C/Q-J FAIL；后续 forensic adjudication 已把 downstream SG-E failure 分离为 ISSUE-030。ISSUE-029 当前为 Fix Implemented / Local Verification Pass / Final E2E Verification Pending；完整历史证据见 `PHASE-2-4-ISSUE-029-STABILIZATION.md`。

## 10. ISSUE-030 Bounded Stabilization（2026-08-11）

- Product Owner / QA 接受 SG-E forensic adjudication：rerun-3 initial/repair 均为 Classification B — SG-E False Positive；原 ISSUE-029 contamination NOT OBSERVED；
- 建立 `ISSUE-030 — SG-E Evidence Boundary False Positive on Valid Long Clause`（P1 / OPEN / Release Gate Blocker）；
- bounded fix 仅修改 Strength/Gap deterministic evidence-boundary recognition，不修改 Prompt、Contract、Match 或其他产品模块；
- T1～T10、83/83 targeted、373/373 full、lint/build 均 PASS；
- 唯一一次 post-fix RB-05 写入 `phase-2-4-issue-030-rb-05-post-fix.json`，但在 JD 阶段 83 ms 返回 503 `AI_SERVICE_UNAVAILABLE`，下游调用 0；未到达 SG-E，按 Gate 不 rerun；
- 工程建议 ISSUE-030 `FIX NOT VERIFIED`、Phase 2.4 仍 BLOCKED。详细 evidence 见 `PHASE-2-4-ISSUE-030-STABILIZATION.md`。

## 11. ISSUE-029 Restabilization + ISSUE-031 Bounded Stabilization（2026-08-11）

- Replacement RB-05 正式证明原 ISSUE-029 guard 可被 `candidateFactRefs=[]` 绕过：raw-to-final 映射不删除 refs，空 refs Candidate factual reason 由原 validator 接受；新增 `M-CANDIDATE-LINEAGE` 后，Candidate factual assertion 必须由引用 CF 语义支持，空 refs 仅允许 evidence absence / unknown boundary；原逐 CF qualifier ownership 保留为第二层；
- 新建 ISSUE-031：旧 Recommendation validator 将同一逗号 unit 内 MI-004 的“已满足”错误归给 MI-003；status phrase 现按显式 MI、exact requirement、clause locality 与单一 structured ref 绑定，歧义 grouped phrase fail-closed；
- M1～M10、R1～R10 与 mock repair preservation PASS；focused 93/93、targeted 184/184、full 394/394、lint/build/diff check PASS；ISSUE-030 implementation 未修改；
- 当前仍为 Phase 2.4 BLOCKED。只有固定本 implementation commit 后，才允许一次 post-029/031 RB-05；不得追加 stochastic sampling，不得进入 Phase 2.5。

## 12. Post-029/031 RB-05 Result（2026-08-11）

- 授权基线：`main / 044d9353de4c6622de1b1bb86e494d39df2d67ff`；frozen JD/Profile length 与 SHA-256 均与历史一致；
- 唯一运行：JD 200 / 8,716 ms；Profile 200 / 2,052 ms；Match 502 `AI_OUTPUT_INVALID` / 10,395 ms；Recommendation、Strength/Gap、Greeting `not_called`；总已执行阶段 latency 21,163 ms；failure 后下游调用 0；
- artifact 未包含 Match acceptance diagnostics，initial/repair rejected raw、validation reason、repair/attempt 与 truncation 状态不可恢复；runner counters 的 repair=0 仅表示 diagnostics 缺失，不能证明未 repair；底层 Match failure 归类 `unknown`，同时存在确定的 rejected-evidence integrity regression；
- ISSUE-029 / ISSUE-031 / ISSUE-030 均建议 `VERIFICATION INCONCLUSIVE`；Phase 2.4 仍 BLOCKED；原始 artifact 独立保存，未覆盖历史，未追加 rerun。

## 13. ISSUE-028 / ISSUE-032 Bounded Stabilization（2026-08-11）

- Product Owner / QA 将 ISSUE-028 reopen 为 P1 / multiple-layer gap，并建立 ISSUE-032 P1 QA Artifact Integrity blocker；授权基线 `4828fae…`，仅 deterministic implementation/tests；
- 正式 runner 在所有五个 Phase 2 generation route 上执行 acceptance capability probe；任一 route 未实际启用 capture 时，在业务调用前以 `ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE`、`modelCalls=0` fail-fast；
- Profile/Match/Recommendation/Strength-Gap/Greeting completion lifecycle 区分 provider/transport、length、empty、content filter、parse、schema、semantic validation 与 repair；有 raw 则保存 acceptance-only evidence，无 raw 则显式记录；
- Match 使用独立 validation layer/code/rule/path/item/dimension evidence，不再依赖 SG parser；普通 production response 仍不暴露 raw；
- runner artifact 显式保存未调用 stages、unknown/not_run/known zero、invariant audit state、ledger-derived downstream calls，并统一 safeFailure；
- deterministic evidence：focused 91/91、ISSUE-029/030/031 targeted 148/148、full 429/429、lint/build/diff PASS，模型调用 0、RB-05 未执行；完整证据见 `PHASE-2-4-ISSUE-028-032-STABILIZATION.md`；
- 工程建议 ISSUE-028/032 `LOCAL FIX VERIFIED`，Phase 2.4 可申请新的 E2E verification authorization；在新授权前继续 BLOCKED，Phase 2.5 NOT AUTHORIZED。

## 14. Post-028/031 Completion RB-05（2026-08-11）

- authorization baseline：`main / 901c7b6f3e37990d11ac4534ab60d0c582547faa`；五路 acceptance capability、modelCallsBeforeBusinessExecution=0、frozen RB-05 length/SHA-256 全部通过；
- 唯一 model-backed run 0/1：JD 200 / 7,325 ms、Profile 200 / 2,463 ms、Match 502 / 10,624 ms；Recommendation/Strength-Gap/Greeting not_called；failure 后下游调用 0；
- Match initial 7 条 rejection issues，含被 M-K 正确拦截的 `课程->CF-004/CF-003` cross-CF contamination；repair 将 course contamination 清零，但仍生成 `无法满足独立负责`、`并非主导角色` 两条无 CF 独立支持的 negative upgrade并被 M-CANDIDATE-LINEAGE 正确拒绝；
- `与正式工作经验要求不符` 实际由 CF-004 与 JD requirement 共同支持，却被仅按 CF anchor 的 lineage guard 拒绝，记录为待 QA 裁决的 possible false-positive observation；它不是 terminal failure 的唯一原因；
- ISSUE-028/031/030 均因对应下游未调用而 INCONCLUSIVE；ISSUE-029 guard safety preservation 无回归但无 Final accepted Match；ISSUE-032 state semantics PASS；
- artifact `phase-2-4-post-028-031-completion-rb-05.json` 独立保存，SHA-256 `ecdcbe2e612d2f5fd9d77eba03d3ad8548baa3ec32fefb2016e231d4ab2a64b3`；严格未 rerun。Phase 2.4 仍 BLOCKED，Phase 2.5 NOT AUTHORIZED。

## 15. ISSUE-033 / ISSUE-034 Bounded Stabilization（2026-08-11）

- starting baseline：`main / 717f7a272996fd8f40554a854815ddfb40876c40`；无模型调用、无 RB-05；
- ISSUE-033 根因是 repair instruction 没有把 `M-CANDIDATE-LINEAGE` 的 unsupported negative 定向改写为 uncertainty boundary，导致模型用否定近义词保留 `无法满足独立负责` / `并非主导角色`；Match core/repair prompt v1.2 已补齐明确 counter-evidence、absence boundary 与 BAD/GOOD examples；
- ISSUE-034 在 validator 修改前完成 adjudication：CF-004/PF-004/Raw Profile 的明确 formal-work negative 与 JD formal-work requirement 支持 `与正式工作经验要求不符`，结论 `FALSE POSITIVE CONFIRMED`；
- bounded validator fix 只接受 `employment_type + unmet + all counter + explicit negative + exact JD evidence + formal/fulltime/internship semantic match` 的 requirement-level relation；具体项目属性投射、其他 dimension、unknown/partial 与原 ISSUE-029 course contamination 继续拒绝；
- G33-1～G33-10、L34-1～L34-10 PASS；focused 78/78、authorized targeted 281/281、full 471/471、lint/build/diff PASS；
- 工程建议 ISSUE-033/034 `LOCAL FIX VERIFIED`。Phase 2.4 仍 BLOCKED；只可请求 Product Owner / QA 授权一次新的 full-chain E2E，不自行执行或进入 Phase 2.5。完整记录见 `PHASE-2-4-ISSUE-033-034-STABILIZATION.md`。

## 16. Post-033/034 Full-chain RB-05（2026-08-12）

- authorization baseline：`main / cc9fa37608b532a9fe48927bf4480ff1da3b6a75`；五路 capability、frozen JD/Profile length/SHA-256 与 modelCallsBeforeBusinessExecution=0 全部通过；
- exactly one model-backed run 0/1：JD 200、Profile 200、Match initial/repair semantic validation 502；其余三阶段 not_called，downstream calls after failure=0，invariant not_run/passed=null；
- initial course→CF-004 contamination 被 lineage/M-K 正确拒绝；repair course contamination=0，但把 CF-004 formal-work negative 传播成 responsibility `与独立负责要求直接冲突`，由 lineage/M-K 正确拒绝；
- employment_type 的 supported CF↔JD relation 未被拒绝，但 domain sibling relation 也未产生 issue；无 Final Match，ISSUE-034 narrow runtime Gate 不成立；
- 工程建议 ISSUE-033/034 `FIX NOT VERIFIED`、ISSUE-029 preservation PASS、ISSUE-028/030/031 inconclusive、ISSUE-032 preservation PASS；Phase 2.4 仍 BLOCKED；
- artifact `phase-2-4-post-033-034-rb-05.json`，SHA-256 `f4b874ef7f9d9a72ba211cc3c65eee2b434f510497a866b4870ce65448ef0f8c`；strictly no rerun。完整证据见 `PHASE-2-4-POST-033-034-RB-05.md`。

## 17. ISSUE-033 / ISSUE-034 Bounded Restabilization（2026-08-12）

- Product Owner / QA 正式裁决 explicit negative 与 relational conclusion 必须 dimension-local；不新建 ISSUE-035，仅 restabilize ISSUE-033/034；
- root cause：v1.2 repair 未明确禁止 sibling negative reuse；domain relation clause 未进入旧 Candidate assertion selection，generic anchor 又允许 CF-004 的“数据产品”支持 domain，最早在 relation exception 之前漏检；
- Match prompt/repair v1.3 加入逐 dimension BAD/GOOD guidance；validator 强制 relation clause 进入检查、禁止 relation generic-anchor bypass，并要求 employment relation target 自身保留正式工作/全职/实习 qualifier；
- G33-1～20、L34-1～20 与 exact saved initial/repair raw replay PASS；focused 100/100、targeted 303/303、full 493/493、lint/build/diff PASS；model calls=0、RB-05=0；
- 工程建议 ISSUE-033/034 `LOCAL FIX VERIFIED`；正式 Phase 2.4 仍 BLOCKED，等待 Product Owner / QA Gate Review。完整证据见 `PHASE-2-4-ISSUE-033-034-RESTABILIZATION.md`。

## 18. Post-033/034 Restabilization RB-05（2026-08-12）

- authorization baseline：`main / eb10e8a46096265cbc48475c0cf7869dae2e6b01`；五路 acceptance capability、frozen JD/Profile length/SHA-256 与 modelCallsBeforeBusinessExecution=0 全部通过；
- 唯一运行 0/1：JD 200、Profile 200、Match 502；Recommendation/Strength-Gap/Greeting not_called；downstream calls 0；invariants not_run/passed=null；
- initial CF-004→domain/responsibility negatives 被正确拒绝；repair 清除两类 cross-dimension negative，但被 `unknown omitted explicit same-domain positive evidence: CF-004` 与 `M-K experience_type:工作->CF-003` 拒绝；
- 静态证据确认前者把 CF-004 employment negative 错认成 domain positive，是 deterministic validator false positive；无 Final Match；
- 工程建议 ISSUE-033 `FIX NOT VERIFIED`、ISSUE-034 `VERIFICATION INCONCLUSIVE`；ISSUE-029/032 preservation PASS，ISSUE-028/030/031 inconclusive；Phase 2.4 仍 BLOCKED；
- artifact：`phase-2-4-post-033-034-restabilization-rb-05.json`；strictly one model-backed execution，additional reruns=0。完整证据见 `PHASE-2-4-POST-033-034-RESTABILIZATION-RB-05.md`。

## 19. ISSUE-035 / ISSUE-036 Deterministic Stabilization（2026-08-12）

- Product Owner / QA 裁决 ISSUE-033=`FIX VERIFIED AT REPAIR RUNTIME`、ISSUE-034=`FIX VERIFIED AT RELATION RUNTIME`，并新建 P1 release blockers ISSUE-035/036；starting HEAD=`2cff5da…`；
- ISSUE-035 root cause：unknown positive-existence helper 只看 experience tag + domain anchor，未看 polarity；现复用 explicit-negative/boundary taxonomy，只让 positive fact 进入集合，并拒绝 counter/boundary CF 被标 positive；
- ISSUE-036 root cause：experience_type regex 含裸 `工作`，support 又用 substring；现以 bounded `在/正式/全职/实习工作`、`工作中/期间/经历/经验/岗位/项目` 识别，generic task noun 不触发，工作项目按 frozen Case B 保持 fail-closed；
- E35-1～10、M36-1～12、exact saved initial/repair replay PASS；focused 110/110、targeted 327/327、full 517/517、lint/build/diff/scope/secret PASS；model calls=0、RB-05=0；
- 工程建议 ISSUE-035/036 `LOCAL FIX VERIFIED`；Phase 2.4 仍 BLOCKED，等待 Product Owner / QA Gate Review。完整证据见 `PHASE-2-4-ISSUE-035-036-STABILIZATION.md`。
