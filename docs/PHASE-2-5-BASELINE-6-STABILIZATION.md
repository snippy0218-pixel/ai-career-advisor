# Phase 2.5 baseline 6 evidence and stabilization

> Date: 2026-08-13
> Implementation under test: `8b8cae686fb11dfdc3923b317cec56e13aedda47`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Artifact summary SHA-256: `87b7a0698e977c473729ceedcf089a1b3724eb4064416c821e1a833bcf4edf87`
> Disposition: complete non-passing stabilization evidence retained; a complete replacement Phase 2 matrix is required.

## 1. Sampling discipline

`phase-2-5-baseline-6-8b8cae6` ran the frozen `TC-P2-01..14 x 3` schedule after all five capability probes passed with zero business/model calls. Commit, fixtures, runner, provider/model configuration, temperatures, timeouts, and repair policy remained fixed across all 42 executions.

No run 4, selected rerun, partial composition, overwrite, or deletion occurred. All results were written incrementally to `docs/acceptance-artifacts/phase-2-5/phase-2-5-baseline-6-8b8cae6/`.

## 2. Baseline 6 result

Baseline 6 completed the full schedule: `35/42` PASS, `39/42` complete chains, and `0` downstream calls after a failed stage. It is a valid non-passing matrix and improves baseline 5 from 30 to 35 passes.

| Fixture | R1 | R2 | R3 | Primary disposition |
| --- | --- | --- | --- | --- |
| TC-P2-01 | PASS | PASS | PASS | accepted |
| TC-P2-02 | X-F fail | PASS | X-F fail | `熟练程度不足` misread as an asserted proficiency upgrade |
| TC-P2-03 | PASS | PASS | PASS | accepted |
| TC-P2-04 | PASS | PASS | PASS | accepted |
| TC-P2-05 | PASS | PASS | PASS | accepted |
| TC-P2-06 | PASS | PASS | PASS | accepted |
| TC-P2-07 | PASS | PASS | PASS | accepted |
| TC-P2-08 | X-F fail | X-F fail | PASS | `技能熟练度不足` misread as an asserted proficiency upgrade |
| TC-P2-09 | PASS | PASS | PASS | accepted |
| TC-P2-10 | Recommendation fail | PASS | Match fail | missing HR strictness question; unsupported team-delivery counter relation survived repair |
| TC-P2-11 | PASS | PASS | Recommendation fail | natural `该学历要求是否为严格筛选门槛` order not recognized |
| TC-P2-12 | PASS | PASS | PASS | accepted |
| TC-P2-13 | PASS | PASS | PASS | accepted |
| TC-P2-14 | PASS | PASS | PASS | accepted |

Lifecycle metrics: Profile repair `0/0`; Match repair `29/30`; Recommendation repair `3/5`; Strength/Gap repair `10/10`; Greeting repair `4/24`. Personalized Greeting safe fallback was `20/20`; Phase 1 fallback was `3/3`. Fallback safety remained non-blocking, and no hard invariant failed in a fallback output.

## 3. Root adjudication and bounded changes

1. **X-F negative proficiency scope (ISSUE-044 extension):** an unsourced proficiency word followed locally by `程度/度不足、不明、未知、待确认` is a negative or uncertainty boundary, not a claim that the Candidate is proficient. Positive current-proficiency assertions remain source-bound.
2. **Recommendation strictness confirmation (ISSUE-042 extension):** R-K recognizes both `确认...是否为严格门槛` and natural direct-question order such as `该学历要求是否为严格筛选门槛`. If the only remaining terminal repair defect is a missing strictness question for an explicit `MI-xxx`, normalization appends one fact-free HR question and reruns R-A～R-L.
3. **Unsupported team-delivery counter (ISSUE-048 extension):** when an `unmet` responsibility repair attributes a team-leader/centralized-delivery relation to a CF that the lineage validator rejects, the terminal output may only downgrade that dimension to `unknown`, remove the unsupported counter ref, and rerun the complete Match validator. Qualification and cross-dimension counter failures remain fail-closed.
4. **Accepted upstream output preservation (ISSUE-050):** failed-chain artifacts previously kept lifecycle and rejected raw but omitted the final structured output of already-completed upstream stages. The runner now stores a cloned `output` for every completed stage, while failed/not-run stages remain null. This does not alter production responses or generation behavior.

Frozen truth/status/waiver semantics, public schemas/APIs, fixtures, model settings, and Phase boundaries remain unchanged.

## 4. Deterministic verification before replacement matrix

- exact/generalized Match, Recommendation, X-F, runner focused regression: `7 files / 139 tests` PASS;
- complete suite: `33 files / 630 tests` PASS;
- lint: PASS, zero warnings;
- TypeScript and production build: PASS; `/personalized-match` and all six released API routes emitted;
- diff/whitespace/scope audit: PASS; frozen Contracts, public API/schema, fixtures, prompts, and provider settings unchanged;
- secret/process audit: PASS; actual process key has zero repository matches, no `.env.local`, and no port 3000 listener remains;
- artifact commit and a new immutable implementation commit remain before the next full matrix.

No baseline 6 success may be cherry-picked into the replacement matrix.
