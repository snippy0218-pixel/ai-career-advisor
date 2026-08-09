# AI 求职顾问项目交接文档（Codex Handoff）

> 更新日期：2026-08-09
> 用途：让一个**没有当前 conversation history、但可读取本仓库**的新 Codex thread 能准确继续当前任务。
> 工作协议：`docs/CODEX-OPERATING-PROTOCOL.md` 为后续 thread 的**固定工作协议**（自主事项、停止升级条件、禁止事项、Issue 处理原则、冻结 Pass Gate）。
> 事实来源：以仓库当前状态为准（`docs/验收执行报告.md`、`docs/analysis-schema.md`、`docs/测试案例.md`、`docs/更新日志.md`、`src/`）。

## 1. 当前主线任务与下一步

**当前状态：Phase 1 = PASS / CLOSED；Phase 2.0 Contract = PASS / CLOSED；Phase 2.1 = STOP & ESCALATE / FINAL GATE NOT PASSED；ISSUE-025 = Open / P1 / Gate Blocker；Phase 2.2 = NOT AUTHORIZED；Runtime Model Benchmark = DEFERRED。** Release baseline：`2faca406…`；Contract baseline：`8bf6cf6…`；failed-gate diagnostic baseline：`653383e…`；Contract Amendment 2.0.1 canonical implementation：`cfdd13c…`。8×1 preflight 与 8×3 final clean matrix 的 PF-A～PF-I 工程证据均为全绿，但**不得自行宣布 Phase 2.1 PASS**，等待 Product Owner / QA Final Gate。

- TC-09（TikTok 生活服务活动/综合运营）已于 2026-08-08 通过：3/3 HTTP 200、Final Schema/evidence 3/3、候选人事实幻觉 0、八维综合 4.50、运营岗位专项 4.73；ISSUE-022 经真实回归验证后关闭；
- ISSUE-023 = P2 / Open / Observe（任职要求偶发重复，TC-09 第1次 1/3），当前不修复、不阻塞；
- 新 thread 的下一步：等待人工 Product/QA 审核 Contract Amendment 2.0.1、`canonical-preflight.json` 与 `canonical-final-matrix.json` 并作出 Phase 2.1 Final Gate 决策；PF-H/PF-I 均保持 100%，runtime model benchmark 暂停；不得开始 Phase 2.2、不得破坏 TC-01～TC-10 Contract（Phase 1 Regression Gate 10/10）；
- **不进入 Phase 2.2、不降低 PF-H、不删除负向事实或历史失败、不修改冻结输入、不更换 runtime model、不修复 ISSUE-023/ISSUE-012B、不做无关重构**。

## 2. Phase 1 当前产品范围与边界

- 产品：单页 Demo——用户粘贴招聘 JD → 服务端调 DeepSeek → 返回经校验的 `analysis-v1` 结构化岗位分析 → 页面展示；
- 目标用户：应届生 / 0–1 年经验求职者；
- Phase 1 明确不做：登录、数据库、文件上传、OCR、历史记录、会员/权限、投递管理、SSE、人岗匹配、个性化优势分析、自动投递、语音/视频面试、多模型路由、管理后台、公开部署；
- **不进入 Phase 2**；所有 AI 结论必须可解释（JD 明示 / 推断 / 待确认），关键结论带 JD 原文 evidence，不编造候选人经历。

## 3. 当前技术架构与 requirement normalization 链路

技术栈：Next.js 16.2.12（App Router）、React 19.2.8、TypeScript 6.0.3（strict）、Tailwind CSS 4、Zod 4.4.3、Vitest 4.1.10 + Testing Library。单体应用，无数据库/认证/状态库；DeepSeek 通过原生 fetch 调用（非思考、非流式、`response_format=json_object`、温度 0.2、`max_tokens=4096`）。

关键文件：

- `src/app/api/analyze/route.ts`：唯一 API 路由（request_id、错误映射）；
- `src/lib/analysis-schema.ts`：Raw/Final 两阶段 Zod Schema、限定词判定、章节作用域检测、evidence 校验；
- `src/lib/deepseek.ts`：DeepSeek 适配器 + 完整 normalization/修复管线；
- `src/lib/prompt.ts`：主 Prompt `jd-analysis-v1.2` + 4 个修复 Prompt（evidence/core-evidence/requirement-evidence/HR-greeting）；
- `src/components/*`：前端展示。

