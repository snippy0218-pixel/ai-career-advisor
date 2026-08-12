# Phase 2.4 ISSUE-037 Match Meta-evidence Boundary Stabilization

> Date: 2026-08-12
> Starting baseline: `main / 9ac1537778e346c4616df92b988ac5bd2efd928a`
> Scope: internal Match deterministic validation and exact regression only

## Root cause

`candidateAssertionClauses` split Match reason on punctuation and classified every remaining fragment independently. A complete legal unknown boundary such as:

> 现有资料未表明候选人具有独立负责数据产品的经验；CF-004 仅否定正式工作经历，不构成对独立负责能力的明确反证。

became three fragments. The first was recognized as an evidence boundary, but the latter two contained Candidate vocabulary and were treated as factual assertions. Because a Contract-correct unknown dimension must keep `candidateEvidence=[]`, `M-CANDIDATE-LINEAGE` rejected the legal repair.

This is a deterministic false positive, not cross-CF qualifier propagation and not unsupported Candidate negative generation.

## Bounded fix

The validator now distinguishes two evidence-relation explanations from Candidate factual assertions:

1. A bounded statement about the scope of an explicitly named CF, such as `CF-004 仅否定正式工作经历`.
2. A statement denying evidentiary force, such as `不构成……明确反证` or `不能作为……反证`.

The first class is accepted only when every named CF exists, an asserted negative scope points to a counter-polarity fact, and the normalized explained scope is contained in that fact. Arbitrary `证明` wording, missing CF IDs, fabricated interpretations and unsupported Candidate conclusions remain factual assertions and fail closed.

No prompt, Product Contract, public Schema, frozen fixture, provider/model configuration, retry/timeout/fallback or other module changed.

## Exact evidence

Source artifact:

- `docs/acceptance-artifacts/phase-2-4/phase-2-4-post-035-036-replacement-rb-05.json`
- SHA-256: `5febd1400a781771d5f5cccb5414e2ef3ac40bfbc9ed9843f970f00afcb8fb82`

The exact initial raw continues to fail on unsupported domain/responsibility Candidate claims and course cross-CF contamination. The exact repair raw now passes with:

- employment_type `unmet`, `candidateFactRefs=[CF-004]`;
- domain `unknown`, `candidateFactRefs=[]`;
- responsibility `unknown`, `candidateFactRefs=[]`.

## Regression matrix

- E37-1 supported CF scope explanation: PASS.
- E37-2 equivalent evidence-force explanation: PASS.
- E37-3 boundary followed by unsupported Candidate negative: rejected.
- E37-4 fabricated CF interpretation disguised as meta-evidence: rejected.
- E37-5 missing CF reference: rejected.
- E37-6 cross-dimension inability conclusion after legal meta clause: rejected.
- E37-7 unbounded evidence verb: rejected.
- E37-8 exact initial artifact raw: rejected.
- E37-9 exact corrected repair raw: PASS with empty unknown refs preserved.

## Deterministic Gate

- Pre-change baseline: 23 files / 530 tests PASS; ISSUE-037 focused 3 red / 6 green.
- Post-fix focused: 9/9 PASS.
- Match targeted: 140/140 PASS.
- Full suite: 23 files / 539 tests PASS.
- Lint: PASS.
- Production build: PASS.
- Diff check / forbidden-surface check / secret scan: PASS.
- Model calls / E2E executions: 0.

## Engineering disposition

`ISSUE-037 = LOCAL FIX VERIFIED / E2E PENDING`.

Phase 2.4 remains BLOCKED until the frozen model-backed evaluation batch and final Issue closure audit complete. Phase 2.5 remains NOT AUTHORIZED.
