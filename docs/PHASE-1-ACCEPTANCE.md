# Phase 1 总验收快照（PHASE-1-ACCEPTANCE）

> 生成日期：2026-08-08
> 性质：Phase 1 总验收审计**草案与建议**；最终以人工 Final Release Gate 确认为准。
> 冻结依据：`docs/产品验收记录.md` §7.1（单案例/Phase 级标准）与 `docs/CODEX-OPERATING-PROTOCOL.md`。
> 本轮未修改业务代码、未修复 P2、未进入 Phase 2。

## 1. 结论摘要

**建议输出：Phase 1 Conditional PASS**（非自动 PASS）。

- TC-01～TC-10 全部最终 PASS（10/10）；
- 所有 P0 已关闭；P1 除 ISSUE-012B 外全部关闭或已修复（ISSUE-012B 给出明确范围决策建议，不属于 Phase 1 Release blocker）；
- candidate hallucination 安全约束、Final Schema/evidence 协议无未解决确定性问题；
- 剩余 P2 均有风险说明、升级阈值与归属（见 §6）；
- 待人工 Final Release Gate 确认三项条件后转为 Phase 1 PASS / Ready for Release（见 §7）。

## 2. Phase 1 最终 TC 矩阵

| TC | 名称/类型 | 冻结输入 | 最终状态 | 最终三次 HTTP | 八维平均 | 最低单项 | 专项评分 | 该案例暴露的 Issue | 冻结 Pass Gate |
|---|---|---|---|---|---:|---:|---:|---|---|---|
| TC-01 | 高匹配 | 414 字符（SHA-256 `2689b587…`，见 §4.2） | PASS | 3/3（修复后回归） | 4.13 | 3.0 | — | ISSUE-001/002/003/004/005/006/007/008/009 | 满足 |
| TC-02 | 非AI技术岗 | 329 字符 | PASS | 3/3（ISSUE-010/011 修复后；累计 6/6） | 4.27 | 3.0 | — | ISSUE-010/011 | 满足 |
| TC-03 | 低匹配/高门槛 | 771 字符（`4d5316b5…`） | PASS | 3/3 | 4.35 | 3.5 | — | ISSUE-012B 样本1、ISSUE-013、ISSUE-021（2 次） | 满足 |
| TC-04 | 信息不足 | 170 字符（`a0052996…`） | PASS | 3/3 | 4.35 | 3.5 | 信息克制 4.75 | ISSUE-014 | 满足 |
| TC-05 | AI/Agent 产品经理 | 427 字符（`a86f58df…`） | PASS | 3/3（ISSUE-015 修复后重评） | 4.48 | 3.5 | AI 岗位理解 4.93 | ISSUE-012B 样本2、ISSUE-015 | 满足 |
| TC-06 | 前端技术岗 | 426 字符（`8f48db28…`） | PASS | 3/3 | 4.42 | 3.5 | 技术忠实度 4.80 | ISSUE-016、ISSUE-017（3 次） | 满足 |
| TC-07 | 食品/餐饮产品岗 | 520 字符（`dd49ed52…`） | PASS | 3/3 | 4.48 | 3.5 | 职责拆分 5.0 | ISSUE-018 | 满足 |
| TC-08 | 工业自动化 B2B 销售 | 416 字符（`06567ac6…`） | PASS | 3/3（ISSUE-020 修复后回归） | 4.38 | 4.0 | 薪酬与风险审慎 4.5 | ISSUE-020、ISSUE-021（6 次） | 满足 |
| TC-09 | TikTok 生活服务活动/综合运营 | 836 字符（`99083d98…`） | PASS | 3/3 | 4.50 | 3.5 | 运营岗位 4.73 | ISSUE-022、ISSUE-023（1 次） | 满足 |
| TC-10 | 隐含风险（产业园区招商运营） | 402 字符（`cd45efd7…`） | PASS | 3/3（ISSUE-024/012A 修复后回归） | 4.50 | 3.5 | 隐含风险岗位 4.77 | ISSUE-012A、ISSUE-021（5 次）、ISSUE-024 | 满足 |

**原始失败 vs 修复后回归 vs 最终 PASS 区分（历史失败证据不删除、不覆盖、不弱化）：**

