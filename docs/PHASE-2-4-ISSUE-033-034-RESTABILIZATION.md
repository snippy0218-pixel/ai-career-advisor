# Phase 2.4 ISSUE-033 / ISSUE-034 Bounded Restabilization

> 日期：2026-08-12
> Starting HEAD：`main / be74c95c4ddc33d8f8586b60b3ad5f6538879c6c`
> Frozen implementation baseline：`cc9fa37608b532a9fe48927bf4480ff1da3b6a75`
> Authorization：ISSUE-033 / ISSUE-034 deterministic bounded restabilization only
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## 1. ISSUE-033 Exact Root Cause and Repair Trace

`match-repair-v1.2` 已说明：若引用 CF 没有同维度 explicit counter-evidence，应改写为 uncertainty boundary；只有 CF 本身明确支持否定语义时才保留 negative，学历/资格值与门槛冲突可保留 mismatch。它没有把下一条 invariant 写成不可跨越的逐 dimension 规则：**explicit negative CF 只能支持自身 semantic dimension，不能被 sibling dimension 借用。**

Repair 可看到完整 previous raw output，因此能看到 dimensionType、status、candidateEvidence refs/role 与 JD evidence；同时可看到 validator issues JSON。本次 exact repair raw 的 terminal claim 位于：

| Field | Exact value |
| --- | --- |
| requirement | `REQ-002 / 具有独立负责数据产品的正式工作经验` |
| dimension index/type | `2 / responsibility` |
| status | `unmet` |
| reason | `候选人明确表示没有正式数据产品工作经历，与独立负责要求直接冲突。` |
| candidate evidence | `CF-004 / counter` |
| CF-004 | `没有正式数据产品工作经历` |
| JD evidence | `具有独立负责数据产品的正式工作经验` |

CF-004 只是否定 employment_type；v1.2 guidance 未显式禁止把它改写为 responsibility mismatch。模型因此清除了 course contamination，却把 dimension X 的 explicit negative 改写为 dimension Y 的 negative relational conclusion。

## 2. ISSUE-033 Dimension-local Fix

- Match core/repair prompt 升级到 v1.3，冻结 invariant：`EXPLICIT NEGATIVE EVIDENCE IS DIMENSION-LOCAL`；
- repair guidance 明确逐 `dimensionType` 审查，禁止 sibling CF、其他 negative CF 与 cross-dimension mismatch，并加入本次 exact BAD/GOOD examples；
- deterministic validator 对 explicit negative CF 建立有界 dimension ownership：formal/full-time/internship→employment_type；education/credential、responsibility、proficiency、skill、domain 只在各自明确语义下成立；
- formal-work negative 一旦命中 employment_type 即停止，不因 statement 同时含“数据产品”而被升级成 domain counter-evidence；
- 当前 dimension 无同维度 negative 时，unknown/partial uncertainty boundary 保持可接受；validator 不放宽，repair 仍非法则 fail-closed。

## 3. G33-1～G33-20

| Gate | Coverage | Result |
| --- | --- | --- |
| G33-1 | unsupported `并非主导角色` | PASS / REJECT |
| G33-2 | leadership uncertainty boundary | PASS / ACCEPT |
| G33-3 | unsupported `无法满足独立负责` | PASS / REJECT |
| G33-4 | responsibility uncertainty boundary | PASS / ACCEPT |
| G33-5 | employment explicit negative in employment_type | PASS / ACCEPT |
| G33-6 | unknown negative wording | PASS / REJECT |
| G33-7 | partial + insufficiency boundary | PASS / ACCEPT |
| G33-8 | prior exact unsupported claims | PASS / REJECT |
| G33-9 | invalid initial → legal boundary repair | PASS / ACCEPT |
| G33-10 | invalid repair retained | PASS / fail-closed |
| G33-11 | employment negative → responsibility conflict | PASS / REJECT |
| G33-12 | employment negative → unable to own independently | PASS / REJECT |
| G33-13 | employment negative → leadership negative | PASS / REJECT |
| G33-14 | responsibility unknown boundary | PASS / ACCEPT |
| G33-15 | employment requirement unmet | PASS / ACCEPT |
| G33-16 | education negative → responsibility | PASS / REJECT |
| G33-17 | multi-CF dimension bleed | PASS / REJECT |
| G33-18 | exact current repair sentence | PASS / REJECT |
| G33-19 | cross-dimension invalid → legal responsibility boundary | PASS / ACCEPT after one repair |
| G33-20 | repair reuses employment negative for responsibility | PASS / fail-closed |

## 4. ISSUE-034 Exact Allow-path Root Cause

Exact escaped repair claim 位于 `REQ-002 / dimensions[1] / domain`：

`候选人明确表示没有正式数据产品工作经历，与数据产品领域要求直接冲突。`

candidateEvidence=`CF-004/counter`，JD evidence=`具有独立负责数据产品的正式工作经验`，status=`unmet`。

修改前的最早允许点有两层：

1. `candidateAssertionClauses` 只让 Candidate assertion pattern 命中的分句进入 lineage。分句 `与数据产品领域要求直接冲突` 虽是 relational mismatch，却不含旧 assertion pattern 要求的 Candidate/action/qualifier token，因此完全跳过 lineage 与 ISSUE-034 exception；
2. 同一句前半 `候选人明确表示没有正式数据产品工作经历` 进入 generic `factSupportsCandidateClause`，因 CF-004 与 clause 共享“数据产品”anchor 而在 domain dimension 被视为支持；旧代码没有 explicit-negative dimension ownership。

