# Phase 2.5 Pre-Authorization Audit

> Audit date: 2026-08-13
> Audited baseline: `main / f23406b7823d88ed50e35de144e6c9414e4cf887`
> Audit scope: repository, Git history, frozen contracts, acceptance evidence, backlog, schemas, APIs, core modules, tests, and current UI
> Model-backed executions during this audit: **0**
> Phase 2.5 implementation: **NOT STARTED / NOT AUTHORIZED**
> Audit recommendation: **NOT READY — PO DECISION REQUIRED**

This document is a pre-authorization audit, not a Phase Contract amendment and not an implementation authorization. It does not change any released behavior, public schema, Gate, fixture, provider setting, or Phase boundary.

## Executive conclusion

The repository is exactly on the accepted Phase 2.4 closeout HEAD. Phase 2.4 is genuinely `PASS / CLOSED`; its final engineering evidence is internally consistent with Git history, the current deterministic suite, and the preserved final artifacts.

The repository has one historical definition of Phase 2.5: **Regression + Final Release Gate**. It is not a new feature phase. The authoritative Contract freezes a 14-case Phase 2 final matrix at three runs per case, plus complete Phase 1 TC-01～TC-10 regression before PO/QA release approval.

Phase 2.5 is not yet ready for one-time autonomous authorization because three prerequisites cannot be uniquely resolved from the current repository:

1. Phase 2's product goal describes an end-user Personalized Match flow, but the current product exposes only a polished Phase 1 page plus isolated technical Phase 2 pages/APIs. No document assigns the missing unified user journey to Phase 2.5 or to a defined Phase 3.
2. The frozen 14 TC categories exist, but their final immutable de-identified JD/Profile input package and a Phase 2.5 final-matrix runner do not exist in the repository. The Contract explicitly leaves the source material for PO provision.
3. `hrSafeFallbackRate <= 20%` remains provisional rather than a frozen Final Release Gate. Phase 2.4 closed with OBS-006 non-blocking, but the Phase 2.5 release threshold for fallback/naturalness was never formally selected.

These are product/acceptance decisions, not implementation bugs. No Phase 2.5 feature work should begin until the PO resolves them once.

## A. Current Product State

### A.1 Repository and Git baseline

- Branch: `main`.
- Audited HEAD: `f23406b7823d88ed50e35de144e6c9414e4cf887`.
- This exactly matches the Phase 2.4 accepted baseline stated in the handoff and user-provided acceptance summary.
- Initial working tree: clean.
- `f23406b` is the Phase 2.4 closeout/evidence commit; the final implementation baseline is its ancestor `803289bdd8c63ba36e9f7d31e67c255141b801a4`.
- No later product or implementation commit exists.

### A.2 Phase 1 delivered capability

Phase 1 is `PASS / CLOSED` and provides a coherent, ordinary-user flow at `/`:

1. paste one raw JD (100～12,000 characters);
2. call `POST /api/analyze` through the server;
3. generate and validate `analysis-v1`;
4. display job basics, core responsibilities, hard/core/preferred/unclear requirements, work characteristics, risk signals, unknowns, application advice, questions for HR, and safe generic/editable greeting text;
5. preserve JD evidence, source-type semantics, fail-closed behavior, request IDs, retryable error guidance, loading, retry, and responsive UI behavior.

Phase 1 TC-01～TC-10 are formally accepted 10/10. Candidate-specific advantages remain disabled in this mode, and the greeting is intentionally non-personalized.

### A.3 Phase 2.0～2.4 delivered capability

| Phase | Delivered capability | Formal state |
| --- | --- | --- |
| 2.0 | Frozen Profile/Match/Recommendation/Strength/Gap/Greeting contracts, evidence rules, 14-case design, Gates | PASS / CLOSED |
| 2.1 | Raw Profile → PF ledger → atomic claims → canonical `CF-*` truth layer → deterministic typed projections; `/api/profile/analyze`; minimal `/profile` page | PASS / CLOSED |
| 2.2A | Validated JD + validated Candidate Profile → requirement/dimension-level `match-core-v1`; `/api/match/analyze` | PASS / CLOSED |
| 2.2B-1 | Read-only Match Core → evidence-bound `recommendation-core-v1`; `/api/recommendation/analyze` | PASS / CLOSED |
| 2.2B-2 | Read-only Match Core → `strength-gap-core-v1`; `/api/strength-gap/analyze`; minimal `/strength-gap` page | PASS / CLOSED |
| 2.3 | Validated Profile + Match + Recommendation + optional Strength/Gap → `personalized-greeting-v1`; `/api/greeting/analyze`; minimal `/greeting` page | PASS / CLOSED |
| 2.4 | Cross-module invariants, safe failure, rejected-output evidence, stage lifecycle, normalization/repair robustness, eight raw-input E2E cases, final exactly-three RB-05 acceptance | PASS / CLOSED |

