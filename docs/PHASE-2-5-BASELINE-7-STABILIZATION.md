# Phase 2.5 baseline 7 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `13900bf9df64b10499753c2dd8d38a8094869e34`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `6056d26b0333041cc8a50c909cb64daac2751aa3c7c445739b478c1011168c76`
> Disposition: complete non-passing stabilization evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Sampling discipline and result

`phase-2-5-baseline-7-13900bf` ran all frozen `TC-P2-01..14 x 3` executions on one commit/configuration after five zero-call capability probes. No run 4, selected rerun, partial composition, overwrite, or deletion occurred.

The result was `39/42` PASS, `40/42` complete chains, and `0` downstream calls after failure. TC-P2-01 and TC-P2-03～14 were 3/3 except TC-P2-10 R1; the only other failures were TC-P2-02 R1/R3.

| Failure | Stage | Adjudication |
| --- | --- | --- |
| TC-P2-02 R1 | Recommendation | Match item MI-002 aggregate was correctly `unmet` from duration/employment counter-evidence while its domain dimension remained `unknown`. Recommendation accurately stated both, but R-K treated any item containing an unknown dimension as forbidden from stating its aggregate `unmet`. |
| TC-P2-02 R3 | Recommendation | Same root on MI-004: aggregate `unmet`, domain dimension `unknown`, and a Candidate-information question was present. |
| TC-P2-10 R1 | X-F | `缺少剩余2年经验的证据` was a gap statement; X-F treated the unsourced `2年` as a current Candidate duration claim. All other X-A～X-J invariants passed. |

ISSUE-050 is runtime-verified: the two failed Recommendation chains retain `jd/profile/match.output`, while failed/not-run stage outputs remain null.

## 2. Bounded stabilization

1. R-K still requires a Candidate-information question whenever a hard item contains an unknown dimension. Unknown→unmet drift checking now applies when the item aggregate itself is `unknown`; an aggregate `unmet` item may state that exact aggregate while separately preserving its unknown dimension and confirmation question.
2. X-F treats a local `缺少...年...证据` clause as a missing-evidence boundary, not a Candidate duration assertion. Positive unsourced duration assertions remain rejected.
3. No Product Contract, public schema/API, fixture, prompt, provider setting, or model configuration changed.

## 3. Deterministic verification before replacement matrix

- focused Recommendation/X-F regression: `3 files / 103 tests` PASS;
- full suite: `33 files / 631 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS;
- diff/whitespace/scope/secret/process and artifact hash: PASS; frozen/public surfaces unchanged, actual key matches `0`, and port 3000 is clean;
- immutable commit remains before the next full matrix.

Baseline 7 successes cannot be cherry-picked into the replacement matrix.
