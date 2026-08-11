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
- full suite：21 files / 373 tests PASS；
- lint：PASS；
- production build：PASS。

## F. Post-fix RB-05

确定性 Gate 全部 PASS 后，在 implementation commit `b30e7bebaf572a40296be4be7bfe91c9b5ec2595` 上使用冻结 fixture 执行了唯一一次 post-fix RB-05：

- artifact：`docs/acceptance-artifacts/phase-2-4/phase-2-4-issue-030-rb-05-post-fix.json`；rerun-1/2/3 未覆盖；
- result：0/1，`completedChains=0`，`safeFailures=1`；
- stoppedAt：`jd`；HTTP 503；error `AI_SERVICE_UNAVAILABLE`；request id `6c74a720-ea9b-4389-8bca-4c88ecf62b4b`；
- latency：JD 83 ms；Profile/Match/Recommendation/Strength-Gap/Greeting samples 均为 0；
- downstreamCallsAfterFailure：0；所有 repair/fallback counters 均为 0；
- artifact 保留冻结 JD/Profile 字符数与 SHA-256；由于 JD upstream failure，未产生 Profile、Match、Recommendation、Strength/Gap initial/repair 或 Greeting raw output。

该失败发生在 SG-E 之前，属于新的 upstream/service-availability failure mode。Artifact 无法进一步区分上游 HTTP failure 与本地受限网络 fetch failure；按 Product Owner / QA 指令不执行第二次 rerun。

## G. ISSUE-029 / ISSUE-030 Audit

- ISSUE-029 contamination：**indeterminate**（post-fix run 未到达 Match；rerun-3 的 NOT OBSERVED 历史事实不被覆盖）；
- ISSUE-030：**FIX NOT VERIFIED**（deterministic/local Gate PASS，但唯一 E2E 未到达 Strength/Gap）；
- repair semantics：rerun-3 initial/repair 仍确认为 semantically valid；当时 repair 为 validator-induced unnecessary repair。本次 post-fix run 未到达 Strength/Gap，因此没有 repair 可重新观测。

## H. Gate

当前 ISSUE-030 为 OPEN / FIX IMPLEMENTED / LOCAL VERIFICATION PASS / E2E VERIFICATION BLOCKED；工程建议 **FIX NOT VERIFIED**。Phase 2.4 仍 BLOCKED，Phase 2.5 NOT AUTHORIZED。
