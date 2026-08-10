import { z } from "zod";

import { finalMatchCoreSchema, type FinalMatchCore } from "./match-schema";

export const STRENGTH_GAP_SCHEMA_VERSION = "strength-gap-core-v1" as const;

export const STRENGTH_TYPES = [
  "direct_match",
  "transferable_strength",
  "supporting_strength",
] as const;
export const GAP_TYPES = [
  "hard_constraint",
  "evidence_expression",
  "learnable_skill",
  "information",
] as const;
export const GAP_ACTION_TYPES = [
  "confirm",
  "evidence",
  "learn",
  "structural",
] as const;

export const strengthTypeSchema = z.enum(STRENGTH_TYPES);
export const gapTypeSchema = z.enum(GAP_TYPES);
export const gapActionTypeSchema = z.enum(GAP_ACTION_TYPES);

const matchRefSchema = z.string().regex(/^MI-\d{3,}$/);
const rawStrengthSchema = z
  .object({
    type: strengthTypeSchema,
    statement: z.string().trim().min(1).max(400),
    matchRefs: z.array(matchRefSchema).min(1).max(4),
  })
  .strict();
const rawGapSchema = z
  .object({
    type: gapTypeSchema,
    statement: z.string().trim().min(1).max(400),
    matchRefs: z.array(matchRefSchema).min(1).max(4),
    suggestedAction: z.string().trim().min(1).max(400),
    actionType: gapActionTypeSchema,
  })
  .strict();

export const strengthGapCoreRequestSchema = z
  .object({ matchCore: finalMatchCoreSchema })
  .strict();
export const rawStrengthGapSchema = z
  .object({
    strengths: z.array(rawStrengthSchema).max(16),
    gaps: z.array(rawGapSchema).max(16),
  })
  .strict();

export const finalStrengthGapSchema = z
  .object({
    schemaVersion: z.literal(STRENGTH_GAP_SCHEMA_VERSION),
    matchSchemaVersion: z.literal("match-core-v1"),
    strengths: z
      .array(
        rawStrengthSchema
          .extend({ strengthId: z.string().regex(/^ST-\d{3,}$/) })
          .strict(),
      )
      .max(16),
    gaps: z
      .array(
        rawGapSchema.extend({ gapId: z.string().regex(/^GP-\d{3,}$/) }).strict(),
      )
      .max(16),
  })
  .strict();

export type StrengthGapCoreRequest = z.infer<typeof strengthGapCoreRequestSchema>;
export type RawStrengthGap = z.infer<typeof rawStrengthGapSchema>;
export type FinalStrengthGap = z.infer<typeof finalStrengthGapSchema>;
export type StrengthType = z.infer<typeof strengthTypeSchema>;
export type GapType = z.infer<typeof gapTypeSchema>;
export type GapActionType = z.infer<typeof gapActionTypeSchema>;

export interface StrengthGapValidationIssue {
  path: string;
  message: string;
}

export interface StrengthGapMatchLedgerItem {
  matchItemRef: string;
  requirementId: string;
  requirementType: FinalMatchCore["matchItems"][number]["requirementType"];
  status: FinalMatchCore["matchItems"][number]["status"];
  requirement: string;
  jdEvidence: string[];
  dimensions: FinalMatchCore["matchItems"][number]["requirementDimensions"];
}

export function buildStrengthGapMatchLedger(
  matchCore: FinalMatchCore,
): StrengthGapMatchLedgerItem[] {
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

function hasDimensionStatus(
  item: StrengthGapMatchLedgerItem,
  status: "met" | "partial" | "unmet" | "unknown",
) {
  return item.status === status || item.dimensions.some((entry) => entry.status === status);
}

function hasPositiveEvidence(item: StrengthGapMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      (dimension.status === "met" || dimension.status === "partial") &&
      dimension.candidateEvidenceRole === "positive" &&
      dimension.candidateFactRefs.length > 0 &&
      dimension.pfEvidence.length > 0 &&
      dimension.jdEvidence.length > 0,
  );
}

