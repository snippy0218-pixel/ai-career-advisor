# Phase 2.5 Final Regression / Release Gate — Autonomous Plan

> Status: **AUTHORIZED / IN PROGRESS**
> Authorization date: 2026-08-13
> Starting baseline: `16c92d6021ef2843d6904f0740ebbc419de98cba`
> Governing contracts: `PHASE-2-CONTRACT.md`, `PHASE-2-5-PRE-AUTHORIZATION-AUDIT.md`, `CODEX-OPERATING-PROTOCOL.md`, `PROJECT_RULES.md`

## 1. Product Owner / QA decisions

The Product Owner / QA authorization closes every open decision in `PHASE-2-5-PRE-AUTHORIZATION-AUDIT.md §K`:

1. **Release surface:** implement one narrow ordinary-user journey, `Raw JD + Raw Candidate Profile -> Personalized Match Result`, by composing the six released APIs. Users must not paste internal JSON.
2. **Acceptance material:** recover the exact Phase 1 TC-01～TC-10 inputs from repository evidence; freeze 14 de-identified Phase 2 JD/Profile pairs with durable hashes and explicit coverage rationale.
3. **Model budget:** authorize Phase 1 `10 × 3 = 30` top-level JD analyses and Phase 2 `14 × 3 = 42` top-level full-chain cases, including released repair/retry paths. If an implementation change affects a semantic/generation path, preserve the failed batch, commit a new baseline, and rerun the complete affected matrix.
4. **Fallback rule:** `hrSafeFallbackRate` is report-only and non-blocking. Counts, rates, trigger, stage, and safety disposition remain mandatory. `OBS-006` stays non-blocking unless it exposes a correctness defect.
5. **Final disposition authority:** Codex may complete all in-scope implementation, deterministic verification, frozen matrix execution, bounded stabilization, evidence reconciliation, and final Phase 2.5 release audit. Frozen Contract, public schemas, Phase boundaries, and the exclusion list remain unchanged.

No public deployment, account/persistence feature, file parsing, resume tooling, interview feature, confidence/score, paid resource beyond the authorized DeepSeek use, destructive history edit, or Phase 3 work is authorized.

## 2. Frozen fixtures

- Fixture implementation: `scripts/phase-2-5-fixtures.mjs`.
- Fixture regression: `scripts/phase-2-5-fixtures.test.mjs`.
- Manifest schema: `phase-2-5-fixtures-v1`.
- Frozen manifest SHA-256: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`.
- Phase 1 source: exact fenced JD blocks in `验收执行报告.md`; each block is accepted only when both historical character count and SHA-256 match.
- Phase 2 set: `TC-P2-01～14`; every entry freezes raw JD, raw Profile, both hashes, expected outcome/status signals, coverage labels, and rationale.

The Phase 2 set covers direct evidence, CF→PF and JD lineage, met/partial/unmet/unknown, explicit counter-evidence, proficiency, ownership, team/individual attribution, course/internship/formal-employment/duration boundaries, transferable evidence, explicit waiver boundaries, prompt injection, near-limit no-truncation, noisy input, and Personalized Greeting fallback.

## 3. Frozen run policy

### 3.1 Deterministic gate

1. focused fixture, product-flow, runner, and exact replay tests;
2. relevant targeted suites;
3. full `npm test`;
4. `npm run lint` with zero warnings;
5. `npm run build` / TypeScript;
6. production UI/API smoke with no server left running;
7. diff, scope, whitespace, secret, historical-artifact, frozen-schema, and public-route audit;
8. clean committed candidate baseline before formal model execution.

### 3.2 Formal model matrices

- Phase 1: exact `TC-01～TC-10 × 3` on one committed baseline.
- Phase 2: exact `TC-P2-01～14 × 3` on one committed baseline.
- Within a batch: fixture, hash, implementation commit, model, temperature, token budget, retry, timeout, runner, and diagnostic flags are immutable.
- Every scheduled run is retained. No cherry-pick, run 4, selected partial rerun, overwrite, or deletion.
- Infrastructure/preflight failure is stored separately and is not counted as a content sample.
- A corrected committed baseline reruns the complete affected matrix; all superseded failures remain preserved.

### 3.3 Required Phase 2 artifact evidence

Each top-level case records input/fixture/implementation/run IDs; per-stage call, HTTP and completion state; request ID and latency; raw initial/repair evidence when rejected; normalization and validator diagnostics; model metadata; downstream stop state; final validated output or failure class; X-A～X-J; expected-outcome adjudication; fallback/repair/latency metrics; and final product score fields.

## 4. Gate F and hard release gates

- Eight-dimension product scoring: average `>= 4.0 / 5`, minimum dimension `>= 3.0 / 5`.
- `P0 = 0`; no open release-blocking or systemic P1.
- Candidate/JD truth, lineage, contamination, qualifier/semantic upgrade, `unknown != unmet`, dimension-local counter/relation, waiver, schema, fail-closed, downstream-stop, and Phase 1 compatibility are hard gates and cannot be averaged away.
- `hrSafeFallbackRate` and `OBS-006` are reported but not release thresholds unless the underlying output violates a hard correctness gate.

## 5. Execution stages

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Record authorization; recover/freeze 10 Phase 1 and 14 Phase 2 fixtures | COMPLETE |
| 2 | Implement narrow integrated product flow and focused UI/API regression | COMPLETE |
| 3 | Implement Phase 2.5 runner, artifact schema, metrics, and zero-model tests | COMPLETE |
| 4 | Complete deterministic gate and commit immutable candidate baseline | DETERMINISTIC PASS / COMMIT IN PROGRESS |
| 5 | Execute complete Phase 1 and Phase 2 formal matrices | PENDING |
| 6 | Stabilize reproducible in-scope defects on new baselines when necessary | PENDING |
| 7 | Product acceptance, evidence/Git/secret audit, docs reconciliation, final disposition | PENDING |

## 6. Stop & Escalate

Only the conditions in `PHASE-2-5-PRE-AUTHORIZATION-AUDIT.md §G` stop autonomous work. Ordinary implementation defects, invalid model output, repair failure, runner bugs, deterministic validator bugs, and a failed intermediate matrix remain in-scope stabilization work.

## 7. Exit

Phase 2.5 closes only when the integrated journey is usable, both formal matrices and every hard gate pass on the final accepted committed baseline, Gate F passes, artifacts and docs are complete, no release blocker remains, the secret/scope/Git audit passes, and the final worktree is clean.
