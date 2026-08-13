# Phase 2.5 baseline 13 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `55cc2de3f3c10e0321b960d2704e1a0337443d65`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `37d0f99628b365eaa08ca37d72593c0ddd45cea8b87fdcb340c318c14d7451cf`
> Disposition: complete non-passing content evidence retained; a complete replacement matrix is required.

## Result and failure adjudication

The immutable `14×3` batch completed at `40/42` PASS, `41` complete chains and downstream-after-failure `0`. Baseline-12 X-C failed case passed 3/3. No run 4, partial rerun composition, or in-batch change occurred.

- TC-P2-02 R3 completed all six stages, passed the frozen expectation and X-A～X-E/X-G～X-J. X-F alone read `SQL 技能熟练度及实际应用场景待确认` as an asserted unsourced proficiency because `待确认` followed a longer coordinated noun phrase.
- TC-P2-03 R2 stopped at Match. Initial output used the invalid enum `education`; repair corrected it to `qualification` but omitted the required `employment_type` decomposition for an explicit formal-work requirement.

## Bounded stabilization and verification

1. X-F retains the same clause-local negative/uncertainty rule and only extends the post-modifier lookahead within the existing 16-character clause slice so coordinated `熟练度及实际应用场景待确认` remains a boundary. Positive unsourced proficiency remains rejected.
2. Match terminal recovery responds only to the exact required-employment-dimension issue when an existing fact-free `unknown` dimension contains explicit `正式工作` or `全职` requirement evidence. It appends a fact-free `unknown employment_type` dimension, preserves aggregate `unknown`, and the full validator reruns.
3. No frozen Contract, public schema/API, fixture, prompt, provider/model configuration, retry, timeout, or product surface changed.

Focused `4 files / 152 tests`, full `33 files / 641 tests`, lint and production build PASS. Audit, immutable commit and complete replacement matrix remain.
