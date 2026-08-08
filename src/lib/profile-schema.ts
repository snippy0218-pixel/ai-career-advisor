import { z } from "zod";

import { findNormalizedEvidenceSpans, isEvidenceInJd } from "./analysis-schema";

export const PROFILE_SCHEMA_VERSION = "candidate-profile-v1" as const;

// Configurable validated input limit — Phase 2.1 implementation initial value.
// NOT a frozen product contract (see PHASE-2-CONTRACT.md §2.1): the final value
// will be re-measured in Phase 2.1/2.4.
// Engineering rationale: DeepSeek context ≫ 12k chars; the profile-structuring
// prompt plus raw text stays well within context; 12,000 CJK chars ≈ 6–9k
// tokens, keeping latency and repair/retry budget reasonable; aligned with the
// Phase 1 JD limit for symmetric UI behavior.
export const MIN_PROFILE_LENGTH = 20;
export const MAX_PROFILE_LENGTH = 12_000;

export const analyzeProfileRequestSchema = z
  .object({
    profileText: z
      .string()
      .trim()
      .min(MIN_PROFILE_LENGTH, `候选人资料至少需要 ${MIN_PROFILE_LENGTH} 个字符`)
      .max(MAX_PROFILE_LENGTH, `候选人资料不能超过 ${MAX_PROFILE_LENGTH} 个字符`),
  })
  .strict();

export type AnalyzeProfileRequest = z.infer<typeof analyzeProfileRequestSchema>;

export interface ProfileEvidence {
  id: string;
  text: string;
}

export const pfIdPattern = /^PF-\d{3,}$/;

/**
 * Builds a stable PF ledger from the raw profile text: one PF per non-empty
 * trimmed line, in input order, deduplicated by exact text.
 */
export function buildProfileEvidenceLedger(rawText: string): ProfileEvidence[] {
  const seen = new Set<string>();
  const ledger: ProfileEvidence[] = [];
  for (const line of rawText.split(/\r?\n/)) {
    const text = line.trim();
    if (text.length === 0 || seen.has(text)) continue;
    seen.add(text);
    ledger.push({ id: `PF-${String(ledger.length + 1).padStart(3, "0")}`, text });
  }
  return ledger;
}

export function resolvePfText(ledger: ProfileEvidence[], id: string): string | null {
  return ledger.find((item) => item.id === id)?.text ?? null;
}