| TC | 原始失败记录 | 修复后 regression validation | 最终 PASS 依据 |
|---|---|---|---|
| TC-01 | 首轮 P0（ISSUE-001/002/003 等）失败样本保留于 §4 | 5 次连续回归 | 4.16/4.23 修复后 3/3 |
| TC-02 | 首轮 3/3 502（ISSUE-010）保留于 §5 | ISSUE-010/011 修复后 3/3 | 累计 6/6，最终 3/3 |
| TC-03 | 1149 字符损坏输入转 ISSUE-012B 样本1（不混测） | 771 字符第二轮 3/3 | 第二轮 3/3 |
| TC-05 | 1284 字符截断输入转 ISSUE-012B 样本2 | 427 字符第二轮 3/3 | 第二轮 3/3 |
| TC-08 | 修复前 3/3 命中 ISSUE-020（永久保留） | ISSUE-020 修复后 3/3 | 修复后 3/3 |
| TC-10 | 首轮 2/3（run2 502，ISSUE-012A 第三样本，永久保留） | ISSUE-024/012A 修复后 3/3 | 修复后 3/3 |

## 3. 完整 Issue Ledger（ISSUE-001～ISSUE-024）

| ISSUE | severity | 首次发现 | 累计真实样本 | 根因 | 自动化覆盖 | 当前状态 | Phase 1 Release 影响 | 最终建议 |
|---|---|---|---|---|---|---|---|---|
| 001 | P0 | TC-01 | 1 案例 | 无证据非核心条目致整份 502 | 回归 4/4 | 已关闭 | 无 | Closed |
| 002 | P0 | TC-01 | 1 案例 | evidence 超限早于标准化执行 | 回归 5/5 | 已关闭 | 无 | Closed |
| 003 | P0 | TC-01 | 1 案例 | HR 编造用户能力 | 专项回归 5/5 | 已关闭 | 无 | Closed |
| 004 | P1 | TC-01 | 1 案例 | 未明确岗位名/用工性质却确定化 | —（自然消失） | 已关闭 | 无 | Closed |
| 005 | P1 | TC-01 | 1 案例 | 无加分措辞却归为加分项 | 回归 3/3 | 已关闭 | 无 | Closed |
| 006 | P2 | TC-01 | 1 案例 | 推断标 jd_explicit | 回归 3/3 | 已关闭 | 无 | Closed |
| 007 | P2 | TC-01 | 1 案例（TC-01 两轮） | 学历/求职身份写入 experienceRequirement | 无专项测试 | 待处理（后续案例未复现） | 低 | Deferred（建议人工复核 TC-01 同 JD 后关闭） |
| 008 | P2 | TC-01 | 1 案例 | 成长收益表述偏确定 | 回归 3/3 | 已关闭 | 无 | Closed |
| 009 | P1 | TC-01 | 1 案例 | coreResponsibilities evidence 空致 502 | 回归 3/3 | 已关闭 | 无 | Closed |
| 010 | P0 | TC-02 | 1 案例 | 列表编号"."被当粘连字符 | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 011 | P2 | TC-02 | 1 案例 | "X年及以上"未识别 hard | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 012A | P1 | TC-10 | 1 真实样本 | 标准 JD 局部 typo 被模型 evidence 纠错→exact-match 失败→502 | 单测＋管线测试＋回归 | 已修复（建议关闭） | 无（已修复） | **Closed（建议）** |
| 012B | P1 | TC-03/TC-05 | 2 真实样本 | 语义截断/字符缺失/片段乱序致 evidence 无法逐字回落 | span recovery 单测 | 打开（隔离 robustness） | 有范围决策即不阻塞（见 §4） | **Deferred（Phase 2/robustness backlog）** |
| 013 | P2 | TC-03 | 1 案例 | max_tokens 截断 | 无专项测试 | 已关闭 | 无 | Closed |
| 014 | P2 | TC-04 | TC-04 3/3 等 | recommendation level 无确定性判定边界 | 无（观察） | 打开 | 低（无逻辑矛盾，见 §6） | Open Observe（Phase 2 协议设计） |
| 015 | P1 | TC-05 | 1 案例 | "至少X年"未识别 | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 016 | P1 | TC-06 | 1 案例 | 章节级加分项作用域缺失 | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 017 | P2 | TC-06 | 3 次（TC-06 3/3） | requirement 片段化/整条遗漏（stochastic） | 无（观察） | 打开 | 低（未影响 hard，见 §6） | Open Observe |
| 018 | P1 | TC-07 | 1 案例 | "尤佳"未识别 preferred | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 019 | P2 | TC-02～TC-10 | 15 次 / 33 有效请求（≈45%） | HR 初稿越界→固定安全兜底 | 无（观察） | 打开 | 低（仅自然度，见 §6） | Open Observe |
| 020 | P1 | TC-08 | 1 案例（3/3 失败样本） | hard＋preferred 复合句整句 preferred 覆盖 hard | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 021 | P2 | TC-03 | 13 次（TC-03 2/3、TC-08 6/6、TC-10 5/5；TC-09/TC-04 0） | workCharacteristics 推断无依据添加"频繁"频率限定 | 无（观察） | 打开 | 低（仅画像/一致性扣分，见 §5） | Open Observe（维持 P2，理由见 §5） |
| 022 | P1 | TC-09 | 1 案例（2 触发句） | qualifier＋core 复合句整句分类污染 | 单测＋回归 3/3 | 已关闭 | 无 | Closed |
| 023 | P2 | TC-09 | 1 次（TC-09 第1次） | requirement 偶发重复输出（模型拆分项＋整句并存） | 无（观察） | 打开 | 低（未影响展示/建议，见 §6） | Open Observe |
| 024 | P1 | TC-10 | 1 案例（2/2 复现） | hasHardQualifier 缺证书/年龄边界分支 | 单测＋回归 3/3 | 已关闭 | 无 | Closed |

