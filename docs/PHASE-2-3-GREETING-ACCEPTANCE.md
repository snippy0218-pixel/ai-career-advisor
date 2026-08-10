# Phase 2.3 Acceptance — Personalized Greeting Core

> 日期：2026-08-10
> 状态：**ENGINEERING EVIDENCE COMPLETE / AWAITING PRODUCT OWNER & QA FINAL GATE**
> Gate 边界：本阶段只生成一条 Personalized Greeting；不自行宣布 PASS，不进入 Phase 2.4。

## 1. Scope

- 输入：validated `candidate-profile-v2`、`match-core-v1`、`recommendation-core-v1`，以及可选 validated `strength-gap-core-v1`；
- 输出：独立 `personalized-greeting-v1`，用于 HR 首次沟通的一条简洁消息；
- 禁止：简历改写、Cover Letter、面试回答、多轮 HR Agent、自动发送、招聘网站接入、模板库、多人格风格、score、confidence；
- runtime model 保持 `deepseek-v4-flash`；最多一次有界 repair。

## 2. Fact Sources / Selection

- Candidate Claim 只能来自 canonical Candidate Fact，且 sourceType 仅允许 `profile_stated / normalized_stated`，必须沿 `CF → PF → Raw Profile` 追溯；
- Match 只用于选择与岗位最相关的真实 CF，并提供 `MI → JD Evidence` relation；Recommendation 只控制 tone；Strength 只可帮助排序且必须回溯 CF；Gap 只作为禁止声明边界；
- 选择最多 1～2 个 Candidate Fact clusters；不得使用 unknown/unmet 反向制造 Candidate Claim；Derived/transferable relation 只能作为有限连接句；
- internal Raw/Final Schema 必须记录 `candidateFactRefs[] / matchRefs[] / strengthRefs[] / jdEvidence[] / greeting`，UI 可只展示 greeting。

## 3. Candidate Claim Contract

- 允许语义保持的压缩；禁止 proficiency、ownership、experience type、duration、scope、quantity、certainty 升级；
- `协助≠负责`、`参与≠主导`、`团队≠个人`、`课程项目≠工作经验`、`实习≠全职`、`了解≠熟练`；
- 所有数字必须存在于 CF；JD 数字不得转移为 Candidate 数字；team achievement 必须保留团队归属；
- `profile_inferred`、Derived Observation、Strength statement、Recommendation summary、JD requirement 均不得冒充 Candidate Fact。

## 4. Recommendation Tone / Waiver

- `priority / try`：允许正常积极沟通；
- `cautious`：禁止“高度匹配/完全符合/非常契合”等覆盖风险的措辞；
- `not_recommended`：仍允许生成，但只能陈述真实相关经历，不声称整体匹配，不主动罗列全部 Gap，不编造 waiver；
- ISSUE-026 R-K 继续适用：无同一 MI 的 JD 明示 waiver evidence，不得声称能力/经验可替代、弥补或豁免 hard requirement。

## 5. Repair / Safe Fallback

- repair 触发：Schema/reference invalid、unsupported claim/number、semantic upgrade、JD→Candidate、team→individual、course→work、unknown→fact、tone/waiver violation；
- 最多一次 repair；仍失败时进入 deterministic Personalized Safe Fallback；fallback 的 job title、CF 与 relation 必须全部 validated；
- 找不到安全相关 CF 时退回 Phase 1 non-personalized safe greeting，不得为维持 personalized 状态制造事实；
- 指标独立记录 `personalizedGreetingRepairRate`、`personalizedGreetingSafeFallbackRate`、`phase1GreetingFallbackRate`；
- initial / repair rejected output 延续 ISSUE-028 evidence capture，必须能完成 `CF → generated claim → rejected fragment → validator rule` 审计，artifact 不保存 secrets。

## 6. Hard Gates

- PG-A Candidate Fact Integrity：unsupported Candidate claim = 0；
- PG-B PF Evidence Integrity：Candidate claims 100% traceable；
- PG-C Semantic Preservation：proficiency / ownership / duration / experience type upgrade = 0；
- PG-D Cross-source Isolation：JD → Candidate contamination = 0；
- PG-E Quantification Integrity：unsupported number = 0；
- PG-F Team Attribution：team → individual = 0；
- PG-G Unknown Integrity：unknown → Candidate claim = 0；
- PG-H Match Consistency：不与 known unmet/unknown 矛盾；
- PG-I Waiver Integrity：ISSUE-026 semantics 保持；
- PG-J Recommendation Tone Integrity：level 对应 tone 合规；
- PG-K Reference Integrity：100%；
- PG-L Final Schema：100%；
- PG-M Repair / Fallback Safety：任何用户可见 Greeting 均 validated。

