# Phase 2.4 Autonomous Deterministic Stabilization 3

> Date: 2026-08-12
> Evidence baseline: `31e8f25d68534978f985dd9c31e812b7c87c93c4`
> Input evidence: autonomous RB-05 batch 2, all three immutable artifacts
> Budget: final autonomous implementation cycle for the same broad lineage/status lexical root

## Bounded architecture review

Batch 2 showed two pairs of duplicated or incomplete semantics:

- Match lineage recognized some evidence-force boundaries, while M-K independently interpreted the embedded requirement qualifier as a Candidate proficiency assertion.
- Candidate factual assertions beginning with `CF-xxx` could avoid the existing candidate-pronoun classifier, allowing a structured ref list to omit a narrated CF and allowing employment counter-evidence to escape dimension-local review.
- Recommendation R-C understood bare prefix groups and suffix MI parentheses, but not explicit MI refs carrying descriptive parentheses before the status.

The fix centralizes the first semantic and extends ownership resolution rather than adding isolated business-term exceptions.

## Implementation

### Shared evidence-force semantics

New internal helper `candidate-claim-semantics.ts` recognizes a bounded evidentiary operator (`不构成`, `不能作为`, `无法作为`, `不足以作为/构成`) only when it leads to `正证/反证/证据/支持`. Match lineage uses the clause classifier; M-K uses qualifier-position-aware detection so an earlier asserted qualifier is never hidden by a later boundary.

### Explicit CF factual ownership

`CF-xxx 表明/说明/显示/涉及/...` factual clauses now enter M-CANDIDATE-LINEAGE. Every explicitly narrated CF must appear in that dimension's structured `candidateEvidence`; ordinary fact support and dimension-local negative support still apply. The existing `CF-xxx 仅否定/说明...不构成...` meta-evidence exception remains bounded by CF existence, polarity and supported scope.

### Recommendation described-prefix groups

R-C now parses groups such as `MI-001（Python 基础）与 MI-003（跨团队项目参与）为部分满足` and the single `MI-004（学历）已满足`. Every resolved member is checked. Comma-separated prior parenthetical status clauses are not merged, preserving the old owner behavior and genuine ambiguity fail-closed.

## Regression evidence

- Batch-2 exact Recommendation initial/repair now pass; a contradicted described group yields MI-001 and MI-003 issues separately.
- Batch-2 `不足以构成熟练掌握的正证` passes both Match lineage and M-K without treating proficiency as asserted.
- After removing that terminal boundary, the exact run-3 raw is rejected at both domain and responsibility for deeper explicit-CF/dimension violations.
- Same-dimension `CF-001 表明信息管理本科` remains accepted.
- Earlier ISSUE-029～037 exact artifacts and parenthetical/status controls remain in the targeted suites.

## Deterministic Gate

- Focused red baseline: 6 failures / 2 safety controls passing.
- Focused post-fix: 8/8 PASS.
- Match targeted: 150/150 PASS.
- Recommendation targeted: 86/86 PASS.
- Full suite: 23 files / 556 tests PASS.
- Lint: PASS.
- Production build: PASS.
- Diff/scope/secret checks: PASS.
- Model calls / E2E during implementation: 0.

## Disposition

ISSUE-031 and ISSUE-037 enter final runtime revalidation. If the next fixed batch is still blocked by the same broad status/lineage classification root, autonomous stabilization budget is exhausted and the required disposition is STOP & ESCALATE. Phase 2.5 remains NOT AUTHORIZED.
