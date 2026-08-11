# Phase 2.4 ISSUE-028 / ISSUE-032 Bounded Stabilization Evidence

> 日期：2026-08-11
> Starting baseline：`4828fae5a506873b4c4fd4c553f521c2d22b6c15`
> 授权：deterministic implementation + deterministic tests only
> Phase 2.4：STOP & ESCALATE / BLOCKED
> Phase 2.5：NOT AUTHORIZED

## 1. ISSUE-028 — Acceptance Auditability

### Earliest-loss fix

正式 Phase 2.4 runner 现在先对 Profile、Match、Recommendation、Strength/Gap、Greeting 五个实际 route 发 acceptance-only capability probe。每个 route 在 request parsing 与 adapter 调用前短路，并且只有对应 server-side acceptance flag 实际启用时才返回 `rejectedOutputCapture=true`。任一 capability 缺失时 runner 在第一笔业务请求前写入 `ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE` artifact、`modelCalls=0` 并失败退出；不再只检查本地 `process.env` 或默默继续。

普通请求不携带 probe header，不进入该分支；普通 production response 继续不包含 rejected raw、internal validation detail 或 acceptance diagnostics。

### Completion lifecycle

五个生成 adapter 共用 internal-only completion failure envelope；它继承公开 `ApiError`，但 raw/finish reason/failure classification 只由 acceptance diagnostics 消费，不进入公开错误 Contract。Diagnostics 明确保存：

- initial：called、completionReceived、rawAvailable、parseResult、validationResult、rejectionReason、finishReason、failureStage、failureCategory；
- repair：`not_attempted / not_needed / attempted / completion_failed / rejected / accepted`，以及独立 repair attempt detail；
- provider/transport/timeout 在 completion 前失败时记录 `rawAvailable=false`；
- `finish_reason=length`、content filter 等在 raw 已存在时保存有界、scrubbed raw，并记录 finish reason、truncation 与 failure stage；
- parse、raw schema、semantic validation 分开记录，不再只能看到公共 `AI_OUTPUT_INVALID`。

### Match-specific evidence

Match 不再复用 SG rejected-item/rule parser。`match-evidence.ts` 保存：

- initial / repair stage；
- completionReceived / rawAvailable / rawTextLength / artifactTruncated；
- finishReason / parsedOutputAvailable / parseError；
- validationLayer / failureStage / failureCategory；
- validationCode / Match rule / path / message；
- 可定位时的 Match item index、dimension index、scrubbed item/dimension；无法唯一定位时 `rejectedItem=null`，不伪造 `MI-*`。

## 2. Completion Failure Matrix

| Failure | Raw available | Acceptance evidence | Repair state | Classification |
| --- | --- | --- | --- | --- |
| transport/network before completion | false | explicit no-raw evidence | not_attempted / completion_failed | transport |
| provider HTTP / invalid provider response | false | explicit no-raw evidence | not_attempted / completion_failed | provider |
| `finish_reason=length` | true（若 content 存在） | bounded scrubbed partial raw | not_attempted / completion_failed | truncated |
| empty content | false | explicit no-raw evidence | not_attempted / completion_failed | empty_output |
| content filter with content | true | bounded scrubbed raw | not_attempted / completion_failed | content_filter |
| JSON parse failure | true | raw + `JSON_PARSE_ERROR` | attempted/rejected as applicable | parse |
| raw schema failure | true | raw + schema path/message | attempted/rejected | schema |
| semantic validation failure | true | raw + deterministic rule/path/message | attempted/rejected | semantic_validation |
| repair accepted/rejected | true | initial + repair raw/status | accepted/rejected | validation result |

## 3. Cross-module Preservation

| Module | Initial rejected raw | Accepted repair raw | Rejected repair raw | Completion failure | Acceptance 5xx/body or fallback evidence |
| --- | --- | --- | --- | --- | --- |
| Profile | PASS | PASS | PASS | PASS | PASS |
| Match | PASS | PASS | PASS | PASS | PASS（route 502） |
| Recommendation | PASS | PASS | PASS | PASS | PASS（route 502） |
| Strength/Gap | PASS | PASS | PASS | PASS | PASS（route 502） |
| Greeting | PASS | PASS | PASS/fallback | PASS | PASS（validated safe fallback + diagnostics） |

## 4. ISSUE-032 — Artifact State Model

Runner 为 JD、Profile、Match、Recommendation、Strength/Gap、Greeting 始终输出显式 stage ledger：

- `callState = called | not_called`；
- `resultState = completed | failed | not_run`；
- attempts：known integer、`unknown` 或 `not_run`；
- repair：`not_run / not_needed / attempted / accepted / failed / unknown`；
- fallback：`not_run / not_used / used / unknown`；
- invariant audit：`pass / fail / not_run / unknown`，其中 `not_run` 与 `unknown` 的 `passed=null`；
- downstream call count 从 stage ledger 计算，不再硬编码；
- summary `safeFailures` 直接聚合 per-run `safeFailure`，普通业务 validator 502 不因停止就算 safe failure；
- repair/fallback aggregate 同时保存 `knownCount / unknownCount / notRunCount / complete`，不再 `missing diagnostics → 0`。

## 5. Deterministic Verification

- ISSUE-028/032 focused adapter、route、runner tests：91/91 PASS；
- ISSUE-029/030/031 authorized targeted regression：148/148 PASS；
- full suite：23 files / 429 tests PASS；
- lint：PASS；
- production build：PASS；
- `git diff --check`：PASS；
- model calls：0；
- RB-05：未执行。

## 6. Scope / Gate

未修改 Match/Recommendation Prompt、Match status/Candidate lineage 业务语义、ISSUE-029 guard、ISSUE-030 SG-E、ISSUE-031 status attribution、Candidate Fact/PF Schema、Greeting/Phase 2 Contract、frozen fixture、provider/model/timeout/retry policy。ISSUE-029/030/031 implementation 均保持不变，其 deterministic regression 继续 PASS。

工程建议：ISSUE-028 `LOCAL FIX VERIFIED`；ISSUE-032 `LOCAL FIX VERIFIED`；Phase 2.4 可申请新的 E2E verification authorization，但在 Product Owner / QA 明确授权前仍为 BLOCKED，且不得执行 RB-05 或进入 Phase 2.5。
