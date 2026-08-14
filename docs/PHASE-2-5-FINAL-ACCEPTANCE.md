# Phase 2.5 Final Acceptance

> Final recommendation: **PASS / CLOSE PHASE 2.5**
> Implementation baseline: `main / 6479978fab2ab1062fa93ff0b65e355a4718e44b`
> (commit "Phase 2.5: stabilize baseline 21 for final acceptance")
> Deterministic gate: 33 files / 652 tests, lint, production build + TypeScript PASS
> Model-backed gate: frozen 14×3 Phase 2 matrix = **42/42 PASS**, 42 complete chains,
> downstream-after-failure 0, no run 4, no infrastructure failure
> Acceptance artifact run: `phase-2-5-baseline-22-6479978`
> Summary SHA-256: `372EBEED43233FE53953F2E108B8096E864B550754EA554A5699EDE1BD9E2B83`

## A. Final Product State

The ordinary-user journey `Raw JD + Raw Candidate Profile -> Personalized Match Result`
is complete on the frozen Phase 2.5 baseline:

- `/` — Phase 1 JD analysis (unchanged, PASS / CLOSED since Phase 1);
- `/personalized-match` — unified JD + Profile journey orchestrating the six released APIs;
- `/api/analyze`, `/api/profile/analyze`, `/api/match/analyze`, `/api/recommendation/analyze`,
  `/api/strength-gap/analyze`, `/api/greeting/analyze` — six public routes, unchanged contracts;
- no persistence, accounts, upload/OCR, score/confidence, or other out-of-scope feature was added.

The full chain (JD -> Profile -> Match -> Recommendation -> Strength/Gap -> Greeting) is
evidence-bound and fail-closed. Users receive one validated Personalized Match Result; raw
model output never reaches the UI unvalidated.

## B. Implementation Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| Frozen implementation HEAD | `6479978fab2ab1062fa93ff0b65e355a4718e44b` |
| HEAD commit | `Phase 2.5: stabilize baseline 21 for final acceptance` |
| Fixture manifest schema | `phase-2-5-fixtures-v1` |
| Fixture manifest SHA-256 | `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41` |
| Model | `deepseek-v4-flash` (default), temperature 0.2/0.1 per stage, budgets/timeouts per run manifest |
| Run manifest | `docs/acceptance-artifacts/phase-2-5/phase-2-5-baseline-22-6479978/run-manifest.json` |

No code, fixture, prompt, model, temperature, retry, timeout, runner, or public contract was
changed after the frozen commit. The matrix executed entirely on the frozen baseline.

## C. Changes Since Baseline 21

No implementation change was required. The two deterministic boundary false positives closed in
baseline-21 (`R-C` described single MI owner + explicit plural `均` status; `X-F` bounded
uncertainty suffix `未说明/未表明`) were already fixed on the frozen HEAD. Baseline-22 is the
new complete replacement matrix on that commit:

- all 42 scheduled Phase 2 top-level runs completed on one baseline;
- no baseline-20 or baseline-21 PASS result was reused or spliced;
- every prior failed artifact remains immutable;
- ISSUE-040～050 receive their final runtime closure evidence (all pass 42/42).

## D. Deterministic Gate

| Gate | Result |
| --- | --- |
| Phase 2.5 fixture / runner-utils focused tests | 38/38 PASS |
| Full automated suite | 33 files / 652 tests PASS |
| ESLint | PASS / 0 warnings |
| Production build + TypeScript | PASS |
| Preflight capability probes (5 routes) | 5/5 `enabled=true`, `rejectedOutputCapture=true`, model calls 0 |
| Diff / scope / whitespace / secret audit | PASS (no key material in artifacts, no unauthorized diff) |
| Historical artifacts | unchanged and immutable |
| Worktree at committed milestone | clean |

Phase 1 compatibility: the Phase 1 pipeline is unchanged since its accepted 30/30 matrix
(baseline-2); Phase 1 route, schema, evidence, and greeting regressions remain green inside the
652-test suite.

## E. 14×3 Model-backed Acceptance

Run: `phase-2-5-baseline-22-6479978` (suite `phase2`, repetitions exactly 3, base URL
`http://127.0.0.1:3000`).

| Metric | Value |
| --- | --- |
| Scheduled top-level runs | 42 |
| PASS | **42/42** |
| Complete chains | 42 |
| Safe failures | 0 |
| Downstream calls after failure | 0 |
| Run 4 / cherry-pick / partial rerun | 0 / none |
| Infrastructure failure records | 0 |
| Invariant audit (X-A～X-J) | pass in all 42 artifacts |
| Fixture expectation adjudication | pass in all 42 artifacts |

Per-stage latency (42 samples):

| Stage | min / avg / max (ms) |
| --- | --- |
| JD | 5,991 / 7,596 / 10,078 |
| Profile | 1,302 / 2,203 / 3,219 |
| Match | 1,947 / 6,026 / 12,634 |
| Recommendation | 1,556 / 2,193 / 3,746 |
| Strength/Gap | 1,481 / 3,339 / 8,757 |
| Greeting | 3 / 2,542 / 3,861 |

Repair / fallback lifecycle:

| Stage | repair attempts / accepted / failed |
| --- | --- |
| Profile | 0 / 0 / 0 |
| Match | 27 / 27 / 0 |
| Recommendation | 3 / 3 / 0 |
| Strength/Gap | 12 / 12 / 0 |
| Greeting | 26 / 7 / 19 (failed attempts then safe fallback) |

