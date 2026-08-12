# Phase 2.4 ISSUE-031 / ISSUE-038 Stabilization

> Starting evidence commit: `7690573…`
> Product baseline under test: `ca9c65d…`
> Scope: Recommendation status ownership + Strength/Gap optional transferable generation contract
> Model calls during implementation: 0

## 1. Root-cause audit

Final acceptance batch 1 was fixed at three runs and preserved before implementation. Match reached HTTP 200 in 3/3. The blockers were not one shared validator defect:

- Run 1/3 Recommendation: R-C could not bind legal `MI-001 仅为部分满足` or a described multi-MI subject followed by `，但均为部分满足`. The referenced MI statuses were partial. Classification: ISSUE-031 deterministic false positive.
- Run 2 Strength/Gap: the model converted `协助整理需求和测试` into partial support for the unknown `主导跨团队项目` dimension. SG-B/SG-M correctly rejected initial and byte-equivalent repair. Classification: generation/repair robustness defect, established as ISSUE-038.

## 2. Architecture change

### Recommendation

- R-C prefix ownership recognizes `仅为` as an explicit MI predicate.
- Described MI groups recognize bounded discourse forms such as `MI-001（…）与 MI-003（…），但均为 partial`.
- Every member is still checked independently. A mixed partial/met group claiming `均为 partial` remains a contradiction.
- raw/repair prompt v1.5 requires every status phrase to have a direct MI subject and gives R-C repair an explicit field-level rewrite. No Recommendation level, waiver, unknown, reference, or Contract rule changed.

### Strength/Gap

- raw/repair prompt v1.2 makes transferable strengths explicitly optional and dimension-local. Positive participation cannot support an unknown leadership/ownership dimension; irreparable optional relations must be deleted.
- A terminal normalizer may remove only schema-valid `transferable_strength` entries already rejected by SG-B or SG-M after the one model repair.
- It cannot alter Match Core, gaps, direct/supporting strengths, statements, refs, actions, or statuses. It never creates a strength or claim.
- The normalized object must pass the complete existing SG-A～SG-N validator. Any mandatory coverage, reference, truthfulness, unknown, gap, or action failure remains a 502.
- acceptance diagnostics preserve raw repair as rejected and separately record normalization action, normalized output, full revalidation issues, and frozen model settings. Raw normalized output is excluded from response headers.

## 3. Exact replay and safety matrix

- Final batch-1 Recommendation run 1/3 initial + repair: 4/4 exact raw outputs accepted.
- R-C mixed-status described group: rejected with `R-C_STATUS_CONTRADICTION` and correct MI ownership.
- Final batch-1 Strength/Gap run-2 exact repair: raw remains SG-B/SG-M rejected; optional MI-003 relation removed; all five gaps preserved; normalized output passes full validator.
- Direct/supporting strengths are never normalizable.
- Schema/reference/gap/unrelated semantic failures are never normalizable.
- Raw repair evidence remains `rejected=true / semantic_validation`; normalized acceptance is a separate diagnostic layer.

## 4. Deterministic Gate

- Focused Recommendation + Strength/Gap: 7 files / 136 tests PASS.
- Full regression: 28 files / 584 tests PASS.
- ESLint: PASS, 0 warnings.
- Production build and TypeScript: PASS.
- `git diff --check`: PASS after documentation cleanup.
- Secret scan: no committed credential; only existing test placeholders.
- Frozen Phase 2 Contract/public schemas/RB-05 fixture/model/temperature/retry/timeout: unchanged.

## 5. Engineering disposition

- ISSUE-031: `LOCAL RESTABILIZATION VERIFIED`.
- ISSUE-038: `LOCAL FIX VERIFIED`.
- ISSUE-033: final batch-1 Match runtime path remains accepted 3/3; closure still requires a clean completed-chain batch.
- Phase 2.4 remains `FAIL / BLOCKED / AUTONOMOUS STABILIZATION ACTIVE` until a new committed baseline completes fixed exactly-three E2E at 3/3.
- Phase 2.5 remains `NOT AUTHORIZED`.
