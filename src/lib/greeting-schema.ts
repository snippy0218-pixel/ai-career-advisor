import { z } from "zod";

import {
  finalMatchCoreSchema,
  type FinalMatchCore,
} from "./match-schema";
import {
  finalProfileStructureSchema,
  type FinalCanonicalCandidateFact,
} from "./profile-schema";
import {
  computeAllowedRecommendationLevels,
  finalRecommendationSchema,
  SUBSTITUTION_CLAIM_PATTERN,
  WAIVER_CLAIM_PATTERN,
} from "./recommendation-schema";
import { finalStrengthGapSchema } from "./strength-gap-schema";
import { findUnsupportedModifiers } from "./modifier-integrity";

export const GREETING_SCHEMA_VERSION = "personalized-greeting-v1" as const;

const candidateFactRefSchema = z.string().regex(/^CF-\d{3,}$/);
const matchRefSchema = z.string().regex(/^MI-\d{3,}$/);
const strengthRefSchema = z.string().regex(/^ST-\d{3,}$/);

export const personalizedGreetingRequestSchema = z
  .object({
    candidateProfile: finalProfileStructureSchema,
    matchCore: finalMatchCoreSchema,
    recommendation: finalRecommendationSchema,
    strengthGap: finalStrengthGapSchema.nullable().optional().default(null),
  })
  .strict()
  .superRefine((request, context) => {
    const facts = new Map(
      request.candidateProfile.candidateProfile.canonicalFacts.map((fact) => [
        fact.factId,
        fact,
      ]),
    );
    const pfIds = new Set(
      request.candidateProfile.candidateProfile.evidence.map((item) => item.id),
    );
    request.matchCore.matchItems.forEach((item, itemIndex) => {
      item.requirementDimensions.forEach((dimension, dimensionIndex) => {
        for (const factRef of dimension.candidateFactRefs) {
          const fact = facts.get(factRef);
          if (!fact) {
            context.addIssue({
              code: "custom",
              path: ["matchCore", "matchItems", itemIndex, "requirementDimensions", dimensionIndex, "candidateFactRefs"],
              message: "Match references a Candidate Fact outside Candidate Profile",
            });
            continue;
          }
          if (fact.pfEvidence.some((pfRef) => !pfIds.has(pfRef))) {
            context.addIssue({
              code: "custom",
              path: ["candidateProfile", "candidateProfile", "canonicalFacts"],
              message: `${factRef} has unresolved PF evidence`,
            });
          }
          if (!fact.pfEvidence.every((pfRef) => dimension.pfEvidence.includes(pfRef))) {
            context.addIssue({
              code: "custom",
              path: ["matchCore", "matchItems", itemIndex, "requirementDimensions", dimensionIndex, "pfEvidence"],
              message: `Match evidence does not preserve ${factRef} PF references`,
            });
          }
        }
      });
    });

    const expectedAllowed = computeAllowedRecommendationLevels(request.matchCore);
    if (
      request.recommendation.allowedRecommendationLevels.length !== expectedAllowed.length ||
      request.recommendation.allowedRecommendationLevels.some(
        (level, index) => level !== expectedAllowed[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["recommendation", "allowedRecommendationLevels"],
        message: "Recommendation allowed levels do not match Match Core",
      });
    }
    const matchRefs = new Set(
      request.matchCore.matchItems.map(
        (_, index) => `MI-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    const recommendationRefs = [
      ...request.recommendation.supportingMatchRefs,
      ...request.recommendation.counterMatchRefs,
      ...request.recommendation.limitations.flatMap((item) => item.matchItemRefs),
      ...request.recommendation.questionsToConfirm.flatMap(
        (item) => item.matchItemRefs,
      ),
    ];
    if (recommendationRefs.some((ref) => !matchRefs.has(ref))) {
      context.addIssue({
        code: "custom",
        path: ["recommendation"],
        message: "Recommendation references a Match Item outside Match Core",
      });
    }
    if (
      request.strengthGap?.strengths.some((strength) =>
        strength.matchRefs.some((ref) => !matchRefs.has(ref)),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["strengthGap"],
        message: "Strength references a Match Item outside Match Core",
      });
    }
  });

const rawCandidateClaimSchema = z
  .object({
    candidateFactRef: candidateFactRefSchema,
    statement: z.string().trim().min(1).max(200),
  })
  .strict();

const rawJobRelationSchema = z
  .object({
    matchRef: matchRefSchema,
    statement: z.string().trim().min(1).max(240),
    jdEvidence: z.array(z.string().trim().min(1)).min(1).max(3),
  })
  .strict();

export const rawPersonalizedGreetingSchema = z
  .object({
    greeting: z.string().trim().min(20).max(600),
    candidateClaims: z.array(rawCandidateClaimSchema).min(1).max(2),
    jobRelations: z.array(rawJobRelationSchema).min(1).max(2),
    strengthRefs: z.array(strengthRefSchema).max(2),
  })
  .strict();

export const finalPersonalizedGreetingSchema = z
  .object({
    schemaVersion: z.literal(GREETING_SCHEMA_VERSION),
    personalizationStatus: z.enum(["personalized", "not_personalized"]),
    greeting: z.string().trim().min(20).max(600),
    candidateFactRefs: z.array(candidateFactRefSchema).max(2),
    matchRefs: z.array(matchRefSchema).max(4),
    jdEvidence: z.array(z.string().trim().min(1)).max(6),
    strengthRefs: z.array(strengthRefSchema).max(2),
  })
  .strict()
  .superRefine((value, context) => {
    const refs = [
      value.candidateFactRefs,
      value.matchRefs,
      value.jdEvidence,
      value.strengthRefs,
    ];
    if (refs.some((items) => new Set(items).size !== items.length)) {
      context.addIssue({ code: "custom", message: "references must be unique" });
    }
    if (
      value.personalizationStatus === "personalized" &&
      (value.candidateFactRefs.length === 0 || value.matchRefs.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "personalized greeting requires Candidate Fact and Match refs",
      });
    }
    if (
      value.personalizationStatus === "not_personalized" &&
      refs.some((items) => items.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "non-personalized greeting cannot expose personalized refs",
      });
    }
  });

export type PersonalizedGreetingRequest = z.infer<
  typeof personalizedGreetingRequestSchema
>;
export type RawPersonalizedGreeting = z.infer<
  typeof rawPersonalizedGreetingSchema
>;
export type FinalPersonalizedGreeting = z.infer<
  typeof finalPersonalizedGreetingSchema
>;

export interface GreetingValidationIssue {
  path: string;
  message: string;
}

export interface GreetingSelectionItem {
  candidateFact: FinalCanonicalCandidateFact;
  matchRefs: string[];
  jdEvidence: string[];
  strengthRefs: string[];
  score: number;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function matchRef(index: number) {
  return `MI-${String(index + 1).padStart(3, "0")}`;
}

export function buildGreetingFactSelection(
  request: PersonalizedGreetingRequest,
): GreetingSelectionItem[] {
  const facts = new Map(
    request.candidateProfile.candidateProfile.canonicalFacts.map((fact) => [
      fact.factId,
      fact,
    ]),
  );
  const candidates = new Map<
    string,
    Omit<GreetingSelectionItem, "candidateFact"> & {
      candidateFact: FinalCanonicalCandidateFact;
    }
  >();

  request.matchCore.matchItems.forEach((item, itemIndex) => {
    const ref = matchRef(itemIndex);
    const statusScore = item.status === "met" ? 40 : item.status === "partial" ? 28 : 0;
    if (statusScore === 0) return;
    const typeScore =
      item.requirementType === "hard_requirement"
        ? 9
        : item.requirementType === "core_requirement"
          ? 7
          : item.requirementType === "preferred_requirement"
            ? 2
            : 1;
    const relatedStrengths =
      request.strengthGap?.strengths.filter((strength) =>
        strength.matchRefs.includes(ref),
      ) ?? [];
    for (const dimension of item.requirementDimensions) {
      if (
        dimension.candidateEvidenceRole !== "positive" ||
        !["met", "partial"].includes(dimension.status)
      ) {
        continue;
      }
      for (const factRef of dimension.candidateFactRefs) {
        const fact = facts.get(factRef);
        if (!fact) continue;
        const existing = candidates.get(factRef) ?? {
          candidateFact: fact,
          matchRefs: [],
          jdEvidence: [],
          strengthRefs: [],
          score: 0,
        };
        existing.matchRefs = unique([...existing.matchRefs, ref]);
        existing.jdEvidence = unique([
          ...existing.jdEvidence,
          ...dimension.jdEvidence,
          ...item.jdEvidence,
        ]);
        existing.strengthRefs = unique([
          ...existing.strengthRefs,
          ...relatedStrengths.map((strength) => strength.strengthId),
        ]);
        existing.score = Math.max(
          existing.score,
          statusScore + typeScore + (relatedStrengths.length > 0 ? 5 : 0),
        );
        candidates.set(factRef, existing);
      }
    }
  });

  return [...candidates.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidateFact.factId.localeCompare(right.candidateFact.factId),
    )
    .slice(0, 2);
}

const BOUNDED_RELATION_PATTERN =
  /(?:相关|关联|可迁移|部分支持|一定支持|提供.{0,8}(?:基础|参考|支持)|部分职责|部分要求)/;
const OVERALL_FIT_PATTERN =
  /(?:高度匹配|完全符合|非常契合|高度契合|完美匹配|完全匹配|十分匹配)/;
const NOT_RECOMMENDED_FIT_PATTERN =
  /(?:整体匹配|符合岗位|匹配岗位|胜任岗位|能够胜任|非常适合)/;
const EXTRA_CANDIDATE_CLAIM_PATTERN =
  /(?:我|本人|我的背景|我的经历).{0,16}(?:具备|拥有|熟悉|精通|擅长|负责|主导|独立完成|获得|提升|掌握|使用|参与|协助)/;
const OWNERSHIP_UPGRADE_PATTERN = /(?:主导|独立负责|独立完成|个人负责)/;
const PROFICIENCY_UPGRADE_PATTERN = /(?:精通|熟练掌握|专家级|资深)/;
const EXPERIENCE_UPGRADE_PATTERN = /(?:正式工作经验|全职工作经验|多年经验)/;
const TEAM_TO_INDIVIDUAL_PATTERN =
  /(?:我|本人).{0,8}(?:获得|提升|实现|完成).{0,16}(?:一等奖|奖项|效率|成果|业绩)/;
const OPENING_PATTERN = /(?:您好|你好)/;
const CLOSING_PATTERN = /(?:沟通|交流|了解岗位|进一步了解|期待回复)/;

function addIssue(
  issues: GreetingValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function selectionForFact(
  selection: GreetingSelectionItem[],
  factRef: string,
) {
  return selection.find((item) => item.candidateFact.factId === factRef);
}

function itemForMatchRef(matchCore: FinalMatchCore, ref: string) {
  const match = /^MI-(\d{3,})$/.exec(ref);
  return match ? matchCore.matchItems[Number(match[1]) - 1] ?? null : null;
}

function removeOnce(value: string, fragment: string) {
  const index = value.indexOf(fragment);
  return index === -1
    ? value
    : `${value.slice(0, index)}${value.slice(index + fragment.length)}`;
}

function removeCandidateClaimOccurrence(value: string, statement: string) {
  const wrappedStatements = [
    `我拥有${statement}`,
    `我有${statement}`,
    `我的${statement}`,
    `我${statement}`,
    `本人拥有${statement}`,
    `本人${statement}`,
  ];
  const wrapped = wrappedStatements.find((item) => value.includes(item));
  return removeOnce(value, wrapped ?? statement);
}

function removeJdEvidenceInBoundedRelation(value: string, evidence: string) {
  const index = value.indexOf(evidence);
  if (index === -1) return value;
  const before = value.slice(Math.max(0, index - 24), index);
  const after = value.slice(index + evidence.length, index + evidence.length + 36);
  return /(?:岗位|职责|要求)/.test(before) && BOUNDED_RELATION_PATTERN.test(after)
    ? removeOnce(value, evidence)
    : value;
}

function unsupportedNumbers(greeting: string, factText: string) {
  const numbers = greeting.match(/\d+(?:\.\d+)?%?/g) ?? [];
  return numbers.filter((number) => !factText.includes(number));
}

function unknownSignals(matchCore: FinalMatchCore) {
  return unique(
    matchCore.matchItems
      .filter(
        (item) =>
          item.status === "unknown" ||
          item.requirementDimensions.some((dimension) => dimension.status === "unknown"),
      )
      .flatMap((item) => {
        const ascii = item.requirement.match(/[A-Za-z][A-Za-z0-9+.#-]{1,}/g) ?? [];
        return [item.requirement, ...ascii];
      }),
  );
}

export function finalizeRawPersonalizedGreeting(
  raw: RawPersonalizedGreeting,
  request: PersonalizedGreetingRequest,
): { data: FinalPersonalizedGreeting | null; issues: GreetingValidationIssue[] } {
  const issues: GreetingValidationIssue[] = [];
  const selection = buildGreetingFactSelection(request);
  const factRefs = raw.candidateClaims.map((claim) => claim.candidateFactRef);
  if (new Set(factRefs).size !== factRefs.length) {
    addIssue(issues, "candidateClaims", "PG-K duplicate Candidate Fact reference");
  }

  raw.candidateClaims.forEach((claim, index) => {
    const selected = selectionForFact(selection, claim.candidateFactRef);
    if (!selected) {
      addIssue(issues, `candidateClaims.${index}`, "PG-A Candidate claim has no eligible positive Match evidence");
      return;
    }
    if (claim.statement !== selected.candidateFact.statement) {
      addIssue(issues, `candidateClaims.${index}.statement`, "PG-A Candidate claim must preserve the canonical Candidate Fact exactly");
      addIssue(issues, `candidateClaims.${index}.statement`, "PG-C Candidate claim semantic preservation failed");
    }
    if (!raw.greeting.includes(claim.statement)) {
      addIssue(issues, "greeting", "PG-A structured Candidate claim is missing from greeting text");
    }
    const pfIds = new Set(
      request.candidateProfile.candidateProfile.evidence.map((item) => item.id),
    );
    if (selected.candidateFact.pfEvidence.some((pfRef) => !pfIds.has(pfRef))) {
      addIssue(issues, `candidateClaims.${index}`, "PG-B Candidate Fact PF evidence cannot be resolved");
    }
  });

  const relationRefs = raw.jobRelations.map((relation) => relation.matchRef);
  if (new Set(relationRefs).size !== relationRefs.length) {
    addIssue(issues, "jobRelations", "PG-K duplicate Match reference");
  }
  raw.jobRelations.forEach((relation, index) => {
    const item = itemForMatchRef(request.matchCore, relation.matchRef);
    if (!item) {
      addIssue(issues, `jobRelations.${index}`, "PG-K unknown Match reference");
      return;
    }
    const linked = raw.candidateClaims.some((claim) =>
      item.requirementDimensions.some(
        (dimension) =>
          dimension.candidateEvidenceRole === "positive" &&
          ["met", "partial"].includes(dimension.status) &&
          dimension.candidateFactRefs.includes(claim.candidateFactRef),
      ),
    );
    if (!linked) {
      addIssue(issues, `jobRelations.${index}`, "PG-H Job relation is not supported by selected Candidate evidence");
    }
    if (!BOUNDED_RELATION_PATTERN.test(relation.statement)) {
      addIssue(issues, `jobRelations.${index}.statement`, "PG-H Job relation must use bounded relevance language");
    }
    if (OVERALL_FIT_PATTERN.test(relation.statement)) {
      addIssue(issues, `jobRelations.${index}.statement`, "PG-J Job relation cannot claim overall fit");
    }
    if (
      relation.jdEvidence.some(
        (evidence) =>
          !item.jdEvidence.includes(evidence) &&
          !item.requirementDimensions.some((dimension) =>
            dimension.jdEvidence.includes(evidence),
          ),
      )
    ) {
      addIssue(issues, `jobRelations.${index}.jdEvidence`, "PG-D JD evidence is not traceable to Match Core");
    }
    const modifierEvidence = [
      item.requirement,
      ...item.jdEvidence,
      ...item.requirementDimensions.flatMap((dimension) => [
        dimension.requirementFragment,
        dimension.reason,
        ...dimension.jdEvidence,
      ]),
      ...raw.candidateClaims.map((claim) => claim.statement),
    ];
    const unsupportedModifiers = findUnsupportedModifiers(
      relation.statement,
      modifierEvidence,
    );
    if (unsupportedModifiers.length > 0) {
      addIssue(
        issues,
        `jobRelations.${index}.statement`,
        `PG-N unsupported modifier upgrade: ${unsupportedModifiers
          .map((modifier) => `${modifier.category}:${modifier.value}`)
          .join(", ")}`,
      );
    }
  });

  if (!BOUNDED_RELATION_PATTERN.test(raw.greeting)) {
    addIssue(issues, "greeting", "PG-H Greeting must contain a bounded Job relation");
  }

  const validStrengths = new Map(
    (request.strengthGap?.strengths ?? []).map((strength) => [
      strength.strengthId,
      strength,
    ]),
  );
  if (new Set(raw.strengthRefs).size !== raw.strengthRefs.length) {
    addIssue(issues, "strengthRefs", "PG-K duplicate Strength reference");
  }
  for (const ref of raw.strengthRefs) {
    const strength = validStrengths.get(ref);
    if (!strength || !strength.matchRefs.some((item) => relationRefs.includes(item))) {
      addIssue(issues, "strengthRefs", "PG-K Strength reference is invalid or unrelated");
    }
  }

  let extraText = raw.greeting;
  for (const claim of raw.candidateClaims) {
    extraText = removeCandidateClaimOccurrence(extraText, claim.statement);
  }
  for (const relation of raw.jobRelations) {
    extraText = removeOnce(extraText, relation.statement);
    for (const evidence of relation.jdEvidence) {
      extraText = removeJdEvidenceInBoundedRelation(extraText, evidence);
    }
  }
  if (EXTRA_CANDIDATE_CLAIM_PATTERN.test(extraText)) {
    addIssue(issues, "greeting", "PG-A greeting contains an unstructured Candidate claim");
  }

  const factText = raw.candidateClaims.map((claim) => claim.statement).join(" ");
  const unsupportedNumberValues = unsupportedNumbers(raw.greeting, factText);
  if (unsupportedNumberValues.length > 0) {
    addIssue(issues, "greeting", `PG-E unsupported Candidate quantity: ${unsupportedNumberValues.join(", ")}`);
  }
  if (
    (OWNERSHIP_UPGRADE_PATTERN.test(extraText) ||
      PROFICIENCY_UPGRADE_PATTERN.test(extraText) ||
      EXPERIENCE_UPGRADE_PATTERN.test(extraText))
  ) {
    addIssue(issues, "greeting", "PG-C greeting contains a semantic Candidate upgrade");
  }
  if (
    raw.candidateClaims.some((claim) => claim.statement.includes("团队")) &&
    TEAM_TO_INDIVIDUAL_PATTERN.test(extraText)
  ) {
    addIssue(issues, "greeting", "PG-F team achievement was attributed to an individual");
  }

  const selectedFactText = raw.candidateClaims
    .map((claim) => claim.statement)
    .join(" ");
  const greetingModifiers = findUnsupportedModifiers(raw.greeting, [
    selectedFactText,
    ...raw.jobRelations.flatMap((relation) => [
      relation.statement,
      ...relation.jdEvidence,
    ]),
  ]);
  if (greetingModifiers.length > 0) {
    addIssue(
      issues,
      "greeting",
      `PG-N unsupported modifier upgrade: ${greetingModifiers
        .map((modifier) => `${modifier.category}:${modifier.value}`)
        .join(", ")}`,
    );
  }
  for (const signal of unknownSignals(request.matchCore)) {
    if (
      signal.length >= 2 &&
      raw.greeting.includes(signal) &&
      !selectedFactText.includes(signal) &&
      !raw.jobRelations.some((relation) => relation.statement.includes(signal))
    ) {
      addIssue(issues, "greeting", `PG-G unknown Match content entered Candidate greeting: ${signal}`);
    }
  }

  if (WAIVER_CLAIM_PATTERN.test(raw.greeting) || SUBSTITUTION_CLAIM_PATTERN.test(raw.greeting)) {
    addIssue(issues, "greeting", "PG-I Greeting cannot introduce waiver or substitution language");
  }
  if (
    ["cautious", "not_recommended"].includes(
      request.recommendation.recommendationLevel,
    ) &&
    OVERALL_FIT_PATTERN.test(raw.greeting)
  ) {
    addIssue(issues, "greeting", "PG-J Recommendation tone is too strong");
  }
  if (
    request.recommendation.recommendationLevel === "not_recommended" &&
    NOT_RECOMMENDED_FIT_PATTERN.test(raw.greeting)
  ) {
    addIssue(issues, "greeting", "PG-J not_recommended Greeting cannot claim overall match");
  }
  const hasKnownNegative = request.matchCore.matchItems.some(
    (item) =>
      ["unmet", "unknown"].includes(item.status) ||
      item.requirementDimensions.some((dimension) =>
        ["unmet", "unknown"].includes(dimension.status),
      ),
  );
  if (hasKnownNegative && OVERALL_FIT_PATTERN.test(raw.greeting)) {
    addIssue(issues, "greeting", "PG-H Greeting contradicts known unmet/unknown Match status");
  }
  if (!OPENING_PATTERN.test(raw.greeting) || !CLOSING_PATTERN.test(raw.greeting)) {
    addIssue(issues, "greeting", "PG-L Greeting must remain usable for first HR contact");
  }

  const candidateFactRefs = unique(factRefs);
  const matchRefs = unique(relationRefs);
  const jdEvidence = unique(raw.jobRelations.flatMap((item) => item.jdEvidence));
  const finalResult = finalPersonalizedGreetingSchema.safeParse({
    schemaVersion: GREETING_SCHEMA_VERSION,
    personalizationStatus: "personalized",
    greeting: raw.greeting,
    candidateFactRefs,
    matchRefs,
    jdEvidence,
    strengthRefs: unique(raw.strengthRefs),
  });
  if (!finalResult.success) {
    for (const issue of finalResult.error.issues) {
      addIssue(issues, issue.path.join("."), `PG-L ${issue.message}`);
    }
  }
  return {
    data: issues.length === 0 && finalResult.success ? finalResult.data : null,
    issues,
  };
}

export function buildPersonalizedSafeFallback(
  request: PersonalizedGreetingRequest,
): FinalPersonalizedGreeting {
  const selection = buildGreetingFactSelection(request);
  if (selection.length === 0) return buildPhase1SafeFallback();
  const facts = selection.map((item) => item.candidateFact.statement);
  const greeting = `您好，我看到贵司正在招聘相关岗位。${facts.join("；")}。这些经历与岗位的部分职责存在一定相关性，希望有机会进一步沟通。`;
  return finalPersonalizedGreetingSchema.parse({
    schemaVersion: GREETING_SCHEMA_VERSION,
    personalizationStatus: "personalized",
    greeting,
    candidateFactRefs: selection.map((item) => item.candidateFact.factId),
    matchRefs: unique(selection.flatMap((item) => item.matchRefs)),
    jdEvidence: unique(selection.flatMap((item) => item.jdEvidence)),
    strengthRefs: unique(selection.flatMap((item) => item.strengthRefs)).slice(0, 2),
  });
}

export function buildPhase1SafeFallback(): FinalPersonalizedGreeting {
  return finalPersonalizedGreetingSchema.parse({
    schemaVersion: GREETING_SCHEMA_VERSION,
    personalizationStatus: "not_personalized",
    greeting:
      "您好，我看到贵司正在招聘相关岗位，希望进一步了解岗位职责和招聘要求，期待有机会沟通。",
    candidateFactRefs: [],
    matchRefs: [],
    jdEvidence: [],
    strengthRefs: [],
  });
}