## 4. ISSUE-012A / ISSUE-012B 最终决策审计

### ISSUE-012A（建议 Closed）

| 核验项 | 结果 |
|---|---|
| 单字符 substitution remap 实现边界（同长度、恰好 1 个 Unicode 字符替换） | 通过（`findSingleSubstitutionEvidenceSpan`，按码点比较） |
| 多候选 fail-closed | 通过（单测"multiple candidates at distance one → null"） |
| 两字符差异不 remap | 通过（单测） |
| insertion/deletion 不 remap | 通过（单测） |
| 原本 exact-match 行为不变 | 通过（管线测试：不 remap、不修复、1 次 fetch） |
| Final evidence 严格逐字来自 JD | 通过（remap 返回 JD 原文且再次 exact-match；管线断言 evidence=JD 子串） |
| TC-10 真实触发 咨询服务→咨询服乐 后 200 | 通过（`a0a3d5b6…`，remappedEvidenceCount=1，HTTP 200） |
| 149/149 自动化覆盖 | 通过（全量 4 文件 149 项） |

→ **建议：ISSUE-012A → Closed**（待人工 Final Release Gate 确认）。

### ISSUE-012B（明确产品范围决策）

- **是否属于 Phase 1 支持范围**：**否**。Phase 1 标准单案例仅面向结构基本完整、可通过输入资格检查的真实 JD（`docs/测试案例.md` 执行规则第 8 条）；语义截断、关键字符缺失、片段乱序等无法可靠恢复的损坏输入不属于 Phase 1 标准验收范围。
- **产品应如何 fail-closed**：双保险——① 输入资格门禁：此类 JD 在资格检查阶段转入 robustness 样本，不与标准案例混测；② 若损坏文本进入管线且 evidence 无法逐字回落，服务端按既有机制 fail-closed（`AI_OUTPUT_INVALID` 502），绝不返回未经验证的模型原文或非原文 evidence。
- **归属**：转入 Phase 2 / robustness backlog（ISSUE-012B 保持 Open；现有 span recovery 与一次受限修复能力保留，不再扩展）。
- **当前行为是否允许 Phase 1 Release**：允许——前提是人工确认上述范围决策（本快照建议即为该决策的工程建议稿）。

## 5. ISSUE-021 专项升级审计（本轮重点）

### 5.1 逐条可追溯真实发生记录（13 条）

