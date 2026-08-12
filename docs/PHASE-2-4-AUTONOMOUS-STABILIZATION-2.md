# Phase 2.4 Autonomous Deterministic Stabilization 2

> Date: 2026-08-12
> Evidence baseline: `366b139f96de6201ed76149ec9a54ead670ce30b`
> Input evidence: autonomous RB-05 batch 1, all three immutable artifacts

## Root-cause set

Batch 1 exposed three bounded, Contract-determinable behaviors:

1. Existing ISSUE-031: an explicit status-before-parenthesized MI group was treated as ambiguous because suffix resolution accepted only a single MI ref.
2. ISSUE-037 adjacent lexical entailment: `参与团队项目` is a strictly weaker claim supported by CF-003 `与四人团队共同完成……我协助……`, but raw n-gram overlap did not recognize it.
3. Existing ISSUE-029/033 generation robustness: repair sometimes repeated an unreferenced sibling negative inside unknown, or applied `课程/非正式工作` to CF-003 without independent support.

No Product Contract, public Schema or architecture decision was needed.

## Implementation

- Recommendation R-C now binds every explicit MI in a status suffix parenthesis and checks each member for contradiction. A multi-MI group is no longer collapsed or silently accepted.
- Match lineage adds one conservative semantic downgrade: a positive fact with team + project/assignment + actual involvement (`参与/共同完成/协助/负责/承担`) can support the weaker statement that the candidate participated in a team project. Missing team context, missing project involvement and ownership upgrades remain rejected.
- Match prompt/repair v1.4 requires unknown + empty evidence to use evidence absence only; a sibling fact may be described only as an explicit `CF-xxx` evidence-relation boundary. It forbids `未排除可能性`, unreferenced direct Candidate negatives, and any course/formal/internship qualifier not independently owned by every referenced CF. Repair should reuse canonical wording or a strictly weaker source fragment.

## Exact regressions

- Batch run-1 Recommendation initial and repair exact raw now pass R-C; both MI-001 and MI-003 remain verified as partial.
- An explicit contradictory status suffix group produces one contradiction per MI member.
- Batch run-2 exact Match repair no longer receives a false issue for `候选人参与团队项目`, but remains rejected for the unreferenced Candidate negative/meta wording. Gate strictness is preserved.
- Team-less fact, project-less fact and ownership upgrade controls remain rejected.

## Deterministic Gate

- New red baseline: 6 failures / 3 safety controls passing.
- New focused matrix: 9/9 PASS.
- Match targeted: 145/145 PASS.
- Recommendation targeted: 83/83 PASS.
- Full suite: 23 files / 548 tests PASS.
- Lint: PASS.
- Production build: PASS.
- Diff/scope/secret checks: PASS.
- Model calls / E2E during implementation: 0.

## Disposition

- ISSUE-031: deterministic restabilization PASS / runtime revalidation pending.
- ISSUE-037: second bounded deterministic stabilization PASS / runtime revalidation pending.
- ISSUE-029/033: guard behavior unchanged; prompt robustness strengthened / runtime revalidation pending.
- Phase 2.4 remains BLOCKED; Phase 2.5 remains NOT AUTHORIZED.