**requirement normalization 链路（按执行顺序）**：

1. `normalizeEvidence`：trim → JD 逐字匹配 → whitespace-normalized span recovery（ISSUE-012 已实施能力，唯一原文 span 恢复、多候选不猜测）→ 去重 → 最多 3 条；
2. 句中起点启发式 `startsInsideUnseparatedClause`：evidence 起点前一字符非分隔符且**无明确 hard/preferred 限定词**时归 `unclear`（ISSUE-015 修改后，明确限定词优先）；
3. 章节作用域 `findRequirementSectionContext`：`加分项/加分条件/优先条件/优先项` 章节内条目 → `preferred_requirement` 并将章节标题并入 evidence（ISSUE-016）；
4. 复合句拆分 `findSeparableQualifierSplit`（经 `normalizeRequirementItems`）：hard＋preferred / hard＋core / core＋preferred 在可分离从句时拆分；`并/且/以及/并且` 开头的组合条件不拆分（ISSUE-020/022）；
5. 确定性分类：`hasUnclearQualifierScope` → `unclear`；`hasPreferredQualifier`（含"尤佳"）→ `preferred`；`hasHardQualifier`（含"X年以上/X年及以上/至少[有]X年"）→ `hard`；否则 `core`；
6. 修复路径：requirements evidence 空 → 一次定向修复；coreResponsibilities evidence 空 → 一次定向修复；投递理由全部失效 → 一次定向修复；HR 越界 → 一次修复 + 固定安全兜底；均服从 60s 总超时；
7. Final Schema + JD 原文 evidence 终检；失败一律 `AI_OUTPUT_INVALID`(502)，不返回模型原文。

## 4. 冻结的单案例 Pass Gate

（单案例判定；案例级与 Phase 级区分见 `产品验收记录.md` §7.1）

- 3/3 HTTP 200（同一原始 JD 连续 3 次）；
- Final Schema 通过（3/3）；
- 原文 evidence 校验通过（3/3）；
- candidate hallucination = 0；
- 当前案例无由该案例新发现或直接触发的未关闭 P0/P1（已隔离的已知 P1 不阻塞）；
- 八维综合平均 ≥ 3.8；
- 任一单项 ≥ 3.0；
- 无确定性协议错误（高评分不得掩盖）；
- P2/一般优化项进问题池，不阻塞但必须记录。

八维口径：核心职责提炼准确性、任职要求分类准确性、岗位真实画像价值、风险信号合理性、投递建议边界与行动价值、HR 安全通用话术自然程度、可编辑模板实用性、结论与原文证据一致性。

## 5. TC-01～TC-09 最终状态

| 案例 | 类型 | 最终状态 | 八维综合 | 备注 |
|---|---|---|---|---|
| TC-01 | 高匹配 | 通过 | 4.13 | ISSUE-001/002/003/009 等已修复 |
| TC-02 | 非AI技术岗 | 通过 | 4.27 | ISSUE-010/011 修复后累计 6/6 |
| TC-03 | 低匹配/高门槛 | 通过 | 4.35 | 第二轮 771 字符 JD；首份 1149 字符为 ISSUE-012 robustness 样本 |
| TC-04 | 信息不足 | 通过 | 4.35 | 信息克制专项 4.75；ISSUE-014 来源案例 |
| TC-05 | AI/Agent 产品经理 | 通过 | 4.48 | ISSUE-015 修复后重评；AI 岗位理解专项 4.93；首份 1284 字符为 ISSUE-012 第二样本 |
| TC-06 | 前端技术岗 | 通过 | 4.42 | ISSUE-016 修复后；技术忠实度专项 4.80；ISSUE-017 首现（整条遗漏） |
| TC-07 | 食品/餐饮产品岗 | 通过 | 4.48 | ISSUE-018（"尤佳"）验证后关闭；职责拆分与责任边界专项 5.0 |
| TC-08 | 工业自动化 B2B 销售 | 通过 | 4.38 | ISSUE-020 修复后回归；修复前第一轮 3 次为失败证据永久保留；薪酬与风险审慎专项 4.5 |
| TC-09 | TikTok 生活服务活动/综合运营 | 通过 | 4.50 | ISSUE-022 修复后正式回归；运营岗位专项 4.73；ISSUE-023 首现（B 句偶发重复 1/3） |

