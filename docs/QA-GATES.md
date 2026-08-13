# Phase 2.4 QA Gates

本文件是执行索引，Gate 的正式定义仍以 `PHASE-2-4-QUALITY-ROBUSTNESS.md` 与 `PHASE-2-CONTRACT.md` 为准。

## Hard invariants

- Candidate claim → CF → PF → Raw Profile；JD claim → JD Evidence → Raw JD。
- `unknown != unmet`; absence of evidence != negative evidence; counter evidence != positive evidence。
- Explicit negative evidence and relational conclusions are dimension-local。
- Candidate semantic/qualifier upgrade、JD→Candidate contamination、unsupported waiver、cross-CF qualifier propagation 均为 0。
- 失败后下游调用为 0；rejected output 与 stage lifecycle 必须可审计。

## Deterministic gate per baseline

1. Exact rejected-raw replay and focused matrix PASS。
2. Relevant module targeted tests PASS。
3. Full automated suite PASS。
4. `npm run lint` PASS。
5. `npm run build` PASS。
6. Diff/scope/secret scan PASS；frozen Contract/public Schema/fixture/provider settings无未授权变更。
7. Worktree clean at committed milestone。

## Model-backed gate

- 每个 committed deterministic baseline 使用同一 frozen RB-05 fixture执行固定三次 evaluation batch。
- 三次之间不得修改代码、输入、model、temperature、retry 或 timeout；全部独立 artifact 均保留。
- 每次先做实际五 route acceptance capability preflight，业务执行前 model calls 必须为 0。
- 任何结果都纳入结论；不得追加运行选择绿色样本。

## Current status

- Q-A backlog disposition：PASS / final ledger closed。
- Q-B blocker closure：PASS，ISSUE-028～038 closed on deterministic + final runtime evidence。
- Q-C full-chain robustness：PASS，final acceptance batch 2 为 3/3 complete / X-A～X-J PASS。
- Q-D safe failure：PASS on recorded paths。
- Q-E metrics：PASS / OBS-006 retained non-blocking（personalized safe fallback 3/3，safety guards PASS）。
- Q-F evidence auditability：PASS on infrastructure + final 3-run artifacts。
- Q-G cross-module integrity：PASS on final 3/3 complete chains。
- Q-H automated regression：current ISSUE-031/038 baseline has 584/584、lint、production build PASS。
- Q-I input/error handling：PASS。
- Q-J release blockers：PASS；no open Phase 2.4 P0/P1。Phase 2.5 still NOT AUTHORIZED。

Current disposition: **PASS / CLOSE PHASE 2.4**. Final evidence: `PHASE-2-4-FINAL-ACCEPTANCE.md`. Phase 2.5 remains NOT AUTHORIZED pending separate Product Owner / QA authorization.

## Phase 2.5 Release Gate

Phase 2.5 is **AUTHORIZED / IN PROGRESS** as of 2026-08-13. The governing addendum and run policy are `PHASE-2-5-AUTONOMOUS-PLAN.md`.

- Product surface Gate: ordinary user can submit raw JD + raw Candidate Profile and receive one validated Personalized Match Result without producing internal JSON.
- Fixture Gate: exact Phase 1 TC-01～10 hashes plus frozen TC-P2-01～14 JD/Profile hashes and coverage manifest.
- Deterministic Gate: focused/targeted/full/lint/build/production smoke/diff/scope/secret/history audit all PASS on a committed clean baseline.
- Model Gate: Phase 1 10×3 and Phase 2 14×3, complete immutable matrices, all artifacts retained, no cherry-pick or fourth run.
- Hard Contract Gate: Candidate/JD lineage, status, dimension locality, modifier/ownership/waiver integrity, schema, fail-closed, downstream-stop, and Phase 1 compatibility all PASS.
- Gate F: eight-dimension average >=4.0/5, minimum dimension >=3.0/5, P0=0, systemic/release-blocking P1=0.
- `hrSafeFallbackRate` and OBS-006: mandatory report-only metrics; non-blocking absent a hard correctness failure.

Current Phase 2.5 disposition: **BASELINE-18 REPLACEMENT 39/42 RETAINED / TWO DETERMINISTIC FALSE-POSITIVE BOUNDARIES CORRECTED**.

Current evidence: baseline-2 Phase 1 `30/30` accepted. Phase 2 baseline-4 is a valid, complete, non-passing `21/42` batch with `26` complete chains and downstream-after-failure `0`; baseline-3 is zero-call preflight evidence. Updated stabilization focused suites `312/312` plus integration/boundary `40/40`; full automated suite `33 files / 618 tests`; lint zero warnings; production build and TypeScript PASS. Commit/diff/scope/secret audit and the new full Phase 2 matrix remain.

Infrastructure batch disposition: `phase-2-5-baseline-1-0373ad4` is **NOT A CONTENT MATRIX**. Five probes passed, but all 72 local requests returned JD-stage `AI_SERVICE_UNAVAILABLE` before provider completion (`completion tokens=0`, completed chains=0, downstream calls=0, max latency 35 ms). Artifacts are retained; content sample count is 0. ISSUE-039 fail-fast correction passes focused 8/8, full 599/599, lint/build. A complete replacement matrix on a new committed runner baseline is required.

Latest infrastructure disposition: `phase-2-5-baseline-8-6f0eab7` is also **NOT A FINAL CONTENT MATRIX**. It retains 2 completed passing samples, then one in-flight Match transport failure and 39 JD transport failures after the production server process exited. No post-failure content sample or downstream call occurred. A runner category/code mismatch bypassed ISSUE-039 fail-fast; exact `8/8`, full `631/631`, lint and build PASS after correction. The exact batch, summary hash and adjudication are retained, and a new committed full matrix is mandatory without cherry-picking the two successes.

