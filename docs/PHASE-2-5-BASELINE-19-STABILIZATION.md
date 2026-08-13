# Phase 2.5 baseline 19 evidence and stabilization

> Date: 2026-08-13
> Implementation: `aea8eb7debbb2e668ddc76ab74595d8b605a8710`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Summary SHA-256: `c9e2bd741eeb554ccb7a90752152f4fe8f29b26f44e8a0cd3359af524fd5a1ff`
> Disposition: complete non-passing evidence retained; new committed complete replacement required.

The complete `14×3` batch finished at `40/42` PASS with `40` complete chains and downstream-after-failure `0`. Every baseline-18 target passed 3/3. TC-P2-05 R1 and TC-P2-14 R1 both stopped safely at Strength/Gap after initial and repair outputs were rejected.

TC-P2-05 R1 used `请提供…具体案例` as a valid missing-information request, but SG-H recognized only a narrower verb list. TC-P2-14 R1 used the explicit boundary `但尚不足以证明…`, but SG-E recognized the same clause only without the conjunction. The bounded correction adds `提供` to confirm actions and an optional `但` to the existing insufficiency-boundary grammar. It changes no facts, refs, schema, prompt, fixture, provider, route, product surface, or Gate. Focused `57/57`, full `648/648`, lint, and production build PASS.
