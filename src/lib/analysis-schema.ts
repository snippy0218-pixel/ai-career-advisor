import { z } from "zod";

export const MIN_JD_LENGTH = 100;
export const MAX_JD_LENGTH = 12_000;
export const ANALYSIS_SCHEMA_VERSION = "analysis-v1" as const;
export const CANDIDATE_PROFILE_PROVIDED = false as const;
export const PERSONALIZATION_STATUS = "not_personalized" as const;
export const PERSONALIZATION_NOTICE =
  "未提供个人资料，以下内容仅为通用沟通话术，不代表个人匹配结论。" as const;
export const SAFE_GENERIC_GREETING =
  "您好，我对该岗位很感兴趣，希望进一步了解岗位的具体职责和团队情况，期待与您沟通。" as const;
export const EDITABLE_GENERIC_GREETING_TEMPLATE =
  "您好，我对该岗位很感兴趣。我是【学历/专业】，具备【真实相关技能】，有【真实项目或实习经历】。以上信息请按真实情况填写，希望进一步沟通。" as const;
export const EDITABLE_GREETING_PLACEHOLDERS = [
  "【学历/专业】",
  "【真实相关技能】",
  "【真实项目或实习经历】",
] as const;

export const analyzeJobRequestSchema = z
  .object({
    jdText: z
      .string()
      .trim()
      .min(MIN_JD_LENGTH, `招聘 JD 至少需要 ${MIN_JD_LENGTH} 个字符`)
      .max(MAX_JD_LENGTH, `招聘 JD 不能超过 ${MAX_JD_LENGTH} 个字符`),
  })
  .strict();

export const sourceTypeSchema = z.enum([
  "jd_explicit",
  "inference",
  "to_verify",
]);

export const requirementTypeSchema = z.enum([
  "hard_requirement",
  "core_requirement",
  "preferred_requirement",
  "unclear",
]);

const evidenceSchema = z.array(z.string().trim().min(1)).min(1).max(3);
const rawEvidenceSchema = z.array(z.string()).optional().default([]);
const verificationQuestionSchema = z.string().trim().min(1).max(200).nullable();

const sourcedProfileItemSchema = z
  .object({
    content: z.string().trim().min(1).max(180),
    explanation: z.string().trim().min(1).max(320),
    sourceType: sourceTypeSchema,
    evidence: evidenceSchema,
    verificationQuestion: verificationQuestionSchema,
  })
  .strict();

const requirementItemSchema = sourcedProfileItemSchema
  .extend({ requirementType: requirementTypeSchema })
  .strict();

const adviceReasonSchema = z
  .object({
    content: z.string().trim().min(1).max(180),
    sourceType: sourceTypeSchema,
    evidence: evidenceSchema,
    verificationQuestion: verificationQuestionSchema,
  })
  .strict();

const rawSourcedProfileItemSchema = sourcedProfileItemSchema
  .extend({ evidence: rawEvidenceSchema })
  .strict();

const rawRequirementItemSchema = requirementItemSchema
  .extend({ evidence: rawEvidenceSchema })
  .strict();

const rawAdviceReasonSchema = adviceReasonSchema
  .extend({ evidence: rawEvidenceSchema })
  .strict();

const questionToConfirmSchema = z
  .object({
    question: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

const hrGreetingStructureSchema = z
  .object({
    personalizationStatus: z.literal(PERSONALIZATION_STATUS),
    personalizationNotice: z.literal(PERSONALIZATION_NOTICE),
    safeGreeting: z.string().trim().min(1).max(180),
    editableGreetingTemplate: z.string().trim().min(1).max(300),
  })
  .strict();

const coreResponsibilitySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(300),
    sourceType: z.literal("jd_explicit"),
    evidence: evidenceSchema,
  })
  .strict();

const jobAnalysisStructureSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_SCHEMA_VERSION),
    candidateProfileProvided: z.literal(CANDIDATE_PROFILE_PROVIDED),
    basicInfo: z
      .object({
        jobTitle: z.string().trim().min(1).max(100).nullable(),
        companyName: z.string().trim().min(1).max(100).nullable(),
        location: z.string().trim().min(1).max(100).nullable(),
        employmentType: z.string().trim().min(1).max(60).nullable(),
        salaryRange: z.string().trim().min(1).max(100).nullable(),
        experienceRequirement: z.string().trim().min(1).max(160).nullable(),
        educationRequirement: z.string().trim().min(1).max(160).nullable(),
        summary: z.string().trim().min(1).max(120),
        summarySourceType: z.literal("inference"),
      })
      .strict(),
    coreResponsibilities: z.array(coreResponsibilitySchema).min(1).max(6),
    roleProfile: z
      .object({
        requirements: z.array(requirementItemSchema).max(16),
        workCharacteristics: z.array(sourcedProfileItemSchema).max(6),
        riskSignals: z.array(sourcedProfileItemSchema).max(5),
        unknowns: z.array(z.string().trim().min(1).max(200)).max(6),
        questionsToConfirm: z.array(questionToConfirmSchema).max(8),
      })
      .strict(),
    applicationAdvice: z
      .object({
        level: z.enum([
          "worth_exploring",
          "consider_carefully",
          "insufficient_information",
        ]),
        summary: z.string().trim().min(1).max(300),
        sourceType: z.enum(["inference", "to_verify"]),
        verificationQuestion: verificationQuestionSchema,
        reasons: z.array(adviceReasonSchema).min(1).max(3),
        limitations: z.string().trim().min(1).max(300),
      })
      .strict(),
    candidateAdvantages: z.null(),
    hrGreeting: hrGreetingStructureSchema,
  })
  .strict();

type HrGreeting = z.infer<typeof hrGreetingStructureSchema>;
type SourcedProfileItem = z.infer<typeof sourcedProfileItemSchema>;
type AdviceReason = z.infer<typeof adviceReasonSchema>;

export function hasPreferredQualifier(value: string) {
  return /(?:优先|加分|有则更佳|更佳|尤佳|相关经历优先)/.test(value);
}

export function hasHardQualifier(value: string) {
  return (
    /(?:本科|大专|专科|硕士|博士).{0,10}(?:及以上|以上)/.test(value) ||
    /(?:必须|须要?|需要持有|须持有|至少\s*有?\s*[一二三四五六七八九十\d]+\s*年|[一二三四五六七八九十\d]+\s*年(?:以上|及以上))/.test(
      value,
    )
  );
}

export function hasUnclearQualifierScope(value: string) {
  return (
    /专业不限[，,]\s*(?:计算机|设计|AI|人工智能).{0,24}(?:具备|有|熟练|了解)/i.test(
      value,
    ) ||
    /(?:要求|条件)[：:]?[^。；;\n]{20,}(?:具备|有|熟练)[^。；;\n]{20,}(?:具备|有|熟练)/.test(
      value,
    )
  );
}

export interface RequirementSectionContext {
  isPreferred: boolean;
  header: string | null;
}

const preferredSectionTitlePattern =
  /^(加分项|加分条件|优先条件|优先项)\s*[:：]?\s*$/;

// Minimal known section-title set used to terminate a preferred section scope.
// Deliberately small: this is not a general JD parser.
const knownSectionTitlePattern =
  /^(岗位职责|任职要求|职位职责|岗位要求|工作职责|职位要求|岗位描述|职位描述|任职资格|工作内容|工作要求|必备条件|任职条件|薪资福利|薪酬福利|福利待遇|公司简介|公司介绍|岗位名称|职位详情|加分项|加分条件|优先条件|优先项)\s*[:：]?\s*$/;

function jdLineOffsets(jdText: string): Array<{ text: string; start: number }> {
  const lines: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const line of jdText.split("\n")) {
    lines.push({ text: line, start });
    start += line.length + 1;
  }
  return lines;
}

/**
 * ISSUE-016: deterministically determines whether the text at
 * evidenceStartIndex belongs to a preferred section (加分项/加分条件/
 * 优先条件/优先项). The preferred scope ends at the next known section
 * title or at EOF.
 */
export function findRequirementSectionContext(
  jdText: string,
  evidenceStartIndex: number,
): RequirementSectionContext {
  let context: RequirementSectionContext = { isPreferred: false, header: null };

  for (const { text, start } of jdLineOffsets(jdText)) {
    if (evidenceStartIndex < start) break;

    const trimmed = text.trim();
    const stripped = trimmed.replace(/^【|】$/g, "").trim();
    const isPreferredHeader = preferredSectionTitlePattern.test(stripped);
    const isOtherHeader = knownSectionTitlePattern.test(stripped);

    if (isPreferredHeader) {
      context = { isPreferred: true, header: trimmed };
    } else if (isOtherHeader) {
      context = { isPreferred: false, header: null };
    }
  }

  return context;
}

