# Phase 2.5 baseline 21 evidence and stabilization

> Date: 2026-08-14
> Implementation: `2a2a56db434a61e8ad22ea4c4e506de42df2663e`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Summary SHA-256: `93c55006c2cd41e919982be4aaf597e664a0942a3aace593da8d2d98ea5ffb05`
> Disposition: complete non-passing stabilization evidence retained; new committed complete replacement required.

Product Owner / QA restored the DeepSeek balance and authorized a fresh replacement without reusing any baseline-20 result. Before content execution, baseline 21 recorded a new execution/billing starting point, confirmed that only the existing `DEEPSEEK_API_KEY` was available, and passed all five diagnostics capability probes with zero model calls. Three earlier local launch attempts are separately preserved as zero-call pre-content infrastructure evidence.

The complete `14×3` batch finished at `40/42` PASS with `41` complete chains, downstream-after-failure `0`, and no run 4. TC-P2-02 R3 stopped at Recommendation after byte-equivalent initial/repair outputs used a legal described MI owner plus an explicit plural `均` status conclusion. R-C rejected the legal ownership form. TC-P2-06 R3 completed the full chain and passed every other expectation, but X-F did not recognize the bounded uncertainty suffix `正式工作背景未说明`.

The correction is deliberately narrow. R-C now accepts a described single MI owner and accepts a plural status owner only when every possible structured MI has the same final status; a mixed-status negative control remains fail-closed. X-F accepts nearby `未说明/未表明` only as an uncertainty suffix; the positive claim `候选人具备正式工作背景` remains rejected. No Contract, public schema, fixture, prompt, model, thinking setting, repair policy, route semantics, or product surface changed.

Exact artifact replay and focused suites pass `97/97`; the full suite passes `33 files / 652 tests`; lint and production build pass. Diff, scope, and secret audits pass. Baseline 21 remains immutable stabilization evidence and contributes no sample to the required new matrix.
