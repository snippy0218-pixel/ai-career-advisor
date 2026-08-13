# Phase 2.5 baseline 11 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `7460f024f40736d8986d7c04a62c8771896bacaf`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `517d5082dc6310b5aa24d98c85ea5e150474788fddc9665f0b190a18343f6b1d`
> Disposition: complete non-passing content evidence retained; a complete replacement matrix is required.

## Result and failure adjudication

The immutable `14×3` batch completed at `40/42` PASS, `41` complete chains and downstream-after-failure `0`. Both Baseline-10 failures passed 3/3. No run 4 or sample composition occurred.

- TC-P2-10 R2 completed every stage and passed the frozen expectation plus X-A～X-E/X-G～X-J. X-F alone treated generated `3 年` as absent from raw JD `3年`; all semantics and digits were identical.
- TC-P2-11 R2 stopped at Recommendation. Both attempts asked a valid strictness question but appended `如是否接受其他学历形式`, an unsupported alternative-qualification example. R-K correctly rejected it.

## Bounded stabilization and verification

1. X-F source matching removes whitespace for comparison only; it still requires the same literal modifier/duration sequence in raw JD/Profile.
2. Recommendation terminal normalization recognizes only the existing R-K unsupported-substitution issue on a single question/ref, replacing that question with the fact-free canonical strictness question. The R-K rejection rule remains unchanged and the complete validator reruns.
3. No frozen Contract, schema/API, fixture, prompt, provider/model configuration, retry, timeout, or product surface changed.

Focused `4 files / 108 tests`, full `33 files / 637 tests`, lint and production build PASS. Audit, immutable commit and complete replacement matrix remain.