Phase 2.4 final evidence is:

- 28 test files / 584 tests PASS;
- focused replay 136/136 PASS;
- lint PASS, zero warnings;
- production build and TypeScript PASS;
- final RB-05 exactly three runs, 3/3 complete chains, 18/18 business stages HTTP 200;
- X-A～X-J PASS in every run;
- Candidate/ownership/proficiency/employment/context upgrade counts all zero;
- ISSUE-028～038 CLOSED / regression only;
- OBS-006 retained open and non-blocking.

### A.4 Internal architecture capabilities

The repository can internally execute the complete evidence-bound chain:

```text
Raw JD -> analysis-v1
Raw Profile -> candidate-profile-v2
validated JD + Profile -> match-core-v1
validated Match -> recommendation-core-v1
validated Match -> strength-gap-core-v1
validated Profile + Match + Recommendation + optional Strength/Gap
  -> personalized-greeting-v1
```

The architecture includes:

- strict Raw/Final Zod boundaries and server-only DeepSeek adapters;
- separate truth spaces for Raw JD and Raw Profile;
- PF and CF ledgers, deterministic projections, MI/DIM/ST/GP references;
- one bounded model repair where defined, conservative terminal normalization only where already released, and complete revalidation;
- input-integrity guards, 12,000-character current JD/Profile implementation limits, no silent truncation, timeout/retry/error mapping;
- deterministic modifier, qualifier, ownership, polarity, waiver, unknown, evidence, and cross-source guards;
- acceptance-only rejected-output capture and explicit request/stage lifecycle;
- full-chain stop semantics and immutable acceptance artifacts;
- 105 tracked acceptance/evidence files, including negative history.

This is substantial internal capability, but it is not equivalent to a finished ordinary-user Personalized Match product.

### A.5 User-visible and user-usable capability today

The production build exposes:

- `/`: polished Phase 1 JD analysis;
- `/profile`: raw profile text to raw JSON display;
- `/strength-gap`: requires the user to paste already validated Match Core JSON;
- `/greeting`: requires the user to paste already validated upstream JSON;
- six server APIs: JD, Profile, Match, Recommendation, Strength/Gap, and Greeting.

The following user journey is **not** present:

- no mode selector for "JD only" versus "JD + my profile";
- no single screen that accepts both JD and Profile;
- no client/server product orchestration of all Phase 2 stages;
- no ordinary-user display for Match or Recommendation;
- no unified display of recommendation, requirement statuses, strengths, gaps, unknowns, questions, and personalized greeting;
- no navigation from `/` to the Phase 2 technical pages.

Therefore:

- Phase 1 is an end-user product capability.
- Phase 2 is currently a validated API/core architecture with several technical/minimal pages.
- The repository does not yet expose the full Phase 2 Product Goal described in `PHASE-2-PLAN.md` as one usable Personalized Match MVP.

## B. Existing Phase 2.5 Definition

### B.1 Authoritative historical definition

`PHASE-2-PLAN.md` introduced Phase 2.5 once, in commit `763b2b4`, as:

> **Phase 2.5 Regression + Final Release Gate** — Phase 1 TC-01～TC-10 complete rerun 10/10 + all Phase 2 TCs green + Final Report; satisfy the Phase 1 Regression Gate and all Phase 2 Gates; submit for PO/QA Final Release approval.

No later Git commit introduces a second Phase 2.5 definition.

### B.2 Product goal and user value

Phase 2.5 itself adds no originally planned feature. Its intended value is release confidence:

- prove that Phase 2 personalization did not regress the released Phase 1 JD product;
- prove the complete Candidate Profile → Match → Recommendation → Strength/Gap → Greeting behavior across the frozen final matrix;
- produce a durable Final Report and evidence package for PO/QA release approval.

The parent Phase 2 product goal remains:

> `Candidate Profile + JD -> decide whether this job fits this user`, with every relation traceable to JD and Profile evidence.

### B.3 Feature scope

The original Phase 2.5 definition has **no new feature scope**. It assumes Phase 2.1～2.4 already produced the releasable product and reserves Phase 2.5 for regression and final release approval.

That assumption does not match the current user-visible surface. Resolving that mismatch would either:

- add a narrow unified Personalized Match surface to Phase 2.5, which changes the original Phase boundary and requires PO authorization; or
- explicitly release Phase 2 as API/core capability and defer the ordinary-user integrated product to a newly defined later Phase.

The repository cannot choose between these meanings by implementation inference.

