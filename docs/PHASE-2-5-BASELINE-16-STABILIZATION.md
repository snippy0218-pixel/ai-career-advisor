# Phase 2.5 baseline 16 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `0598947ecdc4fc8c8199641e1b9fa2459dad7e90`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `72897df00ee47d58c38edd464f027971d1aa19187a6b266fb4cd73ab82ad8de1`
> Disposition: complete non-passing regression evidence retained; a complete replacement matrix is required.

## Result and regression adjudication

The immutable `14×3` batch completed at `33/42` PASS, `33` complete chains and downstream-after-failure `0`. TC-P2-10 passed 3/3. No run 4, partial rerun composition, or in-batch change occurred.

TC-P2-01/06/07 failed 3/3 through one deterministic regression: the new global same-skill omission validator rejected terminal-normalized unknown SQL dimensions after M-K correctly removed course/cross-CF contamination. This made the global rule conflict with the existing conservative terminal downgrade.

## Bounded stabilization and verification

1. The global same-skill schema extension is removed; normal unknown skill decisions are not universally forced to reference a CF.
2. In terminal repair context, a rejected multi-CF met/partial skill reason may retain one independently supporting exact CF, rebuild to exact text, and is capped at `partial`; contaminated refs are removed and aggregate truth is recalculated.
3. For the Baseline-15 aggregate-only stale repair, partial restoration remains limited to an explicit proficiency threshold plus exact same-skill positive CF, with proficiency uncertainty preserved.
4. No frozen Contract, public schema/API, fixture, prompt, provider/model configuration, retry, timeout, or product surface changed.

Focused `3 files / 148 tests`, full `33 files / 645 tests`, lint and production build PASS. Audit, immutable commit and complete replacement matrix remain.
