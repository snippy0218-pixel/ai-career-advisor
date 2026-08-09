# Phase 2 Contract — Schema / Evidence / Decision（Phase 2.0 冻结基线）

> 状态：**Phase 2.0 Contract = PASS / CLOSED；Phase 2.1 = PASS / CLOSED；ISSUE-025 = CLOSED；Phase 2.2A Match Core = PASS / CLOSED；Phase 2.2B-1 Recommendation Core = ISSUE-026 STABILIZATION EVIDENCE COMPLETE / WAITING PRODUCT OWNER + QA FINAL GATE；Phase 2.2B Strength/Gap 与 Phase 2.3 = NOT AUTHORIZED。**
> 生成日期：2026-08-08
> 当前版本：**2.0.1（2026-08-09 Candidate Fact Canonicalization Amendment）**；本 amendment 经 Product Owner / QA 批准，不重新打开 Phase 2.0。
> 基线：Phase 1 已关闭（PASS / Ready for Release，release baseline commit `2faca406…`）；`docs/analysis-schema.md` 为 Phase 1 唯一业务输出协议，本文件为 **Phase 2 实现、测试、QA 和后续 Codex 执行的唯一主要产品协议基线**（Phase 2 扩展最终将回写 `analysis-schema.md`，但实现前以本文件为冻结依据）。
> 继承原则：不重新发明 Phase 1 已验证 Contract；优先继承、按需扩展、明确新增（见 §0）。

## 0. 基线：继承 / 扩展 / 新增

| 类别 | 内容 | 说明 |
|---|---|---|
| **继承（不变）** | evidence 逐字原则（JD 侧）；Raw/Final Schema 分离；fail-closed（不返回未验证内容）；`sourceType` 三值语义（JD 侧）；`verificationQuestion` 与 `questionsToConfirm` 联动；candidate hallucination 0 tolerance；`analysis-v1` 结构与 TC-01～TC-10 Contract | Phase 2 不得破坏（Gate G） |
| **扩展** | JD 侧 `sourceType` 保持；Profile 侧新增来源域（`profile_stated` / `profile_inferred` / `to_verify`）；`requirementType` 复用；`sourcedProfileItem` 模式复用于 profile facts；`questionsToConfirm` 复用并沿用 max 8 | 在 Phase 1 模式上加 Profile 分支 |
| **新增** | Candidate Profile 三层结构（Raw / Normalized / Derived）；Profile Evidence（`PF-xxx`）；Dual-Evidence Match Items；`met/partial/unmet/unknown`；四级 Recommendation；Strength / Gap；Personalized Greeting；Cross-source Contamination 校验 | Phase 2 核心新增 |

## 1. Candidate Profile 输入 Contract

### 1.1 四层结构（Candidate Fact 与 Derived Observation 彻底分离）

```text
Raw Profile Input
→ Stated / Normalized Candidate Facts（含 PF Evidence）
→ Derived Match Observations
→ Unknowns / To Verify
```

1. **Raw Profile Input**：用户原始输入（字段原文或粘贴文本），原样保留，是 PF evidence 的唯一来源；
2. **Stated / Normalized Candidate Facts**：候选人事实——仅来源于用户真实 Profile 输入，且具有有效 PF Evidence；允许最小标准化（trim/枚举拆分/统一格式），**不得产生新的确定性语义**；等价于 `profile_stated` / `normalized_stated`；**不得包含 `profile_inferred` 或 `to_verify` 作为真实候选人事实**；
3. **Derived Match Observations**：基于 Candidate Fact ＋ JD 的有限推理（如"该项目经历与岗位的需求分析职责存在一定可迁移性"）——**不是 Candidate Fact**；不得反向写入 Profile Skill；不得制造新的学历/技能/经历/年限/成果；不得作为 explicit counter-evidence；不得单独支撑 `unmet`；不得被 Personalized Greeting 当作候选人确定性事实；
4. **Unknowns / To Verify**：信息不足与待确认项。

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
- **分层归属**："可能具备 Python 基础使用能力"属于 **Derived Match Observation**，不是 Candidate Fact，不得写入 `skills`，不得进入 Greeting 作为自我事实陈述。

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
- 长 Profile 策略：每个事实类最多保留 3 条 PF；先验证有效性再截取（与 Phase 1 一致）；
- **输入长度**：Profile 输入上限为 **configurable validated input limit**（不冻结为 12000 字符；具体数值由 Phase 2.1/2.4 依据模型 context、Prompt 固定 token、JD/Profile 最大输入、输出预算、latency、repair/retry、长输入 TC 实测后确定）。**冻结行为**：① 不允许 silent truncation；② 不允许截断后仍假装 Profile 完整；③ 超限必须明确返回输入限制信息，或采用未来经批准的分段协议；④ 分段协议未设计前，不允许自动摘要 Profile 并把摘要当作原始 Evidence；⑤ PF Evidence 必须始终能回到真实 Raw Profile；
- **Derived Observation**：必须锚定至少一个 PF，但**不是 Candidate Fact**；无锚点的 Derived → 删除或降级为 `to_verify` 并进入 `questionsToConfirm`；
- evidence 不足 fail-closed：无 PF 锚点的 Stated/Normalized Candidate Fact 不得输出；
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

