# Phase 2.5 baseline 3/4 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `f7838a1ac16e00a51035d02dd454c7d9ce1a83ff`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Disposition: intermediate evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Sampling discipline

- `phase-2-5-baseline-3-f7838a1` stopped in capability preflight because the five route-specific acceptance diagnostic flags were not enabled. It contains `requestCount=0`, `modelCalls=0`, and `contentSamples=0`; it is infrastructure evidence, not a content sample.
- After correcting only the production-server configuration, `phase-2-5-baseline-4-f7838a1` ran the frozen `TC-P2-01..14 x 3` schedule without fixture, code, model, or runner changes during the batch.
- No run 4, selected rerun, overwrite, deletion, or result composition occurred. Baseline 3 and every baseline 4 result remain in `docs/acceptance-artifacts/phase-2-5/`.

## 2. Baseline 4 result

Baseline 4 completed all 42 scheduled top-level executions: `21/42` PASS, `26/42` complete chains, and `0` downstream calls after a failed stage. It is a valid non-passing stabilization batch.

| Fixture | R1 | R2 | R3 | Primary disposition |
| --- | --- | --- | --- | --- |
| TC-P2-01 | PASS | PASS | PASS | accepted |
| TC-P2-02 | Match fail | Match fail | Match fail | duration-zero relation and legal proficiency boundary rejected |
| TC-P2-03 | Recommendation fail | Recommendation fail | Recommendation fail | verification questions misclassified as Candidate assertions |
| TC-P2-04 | Recommendation fail | PASS | X-F fail | ambiguous terminal summary; negated modifier false positive |
| TC-P2-05 | PASS | PASS | PASS | accepted |
| TC-P2-06 | PASS | PASS | PASS | accepted |
| TC-P2-07 | PASS | PASS | PASS | accepted |
| TC-P2-08 | X-F fail | expectation fail | expectation fail | negated modifier false positive; supported partial status over-normalized to unknown |
| TC-P2-09 | Match fail | Match fail | Match fail | JD duration target assigned to CF; supported domain partial over-normalized |
| TC-P2-10 | X-F fail | PASS | PASS | negated ownership modifier false positive |
| TC-P2-11 | PASS | Recommendation fail | Recommendation fail | terminal summary status/waiver ambiguity |
| TC-P2-12 | PASS | Strength/Gap fail | Strength/Gap fail | direct strength dropped Match evidence scope |
| TC-P2-13 | PASS | PASS | PASS | accepted |
| TC-P2-14 | Match fail | Match fail | PASS | one mixed-polarity CF hid its positive clause behind a negative clause |

Lifecycle metrics are preserved in `summary.json`: Profile repair `1/1`; Match repair `21/29`; Recommendation repair `0/6`; Strength/Gap repair `3/5`; Greeting repair `3/19`. Personalized Greeting safe fallback was `16/16`; Phase 1 fallback was `3/3`. Fallback remains report-only, and no unsafe fallback output was identified.

## 3. Root adjudication and bounded changes

1. **Match duration and modifier relations:** `无法满足` is now a recognized relational mismatch phrase. An explicit absence of the same formal/full-time experience may support a duration-zero counter only when the duration requirement carries the same qualifier. JD thresholds next to `与/和/同 ... 要求` are not assigned to a Candidate Fact.
2. **Match terminal normalization:** a single positive CF may retain `partial/met` only when exact CF text supports the same dimension. The rebuilt reason quotes that CF verbatim; responsibility requires responsibility language, and generic cross-domain overlap downgrades to `unknown`. The complete Match validator still runs afterward.
3. **Profile mixed polarity:** a model claim such as `协助登记；没有负责招商` is deterministically split into atomic positive and counter facts with the same PF lineage. No new fact text is invented.
4. **Recommendation questions and summary:** verification questions are no longer scanned as free-text Candidate assertions. If every post-repair defect is confined to the terminal summary and is an existing R-C/R-K/Candidate-summary ambiguity, only that summary is replaced with a fact-free generic statement, followed by full Recommendation validation.
5. **Strength/Gap scope:** a direct strength rejected only for SG-B scope/modifier loss is rewritten as an evidence relation that preserves the scope words from its referenced positive Match reasons. SG-A through SG-N are rerun; gaps, Match refs, and Match truth are unchanged.
6. **X-F:** unsourced modifiers remain forbidden in assertions. A modifier occurring inside a local negative, uncertainty, or confirmation clause is not treated as an asserted upgrade.

These are internal validation, normalization, prompt, and runner-adjudication changes. Frozen Product Contracts, public schemas/APIs, fixtures, model configuration, and Phase boundaries are unchanged.

## 4. Deterministic verification

- focused affected suites: `312/312`, followed by new integration/boundary coverage `40/40`;
- full automated suite: `33 files / 618 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS;
- production routes emitted by build include `/personalized-match` and all six released API routes.

Runtime closure remains a new immutable commit followed by the complete Phase 2 `14 x 3` replacement matrix. No baseline 2 or baseline 4 success may be cherry-picked into that matrix.