各案例评分与问题清单详见 `docs/验收执行报告.md`（TC-01~08 分别见 4.x/5.10/6.10/7.8/8.10/9.8/10.8/11.8，TC-09 见 12.8）。

## 6. 已关闭的重要 Issue 及其协议修改

| Issue | 等级 | 修复内容（协议/实现） |
|---|---|---|
| ISSUE-010 | P0 | 列表编号边界：分隔符集合增加 `\s、.．)）` 等；`1.本科及以上` 不再被误判粘连为 `unclear` |
| ISSUE-011 | P2 | `hasHardQualifier` 年限分支增加"X年及以上" |
| ISSUE-013 | P2 | `max_tokens` 3000→4096；截断诊断 `truncatedByLength` |
| ISSUE-015 | P1 | `hasHardQualifier` 增加"至少[有]X年"；句中起点启发式对明确 hard/preferred 限定词不再强制 `unclear` |
| ISSUE-016 | P1 | 章节级 preferred 作用域：`findRequirementSectionContext`（加分项/加分条件/优先条件/优先项），章节标题并入 evidence；协议见 `analysis-schema.md` |
| ISSUE-018 | P1 | `hasPreferredQualifier` 增加"尤佳"；协议/Prompt 规则10 示例同步 |
| ISSUE-020 | P1 | 复合句 hard＋preferred 拆分：`findSeparableQualifierSplit`（现为通用 helper 前身 `findMixedQualifierSplit`）；协议新增混合限定词复合句规则 |
| ISSUE-022 | P1 | 复合句 qualifier＋core 拆分：`findSeparableQualifierSplit` 覆盖 hard＋core / core＋preferred，`并/且/以及/并且` 组合条件保护；经 TC-09 回归验证后关闭（见 §8） |
| ISSUE-024 | P1 | `hasHardQualifier` 增加明确证照/资格持有（驾驶证/驾照/资格证/从业/执业/职业资格/上岗证/操作证/执业证）与明确数值年龄上下限（X岁以下/年龄不超过X岁/年龄不低于X岁/年满X周岁）分支，排除否定表述；协议同步 `analysis-schema.md` §2.2；经 TC-10 修复后回归 3/3 验证后关闭 |

其余已关闭：ISSUE-001/002/003（P0）、ISSUE-004/005/009（P1）、ISSUE-006/008（P2），详见 `docs/更新日志.md` 与 `docs/验收执行报告.md` §15。

## 7. 当前打开的 Issue

