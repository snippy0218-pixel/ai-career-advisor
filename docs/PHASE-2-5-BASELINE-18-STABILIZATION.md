# Phase 2.5 baseline 18 evidence and stabilization

> Date: 2026-08-13
> Implementation: `a16c088d9d5d73b420618a8e41026b3efeacbb6d`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Content summary SHA-256: `09085fa322cec24646d802957a2928b9cd147afd7d757dd77f93c682de3f854b`
> Disposition: infrastructure attempt and complete non-passing replacement retained; new committed complete replacement required.

The first baseline-18 attempt stopped before any content sample after TC-P2-01-R1 returned a 33 ms `AI_SERVICE_UNAVAILABLE` from the sandboxed server. Its separate artifact records `completedContentSamples=0`, `failedAttemptCountsAsContentSample=false`, and no later scheduled request. The server was restarted with authorized network access under the same implementation and frozen configuration.

`phase-2-5-baseline-18-replacement-a16c088` then completed all `42/42` scheduled samples at `39/42` PASS, `40` complete chains, and downstream-after-failure `0`. TC-P2-02 R2 completed the full chain and passed its frozen expectation, but X-F falsely rejected the uncertainty wording `熟练程度及实际数据分析应用场景未明确`. TC-P2-04 R2/R3 stopped at Recommendation because R-C read the positive substring `完全满足` inside the negated partial phrase `未完全满足` as a met claim.

Both defects are deterministic classifier boundaries with unique behavior under the frozen Contract. The bounded correction (1) excludes locally negated met phrases before R-C status comparison and (2) recognizes `未明确` after a proficiency modifier as an uncertainty boundary in X-F. No fact, ref, schema, prompt, fixture, provider, route, product surface, or Gate changes. Focused `106/106`, full `646/646`, lint, and production build PASS.