export function hasCautiousInferenceLanguage(value: string) {
  return /(?:可能|倾向于|从.{0,20}(?:看|判断)|或许|有望|实际.{0,20}(?:需|需要)确认|建议.{0,30}确认|可能性)/.test(
    value,
  );
}

const forbiddenGrowthClaims = [
  "能获得完整产品经验",
  "能快速成长",
  "能深入参与AI产品",
  "有明确晋升空间",
  "能积累高价值经验",
] as const;

export function findUnsupportedGrowthClaims(
  content: string,
  evidence: string[],
) {
  const fixedClaims = forbiddenGrowthClaims.filter(
    (claim) => content.includes(claim) && !evidence.some((item) => item.includes(claim)),
  );
  const genericClaims =
    content.match(
      /(?:能|能够|可以|可)(?:获得|积累|提升|深入参与|快速成长)[^，。；;]{0,30}/g,
    ) ?? [];

  return [...new Set([...fixedClaims, ...genericClaims])];
}

function isConclusionDirectlyExpressed(content: string, evidence: string[]) {
  return evidence.some(
    (item) => item.includes(content) || content.includes(item),
  );
}

function addSourceProtocolIssues(
  item: SourcedProfileItem | AdviceReason,
  path: PropertyKey[],
  questions: Set<string>,
  context: z.RefinementCtx,
) {
  const combinedText =
    "explanation" in item ? `${item.content} ${item.explanation}` : item.content;

  if (
    item.sourceType === "jd_explicit" &&
    !isConclusionDirectlyExpressed(item.content, item.evidence)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "sourceType"],
      message: "jd_explicit requires the conclusion itself to be expressed by JD evidence",
    });
  }

  if (
    item.sourceType === "inference" &&
    !hasCautiousInferenceLanguage(combinedText)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "content"],
      message: "inference requires cautious wording",
    });
  }

  if (item.sourceType === "to_verify") {
    if (!item.verificationQuestion) {
      context.addIssue({
        code: "custom",
        path: [...path, "verificationQuestion"],
        message: "to_verify requires a verification question",
      });
    } else if (!questions.has(item.verificationQuestion)) {
      context.addIssue({
        code: "custom",
        path: [...path, "verificationQuestion"],
        message: "verification question must be included in questionsToConfirm",
      });
    }
  } else if (item.verificationQuestion !== null) {
    context.addIssue({
      code: "custom",
      path: [...path, "verificationQuestion"],
      message: "only to_verify may include a verification question",
    });
  }

  if (findUnsupportedGrowthClaims(combinedText, item.evidence).length > 0) {
    context.addIssue({
      code: "custom",
      path: [...path, "content"],
      message: "unsupported deterministic growth claim",
    });
  }
}

export interface HrGreetingBoundaryViolation {
  field: "safeGreeting" | "editableGreetingTemplate";
  code:
    | "PLACEHOLDER_IN_SAFE_GREETING"
    | "MISSING_EDITABLE_PLACEHOLDER"
    | "UNKNOWN_EDITABLE_PLACEHOLDER"
    | "UNSUPPORTED_CANDIDATE_CLAIM";
}

const candidateClaimPatterns = [
  /(?:我|本人)(?:具备|熟悉|掌握|擅长|拥有|有|曾经?|长期使用|经常使用|毕业于|就读于|来自|负责过|参与过|做过|获得过?|持有)/,
  /(?:我的专业是|我是.{0,20}(?:应届生|毕业生|学生|专业)|作为.{0,20}(?:应届生|毕业生|学生))/,
  /(?:^|[，,。；;！？!?\s])(?:具备|熟悉|掌握|擅长|拥有|曾经?|长期使用|经常使用|毕业于|就读于|负责过|参与过|做过)/,
  /(?:能力|技能|经验|背景)(?:优秀|较强|丰富|扎实|突出)/,
  /(?:日常|长期|经常)(?:使用|关注|研究)/,
  /(?:我|本人)对.{0,30}有(?:深入|长期|系统|丰富).{0,12}(?:研究|经验|了解|积累)/,
  /(?:我|本人)的(?:学历|专业|能力|技能|经验|背景|成果|兴趣|项目)/,
  /(?:^|[，,。；;！？!?\s])有.{0,24}(?:经验|能力|技能|背景|项目经历|实习经历)/,
  /(?:我|本人)?对(?:AI|人工智能|大模型|智能体|Agent|agent).{0,20}(?:感兴趣|有兴趣|充满兴趣)/,
  /(?:^|[，,。；;！？!?\s])(?:热爱|喜欢).{0,30}(?:AI|人工智能|大模型|智能体|产品|技术)/,
];

