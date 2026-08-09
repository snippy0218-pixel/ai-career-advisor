import { z } from "zod";

import {
  finalMatchCoreSchema,
  type FinalMatchCore,
} from "./match-schema";

export const RECOMMENDATION_SCHEMA_VERSION = "recommendation-core-v1" as const;
export const RECOMMENDATION_LEVELS = [
  "priority",
  "try",
  "cautious",
  "not_recommended",
] as const;

export const recommendationLevelSchema = z.enum(RECOMMENDATION_LEVELS);
export type RecommendationLevel = z.infer<typeof recommendationLevelSchema>;

const matchItemRefSchema = z.string().regex(/^MI-\d{3,}$/);

const limitationSchema = z
  .object({
    content: z.string().trim().min(1).max(300),
    matchItemRefs: z.array(matchItemRefSchema).min(1).max(8),
  })
  .strict();

const questionSchema = z
  .object({
    question: z.string().trim().min(1).max(240),
    matchItemRefs: z.array(matchItemRefSchema).min(1).max(8),
  })
  .strict();

export const recommendationCoreRequestSchema = z
  .object({ matchCore: finalMatchCoreSchema })
  .strict();

export const rawRecommendationSchema = z
  .object({
    recommendationLevel: recommendationLevelSchema,
    summary: z.string().trim().min(1).max(500),
    supportingMatchRefs: z.array(matchItemRefSchema).max(16),
    counterMatchRefs: z.array(matchItemRefSchema).max(16),
    limitations: z.array(limitationSchema).max(16),
    questionsToConfirm: z.array(questionSchema).max(16),
  })
  .strict();

export const finalRecommendationSchema = rawRecommendationSchema
  .extend({
    schemaVersion: z.literal(RECOMMENDATION_SCHEMA_VERSION),
    matchSchemaVersion: z.literal("match-core-v1"),
    allowedRecommendationLevels: z.array(recommendationLevelSchema).min(1).max(4),
  })
  .strict();

export type RecommendationCoreRequest = z.infer<
  typeof recommendationCoreRequestSchema
>;
export type RawRecommendation = z.infer<typeof rawRecommendationSchema>;
export type FinalRecommendation = z.infer<typeof finalRecommendationSchema>;

export interface RecommendationMatchLedgerItem {
  matchItemRef: string;
  requirementId: string;
  requirementType: FinalMatchCore["matchItems"][number]["requirementType"];
  status: FinalMatchCore["matchItems"][number]["status"];
  requirement: string;
  jdEvidence: string[];
  dimensions: FinalMatchCore["matchItems"][number]["requirementDimensions"];
}

export interface RecommendationValidationIssue {
  path: string;
  message: string;
}

export function buildRecommendationMatchLedger(
  matchCore: FinalMatchCore,
): RecommendationMatchLedgerItem[] {
  return matchCore.matchItems.map((item, index) => ({
    matchItemRef: `MI-${String(index + 1).padStart(3, "0")}`,
    requirementId: item.requirementId,
    requirementType: item.requirementType,
    status: item.status,
    requirement: item.requirement,
    jdEvidence: [...item.jdEvidence],
    dimensions: item.requirementDimensions.map((dimension) => ({
      ...dimension,
      jdEvidence: [...dimension.jdEvidence],
      candidateFactRefs: [...dimension.candidateFactRefs],
      pfEvidence: [...dimension.pfEvidence],
    })),
  }));
}

function isPreferred(item: RecommendationMatchLedgerItem) {
  return item.requirementType === "preferred_requirement";
}

function hasDimensionStatus(
  item: RecommendationMatchLedgerItem,
  status: "met" | "partial" | "unmet" | "unknown",
) {
  return item.status === status || item.dimensions.some((entry) => entry.status === status);
}

function hasExplicitCounterEvidence(item: RecommendationMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      dimension.status === "unmet" &&
      dimension.candidateEvidenceRole === "counter" &&
      dimension.candidateFactRefs.length > 0 &&
      dimension.pfEvidence.length > 0 &&
      dimension.jdEvidence.length > 0,
  );
}

