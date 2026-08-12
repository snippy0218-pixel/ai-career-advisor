import { z } from "zod";

import {
  jobAnalysisSchema,
  requirementTypeSchema,
} from "./analysis-schema";
import type { JobAnalysis, RequirementType } from "./analysis-schema";
import {
  finalProfileStructureSchema,
  type FinalCanonicalCandidateFact,
  type FinalProfileStructure,
} from "./profile-schema";
import {
  findCrossFactModifierContamination,
  findUnsupportedModifiers,
} from "./modifier-integrity";

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

const CONSERVATIVE_DOMAIN_TERMS = [
  "产品",
  "数据分析",
  "运营",
  "销售",
  "前端",
  "后端",
  "测试",
  "设计",
] as const;

function explicitSameDimensionPositiveFacts(
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  facts: FinalCanonicalCandidateFact[],
) {
  if (dimension.dimensionType !== "domain") return [];
  const terms = CONSERVATIVE_DOMAIN_TERMS.filter((term) =>
    dimension.requirementFragment.includes(term),
  );
  if (terms.length === 0) return [];
  return facts.filter(
    (fact) =>
      fact.semanticTags.some((tag) =>
        ["experience", "project_experience"].includes(tag),
      ) && terms.some((term) => fact.statement.includes(term)),
  );
}

const INSTRUCTION_TEXT_PATTERN =
  /忽略.{0,16}(?:规则|提示|之前|以上)|把我描述成|虚构|编造.{0,12}(?:经历|经验|技能)|system\s*prompt|developer\s*message/i;

const CANDIDATE_ASSERTION_PATTERN =
  /(?:候选人|本人|其).{0,36}(?:参与|协助|使用|负责|完成|拥有|具备|掌握|熟悉|从事|毕业|获得|持有|承担|主导|牵头|处理|学历|经历|经验)|^(?:并|且|同时)?(?:参与|协助|使用|负责|完成|拥有|具备|掌握|熟悉|从事|毕业|获得|持有|承担|主导|牵头|处理)|(?:项目|作业|经历|经验|学历|技能|工作).{0,20}(?:为|是|属于|来自|涉及|使用|负责|完成|持续|包含|承担)|(?:课程|课堂|校园|实习|全职|正式工作|非正式工作|频繁|高频|经常|长期|多年|熟练|精通|独立负责|全面负责|主导|牵头|\d+\s*(?:年|个月|月|周|天))/;
const EVIDENCE_BOUNDARY_PATTERN =
  /(?:没有.{0,12}(?:资料|信息|证据|事实|年限)|未表明|未体现|尚未体现|未提供|没有提供|尚未提供|无法确认|不能确认|不能证明|无法证明|不足以证明|不清楚|未知|待确认|需要确认|需确认|低于|不及|尚未达到|没有达到|未达到)/;
const EXPLICIT_NEGATIVE_CANDIDATE_PATTERN =
  /(?:没有(?!提供|资料|信息|证据)|不具备|未曾|从未|未取得|未获得|未持有|未从事|未参加|尚无(?!资料|信息|证据))/;
const NEGATIVE_CANDIDATE_CONCLUSION_PATTERN =
  /(?:没有(?!提供|资料|信息|证据)|不具备|未曾|从未|未取得|未获得|未持有|未从事|未参加|无法|不能|不是|并非|不属于)/;
const REQUIREMENT_RELATIONAL_MISMATCH_PATTERN =
  /(?:与|和|同).{0,32}(?:要求|条件|门槛|标准).{0,12}(?:不符|不符合|不一致|冲突)|(?:没有满足|未满足|不满足|不符合).{0,24}(?:要求|条件|门槛|标准)|(?:要求|条件|门槛|标准).{0,12}(?:未满足|不满足|不符|不符合|不一致|冲突)/;
