# Phase 2.4 ISSUE-035 / ISSUE-036 Deterministic Stabilization

> 日期：2026-08-12
> Starting HEAD：`main / 2cff5da9827479d8c842c173268650a25aaeb28c`
> Frozen implementation baseline：`eb10e8a46096265cbc48475c0cf7869dae2e6b01`
> Authorization：ISSUE-035 / ISSUE-036 deterministic stabilization only
> Phase 2.4：`FAIL / BLOCKED`
> Phase 2.5：`NOT AUTHORIZED`

## 1. ISSUE-035 Exact Root Cause

post-restabilization RB-05 的 Match repair 已正确产生：

- domain=`unknown`、candidateEvidence=[]、uncertainty boundary；
- responsibility=`unknown`、candidateEvidence=[]、uncertainty boundary；
- employment_type=`unmet`、CF-004/counter、合法 formal-work relation。

但 `explicitSameDimensionPositiveFacts` 把 CF-004 `没有正式数据产品工作经历` 加入 domain positive set，产生：

`unknown omitted explicit same-domain positive evidence: CF-004`

完整旧计算路径：

1. 仅在 dimensionType=`domain` 时运行；
2. 从 requirementFragment 选择 `产品/数据分析/运营/销售/前端/后端/测试/设计` anchor；
3. 扫描全部 canonicalFacts，而非当前 dimension 的 candidateEvidence；这是为了检测 unknown 是否静默遗漏 Profile 中已有的同域正证；
4. fact semanticTags 只要包含 `experience` 或 `project_experience`；
5. fact statement 只要包含 domain anchor；
6. CF-004 同时满足 `experience` tag 与“产品”anchor，因此被错误加入 positive set。

Canonical Candidate Fact 没有 polarity 字段。`candidateEvidence.role` 是 Match raw dimension 的结构化 role，但 unknown dimension 按 Contract 必须 refs=[]，无法用它判断“被遗漏的 Profile fact” polarity。现有冻结 source-of-truth 是 Candidate Fact statement 上共享的：

- explicit-negative classifier；
- evidence-boundary classifier；
- 其余可陈述事实才是 positive。

旧 helper 未使用这些信号。相邻路径审计结果：

- unknown preservation：存在本次 false positive；
- met/partial candidateEvidence：raw role 已要求 positive，但此前未阻止 explicit-negative/boundary CF 被模型错标 positive；
- unmet：role=counter，仍允许“大专 vs 本科门槛”等不是语法否定但可比较的合法 counter；不能反向强制所有 counter CF 必须显式否定；
- aggregation：只聚合已验证 status，不自行推断 polarity；
- missingInformation：不作为 Candidate evidence source；
- relational mismatch：同时要求 role=counter、explicit negative、同维度 target，逻辑独立且应保留。

## 2. ISSUE-035 Bounded Fix

- 新增 internal-only `candidateFactPolarity(statement)`：evidence boundary 优先分类 `boundary`，其次 explicit negative=`counter`，其余=`positive`；没有修改 public Schema；
- `explicitSameDimensionPositiveFacts` 只接收 polarity=`positive` 的 fact；semanticTags/domain anchor 仍是 topic/dimension check，不能替代 polarity；
- 新增单向 role-integrity guard：raw role=`positive` 时，被引用 CF 必须是 positive polarity；counter/boundary 不能伪装 positive；
- 不增加反向 blanket rule：role=`counter` 仍可引用“大专”这类正向陈述以表达同维度资格门槛 mismatch；
- CF-004 继续可用于 employment_type unmet 与 ISSUE-034 relation。

## 3. E35-1～E35-10

| Gate | Coverage | Result |
| --- | --- | --- |
| E35-1 | CF-004 counter + domain unknown | PASS / ACCEPT |
| E35-2 | CF-004 → employment_type unmet | PASS / ACCEPT |
| E35-3 | positive domain project omitted by unknown | PASS / REJECT |
| E35-4 | positive + counter coexist; only positive counted | PASS |
| E35-5 | identical tags, opposite polarity | PASS / separated |
| E35-6 | `不具备正式数据产品工作经验` | PASS / excluded from positive |
| E35-7 | `未表明有正式工作经验` boundary | PASS / neutral |
| E35-8 | ISSUE-034 employment relation | PASS / ACCEPT |
| E35-9 | exact current repair domain unknown + CF-004 | PASS / no false positive |
| E35-10 | real same-domain positive omitted | PASS / REJECT |

附加 role-integrity case：explicit counter CF 被 raw 标成 positive 时稳定 REJECT。

## 4. ISSUE-036 Exact Root Cause and Classifier Trace

M-K 的 Candidate qualifier taxonomy 使用 `CANDIDATE_QUALIFIER_PATTERNS`。旧 experience_type regex：

`/正式工作|课程|课堂|校园|实习|全职|工作/g`