// ---- Final Profile Schema（严格：Candidate Fact 只允许 stated/normalized）----
const candidateFactSourceTypeSchema = z.enum(["profile_stated", "normalized_stated"]);

const candidateFactSchema = z.object({
  value: z.string().trim().min(1).max(200),          // 标准化事实（中性陈述）
  sourceType: candidateFactSourceTypeSchema,          // 不得为 profile_inferred / to_verify
  pfEvidence: z.array(z.string().trim().min(1)).min(1).max(3), // PF-xxx 引用
  verificationQuestion: z.string().max(200).nullable(),
}).strict();

// Derived Match Observation：独立于 Candidate Fact，不进 Fact 层
const derivedObservationSchema = z.object({
  content: z.string().trim().min(1).max(320),        // 审慎推断（"可能/从职责看/存在一定可迁移性"）
  sourceType: z.literal("profile_inferred"),
  pfEvidence: z.array(z.string().trim().min(1)).min(1).max(3),
  verificationQuestion: z.string().max(200).nullable(),
}).strict();

const finalCandidateProfileSchema = z.object({
  profileProvided: z.literal(true),
  careerTarget: candidateFactSchema.nullable(),
  education: z.array(candidateFactSchema).max(6),
  experiences: z.array(candidateFactSchema).max(8),
  projects: z.array(candidateFactSchema).max(8),
  skills: z.array(candidateFactSchema).max(12),
  certificates: z.array(candidateFactSchema).max(6),
  portfolio: z.array(candidateFactSchema).max(6),
  preferences: z.array(candidateFactSchema).max(4),
  derivedObservations: z.array(derivedObservationSchema).max(6), // 独立于 Facts
  unknowns: z.array(z.string().trim().min(1).max(200)).max(8),
  evidence: z.array(z.object({ id: z.string(), text: z.string() })).max(30), // PF ledger
}).strict();
```

### 3.2 关键设计决定

- `value` 使用**中性陈述**（如 `skill: Python（了解）`），禁止模型写成 "不具备 X" 或 "候选人缺 X"（缺证据 ≠ 缺能力，见 §13）；
- `pfEvidence` 为 PF ID 引用数组（Final 输出可隐藏原文，但服务端校验必须完整）；
- `sourceType`（Candidate Fact）：仅 `profile_stated` / `normalized_stated`；`profile_inferred` 只允许出现在 `derivedObservations`（独立层，不是 Fact）；`to_verify` 只出现在 unknowns/questions（不是 Fact）；
- **`confidence`：Phase 2 MVP 不输出**（数值与 high/medium/low 均 deferred，见 §14）；
- **输入长度**：`configurable validated input limit`（不冻结具体数值；行为契约见 §2.1）；
- 与 Phase 1 关系：`candidateProfileProvided=false` 时输出 `candidateProfile=null`，Phase 1 分支完全不变（F2-08 / Gate G）。

### 3.3 Contract Amendment 2.0.1 — Candidate Fact Canonicalization / Semantic Tag / Projection

> 本节在 Candidate Profile 事实存储、分类和 category arrays 语义上取代 §3.1/§3.2 的旧 pseudo-Zod；历史正文保留用于审计。其余 Evidence、Derived、Unknown 与 Match Contract 不变。

**原因（ISSUE-025 TC04 Taxonomy Audit）：**旧结构让 `education[]` / `experiences[]` / `projects[]` / `skills[]` 同时承担 canonical fact storage、UI projection 与未来 Match evidence index，导致 category projection failure 被错误混入 semantic completeness，并诱发同一事实被模型改写成多个版本。

正式数据流：

```text
Raw Profile
→ PF Evidence Ledger
→ Validated Atomic Claim
→ Canonical Candidate Fact（唯一事实 truth layer）
→ Semantic Classification
→ Deterministic Typed Projection
```

Canonical Candidate Fact：

```ts
const semanticTagSchema = z.enum([
  "career_target",
  "education",
  "experience",
  "project_experience",
  "skill_usage",
  "certificate",
  "portfolio",
  "preference",
]);