function pfContainingSpan(ledger: ProfileEvidence[], span: string): string | null {
  const matches = ledger.filter((item) => item.text.includes(span));
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Resolves a model-emitted evidence reference to a single PF id.
 * Accepts: (1) a PF id that exists in the ledger; (2) raw text that is a
 * verbatim substring of the raw profile; (3) whitespace-normalized unique
 * spans (Phase 1 style fallback). No semantic-similarity matching, no
 * evidence pointing at model output. Returns null when ambiguous or absent.
 */
export function resolveEvidenceToPf(
  evidence: string,
  rawText: string,
  ledger: ProfileEvidence[],
): string | null {
  const trimmed = evidence.trim();
  if (trimmed.length === 0) return null;

  if (pfIdPattern.test(trimmed)) {
    return resolvePfText(ledger, trimmed) !== null ? trimmed : null;
  }

  if (isEvidenceInJd(trimmed, rawText)) {
    return pfContainingSpan(ledger, trimmed);
  }

  const spans = findNormalizedEvidenceSpans(trimmed, rawText);
  if (spans.length !== 1) return null;
  return pfContainingSpan(ledger, spans[0]);
}

const questionToConfirmSchema = z
  .object({
    question: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

// ---- Raw profile analysis schema (loose; model output entry) ----
const rawCandidateFactSchema = z
  .object({
    value: z.string().trim().min(1).max(200),
    sourceType: z
      .enum(["profile_stated", "normalized_stated", "profile_inferred", "to_verify"])
      .optional()
      .default("normalized_stated"),
    pfEvidence: z.array(z.string()).optional().default([]),
    verificationQuestion: z.string().max(200).nullable().optional().default(null),
  })
  .strict();

const rawDerivedObservationSchema = z
  .object({
    content: z.string().trim().min(1).max(320),
    sourceType: z.literal("profile_inferred"),
    pfEvidence: z.array(z.string()).optional().default([]),
    verificationQuestion: z.string().max(200).nullable().optional().default(null),
  })
  .strict();

export const rawProfileAnalysisSchema = z
  .object({
    careerTarget: rawCandidateFactSchema.nullable().optional(),
    education: z.array(rawCandidateFactSchema).optional().default([]),
    experiences: z.array(rawCandidateFactSchema).optional().default([]),
    projects: z.array(rawCandidateFactSchema).optional().default([]),
    skills: z.array(rawCandidateFactSchema).optional().default([]),
    certificates: z.array(rawCandidateFactSchema).optional().default([]),
    portfolio: z.array(rawCandidateFactSchema).optional().default([]),
    preferences: z.array(rawCandidateFactSchema).optional().default([]),
    derivedObservations: z.array(rawDerivedObservationSchema).optional().default([]),
    unknowns: z.array(z.string().trim().min(1).max(200)).optional().default([]),
    questionsToConfirm: z.array(questionToConfirmSchema).optional().default([]),
  })
  .strict();

export type RawProfileAnalysis = z.infer<typeof rawProfileAnalysisSchema>;

// ---- Final candidate fact / derived observation schema ----
const finalCandidateFactSchema = z
  .object({
    value: z.string().trim().min(1).max(200),
    sourceType: z.enum(["profile_stated", "normalized_stated"]),
    pfEvidence: z.array(z.string().regex(pfIdPattern)).min(1).max(3),
    verificationQuestion: z.null(),
  })
  .strict();

const finalDerivedObservationSchema = z
  .object({
    content: z.string().trim().min(1).max(320),
    sourceType: z.literal("profile_inferred"),
    pfEvidence: z.array(z.string().regex(pfIdPattern)).min(1).max(3),
    verificationQuestion: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export const finalCandidateProfileSchema = z
  .object({
    careerTarget: finalCandidateFactSchema.nullable(),
    education: z.array(finalCandidateFactSchema).max(6),
    experiences: z.array(finalCandidateFactSchema).max(8),
    projects: z.array(finalCandidateFactSchema).max(8),
    skills: z.array(finalCandidateFactSchema).max(12),
    certificates: z.array(finalCandidateFactSchema).max(6),
    portfolio: z.array(finalCandidateFactSchema).max(6),
    preferences: z.array(finalCandidateFactSchema).max(4),
    derivedObservations: z.array(finalDerivedObservationSchema).max(6),
    unknowns: z.array(z.string().trim().min(1).max(200)).max(8),
    questionsToConfirm: z.array(questionToConfirmSchema).max(8),
    evidence: z
      .array(z.object({ id: z.string().regex(pfIdPattern), text: z.string().trim().min(1) }))
      .max(30),
  })
  .strict();

export const finalProfileStructureSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
    profileProvided: z.literal(true),
    candidateProfile: finalCandidateProfileSchema,
  })
  .strict();

export type FinalCandidateFact = z.infer<typeof finalCandidateFactSchema>;
export type FinalProfileStructure = z.infer<typeof finalProfileStructureSchema>;

// ---- Semantic preservation checks (Gate PF-C / PF-A heuristics) ----
const UPGRADE_RULES: Array<{ marker: RegExp; support: RegExp }> = [
  { marker: /熟练|精通/, support: /熟练|精通|日常使用|长期使用|大量使用|主要负责/ },
  { marker: /独立负责|独立开发|主导/, support: /独立|主导/ },
  { marker: /多年/, support: /多年|[一二三四五六七八九十\d]+\s*年/ },
  { marker: /正式工作|全职/, support: /正式|全职|工作/ },
  { marker: /实习经历/, support: /实习/ },
];

export function findSemanticUpgradeViolations(
  factValue: string,
  pfTexts: string[],
): string[] {
  const violations: string[] = [];
  const combined = pfTexts.join(" ");
  for (const rule of UPGRADE_RULES) {
    if (rule.marker.test(factValue) && !rule.support.test(combined)) {
      violations.push(rule.marker.source);
    }
  }
  return violations;
}

const PROFILE_STOP_TOKENS = new Set([
  "项目", "经验", "能力", "参与", "负责", "完成", "做过", "具备", "了解",
  "熟悉", "掌握", "学习", "相关", "工作", "实习", "课程", "团队", "主要",
  "进行", "包括", "以及", "并且", "自己", "我们", "获得", "取得",
]);

/**
 * Checks that a normalized fact shares at least one meaningful 2-character
 * token with its PF texts (traceability). Catches facts that have no raw
 * support at all (hallucination guard).
 */
export function hasFactTraceability(factValue: string, pfTexts: string[]): boolean {
  if (pfTexts.length === 0) return false;
  for (let index = 0; index < factValue.length - 1; index += 1) {
    const token = factValue.slice(index, index + 2);
    if (PROFILE_STOP_TOKENS.has(token)) continue;
    if (/\s/.test(token)) continue;
    if (pfTexts.some((text) => text.includes(token))) return true;
  }
  return false;
}

/**
 * Stronger traceability used when re-classifying a mislabeled profile_stated
 * fact as normalized_stated: at least `threshold` of the meaningful 2-char
 * tokens of the fact must appear in the PF texts (near-verbatim minimal
 * normalization only; heavy paraphrases are rejected).
 */
export function hasHighTraceability(
  factValue: string,
  pfTexts: string[],
  threshold = 0.6,
): boolean {
  const combined = pfTexts.join("");
  const tokens: string[] = [];
  for (let index = 0; index < factValue.length - 1; index += 1) {
    const token = factValue.slice(index, index + 2);
    if (/\s/.test(token) || PROFILE_STOP_TOKENS.has(token)) continue;
    tokens.push(token);
  }
  if (tokens.length === 0) return false;
  const matched = tokens.filter((token) => combined.includes(token)).length;
  return matched / tokens.length >= threshold;
}