function hasPositiveEvidence(item: RecommendationMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      (dimension.status === "met" || dimension.status === "partial") &&
      dimension.candidateEvidenceRole === "positive" &&
      dimension.candidateFactRefs.length > 0 &&
      dimension.pfEvidence.length > 0,
  );
}

function hasCareerDirectionConflict(item: RecommendationMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      dimension.dimensionType === "career_direction" &&
      dimension.status === "unmet" &&
      dimension.candidateEvidenceRole === "counter",
  );
}

export type RequirementFlexibilityKind =
  | "waiver"
  | "alternative_qualification"
  | null;

const EXPLICIT_ALTERNATIVE_QUALIFICATION_PATTERN =
  /(?:(?:学历|本科|学位|资格|证书).{0,24}(?:或|或者).{0,36}(?:经验|能力|资历)|(?:经验|能力|资历).{0,16}(?:可|可以)替代(?:学历|学位|年限|资格|证书)|related experience may replace education)/i;
const EXPLICIT_WAIVER_EVIDENCE_PATTERN =
  /(?:可(?:适当)?放宽|条件优秀.{0,12}(?:可)?放宽|优秀者.{0,10}(?:不限|可不受)|特别优秀.{0,12}(?:可)?不受.{0,12}限制|同等能力者可考虑|能力突出.{0,12}(?:可)?放宽|may be waived|waiver available)/i;

export const WAIVER_CLAIM_PATTERN =
  /(?:豁免|放宽|例外|弹性|灵活(?:处理|调整)|具有灵活性|酌情|特殊政策|可不受|可以不受|要求.{0,8}不严格|may be waived|waiver|exception|relaxation|flexibility|flexible)/i;
export const SUBSTITUTION_CLAIM_PATTERN =
  /(?:替代条件|替代资格|可替代|(?:能力|经验|项目).{0,16}(?:弥补|抵消|折算|替代)(?:学历|学位|年限|资格|证书)?|(?:是否接受|能否接受).{0,16}(?:其他|同等|等效).{0,8}(?:学历|学位|资格))/i;
const UNKNOWN_TO_UNMET_PATTERN =
  /(?:未满足|不满足|不符合|未达到|未达标|无法满足|资格不符)/;
const HARD_UNMET_ADMISSION_PATTERN =
  /(?:未满足|不满足|不符合|未达到|未达标|存在.{0,8}(?:冲突|反证)|硬性.{0,8}(?:冲突|缺口|反证))/;
const REQUIREMENT_STRICTNESS_PATTERN =
  /(?:(?:确认|核实|了解).{0,24}(?:是否为|是否属于|是不是|是否构成|具体).{0,16}(?:严格|硬性|筛选|门槛|要求口径|条件口径)|(?:要求|条件|门槛).{0,12}(?:严格性|是否严格|口径))/;
const CANDIDATE_INFORMATION_PATTERN =
  /(?:请|需|需要).{0,12}(?:补充|确认|核实).{0,36}(?:候选人|本人|你的|学历|学位|资格|证书|经验|年限|技能|经历|事实|信息|具体情况)/;

export function classifyRequirementFlexibility(
  item: RecommendationMatchLedgerItem,
): RequirementFlexibilityKind {
  const source = `${item.requirement} ${item.jdEvidence.join(" ")}`;
  if (EXPLICIT_ALTERNATIVE_QUALIFICATION_PATTERN.test(source)) {
    return "alternative_qualification";
  }
  if (EXPLICIT_WAIVER_EVIDENCE_PATTERN.test(source)) return "waiver";
  return null;
}

function hasWaiverLanguage(item: RecommendationMatchLedgerItem) {
  return classifyRequirementFlexibility(item) === "waiver";
}

/**
 * This layer only determines which decisions are legal. It deliberately does
 * not use counts to decide which legal level is best.
 */
