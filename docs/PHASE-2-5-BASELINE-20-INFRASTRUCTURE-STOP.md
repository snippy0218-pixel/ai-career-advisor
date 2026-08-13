# Phase 2.5 baseline 20 infrastructure stop

> Date: 2026-08-13
> Implementation: `2a2a56db434a61e8ad22ea4c4e506de42df2663e`
> Fixture manifest: `f8460a83c0fab597f96d8ba2182dfccef8ceb12e4ed4afc08f5b051a38dfae41`
> Infrastructure artifact SHA-256: `42a33deb451a48040a6a8386fca8580bb7cd567d5a4ce4ceeabab2a7f4c0c490`
> Disposition: incomplete infrastructure batch retained and excluded; full replacement blocked on external account balance.

Baseline 20 completed ten content samples, all PASS, then TC-P2-04 R2 failed at Match with provider response `AI_BALANCE_INSUFFICIENT`, HTTP 503, `retryable=false`, completion received=false, completion tokens=0. The runner stopped immediately, recorded `failedAttemptCountsAsContentSample=false` and `additionalScheduledRequestsAfterFailure=0`, and did not schedule the remaining matrix. No implementation, fixture, prompt, Contract, schema, or Gate changed during the batch.

This incomplete batch cannot contribute to final acceptance and will not be composed with any later result. A fresh complete `14×3` replacement on the same immutable implementation is required after the DeepSeek account has sufficient balance. Product expansion and further model execution are stopped until that external condition changes.
