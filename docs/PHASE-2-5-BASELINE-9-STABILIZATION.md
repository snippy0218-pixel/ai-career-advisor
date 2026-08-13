# Phase 2.5 baseline 9 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `2b8bc406a0d775a995a95e8a305606cb3b4ca67d`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `8535d68c30a852e65ecec6d1207690515a3859597f04b41328618fe178e7e0f9`
> Disposition: complete non-passing content evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Sampling discipline and result

`phase-2-5-baseline-9-2b8bc40` ran all frozen `TC-P2-01..14 × 3` executions on one commit/configuration after five zero-call capability probes. The production server remained live for the complete batch. No run 4, selected rerun, partial composition, overwrite, or deletion occurred.

The result was `39/42` PASS, `40/42` complete chains, and `0` downstream calls after failure. Personalized safe fallback completed `22/22`; Phase 1 fallback completed `3/3`. The three failures are independently retained:

| Failure | Stage | Adjudication |
| --- | --- | --- |
| TC-P2-02 R2 | Match | Both attempts correctly represented zero formal full-time tenure and limited SQL evidence, but modifier isolation treated `不满足3年以上经验要求` and `未明确达到…熟练程度` as positive Candidate qualifiers. These are local threshold/evidence boundaries. |
| TC-P2-04 R1 | Recommendation | Both attempts preserved MI-001 as `partial` and asked whether the hard education requirement was already satisfied. R-C matched the hypothetical substring `已满足` as a factual `met` claim. |
| TC-P2-10 R1 | Frozen expectation | The full chain and X-A～X-J passed, but Match classified explicit `1年 < 3年` duration as `partial`; the frozen fixture requires both `unmet` and `partial`. A known numeric shortfall is dimension-local counter-evidence and must be `unmet`. |

## 2. Bounded stabilization

1. Candidate modifier scanning recognizes `不满足…要求` and `未明确达到…程度` as local negative/evidence boundaries while continuing to reject positive unsourced duration and proficiency claims.
2. Match adds a deterministic `M-DURATION` error when a numeric Candidate duration is explicitly below the numeric JD threshold but emitted as `partial`. Terminal normalization converts only that exact referenced duration to `unmet`, switches the same CF to counter evidence, removes confirmation fields, recalculates the aggregate, and reruns the full validator.
3. Recommendation R-C ignores a status phrase only when immediately governed by `是否/确认是否`; direct `已满足` assertions remain fail-closed.
4. No Product Contract, public schema/API, fixture, prompt, provider setting, model configuration, temperature, retry, timeout, or product surface changed.

## 3. Deterministic verification before replacement matrix

- exact/focused Match, Recommendation, modifier, adapter, and runner suites: `7 files / 272 tests` PASS;
- full suite: `33 files / 634 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS;
- diff/scope/secret/process audit and a new immutable commit remain before the next complete matrix.

Baseline 9 successes cannot be cherry-picked into the replacement matrix.