export function computeAllowedRecommendationLevels(
  matchCore: FinalMatchCore,
): RecommendationLevel[] {
  const ledger = buildRecommendationMatchLedger(matchCore);
  const substantive = ledger.filter((item) => !isPreferred(item));
  const hardUnmet = substantive.filter(
    (item) =>
      item.requirementType === "hard_requirement" &&
      hasDimensionStatus(item, "unmet"),
  );
  const otherNegative = substantive.some(
    (item) =>
      (item.requirementType === "core_requirement" ||
        item.requirementType === "unclear" ||
        hasCareerDirectionConflict(item)) &&
      hasDimensionStatus(item, "unmet") &&
      hasExplicitCounterEvidence(item),
  );

  if (hardUnmet.length > 0) {
    if (hardUnmet.every(hasWaiverLanguage)) return ["cautious"];
    return ["cautious", "not_recommended"];
  }
  if (otherNegative) return ["cautious", "not_recommended"];

  const hasCorePositive = substantive.some(
    (item) =>
      (item.requirementType === "hard_requirement" ||
        item.requirementType === "core_requirement") &&
      hasPositiveEvidence(item),
  );
  const hasCriticalUncertainty = substantive.some(
    (item) =>
      item.requirementType === "unclear" ||
      hasDimensionStatus(item, "unknown") ||
      hasDimensionStatus(item, "partial"),
  );
  if (hasCriticalUncertainty) {
    return hasCorePositive ? ["try", "cautious"] : ["cautious"];
  }

  return hasCorePositive ? ["priority", "try"] : ["try", "cautious"];
}

export function buildRecommendationDeterministicConstraints(
  matchCore: FinalMatchCore,
) {
  const ledger = buildRecommendationMatchLedger(matchCore);
  return {
    allowedRecommendationLevels: computeAllowedRecommendationLevels(matchCore),
    eligibleSupportingMatchRefs: ledger
      .filter(hasPositiveEvidence)
      .map((item) => item.matchItemRef),
    eligibleCounterMatchRefs: ledger
      .filter((item) => !isPreferred(item) && hasExplicitCounterEvidence(item))
      .map((item) => item.matchItemRef),
    requiredUnknownMatchRefs: ledger
      .filter((item) => !isPreferred(item) && hasDimensionStatus(item, "unknown"))
      .map((item) => item.matchItemRef),
    hardUnknownMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType === "hard_requirement" &&
          hasDimensionStatus(item, "unknown"),
      )
      .map((item) => item.matchItemRef),
    hardUnmetMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType === "hard_requirement" &&
          hasDimensionStatus(item, "unmet"),
      )
      .map((item) => item.matchItemRef),
    waiverEligibleMatchRefs: ledger
      .filter((item) => classifyRequirementFlexibility(item) === "waiver")
      .map((item) => item.matchItemRef),
    alternativeQualificationMatchRefs: ledger
      .filter(
        (item) =>
          classifyRequirementFlexibility(item) === "alternative_qualification",
      )
      .map((item) => item.matchItemRef),
  };
}

function addIssue(
  issues: RecommendationValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  return values.find((value) => (seen.has(value) ? true : !seen.add(value)));
}

function allReferencedMatchRefs(raw: RawRecommendation) {
  return [
    ...raw.supportingMatchRefs,
    ...raw.counterMatchRefs,
    ...raw.limitations.flatMap((entry) => entry.matchItemRefs),
    ...raw.questionsToConfirm.flatMap((entry) => entry.matchItemRefs),
  ];
}

function textClaimsContradictStatus(
  raw: RawRecommendation,
  item: RecommendationMatchLedgerItem,
) {
  const fragments = [
    raw.summary,
    ...raw.limitations.map((entry) => entry.content),
    ...raw.questionsToConfirm.map((entry) => entry.question),
  ]
    .flatMap((text) => text.split(/[，。；;！？!?\n]/))
    .filter(
      (text) =>
        text.includes(item.matchItemRef) || text.includes(item.requirement),
    );
  const unknownPattern = /(?:未知|不明确|待确认|需要确认|尚未提供|无法确认|信息不足)/;
  const positivePattern = /(?:完全满足|(?:已经|已)满足(?!部分)|明确符合|充分符合)/;
  const negativePattern = /(?:明确不满足|完全不符合|无法满足)/;
  return fragments.some((text) => {
    if (unknownPattern.test(text)) return item.status === "met";
    if (positivePattern.test(text)) return item.status !== "met";
    if (negativePattern.test(text)) return item.status !== "unmet";
    return false;
  });
}