其中裸 `工作` 是 standalone alternative；`candidateQualifierOccurrences` 只检查否定/requirement context 与 assertedOnly，并不检查“工作”的 phrase semantics。因此 repair reason 的 `仅参与部分工作` 被直接提取为 `experience_type=工作`。随后 ownership 用 `fact.statement.includes(occurrence.value)` 判断；CF-003 不含“工作”，于是生成 `experience_type:工作->CF-003`。

静态依赖审计：

- 历史 Case B `工作项目` 依赖裸工作 scope 继续 fail-closed；
- `在工作中使用 X` 必须继续识别 employment scope；
- `正式工作/全职/实习` 已有更明确 pattern，必须保留；
- `部分工作/测试工作/整理工作/相关工作` 是 generic task noun，不能自动成为 employment_type；
- 不能全局删除“工作”，也不需要通用 NLP parser。

## 5. ISSUE-036 Bounded Phrase Classification

新增 internal `isEmploymentTypeWorkQualifier`，只让裸 `工作` 在以下 frozen bounded context 成为 experience_type：

- 前置：`在/于/实际/正式/全职/实习 + 工作`；
- 后置：`工作中/期间/经历/经验/岗位/项目`。

明确行为：

- `部分工作/测试工作/需求整理工作`：generic noun，不提取；
- `在工作中/工作期间/工作经历/工作经验/工作岗位`：employment context，提取；
- `工作项目`：按原 frozen Case B 保持 fail-closed，未擅自定义为安全 generic project；
- 支持侧不再使用 `statement.includes("工作")`，而是用相同 occurrence classifier，避免 generic work noun 错误满足 employment qualifier ownership；
- `正式工作/全职/实习` 等明确 pattern 和 duration/ownership 等其他 taxonomy 不变。

## 6. M36-1～M36-12

| Gate | Coverage | Result |
| --- | --- | --- |
| M36-1 | `仅参与部分工作` | PASS / no employment qualifier |
| M36-2 | `协助完成测试工作` | PASS / no employment qualifier |
| M36-3 | `负责需求整理工作` | PASS / no employment qualifier |
| M36-4 | `在工作中使用 Python` | PASS / employment qualifier |
| M36-5 | `具有正式工作经历` | PASS / employment qualifier |
| M36-6 | `两年全职工作经验` | PASS / duration + employment |
| M36-7 | `实习工作中使用 SQL` | PASS / internship preserved |
| M36-8 | exact current `仅参与部分工作` reason | PASS / no M-K work false positive |
| M36-9 | formal-work propagation to unsupported CF | PASS / REJECT |
| M36-10 | `在工作中` propagation | PASS / REJECT |
| M36-11 | `工作项目` | PASS / frozen fail-closed |
| M36-12 | generic work noun + explicit employment phrase | PASS / only explicit phrase guarded |

## 7. Exact Artifact Replay

Tests 直接读取已提交的 `phase-2-4-post-033-034-restabilization-rb-05.json`，未复制或修改 artifact：

- exact initial raw：继续 REJECT；CF-004→domain 与 CF-004→responsibility unsupported negatives 仍由 M-CANDIDATE-LINEAGE 捕获；
- exact initial/repair：`仅参与部分工作` 不再产生 `experience_type:工作->CF-003`；
- exact repair raw：不再把 CF-004 计为 domain positive；domain/responsibility 保持 unknown，employment_type 保持 unmet，整份 repair deterministic ACCEPT；
- acceptance 不是无条件 bypass；initial 的真实非法内容继续失败。

## 8. Preservation and Gates

- ISSUE-033：initial cross-dimension negatives REJECT；repair unknown boundaries 与 employment unmet 保留；
- ISSUE-034：employment relation ACCEPT；domain/responsibility/leadership sibling relation 与 project projection REJECT；
- ISSUE-029：course→CF-003/004、specific-project qualifier、ownership/multi-CF inheritance、no-lineage assertion 继续 REJECT；
- ISSUE-028/030/031/032 与 ISSUE-027：对应 targeted regression PASS，代码未修改；
- focused：2 files / 110 tests PASS；
- authorized targeted：16 files / 327 tests PASS；
- full：23 files / 517 tests PASS；
- lint、production build、diff check、forbidden-surface、secret scan PASS；
- model calls=0；RB-05/E2E=0。

## 9. Scope and Recommendation

- source changes 仅限 Match internal polarity validator 与 shared modifier-integrity bounded classifier；
- no fixture/Contract/public Schema/Prompt/Recommendation/Strength-Gap/Greeting/runner/Gate/runtime-parameter changes；
- 工程建议 ISSUE-035=`LOCAL FIX VERIFIED`；
- 工程建议 ISSUE-036=`LOCAL FIX VERIFIED`；
- Phase 2.4 正式状态仍 BLOCKED；可请求 Product Owner / QA 新的 full-chain E2E authorization，本轮不自行执行或进入 Phase 2.5。
