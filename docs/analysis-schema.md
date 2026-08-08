# Phase 1 AI 分析输出协议

> 协议版本：`analysis-v1`  
> 状态：Phase 1 唯一输出契约  
> 更新日期：2026-08-03

## 1. 使用范围

本文件同时是 DeepSeek 输出目标、TypeScript 类型参考、运行时校验参考、API 成功响应和前端展示的数据契约。字段或枚举变更必须同步 Prompt、Schema、前端和测试。

## 2. 通用枚举

### 2.1 `sourceType`

| 值 | 规则 |
|---|---|
| `jd_explicit` | 结论本身由 JD 直接表达 |
| `inference` | 根据 JD 综合推断，必须使用审慎措辞 |
| `to_verify` | JD 无法确定，必须带确认问题 |

引用 evidence 不会自动使推断变成 `jd_explicit`。

### 2.2 `requirementType`

| 值 | 规则 |
|---|---|
| `hard_requirement` | 明确学历、证书、最低年限、明确证照/资格持有要求（如“具有驾驶证”）、明确数值年龄上下限（如“40岁以下”“年龄不低于22岁”）或“必须”等限制 |
| `core_requirement` | 完成核心工作的能力要求，但非机械一票否决 |
| `preferred_requirement` | 原文明确出现优先、加分、有则更佳、尤佳等限定词；或该条所属章节为明确加分/优先类章节（`加分项`、`加分条件`、`优先条件`、`优先项`）且条目自身无更强冲突限定词 |
| `unclear` | 语句粘连或限定范围不清，须向 HR 确认 |

章节级限定词作用于该章节的直接条目：例如 `加分项：` 章节下的 requirement，在条目自身不存在更明确冲突语义（如明确 hard 限定）时，视为 `preferred_requirement`，不需要每条正文重复出现“优先/加分”。`sourceType` 仍为 `jd_explicit`（preferred 语义来自 JD 原文结构，而非模型推断）。

混合限定词复合句规则：同一 requirement evidence 同时包含 hard 与 preferred qualifier，且二者位于可明确分离的不同从句时，应沿原文从句边界拆分为独立 requirements，再分别应用现有分类规则。例如“具备5年以上工业仪器仪表行业工作经验，有PLC、DCS、变频器等自动化相关产品销售或项目经验者优先”应拆为 `hard_requirement`（5年以上…工作经验）＋ `preferred_requirement`（…者优先）。若 hard 与 preferred 属于同一不可分割语义单元（例如“有5年以上销售经验者优先”），不得机械拆分，整体按现有优先级归类。拆分后的每条 evidence 必须是 JD 原文连续子串，不得改写或重新生成。

限定词 + core 复合句规则：当 evidence 同时包含明确限定词（hard 或 preferred）与一个无限定词的独立从句，且从句边界明确、两片段可独立成立时，应拆分为独立 requirements 分别归类——例如“拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景”拆为 `hard_requirement`（4年以上…工作经验）＋ `core_requirement`（具备…背景）；“能流利使用英语进行专业交流，熟悉印尼语者优先”拆为 `core_requirement`（英语…交流）＋ `preferred_requirement`（熟悉印尼语者优先）。若限定词作用于组合条件（例如“有A，并有B者优先”，由“并/且/以及/并且”连接且语义不可分割），不得机械拆分，整体按现有优先级归类。

### 2.3 `applicationAdvice.level`

`worth_exploring | consider_carefully | insufficient_information`。只评价 JD 信息和岗位条件，不代表个人匹配度。

## 3. 最终 JSON 结构

```json
{
  "schemaVersion": "analysis-v1",
  "candidateProfileProvided": false,
  "basicInfo": {
    "jobTitle": null,
    "companyName": null,
    "location": null,
    "employmentType": null,
    "salaryRange": null,
    "experienceRequirement": null,
    "educationRequirement": "本科及以上",
    "summary": "从JD信息看，可能属于产品支持类岗位。",
    "summarySourceType": "inference"
  },
  "coreResponsibilities": [
    {
      "title": "需求整理",
      "description": "协助整理需求并输出文档。",
      "sourceType": "jd_explicit",
      "evidence": ["协助整理需求并输出需求文档"]
    }
  ],
  "roleProfile": {
    "requirements": [
      {
        "content": "本科及以上",
        "explanation": "JD包含明确学历限制。",
        "requirementType": "hard_requirement",
        "sourceType": "jd_explicit",
        "evidence": ["本科及以上"],
        "verificationQuestion": null
      }
    ],
    "workCharacteristics": [],
    "riskSignals": [],
    "unknowns": ["工作地点未说明"],
    "questionsToConfirm": []
  },
  "applicationAdvice": {
    "level": "worth_exploring",
    "summary": "从JD信息看，岗位值得进一步了解。",
    "sourceType": "inference",
    "verificationQuestion": null,
    "reasons": [
      {
        "content": "从职责看，可能接触需求整理工作。",
        "sourceType": "inference",
        "evidence": ["协助整理需求并输出需求文档"],
        "verificationQuestion": null
      }
    ],
    "limitations": "当前建议仅基于JD，不包含个人经历、职业偏好或公司外部信息。"
  },
  "candidateAdvantages": null,
  "hrGreeting": {
    "personalizationStatus": "not_personalized",
    "personalizationNotice": "未提供个人资料，以下内容仅为通用沟通话术，不代表个人匹配结论。",
    "safeGreeting": "您好，我对该岗位很感兴趣，希望进一步了解岗位职责和团队情况。",
    "editableGreetingTemplate": "您好，我是【学历/专业】，具备【真实相关技能】，有【真实项目或实习经历】。请按真实情况填写。"
  }
}
```

