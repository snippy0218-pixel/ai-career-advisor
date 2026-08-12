# Phase 2.4 ISSUE-032 Precheck-path Restabilization

> 日期：2026-08-12
> Starting HEAD：`8a54aa4bde1822b02926e92806a39311fd9a2003`
> Implementation commit：`f66858987f89b3c209eda511e51709c1b7ad9f11`
> 授权：ISSUE-032 runner precheck-path bounded deterministic stabilization
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## A. Exact Root Cause

`run-phase-2-4-e2e-robustness.mjs` 的正常 business path 会调用 `buildExplicitStageLedger(calledStages)`，因此无论在哪个 business stage 失败，六个 expected stages 都会被物化。

但 `preflight.available=false` 使用独立的手写 artifact object，在第一笔 business request 前直接写入：

```text
executionState=preflight_failed
results=[]
```

该分支没有调用现有的 `buildExplicitStageLedger([])` 或 `buildInvariantAudit(false, null)`。因此 frozen state helper 本身没有缺陷；缺陷是 precheck path 绕过了它，导致 `NOT_CALLED` 被序列化为 absent。

## B. Why `results=[]` Was Produced

`results` 表示已经进入 business case loop 的 case results。Preflight 在 loop 前终止，所以 `results=[]` 本身是正确的“business case count=0”事实；错误是它成为唯一 stage representation。

修复保留 `results=[]`，不伪造已执行 case，同时新增顶层 `stages`，复用同一 frozen stage state model。

## C. Complete Expected-stage Ledger

新增 `buildPreflightFailureArtifact(...)`，内部调用：

```text
buildExplicitStageLedger([])
```

固定输出六个 stage：`jd/profile/match/recommendation/strengthGap/greeting`。每个 stage 均为：

- `callState=not_called`；
- `resultState=not_run`；
- `status/latencyMs/requestId/diagnostics/acceptanceDiagnostics/error=null`；
- `attempts={state:not_run,count:null}`；
- `repair/fallback/personalizedFallback/phase1Fallback={state:not_run,attempts:null}`。

没有引入第二套 state vocabulary。

## D. Preflight State Model After Fix

Preflight failure artifact 现在同时保存：

- `executionState=preflight_failed`；
- 五路 capability probe ledger，新增显式 `rejectedOutputCapture` boolean；
- complete six-stage ledger；
- `invariantAudit={status:not_run,values:null,passed:null}`；
- `invariants=null / invariantsPassed=null`；
- `safeFailure=false`；
- known zero：`requestCount/businessCallCount/stageCalls/modelCalls/modelCallsBeforeBusinessExecution/completedChains/safeFailures/downstreamCallsAfterFailure=0`；
- `results=[]` 只表示 business case loop 未运行。

Runner 仍只是 verifier；没有自动设置 diagnostics flag、改变 production default、绕过 probe 或继续 business execution。

## E. P32-1～P32-12 Matrix

| Case | Expected | Result |
| --- | --- | --- |
| P32-1 | 五路 unavailable；callback/model calls 0 | PASS |
| P32-2 | preflight failure 物化六个 not_called/not_run stage | PASS |
| P32-3 | serialization 不丢失任何 stage name | PASS |
| P32-4 | invariant not_run / passed=null | PASS |
| P32-5 | attempts/repair/fallback 全部 not_run | PASS |
| P32-6 | business/model/downstream 为 known 0 | PASS |
| P32-7 | precondition failure 不计 product safeFailure | PASS |
| P32-8 | 单一 capability missing 仍完整 ledger、callback 0 | PASS |
| P32-9 | 五路 available 才执行 callback；无真实模型 | PASS |
| P32-10 | JSON round trip 保留全部 preflight state | PASS |
| P32-11 | 既有 Match/business failure path 不变 | PASS |
| P32-12 | successful-chain state construction 不变 | PASS |

## F. Historical Artifact Reconstruction

测试只读加载：

`docs/acceptance-artifacts/phase-2-4/phase-2-4-post-035-036-rb-05.json`

在新 builder 下以同一 historical preflight outcome 重建得到：