const allowedSafeFirstPersonPatterns = [
  /我(?:关注到|看到|了解到).{0,80}(?:岗位|职位)/,
  /我对.{0,80}(?:岗位|职位|工作内容|岗位职责).{0,30}(?:感兴趣|有兴趣|关注)/,
  /我(?:希望|想|想要|期待).{0,80}(?:了解|沟通|请教|确认|申请|投递)/,
];

const allowedSafeClausePatterns = [
  /^(?:您好|你好|HR您好|招聘负责人您好)$/,
  /(?:关注到|看到|了解到).{0,80}(?:岗位|职位)/,
  /(?:岗位|职位|JD|职责|工作内容).{0,60}(?:感兴趣|有兴趣|关注)/,
  /(?:岗位|职位|JD|职责|工作内容).{0,60}(?:提到|包含|包括|涉及|需要|要求|重视)/,
  /(?:希望|想|期待|请问|请教|能否|可否|方便).{0,80}(?:了解|沟通|请教|确认|回复|介绍)/,
  /^感谢.{0,40}(?:阅读|时间|回复)?$/,
];

function splitGreetingClauses(value: string) {
  return value
    .split(/[，,。；;！？!?\n]/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function hasCandidateClaim(value: string) {
  return candidateClaimPatterns.some((pattern) => pattern.test(value));
}

function hasUnsupportedFirstPersonClause(value: string) {
  return splitGreetingClauses(value).some((clause) => {
    if (!/(?:我|本人)/.test(clause)) return false;
    return !allowedSafeFirstPersonPatterns.some((pattern) => pattern.test(clause));
  });
}

function hasUnsupportedSafeClause(value: string) {
  return splitGreetingClauses(value).some(
    (clause) =>
      !allowedSafeClausePatterns.some((pattern) => pattern.test(clause)),
  );
}

function hasApprovedPlaceholder(value: string) {
  return EDITABLE_GREETING_PLACEHOLDERS.some((placeholder) =>
    value.includes(placeholder),
  );
}

export function findHrGreetingBoundaryViolations(
  greeting: HrGreeting,
): HrGreetingBoundaryViolation[] {
  const violations: HrGreetingBoundaryViolation[] = [];
  const safePlaceholders = greeting.safeGreeting.match(/【[^】]+】/g) ?? [];

  if (safePlaceholders.length > 0) {
    violations.push({
      field: "safeGreeting",
      code: "PLACEHOLDER_IN_SAFE_GREETING",
    });
  }

  if (
    hasCandidateClaim(greeting.safeGreeting) ||
    hasUnsupportedSafeClause(greeting.safeGreeting)
  ) {
    violations.push({
      field: "safeGreeting",
      code: "UNSUPPORTED_CANDIDATE_CLAIM",
    });
  }

  const templatePlaceholders =
    greeting.editableGreetingTemplate.match(/【[^】]+】/g) ?? [];

  if (!hasApprovedPlaceholder(greeting.editableGreetingTemplate)) {
    violations.push({
      field: "editableGreetingTemplate",
      code: "MISSING_EDITABLE_PLACEHOLDER",
    });
  }

  if (
    templatePlaceholders.some(
      (placeholder) =>
        !EDITABLE_GREETING_PLACEHOLDERS.includes(
          placeholder as (typeof EDITABLE_GREETING_PLACEHOLDERS)[number],
        ),
    )
  ) {
    violations.push({
      field: "editableGreetingTemplate",
      code: "UNKNOWN_EDITABLE_PLACEHOLDER",
    });
  }

  const unsupportedTemplateClaim = splitGreetingClauses(
    greeting.editableGreetingTemplate,
  ).some((clause) => {
    const containsCandidateClaim =
      hasCandidateClaim(clause) || hasUnsupportedFirstPersonClause(clause);
    return containsCandidateClaim && !hasApprovedPlaceholder(clause);
  });

  if (unsupportedTemplateClaim) {
    violations.push({
      field: "editableGreetingTemplate",
      code: "UNSUPPORTED_CANDIDATE_CLAIM",
    });
  }

  return violations;
}

export const hrGreetingSchema = hrGreetingStructureSchema.superRefine(
  (value, context) => {
    for (const violation of findHrGreetingBoundaryViolations(value)) {
      context.addIssue({
        code: "custom",
        path: [violation.field],
        message: violation.code,
      });
    }
  },
);

export const jobAnalysisSchema = jobAnalysisStructureSchema.superRefine(
  (value, context) => {
    for (const violation of findHrGreetingBoundaryViolations(value.hrGreeting)) {
      context.addIssue({
        code: "custom",
        path: ["hrGreeting", violation.field],
        message: violation.code,
      });
    }

    const questions = new Set(
      value.roleProfile.questionsToConfirm.map((item) => item.question),
    );

    value.roleProfile.requirements.forEach((item, index) => {
      const evidenceText = item.evidence.join(" ");
      const path = ["roleProfile", "requirements", index];

      if (
        hasPreferredQualifier(evidenceText) &&
        item.requirementType !== "preferred_requirement"
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "requirementType"],
          message: "explicit preferred qualifier requires preferred_requirement",
        });
      }

      if (
        !hasPreferredQualifier(evidenceText) &&
        item.requirementType === "preferred_requirement"
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "requirementType"],
          message: "preferred_requirement requires an explicit preferred qualifier",
        });
      }

      if (
        !hasPreferredQualifier(evidenceText) &&
        hasHardQualifier(evidenceText) &&
        item.requirementType !== "hard_requirement"
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "requirementType"],
          message: "explicit hard qualifier requires hard_requirement",
        });
      }

      if (
        hasUnclearQualifierScope(evidenceText) &&
        item.requirementType !== "unclear"
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "requirementType"],
          message: "unclear qualifier scope requires unclear",
        });
      }

      if (item.requirementType === "unclear") {
        if (item.sourceType !== "to_verify") {
          context.addIssue({
            code: "custom",
            path: [...path, "sourceType"],
            message: "unclear requirement must be to_verify",
          });
        }
      } else if (item.sourceType !== "jd_explicit") {
        context.addIssue({
          code: "custom",
          path: [...path, "sourceType"],
          message: "classified requirement must be jd_explicit",
        });
      }

      addSourceProtocolIssues(item, path, questions, context);
    });

    value.roleProfile.workCharacteristics.forEach((item, index) =>
      addSourceProtocolIssues(
        item,
        ["roleProfile", "workCharacteristics", index],
        questions,
        context,
      ),
    );
    value.roleProfile.riskSignals.forEach((item, index) =>
      addSourceProtocolIssues(
        item,
        ["roleProfile", "riskSignals", index],
        questions,
        context,
      ),
    );
    value.applicationAdvice.reasons.forEach((item, index) =>
      addSourceProtocolIssues(
        item,
        ["applicationAdvice", "reasons", index],
        questions,
        context,
      ),
    );

    if (
      value.applicationAdvice.sourceType === "inference" &&
      !hasCautiousInferenceLanguage(value.applicationAdvice.summary)
    ) {
      context.addIssue({
        code: "custom",
        path: ["applicationAdvice", "summary"],
        message: "inference advice requires cautious wording",
      });
    }

    if (value.applicationAdvice.sourceType === "to_verify") {
      const question = value.applicationAdvice.verificationQuestion;
      if (!question || !questions.has(question)) {
        context.addIssue({
          code: "custom",
          path: ["applicationAdvice", "verificationQuestion"],
          message: "to_verify advice requires a listed verification question",
        });
      }
    } else if (value.applicationAdvice.verificationQuestion !== null) {
      context.addIssue({
        code: "custom",
        path: ["applicationAdvice", "verificationQuestion"],
        message: "inference advice cannot include a verification question",
      });
    }

    if (
      findUnsupportedGrowthClaims(
        value.applicationAdvice.summary,
        value.applicationAdvice.reasons.flatMap((item) => item.evidence),
      ).length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["applicationAdvice", "summary"],
        message: "unsupported deterministic growth claim",
      });
    }
  },
);

