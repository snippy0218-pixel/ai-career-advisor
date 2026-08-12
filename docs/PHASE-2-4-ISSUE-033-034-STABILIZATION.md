# Phase 2.4 ISSUE-033 / ISSUE-034 Bounded Stabilization

> 日期：2026-08-11
> Starting baseline：`main / 717f7a272996fd8f40554a854815ddfb40876c40`
> Implementation evidence baseline：`901c7b6f3e37990d11ac4534ab60d0c582547faa`
> 授权：ISSUE-033 bounded stabilization；ISSUE-034 先 lineage adjudication，仅在 false positive confirmed 后做 bounded stabilization
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## 1. ISSUE-033 Root Cause

post-028/031 completion RB-05 的 Match initial/repair 中，模型把“未观察到正证”升级成 Candidate negative fact：

- `无法满足独立负责的要求`：CF-004 只证明候选人没有正式数据产品工作经历，不能独立证明候选人无法独立负责；
- `并非主导角色`：CF-003 只证明候选人协助整理需求和测试，不能独立证明候选人不是主导角色。

现有 Match system rules 已规定 reason 不得凭空声称候选人缺少能力，但 repair instruction 只有通用的“修复列出问题”，没有针对 `M-CANDIDATE-LINEAGE` 明确要求把 unsupported negative 改写成 uncertainty / missing-information boundary，也没有 BAD/GOOD 对照。模型因此在 repair 中用否定近义表达保留了同一语义升级。deterministic guard 正确 fail-closed，但 repair stability 不足。

### Pre-fix exact repair instruction trace

pre-fix `match-repair-v1.1` 的 repair user instruction 逐字为：

> 这是一次有界 Match Repair。只修复列出的 schema/evidence/reference/status/aggregate/contamination 问题；不得改变输入账本，不得制造 Candidate Fact，不得加入新产品字段。

随后只附加只读事实账本、上次输出和 `必须修复的问题` JSON。本次相关 validator message 逐字为：

> M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 无法满足独立负责的要求

> M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 并非主导角色

system rule 14 虽有“reason 是审慎的 match observation，不是 Candidate Fact；不得凭空声称候选人拥有、不会或缺少某能力”，rule 15 也禁止 qualifier 跨 CF 传播，但 pre-fix repair instruction 没有定义 `explicit negative evidence`、`missing evidence`、`unknown boundary` 的转换规则，也没有要求修复时将被拒 negative assertion 改为 `未表明 / 尚无证据证明 / 当前无法确认`。未发现其他 prompt wording 明确要求把 missing evidence 转成 negative conclusion；根因是 repair guidance 不充分，而不是存在相反的显式指令。

## 2. ISSUE-033 Bounded Fix

- Match core/repair prompt 升级到 `match-core-v1.2` / `match-repair-v1.2`；
- 明确区分 explicit counter-evidence 与 absence of evidence：只有同维度明确反证或学历/资格值与门槛直接冲突时才允许 `unmet`；Profile 仅未表明时必须使用 uncertainty boundary，并保持 `unknown`，或有部分正证时保持 `partial`；
- 当 repair issues 含 `M-CANDIDATE-LINEAGE` 时追加专项 instruction 与 BAD/GOOD 示例，禁止把 unsupported negative 换成另一种否定说法；
- modifier integrity 将 `未表明 / 未体现 / 不足以证明 / 尚无证据证明` 识别为 boundary context，避免合法边界中的目标词被误当成 asserted qualifier；
- 未增加 fallback，未删除 qualifier，未放宽 unsupported negative guard；repair 后仍非法时继续 502 fail-closed。

### G33-1～G33-10

| Gate | 覆盖 | 结果 |
| --- | --- | --- |
| G33-1 | unsupported `并非主导角色` 拒绝 | PASS |
| G33-2 | leadership uncertainty boundary 接受 | PASS |
| G33-3 | unsupported `无法满足独立负责` 拒绝 | PASS |
| G33-4 | independent ownership uncertainty boundary 接受 | PASS |
| G33-5 | 同维度明确 negative fact 的 unmet/mismatch 保留 | PASS |
| G33-6 | unknown 不得使用 `不具备/无法满足/不是/并非/没有` | PASS |
| G33-7 | partial positive evidence + insufficiency boundary 接受 | PASS |
| G33-8 | 本次 artifact 两条 exact unsupported claims 均拒绝 | PASS |
| G33-9 | mock initial 非法 negative 经一次 repair 改为合法 boundary 并接受 | PASS |
| G33-10 | repair 仍保留非法 negative 时 terminal fail-closed | PASS |

## 3. ISSUE-034 Lineage Adjudication

裁决在修改 validator 前完成。Exact rejected repair observation：

| Field | Evidence |
| --- | --- |
| Match requirement | `具有独立负责数据产品的正式工作经验` |
| Raw Match item / dimension | `requirementId=REQ-002` / `itemIndex=1` / `dimensionIndex=0` / `employment_type` |
| Final MI | 未生成：raw Match 在 semantic validation 后 502 fail-closed，因此不得伪造 `MI-*`；本次可审计 identity 是上述 `REQ-002` raw item/dimension |
| Dimension | `employment_type` |
| Status | `unmet` |
| Rejected reason | `候选人明确表示没有正式数据产品工作经历，与正式工作经验要求不符。` |
| candidateFactRefs | raw field=`candidateEvidence`；`CF-004` / role=`counter`（若进入 Final Match 才映射为对应 refs） |
| CF-004 | `没有正式数据产品工作经历` |
| PF-004 | `没有正式数据产品工作经历` |
| Raw Profile evidence | `没有正式数据产品工作经历` |
| JD evidence | `具有独立负责数据产品的正式工作经验` |

