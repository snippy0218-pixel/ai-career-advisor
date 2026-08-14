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
| ISSUE-048 Phase 2.5 Match terminal aggregate and compound-domain projection | P1 | DETERMINISTIC CLOSED / aggregate-only repair is recalculated from dimension truth; compound-domain omission requires all conservative domain terms | replacement Phase 2 matrix |
| ISSUE-049 Phase 2.5 Strength/Gap terminal type recovery | P1 | DETERMINISTIC CLOSED / invalid SG-E/SG-F repair gaps are conservatively rewritten, converted, or removed, then SG-A～SG-N reruns | replacement Phase 2 matrix |
| ISSUE-050 Phase 2.5 failed-chain accepted-stage output preservation | P1 | DETERMINISTIC CLOSED / every completed upstream stage is cloned into the run artifact even when a later stage fails | replacement Phase 2 matrix artifact audit |

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

## Baseline 5 additional evidence

- `phase-2-5-baseline-5-83a1810` is a complete fixed Phase 2 batch: `30/42` PASS, `31` complete chains, downstream-after-failure `0`, with all rejected initial/repair raw retained. There was no run 4 or partial rerun composition.
- ISSUE-041 and ISSUE-044 received adjacent exact runtime evidence for requirement-target ownership and desired-state modifier scope; their deterministic boundaries were extended without weakening Candidate/JD truth rules.
- ISSUE-048 is distinct terminal Match behavior: one repair left only a stale aggregate, while a separate conservative compound-domain omission guard treated one generic token as the whole compound domain.
- ISSUE-049 covers Strength/Gap repair outputs whose type or expression remained incompatible with the referenced final Match status. Recovery is limited to fact-free unknown/evidence boundaries or removal of an optional inapplicable gap, followed by the unchanged full validator.
- Complete adjudication: `PHASE-2-5-BASELINE-5-STABILIZATION.md`. Focused `161/161`, relevant targeted `228/228`, full `625/625`, lint and production build PASS; diff/scope/secret, immutable commit, and the new Phase 2 `14×3` matrix remain.

## Baseline 6 additional evidence

- `phase-2-5-baseline-6-8b8cae6` is a complete fixed Phase 2 batch: `35/42` PASS, `39` complete chains, downstream-after-failure `0`; there was no run 4 or partial composition.
- ISSUE-044 exact negative-proficiency outputs failed only runner X-F; all other X-A～X-J invariants and fixture expectations passed on those four complete chains.
- ISSUE-042 received one missing strictness question and one valid natural direct-question order. The bounded fix adds no waiver assertion and reruns the complete Recommendation validator.
- ISSUE-048 received an unsupported team-delivery counter relation. Recovery is restricted to a responsibility dimension with a team-leader/centralized-delivery clause already rejected by M-CANDIDATE-LINEAGE; all previously protected qualification and cross-dimension failures remain fail-closed.
- ISSUE-050 was discovered during failed-chain adjudication: completed upstream stage outputs were held in memory but excluded by `stageEvidence`. The new artifact field is acceptance-only and contains de-identified structured output.
- Complete adjudication: `PHASE-2-5-BASELINE-6-STABILIZATION.md`. Focused `139/139`, full `630/630`, lint, production build, diff/scope/secret/process PASS; immutable commit and a new complete Phase 2 matrix remain.

## Baseline 7 additional evidence

- `phase-2-5-baseline-7-13900bf` is a complete fixed Phase 2 batch: `39/42` PASS, `40` complete chains, downstream-after-failure `0`, with no run 4 or partial composition.
- ISSUE-042 adjacent evidence exposed mixed-status granularity: hard items may be aggregate `unmet` while one orthogonal dimension remains `unknown`. R-K must preserve both truths, not forbid the real aggregate status.
- ISSUE-044 adjacent evidence is a single X-F false positive on missing-duration evidence wording; no other invariant failed.
- ISSUE-050 runtime verification PASS: failed Recommendation artifacts preserve completed JD/Profile/Match structured outputs.
- Complete adjudication: `PHASE-2-5-BASELINE-7-STABILIZATION.md`. Focused `103/103`, full `631/631`, lint, production build, diff/scope/secret/process PASS; immutable commit and a complete replacement matrix remain.

