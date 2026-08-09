# Phase 2.2B-1 Acceptance — Recommendation Core

> 日期：2026-08-09
> 状态：**AUTHORIZED / IN PROGRESS**
> Gate 边界：本文只记录 Recommendation Core；不自行宣布 PASS，不授权 Strength/Gap 或 Phase 2.3。

## 1. Scope 与基线

- 输入：validated `match-core-v1`；Match Core 全程只读；
- 输出：validated `recommendation-core-v1`；等级仅为 `priority / try / cautious / not_recommended`；
- runtime model：`deepseek-v4-flash`；benchmark deferred / not required；
- 禁止字段与功能：confidence、score、strength、gap、greeting、简历建议、学习计划、多岗位比较；
- Phase 2.2A Final Gate baseline：`dabe3b513f7062b1ffdafd5cacc3b0eb5e939c08`。

## 2. Architecture

- `recommendation-schema.ts`：strict Raw/Final Schema、稳定 `MI-*` ledger、allowed-level eligibility、R-A～R-J Final validation；
- `recommendation-prompt.ts`：只读 Match ledger 与 allowed set；禁止重新判定 Match status 或创建事实；
- `recommendation-deepseek.ts`：独立 DeepSeek adapter、一次有界 Recommendation Repair、repair 后 fail-closed、Match Core immutability diagnostics；
- `/api/recommendation/analyze`：独立服务端入口，不修改 Match Core API；
- `run-phase-2-2b-recommendation-matrix.mjs`：RC-TC-01～10 preflight / clean matrix 的统一 runner。

## 3. Final Schema

Final 字段：`schemaVersion`、`matchSchemaVersion`、`allowedRecommendationLevels`、`recommendationLevel`、`summary`、`supportingMatchRefs[]`、`counterMatchRefs[]`、`limitations[]`、`questionsToConfirm[]`。每个 limitation/question 必须携带现有 `MI-*` 引用；不存在新的 JD/Candidate truth layer。

## 4. Deterministic Guardrails

- R-A Priority Eligibility；
- R-B Not Recommended Evidence；
- R-C Match Status Fidelity；
- R-D Unknown Preservation；
- R-E Hard Gap Explanation；
- R-F Preferred Isolation；
- R-G Reference / Evidence Integrity；
- R-H Final Schema；
- R-I Match Core Immutability；
- R-J No Fabricated Candidate/JD Facts。

Allowed-level 层只决定合法区间，不用简单计数公式替代模型判断。模型只能在合法集合内选择；所有 Final 输出再次做确定性验证。

## 5. Static Tests

- Recommendation 专项：32/32 PASS（十个 RC fixture、allowed levels、R-A～R-J 拒绝路径、一次 repair、repair 后 fail-closed、Match Core immutability）；
- 全量自动化：261/261 PASS（13 files）；
- ESLint：PASS；
- Next.js production build：PASS，`/api/recommendation/analyze` 正常纳入动态路由；
- Phase 1 / Phase 2.1 / Phase 2.2A 既有自动测试无回归。

## 6. RC-TC-01～10 ×1 Preflight

待执行。只有全部 Hard Gates PASS 才可进入 10×3 clean matrix。

## 7. 10×3 Clean Matrix

待 preflight PASS 后执行。

## 8. Human Content Scores

待 matrix 内容人工审阅后记录：等级合理性、Match 一致性、信息克制、unknown 处理、可执行性、表达自然度；综合目标 ≥4.0，最低单项 ≥3.0，Hard Gate 失败不可被评分覆盖。

## 9. Regression 与 Gate Recommendation

待最终记录。完成后停止并等待 Product Owner / QA Gate Review。