| # | TC | request_id | JD 原文 | 系统实际表述 | 变化类型 |
|---|---|---|---|---|---|
| 1 | TC-03 run2 | `d9a17c74…` | “能接受出差。” | “可能需要频繁出差” | frequency amplification |
| 2 | TC-03 run3 | `7bec5fd0…` | “能接受出差。” | “可能需要频繁出差” | frequency amplification |
| 3 | TC-08 修复前 run1 | `4cd144fa…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 4 | TC-08 修复前 run2 | `3847bc3a…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 5 | TC-08 修复前 run3 | `102875ec…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 6 | TC-08 修复后 run1 | `0d523254…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 7 | TC-08 修复后 run2 | `c0acb8ab…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 8 | TC-08 修复后 run3 | `bbc693a3…` | “适应出差” | “可能频繁出差” | frequency amplification |
| 9 | TC-10 r1 run1 | `7b0b7ce0…` | 无频率词（职责：招商/选址/客户维护） | “可能需要频繁外出拜访客户和项目考察，对驾驶有实际需求” | frequency amplification（＋活动推断） |
| 10 | TC-10 r1 run3 | `a50f8d08…` | 无频率词 | “需要频繁使用驾驶证” | frequency amplification |
| 11 | TC-10 r2 run1 | `acb2f18b…` | 无频率词 | “需要频繁使用驾驶证” | frequency amplification |
| 12 | TC-10 r2 run2 | `a0a3d5b6…` | 无频率词 | “需要频繁出差或外出” | frequency amplification（＋活动推断） |
| 13 | TC-10 r2 run3 | `8be8948e…` | 无频率词 | “需要频繁出差或外出” | frequency amplification（＋活动推断） |

TC-09（JD 明写“愿意**定期**进行国际出差”）0/3、TC-04 0/3：已有频率词或无关场景时未复现。

### 5.2 分类与根因判断

- 13/13 均为 **frequency amplification**（在 JD 无频率依据处添加“频繁”）；其中 TC-10 4 例同时把频率附加到 JD 未明示的活动（驾驶/出差/外出），属 frequency＋scope-extension；
- **无 modifier-scope transfer（跨从句修饰语转移）证据**：TC-10 冻结 JD 不含“高频/频繁/出差/拜访”等任何频率或活动修饰语（此前文档中“适应高频商务拜访”为记录错误，已在本快照纠正）；TC-08/TC-03 的 JD 修饰语作用于“出差”本身，模型仅做频率放大，未发生跨对象转移；
- **同一根因**：模型生成 workCharacteristics 推断时，无依据添加“频繁”频率限定；不属于 ISSUE-020/022 式复合句/qualifier 分类机制。

### 5.3 必须回答的问题

| 问题 | 结论 |
|---|---|
| 是否形成跨多个真实 JD 的稳定 failure pattern | 是（3 个 JD：TC-03/TC-08/TC-10，13 次） |
| 是否存在 3/3 或类似确定性复现 | 是（TC-08 6/6、TC-10 有效请求 5/5） |
| 是否只是 workCharacteristics 自然语言质量损失 | 基本是——全部为带“从职责看，可能”审慎 hedge 的 inference 措辞 |
| 是否进入 riskSignals | 否（0/13） |
| 是否影响 recommendation level | 否（0/13） |
| 是否改变岗位事实含义 | 轻微（频率/活动为推断性表述，未影响学历/薪资/地点等确定性事实；未标 jd_explicit） |
| “频繁使用驾驶证”是否应独立为 modifier-scope failure | 否——TC-10 JD 无频率修饰语可转移；“频繁使用驾驶证”是“无依据频率添加”（frequency amplification），与 TC-03/TC-08 同根因 |

### 5.4 结论：维持 P2（明确理由与升级阈值）

**维持 P2 的理由：**
1. 全部输出均带审慎推断措辞（“从职责看，可能…”），非确定性事实断言，未违反现行 inference 措辞协议；
2. 0/13 进入 riskSignals、0/13 影响 recommendation level、0/13 改变确定性岗位事实；
3. 影响限于“岗位真实画像价值”与“结论与原文证据一致性”两维扣 0.5～1.0，仍远高于 3.0 下限，不影响任何案例 PASS；
4. 未构成“qualifier/modifier 跨从句错误”（无修饰语转移证据），不满足创建 ISSUE-025（P1）的条件；
5. 修复方向为 inference 措辞约束/频率词白名单（Prompt 与服务端校验增强），属 Phase 2 改进，非 Phase 1 Release blocker。

**未来升级阈值（任一触发即升级 P1 并 Stop & Escalate）：**
- a) 出现确定性表述（去掉“可能/从职责看”或标 `jd_explicit`）；
- b) 进入 riskSignals；
- c) 影响 recommendation level；
- d) 编造 JD 完全未提及的活动/事实（如无任何依据输出“需要频繁出差”且无审慎措辞）；
- e) 频率表述扩散到 requirements/basicInfo 等模块。

## 6. 其余 P2 总验收

| ISSUE | 审计结论 | 判定 |
|---|---|---|
| ISSUE-014 | 未发现 level 与 unknowns/riskSignals/limitations 的明确逻辑矛盾（TC-04 信息严重不足仍 `worth_exploring` 是“判定边界缺失”，非自相矛盾）；建议 Phase 2 设计 level 判定协议，Phase 1 记录风险说明 | Accept for Phase 1 |
| ISSUE-017 | 3 次均发生于 TC-06 单案例（片段化 2＋整条遗漏 1），TC-07～TC-10 共 0 次；遗漏项为 preferred（“计算机相关专业优先”），未影响任何 hard 要求；升级阈值：hard 要求整条遗漏或跨案例出现率显著上升 | Accept for Phase 1 |
| ISSUE-019 | 累计 15 次；有效最终输出请求约 33 次，fallback rate ≈ 45%；均为固定安全兜底（无候选人事实、无信息丢失，仅自然度下降：HR 维度 3.5 vs 4.0+）；升级阈值：fallback 造成岗位信息丢失或 rate 持续 >50% | Accept for Phase 1 |
| ISSUE-023 | 仅 TC-09 第1次 1 次（B 句拆分项＋整句并存）；未影响 recommendation、requirement 数量语义或 hard 展示；TC-10 两轮 0/3；升级阈值：影响 hard 展示或跨案例重复率上升 | Accept for Phase 1 |
| ISSUE-007 | TC-01 后未复现；后续案例 expReq/eduReq 分离正常；建议人工复核 TC-01 同 JD 后确认关闭 | Deferred（不阻塞） |

## 7. Phase 1 Release Gate

| 冻结条件 | 状态 | 说明 |
|---|---|---|
| TC-01～TC-10 全部最终 PASS | 满足 | 10/10 |
| 所有 P0 已关闭 | 满足 | ISSUE-001/002/003/010 |
| 所有 P1 已关闭或存在明确范围决策 | 满足（待人工确认） | 9 个 P1 已关闭；ISSUE-012A 建议关闭；ISSUE-012B 有范围决策建议（不属于 Phase 1 范围、fail-closed、转 Phase 2/robustness backlog） |
| candidate hallucination 安全约束无未解决确定性问题 | 满足 | 全案例幻觉 0；无开放项 |
| Final Schema / evidence 协议无未解决确定性问题 | 满足 | ISSUE-012A 已修复；ISSUE-012B 由输入门禁＋fail-closed 隔离 |
| 无被高平均分掩盖的协议错误 | 满足 | 各案例专项与确定性检查均独立核对 |
| 剩余 P2 有风险说明、升级阈值与归属 | 满足 | 见 §5/§6 |

**建议：Phase 1 Conditional PASS**——待人工 Final Release Gate 确认：
1. ISSUE-012B 范围决策（不属于 Phase 1 范围＋fail-closed＋backlog）与 ISSUE-012A 关闭；
2. P2 ledger（含 ISSUE-021 维持 P2 的理由与升级阈值）被接受；
3. 正式放行后即转 Phase 1 PASS / Ready for Release。

## 8. 记录修正（本轮）

- ISSUE-021 涉及案例修正为 TC-03 / TC-08 / TC-10（此前误记为 TC-04 / TC-08）；
- ISSUE-021 累计次数修正为 **13**（此前记 12；补计 TC-10 r1 run1“频繁外出拜访客户和项目考察”1 次，并核对 TC-03 2 次）；
- 删除“适应高频商务拜访”错误引用：TC-10 冻结 JD **不含任何频率词**（高频/频繁/出差/拜访均无）；TC-10 的“频繁使用驾驶证/频繁出差或外出”为无依据频率添加，非修饰语转移。
