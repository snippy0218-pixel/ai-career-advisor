# Phase 2.5 baseline 17 evidence and stabilization

> Date: 2026-08-13
> Implementation: `4f042e10f0d745e4838c3affd9f1246ec67daf8b`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Summary SHA-256: `92d08c66d6a65106c81385d6fd4c179e012ecdef8b2ba0c55955111eaf6d9acc`
> Disposition: complete non-passing evidence retained; complete replacement required.

The immutable `14×3` batch completed at `32/42` PASS with downstream-after-failure `0`; TC-P2-10 passed 3/3. TC-P2-01/06/07 (3/3 each) and TC-P2-11 R3 all reached the intended exact-CF `met -> partial` terminal recovery, but the normalized output lacked the schema-required `missingInformation` and `verificationQuestion`. Full validation correctly rejected all ten.

The bounded correction fills those two existing uncertainty fields from the current `requirementFragment` only when terminal recovery actually downgrades to partial. It changes no fact, ref, status decision, Contract, schema, prompt, fixture, provider, or product surface. Focused `148/148`, full `645/645`, lint and build PASS; immutable commit and complete replacement remain.