const UNGROUNDED_CANDIDATE_FACT_PATTERN =
  /候选人.{0,20}(?:拥有|具备|掌握|熟悉|从事|毕业于|获得了?|持有)/;

function containsUngroundedCandidateFact(text: string) {
  if (!UNGROUNDED_CANDIDATE_FACT_PATTERN.test(text)) return false;
  if (/(?:是否|请确认|无法确认|不能确认|尚未确认|待确认|未知|未提供)/.test(text)) {
    return false;
  }
  if (/(?:匹配证据|正向证据|反证)/.test(text)) return false;
  return true;
}

export interface WaiverEvidenceIntegrityResult {
  issues: RecommendationValidationIssue[];
  unsupportedWaiverClaimCount: number;
  unknownToUnmetDriftCount: number;
  fabricatedFlexibilityClaimCount: number;
}

function inferredSummaryRefs(
  summary: string,
  ledger: RecommendationMatchLedgerItem[],
) {
  return ledger
    .filter(
      (item) =>
        summary.includes(item.matchItemRef) || summary.includes(item.requirement),
    )
    .map((item) => item.matchItemRef);
}

function isCandidateInformationQuestion(question: string) {
  return (
    CANDIDATE_INFORMATION_PATTERN.test(question) &&
    !/(?:HR|招聘方)/i.test(question) &&
    !REQUIREMENT_STRICTNESS_PATTERN.test(question) &&
    !WAIVER_CLAIM_PATTERN.test(question) &&
    !SUBSTITUTION_CLAIM_PATTERN.test(question)
  );
}

/** R-K: waiver/flexibility claims must trace to explicit JD evidence. */
export function inspectWaiverEvidenceIntegrity(
  raw: RawRecommendation,
  matchCore: FinalMatchCore,
): WaiverEvidenceIntegrityResult {
  const issues: RecommendationValidationIssue[] = [];
  const ledger = buildRecommendationMatchLedger(matchCore);
  const waiverRefs = new Set(
    ledger
      .filter((item) => classifyRequirementFlexibility(item) === "waiver")
      .map((item) => item.matchItemRef),
  );
  const alternativeRefs = new Set(
    ledger
      .filter(
        (item) =>
          classifyRequirementFlexibility(item) === "alternative_qualification",
      )
      .map((item) => item.matchItemRef),
  );
  const textEntries = [
    {
      path: "summary",
      text: raw.summary,
      refs: inferredSummaryRefs(raw.summary, ledger),
    },
    ...raw.limitations.map((entry, index) => ({
      path: `limitations.${index}.content`,
      text: entry.content,
      refs: entry.matchItemRefs,
    })),
    ...raw.questionsToConfirm.map((entry, index) => ({
      path: `questionsToConfirm.${index}.question`,
      text: entry.question,
      refs: entry.matchItemRefs,
    })),
  ];
  let unsupportedWaiverClaimCount = 0;
  let fabricatedFlexibilityClaimCount = 0;
  let unknownToUnmetDriftCount = 0;

  for (const entry of textEntries) {
    if (WAIVER_CLAIM_PATTERN.test(entry.text)) {
      const supported =
        entry.refs.length > 0 && entry.refs.every((ref) => waiverRefs.has(ref));
      if (!supported) {
        unsupportedWaiverClaimCount += 1;
        fabricatedFlexibilityClaimCount += 1;
        addIssue(
          issues,
          entry.path,
          "R-K unsupported waiver/flexibility claim has no explicit JD waiver reference",
        );
      }
    }
    if (SUBSTITUTION_CLAIM_PATTERN.test(entry.text)) {
      const supported =
        entry.refs.length > 0 &&
        entry.refs.every((ref) => alternativeRefs.has(ref));
      if (!supported) {
        fabricatedFlexibilityClaimCount += 1;
        addIssue(
          issues,
          entry.path,
          "R-K unsupported substitution claim has no explicit JD alternative qualification",
        );
      }
    }
  }

  const hardUnknown = ledger.filter(
    (item) =>
      item.requirementType === "hard_requirement" &&
      hasDimensionStatus(item, "unknown"),
  );
  for (const item of hardUnknown) {
    const candidateQuestion = raw.questionsToConfirm.some(
      (entry) =>
        entry.matchItemRefs.includes(item.matchItemRef) &&
        isCandidateInformationQuestion(entry.question),
    );
    if (!candidateQuestion) {
      addIssue(
        issues,
        "questionsToConfirm",
        `R-K ${item.matchItemRef} hard unknown requires a Candidate-information question`,
      );
    }
    for (const entry of textEntries.filter((entry) =>
      entry.refs.includes(item.matchItemRef),
    )) {
      if (UNKNOWN_TO_UNMET_PATTERN.test(entry.text)) {
        unknownToUnmetDriftCount += 1;
        addIssue(
          issues,
          entry.path,
          `R-K ${item.matchItemRef} unknown must not drift to unmet`,
        );
      }
    }
  }

  const hardUnmetWithoutWaiver = ledger.filter(
    (item) =>
      item.requirementType === "hard_requirement" &&
      hasDimensionStatus(item, "unmet") &&
      !waiverRefs.has(item.matchItemRef),
  );
  if (raw.recommendationLevel === "cautious") {
    for (const item of hardUnmetWithoutWaiver) {
      const admitsUnmet = raw.limitations.some(
        (entry) =>
          entry.matchItemRefs.includes(item.matchItemRef) &&
          HARD_UNMET_ADMISSION_PATTERN.test(entry.content),
      );
      if (!admitsUnmet) {
        addIssue(
          issues,
          "limitations",
          `R-K ${item.matchItemRef} cautious hard unmet must explicitly admit the unmet requirement`,
        );
      }
      const asksStrictness = raw.questionsToConfirm.some(
        (entry) =>
          entry.matchItemRefs.includes(item.matchItemRef) &&
          REQUIREMENT_STRICTNESS_PATTERN.test(entry.question) &&
          !WAIVER_CLAIM_PATTERN.test(entry.question),
      );
      if (!asksStrictness) {
        addIssue(
          issues,
          "questionsToConfirm",
          `R-K ${item.matchItemRef} cautious hard unmet without waiver evidence requires strictness confirmation, not waiver inference`,
        );
      }
    }
  }

  return {
    issues,
    unsupportedWaiverClaimCount,
    unknownToUnmetDriftCount,
    fabricatedFlexibilityClaimCount,
  };
}

