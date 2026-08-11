# Phase 2.4 ISSUE-030 Bounded Stabilization Evidence

> 日期：2026-08-11
> Issue：ISSUE-030 — SG-E Evidence Boundary False Positive on Valid Long Clause
> 属性：P1 / OPEN / Phase 2.4 Release Gate Blocker / Deterministic Validator Defect
> 授权范围：仅 Strength/Gap deterministic evidence-boundary validation
> Phase 2.5：NOT AUTHORIZED

## A. Root Cause

rerun-3 的 Strength/Gap initial 与 repair 均输出同一合法 `evidence_expression`：

`现有证据只能表明候选人在课程中了解 Python 基础语法，尚不足以证明其熟练掌握 Python。`

`MI-001` 为 `partial`，并具有 `CF-002 → PF-002 → Raw Profile` 的 positive Candidate evidence 与合法 JD evidence。原 SG-E 使用固定 `{0,20}` 字符窗口连接 evidence anchor 和 insufficiency boundary；“证据”与“尚不足”之间的合法 Candidate positive clause 长 26 字符，因此被错误拒绝。Initial 与 repair 均为 semantically valid；repair 属于 validator-induced unnecessary repair，不是 model generation failure。

## B. Validator Fix

`src/lib/strength-gap-schema.ts` 以 bounded semantic structure 替换固定字符距离：

1. 按句号、问号、感叹号、分号和换行隔离 evidence semantic unit，不跨 unit 拼接关键词；
2. 要求 unit 从 `现有/当前 + 证据/经历` anchor 开始；
3. 接受两种有序结构：anchor 自身携带 Candidate evidence 的紧凑式，或 `anchor → positive evidence assertion → comma → insufficiency boundary → target` 的双分句式；
4. positive clause 必须使用受限的 evidence assertion 语言；limitation clause 必须使用 `尚不足以/不足以/未能完整` 与证明、确认、判断等 evidence verb；
5. Candidate support、CF/PF/JD lineage、partial status、modifier 和 semantic-upgrade 继续由既有 SG-E/SG-B/SG-N 等 guard 校验。

实现没有把 `{0,20}` 改成更大的窗口或 `.*`，也没有修改 SG Prompt、Contract 或 repair Prompt。

## C. Deterministic Regression Matrix

| Case | Boundary | Expected | Result |
| --- | --- | --- | --- |
| T1 | 原 RB-05 长句 | PASS | PASS |
| T2 | Candidate positive clause 明显长于 20 字 | PASS | PASS |
| T3 | `当前证据…不足以证明…` | PASS | PASS |
| T4 | `现有经历…未能完整证明…` | PASS | PASS |
| T5 | 有 anchor、无 insufficiency boundary | REJECT | PASS |
| T6 | 有 boundary、无 anchor | REJECT | PASS |
| T7 | anchor 与 boundary 分处无关句子 | REJECT | PASS |
| T8 | boundary 前直接升级 Candidate proficiency | REJECT | PASS |
| T9 | 既有短合法 compact form | PASS | PASS |
| T10 | 仅关键词巧合、非 Candidate evidence boundary | REJECT | PASS |

Focused schema：35/35 PASS。Strength/Gap、modifier-integrity、ISSUE-027/028 evidence 与 downstream Greeting targeted regression：83/83 PASS。

## D. Existing Guard Preservation

- SG-E 的 `partial + positive Candidate evidence + CF/PF/JD lineage` 第一层条件未修改；
- SG-B/SG-M Candidate claim、scope、ownership、proficiency、employment、context upgrade guard 未放宽；
- SG-N modifier integrity 未修改；
- SG-H suggested action、SG-I Match reference、SG-F unknown、SG-G hard constraint 等规则未修改；
- rejected-output acceptance evidence capture 未修改；
- Match、Recommendation、Candidate Profile、Candidate Fact/PF、Greeting 与 CLOSED Contract 无代码变更。

## E. Automated Regression

- ISSUE-030 focused + existing schema：35/35 PASS；
- authorized targeted：83/83 PASS；
- full suite：待执行；
- lint：待执行；
- production build：待执行。

## F. Post-fix RB-05

待全部确定性 Gate PASS 后执行一次；使用冻结 fixture，写入新 artifact，不覆盖 rerun-1/2/3。

## G. Gate

当前 ISSUE-030 仍为 OPEN / FIX IMPLEMENTED / E2E VERIFICATION PENDING。Phase 2.4 仍 BLOCKED，Phase 2.5 NOT AUTHORIZED。
