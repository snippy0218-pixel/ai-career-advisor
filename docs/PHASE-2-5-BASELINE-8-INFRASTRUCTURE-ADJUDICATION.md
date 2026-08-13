# Phase 2.5 baseline 8 infrastructure adjudication

> Date: 2026-08-13
> Implementation under test: `6f0eab7aeb43496317ee9fa3fe4899f333c9c1f0`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `57cae988a8ab9f991ce1e729df41a99709d71f3b3a2237544220d4919b975580`
> Disposition: infrastructure-interrupted batch excluded from final content acceptance; every result remains retained.

## 1. Exact evidence

All 42 scheduled execution records were written without overwrite or selection. `TC-P2-01-R1/R2` completed and passed. During `TC-P2-01-R3`, the local production server process exited while Match was in flight: JD and Profile had completed, Match recorded `RUNNER_TRANSPORT_FAILURE / fetch failed`, and downstream calls were zero. The remaining 39 scheduled executions all failed at JD transport in 1～2 ms and produced no additional content samples.

The batch summary therefore reads `2/42` PASS and `2` complete chains, but it is not a valid fixed-environment content matrix. Its two successes are not reusable in a replacement matrix. The artifact-level adjudication is `infrastructure-adjudication.json`.

## 2. ISSUE-039 regression

The runner catch path stored `failureClassification = infrastructure_transport_failure`, while the central fail-fast predicate recognized the error code `RUNNER_TRANSPORT_FAILURE`. This code/category mismatch made `failure.infrastructure` false and allowed 39 additional zero-content executions to be scheduled. The corrected predicate accepts both representations; provider/content failures remain unchanged and `AI_OUTPUT_INVALID` remains a content failure.

The next server is kept alive by the long-running production-server command itself instead of a detached child process. After focused/full/lint/build and a new immutable commit, the complete Phase 2 `14×3` matrix must be rerun. There is no run 4, selected rerun, or composition with the two successful samples above.

## 3. Deterministic verification

- exact infrastructure classifier regression: `1 file / 8 tests` PASS;
- full suite: `33 files / 631 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS;
- a new immutable commit, scope/secret/process audit, and the complete replacement matrix remain.
