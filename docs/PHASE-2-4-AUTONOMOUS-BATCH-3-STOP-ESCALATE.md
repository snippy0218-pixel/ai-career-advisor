# Phase 2.4 Autonomous RB-05 Batch 3 — Stop & Escalate

> Date: 2026-08-12
> Branch: `main`
> Frozen runtime HEAD: `5f671019a986236707bde2378aabf1f860201823`
> Product implementation: `4c12ed65573d1a609abbcc044d67e9e72c6e3947`
> Fixture: frozen `E2E-RB-05`, JD SHA-256 `bf1eea5f393bb5a9ce7dd5de9ab76a0dc95f90bb4742b656e2916281584f4a60`, Profile SHA-256 `0b19712da6ae0a07c4543fe8d3427a1650c4e711b7c1ed4d33a38e14e2925745`

## Execution accounting

The first preflight attempt was stopped before business execution because the local server process was started with a misspelled Greeting diagnostics variable. Four routes returned enabled and Greeting returned 503. The artifact records `requestCount=0`, `businessCallCount=0`, `stageCalls=0`, `modelCalls=0`, and all six stages as `not_called/not_run`. The existing route source showed that the correct frozen variable is `GREETING_ACCEPTANCE_DIAGNOSTICS`; only the process environment was corrected. No code, fixture, model, temperature, retry, timeout, Contract, or Gate changed.

After restart, an independent actual-route preflight returned HTTP 200 / capability enabled / rejected-output capture true for all five routes. Exactly three model-backed executions then ran on the same server, commit, fixture and settings. There was no fourth execution.

| Execution | JD | Profile | Match | Recommendation | Strength/Gap | Greeting | Complete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| model run 1 | 200 / 7,093 ms | 200 / 2,080 ms / repair 0 | 502 / 11,378 ms / repair 1 | not called | not called | not called | no |
| model run 2 | 200 / 8,158 ms | 200 / 2,608 ms / repair 0 | 200 / 11,943 ms / repair 1 | 200 / 2,713 ms / repair 0 | 200 / 4,123 ms / repair 0 | 200 / 3,823 ms / repair 1 / personalized fallback 1 / Phase 1 fallback 0 | yes |
| model run 3 | 200 / 10,338 ms | 200 / 2,318 ms / repair 0 | 502 / 9,596 ms / repair 1 | not called | not called | not called | no |

Batch result: **1/3 complete**. Both failures stopped downstream calls at 0. Incomplete invariants remained `not_run/passed=null`; run 2 passed X-A through X-J.

## Exact Match evidence

### Model run 1 initial

The validator correctly rejected cross-dimension or structurally inconsistent statements, including:

- domain/unmet, refs `[CF-004:counter]`: `CF-004 明确表明没有正式数据产品工作经历，且 CF-003 仅涉及数据展示作业，不属于数据产品领域，因此缺乏数据产品领域的正证。`
- responsibility/unmet, refs `[CF-004:counter]`: `CF-004 明确表明没有正式数据产品工作经历，且 CF-003 仅表明协助整理需求和测试，未体现独立负责。`
- personal-delivery partial, refs `[CF-003:positive]`: `CF-003 表明协助整理需求和测试，属于个人交付的正证，但未明确是否对整体结果负责。`

Codes: `M-CANDIDATE-LINEAGE` for unsupported/missing CF ownership and `M-K` for `ownership:个人->CF-003`.

### Model run 1 repair

The repair corrected domain/responsibility to `unknown` with refs `[]`, but failed again on:

1. `CF-003 涉及数据展示作业，但未明确属于数据产品领域，不构成正证。`

   Code: `M-CANDIDATE-LINEAGE explicit Candidate Fact reference missing from candidateEvidence: CF-003`.

2. `CF-003 表明协助整理需求和测试，但未体现独立负责。`

   Code: `M-CANDIDATE-LINEAGE explicit Candidate Fact reference missing from candidateEvidence: CF-003`.

3. `CF-003 表明协助整理需求和测试，属于个人交付的正证，但未明确是否对整体结果负责。`

   Code: `M-K cross-CF modifier isolation failed: ownership:个人->CF-003`.

The first two clauses contain semantically anchored CF-003 wording, but they are not legal under the frozen unknown-reason rule. `unknown + candidateEvidence=[]` may state evidence absence/uncertainty and may use only the bounded sibling **explicit-negative** scope form; it may not repeat a positive Candidate factual assertion. CF-003 is positive, so it cannot be narrated in those unknown reasons while refs remain empty. `M-CANDIDATE-LINEAGE` therefore correctly fails closed. The third clause upgrades assistance with requirements/testing into positive evidence of personal-delivery responsibility; CF-003 does not independently support that ownership upgrade, so M-K also correctly fails closed.

### Model run 3 initial

The validator correctly rejected:

- responsibility/unmet from CF-004 employment counter-evidence: `CF-004 明确表明没有正式数据产品工作经历，因此无法满足独立负责数据产品的职责要求。`
- an unknown reason narrating CF-003 while structured refs were empty.
- `CF-003 表明在团队作业中协助整理需求和测试，体现了一定的个人职责，但未明确对交付结果负责。` as `M-K ownership:个人->CF-003`.