### B.4 Engineering scope

The original engineering scope recoverable from the Contract and plan is:

- freeze the Phase 2.5 baseline, fixtures, hashes, model settings, runner, and artifact policy;
- run the full deterministic gate;
- run Phase 1 TC-01～TC-10 complete regression (the Phase 2.1 acceptance record clarifies the retained expectation as TC-01～TC-10 × 3 = 30 top-level cases);
- run Phase 2 TC-P2-01～14 × 3 = 42 top-level full-chain cases;
- apply all hard Gates and Gate F scoring;
- preserve every success/failure artifact and metric;
- stabilize implementation defects on a new committed baseline without changing fixtures or weakening contracts;
- prepare a final report and submit the final release decision to PO/QA.

### B.5 Dependencies

Satisfied dependencies:

- Phase 1 closed;
- Phase 2.0～2.4 closed;
- no open Phase 2.4 P0/P1;
- deterministic baseline is green;
- final RB-05 full-chain reachability and truth invariants are proven.

Unsatisfied dependencies:

- no approved final 14-case de-identified JD/Profile material package;
- no machine-readable Phase 2.5 fixture manifest or runner;
- no complete machine-readable Phase 1 final-regression fixture package/runner;
- no explicit external model-call/budget authorization for Phase 2.5;
- no final release definition for the integrated user surface;
- no final fallback-rate Gate threshold.

### B.6 Phase 2.4 boundary

Phase 2.4 was engineering quality/robustness, not final product release:

- eight raw-input robustness cases (`E2E-RB-01～08 × 1`);
- a focused exactly-three RB-05 final batch after stabilization;
- cross-module X-A～X-J, safe failure, diagnostics, metrics, and closed blocker evidence;
- no 14 TC × 3 final matrix;
- no Phase 1 TC-01～TC-10 final rerun;
- no new user feature or UI redesign.

Phase 2.5 begins only after a separate PO authorization and owns the final release matrix/report.

### B.7 Phase 3 boundary

There is no Phase 3 contract, plan, or Gate in the repository. The only recoverable later-scope boundary is the Phase 2 Non-Scope list:

- accounts, database, cloud profile/history;
- PDF/DOCX parsing, OCR, JD screenshot/website ingestion;
- multi-job comparison, tracking, reminders;
- auto-apply, automatic HR contact;
- resume rewrite, cover letters, interview answers/simulation, voice interview, multi-turn HR Agent;
- payment/subscription, company recommendation/external reviews;
- complex Agent/RAG/vector database;
- confidence and 0～100 match score;
- statistical runtime model benchmark;
- future profile segmentation protocol.

These belong to a later Phase unless a future Product Contract says otherwise. The missing unified Personalized Match surface is different: it is already described by the Phase 2 core user flow and therefore cannot be silently moved to Phase 3.

### B.8 Conflicts and stale text audit

There are **not multiple competing Phase 2.5 definitions**. There are, however, stale or superseded supporting statements:

- `PHASE-2-PLAN.md` still contains old `confidence` fields in its early success-flow text, while the authoritative Contract §§14/21 freezes **no confidence**.
- The same plan's Phase 2.4 row says 12 Phase 2 cases, while the later authoritative Contract freezes 14.
- `PHASE-2-CONTRACT.md` header retains historical mid-implementation Phase statuses; its product rules remain authoritative, but the header is not current Gate state.
- `CODEX-HANDOFF.md` line 10 and the final acceptance documents state Phase 2.4 closed, while its historical tail still says Phase 2.4 blocked and earlier Issues open.
- `README.md` documents only the Phase 1 surface and omits the later internal Phase 2 routes/pages.

These are documentation-state debts, not competing product contracts. Latest Handoff status, Git history, `PHASE-2-4-FINAL-ACCEPTANCE.md`, `PLANS.md`, `ISSUE-LEDGER.md`, and `QA-GATES.md` supersede the historical status text.

## C. Backlog Disposition