语义审查：CF/PF/Raw Profile 明确给出 formal data-product employment 的 negative fact；JD 明确要求 formal data-product work experience。`与正式工作经验要求不符` 是同一 `employment_type` 维度的 Candidate counter-evidence 与 JD threshold 的 relational conclusion，不是把“非正式”投射到 CF-003 项目，也不是从 absence of evidence 推导 negative fact。

**Adjudication：FALSE POSITIVE CONFIRMED。** 原 `M-CANDIDATE-LINEAGE` 只检查 Candidate clause 是否能由单个 CF anchor 直接复述，没有为“CF explicit counter-evidence ↔ JD requirement”的受支持关系结论建模，因此错误拒绝。

## 4. ISSUE-034 Bounded Fix

新增窄范围 requirement-mismatch recognition，仅在以下条件全部满足时允许关系结论：

- dimension 必须为 `employment_type`，status 必须为 `unmet`；
- Candidate evidence 全部为 `counter` 且包含明确 negative fact，不能只是 evidence boundary；
- JD evidence 必须属于当前 requirement；
- reason 必须是 requirement-level mismatch wording；
- Candidate negative fact 与 dimension/JD/requirement 必须共享明确的 `正式工作/全职/实习` employment semantic；
- 不允许把 negative property 投射到某个项目、作业、经历、技能或其他 CF；
- 原 M-K qualifier ownership guard 仍先执行，原 ISSUE-029 course-scope contamination 继续拒绝。

### L34-1～L34-10

| Gate | 覆盖 | 结果 |
| --- | --- | --- |
| L34-1 | 同维度 explicit-negative formal employment mismatch 接受 | PASS |
| L34-2 | 无 explicit negative CF 的 mismatch 拒绝 | PASS |
| L34-3 | candidate-level absence 投射为另一项目属性时拒绝 | PASS |
| L34-4 | 同一 compound requirement 的 responsibility sibling 不得借用 employment negative | PASS |
| L34-5 | status=`unknown` 的完整 mismatch 拒绝 | PASS |
| L34-6 | status=`partial` 的完整 mismatch 拒绝 | PASS |
| L34-7 | 等价 bounded requirement-level mismatch 接受 | PASS |
| L34-8 | 多 CF 引用时不得用一个 negative fact 限定另一个 CF | PASS |
| L34-9 | artifact exact phrase + 完整 lineage 接受 | PASS |
| L34-10 | 原 ISSUE-029 `CF-002 -> CF-003 course` contamination 继续拒绝 | PASS |

## 5. Preservation and Regression Evidence

- ISSUE-029：M-K 与 M-CANDIDATE-LINEAGE 均保留；course scope contamination、equivalent property projection、cross-CF qualifier inheritance 测试继续 fail-closed；本轮无 runtime 模型证据，因此不关闭 Issue；
- ISSUE-028/030/031/032：未修改其 validator、evidence adapter、runner、fixture、prompt 或 Contract；跨模块 targeted 与 full regression 全绿；
- focused：3 files / 78 tests PASS；
- authorized targeted：16 files / 281 tests PASS；
- full：23 files / 471 tests PASS；
- lint：PASS；production build：PASS；`git diff --check`：PASS；
- model calls=0；RB-05 executions=0；new stochastic sampling=0。

## 6. Scope and Gate Recommendation

- no fixture / Contract / runner / fallback / model-provider / temperature / retry / timeout changes；
- no RB-05；no Phase 2.5；no Issue closure；no Gate weakening；
- 工程建议 ISSUE-033：`LOCAL FIX VERIFIED`；
- 工程建议 ISSUE-034：`LOCAL FIX VERIFIED`；
- Phase 2.4 正式状态仍为 `BLOCKED`。在 Product Owner / QA 接受 deterministic stabilization 后，可申请**一次新的完整链 E2E authorization**；本轮不自行授权或执行。

## 7. Authorized Runtime Follow-up（2026-08-12）

Product Owner / QA 接受上述 local evidence 后，授权在 `cc9fa37608b532a9fe48927bf4480ff1da3b6a75` 上执行唯一一次 post-033/034 RB-05。运行 0/1，在 Match repair 502 停止：initial course→CF-004 contamination 被正确拒绝；repair 清除 course contamination，但将 CF-004 formal-work negative 传播成 responsibility `与独立负责要求直接冲突`，由 M-CANDIDATE-LINEAGE/M-K 正确拒绝。employment_type narrow relation 未被拒绝，但 domain sibling relation 也未产生 validation issue；Final Match 不存在。

工程建议更新为 ISSUE-033=`FIX NOT VERIFIED`、ISSUE-034=`FIX NOT VERIFIED`；Phase 2.4 仍 BLOCKED。artifact、逐阶段证据与 scope audit 见 `PHASE-2-4-POST-033-034-RB-05.md`。本次 model-backed executions=1、additional reruns=0。

## 8. Product Owner / QA Restabilization Disposition（2026-08-12）

Product Owner / QA 接受 post-033/034 RB-05 归因，将 ISSUE-033/034 更新为 `LOCAL FIX NOT VERIFIED / BOUNDED RESTABILIZATION REQUIRED`，不新建 ISSUE-035。后续 v1.3 dimension-local repair/validator fix、G33-1～20、L34-1～20 与 exact artifact replay 见 `PHASE-2-4-ISSUE-033-034-RESTABILIZATION.md`；原 local evidence 与 runtime failure 历史继续保留。