## Baseline 8 infrastructure evidence

- `phase-2-5-baseline-8-6f0eab7` retained all 42 scheduled records, but is excluded from final content acceptance: only `TC-P2-01-R1/R2` completed; the server exited during R3 Match and the remaining 39 executions were local transport failures with no additional content sample.
- This is an ISSUE-039 regression, not a new semantic issue. The runner catch path emitted category `infrastructure_transport_failure`, while fail-fast recognized code `RUNNER_TRANSPORT_FAILURE`; the mismatch is reproduced and corrected in the central predicate.
- Summary SHA-256 is `57cae988a8ab9f991ce1e729df41a99709d71f3b3a2237544220d4919b975580`. Exact regression `8/8`, full `631/631`, lint and build PASS. All artifacts remain immutable and neither successful sample may be cherry-picked. See `PHASE-2-5-BASELINE-8-INFRASTRUCTURE-ADJUDICATION.md`.

## Baseline 9 additional evidence

- `phase-2-5-baseline-9-2b8bc40` is a complete valid Phase 2 content batch: `39/42` PASS, `40` complete chains, downstream-after-failure `0`; the server remained live and there was no run 4 or partial composition.
- ISSUE-041/044 adjacent evidence: TC-P2-02 R2 exposed local threshold/proficiency boundary wording, while TC-P2-10 R1 exposed explicit numeric duration shortfall emitted as `partial`. The bounded correction preserves positive-claim and cross-dimension protections and converts only an exact referenced numeric shortfall to dimension-local `unmet`.
- ISSUE-042 adjacent evidence: TC-P2-04 R1 preserved `partial` but R-C treated `确认是否已满足` as a factual status claim. Hypothetical status grammar is excluded; direct contradiction controls remain.
- Summary SHA-256 is `8535d68c30a852e65ecec6d1207690515a3859597f04b41328618fe178e7e0f9`. Focused `272/272`, full `634/634`, lint and build PASS; scope/secret/process audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-9-STABILIZATION.md`.

## Baseline 10 additional evidence

- `phase-2-5-baseline-10-28c0ccf` is a complete valid Phase 2 content batch: `40/42` PASS, `40` complete chains, downstream-after-failure `0`; all Baseline-9 failures passed 3/3.
- TC-P2-11 R1 and TC-P2-14 R1 stopped at Strength/Gap. The bounded ISSUE-044/049-adjacent correction accepts conditional `描述` as an evidence-action verb and treats `不足以确认/证明` as a local modifier boundary; direct unsourced claims and unconditional experience invention remain rejected.
- Summary SHA-256 is `b596ca0a7677c1b9d9be14b784bca4b0b4cb5713dcad65c56e3f857f733a87b0`. Focused `90/90`, full `636/636`, lint/build PASS; audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-10-STABILIZATION.md`.

## Baseline 11 additional evidence

- `phase-2-5-baseline-11-7460f02` is a valid complete content batch: `40/42` PASS, `41` complete chains, downstream-after-failure `0`; Baseline-10 failures passed 3/3.
- TC-P2-10 R2 completed and failed only X-F on whitespace-equivalent `3 年` versus raw `3年`. TC-P2-11 R2 was correctly rejected for an unsupported substitution example appended to an otherwise valid strictness question.
- Bounded recovery normalizes whitespace only for literal source comparison and replaces only the rejected single-ref substitution question with the canonical strictness question before full validation. Focused `108/108`, full `637/637`, lint/build PASS. Summary SHA-256: `517d5082dc6310b5aa24d98c85ea5e150474788fddc9665f0b190a18343f6b1d`.

## Baseline 12 additional evidence

