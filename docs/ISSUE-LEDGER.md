# Phase 2.4 Issue Ledger

本表是当前状态索引；根因和历史细节仍以各 Issue/E2E 文档及 immutable artifacts 为准。

| Issue | Severity | Current engineering disposition | Remaining closure evidence |
| --- | --- | --- | --- |
| ISSUE-028 Rejected-output evidence preservation | P1 | CLOSED / final batch preserves rejected raw + structured issues + normalization/lifecycle | regression only |
| ISSUE-029 Cross-CF Candidate scope contamination | P1 | CLOSED / final accepted Match 3/3 contamination 0 | regression only |
| ISSUE-030 SG-E valid evidence-boundary false positive | P1 | CLOSED / final Strength-Gap initial 3/3 PASS | regression only |
| ISSUE-031 Recommendation status attribution | P1 | CLOSED / exact grammar replay + final initial 3/3 PASS | regression only |
| ISSUE-032 runner artifact-state semantics | P1 | CLOSED / infrastructure and complete-chain lifecycle artifacts PASS | regression only |
| ISSUE-033 Match generation-contract / repair unsupported Candidate claim stability | P1 | CLOSED / final Match repair+normalization path 3/3 PASS | regression only |
| ISSUE-034 dimension-local relational conclusion | P1 | CLOSED / final accepted Match preserves dimension-local relation guards | regression only |
| ISSUE-035 Match same-domain evidence polarity | P1 | CLOSED / explicit negative remains counter-only in final Match | regression only |
| ISSUE-036 Match experience-type lexical precision | P1 | CLOSED / final accepted Match has no generic-work qualifier ownership | regression only |
| ISSUE-037 Match lineage semantic classification | P1 | CLOSED / legal boundary accepted, illegal narration not released | regression only |
| ISSUE-038 Strength/Gap optional transferable generation-contract robustness | P1 | CLOSED / final Strength-Gap initial 3/3 PASS, upgrade 0 | regression only |
| ISSUE-039 Phase 2.5 runner infrastructure fail-fast/classification | P1 | CLOSED / provider and transport failures are separated from content samples; runner persists `infrastructure-failure.json` and stops after the first infrastructure failure | regression only |
| ISSUE-040 Phase 2.5 Profile generic-label/evidence-absence coverage | P1 | DETERMINISTIC CLOSED / generic preference, career target, Office/table, travel and missing-category boundaries have focused regression | replacement Phase 2 matrix |
| ISSUE-041 Phase 2.5 Match threshold/relation generation stability | P1 | DETERMINISTIC CLOSED / credential, same-qualified zero-duration, employment and responsibility relations are dimension-local; JD thresholds are not assigned to CFs | replacement Phase 2 matrix |
| ISSUE-042 Phase 2.5 Recommendation absence/question/terminal-summary grammar | P1 | DETERMINISTIC CLOSED / questions are not assertions; bounded fact-free summary normalization reruns full R-A～R-L without weakening waiver/status gates | replacement Phase 2 matrix |
| ISSUE-043 Phase 2.5 duplicate optional Gap recovery | P1 | DETERMINISTIC CLOSED / terminal normalization keeps the first duplicate key and reruns SG-A～SG-N | replacement Phase 2 matrix |
| ISSUE-044 Phase 2.5 X-F assertion scope | P1 | DETERMINISTIC CLOSED / assertions remain audited while questions/actions and locally negated qualifiers are not treated as asserted upgrades | replacement Phase 2 matrix |
| ISSUE-045 Phase 2.5 lifecycle metric aggregation | P1 | DETERMINISTIC CLOSED / summary reads normalized stage repair/fallback lifecycle | replacement Phase 2 matrix |
| ISSUE-046 Phase 2.5 mixed-polarity Candidate atomic claim | P1 | DETERMINISTIC CLOSED / positive activity and explicit negative responsibility are split with unchanged PF lineage | replacement Phase 2 matrix |
| ISSUE-047 Phase 2.5 direct Strength Match-scope preservation | P1 | DETERMINISTIC CLOSED / SG-B-only direct strength rewrite preserves referenced Match scope and reruns SG-A～SG-N | replacement Phase 2 matrix |

## ISSUE-040～045 baseline evidence

- Reproduction: `phase-2-5-baseline-2-35b92ca` is a valid, complete fixed batch: Phase 1 30/30 PASS; Phase 2 11/42 PASS, 19 complete chains, downstream-after-failure 0. All 72 result artifacts are retained and no code/fixture/provider setting changed during the batch.
- ISSUE-040: Profile stopped all TC-P2-13/14 chains on safe but ordinary generic labels and explicit missing-category text.
- ISSUE-041: Match rejected legal JD-threshold relations in TC-P2-02/09/10/12; the stabilization keeps cross-dimension counter reuse fail-closed and only recognizes bounded same-dimension education, duration, employment and responsibility relations.
- ISSUE-042: Recommendation rejected `现有资料未表明...持有...` and `您是否已获得本科学历？`; both are uncertainty/question grammar, not Candidate facts.
- ISSUE-043: TC-P2-05 R1 repeated the same optional Gap type/reference key after repair. Bounded terminal dedupe removes later duplicates only and reruns the complete validator.
- ISSUE-044: eight otherwise complete results failed only because X-F included verification questions/actions in its assertion scan. X-F now scans reasons, summaries, limitation/Strength/Gap statements and Greeting claims, while still rejecting unsourced modifiers in those assertions.
- ISSUE-045: result artifacts recorded repair/fallback attempts, but baseline summary totals were zero because aggregation bypassed normalized stage lifecycle fields.
- Deterministic closure: focused `271/271`, full `607/607`, lint and production build PASS. Runtime closure remains the mandatory new Phase 2 14×3 matrix.

