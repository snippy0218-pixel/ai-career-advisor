# Phase 2.4 ISSUE-028 / ISSUE-031 Bounded Completion Evidence

> 日期：2026-08-11
> Starting baseline：`4ec6cb499a1db0c2cbff4a3e8fe4d792b6b666e0`
> Gate：Phase 2.4 **FAIL / BLOCKED**；Phase 2.5 **NOT AUTHORIZED**
> Scope：仅完成 Recommendation 的 ISSUE-028 structured rule/code 审计链与 ISSUE-031 deterministic restabilization；不执行模型调用或 E2E。

## 1. ISSUE-028 Recommendation Structured Evidence Completion

原 Recommendation adapter 复用了 Strength/Gap evidence serializer。该 serializer 会把 validation issue 收窄为 `path + message`，因此 Recommendation 的 R-C rule/code、归属 MI 与 validation layer 无法沿 initial/repair rejected evidence 稳定进入 acceptance diagnostics。

本轮新增 Recommendation 专用 evidence serializer，并由 Recommendation adapter 直接使用。R-C validator 现在在产生 issue 时同步提供内部结构化字段：

- `validationLayer=semantic_validation`
- `validationCode=R-C_STATUS_CONTRADICTION` 或 `R-C_AMBIGUOUS_STATUS_ATTRIBUTION`
- `rule=R-C`
- `matchItemRefs`（仅在可可靠定位时）

serializer 不通过 message regex 反推 code。只有唯一 MI 可可靠定位时才产生 `rejectedItem={path,matchItemRef}`；歧义时保持 `rejectedItem=null`，不得伪造归属。initial/repair raw、finish/failure metadata 与 lifecycle 继续仅进入 acceptance diagnostics；普通 production 5xx response 不暴露 raw、内部 rule/code 或 diagnostics。

E28-R1～E28-R8 覆盖：合法 initial 直接通过、结构化 contradiction、initial reject 后 repair 接受、initial/repair 双拒绝、production boundary、route 502 preservation、ambiguous no-fake-ref，以及 provider/truncated no-validator-code。全部 PASS。

## 2. ISSUE-031 Exact Root Cause

post-028/032 RB-05 保存的 Recommendation summary 为：

> Match Core 正向证据包括 MI-004（学历要求已满足）以及 MI-001、MI-003 的部分匹配；反证为 MI-002（正式数据产品工作经验未满足）。待确认项集中在 MI-001 与 MI-003 的掌握深度和主导程度。

旧 R-C 没有把 `MI-004（学历要求已满足）` 识别为“括号内 status 归前置 MI 所有”，而是使用 text-unit 内最近唯一 MI 的距离启发式。由于 status 后的 MI-001 距离更近，`已满足` 被错误归给 partial MI-001，产生 false positive。与此同时，旧 status pattern 未覆盖 `部分匹配`。此前 R1～R10 使用过 `学历要求已满足（MI-004）` 这种反向结构，命中了“status 后括号 MI”路径，未覆盖当前 runtime 语序。

## 3. Deterministic Attribution Algorithm

R-C 现在先识别 status phrase，再按可审计结构决定归属：

1. `MI-xxx（...status...）`：括号内 status 归紧邻前置 MI；
2. `status（MI-xxx）`：status 归括号内显式 MI；
3. 显式前置 MI group：支持 `、`、`,`、`，`、`和`、`与`、`及`、`以及`，并允许受限字段词（如“状态”“要求”“信息”“证据”“情况”）；
4. exact requirement wording；
5. 单一 structured `matchItemRefs` 或单一显式 MI ref 的安全回落。

`部分匹配/部分满足/部分支持/仅有部分支持/部分维度` 被建模为 partial status。无法唯一、安全归属的 multi-MI status 不再按字符距离猜测，而以 `R-C_AMBIGUOUS_STATUS_ATTRIBUTION` fail-closed；只有其可能归属包含 met item 时，unknown wording ambiguity 才构成矛盾风险，避免把 partial/unmet 的合法待确认表述误拒绝。真实 met/unmet/partial/unknown status contradiction 仍由 `R-C_STATUS_CONTRADICTION` 拒绝。

## 4. Regression Evidence

R31-1～R31-16 覆盖 exact runtime wording、重排 group、多个 partial、met+partial、met+unknown、unmet+partial、真实 met/unmet/group contradiction、parenthetical locality、nearby group、semicolon boundary、genuine ambiguity/no fabricated ref、既有 single-MI contradiction、full-validator exact initial 与 byte-equivalent repair。全部 PASS。

验证结果：

- focused Recommendation Gate：3 files / 79 tests PASS；
- authorized targeted regression：16 files / 261 tests PASS；
- full suite：23 files / 451 tests PASS；
- lint、production build、`git diff --check`：PASS；
- model calls：0；RB-05 / replacement / stochastic sampling：0。

targeted regression 同时保留 ISSUE-029 的 `M-CANDIDATE-LINEAGE` / qualifier ownership、ISSUE-030 SG-E boundary guards、ISSUE-032 runner evidence semantics 以及 Match/Strength-Gap/Greeting upstream/downstream 回归。

## 5. Scope and Disposition

未修改 Prompt、Contract、frozen fixture、runner、Match、Strength/Gap、Greeting、JD/Profile、model/temperature/retry/timeout 或 Phase Gate。未删除或覆盖任何历史 artifact。

工程建议：

- ISSUE-028：`LOCAL COMPLETION VERIFIED / NEW FULL-CHAIN E2E PENDING`；
- ISSUE-031：`LOCAL FIX VERIFIED / NEW FULL-CHAIN E2E PENDING`；
- Phase 2.4：仍 **BLOCKED**，可向 Product Owner / QA 申请一次新的 full-chain E2E 授权；
- Phase 2.5：仍 **NOT AUTHORIZED**。

本文件不关闭任何 Issue，也不授权 E2E、模型调用或下一 Phase。

## 6. Authorized Full-chain Follow-up

Product Owner / QA 随后授权在本 implementation baseline 上执行唯一一次 post-028/031 completion RB-05。该运行于 Match 502 停止：JD 200、Profile 200；Match initial 7 条与 repair 3 条 deterministic issues，Recommendation/Strength-Gap/Greeting 未调用，failure 后下游调用 0。

Initial 的 `课程->CF-004/CF-003` cross-CF contamination 被 M-K 正确拒绝；repair 已移除 course contamination，但保留两条 unsupported negative Candidate upgrade，仍被 M-CANDIDATE-LINEAGE 正确 fail-closed。另有 `与正式工作经验要求不符` comparison 由 CF-004 + JD 支持却被 lineage guard 拒绝，记录为待 QA 裁决的 possible false-positive observation；它不是本次 terminal failure 的唯一原因。

ISSUE-028=`INCONCLUSIVE`、ISSUE-031=`VERIFICATION INCONCLUSIVE`、ISSUE-030=`VERIFICATION INCONCLUSIVE`；ISSUE-029 safety preservation 未回归但没有 Final accepted Match；ISSUE-032 artifact semantics preservation PASS。完整证据见 `docs/PHASE-2-4-POST-028-031-COMPLETION-RB-05.md`。Phase 2.4 仍 BLOCKED，未追加 rerun。