| Item | Current fact | Disposition | Phase 2.5 treatment |
| --- | --- | --- | --- |
| Unified Personalized Match user flow | Product goal specifies it; current UI does not provide it; no later Phase owns it | **PO decision required / authorization blocker** | Decide whether Phase 2.5 implements a narrow surface or releases API/core only |
| Final TC-P2-01～14 material | Categories frozen; final real de-identified JD/Profile inputs absent; Contract says PO source pending | **Phase 2.5 blocker** | PO supplies/approves immutable fixture package and hashes |
| Phase 2.5 runner/artifact manifest | No runner exists; only module runners and Phase 2.4 E2E runner exist | **Phase 2.5 in-scope engineering** after fixtures | Implement without changing Contract or fixtures |
| Phase 1 final replay package | Historical inputs/hashes are spread across acceptance records; test-case document contains templates, not an immutable runner package | **Phase 2.5 in-scope; blocker if exact inputs cannot be recovered** | Reconstruct and hash; escalate only if exact frozen text is unavailable |
| `hrSafeFallbackRate` final threshold | `<=20%` remains provisional and explicitly not a frozen Final Gate | **PO decision required / authorization blocker** | Freeze a threshold or explicitly make it report-only |
| OBS-002 semantic tag correction frequency | Downstream truth/status impact not observed | **Phase 2.5 in-scope observation** | Record rate and hard-fail only on truth/status/projection regression |
| OBS-005 long-tail latency | Single long-tail evidence, no SLA or stage-attributed systemic defect | **Phase 2.5 in-scope observation** | Measure per-stage latency; no invented release SLA |
| OBS-006 Greeting repair/safe fallback interaction | Open, explicitly non-blocking, all safety guards pass | **Phase 2.5 in-scope observation** | Measure naturalness/efficiency and Gate F quality; truth violation still blocks |
| ISSUE-028～038 | Closed by Phase 2.4 final deterministic + runtime evidence | **Regression-only** | Exact/generalized negative controls remain mandatory |
| ISSUE-001～006, 008～011, 012A, 013, 015～016, 018, 020, 022, 024～027 | Closed or explicitly resolved by released implementation | **Regression-only** | Phase 1/Phase 2 regression coverage |
| ISSUE-007 | Not reproduced; structure superseded | **Obsolete / superseded** | No separate feature work |
| ISSUE-012B | Arbitrary corrupted input recovery never promised; safe failure/input limits implemented | **Superseded by safe-failure Contract; regression-only** | Must not return unverified content |
| ISSUE-014 | Phase 1 decision ambiguity superseded by Phase 2 Recommendation Contract | **Obsolete / superseded** | Preserve Phase 1 behavior and Phase 2 decision guards |
| ISSUE-017 / 021 / 023 | Completeness, modifier, and duplicate mechanisms implemented and accepted in Phase 2.4 | **Regression-only** | Reopen only on new reproducible failure, not by history alone |
| ISSUE-019 | Old Phase 1 generic greeting metric no longer represents all Phase 2 fallbacks | **Superseded by split metric taxonomy** | Keep Phase 1 regression; use separate Phase 2 metrics |
| Runtime Model Benchmark | Explicitly deferred / not required | **Later phase** | Not part of Phase 2.5 acceptance sampling |
| Profile segmentation | Contract defaults to explicit over-limit error; no segmentation | **Later phase** | Do not summarize or segment in Phase 2.5 |
| README/stale status headers | Current docs contain historical/stale states | **Phase 2.5 release documentation debt** | Reconcile after PO scope decision; preserve history |
| Literal TODO/FIXME/HACK backlog in `src/`/`scripts/` | No actionable markers found | **None** | No work item |
| Phase 2 Non-Scope features | Accounts/files/OCR/history/multi-job/auto-apply/resume/interview/Agent/payment/etc. | **Later phase / out of scope** | No implementation in Phase 2.5 |

No new Issue is created by this audit: the blockers are missing Product/Acceptance decisions or planned Phase infrastructure, not reproducible implementation defects.

## D. Proposed Phase 2.5 Scope

The following is the recommended complete, bounded scope **if the PO chooses to finish the Phase 2 end-user Personalized Match MVP in Phase 2.5**.

### D.1 In Scope

1. Freeze one approved Phase 2.5 Product/Acceptance Contract addendum covering the three decisions in §K.
2. Package immutable Phase 1 TC-01～TC-10 and Phase 2 TC-P2-01～14 fixtures, expected outcome manifests, hashes, model settings, run policy, and artifact locations.
3. Implement a narrow integrated Personalized Match user flow using existing released APIs/schemas:
   - choose JD-only or JD+Profile mode;
   - accept raw JD and raw Profile;
   - orchestrate the already released chain;
   - display Recommendation, Match statuses, Strengths, Gaps, unknowns/questions, and Greeting;
   - expose actionable error/retry behavior without leaking raw model output;
   - do not add accounts, persistence, upload, OCR, or a new public result schema.
4. Add focused UI/orchestration tests and a Phase 2.5 final acceptance runner.
5. Stabilize ordinary implementation defects while preserving immutable failed evidence and all frozen contracts.
6. Execute deterministic Gates.
7. Execute Phase 1 10 × 3 regression and Phase 2 14 × 3 final full-chain acceptance on committed baselines according to the approved run policy.
8. Record separated repair/fallback/latency metrics, OBS-002/005/006, Gate F scores, and all hard-Gate results.
9. Perform product acceptance of the actual user journey, release documentation reconciliation, closure audit, and final PO/QA submission.