## 7. Frozen Test Matrix

PG-TC-01 High Match Personalized；PG-TC-02 Minimal Profile；PG-TC-03 Proficiency Preservation；PG-TC-04 Ownership Preservation；PG-TC-05 Course Project；PG-TC-06 Team Achievement；PG-TC-07 Unknown Requirement；PG-TC-08 Hard Unmet / Cautious；PG-TC-09 Not Recommended；PG-TC-10 Numeric Hallucination；PG-TC-11 Prompt Injection；PG-TC-12 No Safe Personalized Fact。

静态测试至少覆盖 refs、claim preservation、ownership、proficiency、course/work、team、numbers、unknown、waiver、tone、safe fallback、Phase 1 fallback compatibility、repair、fail-closed、injection。

## 8. Required Execution

1. static PG tests + full regression + lint + build；
2. 固定 implementation commit；
3. 同一 commit PG-TC-01～12 ×1 preflight；
4. 仅 preflight PG-A～PG-M 全绿后执行同一 commit 12×3 clean matrix；
5. 六维 internal rubric + Claim Fidelity：平均 ≥4.0、最低单项 ≥3.0，Hard Gate 失败不得由平均分覆盖；
6. 持久化 artifacts，更新本文/Handoff/更新日志，提交 evidence commit，停止等待 Product Owner / QA Final Gate。

## 9. Stop & Escalate

Candidate hallucination 稳定出现、semantic/course-work/team/unknown/tone 无法可靠阻止、repair/fallback 必须降低 truthfulness、rejected evidence 无法保存、上游回归或 runtime model 明显不支撑 Contract 时立即停止。不得降低 PG-A～PG-M。

## 10. Current Evidence

### 10.1 Architecture / fixed implementation

- `personalized-greeting-v1` 独立于 Phase 1、Candidate Profile、Match、Recommendation 与 Strength/Gap；上游结构只读，服务层用序列化 snapshot 验证 immutability；
- `greeting-schema.ts` 负责 strict request/raw/final schema、确定性 fact selection、PG validator 与两个 fail-closed fallback；`greeting-prompt.ts` 只暴露被选择的 CF/PF/MI/JD/Strength 账本；
- `greeting-deepseek.ts` 固定 `deepseek-v4-flash`、temperature 0.1、JSON Output、一次上游 retry、最多一次有界 Greeting repair；任何失败最终只返回 validated deterministic fallback；
- `greeting-evidence.ts` 延续 ISSUE-028：initial/repair rejected raw、parsed output、fragment、validator rule，有界 12,000 字符并递归 scrub secrets；正常 API 不暴露 acceptance evidence；
- `POST /api/greeting/analyze` 与 `/greeting` 已实现；产品 UI 只展示可复制 greeting，不显示 diagnostics、score、confidence 或上游内部解释；
- 初始 implementation commit：`bce6280…`；prospective validator Case B 最小修复及最终固定 implementation commit：`b2751c0831f44cae0e5b4c2de461c5b3c551a258`。

### 10.2 Failure history / prospective correction

- 首次 production preflight 在 sandbox 内启动 server，12/12 最终安全但 11/12 进入 personalized fallback；artifact 保留为 `greeting-preflight-infrastructure-failure-01.json`，直接 endpoint 诊断确认 sandbox 无法联网，非模型/Contract 结论；
- 在可联网 server 上固定 `bce6280…` 重跑：12/12 最终安全，但 repair 10/12、personalized fallback 8/12；rejected initial/repair 共 20 stages，证据确认 Candidate facts 未升级，主要为 validator 要求结构化 relation statement 逐字出现在自然文案，以及把 JD relation target 误扫为 Candidate upgrade，定性为 prospective **Case B — Validator False Positive**；artifact 为 `greeting-preflight-failed-bce6280.json`；
- 最小修复不改变 Prompt、Raw/Final schema、PG-A/PG-C/PG-D 或 runtime model：取消 relation 文本逐字相等要求，仍要求 bounded relation、MI/JD trace；Candidate scanner 仅从“岗位/职责/要求 + bounded relation”上下文隔离可追踪 JD evidence，真实 JD→Candidate 转移负例仍被 PG-A/PG-C 拒绝；
- 一轮 runner 已切到 `b2751c0…` 但端口仍由旧 server 占用，故标为 `greeting-preflight-invalid-stale-server-b2751c0.json`，不计 Gate、不删除；随后显式停止旧 PID、确认端口释放并启动新 production process。

