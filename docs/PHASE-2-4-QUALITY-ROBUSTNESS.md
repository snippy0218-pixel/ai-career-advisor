# Phase 2.4 Quality & Robustness

> 状态：AUTHORIZED / IN PROGRESS  
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
| ISSUE-017 | requirement extraction completeness；TC-06 片段化 2 次、preferred 独立从句遗漏 1 次 | M-J 只覆盖 Phase 1 已输出 REQ，不能发现上游遗漏；当前 normalization 只拆分模型已经提供的整句，遗漏仍可能发生 | Fix：窄范围、确定性 compound-clause completeness + targeted tests | 是：hard 遗漏或系统性遗漏阻塞 |
| ISSUE-019 | Phase 1 `safeGreeting` 历史 fallback 15/33≈45.5%，主要影响自然度 | Phase 2.3 personalized repair/fallback 均 0，指标不可混合；无 Candidate Profile 仍走 Phase 1 | Observe / targeted reassessment；除非价值明确，不动冻结 Phase 1 greeting | 当前不阻塞；若信息损失/幻觉则阻塞 |
| ISSUE-021 | 无 JD 依据增加 frequency/intensity/duration/scope/quantity/certainty；历史 13 次 | Contract 已冻结 Modifier Inference Contract；现有实现仅对 growth 与部分 Candidate modifier 有局部校验，跨模块不完整 | Fix：共享 deterministic modifier integrity，覆盖用户可见生成层 | 是：任何真实 modifier upgrade 阻塞 |
| ISSUE-023 | TC-09 1/3：模型同时输出拆分项与整句，服务端二次拆分后产生重复 | 当前 `prepareAnalysis` append-only，未做最终 requirement 去重；机制仍存在 | Fix：基于 type/content/evidence 的稳定去重 + regression | 否，除非影响 hard/type/evidence |
| ISSUE-025 | Candidate Profile fact completeness / silent omission | Canonical CF/PF ledger、24-run matrix 与 downstream evidence 已关闭该问题 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-026 | unsupported hard waiver | Recommendation R-K 与 downstream waiver guard 已关闭 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-027 | transferable Strength validator / Candidate claim upgrade stability | SG-M、post-fix 51 requests repair 0，已正式关闭 | Closed / regression only；无新证据不 reopen | 回归则阻塞 |
| ISSUE-028 | rejected AI output evidence preservation gap | Strength/Gap 与 Greeting 已完整保存 acceptance-only rejected evidence；Profile/Match/Recommendation 的早期诊断层级不完全等同 | Closed；保留现有回归点。早期模块差距记录为审计债，不做无 Gate 收益的全量重构 | 关键失败不可审计时阻塞 |
| OBS-002 | Semantic Tag projection correction：11 corrections / 7 of 24 requests，PF-I 100% | correction 不改 canonical statement；需检查 downstream Match、repair、latency | Observe | 否，除非影响 truth/status |
| OBS-005 | Phase 2.3 long-tail latency：average≈3,656 ms、max 37,268 ms | 尚无阶段级归因 | Observe / measure first | 单一 upstream outlier 不阻塞 |

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

当前 Gate：IN PROGRESS。全部通过后只能建议 `Phase 2.4 PASS / Ready for Phase 2.5`，等待 Product Owner / QA 决策。

## 7. Test Results / Open Risks / Gate Recommendation

待实现与验证后填写。任何 Stop & Escalate 触发均保留失败证据，不以新成功覆盖。
