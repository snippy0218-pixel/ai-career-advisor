import { z } from "zod";

import {
  jobAnalysisSchema,
  requirementTypeSchema,
} from "./analysis-schema";
import type { JobAnalysis, RequirementType } from "./analysis-schema";
import {
  finalProfileStructureSchema,
  type FinalProfileStructure,
} from "./profile-schema";

export const MATCH_SCHEMA_VERSION = "match-core-v1" as const;

export const MATCH_STATUSES = ["met", "partial", "unmet", "unknown"] as const;
export const matchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const MATCH_DIMENSION_TYPES = [
  "qualification",
  "skill",
  "proficiency",
  "domain",
  "role",
  "employment_type",
  "duration",
  "responsibility",
  "credential",
  "location",
  "career_direction",
  "other",
] as const;
export const matchDimensionTypeSchema = z.enum(MATCH_DIMENSION_TYPES);

export const matchCoreRequestSchema = z
  .object({
    jobAnalysis: jobAnalysisSchema,
    candidateProfile: finalProfileStructureSchema,
  })
  .strict();

export type MatchCoreRequest = z.infer<typeof matchCoreRequestSchema>;

const rawCandidateEvidenceSchema = z
  .object({
    factId: z.string().regex(/^CF-\d{3,}$/),
    role: z.enum(["positive", "counter"]),
  })
  .strict();

const rawMatchDimensionSchema = z
  .object({
    dimensionType: matchDimensionTypeSchema,
    requirementFragment: z.string().trim().min(1).max(160),
    status: matchStatusSchema,
    reason: z.string().trim().min(1).max(320),
    jdEvidence: z.array(z.string().trim().min(1)).min(1).max(3),
    candidateEvidence: z.array(rawCandidateEvidenceSchema).max(3),
    missingInformation: z.string().trim().min(1).max(240).nullable(),
    verificationQuestion: z.string().trim().min(1).max(240).nullable(),
  })
  .strict();

const rawMatchItemSchema = z
  .object({
    requirementId: z.string().regex(/^REQ-\d{3,}$/),
    aggregateStatus: matchStatusSchema,
    dimensions: z.array(rawMatchDimensionSchema).min(1).max(5),
  })
  .strict();

export const rawMatchCoreSchema = z
  .object({
    matchItems: z.array(rawMatchItemSchema).max(16),
  })
  .strict();

const finalMatchDimensionSchema = rawMatchDimensionSchema
  .omit({ candidateEvidence: true })
  .extend({
    dimensionId: z.string().regex(/^DIM-\d{3,}$/),
    candidateFactRefs: z.array(z.string().regex(/^CF-\d{3,}$/)).max(3),
    candidateEvidenceRole: z.enum(["positive", "counter"]).nullable(),
    pfEvidence: z.array(z.string().regex(/^PF-\d{3,}$/)).max(9),
  })
  .strict();

const finalMatchItemSchema = z
  .object({
    requirementId: z.string().regex(/^REQ-\d{3,}$/),
    requirement: z.string().trim().min(1).max(200),
    requirementType: requirementTypeSchema,
    jdEvidence: z.array(z.string().trim().min(1)).min(1).max(3),
    status: matchStatusSchema,
    requirementDimensions: z.array(finalMatchDimensionSchema).min(1).max(5),
  })
  .strict();

export const finalMatchCoreSchema = z
  .object({
    schemaVersion: z.literal(MATCH_SCHEMA_VERSION),
    jdSchemaVersion: z.literal("analysis-v1"),
    candidateProfileSchemaVersion: z.literal("candidate-profile-v2"),
    matchItems: z.array(finalMatchItemSchema).max(16),
  })
  .strict();

export type RawMatchCore = z.infer<typeof rawMatchCoreSchema>;
export type FinalMatchCore = z.infer<typeof finalMatchCoreSchema>;

export interface MatchRequirementLedgerItem {
  requirementId: string;
  requirement: string;
  requirementType: RequirementType;
  jdEvidence: string[];
}

export interface MatchValidationIssue {
  path: string;
  message: string;
}