- `phase-2-5-baseline-12-da1877f` is a valid complete content batch: `40/42` PASS, `41` complete chains, downstream-after-failure `0`; both Baseline-11 failures passed 3/3.
- ISSUE-041 adjacent evidence is an exact same-dimension employment counter followed by a rejected qualifier-free generic relation. Recovery preserves the explicit counter and exact CF text only; cross-dimension or unsupported relations remain fail-closed.
- ISSUE-042 adjacent evidence is an aggregate-unmet MI included in both supporting and counter refs because one sibling dimension was positive. Supporting eligibility now follows X-C aggregate status; terminal recovery removes only the rejected supporting ref and reruns R-A～R-L.
- Summary SHA-256 is `e0cdb9b6f4056edce14bfc914fd56054626a6f4d5887dbadbe85cb81cbe9f760`. Focused `135/135`, full `640/640`, lint/build PASS; audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-12-STABILIZATION.md`.

## Baseline 13 additional evidence

- `phase-2-5-baseline-13-55cc2de` is a valid complete content batch: `40/42` PASS, `41` complete chains, downstream-after-failure `0`; the prior X-C case passed 3/3.
- ISSUE-044 adjacent evidence is a completed result whose only failure was `熟练度及实际应用场景待确认`; the bounded uncertainty lookahead remains within the existing clause window and does not admit an unsourced positive proficiency claim.
- ISSUE-048 adjacent evidence is a repair that corrected an invalid dimension enum but omitted mandatory `employment_type` decomposition for explicit formal-work text. Recovery adds only a fact-free unknown dimension from the same JD evidence and reruns the complete Match validator.
- Summary SHA-256 is `37d0f99628b365eaa08ca37d72593c0ddd45cea8b87fdcb340c318c14d7451cf`. Focused `152/152`, full `641/641`, lint/build PASS; audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-13-STABILIZATION.md`.

## Baseline 14 additional evidence