Greeting metrics (report-only, non-blocking per frozen decision K.3 / OBS-006):
personalized safe fallback used 19/42, Phase 1 non-personalized fallback 3/42 (frozen expected
for TC-P2-13), all safety guards pass.

Spot-checked expectations and invariants:

- TC-P2-02 R3 (baseline-21 Recommendation failure): PASS, statuses `unmet/unmet/partial/unknown`,
  X-A～X-J pass;
- TC-P2-06 R3 (baseline-21 X-F uncertainty suffix failure): PASS, all invariants pass;
- TC-P2-13 (no safe personalized fact): `not_personalized` greeting, PASS;
- TC-P2-04 / 07 / 12 / 14 representative outputs preserve `unknown`, `partial`, `unmet`,
  team/individual and responsibility boundaries with exact evidence.

## F. Product Acceptance

UI/product smoke on the running production server:

- `GET /` → HTTP 200;
- `GET /personalized-match` → HTTP 200;
- `POST /api/analyze` with empty input → HTTP 400 (structured fail-closed error);
- all six public APIs exercised end-to-end in all 42 runs with validated outputs only.

Gate F (engineering review of the frozen 42-run outputs; the final human PO/QA confirmation is
the remaining release step):

| Dimension | Engineering score (1–5) |
| --- | --- |
| Requirement understanding | 4.4 |
| Candidate truthfulness | 4.8 |
| Match reasoning | 4.5 |
| Recommendation usefulness | 4.3 |
| Strength/Gap actionability | 4.4 |
| Uncertainty discipline | 4.6 |
| Greeting naturalness | 4.1 |
| End-to-end clarity | 4.5 |
| Average / minimum | 4.45 / 4.1 |

Gate F result: **PASS** (average ≥ 4.0, minimum ≥ 3.0, P0 = 0, no systemic/release-blocking P1).

## G. Contract / Truth Boundary Results

All hard gates pass in all 42 completed chains:

- Candidate truth lineage `CF -> PF -> Raw Profile`; JD truth lineage `JD Evidence -> Raw JD`;
- `unknown != unmet`; absence of evidence never treated as counter-evidence;
- explicit negative evidence and relational conclusions remain dimension-local;
- met / partial / unknown / unmet semantics preserved per fixture expectation;
- ownership, responsibility, proficiency, duration, employment/internship/course context,
  experience-type, waiver, and transferable-strength boundaries all preserved;
- Recommendation / Strength-Gap / Greeting consume references only and never become a second
  fact source;
- X-A～X-J evidence invariants: candidate truth, JD truth, status stability, unknown stability,
  negative-evidence stability, modifier integrity, waiver integrity, semantic preservation,
  reference continuity, and no circular truth all pass 42/42;
- fail-closed and downstream-stop behavior verified (downstream-after-failure = 0);
- prompt injection remains source data (TC-P2-06).

## H. Issue / Observation Disposition

| Item | Disposition |
| --- | --- |
| ISSUE-028～039 | CLOSED (Phase 2.4); no regression observed in baseline-22 |
| ISSUE-040～050 | CLOSED — deterministic closure now confirmed at runtime by the 42/42 replacement matrix |
| OBS-002 | report-only; no truth/status/projection regression in baseline-22 |
| OBS-005 long-tail latency | report-only; max single stage 12.6 s (Match), no SLA violation defined |
| OBS-006 Greeting repair/safe-fallback interaction | report-only, non-blocking; safe fallback 19/42, Phase 1 fallback 3/42, all safety guards pass |
| `hrSafeFallbackRate` | report-only per frozen decision; no truth/safety failure |

No new Issue is created by baseline-22: all 42 runs passed with no reproducible defect.

## I. Remaining Risks

- Greeting repair acceptance remains lower than other stages (7/26 accepted); failed repairs
  always fall back to the validated personalized safe fallback or Phase 1 fallback. This is
  naturalness/efficiency debt (OBS-006), not a truth or safety defect.
- Gate F scores above are an engineering review of the frozen outputs; final human PO/QA
  confirmation of product scoring is the one remaining human release step.
- The 42 runs are the frozen acceptance evidence, not a general statistical model benchmark
  (Runtime Model Benchmark remains out of scope).
- DeepSeek account balance remains an external dependency for any future re-execution.

## J. Git / Evidence

- Artifacts: `docs/acceptance-artifacts/phase-2-5/phase-2-5-baseline-22-6479978/`
  (run manifest, fixture manifest, preflight, summary, 42 per-run results; 46 files);
- Summary SHA-256: `372EBEED43233FE53953F2E108B8096E864B550754EA554A5699EDE1BD9E2B83`;
- All historical baselines (1～21) remain immutable and are not reused;
- Secret scan: no `DEEPSEEK_API_KEY` material in artifacts or tracked files;
- Local production server is stopped after acceptance;
- Final worktree is clean at the committed acceptance HEAD.

## K. Final Recommendation

**PASS / CLOSE PHASE 2.5.**

The frozen 14×3 replacement matrix is fully green on the frozen implementation baseline
`6479978`. Every deterministic gate, hard Contract gate, X-A～X-J invariant, fail-closed
guarantee, and Phase 1 compatibility requirement passes. Documentation is reconciled; artifacts
are complete and immutable; no release blocker remains. The only remaining step is the human
PO/QA confirmation of the Gate F product scores before final external release.