const CLAIM_CLAUSE_SEPARATOR = /[，。；;！？!?]|(?:\s|^)(?:但|且|并且|同时)(?:\s|$)/;
const JD_ONLY_CLAIM_PATTERN = /(?:JD|岗位|职位|任职).{0,10}(?:要求|需要|门槛|标准)/i;
const NON_DISTINCTIVE_CLAIM_ANCHORS = new Set([
  "候选",
  "选人",
  "候选人",
  "资料",
  "信息",
  "证据",
  "事实",
  "项目",
  "作业",
  "经历",
  "经验",
  "相关",
  "要求",
  "维度",
  "明确",
  "提供",
  "支持",
  "匹配",
  "工作",
]);
const DISTINCTIVE_SHORT_CLAIM_ANCHORS = new Set([
  "本科",
  "大专",
  "硕士",
  "博士",
  "学历",
  "课程",
]);

function candidateAssertionClauses(content: string) {
  return content
    .split(CLAIM_CLAUSE_SEPARATOR)
    .map((clause) => clause.trim())
    .filter(
      (clause) =>
        clause.length > 0 &&
        (CANDIDATE_ASSERTION_PATTERN.test(clause) ||
          REQUIREMENT_RELATIONAL_MISMATCH_PATTERN.test(clause)) &&
        !JD_ONLY_CLAIM_PATTERN.test(clause) &&
        !EVIDENCE_BOUNDARY_PATTERN.test(clause),
    );
}

