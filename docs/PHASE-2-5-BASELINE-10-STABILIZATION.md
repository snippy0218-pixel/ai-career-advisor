# Phase 2.5 baseline 10 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `28c0ccf080f9a1659cbc3f5ed56c1716fbe562b6`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `b596ca0a7677c1b9d9be14b784bca4b0b4cb5713dcad65c56e3f857f733a87b0`
> Disposition: complete non-passing content evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Result and exact failures

The fixed `TC-P2-01..14 × 3` batch completed on one live production server and immutable commit: `40/42` PASS, `40` complete chains, downstream-after-failure `0`. Baseline-9 failures TC-P2-02, TC-P2-04 and TC-P2-10 all passed 3/3. No run 4, selected rerun, composition, overwrite, or deletion occurred.

- TC-P2-11 R1: Strength/Gap initial and repair had a removable optional transferable Strength plus an evidence action using the conditional wording `如果确实有真实经历，请描述...`. SG-H accepted `说明` but rejected the synonymous `描述` verb, despite the explicit non-fabrication condition.
- TC-P2-14 R1: Strength/Gap initial and repair stated `现有证据...尚不足以证明独立负责客户沟通`. SG-N treated the desired-state qualifier inside `不足以证明` as an asserted Candidate modifier.

Both chains stopped at Strength/Gap and made zero Greeting calls.

## 2. Bounded stabilization and deterministic evidence

1. SG-H evidence actions accept `描述` only under the unchanged conditional/non-fabrication rule; an unconditional request to describe an invented experience remains rejected.
2. Unsupported-modifier scanning recognizes `不足以确认/证明` as a local negative evidence boundary. Direct unsourced `独立负责` remains rejected.
3. No Contract, public schema/API, fixture, prompt, provider/model setting, temperature, retry, timeout, or product surface changed.

Verification: focused `5 files / 90 tests` PASS; full `33 files / 636 tests` PASS; lint zero warnings; TypeScript and production build PASS. Diff/scope/secret/process audit, immutable commit, and complete replacement matrix remain.