### 10.3 Static / regression

- Greeting targeted：3 files / 26 tests PASS；覆盖 refs、claim preservation、ownership、proficiency、course/work、team、numbers、unknown、waiver、tone、safe fallback、Phase 1 fallback compatibility、repair、fail-closed、injection、自然 wrapper 与 JD→Candidate 负例；
- final full regression：20 files / **333 tests PASS**；Phase 1、Phase 2.1、Phase 2.2A、Recommendation、Strength/Gap 均无自动化回归；
- `npm run lint` PASS；`npm run build` PASS；production build 包含 `/api/greeting/analyze` 与 `/greeting`。

### 10.4 Final preflight

- artifact：`docs/acceptance-artifacts/phase-2-3-greeting/greeting-preflight.json`；固定 commit `b2751c0…`；
- PG-TC-01～12 ×1：**12/12 HTTP 200，PG-A～PG-M 全 PASS**；
- 11 normal personalized generations；repair 0；personalized safe fallback 0；PG-TC-12 按 Contract 使用 Phase 1 non-personalized safe fallback 1；
- Candidate claim / semantic upgrade / JD contamination / unsupported number / team attribution / unknown / tone / waiver violation 全 0；平均 latency 1,659ms，max 2,732ms。

### 10.5 Final clean matrix

- artifact：`docs/acceptance-artifacts/phase-2-3-greeting/greeting-clean-matrix.json`；同一固定 commit `b2751c0…`、同一 12 fixtures、每例连续 3 次，不挑选；
- **36/36 HTTP 200，PG-A～PG-M 全 PASS**；33 normal personalized generations；repair 0/36；personalized safe fallback 0/36；PG-TC-12 预期 Phase 1 fallback 3/36；
- unsupported Candidate claim、semantic upgrade、JD contamination、unsupported number、team→individual、unknown contamination、match/tone/waiver violation 均 0；rejected stage 0；
- latency min 3ms、average 3,656ms、max 37,268ms；最大值为单次上游延迟，不伴随 HTTP/Schema/Hard Gate failure；
- 六维 internal rubric：Candidate Fact truthfulness 5.00、JD relevance 5.00、personalization 4.92（最低 4）、restraint 5.00、naturalness 5.00、HR first-contact usability 5.00；Claim Fidelity 5.00；所有维度最低 ≥4。

### 10.6 Metrics / ISSUE-019 comparison

- `personalizedGreetingRepairRate = 0/36 = 0%`；
- `personalizedGreetingSafeFallbackRate = 0/36 = 0%`；
- `phase1GreetingFallbackRate = 3/36 = 8.33%`，全部来自冻结 PG-TC-12 “No Safe Personalized Fact”的预期 fail-safe，不与 Phase 1 历史指标混算；
- ISSUE-019 历史 Phase 1 safeGreeting fallback 为 15/33 ≈45.5%；Phase 2.3 的两个新指标均为 0%，不修改 Phase 1 pipeline，也未放宽 Candidate Claim Contract。ISSUE-019 保持原 P2 backlog 状态，由 Product Owner / QA 决定后续处置。

### 10.7 Evidence preservation / gate recommendation

- clean preflight/matrix 无 rejected output；failed `bce6280…` preflight 的 20 个 rejected initial/repair stages 完整保留 raw/parsed/greeting/validation issues，runner artifact 补齐 CF/PF context；静态测试验证 API key scrub，artifact 反查真实 key 0 命中；
- 未发现新的 P0/P1；记录 non-blocking latency observation：clean matrix 单次 max 37,268ms，仍低于 90s Greeting deadline且未触发 retry/fallback；
- 未触发 Stop & Escalate：没有稳定 hallucination、无法阻止的 semantic/context/team/unknown/tone 错误、truthfulness 降级、evidence loss 或上游 regression；
- 工程建议：**Phase 2.3 Final Gate candidate = PASS**。本文件不自行宣布 PASS；当前停止在 Product Owner / QA Final Gate Review，Phase 2.4 仍 NOT AUTHORIZED。
