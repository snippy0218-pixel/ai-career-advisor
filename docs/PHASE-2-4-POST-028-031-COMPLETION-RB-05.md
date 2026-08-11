# Phase 2.4 post-028/031 Completion RB-05 Evidence

> 日期：2026-08-11
> Authorization baseline：`main / 901c7b6f3e37990d11ac4534ab60d0c582547faa`
> Run policy：`NEW DETERMINISTIC BASELINE VERIFICATION / E2E-RB-05 × 1`
> Result：`0/1 / stoppedAt=match / Phase 2.4 remains BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## 1. Authorization, Preflight, and Frozen Input

- execution 前 branch=`main`、HEAD=`901c7b6f3e37990d11ac4534ab60d0c582547faa`、Git status clean；
- process API key 仅确认存在，不读取或记录值；`DEEPSEEK_MODEL` 与 `DEEPSEEK_BASE_URL` 无环境覆盖，继续使用冻结默认 `deepseek-v4-flash / https://api.deepseek.com`；
- Profile、Match、Recommendation、Strength/Gap、Greeting 五路 capability 均 HTTP 200、`enabled=true`；该状态由 capability header 与 `rejectedOutputCapture=true` 共同判定；
- `modelCallsBeforeBusinessExecution=0`；
- JD：length 138，SHA-256 `bf1eea5f393bb5a9ce7dd5de9ab76a0dc95f90bb4742b656e2916281584f4a60`，historicalMatch=true；
- Profile：length 80，SHA-256 `0b19712da6ae0a07c4543fe8d3427a1650c4e711b7c1ed4d33a38e14e2925745`，historicalMatch=true；
- 新 artifact 路径在执行前不存在；22 个历史 Phase 2.4 artifacts 保持原位。

## 2. Exactly One Model-backed Run

唯一运行的 stage ledger：

| Stage | callState | resultState | HTTP | Latency | Attempts | Repair | Fallback | Request ID |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| JD | called | completed | 200 | 7,325 ms | unknown | unknown | unknown | `3003fd85-7d9d-463a-93c2-50399eaf5952` |
| Profile | called | completed | 200 | 2,463 ms | 1 | not_needed | not_used | `86cc98c9-707d-4607-ae46-97f0da812190` |
| Match | called | failed | 502 | 10,624 ms | 2 | failed / rejected | not_used | `59e9aa55-de99-4b80-9e3e-42fc2b68cc5d` |
| Recommendation | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Strength/Gap | not_called | not_run | null | null | not_run | not_run | not_run | null |
| Greeting | not_called | not_run | null | null | not_run | not_run | not_run | null |

Executed-stage latency total：20,412 ms。完整链未完成，因此 full-chain total 不报告为成功链 latency。`downstreamCallsAfterFailure=0`；`safeFailure=false`；invariant audit=`not_run / passed=null`。model-backed RB-05 executions=1，additional reruns=0。

## 3. Candidate and JD Evidence

Candidate lineage 完整：

| CF | Canonical statement | PF | Raw Profile evidence |
| --- | --- | --- | --- |
| CF-001 | 教育背景：信息管理本科 | PF-001 | 教育背景：信息管理本科 |
| CF-002 | 课程项目：在课程中了解 Python 基础语法 | PF-002 | 课程项目：在课程中了解 Python 基础语法 |
| CF-003 | 与四人团队共同完成数据展示作业，我协助整理需求和测试 | PF-003 | 团队经历：与四人团队共同完成数据展示作业，我协助整理需求和测试 |
| CF-004 | 没有正式数据产品工作经历 | PF-004 | 没有正式数据产品工作经历 |

Match initial/repair 引用的四条 JD evidence 均逐字存在于 frozen Raw JD：`熟练掌握 Python`、`具有独立负责数据产品的正式工作经验`、`能主导跨团队项目并对个人交付结果负责`、`本科及以上学历`。

## 4. Rejected Output Evidence

Rejected outputs=2：Match initial 与 Match repair。两者 completionReceived=true、rawAvailable=true、parse passed、finishReason=`stop`、artifactTruncated=false、failureStage/failureCategory=`semantic_validation`。initial rawTextLength=3,836；repair rawTextLength=3,812。

### Initial — 7 validation issues

1. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.0.reason`：`与正式工作经验要求不符`；
2. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.1.reason`：`且课程项目为数据展示作业`；
3. `M-K` / same path：`experience_type:课程->CF-004`；
4. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.2.reason`：`无法满足独立负责的要求`；
5. `M-CANDIDATE-LINEAGE` / `matchItems.2.dimensions.0.reason`：`并非主导角色`；
6. `M-CANDIDATE-LINEAGE` / same path：`且为课程项目`；
7. `M-K` / same path：`experience_type:课程->CF-003`。

Initial 的 `课程->CF-004/CF-003` 是 ISSUE-029 同族 cross-CF contamination。CF-002 独占课程 scope；CF-003 只陈述团队数据展示作业，CF-004 只陈述无正式数据产品工作经历。M-K 正确拒绝，污染未进入 Final Match。

### Repair — 3 validation issues

1. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.0.reason`：`与正式工作经验要求不符`；
2. `M-CANDIDATE-LINEAGE` / `matchItems.1.dimensions.2.reason`：`无法满足独立负责的要求`；
3. `M-CANDIDATE-LINEAGE` / `matchItems.2.dimensions.0.reason`：`并非主导角色`。

