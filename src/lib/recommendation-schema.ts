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

function hasWaiverLanguage(item: RecommendationMatchLedgerItem) {
  return /(?:可放宽|条件优秀.{0,8}放宽|酌情|豁免|可商议|可协商)/.test(
    `${item.requirement} ${item.jdEvidence.join(" ")}`,
  );
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

  const hasCriticalUncertainty = substantive.some(
    (item) =>
      item.requirementType === "unclear" ||
      hasDimensionStatus(item, "unknown") ||
      hasDimensionStatus(item, "partial"),
  );
  if (hasCriticalUncertainty) return ["try", "cautious"];

  const hasCorePositive = substantive.some(
    (item) =>
      (item.requirementType === "hard_requirement" ||
        item.requirementType === "core_requirement") &&
      hasPositiveEvidence(item),
  );
  return hasCorePositive ? ["priority", "try"] : ["try", "cautious"];
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
  const texts = [
    raw.summary,
    ...raw.limitations.map((entry) => entry.content),
    ...raw.questionsToConfirm.map((entry) => entry.question),
  ].filter(
    (text) => text.includes(item.matchItemRef) || text.includes(item.requirement),
  );
  const unknownPattern = /(?:未知|不明确|待确认|需要确认|尚未提供|无法确认|信息不足)/;
  const positivePattern = /(?:完全满足|已经满足|已满足|明确符合|充分符合)/;
  const negativePattern = /(?:明确不满足|未满足|不符合|无法满足)/;
  return texts.some((text) => {
    if (unknownPattern.test(text)) return item.status === "met";
    if (positivePattern.test(text)) return item.status !== "met";
    if (negativePattern.test(text)) return item.status !== "unmet";
    return false;
  });
}

const UNGROUNDED_CANDIDATE_FACT_PATTERN =
  /候选人.{0,20}(?:拥有|具备|掌握|熟悉|从事|毕业于|获得了?|持有)(?!.{0,18}(?:证据|匹配|信息))/;

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
    const hardGapText = raw.limitations
      .filter((entry) => entry.matchItemRefs.some((ref) => hardUnmetRefs.includes(ref)))
      .map((entry) => entry.content)
      .join(" ");
    if (!/(?:HR|招聘方|豁免|放宽|口径|确认)/i.test(hardGapText)) {
      addIssue(issues, "limitations", "cautious hard gap must explain the waiver/HR-confirmation basis");
    }
  }

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
  if (freeTexts.some((text) => UNGROUNDED_CANDIDATE_FACT_PATTERN.test(text))) {
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