## 4. 字段与数量规则

- `basicInfo.summarySourceType` 固定为 `inference`；
- `coreResponsibilities`：1–6 条，`sourceType` 固定为 `jd_explicit`；
- `roleProfile.requirements`：0–16 条；
- `workCharacteristics`：0–6 条；
- `riskSignals`：0–5 条；
- `unknowns`：0–6 个字符串；
- `questionsToConfirm`：0–8 条；
- `applicationAdvice.reasons`：最终 1–3 条；
- 所有 `verificationQuestion` 在非 `to_verify` 时必须为 `null`；`to_verify` 时不能为空，且同一问题必须存在于 `questionsToConfirm`；
- `candidateProfileProvided` 固定为 `false`，`candidateAdvantages` 固定为 `null`。

## 5. evidence 规则

最终展示条目的 evidence 必须：

1. 每项为字符串；
2. 每个数组至少 1 条、最多 3 条；
3. 只 trim 首尾，不改写内部字符；
4. 每条逐字存在于原始 JD；
5. 去重并保持模型原顺序；
6. 先过滤有效性，再保留前 3 条。

ISSUE-012A（单字符 typo 回落）：当 evidence 无法与 JD 原文 exact-match、且空白归一化后仍无唯一候选时，允许执行一次**高置信 source remapping**，约束如下：

- 候选 substring 与模型 evidence **同长度**；
- 最多仅 **1 个 Unicode 字符 substitution**；
- JD 中必须**只有唯一候选**；
- **不支持 insertion/deletion**，不做通用 fuzzy/semantic matching；
- 多候选或低置信**直接保持 fail-closed**（移除该 evidence）；
- remap 后的 evidence 必须再次通过原文 exact-match，**Final evidence 始终为 JD 原文**；
- 模型纠正后的非原文 evidence（如“咨询服务”对应 JD“咨询服乐”）一律不得作为 Final evidence 输出。

Raw AI Output Schema 只检查字段类型和基础结构，允许 evidence 为空或超过 3 条；Raw 结果绝不能直接返回。Final Analysis Schema 的 `min(1)/max(3)` 保持不变。

## 6. 分类与语义约束

- `preferred_requirement` 必须有明确优先/加分证据（限定词示例：优先、加分、有则更佳、尤佳、相关经历优先）；
- 章节级 preferred 作用域：`加分项` / `加分条件` / `优先条件` / `优先项` 章节标题对其直接条目施加 preferred 语义，作用域至下一个同级章节标题结束，后续内容不得继续继承；条目自身存在明确 hard 限定词时，hard 语义优先（该冲突场景另行记录观察）；
- 章节级 preferred 的 evidence 可同时包含条目原文与章节标题原文（两者均须是 JD 中逐字存在的 substring）；不得把章节标题人为拼接进条目正文，不得制造 JD 中不存在的新 evidence；
- 明确学历、证书、证照/资格持有要求（如“具有驾驶证”）、最低年限、明确数值年龄上下限（如“40岁以下”“年龄不低于22岁”）等限制必须为 `hard_requirement`；
- 粘连或限定范围不清必须为 `unclear + to_verify`；
- 非 `unclear` 任职要求来自 JD 原句，使用 `jd_explicit`；
- 画像、风险和建议如不是原文直接结论，不得标 `jd_explicit`；
- `inference` 必须包含“可能”“倾向于”“从职责看”等审慎措辞；
- 团队结构、参与深度、培养机制、业务权重和独立负责范围应为 `to_verify`；
- 无 JD 明示培养安排时，不得确定声称能获得完整经验、快速成长、深入参与、明确晋升或积累高价值经验。

## 7. 定向清理与修复

- 无有效 evidence 的 `riskSignals` 条目直接删除，数组可为空；
- 无有效 evidence 的单条 `applicationAdvice.reason` 删除；全部理由失效时最多修复一次；
- `coreResponsibilities` evidence 清理后为空时最多执行一次仅针对失败职责的修复，只能补充逐字证据或删除无法证明的职责；不得重写其他字段；
- 核心职责修复后数量低于 1、修复响应不完整或证据仍无效时返回 `AI_OUTPUT_INVALID`；
- 所有修复结果必须重新通过限定修复 Schema、Final Schema 和原文证据校验。

## 8. HR 事实边界

无个人资料时不得输出个人匹配度、个人优势、学历、专业、技能、经历、成果、兴趣或求职状态。安全通用版不含个人事实和占位符；模板只允许 `【学历/专业】`、`【真实相关技能】`、`【真实项目或实习经历】`。

## 9. API 包装

成功：`{"data": <完整且已验证的analysis-v1>, "error": null}`。

失败：

```json
{
  "data": null,
  "error": {
    "code": "AI_OUTPUT_INVALID",
    "message": "本次分析生成失败，请重新尝试。",
    "request_id": "服务端请求编号",
    "retryable": true
  }
}
```

## 10. 校验顺序

1. 模型内容非空与 `finish_reason`；
2. `JSON.parse`；
3. Raw AI Output Schema；
4. evidence 标准化；
5. 非核心无效条目清理；
6. 核心职责、投递理由或 HR 的必要定向修复；
7. Final Analysis Schema；
8. 原文证据校验；
9. 只返回最终可信结果。