| Issue | 等级 | 状态 | 观察/处置规则 |
|---|---|---|---|
| ISSUE-012A | P1 | **Closed（2026-08-08 人工确认）** | 标准 JD 中局部可恢复 typo 被模型纠错导致 evidence 无法 exact-match：唯一单字符替换高置信回落（同长度、1 个 Unicode 字符替换、JD 唯一候选；不支持 insertion/deletion/fuzzy；多候选 fail-closed；Final evidence 仍为 JD 原文）；经 TC-10 修复后回归验证（run2 remap 回落原文、3/3 HTTP 200）；总验收核验全部通过 |
| ISSUE-012B | P1 | **Deferred / Out of Phase 1 Scope / Phase 2 Robustness Backlog（已批准）** | 语义截断/字符缺失/片段乱序等真损坏输入的 evidence 鲁棒性；不属于 Phase 1 支持范围，fail-closed（输入门禁＋502）；转入 Phase 2 Robustness Track；已有两个真实样本（TC-03 1149 字符、TC-05 1284 字符） |
| ISSUE-014 | P2 | Open / Accepted Backlog | 信息不足场景 recommendation level 缺少判定边界（TC-04 3/3 `worth_exploring`）；Phase 2.0 Contract 设计前置输入 |
| ISSUE-017 | P2 | Open / Accepted Backlog | Requirement extraction completeness：仅统计 content 片段化 + 独立要求整条遗漏（累计：片段化 2 次＋整条遗漏 1 次，均 TC-06）；Phase 2.4 复评 |
| ISSUE-019 | P2 | Open / Accepted Backlog / Phase 2 Quality Optimization Priority | HR safeGreeting fallback 高频（累计 15 次 / 33 有效请求 ≈45.5%）；Phase 2 目标：固定回归集 fallback rate ≤20%，禁止放宽约束达成 |
| ISSUE-021 | P2 | Open / P2 High Priority / Phase 2 Committed Review | 工作特征强度无依据升级（frequency amplification）：TC-03 2/3、TC-08 6/6、TC-10 有效请求 5/5，跨案例累计 13 次；全部为审慎推断措辞、未进 riskSignals、未影响 level；维持 P2 理由与升级阈值见 `docs/PHASE-1-ACCEPTANCE.md` §5.4 |
| ISSUE-023 | P2 | Open / Accepted Backlog | 任职要求偶发重复（TC-09 第1次 1 次）；当前不修复；Phase 2.4 复评 |

## 8. ISSUE-022 详情（已 Closed，2026-08-08）

**ISSUE-022 / P1：复合 requirement 中 qualifier 与 core 分属独立从句时，整句分类导致限定词作用域跨从句污染。**

### 根因

`normalizeRequirement` 基于整条 evidence 做限定词判定：hard＋core 整句归 hard、core＋preferred 整句归 preferred，限定词作用域跨从句污染；旧 `findMixedQualifierSplit` 仅覆盖 hard＋preferred（ISSUE-020），未覆盖 hard＋core 与 core＋preferred。

### 两个实际触发句（TC-09）

- **A**：`拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景`
- **B**：`能流利使用英语进行专业交流，熟悉印尼语者优先`

### 已确认的正确产品语义

- A → `hard_requirement`（拥有4年以上…工作经验）＋ `core_requirement`（具备预测、计划制定及活动策划背景）；"4年以上"只限定前一独立从句，不得把背景要求升级为 hard；
- B → `core_requirement`（能流利使用英语进行专业交流）＋ `preferred_requirement`（熟悉印尼语者优先）；不得把英语必备降级为 preferred。

### 修复状态（已在本仓库完成，勿重复实现）

- **状态：Closed**（2026-08-08：自动测试 116/116 ＋ TC-09 三次真实回归 3/3 正确拆分 A → hard＋core、B → core＋preferred；TC-08 反例由自动化回归保持整体 preferred）；
- 协议：`docs/analysis-schema.md` 新增"混合限定词复合句规则"与"限定词 + core 复合句规则"；
- Prompt：`src/lib/prompt.ts` 规则22（复合句拆分指引）；
- 实现：`src/lib/deepseek.ts` 新增 `findSeparableQualifierSplit`（经 `normalizeRequirementItems` 接入 `prepareAnalysis`），覆盖 hard＋preferred / hard＋core / core＋preferred；**`并/且/以及/并且` 开头从句跳过（组合条件保护）**；
- 测试：`src/lib/deepseek.test.ts` 新增 2 项（A→hard＋core、B→core＋preferred）；`npm test` 116/116、lint、build 通过；
- 记录：`docs/更新日志.md`（ISSUE-022 一节与 TC-09 通过与关闭）、`docs/验收执行报告.md` §12.8/§15。

### 最小修复范围（已实施）与禁止扩大事项

- 只做"单条 verbatim evidence、从句边界明确、两片段可独立成立"的窄场景拆分；拆分片段复用现有 `normalizeRequirement`；
- **禁止**：全局 hard/preferred precedence 调整、重构整个 JD parser、新增 requirementType、放宽 evidence/sourceType/Final Schema、把"core＋preferred 命中逗号即拆分"做成机械规则。

### 必须保护的 TC-08 反例