Latest content disposition: `phase-2-5-baseline-9-2b8bc40` is a valid complete fixed batch at `39/42`, with `40` complete chains and downstream-after-failure `0`. Its three failures are retained and adjudicated as local threshold/proficiency boundary handling, hypothetical Recommendation status grammar, and explicit numeric duration shortfall polarity. Focused `272/272`, full `634/634`, lint and build PASS; a new committed complete matrix remains mandatory with no cherry-pick.

Newest content disposition: `phase-2-5-baseline-10-28c0ccf` is a valid complete fixed batch at `40/42`, with `40` complete chains and downstream-after-failure `0`; every Baseline-9 failure passed 3/3. Two Strength/Gap failures exposed conditional `描述` and `不足以证明` lexical boundaries. Focused `90/90`, full `636/636`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest content disposition: `phase-2-5-baseline-11-7460f02` is valid and complete at `40/42`, with `41` complete chains and downstream-after-failure `0`; every Baseline-10 failure passed 3/3. Remaining failures are one whitespace-equivalent X-F source comparison and one correctly rejected unsupported substitution example. Focused `108/108`, full `637/637`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest content disposition: `phase-2-5-baseline-12-da1877f` is valid and complete at `40/42`, with `41` complete chains and downstream-after-failure `0`; both Baseline-11 failures passed 3/3. Remaining failures are one qualifier-free generic employment relation after an exact counter and one aggregate-unmet MI simultaneously used as supporting/counter. Focused `135/135`, full `640/640`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest content disposition: `phase-2-5-baseline-13-55cc2de` is valid and complete at `40/42`, with `41` complete chains and downstream-after-failure `0`; the Baseline-12 X-C case passed 3/3. Remaining failures are one X-F coordinated uncertainty phrase and one omitted fact-free unknown employment dimension after Match repair. Focused `152/152`, full `641/641`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest content disposition: `phase-2-5-baseline-14-a5ff6eb` is valid and complete at `40/42`, with `40` complete chains and downstream-after-failure `0`; both Baseline-13 failures passed 3/3. TC-P2-10 R1/R3 share one already-unmet numeric-shortfall reason ownership root. Focused `146/146`, full `643/643`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest content disposition: `phase-2-5-baseline-15-75be908` is valid and complete at `41/42`, with all `42` complete chains and downstream-after-failure `0`. The only failure passed X-A～X-J but over-corrected explicit skill usage to unknown instead of frozen partial. Focused `148/148`, full `645/645`, lint/build PASS; a new committed complete matrix remains mandatory.

Latest regression disposition: `phase-2-5-baseline-16-0598947` completed at `33/42`, with `33` complete chains and downstream-after-failure `0`. A global same-skill omission extension caused TC-P2-01/06/07 deterministic regressions and has been removed; terminal-only partial preservation passes focused `148/148`, full `645/645`, lint/build. A new committed complete matrix remains mandatory.

Latest disposition: `phase-2-5-baseline-17-4f042e1` completed at `32/42`, downstream-after-failure `0`; all ten failures are the same missing partial uncertainty fields after otherwise correct terminal recovery. Focused `148/148`, full `645/645`, lint/build PASS; complete replacement required.

Latest disposition: baseline-18's zero-content sandbox-network attempt is retained separately. `phase-2-5-baseline-18-replacement-a16c088` completed all 42 at `39/42`, with `40` complete chains and downstream-after-failure `0`. R-C negation and X-F uncertainty false positives have bounded regressions; focused `106/106`, full `646/646`, lint/build PASS. A new committed complete matrix remains mandatory.

Content baseline disposition: baseline-2 Phase 1 is accepted at 30/30. `phase-2-5-baseline-4-f7838a1` is a complete, non-passing Phase 2 stabilization baseline at 21/42 with 26 complete chains and downstream-after-failure 0; baseline-3/4 artifacts and rejected raw are retained. ISSUE-040～047 have deterministic fixes with full 618/618, lint/build PASS. A new committed full Phase 2 14×3 matrix is required; no earlier success may be cherry-picked into the final matrix. See `PHASE-2-5-BASELINE-4-STABILIZATION.md`.

Latest content disposition: `phase-2-5-baseline-5-83a1810` is a complete, non-passing Phase 2 stabilization batch at 30/42 with 31 complete chains and downstream-after-failure 0. All 42 results and rejected raw are retained. ISSUE-041/044 extensions and ISSUE-048/049 focused `161/161`, relevant targeted `228/228`, full `625/625`, lint, production build, diff/scope/secret PASS; immutable commit and the next replacement matrix remain. See `PHASE-2-5-BASELINE-5-STABILIZATION.md`.

Newest content disposition: `phase-2-5-baseline-6-8b8cae6` is a complete, non-passing Phase 2 batch at 35/42 with 39 complete chains and downstream-after-failure 0. All results are retained. ISSUE-042/044/048 extensions and ISSUE-050 focused `139/139`, full `630/630`, lint, production build, diff/scope/secret/process PASS; immutable commit and a new replacement matrix remain. See `PHASE-2-5-BASELINE-6-STABILIZATION.md`.

Latest content disposition: `phase-2-5-baseline-7-13900bf` is a complete, non-passing Phase 2 batch at 39/42 with 40 complete chains and downstream-after-failure 0. ISSUE-050 artifact preservation is runtime-verified. ISSUE-042/044 adjacent focused `103/103`, full `631/631`, lint, production build, diff/scope/secret/process PASS; immutable commit and a new complete replacement matrix remain. See `PHASE-2-5-BASELINE-7-STABILIZATION.md`.