Repair 已把 course/cross-CF contamination 清零，但仍未成为合法 Match：

- `无法满足独立负责的要求` 不能由“没有正式数据产品工作经历”独立证明；formal employment absence 不等于缺乏独立责任能力；
- `并非主导角色` 不能由“协助整理需求和测试”独立证明；协助事实不等于否定主导，absence of evidence 不能升级为 negative evidence；
- 上述两项由 guard 正确 fail-closed，足以使 repair 拒绝；
- `与正式工作经验要求不符` 是 CF-004 negative fact 与 JD formal-experience requirement 的语义比较，现有证据实际支持该 comparison；当前 M-CANDIDATE-LINEAGE 只用 CF anchor 审查该分句而拒绝，属于需 Product Owner / QA adjudicate 的 possible deterministic false-positive observation。但即使移除此项，本次 repair 仍因另外两条 unsupported negative upgrade 合法失败。

## 5. Issue Audits

- ISSUE-028：五路 capability 与 lifecycle 保持正常；但 Recommendation 未调用，没有 Recommendation runtime rejection/acceptance evidence可验证新 structured R-C code/rule path。Verdict：`INCONCLUSIVE`。
- ISSUE-031：Recommendation 未调用，无法审查 parenthetical ownership、MI group attribution 或 runtime repair。Verdict：`VERIFICATION INCONCLUSIVE`。
- ISSUE-030：Strength/Gap 未调用。Verdict：`VERIFICATION INCONCLUSIVE`。
- ISSUE-029：initial contamination present → M-K/M-CANDIDATE-LINEAGE rejected → repair course contamination=0；repair 仍因其他 unsupported claims rejected；Final accepted Match 不存在，因此 accepted contamination count=`N/A`，没有 unsupported contamination released。安全保护保持有效，但 closure 所需 full-chain evidence 仍未取得。
- ISSUE-032：`not_called != absent`、`not_run != pass`、downstream metrics、invariant `passed=null`、known/unknown/not_run lifecycle 与 downstreamCallsAfterFailure=0 均正确保存。Preservation PASS。

## 6. Global Hard Gates and Failure Semantics

JD 与 Profile accepted output 的 evidence continuity PASS。Match 的非法 initial/repair 均未成为 accepted output；因此 Recommendation/Strength-Gap/Greeting 和完整链 X-A～X-J 不得宣称 PASS，而保持 `not_run`。

Terminal failure 不是 infrastructure/provider/transport/timeout，也不是 evidence loss 或 Contract parse failure。最符合证据的描述是：`model generation retained unsupported Candidate-negative upgrades; deterministic Match safety guards correctly rejected initial and repair`，同时存在一条不影响本次终局的 possible lineage-validator false-positive observation。

## 7. Artifact and Scope

- Artifact：`docs/acceptance-artifacts/phase-2-4/phase-2-4-post-028-031-completion-rb-05.json`
- SHA-256：`ecdcbe2e612d2f5fd9d77eba03d3ad8548baa3ec32fefb2016e231d4ab2a64b3`
- Artifact size：94,517 UTF-8 bytes（审计时读取的 trailing-newline-inclusive content）；
- 运行前 22 个历史 artifacts、运行后 23 个；Git 仅显示新增本 artifact，证明未覆盖历史文件；
- no code/fixture/Prompt/Contract/Schema/validator/runner/Gate/model/provider/temperature/retry/timeout/fallback changes；
- exactly one model-backed run；no extra rerun；no Phase 2.5。

## 8. Gate Recommendation

建议：`Phase 2.4 仍 BLOCKED`。不得自行关闭 ISSUE-028～032、Phase 2.4，不得授权 Phase 2.5。等待 Product Owner / QA 对 terminal Match evidence及 possible M-CANDIDATE-LINEAGE false-positive observation 做 Gate Review。

## 9. Subsequent Product Owner / QA Disposition

本节只追加后续裁决，不修改或覆盖上述 runtime artifact 事实：

- `无法满足独立负责的要求` 与 `并非主导角色` 归入新 P1 `ISSUE-033 — Match Repair Unsupported Negative-Claim Stability`；原 deterministic guard 正确拒绝，bounded work 聚焦 repair robustness；
- `与正式工作经验要求不符` 归入新 P1 `ISSUE-034 — Match Lineage False Positive on Supported CF↔JD Relational Conclusion`；经修改前 lineage adjudication，CF-004/PF-004/Raw Profile 与 JD requirement 语义充分支持该同维度 relation，结论 `FALSE POSITIVE CONFIRMED`；
- bounded deterministic stabilization 与 G33/L34 evidence 见 `PHASE-2-4-ISSUE-033-034-STABILIZATION.md`；本次历史 RB-05 仍保持唯一、未覆盖、不得当作 post-fix E2E evidence。