function hasExplicitCounterEvidence(item: StrengthGapMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      dimension.status === "unmet" &&
      dimension.candidateEvidenceRole === "counter" &&
      dimension.candidateFactRefs.length > 0 &&
      dimension.pfEvidence.length > 0 &&
      dimension.jdEvidence.length > 0,
  );
}

function hasLearnableSkillEvidence(item: StrengthGapMatchLedgerItem) {
  return item.dimensions.some(
    (dimension) =>
      ["skill", "proficiency", "domain"].includes(dimension.dimensionType) &&
      (dimension.status === "partial" || dimension.status === "unmet") &&
      dimension.candidateEvidenceRole !== null &&
      dimension.candidateFactRefs.length > 0 &&
      dimension.pfEvidence.length > 0,
  );
}

export function buildStrengthGapDeterministicConstraints(
  matchCore: FinalMatchCore,
) {
  const ledger = buildStrengthGapMatchLedger(matchCore);
  return {
    directStrengthMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType !== "preferred_requirement" &&
          item.status === "met" &&
          hasPositiveEvidence(item),
      )
      .map((item) => item.matchItemRef),
    transferableStrengthMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType !== "preferred_requirement" &&
          item.status === "partial" &&
          hasPositiveEvidence(item),
      )
      .map((item) => item.matchItemRef),
    supportingStrengthMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType === "preferred_requirement" &&
          item.status === "met" &&
          hasPositiveEvidence(item),
      )
      .map((item) => item.matchItemRef),
    hardConstraintGapMatchRefs: ledger
      .filter(
        (item) =>
          item.requirementType === "hard_requirement" &&
          item.status === "unmet" &&
          hasExplicitCounterEvidence(item),
      )
      .map((item) => item.matchItemRef),
    informationGapMatchRefs: ledger
      .filter((item) => hasDimensionStatus(item, "unknown"))
      .map((item) => item.matchItemRef),
    evidenceExpressionGapMatchRefs: ledger
      .filter((item) => item.status === "partial" && hasPositiveEvidence(item))
      .map((item) => item.matchItemRef),
    learnableSkillGapMatchRefs: ledger
      .filter(hasLearnableSkillEvidence)
      .map((item) => item.matchItemRef),
  };
}

function addIssue(
  issues: StrengthGapValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  return values.find((value) => (seen.has(value) ? true : !seen.add(value)));
}

const TRANSFERABLE_LANGUAGE_PATTERN = /(?:可迁移|迁移价值|一定相关|部分支持|具有相关性)/;
const EVIDENCE_BOUNDARY_PATTERN =
  /(?:现有|当前).{0,16}(?:证据|经历).{0,20}(?:尚不足|不足以|只能证明|仅能证明|部分证明|未能完整证明)/;
const UNKNOWN_DEFICIENCY_PATTERN =
  /(?:(?:你|候选人).{0,16}(?:缺少|不会|不具备|未掌握|能力不足|经验不足)|(?:需要|应当|应该).{0,8}(?:学习|补强|提升|掌握))/;
const FORBIDDEN_ADVICE_PATTERN =
  /(?:编造|虚构|伪造|夸大|包装成|自动改写|面试建议|打招呼|多岗位|自动投递)/;
const TIME_PROMISE_PATTERN =
  /(?:\d+|[一二三四五六七八九十]+)\s*(?:天|周|星期|个月).{0,12}(?:学会|掌握|补齐|达到|胜任)/;
const STRONG_CANDIDATE_CLAIM_PATTERN =
  /(?:精通|成熟的|丰富的|深厚的|资深|专家级|独立主导|独立负责|全职经验|正式工作经验)/;
const INSTRUCTION_TEXT_PATTERN =
  /忽略.{0,16}(?:规则|提示|之前|以上)|声称.{0,20}(?:经验|技能|能力)|虚构|编造/i;