const rawCoreResponsibilitySchema = coreResponsibilitySchema
  .extend({ evidence: rawEvidenceSchema })
  .strict();

export const rawJobAnalysisSchema = jobAnalysisStructureSchema
  .extend({
    coreResponsibilities: z.array(rawCoreResponsibilitySchema).min(1).max(6),
    roleProfile: jobAnalysisStructureSchema.shape.roleProfile
      .extend({
        requirements: z.array(rawRequirementItemSchema).max(16),
        workCharacteristics: z.array(rawSourcedProfileItemSchema).max(6),
        riskSignals: z.array(rawSourcedProfileItemSchema).max(5),
      })
      .strict(),
    applicationAdvice: jobAnalysisStructureSchema.shape.applicationAdvice
      .extend({
        reasons: z.array(rawAdviceReasonSchema).min(1).max(3),
      })
      .strict(),
  })
  .strict();

export const finalStructureJobAnalysisSchema = jobAnalysisStructureSchema;

export const pendingAdviceJobAnalysisSchema = jobAnalysisStructureSchema
  .extend({
    applicationAdvice: jobAnalysisStructureSchema.shape.applicationAdvice
      .extend({ reasons: z.array(adviceReasonSchema).max(3) })
      .strict(),
  })
  .strict();

export const pendingCoreJobAnalysisSchema = jobAnalysisStructureSchema
  .extend({
    coreResponsibilities: z.array(rawCoreResponsibilitySchema).min(1).max(6),
    applicationAdvice: jobAnalysisStructureSchema.shape.applicationAdvice
      .extend({ reasons: z.array(adviceReasonSchema).max(3) })
      .strict(),
  })
  .strict();