因此该 domain wording **没有命中 ISSUE-034 relation exception**；它在 exception 之前就因 clause selection 漏检，且 generic anchor 路径缺少 dimension-local negative guard。旧 relation recognizer 即便被调用，也只校验 dimension/context 中存在 formal-work semantics，没有要求 relation clause 自身保留 employment-type target。

## 5. ISSUE-034 Dimension-local Fix

- 所有 `不符/不满足/冲突` requirement relation 分句强制进入 lineage 审查；
- relational conclusion 不再允许 generic anchor path，必须通过 narrow dimension-local exception；
- employment_type exception 同时要求：employment_type、unmet、all-counter、valid JD evidence、explicit employment negative，以及 **relation clause 自身**含 `正式工作/全职/实习` defining target；
- `数据产品领域要求`、`独立负责要求`、`主导要求` 等 sibling target fail-closed；
- 保留冻结的同维度 qualification threshold comparison（如大专 vs 本科及以上），不扩展为通用 relation parser；
- specific-project negative projection 与 M-K/M-CANDIDATE-LINEAGE 顺序不变。

## 6. L34-1～L34-20

| Gate | Coverage | Result |
| --- | --- | --- |
| L34-1 | explicit formal-work mismatch | PASS / ACCEPT |
| L34-2 | no explicit negative | PASS / REJECT |
| L34-3 | project-property projection | PASS / REJECT |
| L34-4 | unrelated dimension | PASS / REJECT |
| L34-5 | unknown complete mismatch | PASS / REJECT |
| L34-6 | partial complete mismatch | PASS / REJECT |
| L34-7 | equivalent formal-work relation | PASS / ACCEPT |
| L34-8 | multi-CF negative projection | PASS / REJECT |
| L34-9 | original false-positive phrase | PASS / ACCEPT |
| L34-10 | ISSUE-029 course contamination | PASS / REJECT |
| L34-11 | formal-work direct conflict | PASS / ACCEPT |
| L34-12 | broad domain relation | PASS / REJECT |
| L34-13 | responsibility relation | PASS / REJECT |
| L34-14 | leadership relation | PASS / REJECT |
| L34-15 | compound requirement sibling isolation | PASS |
| L34-16 | relation target lacks employment qualifier | PASS / REJECT |
| L34-17 | relation accepted, project projection rejected | PASS |
| L34-18 | multi-dimension sibling bleed | PASS / REJECT |
| L34-19 | exact escaped domain phrase | PASS / REJECT |
| L34-20 | original valid `与正式工作经验要求不符` | PASS / ACCEPT |

## 7. Exact Artifact Replay

Tests 直接读取已提交的 `phase-2-4-post-033-034-rb-05.json` raw Match evidence，不复制、不覆盖 artifact：

- exact initial raw：REJECT；course→CF-004 的 M-K evidence 稳定保留；
- exact repair raw：REJECT；`dimensions[1] domain / 与数据产品领域要求直接冲突` 现在被 M-CANDIDATE-LINEAGE 捕获；
- exact repair raw：`dimensions[2] responsibility / 与独立负责要求直接冲突` 继续被 M-CANDIDATE-LINEAGE 与 M-K 捕获。

## 8. Preservation and Deterministic Gates

- ISSUE-029：course→CF-003/CF-004、无 lineage claim、cross-CF ownership、specific-project projection、multi-CF inheritance 均继续 REJECT；
- ISSUE-028：acceptance architecture 未修改，Profile/Match/route evidence regression PASS；
- ISSUE-030：SG-E 未修改，Strength/Gap regression PASS；
- ISSUE-031：Recommendation attribution 未修改，Recommendation regression PASS；
- ISSUE-032：runner 未修改，state-semantics regression PASS；
- ISSUE-027：Strength/Gap historical regression PASS；
- focused：3 files / 100 tests PASS；
- authorized targeted：16 files / 303 tests PASS；
- full：23 files / 493 tests PASS；
- lint、production build、`git diff --check` PASS；
- secret scan：仅命中测试占位 `test-key`，无 secret；forbidden-surface audit PASS。

## 9. Scope and Recommendation

- model calls=0；RB-05/E2E=0；stochastic sampling=0；
- no fixture/Contract/public Schema/Recommendation/Strength-Gap/Greeting/runner/Gate/provider/retry/timeout/fallback changes；
- 工程建议 ISSUE-033=`LOCAL FIX VERIFIED`；
- 工程建议 ISSUE-034=`LOCAL FIX VERIFIED`；
- Phase 2.4 正式状态仍 BLOCKED；可请求 Product Owner / QA 授权一次新的 full-chain E2E，本轮不自行执行或进入 Phase 2.5。

## 10. Authorized Runtime Follow-up

Product Owner / QA 接受本页 deterministic evidence 后，在 `main / eb10e8a46096265cbc48475c0cf7869dae2e6b01` 上授权唯一一次 post-restabilization RB-05。运行到 Match 后 502：initial 的 CF-004→domain/responsibility negatives 均被正确拒绝；repair 已改为 legal unknown boundaries，但 validator 把 CF-004 employment negative 误认成 domain 的 explicit positive evidence，且 repair 保留 `部分工作` 导致 M-K `experience_type:工作->CF-003`。

无 Final Match，Recommendation/Strength-Gap/Greeting 未调用；严格未 rerun。工程建议 ISSUE-033=`FIX NOT VERIFIED`、ISSUE-034=`VERIFICATION INCONCLUSIVE`，Phase 2.4 仍 BLOCKED。完整 evidence 见 `PHASE-2-4-POST-033-034-RESTABILIZATION-RB-05.md`。