export function buildMatchRequirementLedger(
  jobAnalysis: JobAnalysis,
): MatchRequirementLedgerItem[] {
  return jobAnalysis.roleProfile.requirements.map((item, index) => ({
    requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
    requirement: item.content,
    requirementType: item.requirementType,
    jdEvidence: [...item.evidence],
  }));
}

export function aggregateDimensionStatuses(statuses: MatchStatus[]): MatchStatus {
  if (statuses.some((status) => status === "unmet")) return "unmet";
  if (statuses.every((status) => status === "met")) return "met";
  if (statuses.some((status) => status === "met" || status === "partial")) {
    return "partial";
  }
  return "unknown";
}

function addRequiredDimensionIssues(
  requirement: MatchRequirementLedgerItem,
  dimensions: RawMatchCore["matchItems"][number]["dimensions"],
  itemPath: string,
  issues: MatchValidationIssue[],
) {
  const text = `${requirement.requirement} ${requirement.jdEvidence.join(" ")}`;
  const dimensionTypes = new Set(dimensions.map((item) => item.dimensionType));
  const hasDurationRequirement =
    /(?:[一二三四五六七八九十\d]+)\s*年(?:以上|及以上)/.test(text);
  if (hasDurationRequirement) {
    if (!dimensionTypes.has("duration")) {
      addIssue(
        issues,
        `${itemPath}.dimensions`,
        "explicit duration requirement requires a duration dimension",
      );
    }
    if (dimensions.length < 2) {
      addIssue(
        issues,
        `${itemPath}.dimensions`,
        "duration requirement must separate duration from the related role/domain/experience dimension",
      );
    }
  }
  if (/(?:全职|正式工作)/.test(text) && !dimensionTypes.has("employment_type")) {
    addIssue(
      issues,
      `${itemPath}.dimensions`,
      "explicit full-time/formal-work requirement requires an employment_type dimension",
    );
  }
}

