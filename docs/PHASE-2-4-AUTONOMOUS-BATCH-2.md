# Phase 2.4 Autonomous E2E Batch 2

> Date: 2026-08-12
> Frozen HEAD: `main / 4f026aa87f63a3ffef6f6d7473be11184284c551`
> Product implementation commit: `f8567f44f12bb1233c601798794553ffecf1ad48`
> Policy: exactly three `E2E-RB-05` executions, same fixture/server/config, no code changes between runs

## Execution result

All three invocations passed the five-route acceptance capability preflight with model calls 0 before business execution. Exactly three business executions occurred; no fourth run was added.

| Run | JD | Profile | Match | Recommendation | Strength/Gap | Greeting | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 200 / 9,874 ms | 200 / 2,329 ms | 200 / 10,957 ms / repair accepted | 200 / 2,961 ms / repair 0 | 200 / 3,740 ms / repair 0 | 200 / 3,543 ms / repair failed / personalized fallback used | complete / all X-A～X-J true |
| 2 | 200 / 7,493 ms | 200 / 2,308 ms | 200 / 12,010 ms / repair accepted | 502 / 4,641 ms / repair rejected | not called | not called | stopped at Recommendation |
| 3 | 200 / 7,142 ms | 200 / 2,224 ms | 502 / 11,717 ms / repair rejected | not called | not called | not called | stopped at Match |

Batch result: `1/3 completed chains`. Both failures have downstream calls 0 and no incomplete invariant was marked passed.

## Run 1

The full chain completed. Candidate/JD lineage, status/unknown/negative stability, modifier integrity, waiver integrity, semantic preservation, reference continuity and no-circular-truth all passed. Match used one accepted repair; Recommendation and Strength/Gap passed initial output. Greeting initial/repair did not validate and the deterministic personalized safe fallback completed the product chain; Phase 1 fallback was not used.

This is positive runtime evidence for Match/Recommendation/SG reachability and ISSUE-030 legal SG boundary acceptance. It does not erase runs 2/3 or OBS-006 greeting fallback frequency.

## Run 2

Match completed after repair. Recommendation initial and repair were rejected by R-C only:

- `MI-001（Python 基础）与 MI-003（跨团队项目参与）为部分满足`;
- `MI-004（学历）已满足`.

The MI owners and statuses are explicit and correct. Current R-C handles raw prefix groups and suffix-parenthesis groups, but not an MI followed by a descriptive parenthesis before the status. This is an existing ISSUE-031 deterministic false positive. Recommendation rejected-output evidence captured initial/repair raw, codes and messages, providing ISSUE-028 Recommendation runtime evidence.

## Run 3

Match initial and repair were rejected for `不足以构成熟练掌握的正证` by both lineage and M-K. This clause is an evidence-force boundary, not a proficiency assertion. The two validators implement boundary semantics independently and disagree with the legal phrase.

Deeper audit also found that the same raw projects CF-004 employment counter-evidence into domain/responsibility and narrates CF-003 while structured candidate evidence contains only CF-004. Those `CF-xxx 表明/涉及...` factual forms were not selected by the current Candidate assertion classifier. Merely allowing the terminal boundary phrase would risk releasing cross-dimension contamination; cycle 3 must add explicit CF factual-clause enforcement and retain the meta-evidence exception.

## Disposition

- ISSUE-031: stabilization cycle 3 required for described-prefix MI groups.
- ISSUE-037 / shared candidate-boundary semantics: stabilization cycle 3 required; this is the final autonomous cycle for the same broad lexical/lineage root.
- ISSUE-029/033: run-3 deeper raw confirms guards need explicit CF factual-clause coverage before acceptance.
- ISSUE-028: Recommendation rejected-output runtime evidence observed in run 2.
- Phase 2.4 remains BLOCKED; Phase 2.5 remains NOT AUTHORIZED.

## Artifacts

- run 1: `phase-2-4-autonomous-baseline-2-rb-05-batch-run-1.json`, SHA-256 `d5a42080b3b157bc78e4ed30afaa57fbb549300a1e111ce610ef15c4ad89a832`.
- run 2: `phase-2-4-autonomous-baseline-2-rb-05-batch-run-2.json`, SHA-256 `755f35fa2c9eac3568e2c04d0734bc7e999963584d401bda886239fd8427e08c`.
- run 3: `phase-2-4-autonomous-baseline-2-rb-05-batch-run-3.json`, SHA-256 `60f3ee5b1175d1e5cead270acdc00113f0dd7b4c8bfd38b29eaf185de0ec5621`.

All historical artifacts remain immutable.