export const pendingRequirementJobAnalysisSchema = jobAnalysisStructureSchema
  .extend({
    coreResponsibilities: z.array(rawCoreResponsibilitySchema).min(1).max(6),
    roleProfile: jobAnalysisStructureSchema.shape.roleProfile
      .extend({ requirements: z.array(rawRequirementItemSchema).max(16) })
      .strict(),
    applicationAdvice: jobAnalysisStructureSchema.shape.applicationAdvice
      .extend({ reasons: z.array(adviceReasonSchema).max(3) })
      .strict(),
  })
  .strict();

export const rawHrGreetingRepairSchema = z
  .object({ hrGreeting: hrGreetingStructureSchema })
  .strict();

export const hrGreetingRepairSchema = z
  .object({ hrGreeting: hrGreetingSchema })
  .strict();

function buildEvidenceRepairItemSchema(maxIndex: number, raw: boolean) {
  return z.discriminatedUnion("action", [
    z
      .object({
        index: z.number().int().min(0).max(maxIndex),
        action: z.literal("replace_evidence"),
        evidence: raw ? rawEvidenceSchema : evidenceSchema,
      })
      .strict(),
    z
      .object({
        index: z.number().int().min(0).max(maxIndex),
        action: z.literal("delete"),
      })
      .strict(),
  ]);
}

function buildEvidenceReplaceItemSchema(maxIndex: number, raw: boolean) {
  return z
    .object({
      index: z.number().int().min(0).max(maxIndex),
      action: z.literal("replace_evidence"),
      evidence: raw ? rawEvidenceSchema : evidenceSchema,
    })
    .strict();
}

function addUniqueIndexValidation<T extends { items: Array<{ index: number }> }>(
  value: T,
  context: z.RefinementCtx,
) {
  const indexes = value.items.map((item) => item.index);
  if (new Set(indexes).size !== indexes.length) {
    context.addIssue({
      code: "custom",
      path: ["items"],
      message: "repair indexes must be unique",
    });
  }
}

const rawAdviceEvidenceRepairItemSchema = buildEvidenceRepairItemSchema(2, true);
const adviceEvidenceRepairItemSchema = buildEvidenceRepairItemSchema(2, false);
const rawCoreEvidenceRepairItemSchema = buildEvidenceRepairItemSchema(5, true);
const coreEvidenceRepairItemSchema = buildEvidenceRepairItemSchema(5, false);
const rawRequirementEvidenceRepairItemSchema = buildEvidenceReplaceItemSchema(
  15,
  true,
);
const requirementEvidenceRepairItemSchema = buildEvidenceReplaceItemSchema(
  15,
  false,
);

