# Phase 2 Contract — Schema / Evidence / Decision（草案，待 Phase 2.0 Contract Gate Review）

> 状态：**DRAFT for Phase 2.0 Contract Gate Review**（Phase 2 coding 未授权）
> 生成日期：2026-08-08
> 基线：Phase 1 已关闭（PASS / Ready for Release，release baseline commit `2faca406…`）；`docs/analysis-schema.md` 为 Phase 1 唯一业务输出协议，本文件为 **Phase 2 实现、测试、QA 和后续 Codex 执行的唯一主要产品协议基线**（Phase 2 扩展最终将回写 `analysis-schema.md`，但实现前以本文件为冻结依据）。
> 继承原则：不重新发明 Phase 1 已验证 Contract；优先继承、按需扩展、明确新增（见 §0）。

## 0. 基线：继承 / 扩展 / 新增

| 类别 | 内容 | 说明 |
|---|---|---|
| **继承（不变）** | evidence 逐字原则（JD 侧）；Raw/Final Schema 分离；fail-closed（不返回未验证内容）；`sourceType` 三值语义（JD 侧）；`verificationQuestion` 与 `questionsToConfirm` 联动；candidate hallucination 0 tolerance；`analysis-v1` 结构与 TC-01～TC-10 Contract | Phase 2 不得破坏（Gate G） |
| **扩展** | JD 侧 `sourceType` 保持；Profile 侧新增来源域（`profile_stated` / `profile_inferred` / `to_verify`）；`requirementType` 复用；`sourcedProfileItem` 模式复用于 profile facts；`questionsToConfirm` 复用并沿用 max 8 | 在 Phase 1 模式上加 Profile 分支 |
| **新增** | Candidate Profile 三层结构（Raw / Normalized / Derived）；Profile Evidence（`PF-xxx`）；Dual-Evidence Match Items；`met/partial/unmet/unknown`；四级 Recommendation；Strength / Gap；Personalized Greeting；Cross-source Contamination 校验 | Phase 2 核心新增 |

## 1. Candidate Profile 输入 Contract

### 1.1 三层分离（不得混层）

1. **Raw Profile Input**：用户原始输入（字段原文或粘贴文本），原样保留，是 PF evidence 的唯一来源；
2. **Normalized Profile Facts**：标准化事实——仅允许对 Raw 做**最小整理**（去空白、枚举拆分、统一格式）后直接成立的事实；**用户没有写出的确定性事实不得进入本层**；
3. **Derived / Inferred Information**：模型推断——必须显式标注 `profile_inferred` 或 `to_verify`，必须锚定至少一个 PF，且必须使用审慎措辞。

### 1.2 输入字段（第一版）

- 求职方向（`careerTarget`）；
- 期望城市（`preferredCity`，可选）；
- 教育背景（`education[]`）；
- 实习/工作经历（`experiences[]`）；
- 项目经历（`projects[]`）；
- 技能（`skills[]`）；
- 证书（`certificates[]`，可选）；
- 作品/成果（`portfolio[]`，可选）；
- 补充信息（`supplement`）。

允许信息不完整；**禁止因缺失信息猜测**。

### 1.3 "了解 Python，做过课程项目" 判定边界（明示）

- **禁止**：标准化为"具备 Python 开发能力"；"熟练 Python"；"Python 开发经验"；
- **允许**：Normalized Fact：`skill: Python（了解/课程项目使用）`；Derived（带审慎措辞）："从项目经历看，可能具备 Python 基础使用能力（待确认深度）"；
- **边界原则**：程度词与语境限定（"了解/接触过/课程项目"）必须保留，不得升级为能力断言；升级只允许在存在更强 PF 证据（如"负责 Python 数据处理模块，2 年"）时发生。

正反例：

| # | Raw Profile | 允许的 Normalized | 禁止的 Normalized/Derived |
|---|---|---|---|
| 1 | "了解 Python，做过课程项目" | `skill: Python（了解）` | "具备 Python 开发能力" |
| 2 | "熟悉 Excel 数据透视表" | `skill: Excel（熟悉）` | "精通 Excel 数据分析" |
| 3 | "负责过 Python 数据处理模块（实习 6 个月）" | `skill: Python（负责过数据处理模块）` | 无（已有证据可支撑"具备 Python 开发经验"级别） |
| 4 | "接触过 Figma" | `skill: Figma（接触过）` | "熟练使用 Figma" |

## 2. Profile Evidence Protocol

### 2.1 定义