- `phase-2-5-baseline-14-a5ff6eb` is a valid complete content batch: `40/42` PASS, `40` complete chains, downstream-after-failure `0`; both Baseline-13 failure cases passed 3/3.
- ISSUE-041 adjacent evidence is the same explicit numeric shortfall after repair already set it to `unmet`, but its reason assigned the JD threshold to the CF. Terminal recovery reuses the existing numeric M-DURATION rule, exact CF text, same refs/status, and complete validator.
- Summary SHA-256 is `b8edd8cd50141cc1c0e3c413cba7c04e19d654ea187099803a0eb6262d194d08`. Focused `146/146`, full `643/643`, lint/build PASS; audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-14-STABILIZATION.md`.

## Baseline 15 additional evidence

- `phase-2-5-baseline-15-75be908` is a valid complete content batch: `41/42` PASS, all `42` complete chains, downstream-after-failure `0`.
- ISSUE-041/048 adjacent evidence is a fully valid chain where repair over-corrected explicit skill usage beneath a proficiency threshold to unknown. The same-domain omission Gate now recognizes exact ASCII skill tokens; recovery restores only `partial`, exact CF/ref, and retains proficiency uncertainty.
- Summary SHA-256 is `e74aef6ce847563e4b6b68907ec04a2e17a159b996d8e1d8c4c349521ffb2678`. Focused `148/148`, full `645/645`, lint/build PASS; audit, immutable commit, and a complete replacement matrix remain. See `PHASE-2-5-BASELINE-15-STABILIZATION.md`.

## Baseline 16 regression evidence

- `phase-2-5-baseline-16-0598947` is a complete regression batch: `33/42` PASS, `33` complete chains, downstream-after-failure `0`; TC-P2-10 passed 3/3.
- TC-P2-01/06/07 each failed 3/3 because the Baseline-15 global same-skill omission extension conflicted with M-K terminal downgrade after course/cross-CF contamination. The global extension is removed.
- Terminal-only recovery retains at most one independently supporting exact CF, caps rejected met skill claims at partial, removes contaminated refs, and keeps the aggregate-only proficiency restoration required by Baseline 15.
- Summary SHA-256 is `72897df00ee47d58c38edd464f027971d1aa19187a6b266fb4cd73ab82ad8de1`. Focused `148/148`, full `645/645`, lint/build PASS; a complete replacement matrix remains. See `PHASE-2-5-BASELINE-16-STABILIZATION.md`.

## Baseline 17 additional evidence

- `phase-2-5-baseline-17-4f042e1` completed at `32/42`, downstream-after-failure `0`; TC-P2-10 passed 3/3.
- Ten Match failures share one structural omission after correct terminal `met -> partial`: missingInformation and verificationQuestion were null. Recovery now fills those required uncertainty fields from the same requirement fragment only.
- Summary SHA-256 `92d08c66d6a65106c81385d6fd4c179e012ecdef8b2ba0c55955111eaf6d9acc`; focused `148/148`, full `645/645`, lint/build PASS. See `PHASE-2-5-BASELINE-17-STABILIZATION.md`.

## Baseline 18 additional evidence

- The first attempt is preserved as zero-content infrastructure evidence. Authorized-network replacement `phase-2-5-baseline-18-replacement-a16c088` completed `42/42` at `39/42`, with `40` complete chains and downstream-after-failure `0`.
- TC-P2-04 R2/R3 reproduce one R-C negation-boundary false positive; TC-P2-02 R2 reproduces one X-F uncertainty-boundary false positive after an otherwise valid completed chain. Both are bounded deterministic defects, not new Contract ambiguity or truth failure.
- Content summary SHA-256 `09085fa322cec24646d802957a2928b9cd147afd7d757dd77f93c682de3f854b`; focused `106/106`, full `646/646`, lint/build PASS. See `PHASE-2-5-BASELINE-18-STABILIZATION.md`.

## Baseline 19 additional evidence

- `phase-2-5-baseline-19-aea8eb7` completed all `42/42` at `40/42`, with `40` complete chains and downstream-after-failure `0`; all baseline-18 targets passed 3/3.
- TC-P2-05 R1 and TC-P2-14 R1 are bounded Strength/Gap synonym-boundary false positives (`提供`, `但尚不足以`), with both initial and repair raw outputs preserved and no downstream execution.
- Summary SHA-256 `c9e2bd741eeb554ccb7a90752152f4fe8f29b26f44e8a0cd3359af524fd5a1ff`; focused `57/57`, full `648/648`, lint/build PASS. See `PHASE-2-5-BASELINE-19-STABILIZATION.md`.

## Baseline 20 infrastructure evidence

- `phase-2-5-baseline-20-2a2a56d` recorded ten PASS content samples, then stopped at TC-P2-04 R2 Match on provider `AI_BALANCE_INSUFFICIENT`; completion was not received, completion tokens were 0, and no later request was scheduled.
- The incomplete batch is excluded from content acceptance and cannot be combined with later evidence. Infrastructure artifact SHA-256 is `42a33deb451a48040a6a8386fca8580bb7cd567d5a4ce4ceeabab2a7f4c0c490`.
- External blocker: sufficient DeepSeek account balance is required before one fresh complete baseline-20 replacement. See `PHASE-2-5-BASELINE-20-INFRASTRUCTURE-STOP.md`.

## Baseline 21 additional evidence

- Product Owner / QA restored the provider balance and authorized a fresh matrix. `phase-2-5-baseline-21-2a2a56d` completed all `42/42` scheduled executions at `40/42` PASS, with `41` complete chains, downstream-after-failure `0`, and no run 4. Baseline-20 samples were not reused.
- TC-P2-02 R3 is ISSUE-031-adjacent: a described single owner followed by an explicit plural `均` status conclusion was rejected. The bounded correction requires every possible structured MI to have the claimed status; mixed-status groups remain fail-closed.
- TC-P2-06 R3 is ISSUE-044-adjacent: the completed chain failed only X-F because `正式工作背景未说明` was not recognized as an uncertainty suffix. The correction accepts only nearby `未说明/未表明`; an unsupported positive formal-work claim remains rejected.
- Summary SHA-256 is `93c55006c2cd41e919982be4aaf597e664a0942a3aace593da8d2d98ea5ffb05`. Exact/focused `97/97`, full `652/652`, lint/build/diff/scope/secret PASS. See `PHASE-2-5-BASELINE-21-STABILIZATION.md`.

## Baseline 22 final acceptance evidence

- `phase-2-5-baseline-22-6479978` is the final complete replacement matrix on the frozen
  implementation baseline `6479978`: Phase 2 `14×3` = **42/42 PASS**, 42 complete chains,
  downstream-after-failure `0`, no run 4, no cherry-pick, no infrastructure failure, and no
  reuse of baseline-20/21 samples.
- Preflight: five route capability probes `5/5` enabled with `rejectedOutputCapture=true` and
  model calls `0`. All 42 per-run artifacts pass `X-A～X-J` invariant audit and fixture
  expectation adjudication; summary SHA-256 `372EBEED43233FE53953F2E108B8096E864B550754EA554A5699EDE1BD9E2B83`.
- ISSUE-040～050: runtime closure confirmed — every deterministic fix from baselines 2～21 now
  has complete full-chain runtime evidence at 42/42. No new Issue is created.
- OBS-002 / OBS-005 / OBS-006 and `hrSafeFallbackRate` remain report-only and non-blocking;
  personalized safe fallback 19/42, Phase 1 fallback 3/42 (frozen for TC-P2-13), all safety
  guards pass.
- Deterministic gate: focused 38/38, full `652/652`, lint, production build + TypeScript,
  diff/scope/secret PASS. Final disposition: **PASS / CLOSE PHASE 2.5** (human PO/QA Gate F
  product-score confirmation is the only remaining release step). See
  `PHASE-2-5-FINAL-ACCEPTANCE.md`.

## ISSUE-039 closure evidence

- Reproduction: `phase-2-5-baseline-1-0373ad4` scheduled 72 local HTTP requests after five capability probes passed, but every JD adapter returned `AI_SERVICE_UNAVAILABLE` within 5～35 ms with zero completion tokens; all downstream calls were 0.
- Adjudication: the production server ran inside the restricted network sandbox. Provider completions and content samples were 0; the immutable 72 request artifacts remain preserved and are excluded from both formal matrices by `infrastructure-adjudication.json`.
- Fix: central infrastructure classification now includes transport, auth, balance, rate, availability, and timeout failures. The runner writes a separate infrastructure failure artifact and throws before scheduling another top-level request.
- Verification: focused fixture/runner `8/8`, full `599/599`, lint zero warnings, production build/TypeScript PASS, diff check PASS.
- Baseline-8 regression evidence: local transport used a category string not present in the code-oriented predicate, so the server-process loss was not fail-fast. The bounded compatibility correction recognizes both representations; final closure requires deterministic verification and a new complete replacement matrix on a persistent server process.

## ISSUE-037 root cause record

- Reproduction: replacement RB-05 repair raw in `phase-2-4-post-035-036-replacement-rb-05.json`.
- Failure: legal dimension-local uncertainty explanation is split into fragments and classified as Candidate factual assertion, requiring refs that Contract says must remain empty for `unknown`.
- Distinctness: not ISSUE-029 qualifier contamination; not ISSUE-033 unsupported negative generation; not ISSUE-035 polarity set; not ISSUE-036 lexical work qualifier.
- Authorized surface: internal Match deterministic validator/tests and durable Phase 2.4 records only. No Contract, schema, prompt, fixture, provider or Phase 2.5 change.
- Batch-1 adjacent finding: the same M-CANDIDATE-LINEAGE support layer rejected the weaker `参与团队项目` claim despite CF-003 proving four-person team completion and assistance. The Issue scope now covers bounded evidence-relation classification plus conservative weaker-entailment recognition; no sentence-level Issue was added.
- Batch-2 adjacent evidence: a legal terminal evidence-force boundary was split between Match lineage and M-K, while explicit `CF-xxx` factual narration could omit its CF from structured refs and evade dimension-local review. Cycle 3 centralizes evidence-force semantics and requires explicit CF narration ownership; this exhausts the 3-cycle budget for the broad lineage/status lexical root.
- Batch-3 final evidence: run 1/3 repairs both narrate positive CF-003 facts inside an `unknown` dimension while refs correctly remain `[]`, which the frozen prompt explicitly forbids; lineage correctly rejects both. Both repairs also upgrade assistance into `个人交付/个人职责` evidence and are correctly rejected by M-K. Legal CF-004 explicit-negative scope boundaries are accepted, so original ISSUE-037 behavior is not observed.
- Superseding Gate: per-cycle stop condition is obsolete. ISSUE-033 now covers the full Match generation-contract path. v1.5 removes the contradictory repair example, aligns raw/repair status language, adds field-level ownership actions, and provides bounded terminal normalization followed by all existing validators. Exact batch-3 failures and generalized semantic controls pass; E2E pending.
