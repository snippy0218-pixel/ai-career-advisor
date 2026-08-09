# PF-TC-04 Taxonomy Audit

> 日期：2026-08-09
> 状态：Diagnostic only；Phase 2.1 仍为 **STOP & ESCALATE / FINAL GATE NOT PASSED**。
> 代码基线：`653383e75dafd22e1807799273fc469e9e476769`（failed-gate diagnostic baseline，不代表 PASS）。
> 本审计新增真实模型请求：**0**。

## 1. 口径

- `semanticContentRecall`：用户明确表达的 must-preserve 语义是否完整存在于 Validated Candidate Profile 的任一事实表示中；不要求同一语义复制到多个 category。
- `categoryProjectionRecall`：完整语义是否同时进入冻结 manifest 期待的 UI / Schema category。
- 本文不修改 PF-H、冻结输入或 expected manifest，只把两类失败分开记录。

## 2. 证据限制

v4 持久化诊断保留了 request、最终错误和计数，但没有保存模型的首轮 coverage JSON 与局部 repair JSON。因此不能复原或猜测两次输出的精确 claim 文本和 disposition。可确认的事实是：PF 总数 4、问题 PF 1、局部 repair 1 次、累计丢弃 claims 2、course-scope layering violation 1、untraceable fact 1，最终 fail-closed 502。

历史预检可辅助区分 taxonomy，但不替代 v4 验收证据：

- preflight v1：PF-003 被拆成 project=`完成数据分析课程作业` 与 skill=`使用 Python 处理 CSV 数据`；skill 表示丢失课程作用域，属于 Case C。
- preflight v2：PF-003 完整保存为 project=`完成数据分析课程作业，使用 Python 处理 CSV 数据`，content 5/5、category 4/5；属于 Case B。该轮后来确认命中了 stale pre-guard server，只作为 taxonomy 证据。
- preflight v3/v4：均对 TC04 返回 502；v4 详情见 `stop-escalate-preflight-v4.json`。

## 3. TC04 逐事实映射

| Raw semantic fact | PF | 期望 atomic representation | 历史可观察表示 | v4 Final representation | 判定 |
|---|---|---|---|---|---|
| 某大学信息管理本科（2020–2024） | PF-001 | `education`，保留学校/专业/学历/时间 | v1/v2 均为 education 原文 | 无（整请求 fail-closed） | v4 API 边界 omitted；无证据表明它是触发项 |
| 完成推荐系统课程项目（团队合作） | PF-002 | `projects`，保留课程与团队限定 | v1/v2 均为 projects 原文 | 无（整请求 fail-closed） | v4 API 边界 omitted；无证据表明它是触发项 |
| 完成数据分析课程作业 | PF-003 | canonical semantic fact 至少保留课程作业事实 | v2 的完整 project fact 已包含 | 无（整请求 fail-closed） | 历史 content preserved；v4 因同 PF 校验失败被连带丢弃 |
| 在课程作业中使用 Python 处理 CSV 数据 | PF-003 | 完整语义必须保留课程作用域；manifest 另期待 skills 投影 | v1 skill 丢课程限定（Case C）；v2 完整存在于 project 但无 skills 投影（Case B） | 无（整请求 fail-closed） | 根因不是已证明的纯 Case A；存在 B/C 证据 |
| 没有正式工作经历 | PF-004 | `experiences`，保留明确否定 | v1/v2 均为 experiences 原文 | 无（整请求 fail-closed） | v4 API 边界 omitted；无证据表明它是触发项 |

## 4. Case A / B / C 判定

- **表层最终结果：Case A。** v4 返回 502，Validated Candidate Profile 不存在，所以五条事实在 API 边界均不可见。
- **直接校验证据：Case C。** `layeringViolationCount=1` 证明至少一条 skills 表示丢失“课程项目/课程作业”作用域；这是 Semantic Preservation Hard Gate 拒绝，不应放宽。
- **taxonomy 证据：Case B。** 相同输入曾完整保留 PF-003 整句语义于 projects，但没有额外 skills 投影。把该结果统计成 content omission 会混淆内容保存与 category projection。
- **最终审计结论：不是已证实的纯 Case A。** v4 的 Case A 是 fail-closed 后果；可观察根因包含 Case C，并且历史证据证明 Case B 路径真实存在。由于 v4 原始 repair JSON 未保存，不能进一步断言修复输出属于 A、B 或 C。

## 5. Candidate Fact taxonomy assessment

当前 Contract 与实现把 category 数组同时用于三种职责：

1. Candidate Fact 的 canonical storage：事实只有落入 `education[]` / `projects[]` / `skills[]` 等数组才存在于 Final Schema；
2. UI projection：数组名称直接决定展示分区；
3. 后续 Match Engine evidence index：Phase 2.2 将从这些 typed facts 与 PF evidence 建立匹配依据。

内部 `atomicClaim` 也只有一个 `category`，`buildCandidateProfile` 随后丢弃 coverage/claim 身份并按 category 复制到数组。因此“课程作业中使用 Python”这一个复合语义若既是 `project_experience` 又是 `tool_usage`，当前只能复制为两个 Candidate Facts；任何一个投影失败都会被现有 manifest 同时计为 completeness failure。

这是 architecture concern。更清晰的候选方向是让 validated atomic fact 成为唯一 canonical semantic fact，并允许 `semanticTags[]` / typed projections 多标签；`projects`、`skills` 等成为引用 canonical fact 的 UI/索引投影。该方向涉及 Final Schema 与 Match Engine Contract，本轮不实施。

## 6. Gate recommendation

- PF-H 继续保持 100%，本轮不修改。
- 建议 Product Owner / QA 先做 Contract amendment：明确 PF-H 约束 canonical `semanticContentRecall`，并为 `categoryProjectionRecall` 建立独立且同样严格的 projection gate/expectation；具体 Gate 是否合并仍由人工决定。
- 暂不建议 runtime model benchmark。当前证据不足以证明模型稳定遗漏 canonical semantic content，taxonomy/projection 耦合应先裁定；若 Contract 澄清后仍出现真正 Case A，再申请 benchmark。
