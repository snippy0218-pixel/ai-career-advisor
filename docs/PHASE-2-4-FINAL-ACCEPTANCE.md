# Phase 2.4 Final Acceptance

> Final recommendation: **PASS / CLOSE PHASE 2.4**
> Implementation baseline: `main / 803289bdd8c63ba36e9f7d31e67c255141b801a4`
> Deterministic gate: 28 files / 584 tests, lint, production build PASS
> Model-backed gate: frozen E2E-RB-05 exactly 3 runs / 3 complete chains / X-A～X-J 3/3
> Phase 2.5: **NOT AUTHORIZED**

## A. Final architecture / root-cause conclusion

The release blocker was not one lexical Match bug. It was a generation-contract path problem across raw output, one repair, terminal normalization, deterministic validation, downstream status attribution, and optional transferable synthesis.

- Match raw/repair had inconsistent unknown/ownership language. The final design uses one status-language matrix, field-level repair transitions, and a conservative reason normalizer that only removes unsupported assertions or downgrades unsupported met/partial evidence to unknown before full validation.
- Recommendation R-C had valid subject-predicate grammar gaps. It now resolves bounded explicit MI ownership while checking every grouped MI independently.
- Strength/Gap repair treated every eligible partial MI as if it required a transferable strength and could cross into an unknown leadership dimension. Transferable strengths are now optional and dimension-local; after the one repair, only an SG-B/SG-M-rejected optional relation may be deleted, followed by full SG-A～SG-N validation.
- No Contract, public output schema, RB-05 fixture, provider model, temperature, retry, timeout, or cross-phase architecture was changed.

The final architecture preserves fail-closed semantics. Raw initial and repair outputs remain rejected evidence even when a separate normalized representation passes all guards.

## B. Changes made

- Match generation-contract v1.5 and bounded `raw → repair → normalized → full validator` path.
- Recommendation generation-contract v1.5 plus explicit `仅为` and described multi-MI `，但均为` status ownership.
- Strength/Gap generation-contract v1.2 plus deletion-only optional-transferable normalization.
- Acceptance diagnostics preserve raw/repair/normalized layers, validation issues, actions, request lifecycle, and frozen model settings; large normalized outputs remain body-only.
- Exact historical artifact replays and generalized semantic matrices cover met/partial/unknown/unmet, ownership, experience type, evidence force, modifier isolation, status attribution, downstream stop semantics, and evidence preservation.

Implementation details are in:

- `PHASE-2-4-MATCH-GENERATION-CONTRACT-STABILIZATION.md`
- `PHASE-2-4-FINAL-ACCEPTANCE-BATCH-1.md`
- `PHASE-2-4-ISSUE-031-038-STABILIZATION.md`

## C. Deterministic Gate

| Gate | Result |
| --- | --- |
| Exact Recommendation / Strength-Gap replays and focused matrix | 7 files / 136 tests PASS |
| Full automated regression | 28 files / 584 tests PASS |
| ESLint | PASS / 0 warnings |
| Production build + TypeScript | PASS |
| Diff / whitespace / secret review | PASS |
| Candidate Claim / unknown / ownership / modifier negative controls | PASS |
| Existing ISSUE-029～038 relevant regressions | PASS |
| Contract / public schema / fixture / provider settings | unchanged |
| Model calls during implementation | 0 |

## D. Final model-backed acceptance

Before the formal batch, one sandbox-restricted server execution reached JD with HTTP 503 in 45 ms, model output 0 and downstream calls 0. It is preserved as execution-precondition evidence and is not misclassified as a content sample. The production-equivalent server was then restarted outside the restricted network environment; five actual-route capability probes returned HTTP 200 with rejected-output capture enabled.

The formal batch used one server, one frozen HEAD, the same E2E-RB-05 input, `deepseek-v4-flash`, temperature 0.1, max tokens 8192, and no inter-run changes.

| Run | JD | Profile | Match | Recommendation | Strength/Gap | Greeting | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 200 / 7073 ms | 200 / 1854 ms | 200 / 9887 ms | 200 / 2663 ms | 200 / 3476 ms | 200 / 3374 ms | complete / X-A～X-J PASS |
| 2 | 200 / 9308 ms | 200 / 1997 ms | 200 / 9865 ms | 200 / 2380 ms | 200 / 3390 ms | 200 / 3876 ms | complete / X-A～X-J PASS |
| 3 | 200 / 8772 ms | 200 / 2115 ms | 200 / 12008 ms | 200 / 2080 ms | 200 / 2842 ms | 200 / 3599 ms | complete / X-A～X-J PASS |

Aggregate: **3/3 HTTP 200 complete chains**, 18/18 business stages HTTP 200, downstream calls after failure 0, and no run 4.

Evidence integrity in every run:

- Profile: PF 4/4, final facts 4, unprocessed PF 0, Candidate semantic upgrade 0.
- Match: final schema/JD evidence/Candidate evidence/status/aggregate validation all PASS; bounded normalization 3/3; no rejected claim released.
- Recommendation: initial pass 3/3; status fidelity, unknown preservation, hard-gap and waiver integrity PASS.
- Strength/Gap: initial pass 3/3; SG truthfulness and transferable boundary PASS; Candidate/ownership/proficiency/employment/context upgrade all 0; unknown deficiency and unsupported action 0.
- Greeting: one rejected initial + one rejected repair preserved per run; personalized safe fallback 3/3 passed all safety guards; semantic upgrade, cross-source contamination, unsupported number, unknown claim, contradiction, waiver and tone violations all 0; Phase 1 fallback 0/3.

Repair/fallback totals: Profile 0/3; Match repair 3/3 + normalization 3/3; Recommendation 0/3; Strength/Gap 0/3; Personalized Greeting repair 3/3 + safe fallback 3/3; Phase 1 Greeting fallback 0/3.

## E. Phase 2.4 issue disposition

| Item | Final disposition | Closure evidence |
| --- | --- | --- |
| ISSUE-028 | CLOSED | rejected Match/Greeting initial+repair raw, structured issues, normalized layer and lifecycle preserved at runtime |
| ISSUE-029 | CLOSED | course → CF-003 contamination and equivalent cross-CF modifier propagation 0 in final accepted Match 3/3 |
| ISSUE-030 | CLOSED | Strength/Gap initial accepted 3/3; legal evidence boundaries no longer false-positive; unsafe claims remain guarded |
| ISSUE-031 | CLOSED | Recommendation initial accepted 3/3 with status fidelity; exact legal grammar replays and contradiction controls PASS |
| ISSUE-032 | CLOSED | infrastructure and business artifacts both preserve six-stage lifecycle, not-run semantics and downstream count |
| ISSUE-033 | CLOSED | Match raw/repair/normalization path accepted 3/3 without releasing unsupported Candidate claims |
| ISSUE-034 | CLOSED | dimension-local relation controls and explicit-negative scope preserved in accepted Match |
| ISSUE-035 | CLOSED | CF-004 remains employment counter evidence and is not reused as positive domain/responsibility evidence |
| ISSUE-036 | CLOSED | generic work wording does not create accepted employment qualifier ownership |
| ISSUE-037 | CLOSED | legal evidence-force boundary remains accepted; illegal positive narration remains rejected/normalized |
| ISSUE-038 | CLOSED | Strength/Gap initial pass 3/3, no cross-dimension ownership relation and no terminal normalization needed |
| OBS-006 | OPEN / NON-BLOCKING | personalized safe fallback 3/3; all truth/safety guards pass, Phase 1 fallback 0; retain as naturalness/efficiency observation |

No open P0/P1 remains in Phase 2.4 scope.

## F. Remaining risks

- Greeting models repeatedly used semantically equivalent natural language that did not contain structured Candidate statements verbatim. The deterministic validator correctly rejected it and the safe personalized fallback preserved truth, tone, refs, and evidence. This is measurable quality/efficiency debt, not a released truth defect or release blocker.
- Match needed repair + normalization in 3/3. The terminal path is intentionally conservative and fully revalidated, but its frequency should remain observable in later matrices.
- Three model samples provide the frozen gate evidence requested for RB-05; they are not a general statistical model benchmark. Runtime Model Benchmark remains deferred.

## G. Git state / evidence artifacts

| Artifact | SHA-256 |
| --- | --- |
| `acceptance-artifacts/phase-2-4-final-acceptance-batch-2-rb-05-run-1.json` | `6290349EB841527C0CF85A0B737C0F11A324BC5C30E5BD74EF7AA056BA57F059` |
| `acceptance-artifacts/phase-2-4-final-acceptance-batch-2-rb-05-model-run-1.json` | `453CE9A0FFAEFC5855E4C1357283CDD150F5AC045DC202B54C4F5093E8B31AC6` |
| `acceptance-artifacts/phase-2-4-final-acceptance-batch-2-rb-05-model-run-2.json` | `841773A5F95406AB46630AF75208E9334FCB49FDB6819174934FFFA344D388D0` |
| `acceptance-artifacts/phase-2-4-final-acceptance-batch-2-rb-05-model-run-3.json` | `1E6035C7594794A8441B60720CFACB9EF229CCB07C244CEBAA8CA1A84CEEEBCF` |

All artifacts are independent and no historical artifact was overwritten. The local production server is stopped. The acceptance package is committed on `main`; the final handoff must report the exact package HEAD and clean worktree.

## H. Final Phase 2.4 Gate recommendation

**PASS / CLOSE PHASE 2.4.**

Q-A～Q-J pass. The Candidate Claim Contract, evidence lineage, unknown semantics, ownership/modifier isolation, fail-closed behavior, rejected evidence preservation, and downstream stop semantics remain intact. Phase 2.5 is not started and remains subject to a separate Product Owner / QA authorization.