export const rawAdviceEvidenceRepairSchema = z
  .object({ items: z.array(rawAdviceEvidenceRepairItemSchema).min(1).max(3) })
  .strict();

export const adviceEvidenceRepairSchema = z
  .object({ items: z.array(adviceEvidenceRepairItemSchema).min(1).max(3) })
  .strict()
  .superRefine(addUniqueIndexValidation);

export const rawCoreEvidenceRepairSchema = z
  .object({ items: z.array(rawCoreEvidenceRepairItemSchema).min(1).max(6) })
  .strict();

export const coreEvidenceRepairSchema = z
  .object({ items: z.array(coreEvidenceRepairItemSchema).min(1).max(6) })
  .strict()
  .superRefine(addUniqueIndexValidation);

export const rawRequirementEvidenceRepairSchema = z
  .object({ items: z.array(rawRequirementEvidenceRepairItemSchema).min(1).max(16) })
  .strict();

export const requirementEvidenceRepairSchema = z
  .object({ items: z.array(requirementEvidenceRepairItemSchema).min(1).max(16) })
  .strict()
  .superRefine(addUniqueIndexValidation);

export type AnalyzeJobRequest = z.infer<typeof analyzeJobRequestSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type RequirementType = z.infer<typeof requirementTypeSchema>;
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type RawJobAnalysis = z.infer<typeof rawJobAnalysisSchema>;
export type AdviceEvidenceRepair = z.infer<typeof adviceEvidenceRepairSchema>;
export type CoreEvidenceRepair = z.infer<typeof coreEvidenceRepairSchema>;
export type RequirementEvidenceRepair = z.infer<
  typeof requirementEvidenceRepairSchema
>;

export function isEvidenceInJd(evidence: string, jdText: string) {
  const trimmedEvidence = evidence.trim();
  return trimmedEvidence.length > 0 && jdText.includes(trimmedEvidence);
}

/**
 * ISSUE-012: returns every JD original substring whose whitespace-normalized
 * form equals the whitespace-normalized evidence. Used only to LOCATE the
 * original span; the returned strings are always verbatim JD text.
 */
export function findNormalizedEvidenceSpans(
  evidence: string,
  jdText: string,
): string[] {
  const trimmed = evidence.trim();
  const normalizedEvidence = trimmed.replace(/\s+/g, "");
  if (normalizedEvidence.length === 0) return [];

  const normalizedJd = jdText.replace(/\s+/g, "");
  const normalizedToOriginal: number[] = [];
  for (let index = 0; index < jdText.length; index += 1) {
    if (!/\s/.test(jdText[index])) {
      normalizedToOriginal.push(index);
    }
  }

  const spans: string[] = [];
  let from = 0;
  while (true) {
    const matchIndex = normalizedJd.indexOf(normalizedEvidence, from);
    if (matchIndex === -1) break;
    const start = normalizedToOriginal[matchIndex];
    const endExclusive =
      normalizedToOriginal[matchIndex + normalizedEvidence.length - 1] + 1;
    spans.push(jdText.slice(start, endExclusive));
    from = matchIndex + 1;
  }
  return spans;
}

/**
 * ISSUE-012: recovers the unique original JD span for evidence that only
 * differs from JD text by whitespace (line breaks / consecutive spaces).
 * Returns null when there is no normalized match or the match is ambiguous.
 */
export function recoverEvidenceFromJd(
  evidence: string,
  jdText: string,
): string | null {
  const spans = findNormalizedEvidenceSpans(evidence, jdText);
  return spans.length === 1 ? spans[0] : null;
}

export function findInvalidEvidence(analysis: JobAnalysis, jdText: string): string[] {
  const evidenceGroups = [
    ...analysis.coreResponsibilities.map((item) => item.evidence),
    ...analysis.roleProfile.requirements.map((item) => item.evidence),
    ...analysis.roleProfile.workCharacteristics.map((item) => item.evidence),
    ...analysis.roleProfile.riskSignals.map((item) => item.evidence),
    ...analysis.applicationAdvice.reasons.map((item) => item.evidence),
  ];

  return evidenceGroups
    .flat()
    .filter((evidence) => !isEvidenceInJd(evidence, jdText));
}
