# Phase 2.4 ISSUE-029 Bounded Stabilization Evidence

> 日期：2026-08-11  
> 授权范围：仅 ISSUE-029 cross-CF Candidate qualifier isolation  
> Gate 状态：**OPEN / FIX INSUFFICIENT / BOUNDED RESTABILIZATION IMPLEMENTED / DETERMINISTIC GATE PASS / E2E PENDING**
> Phase 2.5：NOT AUTHORIZED

## A. Root Cause

`canonicalCandidateFacts` 与 PF ledger 的序列化保留了独立 CF 边界；污染不是 Profile schema 或 serialization 丢失。原始 E2E-RB-05 中，模型在 Match `reason` 生成阶段把 CF-002 的“课程”scope 写入仅引用 CF-003 的 observation。原 Match finalizer 只用共享 modifier 词表检查输出；词表不含课程/工作/实习等 experience type，也没有逐 CF qualifier ownership，因此未拦截。

首轮 bounded rerun 进一步发现：初版 guard 的跨分句否定窗口过宽，前一分句“未体现主导”错误抑制了后一分句“项目为课程作业”的检查。第二轮发现合法的 JD 比较短语“正式工作经验要求”需要与 Candidate claim 区分。两处 validator tuning 均有独立失败 artifact 和静态回归。

## B. Fix

- `src/lib/modifier-integrity.ts`：新增 Candidate qualifier occurrence 与逐 CF ownership 校验，覆盖 scope、experience type、duration、frequency、intensity、quantity、certainty、ownership、proficiency、responsibility；否定只在当前分句生效，并区分 JD requirement context。
- `src/lib/match-schema.ts`：在 Final Match 形成前，对 `reason` 全量执行 CF ownership；对 `missingInformation` / `verificationQuestion` 中的显式断言执行同一检查；失败进入既有一次 bounded Match repair，repair 后仍失败则 502。
- `src/lib/match-prompt.ts`：Prompt/Repair 升级为 v1.1，明确禁止 CF 间继承限定词；Prompt 不是安全边界。
- `src/lib/match-deepseek.ts` 与 Match API：acceptance-only 保存 initial rejected raw、validation issues、repair raw 与 repair acceptance/rejection；完整 raw 只在 acceptance response body/artifact，header 与普通产品响应不包含。
- 测试只增补 ISSUE-029 与 evidence-capture regression；未修改 Candidate Fact/PF/Match status/Recommendation/Strength-Gap/Greeting Contract。

## C. Deterministic Enforcement

每个 Match dimension 的 Candidate observation 只能使用其 `candidateEvidence` 引用 CF 独立支持的 qualifier。一个 dimension 引用多个 CF 时，每个敏感 qualifier 必须由每个被引用 CF 独立支持；限定不同的事实需拆分 dimension 或仅引用实际支持该 observation 的 CF。校验发生在 Final Match 输出前，不依赖模型采样；positive control 保留同一 CF 原有 qualifier，不做全局删除或 silent drop。

## D. ISSUE-029 Regression Matrix

| Case | Boundary | Result |
| --- | --- | --- |
| A | 课程 X 不传播到独立 Y 项目 | PASS（deterministic reject） |
| B | 工作 X 不传播到个人 Y 项目 | PASS（deterministic reject） |
| C | 实习 X 不传播到课程 Y | PASS（deterministic reject） |
| D | 2 年 X 不传播到 Y | PASS（deterministic reject） |
| E | 频繁 X 不传播到一般 Y 沟通 | PASS（deterministic reject） |
| F | 5 个 X 项目不传播到项目 B | PASS（deterministic reject） |
| Positive | 同一 CF 的“课程项目中使用 Python 完成数据分析” | PASS（qualifier preserved） |

附加 regression：跨分句 negation 不得抑制后续 qualifier claim；JD requirement 比较短语不得被误判为 Candidate claim；acceptance-only Match initial/repair evidence 完整保留。

## E. RB-05 Rerun

所有尝试均使用 raw JD + raw Profile 和完整 JD → Profile → Match → Recommendation → Strength/Gap → Greeting runner；每次写入独立 artifact，未覆盖历史失败。

| Artifact | Result | Stop | Evidence |
| --- | --- | --- | --- |
| `phase-2-4-issue-029-rb-05-rerun.json` | 0/1 | Strength/Gap 502 | 初版 guard 因跨分句 negation 漏拦原 course contamination；SG initial/repair 均由 SG-B/SG-M 拒绝 |
| `phase-2-4-issue-029-rb-05-rerun-2.json` | 0/1 | Match 502 | guard 已触发 repair；initial/repair 均因合法“正式工作经验要求”比较短语误报而 fail-closed，raw 完整保存 |
| `phase-2-4-issue-029-rb-05-rerun-3.json` | 0/1 | Strength/Gap 502 | Match 200 且无 CF-002→CF-003 course scope；Recommendation 200；SG initial/repair 均因 SG-E gap-type boundary 拒绝；Greeting 未调用 |

Product Owner / QA forensic adjudication 已确认 rerun-3 的 SG initial/repair 均为 Classification B — SG-E False Positive，并建立独立 `ISSUE-030`。原 ISSUE-029 cross-CF contamination 在 rerun-3 为 **NOT OBSERVED**。ISSUE-029 实现不再修改；仅在 post-ISSUE-030 RB-05 完整链成功且 contamination 继续为 0 后，才由 Product Owner / QA 决定是否关闭。

最终 rerun-3 的 Match：MI-001 partial（CF-002/PF-002 课程 Python 基础）、MI-002 unmet（CF-004/PF-004 明确无正式工作经历）、MI-003 unknown（无 course scope claim）、MI-004 met（CF-001/PF-001 本科）；JD evidence 全部保留。全链未完成，因此不得把 Match targeted success 视为 RB-05 PASS。