## Baseline 3/4 additional evidence

- `phase-2-5-baseline-3-f7838a1` is a route-flag preflight failure with `requestCount=0`, `modelCalls=0`, and `contentSamples=0`; it is retained and excluded from content acceptance.
- `phase-2-5-baseline-4-f7838a1` is a complete fixed Phase 2 batch on `f7838a1…`: `21/42` PASS, `26` complete chains, and downstream-after-failure `0`. No code, fixture, model, or runner setting changed during its 42 samples.
- ISSUE-041/042/044 received adjacent, non-duplicate runtime evidence: same-qualified duration-zero relation and JD-target ownership; terminal summary ambiguity; and negated qualifier assertion scope. Their bounded deterministic closures were extended without weakening the frozen gates.
- ISSUE-046 reproduction is TC-P2-14 R1/R2: one CF combined `协助登记/整理` with `没有负责招商或项目落地`, causing valid positive activity to inherit counter polarity.
- ISSUE-047 reproduction is TC-P2-12 R2/R3: direct Strength text omitted `参与/协助/团队` scope retained by its referenced Match evidence and was correctly rejected by SG-B after both model attempts.
- Complete adjudication: `PHASE-2-5-BASELINE-4-STABILIZATION.md`. Updated deterministic closure: focused affected suites `312/312` plus integration/boundary `40/40`; full `33 files / 618 tests`; lint and production build PASS. Runtime closure remains a new committed full Phase 2 `14×3` matrix.

## ISSUE-039 closure evidence

- Reproduction: `phase-2-5-baseline-1-0373ad4` scheduled 72 local HTTP requests after five capability probes passed, but every JD adapter returned `AI_SERVICE_UNAVAILABLE` within 5～35 ms with zero completion tokens; all downstream calls were 0.
- Adjudication: the production server ran inside the restricted network sandbox. Provider completions and content samples were 0; the immutable 72 request artifacts remain preserved and are excluded from both formal matrices by `infrastructure-adjudication.json`.
- Fix: central infrastructure classification now includes transport, auth, balance, rate, availability, and timeout failures. The runner writes a separate infrastructure failure artifact and throws before scheduling another top-level request.
- Verification: focused fixture/runner `8/8`, full `599/599`, lint zero warnings, production build/TypeScript PASS, diff check PASS.

## ISSUE-037 root cause record

- Reproduction: replacement RB-05 repair raw in `phase-2-4-post-035-036-replacement-rb-05.json`.
- Failure: legal dimension-local uncertainty explanation is split into fragments and classified as Candidate factual assertion, requiring refs that Contract says must remain empty for `unknown`.
- Distinctness: not ISSUE-029 qualifier contamination; not ISSUE-033 unsupported negative generation; not ISSUE-035 polarity set; not ISSUE-036 lexical work qualifier.
- Authorized surface: internal Match deterministic validator/tests and durable Phase 2.4 records only. No Contract, schema, prompt, fixture, provider or Phase 2.5 change.
- Batch-1 adjacent finding: the same M-CANDIDATE-LINEAGE support layer rejected the weaker `参与团队项目` claim despite CF-003 proving four-person team completion and assistance. The Issue scope now covers bounded evidence-relation classification plus conservative weaker-entailment recognition; no sentence-level Issue was added.
- Batch-2 adjacent evidence: a legal terminal evidence-force boundary was split between Match lineage and M-K, while explicit `CF-xxx` factual narration could omit its CF from structured refs and evade dimension-local review. Cycle 3 centralizes evidence-force semantics and requires explicit CF narration ownership; this exhausts the 3-cycle budget for the broad lineage/status lexical root.
- Batch-3 final evidence: run 1/3 repairs both narrate positive CF-003 facts inside an `unknown` dimension while refs correctly remain `[]`, which the frozen prompt explicitly forbids; lineage correctly rejects both. Both repairs also upgrade assistance into `个人交付/个人职责` evidence and are correctly rejected by M-K. Legal CF-004 explicit-negative scope boundaries are accepted, so original ISSUE-037 behavior is not observed.
- Superseding Gate: per-cycle stop condition is obsolete. ISSUE-033 now covers the full Match generation-contract path. v1.5 removes the contradictory repair example, aligns raw/repair status language, adds field-level ownership actions, and provides bounded terminal normalization followed by all existing validators. Exact batch-3 failures and generalized semantic controls pass; E2E pending.