If the PO instead chooses an API/core-only release, item 3 must be removed explicitly and the release must not be described as a complete ordinary-user Personalized Match MVP.

### D.2 Out of Scope

- changing the frozen Product Contract, truth/evidence semantics, public schemas, or existing route request/response contracts;
- weakening validation, fail-closed, unknown, ownership, modifier, waiver, or contamination rules;
- changing provider/model merely to improve acceptance samples;
- runtime statistical model benchmarking beyond the frozen acceptance matrix;
- accounts, database, persistence, file upload/parsing, OCR, website ingestion;
- multi-job comparison, job tracking/reminders, auto-application or automatic HR contact;
- resume rewriting, cover letters, interview content/simulation, voice, multi-turn Agent;
- confidence, match score, payment, company intelligence, RAG/vector database;
- profile segmentation or automatic summarization presented as raw evidence;
- public deployment or production data migration unless separately authorized;
- unrelated refactors or visual redesign beyond the narrow integrated flow.

## E. Frozen Contracts

### E.1 Frozen product contracts

The following must remain unchanged by default throughout Phase 2.5:

1. **Truth sources and lineage**
   - Raw JD is the only original JD truth source.
   - Raw Profile is the only original Candidate truth source.
   - Canonical Candidate Fact is the only Candidate truth layer.
   - Candidate claim: `CF -> PF -> Raw Profile`.
   - JD claim: `JD Evidence -> Raw JD`.
   - Match/Recommendation/Strength/Gap/Greeting consume references and never become a second fact source.

2. **Candidate Fact semantics**
   - `candidate-profile-v2`, PF/CF IDs, canonical statements, source types, semantic tags, deterministic projections;
   - stated/normalized facts separated from derived observations and unknowns;
   - no proficiency, duration, experience-type, ownership, team/individual, employment, context, quantity, or certainty upgrade.

3. **Match semantics**
   - `match-core-v1` and `met / partial / unmet / unknown` definitions;
   - `unknown != unmet`; missing evidence is not counter-evidence;
   - explicit counter-evidence and relational conclusions are dimension-local;
   - partial requires same-dimension positive evidence;
   - requirement coverage, aggregation, JD/CF/PF references, and source isolation.

4. **Recommendation semantics**
   - `recommendation-core-v1` and four levels;
   - allowed-level guardrails, status/unknown fidelity, hard-gap explanation;
   - no unsupported waiver/flexibility/substitution.

5. **Strength/Gap semantics**
   - `strength-gap-core-v1`, released taxonomies, truth/reference/action rules;
   - Strength requires real Candidate evidence and a valid Match relation;
   - unknown is not deficiency; hard constraint requires counter-evidence;
   - optional transferable relations remain bounded and dimension-local.

6. **Greeting semantics**
   - `personalized-greeting-v1`;
   - Candidate claims only from canonical stated/normalized facts;
   - derived observations, Recommendation, Strength, Gap, or JD cannot become Candidate facts;
   - personalized and Phase 1 safe fallback behavior remains fully validated.

7. **Phase 1 compatibility**
   - `/api/analyze`, `analysis-v1`, source types, evidence, generic greeting, and TC-01～TC-10 behavior;
   - no Candidate Profile path may mutate the Phase 1 protected pipeline.

8. **Safety and API behavior**
   - strict public request/response schemas and structured error contract;
   - model output is untrusted and cannot reach UI before full validation;
   - no silent input truncation; over-limit input is explicit;
   - fail-closed on unverified output; downstream calls stop after upstream failure;
   - prompt injection remains data, not instruction;
   - normal responses do not leak rejected raw output or secrets.

9. **Acceptance contract**
   - Phase 2 final set is 14 cases × 3;
   - Phase 1 final regression is TC-01～TC-10 complete rerun;
   - Gate F: average >= 4.0/5, minimum dimension >= 3.0/5, P0=0, systemic P1=0;
   - hard Gate failure cannot be averaged away;
   - failures and artifacts are never deleted, overwritten, or cherry-picked.

10. **Explicit exclusions**
    - no confidence and no 0～100 score in Phase 2 MVP;
    - no unsupported claim that a requirement can be waived or compensated;
    - no change to released Product Contract or public schema without separate PO decision.

### E.2 Internal implementation details

These may be changed autonomously after authorization when required by in-scope defects, provided frozen behavior and Gates remain unchanged:

- React component composition, page layout, navigation, client state, and accessible presentation;
- whether the narrow UI orchestrates existing routes client-side or through an internal non-public coordinator, provided public contracts remain stable;
- runner implementation, manifest format, test organization, helper names, and artifact indexing;
- Prompt wording/version, adapter internals, repair feedback, and conservative normalization implementation when behavior remains within the frozen Contract;
- internal validators/helpers and diagnostic serialization details, while evidence-preservation semantics remain intact;
- log formatting, metric aggregation implementation, and code organization;
- current 12,000-character numeric implementation limit, only within the frozen no-truncation/explicit-error behavior and only if changed with measured evidence;
- UI styling and copy that do not change product semantics.

`deepseek-v4-flash`, temperature, output budgets, retry, timeout, fixtures, and hashes are implementation/configuration rather than eternal product contracts, but they must be frozen for each acceptance baseline and must not change inside a batch. The current repository rules require PO authorization before replacing the model.

## F. Autonomous Authority

One-time Phase 2.5 authorization should explicitly grant Codex authority to:

1. make all in-scope code, test, script, fixture-manifest, UI, and documentation changes without per-Issue approval;
2. create focused regressions and new Issues for reproducible defects, then diagnose, fix, and close them on sufficient evidence;
3. perform internal refactors needed for the approved flow/runner while preserving public contracts;
4. run targeted/full tests, lint, production builds, local servers, capability probes, deterministic replays, diff/scope/secret checks, and local product smoke tests as needed;
5. call the approved DeepSeek account for the frozen acceptance matrices and reasonable repair/retry paths, within an explicitly approved budget;
6. preserve every model result and failure, fix implementation defects on a new committed baseline, and rerun the **complete** applicable matrix instead of selecting successful samples;
7. update `PLANS.md`, `ISSUE-LEDGER.md`, `QA-GATES.md`, acceptance reports, Handoff, README, and release records;
8. commit bounded milestones and the final evidence package to the local repository.

The authorization should not include public deployment, paid services beyond the approved DeepSeek use, destructive history edits, deletion of artifacts, secret storage, or Contract/public-schema changes.

## G. Stop & Escalate Conditions

After authorization, stop only when one of these conditions is actually reached:

1. two frozen requirements prescribe incompatible behavior and Git/docs cannot establish precedence;
2. correctness requires changing released product semantics or a public schema/API contract;
3. correctness requires weakening truth, lineage, evidence, unknown, modifier, ownership, waiver, fail-closed, or downstream-stop guarantees;
4. the approved integrated-surface/API-only boundary must be changed;
5. acceptance requires unavailable exact fixtures, external paid resources beyond the authorization, production access, or another permission not granted;
6. two or more materially different product choices remain and cannot be resolved by the approved Contract;
7. a frozen acceptance criterion is technically impossible to satisfy without Contract amendment;
8. a high-risk, irreversible, destructive, or cross-Phase architecture action is necessary.

Unit/test/lint/build failures, model-invalid output, repair failure, validator bugs, ordinary prompt bugs, internal refactors, new implementation Issues, and repeated verification on a new committed baseline are not escalation conditions by themselves.

## H. Acceptance Strategy

### H.1 Deterministic Gate

Before any formal model batch:

1. baseline/branch/HEAD/worktree recorded;
2. fixture texts, manifests, expected outcomes, hashes, runner version, model settings, and artifact paths frozen;
3. Phase 2.5 preflight proves actual routes, diagnostics capability, zero pre-execution model calls, and correct stage ledger;
4. focused tests for every changed surface and exact rejected-output replay PASS;
5. relevant module targeted tests PASS;
6. full automated suite PASS;
7. lint PASS, zero warnings;
8. production build/TypeScript PASS;
9. integrated product-flow tests and local production smoke PASS if the UI is authorized;
10. diff/whitespace/scope/secret scan PASS;
11. frozen Contract/public schemas/fixtures/provider settings have no unauthorized diff;
12. historical failure artifacts remain tracked and unchanged.

### H.2 Model-backed Gate

Formal acceptance is bounded to the Contract matrices, not a general benchmark:

- Phase 1: TC-01～TC-10 × 3 = 30 top-level JD analyses, exact frozen inputs;
- Phase 2: TC-P2-01～14 × 3 = 42 top-level full-chain cases, exact frozen JD/Profile inputs;
- all cases on one committed baseline per matrix, with identical model/temperature/token/retry/timeout settings and no inter-run code/fixture changes;
- all scheduled runs and artifacts retained; no extra run to replace a failure;
- expected safe-failure cases count as green only when their frozen expected HTTP/error/stage-stop behavior passes;
- each Phase 2 completed result must pass applicable Profile, Match, Recommendation, Strength/Gap, Greeting, X-A～X-J, schema, lineage, modifier, waiver, unknown, and contamination checks;
- record per-stage latency, upstream attempts, repairs, normalizations, each separated fallback metric, and OBS-002/005/006;
- a failed baseline may be diagnosed and fixed autonomously, but the next committed baseline must execute the complete applicable matrix; old failures remain part of the record;
- no additional stochastic model benchmark is performed.