## F. Downstream Regression

- Match：rerun-3 HTTP 200，validator/evidence/status/aggregate 全通过，cross-CF course claim 0。
- Recommendation：HTTP 200；unknown 保持 unknown、waiver/fabrication/status drift 0。
- Strength/Gap：HTTP 502；initial 与 repair 均由现有 SG-E fail-closed，未释放无效输出。
- Greeting：未调用，符合 upstream failure stop semantics。

## G. Evidence Audit

- CF-001 → PF-001 → `教育背景：信息管理本科`。
- CF-002 → PF-002 → `课程项目：在课程中了解 Python 基础语法`。
- CF-003 → PF-003 → `团队经历：与四人团队共同完成数据展示作业，我协助整理需求和测试`。
- CF-004 → PF-004 → `没有正式数据产品工作经历`。
- Match 每个 dimension 的 JD evidence 均来自对应 validated requirement；rerun-3 diagnostics 的 JD/Candidate evidence validation 均 PASS。
- unknown 未转 unmet；MI-002 unmet 有明确 CF-004 counter-evidence；无 waiver、JD→Candidate contamination 或 modifier semantic upgrade。

## H. Repair / Fallback

rerun-3：JD 1 attempt、无 targeted/HR repair、无 HR fallback；Profile 1 attempt、无 model repair；Match 1 attempt、无 repair；Recommendation 1 attempt、无 repair；Strength/Gap 2 attempts，repair attempted=true/succeeded=false；Greeting 未调用。SG initial/repair raw、validation reason、rejected item 与 truncation=false 均保存在 artifact。

## I. Tests

- ISSUE-029/Match focused：47/47 PASS。
- authorized targeted regression：259/259 PASS。
- full regression：363/363 PASS。
- `npm run lint`：PASS。
- `npm run build`：PASS。
- `git diff --check`：PASS（提交前复核）。

## J. Scope Audit

未修改 CLOSED Contract、Candidate Fact Schema、PF Evidence Contract、Match status 语义、Recommendation/Strength-Gap/Greeting Contract；未新增用户功能、未处理 OBS-006、未执行 Phase 2.5 frozen 14 TC × 3。失败 artifacts 全部保留。

## K. Git

工作分支为 `main`；starting HEAD 为 `671434f174d6ab28e009843e17846bafa833450e`。最终 commit 与 clean-status 以本次交付 Git 记录为准。

## L. Gate Recommendation

- **ISSUE-029 OPEN / FIX IMPLEMENTED / LOCAL VERIFICATION PASS / FINAL E2E VERIFICATION PENDING**：确定性 cross-CF guard 与 clean Match evidence 已完成，rerun-3 未观察到 contamination；等待 post-ISSUE-030 RB-05 full-chain verification。
- **Phase 2.4 仍 BLOCKED**：不得宣布 Ready for Release，不得授权或进入 Phase 2.5。等待 ISSUE-030 deterministic fix 与单次 post-fix RB-05 evidence 完成后由 Product Owner / QA 复核。

## M. Bounded Restabilization — Candidate Claim Lineage

Replacement RB-05 后，Product Owner / QA 推翻“原 qualifier guard 已充分覆盖”的结论。保存的 Final Match 中，MI-003 unknown reason 写入“候选人参与团队项目并协助整理需求和测试……项目为课程作业，非正式工作”，但 `candidateFactRefs=[]`、`pfEvidence=[]`。代码链路确认 raw `candidateEvidence` 由 Zod 校验后被 finalizer 一对一映射为 `candidateFactRefs`；finalizer 不删除引用，因此空 refs 已存在于 accepted raw。acceptance evidence 机制只保存 rejected raw，无法恢复 accepted raw JSON，但该确定性映射足以排除 finalizer 丢失 refs。

原 validator 强制 unknown 的 `candidateEvidence=[]`，却没有限制空 refs reason 只能表达 evidence absence；随后 qualifier guard 因 `referencedFacts=[]` 直接返回空数组。因此 Candidate positive assertion 与 cross-CF scope 同时绕过。`课程`只存在于 CF-002 Candidate context，可确认发生跨 CF context contamination；`非正式工作`可能由 CF-004、JD 或模型 synthesis 诱发，现有 artifact 无模型内部 lineage，来源保持 indeterminate。

本轮在 `match-schema.ts` 增加独立 `M-CANDIDATE-LINEAGE` 层：

- Candidate factual assertion 必须具有 Candidate Fact refs；空 refs 只允许“未提供、未表明、无法确认、不能证明”等 evidence boundary 或明确 JD-only statement；
- 有 refs 时，assertion 必须与引用 CF 的实质语义锚点一致，wrong-CF ref deterministic reject；
- 原逐 CF qualifier ownership 继续作为第二层，多个 refs 不允许用任意一个 CF 为其他 CF 的 scope / experience type / duration / frequency / intensity / quantity / certainty / ownership / proficiency / responsibility 背书；
- negative Candidate fact 仍必须通过显式 counter ref；不与无 refs 的 absence-of-evidence 混淆。

M1～M10 全部 PASS：无 refs positive claim、wrong CF、foreign/multi-CF qualifier 与 replacement exact reason 均 reject；unknown boundary、correct CF、negative counter、JD-only 与 same-CF scope 均 pass。原 Case A～F 与 positive control 保持 PASS。deterministic gate：Match/Recommendation focused 93/93；跨 Profile/Match/Recommendation/Strength-Gap/Greeting targeted 184/184；full 394/394；lint、production build、`git diff --check` PASS。未调用模型；E2E 尚未执行。
