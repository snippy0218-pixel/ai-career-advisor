# Phase 2.2B-2 Acceptance — Strength + Gap Core

> 日期：2026-08-10
> 状态：**AUTHORIZED / IN PROGRESS**
> Gate 边界：本文只记录 Strength + Gap Core；不自行宣布 PASS，不授权 Personalized Greeting 或其他后续功能。

## 1. Scope 与事实基线

- 输入唯一事实源：validated `match-core-v1`；必要时只沿 `MI → CF → PF` 与 `MI → JD Evidence` 追溯；
- Recommendation 可作为最终 UI 并列结果，但不得成为 Strength / Gap 的事实来源；
- 禁止重新分析 Raw JD / Raw Profile，禁止新增或修改 Candidate Fact、Match status、requirementType 或 Recommendation；
- 输出目标：validated `strength-gap-core-v1`，包含 strengths、gaps、引用、有限 taxonomy 与 bounded suggested action；
- 禁止 score、confidence、greeting、简历改写、面试建议、学习计划、多岗位比较、自动投递。

## 2. Frozen Gate

- SG-A Strength Evidence Integrity；
- SG-B Strength Truthfulness；
- SG-C Direct Strength Status；
- SG-D Transferable Strength Integrity；
- SG-E Gap Type Integrity；
- SG-F Unknown Integrity；
- SG-G Hard Gap Counter-Evidence；
- SG-H Suggested Action Integrity；
- SG-I Reference Integrity；
- SG-J Source / Fact Isolation；
- SG-K Match / Recommendation Immutability；
- SG-L Final Schema。

## 3. Required Execution

1. SG-TC-01～12 静态测试；
2. regression / lint / build；
3. 固定 implementation commit；
4. SG-TC-01～12 ×1 preflight；
5. 仅 preflight 全绿后执行同一 commit 的 12×3 clean matrix；
6. 六维 internal rubric review；
7. 更新本文与 Handoff，提交 evidence commit，然后停止等待 Product Owner / QA Final Gate。

## 4. Evidence

待实现与验证后填写。所有失败与诊断 artifacts 必须永久保留，不覆盖、不挑样本。