- **PF Evidence**：指向 Raw Profile 原文的最小连续片段，是 Profile 侧唯一可信事实源；
- PF ID 生成规则：按输入顺序（或解析后的 section 顺序）生成 `PF-001`、`PF-002`…；同一原文片段只分配一个 PF（去重）；追加/修正输入不改变已分配 ID（增量分配）；
- 原文保存规则：PF evidence 保存 Raw 片段（verbatim；允许 Phase 1 同款 whitespace-normalized 回落，但回落后必须逐字存在于 Raw Profile）；
- 多字段引用同一 PF：**允许**（如一个项目 PF 同时支撑 skill 与 experience）；
- 一个结论引用多个 PF：**允许**，每个结论最多 3 个 PF（与 Phase 1 evidence max 3 对齐）；
- exact evidence / normalized fact 关系：Normalized Fact 是对 PF 的最小整理（trim/拆分/枚举化），不得改变语义或程度；
- 去重：相同原文只保留一个 PF；Normalized Fact 按 value 去重；
- 长 Profile 策略：每个事实类最多保留 3 条 PF；先验证有效性再截取（与 Phase 1 一致）；超长输入（>12000 字符，与 JD 上限对齐）拒绝或要求分段；
- evidence 不足 fail-closed：无 PF 锚点的 Normalized Fact 不得输出；Derived 无锚点 → 删除，或降级为 `to_verify` 并进入 `questionsToConfirm`；
- Final 输出校验：所有 PF 引用必须逐字（或 whitespace-normalized）存在于 Raw Profile；校验失败 → `AI_OUTPUT_INVALID`（fail-closed）。

核心原则：**Candidate claim 必须可追溯到用户真实输入。**

## 3. Candidate Profile Schema 草案（pseudo-Zod，仅文档）

### 3.1 Raw / Final 分离：**必须分离**（理由与 Phase 1 相同——模型输出不可信，需先宽松进入、再严格校验）

```ts
// ---- Raw Profile Schema（宽松：允许缺字段、evidence 可为空/超限）----
const rawProfileSchema = z.object({
  careerTarget: z.string().max(200).optional(),
  preferredCity: z.string().max(100).optional(),
  education: z.array(z.string()).optional(),
  experiences: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  certificates: z.array(z.string()).optional(),
  portfolio: z.array(z.string()).optional(),
  supplement: z.string().max(2000).optional(),
}).strict();

// ---- Final Profile Schema（严格：每个 fact 必须带 PF evidence 与来源域）----
const profileSourceTypeSchema = z.enum(["profile_stated", "profile_inferred", "to_verify"]);

const profileFactSchema = z.object({
  value: z.string().trim().min(1).max(200),          // 标准化事实/推断陈述
  sourceType: profileSourceTypeSchema,
  pfEvidence: z.array(z.string().trim().min(1)).min(1).max(3), // PF-xxx 引用
  verificationQuestion: z.string().max(200).nullable(),
}).strict();

const finalCandidateProfileSchema = z.object({
  profileProvided: z.literal(true),
  careerTarget: profileFactSchema.nullable(),
  education: z.array(profileFactSchema).max(6),
  experiences: z.array(profileFactSchema).max(8),
  projects: z.array(profileFactSchema).max(8),
  skills: z.array(profileFactSchema).max(12),
  certificates: z.array(profileFactSchema).max(6),
  portfolio: z.array(profileFactSchema).max(6),
  preferences: z.array(profileFactSchema).max(4),
  unknowns: z.array(z.string().trim().min(1).max(200)).max(8),
  evidence: z.array(z.object({ id: z.string(), text: z.string() })).max(30), // PF ledger
}).strict();
```

### 3.2 关键设计决定

- `value` 使用**中性陈述**（如 `skill: Python（了解）`），禁止模型写成 "不具备 X" 或 "候选人缺 X"（缺证据 ≠ 缺能力，见 §13）；
- `pfEvidence` 为 PF ID 引用数组（Final 输出可隐藏原文，但服务端校验必须完整）；
- `sourceType`：`profile_stated`（用户原文直接事实）/ `profile_inferred`（模型推断，必须审慎措辞）/ `to_verify`（需要 HR/用户确认，必须生成 verificationQuestion）；
- `confidence`：见 §14（建议 MVP 不输出）；
- 与 Phase 1 关系：`candidateProfileProvided=false` 时输出 `candidateProfile=null`，Phase 1 分支完全不变（F2-08 / Gate G）。

## 4. Match Status Contract（met / partial / unmet / unknown）

### 4.1 严格定义

