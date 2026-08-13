# Phase 2.5 baseline 12 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `da1877f6ea9b669b29763457567f4c82c0a53373`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `e0cdb9b6f4056edce14bfc914fd56054626a6f4d5887dbadbe85cb81cbe9f760`
> Disposition: complete non-passing content evidence retained; a complete replacement matrix is required.

## Result and failure adjudication

The immutable `14×3` batch completed at `40/42` PASS, `41` complete chains and downstream-after-failure `0`. Both Baseline-11 failures passed 3/3. No run 4, partial rerun composition, or in-batch change occurred.

- TC-P2-02 R3 stopped at Match after both attempts. The same-dimension CF explicitly states no formal full-time data-analysis experience, but the generic relational suffix `与要求直接冲突` was correctly rejected because it omitted the employment qualifier from the relation clause.
- TC-P2-10 R1 completed every stage and passed the frozen expectation plus X-A/X-B/X-D～X-J. X-C alone failed because aggregate-unmet MI-001 appeared in both `supportingMatchRefs` and `counterMatchRefs`, even though a sibling role dimension was positive.

## Bounded stabilization and verification

1. Match terminal recovery preserves only one exact, explicitly negative employment-type CF when the CF and current requirement share `正式`/`全职`/`实习`; it rewrites the reason to the canonical CF text and retains `unmet`. Generic/cross-dimension relations remain rejected.
2. Recommendation supporting refs now require aggregate `met` or `partial`, matching X-C. Terminal recovery can only remove the specifically rejected aggregate-ineligible supporting ref; it cannot add evidence, alter counter refs, or change the decision level, and the complete validator reruns.
3. No frozen Contract, public schema/API, fixture, prompt, provider/model configuration, retry, timeout, or product surface changed.

Focused `5 files / 135 tests`, full `33 files / 640 tests`, lint and production build PASS. Audit, immutable commit and complete replacement matrix remain.
