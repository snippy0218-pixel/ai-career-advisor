# Phase 2.4 Match Generation-Contract Stabilization

> Date: 2026-08-12
> Starting HEAD: `68d91757348a02abf0b022f6d6b23b435721cbdc`
> Phase: `2.4 FAIL / BLOCKED / AUTONOMOUS STABILIZATION ACTIVE`
> Phase 2.5: `NOT AUTHORIZED`

## Root cause

Batch 3 did not expose a validator defect. The legal ISSUE-037 explicit-negative boundary was accepted at runtime. The repeated Match failures came from generation/repair contract asymmetry:

1. System rule 17 forbade positive Candidate narration in `unknown + candidateEvidence=[]`.
2. The repair-specific “GOOD” example contradicted that rule by narrating a positive team-project CF in an unknown evidence boundary.
3. M-K could identify unsupported ownership/responsibility synthesis, but repair received no mandatory field transition. The model therefore rewrote `协助/参与` into `个人职责/个人交付正证` instead of changing the dimension to unknown.
4. A second free-language repair could still fail after the only model repair, even though a conservative Contract-valid representation was mechanically available.

The systemic defect was therefore not one missing phrase. It was the absence of one shared state-language contract plus a bounded terminal normalization between rejected repair and final validation.

## Architecture

### Shared generation semantics

Match core/repair prompts are v1.5. Both now use the same matrix:

- `met/partial/unmet`: Candidate language may only describe referenced CF content independently supported by canonical statements.
- `unknown`: refs remain empty and reason may not narrate a positive CF id, statement, or paraphrase.
- `协助/参与/共同完成` cannot imply personal ownership, responsibility for delivery results, leadership, or independent responsibility.
- M-K-only failures activate the same field-level repair instructions as M-CANDIDATE-LINEAGE failures.
- An invalid met/partial ownership claim must become unknown with empty refs instead of being natural-language rewritten.

The prior contradictory positive-CF unknown example was removed.

### Bounded terminal normalization

`match-normalization.ts` operates only after a raw-schema-valid model repair is rejected on a dimension `reason` by existing `M-CANDIDATE-LINEAGE` or `M-K` guards.

- rejected `unknown`: rebuilds a no-Candidate-claim uncertainty reason; refs remain empty;
- rejected `met/partial`: conservatively downgrades that dimension to unknown, clears Candidate refs, and supplies missing-information/question fields only when absent;
- `unmet`: never normalized, because discarding explicit counter-evidence would change a known negative conclusion;
- reference/schema/status/non-reason failures: never normalized;
- item aggregate is recomputed after any safe downgrade;
- the entire raw schema and all existing Match semantic/evidence/modifier validators run again; any remaining issue returns 502.

This is not a validator exception and does not accept the rejected model text. Raw repair evidence remains rejected; only the separately recorded normalized copy can become the final result after full revalidation.

### Auditability

Acceptance diagnostics now distinguish:

- initial raw and issues;
- repair raw and issues;
- whether normalization was attempted/succeeded;
- per-dimension actions, removed CF refs and status transition;
- normalized repair output and post-normalization issues;
- runtime model, temperature and max-output-token metadata.

The full normalized output is acceptance-body-only and excluded from response headers, like rejected raw evidence. Route request ID and downstream stage state remain runner evidence.

## Deterministic verification

- Match normalization/prompt/deepseek/schema/modifier/route/runner targeted: 191/191 PASS.
- Full suite: 25 files / 571 tests PASS.
- Lint: PASS / 0 warnings.
- Production build: PASS.
- Diff check: PASS.
- Secret scan: PASS.
- Model calls: 0.

Coverage includes:

- raw and repair prompt symmetry;
- M-K-only repair activation;
- illegal positive narration in unknown;
- multiple equivalent ownership paraphrases;
- legitimate ownership explicitly present in a canonical CF;
- met/partial/unknown/unmet boundaries;
- non-normalizable schema/reference/unmet failures remaining fail-closed;
- aggregate recomputation and sibling preservation;
- exact batch-3 model run 1 and run 3 initial/repair replay through final normalized validation;
- acceptance-only raw/repair/normalized evidence separation;
- existing ISSUE-029/030/031/032/033/037 and downstream-stop regressions through the full suite.

## Disposition

ISSUE-033 moves to `STRUCTURAL FIX IMPLEMENTED / DETERMINISTIC PASS / FINAL 3-RUN ACCEPTANCE PENDING`. ISSUE-037 original legal-boundary behavior remains runtime verified. Phase 2.4 remains FAIL/BLOCKED until a new fixed three-run batch and closure audit pass. Phase 2.5 remains NOT AUTHORIZED.