- `executionState=preflight_failed`；
- six stages=`not_called/not_run`；
- `businessCallCount/modelCalls/downstreamCallsAfterFailure=0`；
- invariant=`not_run/passed=null`；
- `safeFailure=false`。

历史 artifact 没有改写，SHA-256 仍为 `a84f4a1ee4731481b587a7ae207cd2de3f0635badbf5ef80e8064399253db509`。

## G. Existing Business-failure Regression

- P32-11 验证 Match 502 仍为 `called/failed`，Recommendation/StrengthGap/Greeting 为 `not_called/not_run`，repair failed 保留，downstream calls=0；
- 原 AS1～AS10 全部通过；
- P32-12 验证六阶段 completed chain 与 invariant pass construction 不变；
- preflight builder 没有参与正常 business artifact construction。

## H. ISSUE-028 Preservation

五路 route capability probe、acceptance-only rejected-output capture 与 adapter lifecycle targeted tests 全绿。Probe 只增加已有 payload 中 `rejectedOutputCapture` 的显式保存；没有改变 production response、raw boundary 或 diagnostics default。ISSUE-028 正式状态保持 `OPEN / LOCAL COMPLETION VERIFIED / ACCEPTANCE PREFLIGHT RUNTIME VERIFIED / Recommendation runtime pending`。

## I. ISSUE-029 / ISSUE-033 / ISSUE-034 Preservation

Match schema/deepseek/route 与 modifier regression 全绿：Candidate lineage、cross-CF isolation、dimension-local negative evidence、dimension-local relational conclusion 均未修改且保持 PASS。

## J. ISSUE-035 / ISSUE-036 Preservation

E35、M36 与 exact historical Match replay 均在 targeted suite 中通过；polarity classifier、positive-evidence guard 和 bounded `工作` classifier 无 production diff。两项保持 `LOCAL FIX VERIFIED / E2E INCONCLUSIVE`。

## K. ISSUE-030 / ISSUE-031 Preservation

Strength/Gap SG-E 与 Recommendation attribution schema/adapter/route regression 全绿；实现无 diff，正式状态保持 local fix verified / E2E pending。

## L. Focused Tests

`npm test -- scripts/phase-2-4-runner-utils.test.mjs`：`1 file / 26 tests PASS`。

## M. Targeted Tests

Runner utilities、五路 routes/adapters、Match/Recommendation/StrengthGap/Greeting schemas、modifier integrity：`16 files / 340 tests PASS`。

## N. Full Suite

`npm test`：`23 files / 530 tests PASS`。

## O. Static Gates

- lint：PASS；
- production build：PASS；
- `git diff --check`：PASS；
- forbidden-surface audit：PASS；
- secret scan：PASS。

## P. Model Calls

- DeepSeek/model-backed calls=`0`；
- RB-05/E2E=`0`；
- stochastic sampling=`0`；
- acceptance flags 未设置，server 未启动。

## Q. Scope Audit

仅修改 Phase 2.4 runner artifact/state construction、runner utility、deterministic tests 与必要文档。未修改 Match、Recommendation、Strength/Gap、Greeting、Candidate Profile、JD business、Prompt、Contract、public Schema、fixture、provider/model/retry/timeout/fallback、production diagnostics defaults 或 Gate。未创建 ISSUE-037，未进入 Phase 2.5。

## R. Git

- branch=`main`；
- starting HEAD=`8a54aa4bde1822b02926e92806a39311fd9a2003`；
- implementation commit=`f66858987f89b3c209eda511e51709c1b7ad9f11`；
- 文档证据在 implementation commit 后单独提交；
- implementation commit 仅包含 3 个 authorized `scripts/` files。

## S. Gate Recommendation

- ISSUE-032：**LOCAL RESTABILIZATION VERIFIED**；
- Phase 2.4：**ready to request one replacement full-chain E2E**。

Phase 2.4 正式状态仍为 BLOCKED。不得自行关闭 ISSUE-032/035/036、执行 replacement RB-05、授权 Phase 2.5 或宣布 Ready for Release。
