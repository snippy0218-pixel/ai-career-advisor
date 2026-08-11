# Phase 2.4 ISSUE-031 Bounded Stabilization Evidence

> 日期：2026-08-11
> Issue：ISSUE-031 — Recommendation Cross-MI Status Phrase Attribution False Positive
> Gate：**OPEN / FIX IMPLEMENTED / DETERMINISTIC GATE PASS / E2E PENDING**
> Phase 2.5：NOT AUTHORIZED

## Root Cause

Replacement RB-05 Recommendation initial 与 repair raw 完全相同。summary 的一个逗号分句同时包含“学历要求已满足（MI-004）”与“跨团队项目中承担部分交付责任（MI-003 部分维度）”。旧 validator 先按逗号等标点切 text unit，再对 unit 中每个 MI 独立扫描 status phrase；属于 MI-004 的“已满足”因此也被归给 top status=partial 的 MI-003，产生 `MI-003 text contradicts Match Core status`。这是 validator-induced unnecessary repair，不是 Recommendation generation failure。

## Fix

`recommendation-schema.ts` 改为先定位每一个 status phrase，再按以下窄规则解析归属：

1. status 后紧邻括号中的显式 MI ref；
2. status 前紧邻的显式 MI ref；
3. 同一 bounded sentence 中最近且唯一的显式 MI ref；
4. exact requirement wording；
5. 单一 structured `matchItemRefs`。

显式 `MI-001、MI-002 均为未知` 可按 plural wording 绑定全部 refs；无法安全唯一归属的 grouped multi-MI status phrase 不武断绑定第一个或最后一个 MI，而以 `ambiguous status phrase attribution` fail-closed。Prompt、Recommendation Contract、allowed-level、unknown/hard-gap、waiver 与 Candidate fact guards 均未修改。

## Regression Matrix

| Case | Result |
| --- | --- |
| R1 replacement multi-MI meaning | PASS |
| R2 met + partial same sentence | PASS |
| R3 met + unknown same sentence | PASS |
| R4 explicit partial/unknown → fully met contradiction | PASS（reject） |
| R5 met → unmet contradiction | PASS（reject） |
| R6 exact requirement wording attribution | PASS |
| R7 ambiguous grouped multi-MI phrase | PASS（fail-closed ambiguity） |
| R8 existing single-MI contradiction | PASS（reject） |
| R9 legal initial avoids repair | PASS（mock provider 1 call / repair=false） |
| R10 exact replacement raw summary | PASS |

Focused Match/Recommendation/repair：93/93；authorized targeted：184/184；full suite：394/394；lint、production build、diff check PASS。deterministic Gate 完成前模型调用为 0。下一步只允许固定新 implementation commit 后的一次 post-029/031 RB-05；无论成功或失败均停止。

## Post-029/031 RB-05 Result

唯一正式 E2E 在 Match 502 停止，Recommendation `not_called`，因此没有 multi-MI runtime sample，也无法验证 initial 是否避免 validator-induced repair。ISSUE-031 建议 `VERIFICATION INCONCLUSIVE`。该结果不推翻 R1～R10 deterministic evidence，也不能据此宣称 E2E fix verified；严格未追加 rerun。