const SCOPE_RULES = [
  { source: /课程/, output: /课程/ },
  { source: /校园/, output: /校园/ },
  { source: /团队/, output: /团队/ },
  { source: /协助/, output: /协助/ },
  { source: /参与/, output: /参与/ },
  { source: /了解/, output: /(?:了解|基础)/ },
  { source: /接触/, output: /接触/ },
] as const;

function positiveCandidateSource(item: StrengthGapMatchLedgerItem) {
  return item.dimensions
    .filter((dimension) => dimension.candidateEvidenceRole === "positive")
    .map((dimension) => dimension.reason)
    .join(" ");
}

function addStrengthTruthfulnessIssues(
  statement: string,
  items: StrengthGapMatchLedgerItem[],
  path: string,
  issues: StrengthGapValidationIssue[],
) {
  const source = items.map(positiveCandidateSource).join(" ");
  if (STRONG_CANDIDATE_CLAIM_PATTERN.test(statement)) {
    const strongClaims = statement.match(
      /精通|成熟的|丰富的|深厚的|资深|专家级|独立主导|独立负责|全职经验|正式工作经验/g,
    ) ?? [];
    if (strongClaims.some((claim) => !source.includes(claim))) {
      addIssue(issues, path, "SG-B Candidate claim upgrade is not present in positive Match evidence");
    }
  }
  for (const rule of SCOPE_RULES) {
    if (rule.source.test(source) && !rule.output.test(statement)) {
      addIssue(issues, path, "SG-B Candidate scope/modifier from Match evidence must be preserved");
      break;
    }
  }
  const outputNumbers = statement.match(/\d+(?:\.\d+)?/g) ?? [];
  if (outputNumbers.some((number) => !source.includes(number))) {
    addIssue(issues, path, "SG-B Candidate numeric claim is not present in positive Match evidence");
  }
}

function sameEntryKey(type: string, refs: string[]) {
  return `${type}:${[...refs].sort().join(",")}`;
}