`有烟草行业或工业大企业销售经验，并有落地项目经验者优先` —— 必须保持整体 `preferred_requirement`，不得拆成 core＋preferred（"并有"为组合条件连接词，优先作用于组合条件）。

### 自动化测试（已补 + 必须保持）

- TC-09 A → hard＋core；
- TC-09 B → core＋preferred；
- TC-08 反例（有A，并有B者优先）→ 整体 preferred；
- "有5年以上销售经验者优先" → 整体 preferred；
- ISSUE-020 hard＋preferred 继续正确拆分；
- ISSUE-010/011/015/016/018/020 回归；
- 拆分后 evidence 逐字、sourceType、顺序、重复、确认问题、repair candidate index 均需检查。

### TC-09 冻结输入

- 836 字符；UTF-8 SHA-256：`99083d9833b1b65b2055773239402d1b550164f66b1964ec3d50c5c129a70fd0`
- 已执行三次真实回归（request_id 与结果见 `docs/验收执行报告.md` §12.8）；输入文件在 `%TEMP%\tc09-regression\tc09-jd.txt`（临时目录不可长期依赖，以本节全文为准）。

```text
职位描述
团队介绍：TikTok是一个覆盖150个国家和地区的国际短视频平台，我们希望通过TikTok发现真实、有趣的瞬间,让生活更美好。TikTok在全球各地设有办公室，全球总部位于洛杉矶和新加坡，办公地点还包括纽约、伦敦、都柏林、巴黎、柏林、迪拜、雅加达、首尔和东京等多个城市。
TikTok生活服务业务在国际化布局早期阶段，我们聚焦生服领域三大行业（餐饮Dine-in、酒旅Hotel和景点门票ThingsToDo）。通过兴趣点（POI）、视频、直播、搜索等多种方式，链接海外线下商家、创作者与用户，并致力于成为海外用户首选的本地服务内容和产品探索平台。团队目前积极扩张中，当前成员分布和Base地点在上海、北京、新加坡、日本东京、印尼雅加达和美国洛杉矶6个城市。大航海时代，我们欢迎大家一起加入国际化早期征程，共同打造TikTok生活服务业务!

1、制定活动框架：明确活动目标和时间线，建立核心主题，设定总体目标和预算，分解具体目标，并将职责分配给跨职能团队；
2、市场分析：持续监控市场趋势和市场动态，从卖家和买家中获取认知，同时借鉴其他国家或地区的最佳实践，建立信息库并发掘新的增长机会；
3、生成洞察：整合内部数据、市场研究以及来自卖家和买家的反馈，挖掘可执行的洞察，以解锁新的增长机会或提升运营效率；
4、促进跨职能协作：作为知识中心，与业务发展团队、创作者团队及其他团队（包括产品经理）合作，设计并执行一致且有影响力的活动。
职位要求
1、拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景；
2、有主人翁意识，能够对项目结果负责、保持积极乐观的工作心态，并在规定时间内完成任务；
3、具备管理和同时执行多个项目的专业能力，包括制定时间表、管理预算以及高效协调团队；
4、熟练分析数据和指标，评估营销活动效果，并运用经验进行持续改进；
5、能流利使用英语进行专业交流，熟悉印尼语者优先；
6、愿意定期进行国际出差。
```

### 验证结果（已执行完毕）

1. 工程验证：targeted tests → `npm test`（4 文件 116/116）→ lint → build 全部通过；
2. TC-09 三次真实回归（2026-08-08）：3/3 HTTP 200、Final Schema/evidence 3/3、候选人事实幻觉 0、八维综合 4.50、运营岗位专项 4.73；TC-09 A/B 拆分 3/3 正确；TC-08 反例自动化回归保持整体 preferred；
3. 观察项：ISSUE-023 首现（第1次 B 句偶发重复，P2/Observe）；ISSUE-019 累计 14 次；ISSUE-021 本案例 0/3；ISSUE-014/017 本案例 0/3；
4. 结果：TC-09 通过、ISSUE-022 Closed，记录已更新，流程停止待人工确认后续。

## 9. TC-09 专项检查要点（历史记录，回归时已核对）

