# Phase 2.5 baseline 14 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `a5ff6eb8e58caae4374e0602edfdc55167e6239f`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `b8edd8cd50141cc1c0e3c413cba7c04e19d654ea187099803a0eb6262d194d08`
> Disposition: complete non-passing content evidence retained; a complete replacement matrix is required.

## Result and failure adjudication

The immutable `14×3` batch completed at `40/42` PASS, `40` complete chains and downstream-after-failure `0`. Both Baseline-13 failure cases passed 3/3. No run 4, partial rerun composition, or in-batch change occurred.

TC-P2-10 R1/R3 both stopped at Match after the initial output correctly triggered M-DURATION. Repair changed the numeric shortfall to `unmet` but phrased the JD threshold as a Candidate assertion (`明确少于要求的3年` / `明确少于3年要求`), which M-CANDIDATE-LINEAGE and M-K correctly rejected.

## Bounded stabilization and verification

Match terminal recovery extends the existing M-DURATION rule to an already-`unmet` repair reason only when one counter CF contains an explicit numeric duration below the current JD numeric duration. It rebuilds the reason from the exact CF statement plus the numeric comparison, preserves status and refs, and reruns the full validator. Unsupported or non-numeric relations remain fail-closed.

No frozen Contract, public schema/API, fixture, prompt, provider/model configuration, retry, timeout, or product surface changed. Focused `3 files / 146 tests`, full `33 files / 643 tests`, lint and production build PASS. Audit, immutable commit and complete replacement matrix remain.