The top-level case count is 72. Actual provider completion calls may be higher because a Phase 2 full chain has multiple generation stages and released repair/retry paths. The one-time authorization must cover this reality rather than authorizing only 72 provider calls.

### H.3 Product Acceptance

Product acceptance is separate from internal architecture acceptance:

- verify the chosen release surface against the approved user flow;
- verify that ordinary users do not need to manufacture or paste internal JSON;
- verify actionable loading/error/retry and no partial unvalidated display;
- verify Recommendation, statuses, strengths, gaps, unknowns/questions, and Greeting are understandable and consistent;
- score the frozen Phase 2 outputs against Gate F's eight dimensions, preserving per-case/per-run evidence;
- enforce average >= 4.0, minimum dimension >= 3.0, P0=0, systemic P1=0;
- treat Candidate truth/evidence/contamination hard failures as release failures regardless of content score;
- submit the complete package for final human PO/QA release approval.

## I. Exit Criteria

### I.1 PASS / CLOSE PHASE 2.5

All of the following are required:

- the §K decisions are approved and encoded in a bounded Phase 2.5 authorization/acceptance addendum;
- chosen product surface is implemented and product-accepted, or the release is explicitly scoped and labeled API/core-only;
- exact fixture packages and hashes are durable in the repository;
- deterministic Gate is fully green on the final committed baseline;
- Phase 1 TC-01～TC-10 complete regression is 10/10 PASS under its frozen per-case rules;
- Phase 2 TC-P2-01～14 × 3 is fully green under per-case expected outcomes;
- all hard Contract Gates and X-A～X-J pass; no released Candidate/JD truth or evidence violation;
- Gate F passes; P0=0; no open release-blocking/systemic P1;
- fallback/repair/latency metrics meet the PO-approved disposition and are not manipulated by weakening validation;
- all success/failure artifacts, request/stage lifecycle, metrics, scores, hashes, and Git evidence are complete and preserved;
- docs accurately distinguish end-user capability from internal architecture;
- PO/QA grants Final Release approval;
- final committed worktree is clean and secret scan passes.

### I.2 FAIL / BLOCKED

`FAIL / BLOCKED` is appropriate only when:

- a frozen hard Gate fails on the candidate final baseline and cannot be corrected inside the approved Contract;
- a release blocker/systemic P1 remains open after in-scope stabilization;
- required exact fixtures, model/budget access, or final human Gate are unavailable;
- the selected product surface cannot be delivered without a new Contract/public-schema/cross-Phase decision;
- acceptance evidence is incomplete, selected, overwritten, or unauditable;
- the task reaches a Stop & Escalate condition in §G.

An intermediate failed matrix is evidence and triggers stabilization; it is not by itself terminal `BLOCKED` while an in-scope correction remains available.

## J. Autonomous Execution Plan

### Stage 1 — Authorization and frozen baseline

- record the PO decisions;
- freeze release surface, fixtures, hashes, expected outcomes, metric threshold, model/budget, runner policy, and final Gate ownership;
- create Phase 2.5 plan/Gate/ledger entries without changing released behavior.

### Stage 2 — Product and acceptance infrastructure

- implement the approved narrow product surface if selected;
- package Phase 1 and Phase 2 fixtures;
- implement runner, artifact schema, metrics, scoring templates, and preflight;
- add focused regression.

### Stage 3 — Deterministic stabilization

- run focused -> targeted -> full -> lint -> production build -> product smoke -> diff/scope/secret;
- fix ordinary defects autonomously;
- commit the immutable candidate acceptance baseline.

### Stage 4 — Formal acceptance matrices

- execute the complete Phase 1 matrix and complete Phase 2 matrix under the frozen policy;
- preserve all results;
- adjudicate exact failures by evidence, not by rerunning for a preferred sample.

### Stage 5 — Bounded stabilization when needed

- create non-duplicate Issues for reproducible defects;
- implement the smallest systemic correction inside the Contract;
- repeat deterministic Gates and commit a new baseline;
- rerun the complete affected formal matrix while retaining every prior matrix.

### Stage 6 — Product acceptance and closure audit

- Gate F/product-flow review;
- final backlog/observation/metric disposition;
- docs/Handoff/README/PLANS/LEDGER/GATES reconciliation;
- artifact/hash/Git/scope/secret audit;
- submit one final PO/QA release package and stop.