- 岗位本质：国际化生活服务（TikTok 生服）活动/综合运营岗，**不补造内容运营/用户运营模块**；不因"产品经理"协作对象把岗位产品化；不因"业务发展团队"把岗位销售/BD 化；
- 不补造 SQL/Python/Tableau/BI 等数据工具；不编造业绩/薪酬/客户来源；
- basicInfo 事实边界：团队介绍中的总部/成员分布（洛杉矶、新加坡、上海、北京、东京、雅加达等）**不得视为本岗位明确工作地点**；JD 未明确 location 时不得推断；"预算"指活动/项目预算，不得解释为薪资；
- "愿意定期进行国际出差"：允许"定期国际出差/存在国际出差要求"；**不得**出现频繁/高频/长期/大量等升级（ISSUE-021）；
- 输入资格检查沿用"普通换行 vs 语义截断"区分（见 `docs/测试案例.md` 执行规则第 8 条）。

## 10. 当前绝对不能做的事情

- 不进入 Phase 2.2 开发（Match Engine / Recommendation / Strength / Gap / Personalized Greeting 未授权）；
- 不开始 Phase 2 coding（当前仅 PLANNING / CONTRACT DESIGN）；
- 不修改冻结 JD（TC-01～TC-09 全部冻结输入；TC-09 836 字符 / `99083d98…a70fd0`；TC-08 416 字符 / `06567ac6…eff8f`；TC-07 520 字符 / `dd49ed52…cfc38` 等）；
- 不重构整个 JD parser；不新增 requirementType；不放宽 evidence / Schema / hallucination 约束；
- 不因八维高分忽略确定性协议错误（P0/P1 按问题处理，不用平均分掩盖）；
- 不擅自扩大 ISSUE-022/020/016/015/018 等已定义修复范围；不把复合句错误简单归入 ISSUE-017；不修复 ISSUE-023；
- 未获得 TC-10 真实 JD 前不执行真实 API 回归；执行时沿用"普通换行 vs 语义截断"输入资格检查。

## 11. 工程命令与环境

```powershell
npm test          # 当前 4 文件 116 项
npm run lint
npm run build
npm run dev       # 本地开发
```

- 环境变量：`DEEPSEEK_API_KEY`（服务端，用户级环境变量，`.env.local` 不存在）、`DEEPSEEK_MODEL`（默认 deepseek-v4-flash）、`DEEPSEEK_BASE_URL`（默认 https://api.deepseek.com）；
- 真实回归方式：`npm run build` 后启动生产服务器（`node node_modules/next/dist/bin/next start`，端口 3000），向 `POST /api/analyze` 发送冻结 JD（UTF-8），服务端日志包含逐请求 diagnostics（evidence 恢复/删除、各类修复、Final Schema/evidence、output tokens、truncatedByLength 等）；
- 历史回归样本与日志保存在 `%TEMP%\tc0X-regression\`（临时目录，勿作为唯一证据；正式记录以 `docs/验收执行报告.md` 为准）。

## 12. 版本控制基线（Phase 1 baseline）

- 仓库于 2026-08-08 初始化 Git，首次 baseline commit：`chore: establish Phase 1 baseline after TC-09`；
- branch：`main`；commit hash：`8b4df69cd34b9b76ff10bf67a9124db2a3b6bd4e`（41 文件，20,660 行）；工作区状态：clean；
- 被忽略的主要内容：`node_modules/`、`.next/`、`tsconfig.tsbuildinfo`（`.gitignore` 同时覆盖 `.env*`（保留 `.env.example`）、`/build`、`/out/`、npm/yarn/pnpm 日志、编辑器/OS 文件）；
- 敏感信息扫描：真实 `DEEPSEEK_API_KEY` 值反查 0 命中；41 个待提交文件凭据模式扫描 0 命中；`.env.example` 为占位模板（`DEEPSEEK_API_KEY=` 为空值），可安全提交；
- 后续提交规则：业务变更与文档变更按常规提交；`.env*`（除 `.env.example`）与回归临时文件永不提交；TC 临时响应与 server logs 保存在 `%TEMP%\tc0X-regression\`，不进仓库。