export function finalizeRawStrengthGap(
  raw: RawStrengthGap,
  matchCore: FinalMatchCore,
): { data: FinalStrengthGap | null; issues: StrengthGapValidationIssue[] } {
  const issues: StrengthGapValidationIssue[] = [];
  const ledger = buildStrengthGapMatchLedger(matchCore);
  const byRef = new Map(ledger.map((item) => [item.matchItemRef, item]));
  const constraints = buildStrengthGapDeterministicConstraints(matchCore);
  const strengthKeys = raw.strengths.map((entry) =>
    sameEntryKey(entry.type, entry.matchRefs),
  );
  const gapKeys = raw.gaps.map((entry) => sameEntryKey(entry.type, entry.matchRefs));
  if (new Set(strengthKeys).size !== strengthKeys.length) {
    addIssue(issues, "strengths", "duplicate Strength type/reference entry");
  }
  if (new Set(gapKeys).size !== gapKeys.length) {
    addIssue(issues, "gaps", "duplicate Gap type/reference entry");
  }

  raw.strengths.forEach((entry, index) => {
    const path = `strengths.${index}`;
    const duplicate = findDuplicate(entry.matchRefs);
    if (duplicate) addIssue(issues, `${path}.matchRefs`, `duplicate match reference ${duplicate}`);
    const items = entry.matchRefs
      .map((ref) => byRef.get(ref))
      .filter((item): item is StrengthGapMatchLedgerItem => item !== undefined);
    if (items.length !== entry.matchRefs.length) {
      addIssue(issues, `${path}.matchRefs`, "SG-I unknown Match reference");
      return;
    }
    if (
      entry.type === "direct_match" &&
      !items.every(
        (item) =>
          item.requirementType !== "preferred_requirement" &&
          item.status === "met" &&
          hasPositiveEvidence(item),
      )
    ) {
      addIssue(issues, path, "SG-C direct_match requires met non-preferred Match evidence");
    }
    if (
      entry.type === "transferable_strength" &&
      (!items.every(
        (item) =>
          item.requirementType !== "preferred_requirement" &&
          item.status === "partial" &&
          hasPositiveEvidence(item),
      ) ||
        !TRANSFERABLE_LANGUAGE_PATTERN.test(entry.statement) ||
        STRONG_CANDIDATE_CLAIM_PATTERN.test(entry.statement))
    ) {
      addIssue(issues, path, "SG-D transferable strength must remain partial and explicitly limited");
    }
    if (
      entry.type === "supporting_strength" &&
      !items.every(
        (item) =>
          item.requirementType === "preferred_requirement" &&
          item.status === "met" &&
          hasPositiveEvidence(item),
      )
    ) {
      addIssue(issues, path, "SG-A supporting_strength requires met preferred Match evidence");
    }
    addStrengthTruthfulnessIssues(entry.statement, items, `${path}.statement`, issues);
  });

  for (const ref of constraints.directStrengthMatchRefs) {
    if (!raw.strengths.some((entry) => entry.type === "direct_match" && entry.matchRefs.includes(ref))) {
      addIssue(issues, "strengths", `SG-A ${ref} eligible direct strength must be represented`);
    }
  }
  for (const ref of constraints.supportingStrengthMatchRefs) {
    if (!raw.strengths.some((entry) => entry.type === "supporting_strength" && entry.matchRefs.includes(ref))) {
      addIssue(issues, "strengths", `SG-A ${ref} eligible supporting strength must be represented`);
    }
  }

  raw.gaps.forEach((entry, index) => {
    const path = `gaps.${index}`;
    const duplicate = findDuplicate(entry.matchRefs);
    if (duplicate) addIssue(issues, `${path}.matchRefs`, `duplicate match reference ${duplicate}`);
    const items = entry.matchRefs
      .map((ref) => byRef.get(ref))
      .filter((item): item is StrengthGapMatchLedgerItem => item !== undefined);
    if (items.length !== entry.matchRefs.length) {
      addIssue(issues, `${path}.matchRefs`, "SG-I unknown Match reference");
      return;
    }
    const expectedAction: Record<GapType, GapActionType> = {
      hard_constraint: "structural",
      evidence_expression: "evidence",
      learnable_skill: "learn",
      information: "confirm",
    };
    if (entry.actionType !== expectedAction[entry.type]) {
      addIssue(issues, `${path}.actionType`, `SG-H ${entry.type} requires ${expectedAction[entry.type]} action`);
    }
    if (
      entry.type === "hard_constraint" &&
      !items.every(
        (item) =>
          item.requirementType === "hard_requirement" &&
          item.status === "unmet" &&
          hasExplicitCounterEvidence(item),
      )
    ) {
      addIssue(issues, path, "SG-G hard_constraint requires hard unmet with explicit counter-evidence");
    }
    if (
      entry.type === "information" &&
      (!items.every((item) => hasDimensionStatus(item, "unknown")) ||
        UNKNOWN_DEFICIENCY_PATTERN.test(entry.statement) ||
        UNKNOWN_DEFICIENCY_PATTERN.test(entry.suggestedAction))
    ) {
      addIssue(issues, path, "SG-F information gap must preserve unknown and cannot assert Candidate deficiency");
    }
    if (
      entry.type === "evidence_expression" &&
      (!items.every((item) => item.status === "partial" && hasPositiveEvidence(item)) ||
        !EVIDENCE_BOUNDARY_PATTERN.test(entry.statement))
    ) {
      addIssue(issues, path, "SG-E evidence_expression requires partial positive evidence and an evidence boundary");
    }
    if (
      entry.type === "learnable_skill" &&
      !items.every((item) => hasLearnableSkillEvidence(item))
    ) {
      addIssue(issues, path, "SG-E learnable_skill requires partial or explicit-unmet skill evidence, never unknown");
    }
    if (
      entry.type === "evidence_expression" ||
      entry.type === "learnable_skill"
    ) {
      addStrengthTruthfulnessIssues(
        entry.statement,
        items,
        `${path}.statement`,
        issues,
      );
    }
    if (
      FORBIDDEN_ADVICE_PATTERN.test(entry.suggestedAction) ||
      TIME_PROMISE_PATTERN.test(entry.suggestedAction)
    ) {
      addIssue(issues, `${path}.suggestedAction`, "SG-H unsupported, fabricated, or time-promising action");
    }
    if (
      entry.actionType === "confirm" &&
      !/(?:补充|确认|核实|说明)/.test(entry.suggestedAction)
    ) {
      addIssue(issues, `${path}.suggestedAction`, "SG-H confirm action must request missing information");
    }
    if (
      entry.actionType === "evidence" &&
      (!/(?:补充|说明|呈现|完善)/.test(entry.suggestedAction) ||
        (/(?:经历|职责|项目)/.test(entry.suggestedAction) &&
          !/(?:如果|若|如有|确实|真实)/.test(entry.suggestedAction)))
    ) {
      addIssue(issues, `${path}.suggestedAction`, "SG-H evidence action must be conditional and must not request invention");
    }
    if (
      entry.actionType === "learn" &&
      !/(?:学习|练习|补强|提升|巩固)/.test(entry.suggestedAction)
    ) {
      addIssue(issues, `${path}.suggestedAction`, "SG-H learn action must remain a bounded skill action");
    }
    if (
      entry.actionType === "structural" &&
      !/(?:确认|核实).{0,24}(?:严格|门槛|口径|条件)/.test(entry.suggestedAction)
    ) {
      addIssue(issues, `${path}.suggestedAction`, "SG-H structural action must confirm the hard gate without promising a fix");
    }
  });

  for (const ref of constraints.hardConstraintGapMatchRefs) {
    if (!raw.gaps.some((entry) => entry.type === "hard_constraint" && entry.matchRefs.includes(ref))) {
      addIssue(issues, "gaps", `SG-G ${ref} hard unmet must be represented as hard_constraint`);
    }
  }

  const outputText = JSON.stringify(raw);
  for (const item of ledger) {
    const source = item.dimensions.map((dimension) => dimension.reason).join(" ");
    if (
      INSTRUCTION_TEXT_PATTERN.test(source) &&
      (/(?:忽略|声称|虚构|编造)/.test(outputText) ||
        ((source.match(/\d+|[一二三四五六七八九十]+(?=年)/g) ?? []).some(
          (token) => outputText.includes(token),
        )))
    ) {
      addIssue(issues, "strengths", "SG-J instruction-like Match text cannot become a Strength/Gap fact");
      break;
    }
  }
  const itemStatusByRef = new Map(ledger.map((item) => [item.matchItemRef, item.status]));
  for (const ref of constraints.informationGapMatchRefs.filter(
    (matchRef) => itemStatusByRef.get(matchRef) === "unknown",
  )) {
    if (!raw.gaps.some((entry) => entry.type === "information" && entry.matchRefs.includes(ref))) {
      addIssue(issues, "gaps", `SG-F ${ref} unknown must be represented as information`);
    }
  }
  for (const ref of constraints.evidenceExpressionGapMatchRefs) {
    if (
      !raw.gaps.some(
        (entry) =>
          (entry.type === "evidence_expression" || entry.type === "learnable_skill") &&
          entry.matchRefs.includes(ref),
      )
    ) {
      addIssue(issues, "gaps", `SG-E ${ref} partial must have an evidence_expression or learnable_skill gap`);
    }
  }

  if (issues.length > 0) return { data: null, issues };
  const parsed = finalStrengthGapSchema.safeParse({
    schemaVersion: STRENGTH_GAP_SCHEMA_VERSION,
    matchSchemaVersion: matchCore.schemaVersion,
    strengths: raw.strengths.map((entry, index) => ({
      strengthId: `ST-${String(index + 1).padStart(3, "0")}`,
      ...entry,
    })),
    gaps: raw.gaps.map((entry, index) => ({
      gapId: `GP-${String(index + 1).padStart(3, "0")}`,
      ...entry,
    })),
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
