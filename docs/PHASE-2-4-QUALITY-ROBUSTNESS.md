# Phase 2.4 Quality & Robustness

> 状态：STOP & ESCALATE / BLOCKED ON ISSUE-029 + ISSUE-030
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
| ISSUE-028 | rejected AI output evidence preservation gap | Strength/Gap 与 Greeting 原有机制回归通过；本轮因真实 QA 失败将同级 acceptance-only rejected raw 扩展到 Profile/Recommendation；JD/Match 仍无同级 rejected raw，但 final 关键 Match success context 已由 runner 保存 | Closed；保留 regression。JD/Match parity 继续记录，不因无实际 rejected-output blocker 做全量重构 | 关键失败不可审计时阻塞 |
| OBS-002 | Semantic Tag projection correction：11 corrections / 7 of 24 requests，PF-I 100% | correction 不改 canonical statement；需检查 downstream Match、repair、latency | Observe | 否，除非影响 truth/status |
| OBS-005 | Phase 2.3 long-tail latency：average≈3,656 ms、max 37,268 ms | 尚无阶段级归因 | Observe / measure first | 单一 upstream outlier 不阻塞 |
| ISSUE-029 | E2E-RB-05：Match reason 把 CF-002 的“课程”作用域传播到独立 CF-003“团队数据展示作业” | bounded stabilization 已实现；rerun-3 contamination NOT OBSERVED；等待 post-ISSUE-030 RB-05 full chain | **Open / P1 / Fix Implemented / Local Verification Pass / Final E2E Verification Pending** | **是** |
| ISSUE-030 | SG-E fixed `{0,20}` window 错误拒绝包含完整合法 Candidate positive clause 的 evidence boundary | bounded structure fix 与 373/373、lint/build PASS；唯一 post-fix RB-05 在 JD 503 停止，未到达 SG-E | **Open / P1 / Fix Implemented / Local Verification Pass / E2E Verification Blocked / Fix Not Verified / Release Gate Blocker** | **是** |
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
| Q-B | **FAIL** | ISSUE-029 / ISSUE-030 均等待同一次 post-fix RB-05 full-chain verification |
| Q-C | **FAIL** | final suite 7/8，RB-05 未完成 |
| Q-D | PASS | malformed input 400；failure 后下游调用 0 |
| Q-E | PASS / quality risk | 指标可区分；OBS-006 需后续复评 |
| Q-F | CONDITIONAL PASS | 关键失败可审计；JD/Match rejected-output parity 仍是记录差距 |
| Q-G | PASS | completed chains unsupported JD modifier / waiver 0 |
| Q-H | PASS | 350/350、lint、build |
| Q-I | PASS | no silent truncation；limits/error mapping 通过 |
| Q-J | **FAIL** | release-blocking P1 ISSUE-029 与 ISSUE-030 尚未完成 Final E2E verification |

当前 Gate：**STOP & ESCALATE / PHASE 2.4 BLOCKED / NOT READY FOR PHASE 2.5**。ISSUE-029 已实现但 post-fix audit 因 JD 503 为 indeterminate；ISSUE-030 deterministic/local Gate PASS，但 E2E 未到达 SG-E。唯一一次 post-fix RB-05 已消耗且不得 rerun；当前只允许证据收尾，不得继续产品修改或进入 Phase 2.5。

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