function addIssue(
  issues: MatchValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

const INSTRUCTION_TEXT_PATTERN =
  /忽略.{0,16}(?:规则|提示|之前|以上)|把我描述成|虚构|编造.{0,12}(?:经历|经验|技能)|system\s*prompt|developer\s*message/i;

export function finalizeRawMatchCore(
  raw: RawMatchCore,
  jobAnalysis: JobAnalysis,
  profileStructure: FinalProfileStructure,
): { data: FinalMatchCore | null; issues: MatchValidationIssue[] } {
  const issues: MatchValidationIssue[] = [];
  const requirements = buildMatchRequirementLedger(jobAnalysis);
  const requirementById = new Map(
    requirements.map((item) => [item.requirementId, item]),
  );
  const profile = profileStructure.candidateProfile;
  const factById = new Map(
    profile.canonicalFacts.map((fact) => [fact.factId, fact]),
  );
  const pfIds = new Set(profile.evidence.map((item) => item.id));

  const rawRequirementIds = raw.matchItems.map((item) => item.requirementId);
  if (
    new Set(rawRequirementIds).size !== rawRequirementIds.length ||
    !sameStringSet(rawRequirementIds, requirements.map((item) => item.requirementId))
  ) {
    addIssue(
      issues,
      "matchItems",
      "matchItems must cover every validated JD requirement exactly once",
    );
  }

  const finalItems: FinalMatchCore["matchItems"] = [];
  raw.matchItems.forEach((item, itemIndex) => {
    const itemPath = `matchItems.${itemIndex}`;
    const requirement = requirementById.get(item.requirementId);
    if (!requirement) {
      addIssue(issues, `${itemPath}.requirementId`, "unknown requirement reference");
      return;
    }

    addRequiredDimensionIssues(requirement, item.dimensions, itemPath, issues);

    const computedAggregate = aggregateDimensionStatuses(
      item.dimensions.map((dimension) => dimension.status),
    );
    if (computedAggregate !== item.aggregateStatus) {
      addIssue(
        issues,
        `${itemPath}.aggregateStatus`,
        `aggregateStatus must be ${computedAggregate}`,
      );
    }

    const dimensions: FinalMatchCore["matchItems"][number]["requirementDimensions"] = [];
    item.dimensions.forEach((dimension, dimensionIndex) => {
      const dimensionPath = `${itemPath}.dimensions.${dimensionIndex}`;
      const uniqueJdEvidence = [...new Set(dimension.jdEvidence)];
      if (
        uniqueJdEvidence.length !== dimension.jdEvidence.length ||
        uniqueJdEvidence.some(
          (evidence) => !requirement.jdEvidence.includes(evidence),
        )
      ) {
        addIssue(
          issues,
          `${dimensionPath}.jdEvidence`,
          "dimension JD evidence must reference validated requirement evidence",
        );
      }

      const factRefs = dimension.candidateEvidence.map((item) => item.factId);
      if (new Set(factRefs).size !== factRefs.length) {
        addIssue(
          issues,
          `${dimensionPath}.candidateEvidence`,
          "candidate fact references must be unique",
        );
      }
      const roles = new Set(dimension.candidateEvidence.map((entry) => entry.role));
      const requiredRole =
        dimension.status === "unmet"
          ? "counter"
          : dimension.status === "unknown"
            ? null
            : "positive";
      if (
        (requiredRole === null && dimension.candidateEvidence.length > 0) ||
        (requiredRole !== null &&
          (dimension.candidateEvidence.length === 0 ||
            roles.size !== 1 ||
            !roles.has(requiredRole)))
      ) {
        addIssue(
          issues,
          `${dimensionPath}.candidateEvidence`,
          requiredRole === null
            ? "unknown cannot carry candidate evidence or contradiction"
            : `${dimension.status} requires explicit ${requiredRole} candidate evidence`,
        );
      }

      const pfEvidence: string[] = [];
      for (const factId of factRefs) {
        const fact = factById.get(factId);
        if (!fact) {
          addIssue(
            issues,
            `${dimensionPath}.candidateEvidence`,
            `unknown candidate fact reference ${factId}`,
          );
          continue;
        }
        if (INSTRUCTION_TEXT_PATTERN.test(fact.statement)) {
          addIssue(
            issues,
            `${dimensionPath}.candidateEvidence`,
            `instruction-like candidate fact cannot support a match claim: ${factId}`,
          );
        }
        for (const pfId of fact.pfEvidence) {
          if (!pfIds.has(pfId)) {
            addIssue(
              issues,
              `${dimensionPath}.candidateEvidence`,
              `${factId} has an invalid PF reference ${pfId}`,
            );
          } else if (!pfEvidence.includes(pfId)) {
            pfEvidence.push(pfId);
          }
        }
      }

      if (dimension.status === "met" || dimension.status === "unmet") {
        if (
          dimension.missingInformation !== null ||
          dimension.verificationQuestion !== null
        ) {
          addIssue(
            issues,
            dimensionPath,
            `${dimension.status} cannot include missing information or verification question`,
          );
        }
      } else if (
        dimension.missingInformation === null ||
        dimension.verificationQuestion === null
      ) {
        addIssue(
          issues,
          dimensionPath,
          `${dimension.status} requires missingInformation and verificationQuestion`,
        );
      }

      dimensions.push({
        dimensionId: `DIM-${String(dimensionIndex + 1).padStart(3, "0")}`,
        dimensionType: dimension.dimensionType,
        requirementFragment: dimension.requirementFragment,
        status: dimension.status,
        reason: dimension.reason,
        jdEvidence: uniqueJdEvidence,
        candidateFactRefs: factRefs,
        candidateEvidenceRole: requiredRole,
        pfEvidence,
        missingInformation: dimension.missingInformation,
        verificationQuestion: dimension.verificationQuestion,
      });
    });

    finalItems.push({
      requirementId: requirement.requirementId,
      requirement: requirement.requirement,
      requirementType: requirement.requirementType,
      jdEvidence: requirement.jdEvidence,
      status: computedAggregate,
      requirementDimensions: dimensions,
    });
  });

  if (issues.length > 0) return { data: null, issues };
  const parsed = finalMatchCoreSchema.safeParse({
    schemaVersion: MATCH_SCHEMA_VERSION,
    jdSchemaVersion: jobAnalysis.schemaVersion,
    candidateProfileSchemaVersion: profileStructure.schemaVersion,
    matchItems: finalItems,
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