function normalizedClaimText(content: string) {
  return content
    .replace(
      /候选人|本人|明确|已经|曾经|曾|相关|相应|该项|该维度|这一维度|资料|信息|证据|事实|要求|项目|经历|经验|工作|提供|支持|匹配/g,
      "",
    )
    .replace(/[^\p{Script=Han}A-Za-z0-9+#.]/gu, "")
    .toLowerCase();
}

function meaningfulClaimAnchors(content: string) {
  const normalized = normalizedClaimText(content);
  const anchors = new Set<string>();
  for (const token of normalized.match(/[a-z][a-z0-9+#.]{1,}|\d+(?:\.\d+)?/g) ?? []) {
    anchors.add(token);
  }
  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) ?? [];
  for (const run of hanRuns) {
    for (let size = Math.min(6, run.length); size >= 2; size -= 1) {
      for (let index = 0; index + size <= run.length; index += 1) {
        const anchor = run.slice(index, index + size);
        if (!NON_DISTINCTIVE_CLAIM_ANCHORS.has(anchor)) anchors.add(anchor);
      }
    }
  }
  return [...anchors];
}

function factSupportsCandidateClause(
  clause: string,
  facts: FinalCanonicalCandidateFact[],
) {
  const specificNegativeProperty = clause.match(
    /(?:项目|作业|经历).{0,16}(?:不是|并非|不属于).{0,16}(?:正式工作|全职|实习|课程|校园)/,
  );
  if (
    specificNegativeProperty &&
    !facts.some(
      (fact) =>
        /(?:项目|作业|经历)/.test(fact.statement) &&
        /(?:不是|并非|不属于).{0,16}(?:正式工作|全职|实习|课程|校园)/.test(
          fact.statement,
        ),
    )
  ) {
    return false;
  }
  const clauseAnchors = meaningfulClaimAnchors(clause);
  if (clauseAnchors.length === 0) return false;
  return facts.some((fact) => {
    const statement = normalizedClaimText(fact.statement);
    return clauseAnchors.some(
      (anchor) =>
        statement.includes(anchor) &&
        (anchor.length >= 3 ||
          /[a-z0-9]/i.test(anchor) ||
          DISTINCTIVE_SHORT_CLAIM_ANCHORS.has(anchor)),
    );
  });
}

const SPECIFIC_FACT_RELATIONAL_PROJECTION_PATTERN =
  /(?:项目|作业|经历|技能|学历).{0,16}(?:不是|并非|不属于|不符合|不满足)/;
const EMPLOYMENT_RELATION_TARGET_PATTERN =
  /(?:正式.{0,6}(?:工作|经历|经验)|全职|实习)/;
const EDUCATION_LEVELS = ["高中", "中专", "大专", "本科", "硕士", "博士"] as const;

function explicitNegativeFactDimensions(statement: string) {
  const dimensions = new Set<
    RawMatchCore["matchItems"][number]["dimensions"][number]["dimensionType"]
  >();
  if (!EXPLICIT_NEGATIVE_CANDIDATE_PATTERN.test(statement)) return dimensions;

  if (/(?:正式.{0,6}(?:工作|经历|经验)|全职|实习)/.test(statement)) {
    dimensions.add("employment_type");
    return dimensions;
  }
  if (/(?:学历|本科|大专|硕士|博士|证书|资格)/.test(statement)) {
    dimensions.add("qualification");
    dimensions.add("credential");
  }
  if (/(?:独立负责|主导|牵头|负责|责任|交付)/.test(statement)) {
    dimensions.add("responsibility");
  }
  if (/(?:熟练|精通|掌握|熟悉)/.test(statement)) {
    dimensions.add("proficiency");
  }
  if (/(?:Python|SQL|技能|使用)/i.test(statement)) dimensions.add("skill");
  if (/(?:领域|行业|产品|运营|数据分析)/.test(statement)) dimensions.add("domain");
  return dimensions;
}

function explicitNegativeFactsSupportDimension(
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  facts: FinalCanonicalCandidateFact[],
) {
  return facts.some((fact) =>
    explicitNegativeFactDimensions(fact.statement).has(dimension.dimensionType),
  );
}

function isSupportedQualificationThresholdMismatch(
  clause: string,
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  requirement: MatchRequirementLedgerItem,
  referencedFacts: FinalCanonicalCandidateFact[],
) {
  if (
    dimension.dimensionType !== "qualification" ||
    dimension.status !== "unmet" ||
    dimension.candidateEvidence.length === 0 ||
    dimension.candidateEvidence.some((entry) => entry.role !== "counter") ||
    dimension.jdEvidence.length === 0 ||
    dimension.jdEvidence.some(
      (evidence) => !requirement.jdEvidence.includes(evidence),
    ) ||
    !REQUIREMENT_RELATIONAL_MISMATCH_PATTERN.test(clause)
  ) {
    return false;
  }

  const requirementContext = `${dimension.requirementFragment} ${dimension.jdEvidence.join(
    " ",
  )} ${requirement.requirement}`;
  const requiredLevel = EDUCATION_LEVELS.find((level) =>
    new RegExp(`${level}.{0,4}(?:及以上|以上|最低|门槛)`).test(
      requirementContext,
    ),
  );
  if (!requiredLevel || !clause.includes(requiredLevel)) return false;
  const requiredRank = EDUCATION_LEVELS.indexOf(requiredLevel);
  return referencedFacts.some((fact) => {
    const factLevel = EDUCATION_LEVELS.find((level) =>
      fact.statement.includes(level),
    );
    return factLevel
      ? EDUCATION_LEVELS.indexOf(factLevel) < requiredRank
      : false;
  });
}

function isSupportedRequirementMismatchClause(
  clause: string,
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  requirement: MatchRequirementLedgerItem,
  referencedFacts: FinalCanonicalCandidateFact[],
) {
  if (
    isSupportedQualificationThresholdMismatch(
      clause,
      dimension,
      requirement,
      referencedFacts,
    )
  ) {
    return true;
  }
  if (
    dimension.dimensionType !== "employment_type" ||
    dimension.status !== "unmet" ||
    dimension.candidateEvidence.length === 0 ||
    dimension.candidateEvidence.some((entry) => entry.role !== "counter") ||
    dimension.jdEvidence.length === 0 ||
    dimension.jdEvidence.some(
      (evidence) => !requirement.jdEvidence.includes(evidence),
    ) ||
    !REQUIREMENT_RELATIONAL_MISMATCH_PATTERN.test(clause) ||
    !EMPLOYMENT_RELATION_TARGET_PATTERN.test(clause) ||
    SPECIFIC_FACT_RELATIONAL_PROJECTION_PATTERN.test(clause)
  ) {
    return false;
  }

  const explicitNegativeFacts = referencedFacts.filter(
    (fact) =>
      EXPLICIT_NEGATIVE_CANDIDATE_PATTERN.test(fact.statement) &&
      !EVIDENCE_BOUNDARY_PATTERN.test(fact.statement),
  );
  if (explicitNegativeFacts.length === 0) return false;

  const requirementContext = `${dimension.requirementFragment} ${dimension.jdEvidence.join(
    " ",
  )} ${requirement.requirement}`;
  return explicitNegativeFacts.some((fact) => {
    const statement = fact.statement;
    return (
      (/正式/.test(requirementContext) &&
        /(?:工作|经历|经验)/.test(requirementContext) &&
        /正式/.test(statement) &&
        /(?:工作|经历|经验)/.test(statement)) ||
      (/全职/.test(requirementContext) && /全职/.test(statement)) ||
      (/实习/.test(requirementContext) && /实习/.test(statement))
    );
  });
}

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

      if (dimension.status === "unknown") {
        const explicitPositiveFacts = explicitSameDimensionPositiveFacts(
          dimension,
          profile.canonicalFacts,
        );
        if (explicitPositiveFacts.length > 0) {
          addIssue(
            issues,
            `${dimensionPath}.status`,
            `unknown omitted explicit same-domain positive evidence: ${explicitPositiveFacts
              .map((fact) => fact.factId)
              .join(", ")}`,
          );
        }
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

      const modifierEvidence = [
        ...uniqueJdEvidence,
        ...factRefs.flatMap((factId) => {
          const fact = factById.get(factId);
          return fact ? [fact.statement] : [];
        }),
      ];
      const unsupportedModifiers = findUnsupportedModifiers(
        `${dimension.requirementFragment} ${dimension.reason}`,
        modifierEvidence,
      );
      if (unsupportedModifiers.length > 0) {
        addIssue(
          issues,
          `${dimensionPath}.reason`,
          `M-K unsupported modifier upgrade: ${unsupportedModifiers
            .map((item) => `${item.category}:${item.value}`)
            .join(", ")}`,
        );
      }

      const referencedFacts = factRefs.flatMap((factId) => {
        const fact = factById.get(factId);
        return fact ? [{ factId, statement: fact.statement }] : [];
      });
      const factualClauses = candidateAssertionClauses(dimension.reason);
      for (const clause of factualClauses) {
        if (referencedFacts.length === 0) {
          addIssue(
            issues,
            `${dimensionPath}.reason`,
            `M-CANDIDATE-LINEAGE candidate factual assertion requires Candidate Fact lineage: ${clause}`,
          );
          continue;
        }
        const referencedCanonicalFacts = referencedFacts.flatMap(({ factId }) => {
          const fact = factById.get(factId);
          return fact ? [fact] : [];
        });
        const isRelationalConclusion =
          REQUIREMENT_RELATIONAL_MISMATCH_PATTERN.test(clause);
        const hasDimensionLocalNegativeSupport =
          !NEGATIVE_CANDIDATE_CONCLUSION_PATTERN.test(clause) ||
          explicitNegativeFactsSupportDimension(
            dimension,
            referencedCanonicalFacts,
          );
        if (
          (!hasDimensionLocalNegativeSupport ||
            isRelationalConclusion ||
            !factSupportsCandidateClause(clause, referencedCanonicalFacts)) &&
          !isSupportedRequirementMismatchClause(
            clause,
            dimension,
            requirement,
            referencedCanonicalFacts,
          )
        ) {
          addIssue(
            issues,
            `${dimensionPath}.reason`,
            `M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: ${clause}`,
          );
        }
      }
      const candidateObservationFields = [
        { path: "reason", value: dimension.reason },
        { path: "missingInformation", value: dimension.missingInformation },
        { path: "verificationQuestion", value: dimension.verificationQuestion },
      ];
      for (const field of candidateObservationFields) {
        if (field.value === null) continue;
        const crossFactContamination = findCrossFactModifierContamination(
          field.value,
          referencedFacts,
          { assertedOnly: field.path !== "reason" },
        );
        if (crossFactContamination.length > 0) {
          addIssue(
            issues,
            `${dimensionPath}.${field.path}`,
            `M-K cross-CF modifier isolation failed: ${crossFactContamination
              .map(
                (item) =>
                  `${item.category}:${item.value}->${item.unsupportedFactIds.join("+")}`,
              )
              .join(", ")}`,
          );
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
