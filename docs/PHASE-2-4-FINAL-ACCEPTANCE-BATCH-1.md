# Phase 2.4 Final Acceptance Batch 1

> Execution date: 2026-08-12  
> Frozen implementation: `main / ca9c65dd1a22cf64bbae3fbaef0082bf2643c6ee`  
> Fixture: frozen `E2E-RB-05` (`jdSha256=bf1eea5f...f4a60`, `profileSha256=0b19712d...25745`)  
> Model settings: `deepseek-v4-flash`, temperature `0.1`, max tokens `8192`; no inter-run changes

## Gate result

Exactly three model-backed runs were executed and then stopped. Completed chains: **0/3**. No fourth run was performed. All three Match stages returned HTTP 200 after one repair and bounded normalization; the batch therefore provides positive runtime evidence for the ISSUE-033 generation-contract stabilization. Downstream blocking moved to Recommendation and Strength/Gap.

| Run | JD | Profile | Match | Recommendation | Strength/Gap | Greeting | Stop | downstream after failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 200 / 7385 ms | 200 / 1900 ms / repair 0 | 200 / 10450 ms / repair 1 | 502 / 5076 ms / repair 1 | not run | not run | recommendation | 0 |
| 2 | 200 / 9224 ms | 200 / 2090 ms / repair 0 | 200 / 9938 ms / repair 1 | 200 / 2243 ms / repair 0 | 502 / 7263 ms / repair 1 | not run | strengthGap | 0 |
| 3 | 200 / 9235 ms | 200 / 2019 ms / repair 0 | 200 / 11478 ms / repair 1 | 502 / 3753 ms / repair 1 | not run | not run | recommendation | 0 |

## Recommendation adjudication

Run 1 initial and repair were byte-equivalent and rejected with `R-C_AMBIGUOUS_STATUS_ATTRIBUTION` at `summary`: `ambiguous status phrase attribution: 部分满足`. The relevant legal text was `MI-001 仅为部分满足`; MI-001 was partial.

Run 3 initial and repair were byte-equivalent and rejected with the same code/path/message. The relevant legal text was `MI-001（Python 基础了解）与 MI-003（团队协作与参与交付），但均为部分满足`; both MI-001 and MI-003 were partial.

Classification: deterministic R-C false positives caused by missing explicit subject-predicate grammar for `仅为` and described multi-MI groups followed by `，但均为`. This is an ISSUE-031 residual. The validator remains required to reject genuinely unowned or contradictory status phrases.

## Strength/Gap adjudication

Run 2 initial and repair were byte-equivalent. `strengths.2` stated:

> 在团队作业中协助整理需求和测试，可迁移至跨团队项目协作，部分支持主导跨团队项目的要求。

It was rejected with:

- `strengths.2`: `SG-M transferable relation boundary integrity failed`
- `strengths.2.statement`: `SG-B Candidate scope/modifier from Match evidence must be preserved`

The Match source preserved Candidate participation/assistance but the target dimension `主导跨团队项目` was unknown. Assistance does not support leadership. SG-B/SG-M therefore rejected correctly. The repair prompt restored surface qualifiers but did not require deletion of an optional transferable strength when no legal relationship statement can be formed. Classification: Strength/Gap generation-contract robustness defect; validator fail-closed behavior is correct.

## Artifact preservation

| Artifact | SHA-256 |
| --- | --- |
| `acceptance-artifacts/phase-2-4-final-acceptance-rb-05-run-1.json` | `1DA05DF42F5CE2EC73F9C65398F1FFEC697BFAEC7D1037C46EB34CB29A13594F` |
| `acceptance-artifacts/phase-2-4-final-acceptance-rb-05-run-2.json` | `B78DF7817149D874DAAE46FDBE96C9BE7C79B457BF2A24D973684FB174AD0D2C` |
| `acceptance-artifacts/phase-2-4-final-acceptance-rb-05-run-3.json` | `E25327293043C4C86330A8C63BD32AF798C0CA8E381A1495C6D5AD997B6BBC69` |

The artifacts retain initial/repair raw outputs, structured validation issues, stage lifecycle, request IDs, latency, repair/fallback state, Match normalization diagnostics, and failure context. They were created independently and no prior artifact was overwritten.

## Disposition

- ISSUE-033: runtime structural path observed as accepted in 3/3 Match stages; retain open until final closure audit.
- ISSUE-031: reopen active stabilization for the two exact legal attribution grammars while preserving contradiction and ambiguity fail-closed controls.
- ISSUE-038: establish Strength/Gap optional-transferable generation-contract robustness for correct omission of an unsupported optional strength after SG-B/SG-M rejection.
- Phase 2.4 remains `FAIL / BLOCKED / AUTONOMOUS STABILIZATION ACTIVE`.
- Phase 2.5 remains `NOT AUTHORIZED`.