| 状态 | 定义 | 必要条件 |
|---|---|---|
| `met` | JD 要求被 Profile 事实**直接满足**，方向与程度一致 | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1`（PF 支撑） |
| `partial` | 有部分满足证据，但存在程度/年限/方向/职责范围缺口 | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1` |
| `unmet` | Profile 存在**明确反证**（如"大专"对"本科及以上"、"无驾照"对"持有驾驶证"） | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1`（反证 PF）；**无反证 → 不得 unmet** |
| `unknown` | JD 要求明确，但 Profile 无正证也无反证（信息不足） | `jdEvidence ≥ 1`；`profileEvidence` **允许为空**；必须给出 reason 说明缺什么证据，且生成 `questionsToConfirm` 或写入 `unknowns` |

### 4.2 关键边界案例（12 个）

| # | 场景 | 判定 | 依据 |
|---|---|---|---|
| A | JD"熟练使用 SQL"；Profile 完全没提 SQL | `unknown` | 无正证无反证，不得 `unmet` |
| B | JD"本科及以上"；Profile"大专" | `unmet` | PF 明确反证学历 |
| C | JD"2 年产品经验"；Profile"完成 2 个产品项目，无正式工作经历" | `partial` | 项目能力维度有证据（met），正式年限维度缺证据（unknown）；若 Profile 明确"无任何工作经验"则年限 `unmet` |
| D | JD"有 AI Agent 产品经验优先"；Profile"做过 AI Career Advisor 项目（负责产品设计）" | `met`（preferred 类） | 方向＋职责证据一致；仅技术参与 → `partial`；仅"听说过" → `unknown` |
| E | JD"40 岁以下"；Profile"38 岁" | `met` | PF 年龄证据 |
| F | JD"40 岁以下"；Profile"45 岁" | `unmet` | PF 明确反证 |
| G | JD"具有驾驶证"；Profile 未提 | `unknown` | 不得 `unmet` |
| H | JD"具有驾驶证"；Profile"无驾照" | `unmet` | PF 明确反证 |
| I | JD"熟练使用 Figma"；Profile"会用 Figma 画原型" | `partial` | 有基础证据，程度不足 |
| J | JD"熟练使用 Figma"；Profile"日常用 Figma 完成设计稿" | `met` | 程度与方向一致 |
| K | JD"抗压能力强"；Profile 仅自述"能适应高强度" | `partial` | 自我评价为 `profile_stated`，但强度证据弱（无经历锚点） |
| L | JD"愿意出差"；Profile 未提 | `unknown` | 生成 questionsToConfirm |

## 5. Match Item Contract

```ts
const matchItemSchema = z.object({
  requirement: z.string().trim().min(1).max(200),     // JD 要求（提炼，须可回溯 jdEvidence）
  requirementType: requirementTypeSchema,              // 复用 Phase 1：hard/core/preferred
  status: z.enum(["met", "partial", "unmet", "unknown"]),
  reason: z.string().trim().min(1).max(320),
  jdEvidence: z.array(z.string()).min(1).max(3),       // JD 原文逐字
  profileEvidence: z.array(z.string()).max(3),         // PF 引用；unknown 允许为空
  confidence: confidenceSchema.optional(),             // 见 §14（建议省略）
}).strict();
```

强制规则：

- `met` / `partial` / `unmet`：`profileEvidence` 必须 ≥ 1；
- `unknown`：`profileEvidence` 允许为 `[]`，但 `reason` 必须说明缺失的证据维度，并联动 `questionsToConfirm`/`unknowns`；
- `unmet`：必须存在明确反证 PF；"没有找到相关信息" → `unknown`；
- 维度至少覆盖：hard requirement、core capability、experience evidence、career direction、preferred/bonus（F2-03）。

## 6. ISSUE-014 解决：Recommendation Decision Contract

### 6.1 四级定义

- `priority`：硬门槛满足、核心匹配强、无反方证据、无重大 unknown；
- `try`：整体匹配良好，存在少量 unknown/partial，可通过确认解决；
- `cautious`：存在需谨慎确认的条件（hard unknown、多项 partial、方向冲突、Profile 不足）；
- `not_recommended`：存在明确 hard unmet（不可豁免）或核心大面积 unmet / 方向显著冲突。

### 6.2 Recommendation Decision Matrix（确定性 guardrails ＋ 有限 LLM judgment）

| # | 场景 | Deterministic 规则（服务端校验） | 允许 LLM judgment |
|---|---|---|---|
| 1 | hard requirement 存在明确 unmet | **禁止 `priority`**；默认至少 `cautious`；若 ≥2 个 hard unmet 或 core 大面积 unmet → `not_recommended` | 判断 unmet 是否可被 HR 豁免/确认（输出 confirmWithHR 理由） |
| 2 | hard requirement 存在 unknown | **禁止 `priority`**；允许 `try`；≥2 个 hard unknown → 至少 `cautious`；必须 `questionsToConfirm` | 判断 unknown 对整体影响权重 |
| 3 | 多项 core capability partial（≥3） | 至少 `cautious`；存在 ≥1 个 met 且方向一致时可 `try` | 判断 partial 的接近程度与可迁移性 |
| 4 | bonus requirement 不满足 | **不降级**（preferred 不满足不阻塞）；仅记录进 counterEvidence（低权重） | — |
| 5 | Profile 信息严重不足（有效事实 <5 或 unknowns ≥8） | **禁止 `priority`**；至少 `cautious`；无 negative evidence 且 JD 明确 → `try`；必须输出 unknowns/questions | — |
| 6 | career direction 冲突（PF 明确方向与岗位显著不符） | 至少 `cautious`；若核心匹配同时弱 → `not_recommended`；必须 counterEvidence | 判断"方向差异"是否可迁移 |
| 7 | core 高度匹配但学历 hard unmet | **禁止 `priority`**；默认 `cautious`；必须 confirmWithHR（豁免确认） | 判断豁免可能性表述 |
| 8 | 大量 unknown 但无明确 negative evidence | 允许 `try`；**禁止 `priority`**；必须输出 unknowns/questions；不因 unknown 单独降 `not_recommended` | — |

**确定性 guardrails**（服务端可执行，不依赖模型）：上述"禁止/至少/必须"条款；
**LLM judgment 范围**：summary 措辞、支持/反方证据排序、partial 权重、可迁移强度、豁免理由表述。

## 7. Recommendation 证据 Contract

```ts
const recommendationSchema = z.object({
  level: z.enum(["priority", "try", "cautious", "not_recommended"]),
  summary: z.string().trim().min(1).max(300),
  supportingEvidence: z.array(z.object({ content: z.string(), jdEvidence: z.array(z.string()).min(1).max(3), profileEvidence: z.array(z.string()).max(3) })).max(3),
  counterEvidence: z.array(z.object({ content: z.string(), jdEvidence: z.array(z.string()).min(1).max(3), profileEvidence: z.array(z.string()).max(3) })).max(3),
  unknowns: z.array(z.string()).max(8),
  limitations: z.string().trim().min(1).max(300),
  questionsToConfirm: z.array(questionToConfirmSchema).max(8),
}).strict();
```

一致性校验（Gate E 依据）：

- `level=priority` 时：不得存在 hard unmet；hard unknown 数量必须为 0；
- `level=not_recommended` 时：必须存在 ≥1 条 counterEvidence（hard unmet 或方向冲突），否则校验失败；
- 若 `level ≥ try` 且存在 hard unmet（如学历），`counterEvidence`/`summary` 必须显式说明并给出 confirmWithHR 表述；禁止"推荐投递"与"学历明确不满足核心硬门槛"并存且无解释；
- `unknowns` 与 `questionsToConfirm` 联动：每个 hard unknown 必须能在 questions 或 unknowns 中定位。

## 8. Strength Contract

**定义**：Strength = Profile 中真实存在的候选人能力/经历 ∩ JD 中真实存在的职责/要求。

分类（独立判断后保留三类）：

| 分类 | 定义 | 门槛 |
|---|---|---|
| `strong_match` | Profile 证据直接匹配 JD 要求（方向＋程度一致） | 双向 verbatim evidence（JD＋PF） |
| `transferable_strength` | 跨领域可迁移能力（JD 未直接要求但职责隐含需要） | PF 证据存在；必须 `profile_inferred`＋审慎措辞＋迁移逻辑说明 |
| `supporting_strength` | 支持性素质（协作/沟通等） | 有 PF 锚点；不得仅来自常识 |

**禁止**作为 Strength：只存在于 JD；只来自常识；模型认为候选人"应该会"；用户兴趣；未验证的自我评价；缺乏 PF 的成果数字。

正反例：

| # | 类型 | 示例 | 判定 |
|---|---|---|---|
| 1 | 正 | JD"熟练数据分析"；PF"3 年运营中负责周报与指标分析" | strong_match |
| 2 | 正 | JD"跨部门沟通"；PF"学生会外联部负责对接赞助商" | transferable_strength（需解释迁移逻辑） |
| 3 | 正 | JD"结果导向"；PF"连续 3 季度达成销售目标" | strong_match（数字有 PF） |
| 4 | 反 | JD 要求 Figma；Profile 无 | 禁止（JD 反哺） |
| 5 | 反 | 常识"善于沟通"；无 PF | 禁止 |
| 6 | 反 | Profile 自述"我学习能力强"；无经历锚点 | 禁止（未验证自我评价） |
| 7 | 反 | 成果"提升 30%"未出现在 Profile | 禁止（无 PF 数字） |
| 8 | 反 | Profile"喜欢数据" | 禁止（兴趣 ≠ 能力） |

## 9. Gap Contract

分类（重新评审后冻结）：

| 分类 | 名称 | 定义 | Severity | Actionability |
|---|---|---|---|---|
| A | `hard_constraint_gap` | 明确 unmet 的硬门槛（学历/年龄/证书等） | high（不可短期改变） | not-actionable（仅确认/豁免路径） |
| B | `evidence_expression_gap` | 能力可能存在但证据/表达不足（unknown 或 partial 的证据维度） | medium | immediate（补充证据/改写表达） |
| C | `learnable_skill_gap` | 短期可能补足的能力（仅当 JD 明确要求且 Profile unknown，且需谨慎表述） | medium | short-term（学习/练习路径） |
| D | `information_gap` | 信息不足（unknown） | low–medium | immediate（补充信息/确认） |

字段：`category`、`severity`、`actionability`、`evidence`（jdEvidence/profileEvidence）、`suggestedAction`（可选；仅 B/C/D 可给建议，A 只给确认/豁免路径）。

**核心区分（必须执行）**：

- `没有能力`（unmet，且 PF 明确反证）→ A；
- `当前没有证据证明有该能力`（unknown）→ B/D；
- **禁止**把"Profile 无 SQL 证据"写成"用户不会 SQL"（D/B，不得写成 A）。

## 10. ISSUE-021 解决：Inference Modifier Contract

### 10.1 规则

- **Allowed inference**：JD 存在活动/职责依据，且**不添加** JD 未给出的程度/频率/时长/范围/数量修饰，使用"从职责看/可能"措辞；
- **Forbidden inference**：JD 无对应证据时添加 `频繁/经常/大量/重度/长期/高频/强度高` 等修饰，或对活动本身做确定性断言；
- modifier 六维约束（无 JD 对应 evidence 时禁止升级该维）：`frequency`、`intensity`、`duration`、`scope`、`quantity`、`certainty`；
- 示例基准：JD"拜访客户" → 允许"岗位可能包含客户拜访"；禁止"需要频繁拜访客户"。

### 10.2 正反例（12 个）

| # | JD 原文 | 允许 | 禁止 |
|---|---|---|---|
| 1 | "拜访客户" | "岗位可能包含客户拜访" | "需要频繁拜访客户" |
| 2 | "适应出差" | "岗位可能涉及出差" | "可能需要频繁出差" |
| 3 | "具有驾驶证" | "岗位要求持有驾驶证" | "需要频繁使用驾驶证" |
| 4 | "抗压能力强" | "岗位对抗压能力有要求" | "工作强度高、压力大" |
| 5 | "参与项目" | "岗位可能涉及项目推进" | "长期参与大型项目" |
| 6 | "掌握 Python" | "岗位要求使用 Python" | "大量使用 Python" |
| 7 | （无出差/外出依据） | — | "需要频繁出差或外出"（活动＋频率双编造） |
| 8 | "负责市场数据分析" | "从职责看，可能需要处理市场数据" | "需要高频、持续地进行数据分析" |
| 9 | "推动项目落地" | "从职责看，可能涉及项目推进与协调" | "需要长期高强度地推动多个大型项目" |
| 10 | "定期出差"（已有频率词） | "岗位需要定期出差"（保留原文频率） | "需要频繁出差"（升级原文频率） |
| 11 | "优秀的学习能力" | "岗位看重学习能力" | "岗位学习压力极大" |
| 12 | "有销售经验优先" | "岗位偏好有销售经验者" | "需要大量销售拜访、业绩压力极大" |

### 10.3 ISSUE-021 升 P1 条件（QA 自动/人工）

任一触发即升级 P1 并 Stop & Escalate：

1. 去掉审慎措辞（"可能/从职责看"）变成确定性断言；
2. 进入 `riskSignals`；
3. 影响 `recommendation`（改变 level 判定）；
4. 编造 JD 完全不存在的活动（如无任何依据输出"出差/外出"并作为事实）；
5. 污染 `requirements` / `basicInfo`；
6. 新增：同请求多实例或跨模块扩散（workCharacteristics → 其他模块）；
7. 新增：同 JD 3/3 稳定复现且产生用户可见误导。

Phase 2 落地：Profile 侧推断同样适用本约束（Profile 无依据不得升级程度）；校验思路（实现期，本轮不写代码）：修饰语黑名单＋JD/Profile evidence 覆盖检查＋`sourceType`/措辞校验。

## 11. Personalized Greeting Contract

- 只有 **Profile Evidence 支持**的候选人事实可进入 HR 话术；内部必须可校验（PF ID），用户界面可不显示；
- 允许的语言处理：同义压缩、语气调整、删除冗余、保持事实不变；
- 禁止：为匹配 JD 自动补技能；夸大项目职责；自动增加工作年限；自动增加量化成果；把课程作业改写为正式工作经历；把团队成果归到个人；把"接触过"升级为"熟练"；
- `personalizationStatus = personalized`（Contract 设计；Phase 1 分支保持 `not_personalized`）。

合法改写（5）：

| # | Profile 原文 | 话术 |
|---|---|---|
| 1 | "2023 年至今在某电商公司做用户运营，负责活动策划" | "我有电商用户运营经验，负责过活动策划" |
| 2 | "熟悉 Excel 数据透视表" | "会使用 Excel 处理数据"（程度不变） |
| 3 | "做过 Python 课程项目" | "有 Python 课程项目经验"（保留"课程"限定） |
| 4 | "主导过校园创业项目" | "有创业项目经历"（保留经历性质） |
| 5 | "期望在杭州工作" | "我目前希望在杭州工作" |

禁止改写（5）：

| # | Profile 原文 | 禁止话术 | 原因 |
|---|---|---|---|
| 1 | "接触过 Figma" | "我熟练使用 Figma" | 程度升级 |
| 2 | "完成 Python 课程作业" | "我有 Python 开发经验" | 课程作业→正式经验 |
| 3 | "团队项目获得三等奖" | "我主导的项目获得三等奖" | 团队成果归个人 |
| 4 | "了解数据分析" | "我负责过数据分析工作" | 了解→负责 |
| 5 | （JD 要求 SQL；Profile 未提） | "我熟悉 SQL" | JD 反哺 Profile |

## 12. Cross-Source Contamination Rules

- `JD Fact 不能进入 Profile Fact`：Profile Structure 中每个 fact 必须可回溯到 Raw Profile；JD 中出现的技能/要求不得反向写入 Profile skills/experiences；
- `Profile Fact 不能进入 JD Fact`：JD Structure 保持 Phase 1 语义（jd_explicit 只能来自 JD）；
- 校验目标：`JD → PF contamination = 0`、`PF → JD contamination = 0`（Gate D）；
- 实现期校验思路（本轮不写代码）：① PF evidence 逐字校验仅对 Raw Profile；② 交叉文本检查——若某 skill/要求同时出现在 JD 与 Profile，来源标记必须正确（JD 侧标 `jd_explicit`、Profile 侧必须另有 PF）；③ 唯一来源断言：Profile 无 PF 的 fact 不得输出；JD 无 evidence 的 claim 不得输出；
- 例：JD"熟悉 Figma"、Profile 无 Figma → Profile Structure 中**绝不允许**出现 `skill: Figma`。

## 13. Unknown Contract

- **何时产生 unknown**：① JD 要求明确但 Profile 无正证无反证；② JD 自身表述模糊（无法确定判定维度）；③ Profile 信息不足（年限/学历/工具掌握程度等维度缺失）；
- **unknown 与 unmet 关系**：`unmet` 必须存在明确反证 PF；其余一律 `unknown`；unknown 不是 unmet 的降级，而是独立一等状态；
- **unknown 对 recommendation 的影响**：hard unknown → 禁止 `priority`（§6.2）；多个 unknown 累积触发"至少 cautious"或"必须 questionsToConfirm"；unknown 不单独导致 `not_recommended`；
- **questionsToConfirm 生成**：年限不明、学历不明、工具掌握程度不明、JD 表述模糊、Profile 信息不足 → 必须生成确认问题（可合并去重，上限 8）；
- **confidence 影响**：若启用三档 confidence，unknown 相关的 match item 不得为 high（见 §14）。

## 14. Confidence 评审结论

**正式建议：Phase 2 MVP 不输出 confidence（Match Item 中可保留内部可选字段，Final 输出不展示）。**

理由：

1. 无可靠校准依据——数值（如 0.87）无真实概率支撑，会诱导虚假精确；
2. 证据链（status + reason + jdEvidence + profileEvidence）已提供可解释性，confidence 增量有限；
3. Phase 1 体系无 confidence 且 QA 有效，延续该风格可降低 QA 口径分裂；
4. 若后续 PO 要求三档：定义 `high`（met 且双向 verbatim evidence）/ `medium`（partial 或单一证据）/ `low`（unknown 或依赖推断），且仅内部使用；
5. 升级阈值：若 QA 发现 match 结论可解释性不足或需要跨项比较，再评估引入。

## 15. Phase 2 TC 冻结设计（草案）

统一约定：每个 TC 最终进行 **3 次真实模型请求**；命中 Contract 章节见括号；禁止错误为 Gate A/B/D/E 级红线。

| TC | 测试目的 | Profile 冻结特征 | JD 冻结特征 | 命中 Contract | 预期 recommendation 区间 | 预期 status 分布 | 禁止错误 | 专项评分维度 |
|---|---|---|---|---|---|---|---|---|
| TC-P2-01 高匹配 | 正向全链路 | 完整（方向/教育/经历/技能/证书齐全） | 要求与 Profile 高度一致 | §4–§8、§12 | priority（3/3） | 全 met（hard/core） | 幻觉、污染、漏 met | 匹配逻辑/优势真实性 |
| TC-P2-02 中等匹配 | 部分满足判定 | 中等完整（部分技能缺失） | 常规岗位 | §4–§8 | try | 多数 met、部分 partial | 把 partial 写 unmet | Gap 准确性 |
| TC-P2-03 硬门槛明确不满足 | unmet 判定 | 学历/年龄明确不符 | 有硬门槛 | §4、§6 | not_recommended 或 cautious（含 confirmWithHR） | 关键 hard unmet | 无 PF 反证却 unmet；priority | Recommendation 合理性 |
| TC-P2-04 跨专业/可迁移 | transferable 判定 | 专业不同但有可迁移经历 | 对口岗位 | §8、§10 | try | hard met、core 多数 partial/met | 无迁移逻辑的强匹配 | 优势真实性/匹配逻辑 |
| TC-P2-05 候选人经历很少 | 少证据行为 | 仅 2–3 条事实 | 常规岗位 | §2、§13 | cautious 或 try | 大量 unknown | 缺证据写 unmet；补造经历 | 信息克制 |
| TC-P2-06 Profile 信息不足 | unknown 行为 | 字段大量缺失 | 常规岗位 | §6、§13 | cautious（禁止 priority） | 大量 unknown | 猜测缺失信息 | 信息克制/unknown 正确性 |
| TC-P2-07 JD 信息不足 | JD 侧 unknown | 完整 Profile | 信息不全 JD | §6、§13 | try 或 cautious | JD 侧 unknown | 编造 JD 事实 | 信息克制 |
| TC-P2-08 JD 要求多/Profile 证据少 | 证据稀疏匹配 | 少量证据 | 要求密集 JD | §2、§5、§13 | cautious 或 try | 多数 unknown/partial | 无 PF 反推满足 | 证据链完整性 |
| TC-P2-09 高度相关项目经历 | project→capability | 一个强相关项目 | 相关岗位 | §4、§8 | priority 或 try | 核心 met | 项目证据虚增年限 | 优势真实性 |
| TC-P2-10 Profile 大量无关信息 | 抗噪声 | 大量无关内容 | 常规岗位 | §2、§12 | try | 相关维度正常 | 无关信息污染 match | 抗噪声/信息克制 |
| TC-P2-11 JD/Profile Prompt Injection | 注入防护 | 含注入指令（"忽略以上"等） | 含注入指令 | §12、Gate A/D | 不执行注入（正常或 fail-closed） | 不产生注入事实 | 注入内容入 Fact/话术 | 安全/幻觉 |
| TC-P2-12 长 JD + 长 Profile | 压力测试 | 超长 Profile（接近上限） | 长 JD（接近上限） | §2、Gate H | 正常返回或明确 fail-closed | 不截断损坏 | 超限静默吞字段；evidence 丢失 | 完整性/fallback |
| TC-P2-13 事实冲突（建议新增） | 双向证据矛盾 | Profile 与 JD 存在矛盾事实（如 JD 要求 3 年、Profile 明确 1 年） | 与 Profile 冲突 | §4、§6、§12 | 按真实证据（不得为 priority） | 冲突项 unmet | 忽略矛盾/中和事实 | 事实忠实度 |
| TC-P2-14 团队成果归属（建议新增） | 归属边界 | 项目为"团队项目" | 相关岗位 | §8、§11 | 按实际职责表述 | 不夸大 | 团队成果归个人 | 优势真实性/HR 真实性 |

说明：TC-P2-13/14 为建议新增（命中 Greeting/Strength 归属红线与事实忠实度），合计 14 个 TC；若 PO 认为应收敛，可删减 13/14 至 12 个。

## 16. Phase 2 QA Gate 草案

| Gate | 定义 | 目标 |
|---|---|---|
| A — Candidate Fact Integrity | 未经用户提供的候选人确定性事实 | `0`；候选人事实幻觉 `0 tolerance` |
| B — Profile Evidence Integrity | Final Candidate Fact 的 PF evidence 逐字回落到 Raw Profile | `100% valid` |
| C — Dual Evidence Integrity | 关键 Match Claim = JD Evidence ＋ PF Evidence；禁止 JD 反推候选人拥有 | 3/3 关键 claim 双证据 |
| D — Cross-source Contamination | JD→PF / PF→JD 污染 | `0` |
| E — Recommendation Consistency | level 与 hard unmet/unknown/方向冲突无确定性矛盾（§6.2/§7 校验规则） | 0 确定性矛盾 |
| F — Content Quality | 人工评分（Profile 事实准确性/匹配逻辑/优势真实性/Gap 准确性/Recommendation 合理性/HR 话术真实性/信息克制/表达质量） | 综合 ≥4.0；最低 ≥3.0；P0=0；系统性 P1=0 |
| G — Phase 1 Regression | TC-01～TC-10 完整重跑 | `10/10 PASS` |
| H — Robustness / Fallback | 见 §17 指标定义 | 见 §17 |

## 17. Fallback Metric 正式定义（ISSUE-019）

### 17.1 统计定义

- **numerator（fallback 请求数）**：单次请求中，HR 初稿发生边界违规 → 定向修复 → 最终使用固定安全兜底的请求数；**同请求内多次 repair 只计 1 次**（按请求计 0/1）；
- **denominator（有效请求数）**：产生最终分析结果（HTTP 200 且 Final Schema/evidence 通过）的请求数；与 Phase 1 口径一致（TC-01～TC-10 有效请求 33）；
- **不计 fallback**：upstream retry（`upstreamAttempts > 1` 后成功）不算；非 HR 模块 repair（requirements/core/advice）不算；
- **防口径漂移**：fallback 判定以服务端 `hrRepairUsedSafeFallback` 诊断字段为准；固定回归集（Phase 1 TC ＋ Phase 2 TC 的冻结输入）在 Contract 冻结时登记；每次回归记录 numerator/denominator/rate 于验收报告；
- **当前基线**：15 / 33 ≈ 45.5%（Phase 1 真实记录）。

### 17.2 ≤20% 是否作为 Final Gate

**建议：保留为 provisional target（Phase 2.4 评审后再冻结为 Final Gate）。**

理由：基线 45.5% 偏高，≤20% 在固定回归集约 66 次请求下对应 ≤13 次，可达性取决于 Phase 2.3 个性化话术生成质量；在 Phase 2.3 真实数据出现前不宜冻结为不可修改的 Release Gate；届时若 >20%，应先回归 Phase 1 HR 行为并评审目标，禁止通过放宽 Schema/删除 evidence/降低事实约束/静默吞字段/返回未验证内容达成。

## 18. ISSUE-017 / ISSUE-023 处置（本轮不修复）

- **ISSUE-017（extraction completeness）**：新 Contract 部分覆盖——Match 依赖 requirement 完整性，Gate C/E 隐含要求（遗漏 hard/preferred 会改变 match 结论）；**仍需要 Phase 2.4 单独治理**（完整性监控指标：遗漏率、片段化率），不视为自动 obsolete；
- **ISSUE-023（duplicate requirements）**：新 Contract 覆盖——Match Item 唯一性约束 ＋ 服务端去重校验思路；若 Phase 2 实现服务端 requirement 去重，**可能转为 obsolete**；保留 Phase 2.4 复核；
- 结论记录：017 = 需要 Phase 2.4 单独治理；023 = 可能被新 Contract 覆盖（待实现期验证）。

## 19. ISSUE-007

- 保持 **Deferred / separate verification candidate**（Phase 1 已关闭，不重新开启）；
- 不阻塞 Phase 2 Contract 设计；后续是否关闭由 QA 单独决定（建议：TC-01 同 JD 复核 experienceRequirement 字段后判定）。

## 20. 变更与版本控制

- 本文件为 Phase 2 唯一主要产品协议基线；`PHASE-2-PLAN.md` 为规划/流程文档（指向本文件），避免多 Contract 文档重叠；
- 任何 Contract 变更需人工 Gate 批准；实现期协议变更须同步回写 `analysis-schema.md`、Prompt 设计与测试；
- Phase 2.0 Contract Gate 通过后，才允许进入 Phase 2.1 实现。

## 21. 待 PO / QA 确认事项（Open Questions）

1. Match Item 是否输出 `confidence`（默认建议：MVP 不输出）；
2. TC-P2-13/14 是否加入冻结集（默认建议：加入，共 14 个）；
3. Gate F 综合 ≥4.0 是否冻结（Phase 1 为 3.8；建议 4.0）；
4. Fallback ≤20% 作为 provisional target 是否接受；
5. Profile 输入上限（与 JD 对齐 12000 字符）与分段策略是否接受；
6. `profile_inferred` 事实是否允许进入 Personalized Greeting（建议：允许但必须审慎措辞＋PF 锚点）。
