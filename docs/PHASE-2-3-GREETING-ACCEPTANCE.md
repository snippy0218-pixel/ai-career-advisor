# Phase 2.3 Acceptance — Personalized Greeting Core

> 日期：2026-08-10
> 状态：**AUTHORIZED / IN PROGRESS**
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

尚未执行。Phase 2.3 不得在静态 Gate 全绿前调用真实模型。
