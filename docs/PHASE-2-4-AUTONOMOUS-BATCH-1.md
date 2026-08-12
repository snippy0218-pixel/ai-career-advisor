# Phase 2.4 Autonomous E2E Batch 1

> Date: 2026-08-12
> Frozen HEAD: `main / 894f3b42d2090f20fcaba93bc82fd95a392e5fbe`
> Product implementation commit: `5dd7d06bff472a04a57020f9633326589487ea7f`
> Policy: exactly three `E2E-RB-05` executions, same fixture/server/config, no code changes between runs

## Preflight and scope

- Git was clean before execution; all three target artifact paths did not exist.
- Production build from the frozen HEAD was used.
- Five acceptance diagnostics flags were enabled only in the server process; production defaults did not change.
- Every runner invocation passed the five-route actual capability preflight with `modelCalls=0` before business execution.
- Frozen fixture, provider/model, retry, timeout, fallback and Product Contract were unchanged.
- Exactly three business executions were performed; no fourth run or result selection occurred.

## Stage matrix

| Run | JD | Profile | Match | Recommendation | Strength/Gap | Greeting | Stop | Downstream after failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 200 / 7,559 ms | 200 / 2,027 ms / repair 0 | 200 / 10,567 ms / repair 1 accepted | 502 / 4,773 ms / repair 1 rejected | not called | not called | recommendation | 0 |
| 2 | 200 / 9,465 ms | 200 / 2,232 ms / repair 0 | 502 / 11,372 ms / repair 1 rejected | not called | not called | not called | match | 0 |
| 3 | 200 / 9,056 ms | 200 / 2,018 ms / repair 0 | 502 / 12,427 ms / repair 1 rejected | not called | not called | not called | match | 0 |

Batch result: `0/3 completed chains`. No invariant audit was marked passed on an incomplete chain.

## Run 1 adjudication

Match initial reused CF-004 employment counter-evidence in domain/responsibility and was correctly rejected. Repair produced the Contract-correct structure: employment_type `unmet / CF-004 counter`; domain and responsibility `unknown / refs=[]`. Match returned 200, proving ISSUE-037 exact CF meta-evidence form at runtime.

Recommendation initial and byte-equivalent repair were rejected only for:

> `R-C_AMBIGUOUS_STATUS_ATTRIBUTION: 部分匹配`

The sentence `Python 技能与跨团队项目经验为部分匹配（MI-001、MI-003）` explicitly assigns one partial status to MI-001 and MI-003; both Match items are `partial`. This is a deterministic false positive within existing ISSUE-031 status attribution, caused by suffix-parenthesis resolution accepting only one ref.

## Run 2 adjudication

Match initial contained correct guard triggers: CF-004 negative reuse in sibling dimensions and course qualifier propagation. Repair corrected statuses to domain/responsibility unknown but still contained unreferenced direct Candidate negatives with `candidateEvidence=[]`; those must remain rejected under Candidate Truth. The anaphoric `该否定` explanation and `未排除……可能性` are generation/repair robustness debt, not a reason to waive lineage.

Separately, `候选人参与团队项目` with CF-003 was rejected although CF-003 states that the candidate completed a data-display assignment with a four-person team and assisted requirements/testing. The claim is strictly weaker than the fact and semantically supported. This exposes conservative lexical entailment incompleteness inside `M-CANDIDATE-LINEAGE`, adjacent to ISSUE-037 rather than a new sentence-level Issue.

## Run 3 adjudication

Repair corrected REQ-002 to the valid ISSUE-037 meta-evidence form, which was accepted. It still described CF-003 as `课程项目非正式工作`; CF-003 independently contains neither qualifier. `M-CANDIDATE-LINEAGE` and M-K correctly rejected this cross-CF experience-type contamination. This is Match generation/repair robustness under existing ISSUE-029/033 guardrails, not validator failure.

## Disposition

- ISSUE-037: runtime path observed in runs 1 and 3; local classifier fix works for the exact authorized form. Broaden current stabilization (no new Issue number) to safe weaker-entailment recognition and repair-output constraints.
- ISSUE-031: existing Issue restabilization required for explicit status-before-parenthesized multi-MI groups.
- ISSUE-029/033: guards preserved; repair prompt needs stronger canonical wording and qualifier ownership instructions.
- ISSUE-028/030/Greeting: not fully reached; closure remains pending.
- Phase 2.4 remains BLOCKED; Phase 2.5 remains NOT AUTHORIZED.

## Artifacts

- run 1: `phase-2-4-autonomous-issue-037-rb-05-batch-run-1.json`, SHA-256 `cdfe5390de10643498a072fae20c5a20f333c054775d74e449b53472c000b0ea`.
- run 2: `phase-2-4-autonomous-issue-037-rb-05-batch-run-2.json`, SHA-256 `eddbb0472c70ca7364fa8567928bd61393ae0b64605e374495f414f40cdca91e`.
- run 3: `phase-2-4-autonomous-issue-037-rb-05-batch-run-3.json`, SHA-256 `e92aa4d955b11d0e8fc1e1d9fffb6862ea47ec140e292287989221de1449d823`.

Historical artifacts were not overwritten. The accidental default-path runner invocation during CLI discovery failed at preflight with model calls 0; the affected tracked file was immediately restored and verified by exact Git blob hash before this batch.