### Model run 3 repair

The repair retained two blockers:

1. unknown / refs `[]`: `现有资料未表明候选人主导过跨团队项目。CF-003 仅表明参与团队作业并协助整理需求和测试，未体现主导或跨团队性质。`

   Code: `M-CANDIDATE-LINEAGE explicit Candidate Fact reference missing from candidateEvidence: CF-003`.

2. partial / refs `[CF-003:positive]`: `CF-003 表明在团队作业中协助整理需求和测试，体现了一定的个人职责，但未明确对交付结果负责。`

   Code: `M-K cross-CF modifier isolation failed: ownership:个人->CF-003`.

The first again violates the frozen unknown-reason rule by narrating a positive CF while Contract-valid unknown refs remain empty. It is a model/repair generation error, not a validator false positive. The second is again an unsupported ownership synthesis correctly rejected.

## Candidate lineage used in adjudication

| CF | Canonical statement | PF | Raw Profile evidence |
| --- | --- | --- | --- |
| CF-001 | `教育背景：信息管理本科` | PF-001 | `教育背景：信息管理本科` |
| CF-002 | `课程项目：在课程中了解 Python 基础语法` | PF-002 | `课程项目：在课程中了解 Python 基础语法` |
| CF-003 | `与四人团队共同完成数据展示作业，我协助整理需求和测试` | PF-003 | `团队经历：与四人团队共同完成数据展示作业，我协助整理需求和测试` |
| CF-004 | `没有正式数据产品工作经历` | PF-004 | `没有正式数据产品工作经历` |

CF-003 supports team assignment participation and assistance with requirements/testing. It does not independently support leading a cross-team project, responsibility for personal delivery results, or a data-product domain classification. CF-004 is an employment-type counter fact only; it does not prove domain or responsibility unmet.

## Cross-module disposition

- ISSUE-029: original CF-002 course-scope propagation was not accepted in any completed output; run 2 X-F/X-H passed. No regression was released, but the batch is not stable enough for closure.
- ISSUE-030: run 2 Strength/Gap passed initial validation with repair 0 and X-A～X-J passed. This is positive runtime evidence for the valid evidence-boundary fix, not sufficient to close the overall blocked phase.
- ISSUE-031: run 2 Recommendation passed initial validation with repair 0. The described-prefix false positive did not recur in that completed chain, but 1/3 reachability is insufficient for stable closure.
- ISSUE-033: repair-generation unsupported-claim stability remains **NOT VERIFIED**. Both repairs preserve disallowed positive CF narration in unknown reasons and unsupported ownership synthesis.
- ISSUE-037: original behavior **NOT OBSERVED / FIX VERIFIED AT RUNTIME**. In both failed repairs, legal clauses such as `CF-004 仅否定正式工作经历，不构成独立负责维度的反证` were accepted. The rejected CF-003 clauses are positive factual narration forbidden by the frozen unknown-reason rule, not equivalent to the original legal explicit-negative meta-evidence boundary.
- Ownership safety: both unsupported `个人交付/个人职责` upgrades were rejected by M-K and never released downstream.
- ISSUE-028/032 preservation: initial and repair raw, exact issues, stage ledger, downstream-call state and preflight-failure state were preserved.

## Stop & Escalate trigger

The broad status/lineage/semantic-ownership root has consumed all three authorized implementation stabilization cycles. Batch 3 is still 1/3 complete and two repairs fail on correctly enforced unknown-reason lineage and ownership guards. The deterministic safety layer is working, but the Match repair generator is not robustly producing a legal representation. Another regex/phrase exception or a fourth implementation cycle would exceed the autonomous budget and risk weakening correct fail-closed behavior without a stable claim/evidence representation.

Required disposition: **STOP & ESCALATE**. Product Owner / QA must decide whether to authorize a deeper Match repair-generation redesign, a claim/evidence representation change, a Contract amendment for positive non-support CF narration in `unknown` reasons, or another bounded plan. Phase 2.5 remains NOT AUTHORIZED.

## Immutable artifacts

| Artifact | SHA-256 |
| --- | --- |
| `phase-2-4-autonomous-baseline-3-rb-05-batch-run-1.json` (zero-call preflight failure) | `0f8be766cf79c40e06f22e7cf3694d41b4edf0e57e2d3ba8ffeb1027c9e2e365` |
| `phase-2-4-autonomous-baseline-3-rb-05-batch-model-run-1.json` | `9292918861349c535a194d27f4310bc10646b47a66364294ed77502bf9555874` |
| `phase-2-4-autonomous-baseline-3-rb-05-batch-model-run-2.json` | `a665d235e39f07e1e3735414f6eaa56fe064923565fab0be0908480585bff153` |
| `phase-2-4-autonomous-baseline-3-rb-05-batch-model-run-3.json` | `c423e38e13d6a8803d733a57308166e8989fc50d08b0aadbabf46d5f3246c899` |

Scope audit: no code changes during the batch, no fixture changes, no Contract/Gate relaxation, no provider/model/temperature/retry/timeout changes, exactly three model-backed executions, no Phase 2.5 work.
