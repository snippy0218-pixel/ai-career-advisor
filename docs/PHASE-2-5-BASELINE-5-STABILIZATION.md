# Phase 2.5 baseline 5 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `83a18108282d97f3871027350d4239660528284c`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `ebed8401d44dc029b6f2ca51fbae57a658c382359c20387c804cfb087603efc1`
> Disposition: complete non-passing stabilization evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Sampling discipline

`phase-2-5-baseline-5-83a1810` ran the frozen `TC-P2-01..14 x 3` schedule after all five acceptance-capability probes passed with zero business/model calls. The implementation commit, fixture identity, runner, provider/model configuration, temperatures, timeouts, and repair policy remained fixed for all 42 top-level executions.

No run 4, selected rerun, partial composition, artifact overwrite, or deletion occurred. The full matrix, including every rejected initial/repair output and validator issue, remains under `docs/acceptance-artifacts/phase-2-5/phase-2-5-baseline-5-83a1810/`.

## 2. Baseline 5 result

Baseline 5 completed all 42 scheduled executions: `30/42` PASS, `31/42` complete chains, and `0` downstream calls after a failed stage. It improves baseline 4 from 21 to 30 passes but does not meet the release Gate.

| Fixture | R1 | R2 | R3 | Primary disposition |
| --- | --- | --- | --- | --- |
| TC-P2-01 | PASS | PASS | PASS | accepted |
| TC-P2-02 | PASS | PASS | PASS | accepted |
| TC-P2-03 | PASS | PASS | PASS | accepted |
| TC-P2-04 | PASS | PASS | PASS | accepted |
| TC-P2-05 | Match fail | PASS | PASS | aggregate-only terminal mismatch after otherwise valid repair |
| TC-P2-06 | PASS | Strength/Gap fail | PASS | SG-E repair retained the wrong gap expression for a partial Match item |
| TC-P2-07 | PASS | PASS | PASS | accepted |
| TC-P2-08 | X-F fail | Match fail | PASS | desired proficiency phrase misread as assertion; one-token compound-domain false positive |
| TC-P2-09 | Match fail | Match fail | Match fail | JD duration target after `与要求的...` assigned to Candidate Fact |
| TC-P2-10 | Match fail | Match fail | PASS | JD duration/quoted ownership targets assigned to Candidate Fact |
| TC-P2-11 | PASS | PASS | PASS | accepted |
| TC-P2-12 | PASS | Strength/Gap fail | PASS | information-gap wording asserted a Candidate deficiency |
| TC-P2-13 | PASS | PASS | PASS | accepted |
| TC-P2-14 | Strength/Gap fail | PASS | Strength/Gap fail | SG-E type/boundary remained invalid after repair |

Lifecycle metrics: Profile repair `1/1`; Match repair `19/26`; Recommendation repair `3/3`; Strength/Gap repair `6/10`; Greeting repair `7/17`. Personalized Greeting safe fallback was `10/10`; Phase 1 fallback was `3/3`. Fallbacks remained semantically safe and report-only.

## 3. Root adjudication and bounded changes

1. **Match aggregate terminal recovery (ISSUE-048):** when a rejected repair is otherwise unchanged and the complete validator reports only an aggregate mismatch, the aggregate is recomputed from the frozen dimension truth table. Aggregate recovery also follows a bounded reason normalization that changed a dimension status. All other reference, schema, status, and semantic issues remain visible to full validation.
2. **Match requirement-target ownership (ISSUE-041 extension):** duration or ownership language inside `与要求的...冲突` or a quoted relational target is JD-side target text, not a Candidate qualifier. Exact negative controls continue to reject asserted Candidate duration/ownership upgrades.
3. **Compound-domain omission check (ISSUE-048):** the conservative same-domain guard now requires all recognized terms in a compound fragment. A generic `运营` occurrence alone does not prove `企业服务产品运营`; exact same-domain positive facts still prevent an `unknown` omission.
4. **Strength/Gap type recovery (ISSUE-049):** an SG-F information gap is rewritten to a fact-free unknown boundary; an SG-E gap is converted to information for unknown refs, rewritten to a canonical evidence boundary for partial-positive refs, or removed when it is optional and inapplicable. The full SG-A～SG-N validator then reruns and still enforces mandatory direct, hard, information, and partial-gap coverage.
5. **X-F desired-state scope (ISSUE-044 extension):** `需/需要提升...熟练` is a desired improvement, not an assertion of current proficiency. Unsourced current-state proficiency remains rejected.

No Product Contract, public schema/API, fixture, provider/model setting, status semantics, lineage rule, or fail-closed boundary changed.

## 4. Deterministic verification before replacement matrix

- exact and generalized focused regression: `5 files / 161 tests` PASS;
- relevant Match/Strength-Gap/runner targeted regression: `9 files / 228 tests` PASS;
- complete suite: `33 files / 625 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS; emitted routes include `/personalized-match` and all six released APIs;
- diff/whitespace/scope audit: PASS; no frozen Contract, public API/schema, fixture, or provider configuration changed;
- credential scan: PASS; only documented placeholders/test keys were found, and no `.env.local` exists;
- immutable baseline commit is required before the replacement matrix.

The next model-backed action is one complete Phase 2 `14 x 3` replacement matrix on the new immutable implementation. No baseline 5 success may be cherry-picked.