## K. Risks / Open PO Decisions

Only the following decisions require Product Owner action before Phase 2.5 authorization.

### K.1 Phase 2 release surface

Choose one release meaning:

1. **Recommended:** authorize a narrow integrated JD + Profile Personalized Match surface within Phase 2.5, using existing public schemas/APIs and without adding persistence or other features; or
2. explicitly define Phase 2 as an API/core release and move the ordinary-user Personalized Match journey into a newly defined later Phase.

The current repository cannot claim both "complete Personalized Match MVP" and "regression-only Phase 2.5" without this decision.

### K.2 Frozen acceptance material and model authorization

- provide or approve the immutable de-identified TC-P2-01～14 JD/Profile package, expected outcome manifest, and hashes;
- confirm the exact Phase 1 TC-01～TC-10 replay texts if repository reconstruction cannot reproduce the accepted hashes;
- authorize DeepSeek use/budget for 30 Phase 1 top-level cases + 42 Phase 2 top-level full chains, including released repair/retry paths and complete-matrix reruns on new committed baselines when implementation defects are fixed.

### K.3 Final fallback-rate rule

Freeze one rule for Phase 2.5:

- set a numeric `hrSafeFallbackRate` release threshold based on Phase 2.4 evidence; or
- explicitly keep the rate report-only/non-blocking for this release while Gate F naturalness and all truth/safety hard Gates remain blocking.

OBS-006 itself remains non-blocking unless new evidence shows truth, evidence, or safety failure.

## L. Repository / Git State

### L.1 State observed

- branch: `main`;
- audited product/evidence HEAD: `f23406b7823d88ed50e35de144e6c9414e4cf887`;
- initial working tree: clean;
- Phase 2.4 implementation baseline: `803289bdd8c63ba36e9f7d31e67c255141b801a4`;
- Phase 1 release baseline: `2faca406e1ef4bcc4157a860fc8c9407bbced488`;
- Phase 2 Contract baseline: `8bf6cf6...`;
- branches: only local `main` observed;
- audit changes: this document plus a status pointer in `PLANS.md`; no production code, schema, API, fixture, acceptance artifact, or released behavior changed.
- `ISSUE-LEDGER.md` and `QA-GATES.md` remain unchanged because this audit creates no implementation Issue and does not change the closed Phase 2.4 Gate.

### L.2 Important files inspected

- governance/state: `AGENTS.md`, `PROJECT_RULES.md`, `CODEX-HANDOFF.md`, `CODEX-OPERATING-PROTOCOL.md`, `PLANS.md`, `ISSUE-LEDGER.md`, `QA-GATES.md`;
- contracts/plans: `PHASE-2-CONTRACT.md`, `PHASE-2-PLAN.md`, `PHASE-2-4-QUALITY-ROBUSTNESS.md`, Phase 1/2.1/2.2/2.3 acceptance documents;
- final evidence: `PHASE-2-4-FINAL-ACCEPTANCE.md`, `PHASE-2-4-ISSUE-031-038-STABILIZATION.md`, Git history, acceptance artifact inventory;
- product docs: `README.md`, `PRD.md`, `analysis-schema.md`, `技术方案.md`, `开发计划.md`, `测试案例.md`, `验收执行报告.md`, `更新日志.md`;
- UI: all `src/app/**/page.tsx` and `src/components/*` product components;
- APIs: all six `src/app/api/**/route.ts` routes;
- schemas/core: Phase 1/Profile/Match/Recommendation/Strength-Gap/Greeting schemas, adapters, prompts, evidence/diagnostic/integrity helpers;
- tests/runners: all current test files and scripts, including the Phase 2.4 E2E runner and module acceptance runners.

### L.3 Commands executed

- `git status --short --branch` — `main`, initial clean;
- `git rev-parse HEAD` — `f23406b7823d88ed50e35de144e6c9414e4cf887`;
- `git log`, `git show`, `git diff`, branch and history searches — inspected;
- repository/doc/source searches for Phase 2.5, Phase 3, backlog, observations, TODO/FIXME, schemas, APIs, routes, fixtures, and runners — completed;
- `npm test` — **28 files / 584 tests PASS**;
- `npm run lint` — **PASS / zero warnings**;
- `npm run build` — **PASS**, TypeScript and production routes built;
- `git diff --check` — PASS before audit document creation;
- model calls / stochastic sampling — **0**;
- Phase 2.5 E2E acceptance — **not executed**.

## Final recommendation

**NOT READY — PO DECISION REQUIRED**

Required decisions are limited to §K. No Phase 2.5 implementation should begin before those decisions and a single bounded authorization are recorded.