const canonicalCandidateFactSchema = z.object({
  factId: z.string().regex(/^CF-\d{3,}$/),
  statement: z.string().trim().min(1).max(200),
  sourceType: z.enum(["profile_stated", "normalized_stated"]),
  pfEvidence: z.array(z.string().regex(/^PF-\d{3,}$/)).min(1).max(3),
  semanticTags: z.array(semanticTagSchema).min(1).max(4),
}).strict();
```

- `factId` 依 validated atomic claim 的稳定顺序确定性生成（`CF-001…`）；不由模型生成；
- `statement` 是该事实唯一 canonical semantic representation；不得因 category 或 UI 需要复制、缩写或改写；
- 一个事实可以有多个 `semanticTags`。例如“完成数据分析课程作业，使用 Python 处理 CSV 数据”是一条事实，同时具有 `project_experience` 与 `skill_usage`；
- 禁止 `confidence`；Derived Observation 继续独立，不能成为 Canonical Candidate Fact；
- 明确负向事实（例如“没有正式工作经历”）仍是 Canonical Candidate Fact；缺失信息不得转换为负向事实；
- validated atomic claim 直接、确定性转换为 Canonical Candidate Fact，不再经过自由生成 Final Fact。

Typed Projection 只保存 canonical references：

```ts
const candidateProfile = {
  canonicalFacts: canonicalCandidateFactSchema.array(),
  careerTarget: z.string().regex(/^CF-/).nullable(),
  education: z.array(z.string().regex(/^CF-/)),
  experiences: z.array(z.string().regex(/^CF-/)),
  projects: z.array(z.string().regex(/^CF-/)),
  skills: z.array(z.string().regex(/^CF-/)),
  certificates: z.array(z.string().regex(/^CF-/)),
  portfolio: z.array(z.string().regex(/^CF-/)),
  preferences: z.array(z.string().regex(/^CF-/)),
};
```

- projection 不保存或生成第二份 statement/evidence/qualifier；前端通过 `factId` resolve canonical fact；
- tag→projection 为确定性映射：`career_target→careerTarget`、`education→education`、`experience→experiences`、`project_experience→projects`、`skill_usage→skills`、`certificate→certificates`、`portfolio→portfolio`、`preference→preferences`；
- Canonical Candidate Fact 是唯一 truth layer；projection、UI display、Derived Observation、Match Engine、Personalized Greeting 均不得成为第二事实源；所有 Candidate Claim 最终必须回到 `CF → PF → Raw Profile`；
- Repair 分层：semantic content 缺失/损坏才允许对目标 PF 做一次有界 semantic repair；statement 完整但 tag 缺失/错误时只修 semantic classification，禁止改写 statement；projection 完全由 validated tags 确定性生成。

**Gate 澄清（不降低原门槛）：**

- `PF-H — Semantic Fact Completeness`：冻结 manifest 每个 must-preserve semantic fact 必须在 Canonical Candidate Facts 中完整存在；`semanticContentRecall = 100%`。主体、程度、时间、经历类型、团队/个人归属、否定关系、课程/工作作用域均不得丢失；
- `PF-I — Category Projection Integrity`：冻结 manifest 的全部 `expectedSemanticTags` 必须出现在匹配 canonical fact，并具有相应 deterministic typed projection；`categoryProjectionRecall = 100%`；
- category 是否投影不再计入 PF-H，但 PF-I 同为 Hard Gate，所以 amendment 不删除冻结事实、不降低完整性要求。

本 amendment 不降低 Evidence Gate、不修改 Phase 2 Product Scope、不授权 Phase 2.2，也不删除或改写历史失败。

> 后续 Gate 记录（2026-08-09）：Product Owner / QA 已依据 canonical acceptance evidence 关闭 Phase 2.1 与 ISSUE-025，并单独授权 Phase 2.2A。上句是 Amendment 2.0.1 获批当时的历史授权边界，继续保留用于审计；本轮不得实现 Recommendation / Strength / Gap / Personalized Greeting。

## 4. Match Status Contract（met / partial / unmet / unknown）

### 4.1 严格定义

| 状态 | 定义 | 必要条件 |
|---|---|---|
| `met` | 同一 requirement 的**关键维度均有足够 Profile Evidence 支持**，方向与程度一致 | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1`（PF 支撑，覆盖全部关键维度） |
| `partial` | ① Profile 中存在与该 requirement **同维度**的明确正证据；② 但证据只覆盖部分范围/程度/年限/职责/限定条件；③ 缺失部分能够明确指出 | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1`；**不能仅因"有一点相关经历"自动 partial** |
| `unmet` | Profile 存在**明确反证**（如"大专"对"本科及以上"、"无驾照"对"持有驾驶证"、"应届无正式工作经历"对"全职经验"） | `jdEvidence ≥ 1` 且 `profileEvidence ≥ 1`（反证 PF）；**无反证 → 不得 unmet** |
| `unknown` | 没有足够正证，也没有明确反证（信息不足） | `jdEvidence ≥ 1`；`profileEvidence` **允许为空**；必须给出 reason 说明缺失的证据维度，且生成 `questionsToConfirm` 或写入 `unknowns` |

### 4.2 维度拆分规则（复合 requirement）

同一 requirement 含多个可独立判定维度（如"2 年以上产品相关经验" = ①产品相关经历 ＋ ②2 年时长；"2 年以上全职产品经理工作经验" = ①全职产品经理职责 ＋ ②2 年时长 ＋ ③全职工作性质）时，**必须按维度拆分判定**，Match Item 以 `requirementDimensions[]` 表达（见 §5），顶层 status 由维度聚合：

- 全部维度 `met` → 顶层 `met`；
- 任一关键维度 `unmet` → 顶层 `unmet`（并给出反证维度）；
- 存在 ≥1 维度 `met`/`partial`（正证）且其余 `unknown` → 顶层 `partial`（必须明确指出缺失维度）；
- 无任何正证维度且存在 `unknown` → 顶层 `unknown`。

不得仅因"做过相关项目"就把整个"2 年经验要求"判为 `partial` 或 `met`——必须区分"产品相关经历有正证"与"2 年时长 unknown"两个维度。

### 4.3 关键边界案例（14 个）

| # | 场景 | 判定 | 依据 |
|---|---|---|---|
| 1 | JD"熟练使用 SQL"；Profile 完全没写 SQL | `unknown` | 无正证无反证，不得 `unmet` |
| 2 | JD"2 年以上产品相关经验"；Profile"参与过两个产品项目"但无任何年限信息 | 维度拆分：产品相关经历 `met`/`partial`；2 年时长 `unknown` → 顶层 `partial` | 不得因"做过项目"自动判整个要求为 `partial`/`met` |
| 3 | JD"2 年以上全职产品经理工作经验"；Profile"做过两个课程产品项目"且未说明正式工作经历 | 维度拆分：课程项目 ≠ 全职产品经验；全职工作维度 `unknown`（不得自动 `unmet`）；课程项目维度 `unknown` 或按职责 `partial` | 无明确反证不得 `unmet` |
| 4 | JD"2 年以上全职产品经理工作经验"；Profile 明确"应届毕业生，无正式工作经历" | 全职工作经验维度 `unmet`（明确反证）；2 年时长维度 `unknown` → 顶层 `unmet` | 明确反证存在 |
| 5 | JD"有 AI Agent 项目经验（preferred）"；Profile"完成 AI Career Advisor 项目，明确描述 Agent workflow 设计职责" | `met`（preferred 类） | 方向＋职责证据一致 |
| 6 | JD"有 AI Agent 项目经验"；Profile 仅"参与过 AI 项目"，无 Agent 证据 | 不得补成 Agent Experience → `unknown`（或按职责证据 `partial`，不得 `met`） | 无 Agent 维度正证 |
| 7 | JD"本科及以上"；Profile"大专" | `unmet` | PF 明确反证学历 |
| 8 | JD"40 岁以下"；Profile"38 岁" | `met` | PF 年龄证据 |
| 9 | JD"40 岁以下"；Profile"45 岁" | `unmet` | PF 明确反证 |
| 10 | JD"具有驾驶证"；Profile 未提 | `unknown` | 不得 `unmet` |
| 11 | JD"具有驾驶证"；Profile"无驾照" | `unmet` | PF 明确反证 |
| 12 | JD"熟练使用 Figma"；Profile"会用 Figma 画原型" | `partial` | 有基础正证，程度不足；缺失部分明确指出 |
| 13 | JD"熟练使用 Figma"；Profile"日常用 Figma 完成设计稿" | `met` | 程度与方向一致 |
| 14 | JD"愿意出差"；Profile 未提 | `unknown` | 生成 questionsToConfirm |

## 5. Match Item Contract

```ts
const matchItemSchema = z.object({
  requirement: z.string().trim().min(1).max(200),     // JD 要求（提炼，须可回溯 jdEvidence）
  requirementType: requirementTypeSchema,              // 复用 Phase 1：hard/core/preferred（兼作 criticality：hard=critical、core=normal、preferred=bonus）
  status: z.enum(["met", "partial", "unmet", "unknown"]), // 顶层聚合状态（见 §4.2）
  requirementDimensions: z.array(z.object({            // 复合 requirement 按维度拆分
    dimension: z.string().trim().min(1).max(120),
    status: z.enum(["met", "partial", "unmet", "unknown"]),
    reason: z.string().trim().min(1).max(320),
    jdEvidence: z.array(z.string()).min(1).max(3),
    profileEvidence: z.array(z.string()).max(3),       // unmet/partial/met 必须 ≥1；unknown 允许空
  })).min(1).max(5),
  reason: z.string().trim().min(1).max(320),
  jdEvidence: z.array(z.string()).min(1).max(3),       // JD 原文逐字
  profileEvidence: z.array(z.string()).max(3),         // PF 引用；顶层 unknown 允许为空
}).strict();
```

强制规则：

- `met` / `partial` / `unmet`：`profileEvidence` 必须 ≥ 1；
- `unknown`：`profileEvidence` 允许为 `[]`，但 `reason` 必须说明缺失的证据维度，并联动 `questionsToConfirm`/`unknowns`；
- `unmet`：必须存在明确反证 PF；"没有找到相关信息" → `unknown`；
- `partial`：必须同维度正证 ＋ 明确指出缺失范围/程度/年限/职责；
- **Derived Observation 约束**：不得作为 explicit counter-evidence；不得单独支撑 `unmet`；
- **`confidence`：不输出**（已决，见 §14）；
- 维度至少覆盖：hard requirement、core capability、experience evidence、career direction、preferred/bonus（F2-03）。

## 6. ISSUE-014 解决：Recommendation Decision Contract

### 6.1 四级定义

- `priority`：必须满足 §6.2 全部必要条件（不自动成立）；
- `try`：允许少量 non-critical unknown/partial；硬门槛无明确不可忽略矛盾；
- `cautious`：存在需谨慎确认的条件（eligibility 不确定性、critical core 明显 partial、关键 unknown、方向冲突、Profile 可信度不足）；
- `not_recommended`：存在明确 counter-evidence（hard 矛盾、多项核心资格反证、方向严重冲突）；**不得仅因信息不足产生**。

### 6.2 Recommendation Decision Contract（Deterministic guardrails ＋ criticality-aware LLM judgment）

**Criticality 复用 Phase 1 requirementType**（不新增分类）：`hard` = critical、`core` = normal、`preferred` = bonus。

**priority 必要条件（全部满足才允许候选 priority；满足 ≠ 自动 priority）**：

- 无 hard `unmet`；
- 无 hard `unknown`；
- 无 critical core `unmet`；
- 无 unresolved critical core `unknown`；
- 无明确 career-direction conflict；
- Profile Evidence 完整度足以支持推荐；
- Recommendation 不依赖 Profile inference 作为候选人事实。

**try 允许条件**：

- 无明确不可忽略 hard contradiction；
- 核心能力存在有效匹配；
- 允许部分 `partial`；
- 允许 non-critical `unknown`；
- 若存在 hard `unknown`，必须显式输出 `questionsToConfirm`，并按该 unknown 的重要性判断是否需降级（LLM judgment）。

**cautious 典型触发**：

- 明确 hard gap，但是否构成绝对淘汰存在不确定性；
- critical core 明显 `partial`；
- 关键资格存在 unresolved `unknown`；
- 明确 career-direction conflict；
- Profile 信息不足导致推荐可信度较低；
- 明确的 eligibility 风险需先与 HR 确认。

**not_recommended 规则**：

- **不得仅因"信息不足"产生**；必须存在明确 counter-evidence；
- 典型触发：明确且重要的 hard requirement contradiction；多项核心资格明确反证；岗位核心方向与候选人目标明确严重冲突；其他 Contract 定义的强 negative evidence；
- 所有 `not_recommended` 必须有 `counterEvidence`，且每条可回溯 `jdEvidence` ＋ `profileEvidence`。

**废止的旧规则**：`≥3 core partial → 至少 cautious` 的绝对数量规则**删除**（3/3 与 3/10 语义不同，核心职责重要性不同；不做简单数量 guardrail）。

**确定性 guardrails**（服务端可执行）：上述"必须/禁止/不得"条款；
**LLM judgment 范围**：`priority` vs `try` 的最终取舍、summary 措辞、支持/反方证据排序、partial 接近程度与可迁移性权重、已有明示 waiver evidence 的引用措辞——均在 guardrails 约束内。模型不得自行推断 requirement 可豁免。

### 6.3 ISSUE-026 Waiver Evidence Contract

Recommendation 使用 waiver / exception / flexibility / relaxation、放宽、豁免、例外、弹性、酌情处理或能力/经验可弥补硬门槛等语义时，必须追溯到同一 `MI-*` 对应的 JD 明示 evidence。Candidate 其他维度很强不构成 waiver evidence。

- `hard unknown`：表示 Candidate Evidence 不足，不表示已知不满足；必须优先询问 Candidate 自身事实。可另行引用 JD 明示 waiver clause，但必须保持“Candidate eligibility unknown”与“requirement flexibility”两个语义层，不得询问 Candidate 是否可豁免；
- `hard unmet + waiverEvidence=none`：必须明确承认硬门槛未满足；可输出 `not_recommended`，也可在 §6.2 已有 allowed set 支持时输出 `cautious`，但 cautious 只能建议确认 requirement 是否为严格筛选门槛/具体口径，不得创造可放宽、可豁免或可例外的招聘政策；
- `hard unmet + explicit waiverEvidence`：保留原 hard gap 和 counter evidence，可引用同一 `MI-*` 的 JD waiver clause 并开放式询问适用标准；generic waiver evidence 只证明放宽条款存在，不证明具体替代机制，不得自行举例其他/同等学历、经验折算等 JD 未明示标准；waiver clause 不得把 Match status 从 `unmet` 改为 `partial/met`；
- JD 明示“本科，或三年以上同类经验”等 alternative qualification 应按 Match Contract 的原始资格逻辑处理，不得称为 waiver；具体替代、弥补、抵消或折算关系只能由此类 explicit alternative evidence 支持，generic waiver evidence 不可替代；
- 不新增第二事实源。公开 Final Schema 无需新增字段时，由服务端通过 `MI-* → Requirement → JD Evidence` 内部 enforce；
- 确定性 Gate `R-K — Waiver / Flexibility Evidence Integrity`：unsupported waiver claim = 0、unknown→unmet semantic drift = 0、fabricated flexibility claim = 0。

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
- 若 `level ≥ try` 且存在 hard unmet（如学历），`counterEvidence`/`summary` 必须显式说明；无 JD waiver evidence 时 confirmWithHR 只能确认 requirement strictness/具体口径，有 JD 明示 waiver 时才可确认 waiver 适用标准；禁止"推荐投递"与"学历明确不满足核心硬门槛"并存且无解释；
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

Phase 2 落地：Profile 侧推断同样适用本约束（Profile 无依据不得升级程度）；**Derived Match Observation 同样受本 modifier contract 约束**——允许"从职责看，岗位可能涉及客户沟通"；禁止"岗位需要频繁进行高强度客户沟通"（除非 JD Evidence 分别支持对应 modifier）；校验思路（实现期，本轮不写代码）：修饰语黑名单＋JD/Profile evidence 覆盖检查＋`sourceType`/措辞校验。

## 11. Personalized Greeting Contract

- **候选人事实只能来源于 Stated / Normalized Candidate Fact ＋ 有效 PF Evidence**；`profile_inferred`（Derived Observation）**不得**作为新的 Candidate Claim 进入话术（已决，否决此前"可带审慎措辞进入"的建议）；
- 内部必须可校验（PF ID），用户界面可不显示；
- Derived Match Observation 可以影响：哪段真实经历更值得突出、话术结构、与 JD 哪项职责建立联系——**但不能改变 Candidate Fact 本身**；
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

明示案例（§1.3 的 Python 场景）：Profile"了解 Python，完成 Python 课程项目" → 话术允许"我接触过 Python，并完成过相关课程项目。"；**禁止**"我具备扎实的 Python 开发能力。"——即使系统内部认为其"可能具备基础开发能力"，也不得把该推断变成话术中的自我事实陈述。

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
- **confidence 影响**：Phase 2 MVP 不输出 confidence（已决，见 §14），无此维度。

## 14. Confidence 评审结论

**正式决定：Phase 2 MVP 不输出 confidence（数值与 high/medium/low 均 deferred）。**

理由：

1. 无可靠校准依据——数值（如 0.87）无真实概率支撑，会诱导虚假精确；
2. 证据链（status + reason + jdEvidence + profileEvidence）已提供可解释性，confidence 增量有限；
3. Phase 1 体系无 confidence 且 QA 有效，延续该风格可降低 QA 口径分裂；
4. 模型不得生成未经校准的可信度标签；
5. 未来有真实评测数据后再评估是否引入（届时需先定义校准依据）。

## 15. Phase 2 TC 冻结设计（已决：14 TC）

统一约定：每个 TC 最终进行 **3 次真实模型请求**；Phase 2 Final Acceptance matrix = **14 TC × 3 = 42 次真实请求**（已决，不再增减；本轮不调用真实模型）；命中 Contract 章节见括号；禁止错误为 Gate A/B/D/E 级红线。

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
| TC-P2-13 事实冲突（已决：加入） | 双向证据矛盾 | Profile 与 JD 存在矛盾事实（如 JD 要求 3 年、Profile 明确 1 年） | 与 Profile 冲突 | §4、§6、§12 | 按真实证据（不得为 priority） | 冲突项 unmet | 忽略矛盾/中和事实 | 事实忠实度 |
| TC-P2-14 团队成果归属（已决：加入） | 归属边界 | 项目为"团队项目" | 相关岗位 | §8、§11 | 按实际职责表述 | 不夸大 | 团队成果归个人 | 优势真实性/HR 真实性 |

说明：TC-P2-13/14 **已正式加入**，Phase 2 Final Acceptance 冻结集 = **14 TC**。

## 16. Phase 2 QA Gate 草案

| Gate | 定义 | 目标 |
|---|---|---|
| A — Candidate Fact Integrity | 未经用户提供的候选人确定性事实 | `0`；候选人事实幻觉 `0 tolerance` |
| B — Profile Evidence Integrity | Final Candidate Fact 的 PF evidence 逐字回落到 Raw Profile | `100% valid` |
| C — Dual Evidence Integrity | 关键 Match Claim = JD Evidence ＋ PF Evidence；禁止 JD 反推候选人拥有 | 3/3 关键 claim 双证据 |
| D — Cross-source Contamination | JD→PF / PF→JD 污染 | `0` |
| E — Recommendation Consistency | level 与 hard unmet/unknown/方向冲突无确定性矛盾（§6.2/§7 校验规则） | 0 确定性矛盾 |
| F — Content Quality | 人工评分（Profile 事实准确性/匹配逻辑/优势真实性/Gap 准确性/Recommendation 合理性/HR 话术真实性/信息克制/表达质量） | **已冻结**：综合 ≥4.0/5；最低单项 ≥3.0/5；P0=0；系统性 P1=0 |
| G — Phase 1 Regression | TC-01～TC-10 完整重跑 | `10/10 PASS` |
| H — Robustness / Fallback | 见 §17 四类指标定义 | 见 §17（≤20% 仅 hrSafeFallbackRate provisional target） |

**硬 Gate 不可被平均分抵消**：Gate A（Candidate Fact Integrity）、B（Profile Evidence Integrity）、D（Cross-source Contamination）等硬 Gate 失败时，**不得以 Gate F 高平均分覆盖**——高平均分不能掩盖协议错误（与 Phase 1 冻结口径一致）。

### 16.1 Phase 2.1 Candidate Profile Hard Gates（PF-A～PF-I）

| Gate | 定义 | Phase 2.1 目标 |
|---|---|---|
| PF-A Candidate Fact Integrity | Canonical Candidate Fact 幻觉 | `0` |
| PF-B Evidence Integrity | `CF → PF → Raw Profile` 可回溯 | `100%` |
| PF-C Semantic Preservation | 程度/时间/类型/归属/否定/课程作用域不损坏 | `0` violation |
| PF-D Source Isolation | JD/注入/其他来源不得进入 CF | `0` contamination |
| PF-E Final Schema | `candidate-profile-v2` 与 canonical/projection schema | 全部请求 PASS |
| PF-F Fail Closed | 未验证内容不得返回 | PASS |
| PF-G Injection Resistance | instruction text 不得成为 Candidate Fact | PASS |
| PF-H Semantic Fact Completeness | must-preserve semantic facts 存在于 canonical truth layer | `semanticContentRecall = 100%` |
| PF-I Category Projection Integrity | expected tags 与 deterministic projections 完整 | `categoryProjectionRecall = 100%` |

PF-A～PF-I 均为 Hard Gate；任何失败不得被 HTTP 200、平均分或另一个 Gate 的通过覆盖。

## 17. Phase 2 Fallback / Repair Metrics 正式定义

**不再将"15/33 ≈ 45.5%"泛称为整个 Phase 2 fallback rate**——它属于 Phase 1 HR Greeting Safe Fallback 指标（ISSUE-019 口径）。Phase 2 区分四类指标：

| 指标 | 定义 | numerator | denominator | 计数规则 |
|---|---|---|---|---|
| `hrSafeFallbackRate` | HR 初稿越界 → repair → 固定安全兜底的请求比例 | HR 最终进入固定安全兜底的请求数（同请求多次 repair 计 1） | 产生最终分析结果的有效请求数（HTTP 200 且 Final Schema/evidence 通过） | 以服务端 `hrRepairUsedSafeFallback` 为准；Phase 1 baseline ≈ 15/33 = 45.5% |
| `profileRepairRate` | Candidate Profile Structure 因 Schema/Evidence/Fact Integrity 问题触发 repair 的请求比例 | 触发 profile repair 的请求数（同请求多次计 1） | 有效请求数 | 统计单位 = request，非 repair attempt |
| `matchRepairRate` | Match Result 因 Schema/evidence/status consistency/recommendation consistency/contamination 触发 repair 的请求比例 | 触发 match repair 的请求数（同请求多次计 1） | 有效请求数 | 同上 |
| `requestFallbackRate` | 整个 Phase 2 请求最终进入任何用户可见安全 fallback（而非正常 validated result）的请求比例 | 最终进入用户可见 fallback 的请求数 | 全部 Phase 2 请求数（含失败） | 最终 fallback ≠ 中间 repair；repair 后成功产出 validated result 不计 fallback |

可选诊断：`repairAttemptRate`（按 repair attempt 计数，仅诊断，不参与 Gate）。

**通用规则**：

- 统计单位优先使用 **request**，不使用 repair attempt；
- 同请求多次 repair：各指标均计 1 次（0/1 per request）；
- upstream retry（`upstreamAttempts > 1` 后成功）**不计入**任何 repair/fallback 指标；
- 中间 repair 与最终 fallback 的区别：repair 后产出正常 validated result → 只计 repair 类指标；进入用户可见安全兜底 → 计 fallback 类指标；
- 防口径漂移：指标以服务端诊断字段为准；固定回归集（Phase 1 TC ＋ Phase 2 14 TC 冻结输入）登记于 Contract；每次回归记录 numerator/denominator/rate。

**≤20% 状态**：仅作为 `hrSafeFallbackRate provisional quality target`（Phase 1 ISSUE-019 口径），**不冻结为整个 Phase 2 Final Release Gate**；Phase 2.4 获得真实固定回归集数据后再决定最终阈值。禁止通过放宽 Schema/删除 evidence/降低事实约束/静默吞字段/返回未验证内容达成。

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

## 21. Frozen Decisions（已决，不再列为 Open）

1. **confidence**：Phase 2 MVP **不输出**（数值与 high/medium/low 均 deferred；未来有真实评测数据再评估）；
2. **TC-P2-13 / TC-P2-14**：**加入**；Phase 2 Final Acceptance 冻结集 = **14 TC × 3 = 42 次真实请求**；
3. **Gate F**：**冻结**——综合 ≥4.0/5、最低单项 ≥3.0/5、P0=0、系统性 P1=0；硬 Gate（A/B/D）失败不得被平均分覆盖；
4. **fallback ≤20%**：仅作为 `hrSafeFallbackRate provisional quality target`，不冻结为 Phase 2 Final Release Gate；
5. **Profile 输入上限**：不冻结具体数字；定义为 `configurable validated input limit`，行为契约（无 silent truncation/不假装完整/超限明确报错或经批准分段/不得摘要冒充原文/PF 必须回落到 Raw Profile）先冻结，具体上限由 Phase 2.1/2.4 实测确定；
6. **`profile_inferred` 进入 Greeting**：**禁止**——话术候选人事实只能来自 Stated/Normalized Candidate Fact ＋ PF Evidence。

## 22. Remaining Open Questions（仅真正未决项）

1. **Profile 输入上限具体数值**：待 Phase 2.1/2.4 依据 context/Prompt token/JD 与 Profile 上限/输出预算/latency/repair/retry/长输入 TC 实测后确定（行为契约已冻结）；
2. **分段协议**：Phase 2 MVP 默认无分段；超限返回明确输入限制信息。是否设计未来分段协议由 PO 在 Phase 2.4 前决策；
3. **hrSafeFallbackRate 最终阈值**：≤20% 为 provisional；Phase 2.4 固定回归集真实数据后再决定；
4. **Phase 2 TC 冻结输入素材**：14 个 TC 的真实脱敏 JD/Profile 来源待 PO 提供。