export function finalizeRawRecommendation(
  raw: RawRecommendation,
  matchCore: FinalMatchCore,
): { data: FinalRecommendation | null; issues: RecommendationValidationIssue[] } {
  const issues: RecommendationValidationIssue[] = [];
  const ledger = buildRecommendationMatchLedger(matchCore);
  const byRef = new Map(ledger.map((item) => [item.matchItemRef, item]));
  const allowedRecommendationLevels = computeAllowedRecommendationLevels(matchCore);

  if (!allowedRecommendationLevels.includes(raw.recommendationLevel)) {
    addIssue(
      issues,
      "recommendationLevel",
      `recommendationLevel must be one of ${allowedRecommendationLevels.join(", ")}`,
    );
  }

  for (const [path, refs] of [
    ["supportingMatchRefs", raw.supportingMatchRefs],
    ["counterMatchRefs", raw.counterMatchRefs],
  ] as const) {
    const duplicate = findDuplicate(refs);
    if (duplicate) addIssue(issues, path, `duplicate match reference ${duplicate}`);
  }
  raw.limitations.forEach((entry, index) => {
    const duplicate = findDuplicate(entry.matchItemRefs);
    if (duplicate) {
      addIssue(issues, `limitations.${index}.matchItemRefs`, `duplicate match reference ${duplicate}`);
    }
  });
  raw.questionsToConfirm.forEach((entry, index) => {
    const duplicate = findDuplicate(entry.matchItemRefs);
    if (duplicate) {
      addIssue(issues, `questionsToConfirm.${index}.matchItemRefs`, `duplicate match reference ${duplicate}`);
    }
  });

  for (const ref of allReferencedMatchRefs(raw)) {
    if (!byRef.has(ref)) addIssue(issues, "matchItemRefs", `unknown match reference ${ref}`);
  }

  for (const ref of raw.supportingMatchRefs) {
    const item = byRef.get(ref);
    if (item && !hasPositiveEvidence(item)) {
      addIssue(issues, "supportingMatchRefs", `${ref} has no positive Match Core evidence`);
    }
  }
  for (const ref of raw.counterMatchRefs) {
    const item = byRef.get(ref);
    if (item && (isPreferred(item) || !hasExplicitCounterEvidence(item))) {
      addIssue(
        issues,
        "counterMatchRefs",
        `${ref} is not a Contract-eligible negative basis`,
      );
    }
  }

  if (
    (raw.recommendationLevel === "priority" || raw.recommendationLevel === "try") &&
    raw.supportingMatchRefs.length === 0
  ) {
    addIssue(issues, "supportingMatchRefs", `${raw.recommendationLevel} requires positive Match Core evidence`);
  }
  if (
    raw.recommendationLevel === "not_recommended" &&
    raw.counterMatchRefs.length === 0
  ) {
    addIssue(issues, "counterMatchRefs", "not_recommended requires explicit counter evidence");
  }

  const unknownRefs = ledger
    .filter((item) => !isPreferred(item) && hasDimensionStatus(item, "unknown"))
    .map((item) => item.matchItemRef);
  const preservedRefs = new Set([
    ...raw.limitations.flatMap((entry) => entry.matchItemRefs),
    ...raw.questionsToConfirm.flatMap((entry) => entry.matchItemRefs),
  ]);
  for (const ref of unknownRefs) {
    if (!preservedRefs.has(ref)) {
      addIssue(issues, "limitations", `${ref} critical/core unknown must be preserved`);
    }
  }

  const hardUnknownRefs = ledger
    .filter(
      (item) =>
        item.requirementType === "hard_requirement" &&
        hasDimensionStatus(item, "unknown"),
    )
    .map((item) => item.matchItemRef);
  const questionRefs = new Set(
    raw.questionsToConfirm.flatMap((entry) => entry.matchItemRefs),
  );
  for (const ref of hardUnknownRefs) {
    if (!questionRefs.has(ref)) {
      addIssue(issues, "questionsToConfirm", `${ref} hard unknown requires a verification question`);
    }
  }

  const hardUnmetRefs = ledger
    .filter(
      (item) =>
        item.requirementType === "hard_requirement" &&
        hasDimensionStatus(item, "unmet"),
    )
    .map((item) => item.matchItemRef);
  if (raw.recommendationLevel === "cautious" && hardUnmetRefs.length > 0) {
    const limitationRefs = new Set(
      raw.limitations.flatMap((entry) => entry.matchItemRefs),
    );
    for (const ref of hardUnmetRefs) {
      if (!raw.counterMatchRefs.includes(ref)) {
        addIssue(issues, "counterMatchRefs", `${ref} hard unmet must be explicit`);
      }
      if (!limitationRefs.has(ref)) {
        addIssue(issues, "limitations", `${ref} hard gap requires an explanation`);
      }
      if (!questionRefs.has(ref)) {
        addIssue(issues, "questionsToConfirm", `${ref} hard gap requires HR confirmation`);
      }
    }
  }

  const waiverIntegrity = inspectWaiverEvidenceIntegrity(raw, matchCore);
  issues.push(...waiverIntegrity.issues);

  for (const item of ledger) {
    if (textClaimsContradictStatus(raw, item)) {
      addIssue(issues, "summary", `${item.matchItemRef} text contradicts Match Core status`);
    }
  }

  const freeTexts = [
    raw.summary,
    ...raw.limitations.map((entry) => entry.content),
    ...raw.questionsToConfirm.map((entry) => entry.question),
  ];
  if (freeTexts.some(containsUngroundedCandidateFact)) {
    addIssue(
      issues,
      "summary",
      "Recommendation must reference Match Items instead of creating Candidate facts",
    );
  }

  if (issues.length > 0) return { data: null, issues };
  const parsed = finalRecommendationSchema.safeParse({
    schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
    matchSchemaVersion: matchCore.schemaVersion,
    allowedRecommendationLevels,
    ...raw,
  });
  if (!parsed.success) {
    return {
      data: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { data: parsed.data, issues: [] };
}
