import { z } from "zod";

import { ApiError } from "./api-errors";
import {
  CompletionEvidenceError,
  initialAttemptDiagnostics,
  markCompletionFailure,
  markCompletionReceived,
  type GenerationAttemptDiagnostics,
  type RepairLifecycleState,
} from "./generation-evidence";
import { findNormalizedEvidenceSpans, isEvidenceInJd } from "./analysis-schema";
import {
  captureStrengthGapOutputEvidence,
  type StrengthGapOutputEvidence,
} from "./strength-gap-evidence";
import {
  buildCoverageRepairMessages,
  buildProfileStructuringMessages,
} from "./profile-prompt";
import {
  buildProfileEvidenceLedger,
  finalProfileStructureSchema,
  findSemanticUpgradeViolations,
  isAllowlistedNormalization,
  isSafeSharedQualifierEnumeration,
  PF_DISPOSITIONS,
  PROFILE_SCHEMA_VERSION,
  SEMANTIC_TAG_TO_PROJECTION,
  rawPfCoverageItemSchema,
  resolveEvidenceToPf,
  resolvePfText,
} from "./profile-schema";
import type {
  AnalyzeProfileRequest,
  FinalProfileStructure,
  PfDisposition,
  ProfileEvidence,
  ProfileProjectionKey,
  ProfileSemanticTag,
  RawAtomicClaim,
} from "./profile-schema";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 4096;

type DispositionCounts = Record<PfDisposition, number>;

export interface ProfileDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  pfLedgerCount: number;
  pfTotal: number;
  pfDispositionCounts: DispositionCounts;
  candidateFactPfCount: number;
  atomicClaimCount: number;
  unprocessedPfCount: number;
  completenessRepairRequestCount: number;
  atomicClaimRepairCount: number;
  semanticRepairRequestCount: number;
  projectionRepairCount: number;
  deterministicCanonicalizationCount: number;
  finalFactCount: number;
  profileFactRecall: number | null;
  latencyMs: number;
  removedFactCount: number;
  invalidEvidenceCount: number;
  semanticUpgradeViolationCount: number;
  untraceableFactCount: number;
  layeringViolationCount: number;
  unusedPfCount: number;
  completenessRepairUsed: boolean;
  completenessRepairSucceeded: boolean;
  droppedCandidateFactCount: number;
  profileRepairAttempted: boolean;
  profileRepairSucceeded: boolean;
  finalSchemaValidationPassed: boolean;
  finalEvidenceValidationPassed: boolean;
  finalValidationPassed: boolean;
  truncatedByLength: boolean;
  outputCompletionTokens: number;
  evidenceCaptureEnabled: boolean;
  initialAttempt: GenerationAttemptDiagnostics;
  repairState: RepairLifecycleState;
  repairAttempt: GenerationAttemptDiagnostics;
  outputEvidence: StrengthGapOutputEvidence[];
}

interface ProfileOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  captureRejectedEvidence?: boolean;
  onDiagnostics?: (diagnostics: ProfileDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<ProfileOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
>;
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface ValidatedAtomicClaim {
  statement: string;
  sourceType: "profile_stated" | "normalized_stated";
  pfEvidence: string[];
  semanticTags: ProfileSemanticTag[];
}

interface ValidatedCoverageItem {
  pfId: string;
  disposition: PfDisposition;
  atomicClaims: ValidatedAtomicClaim[];
  duplicateOf: string | null;
}

interface CoverageValidation {
  accepted: Map<string, ValidatedCoverageItem>;
  problems: Map<string, string[]>;
}

const coverageEnvelopeSchema = z
  .object({ coverage: z.array(z.unknown()).max(30) })
  .strict();

const projectionCaps: Record<ProfileProjectionKey, number> = {
  careerTarget: 1,
  education: 6,
  experiences: 8,
  projects: 8,
  skills: 12,
  certificates: 6,
  portfolio: 6,
  preferences: 4,
};

function emptyDispositionCounts(): DispositionCounts {
  return Object.fromEntries(PF_DISPOSITIONS.map((item) => [item, 0])) as DispositionCounts;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mapHttpError(status: number) {
  switch (status) {
    case 400:
    case 422:
      return new ApiError("AI_REQUEST_INVALID", 502);
    case 401:
      return new ApiError("AI_AUTH_FAILED", 503);
    case 402:
      return new ApiError("AI_BALANCE_INSUFFICIENT", 503);
    case 429:
      return new ApiError("AI_RATE_LIMITED", 503, true);
    case 500:
    case 503:
      return new ApiError("AI_SERVICE_UNAVAILABLE", 503, true);
    default:
      return new ApiError("AI_SERVICE_UNAVAILABLE", 503);
  }
}

function parseJson(content: string, warning: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    console.warn(`[profile] ${warning}`);
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

function coverageProblemIssues(problems: Map<string, string[]>) {
  return [...problems].flatMap(([pfId, reasons]) =>
    reasons.map((message) => ({ path: `coverage.${pfId}`, message })),
  );
}

async function requestCompletion(
  messages: ChatMessage[],
  configuration: CompletionConfig,
  timeoutMs: number,
  diagnostics: ProfileDiagnostics,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await configuration.fetchImpl(
      `${configuration.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: configuration.model,
          messages,
          thinking: { type: "disabled" },
          stream: false,
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const apiError = mapHttpError(response.status);
      throw new CompletionEvidenceError(
        apiError.code,
        apiError.status,
        {
          completionReceived: false,
          rawText: null,
          rawAvailable: false,
          finishReason: null,
          failureStage: "provider_response",
          failureCategory: "provider",
        },
        apiError.autoRetryable,
      );
    }

    let payload: {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string };
      }>;
      usage?: { completion_tokens?: number };
    };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new CompletionEvidenceError(
        "AI_EMPTY_RESPONSE",
        502,
        {
          completionReceived: false,
          rawText: null,
          rawAvailable: false,
          finishReason: null,
          failureStage: "provider_response",
          failureCategory: "provider",
        },
        true,
      );
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!choice || !content) {
      throw new CompletionEvidenceError(
        "AI_EMPTY_RESPONSE",
        502,
        {
          completionReceived: Boolean(choice),
          rawText: null,
          rawAvailable: false,
          finishReason: choice?.finish_reason ?? null,
          failureStage: "completion",
          failureCategory: "empty_output",
        },
        true,
      );
    }

    if (typeof payload.usage?.completion_tokens === "number") {
      diagnostics.outputCompletionTokens = Math.max(
        diagnostics.outputCompletionTokens,
        payload.usage.completion_tokens,
      );
    }
    if (choice.finish_reason === "length") {
      diagnostics.truncatedByLength = true;
      throw new CompletionEvidenceError("AI_OUTPUT_INVALID", 502, {
        completionReceived: true,
        rawText: content,
        rawAvailable: true,
        finishReason: "length",
        failureStage: "completion",
        failureCategory: "truncated",
      });
    } else if (choice.finish_reason === "content_filter") {
      throw new CompletionEvidenceError("AI_CONTENT_BLOCKED", 422, {
        completionReceived: true,
        rawText: content,
        rawAvailable: true,
        finishReason: "content_filter",
        failureStage: "completion",
        failureCategory: "content_filter",
      });
    } else if (
      choice.finish_reason &&
      choice.finish_reason !== "stop" &&
      choice.finish_reason !== "insufficient_system_resource"
    ) {
      console.warn("[profile] abnormal finish reason", {
        finishReason: choice.finish_reason,
      });
    }
    return { content, finishReason: choice.finish_reason ?? null };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CompletionEvidenceError("AI_TIMEOUT", 504, {
        completionReceived: false,
        rawText: null,
        rawAvailable: false,
        finishReason: null,
        failureStage: "provider_request",
        failureCategory: "timeout",
      });
    }
    throw new CompletionEvidenceError("AI_SERVICE_UNAVAILABLE", 503, {
      completionReceived: false,
      rawText: null,
      rawAvailable: false,
      finishReason: null,
      failureStage: "provider_request",
      failureCategory: "transport",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestInitialCoverage(
  request: AnalyzeProfileRequest,
  ledger: ProfileEvidence[],
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: ProfileDiagnostics,
) {
  let lastError: ApiError | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildProfileStructuringMessages(request, ledger),
        configuration,
        remaining,
        diagnostics,
      );
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError("AI_SERVICE_UNAVAILABLE", 503);
      lastError = apiError;
      const canRetry =
        attempt === 0 &&
        apiError.autoRetryable &&
        deadline - Date.now() > RETRY_DELAY_MS;
      if (!canRetry) throw apiError;
      await wait(RETRY_DELAY_MS);
    }
  }
  throw lastError ?? new ApiError("AI_SERVICE_UNAVAILABLE", 503);
}

function resolveEvidenceIds(
  evidence: string[],
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
): string[] {
  const ids: string[] = [];
  for (const item of evidence) {
    const id = resolveEvidenceToPf(item, rawText, ledger);
    if (id && !ids.includes(id)) ids.push(id);
    else diagnostics.invalidEvidenceCount += 1;
  }
  return ids.slice(0, 3);
}

function normalizeAtomicClaim(
  item: RawAtomicClaim,
  primaryPf: ProfileEvidence,
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
): ValidatedAtomicClaim | null {
  const pfEvidence = resolveEvidenceIds(
    item.pfEvidence,
    rawText,
    ledger,
    diagnostics,
  );
  if (!pfEvidence.includes(primaryPf.id)) {
    diagnostics.invalidEvidenceCount += 1;
    return null;
  }

  const pfTexts = pfEvidence
    .map((id) => resolvePfText(ledger, id) ?? "")
    .filter(Boolean);
  const upgrades = findSemanticUpgradeViolations(item.statement, pfTexts);
  if (upgrades.length > 0) {
    diagnostics.semanticUpgradeViolationCount += upgrades.length;
    return null;
  }

  const inferredTags = inferSemanticTags(item.statement, primaryPf.text);
  const supportedModelTags = item.semanticTags.filter((tag) =>
    isSemanticTagSupported(tag, item.statement, primaryPf.text),
  );
  const semanticTags = uniqueTags([...supportedModelTags, ...inferredTags]);
  if (
    semanticTags.length === 0 ||
    semanticTags.length !== item.semanticTags.length ||
    semanticTags.some((tag, index) => tag !== item.semanticTags[index])
  ) {
    diagnostics.projectionRepairCount += 1;
  }
  if (semanticTags.length === 0) {
    diagnostics.layeringViolationCount += 1;
    return null;
  }

  // Preserve material scope: tool usage in a course clause must keep that
  // context in the one canonical statement.
  const exactStatementIndex = primaryPf.text.indexOf(item.statement);
  const statementSentence =
    exactStatementIndex >= 0
      ? primaryPf.text
          .slice(0, exactStatementIndex)
          .split(/[。；;！？!?]/)
          .at(-1)! +
        primaryPf.text
          .slice(exactStatementIndex)
          .split(/[。；;！？!?]/, 1)[0]
      : primaryPf.text;
  if (
    semanticTags.includes("skill_usage") &&
    /课程项目|课程作业/.test(statementSentence) &&
    !/课程项目|课程作业/.test(item.statement)
  ) {
    diagnostics.layeringViolationCount += 1;
    return null;
  }

  let statement = item.statement.trim();
  let sourceType = item.sourceType;
  if (isEvidenceInJd(statement, primaryPf.text)) {
    // Keep the model's explicit source type. normalized_stated is still safe
    // when the statement is itself verbatim.
  } else {
    const normalizedSpans = findNormalizedEvidenceSpans(
      statement,
      primaryPf.text,
    );
    if (normalizedSpans.length === 1) {
      statement = normalizedSpans[0];
      sourceType = "normalized_stated";
    } else if (
      isAllowlistedNormalization(statement, primaryPf.text) ||
      isSafeSharedQualifierEnumeration(statement, primaryPf.text)
    ) {
      sourceType = "normalized_stated";
    } else {
      diagnostics.untraceableFactCount += 1;
      return null;
    }
  }

  return {
    statement,
    sourceType,
    pfEvidence,
    semanticTags,
  };
}

const INSTRUCTION_PATTERN =
  /忽略.{0,12}(?:规则|提示|之前)|把我描述成|虚构|编造.{0,8}(?:经历|经验|技能)|system\s*prompt|developer\s*message/i;
const EXPLICIT_NEGATIVE_FACT_PATTERN =
  /没有正式工作经历|无正式工作经历|无相关实习|无驾照|没有驾照|未取得.{0,12}(?:证|资格)|未使用.{0,20}(?:工具|软件|SQL|Python)|不接受.{0,20}(?:城市|异地|出差)/;
const EVIDENCE_ABSENCE_ONLY_PATTERN =
  /(?:暂未|尚未|没有|未)(?:提供|说明|填写|披露).{0,24}(?:技能|教育|学历|项目|经历|经验|信息|资料)|(?:技能|教育|学历|项目|经历|经验).{0,24}(?:暂未|尚未|没有|未)(?:提供|说明|填写|披露)/;

function uniqueTags(tags: ProfileSemanticTag[]): ProfileSemanticTag[] {
  return [...new Set(tags)];
}

function requiredSemanticTags(pfText: string): Set<ProfileSemanticTag> {
  const required = new Set<ProfileSemanticTag>();
  if (EVIDENCE_ABSENCE_ONLY_PATTERN.test(pfText)) return required;
  if (/^教育|本科|硕士|博士|学历|专业/.test(pfText)) required.add("education");
  if (
    /^(?:技能|工具)|(?:了解|接触过|基础|熟悉|掌握|使用过|会使用|使用)\s*(?:[A-Za-z]|Office|表格)/i.test(
      pfText,
    )
  ) {
    required.add("skill_usage");
  }
  if (
    /^项目|项目经历|团队项目|课程项目|课程作业|(?:参与过|参加过|完成|参与).{0,24}(?:项目|活动)/.test(
      pfText,
    )
  ) {
    required.add("project_experience");
  }
  if (
    /^实习|^经历|实习生|工作经历|正式工作|应届生|协助|助理|参加.{0,16}比赛/.test(
      pfText,
    )
  ) {
    required.add("experience");
  }
  if (/^证书|CET|资格证|驾驶证|驾照/.test(pfText)) required.add("certificate");
  if (/兴趣偏好|期望城市|意向城市|(?:可接受|不接受).{0,12}(?:城市|异地|出差)/.test(pfText)) {
    required.add("preference");
  }
  if (/求职偏好|求职方向|职业方向|目标岗位/.test(pfText)) required.add("career_target");
  if (/^(?:作品|作品集|成果|GitHub|仓库链接)/i.test(pfText)) {
    required.add("portfolio");
  }
  return required;
}

function inferSemanticTags(
  statement: string,
  pfText: string,
): ProfileSemanticTag[] {
  const tags = new Set<ProfileSemanticTag>();
  if (/教育|本科|硕士|博士|学历|专业|大学|学院/.test(statement)) {
    tags.add("education");
  }
  if (
    /(?:工具|Office|表格)|(?:了解|接触过|基础|熟悉|掌握|使用过|会使用|使用)\s*[A-Za-z][A-Za-z0-9.+#-]*/i.test(
      statement,
    )
  ) {
    tags.add("skill_usage");
  }
  if (
    /项目|课程作业|校园.{0,8}活动|活动策划|(?:参与过|参加过).{0,24}活动/.test(
      statement,
    )
  ) {
    tags.add("project_experience");
  }
  if (
    /实习|工作经历|正式工作|全职|应届生|协助|助理|比赛|竞赛/.test(
      statement,
    )
  ) {
    tags.add("experience");
  }
  if (/证书|CET|资格证|驾驶证|驾照/.test(statement)) tags.add("certificate");
  if (/作品|作品集|成果|GitHub|仓库链接/i.test(statement)) tags.add("portfolio");
  if (/求职偏好|求职方向|职业方向|目标岗位|方向$/.test(statement)) {
    tags.add("career_target");
  }
  if (/期望城市|意向城市|(?:可接受|不接受).{0,12}(?:城市|异地|出差)|偏好/.test(statement)) {
    tags.add("preference");
  }
  if (/^求职偏好/.test(pfText)) tags.add("career_target");
  if (/^兴趣偏好/.test(pfText)) tags.add("preference");

  const required = requiredSemanticTags(pfText);
  if (tags.size === 0 && required.size === 1) tags.add([...required][0]);
  return [...tags];
}

function isSemanticTagSupported(
  tag: ProfileSemanticTag,
  statement: string,
  pfText: string,
) {
  if (inferSemanticTags(statement, pfText).includes(tag)) return true;
  const required = requiredSemanticTags(pfText);
  return required.size === 1 && required.has(tag);
}

function courseToolCanonicalClaim(
  pf: ProfileEvidence,
): RawAtomicClaim | null {
  const clause = pf.text
    .split(/[。；;！？!?]/)
    .map((item) => item.trim())
    .find(
      (item) =>
        /课程项目|课程作业/.test(item) &&
        /(?:了解|接触过|基础|熟悉|掌握|使用过|会使用|使用)\s*[A-Za-z][A-Za-z0-9.+#-]*/i.test(
          item,
        ),
    );
  if (!clause) return null;
  const withoutPrefix = clause.replace(/^[^：:]{1,16}[：:]/, "").trim();
  const statement = /课程项目|课程作业/.test(withoutPrefix)
    ? withoutPrefix
    : clause;
  return {
    statement,
    semanticTags: ["project_experience", "skill_usage"],
    sourceType: "normalized_stated",
    pfEvidence: [pf.id],
  };
}

function splitMixedPolarityClaims(claims: RawAtomicClaim[]) {
  let splitCount = 0;
  const data = claims.flatMap((claim) => {
    const clauses = claim.statement
      .split(
        /[；;]|[，,](?=(?:没有|未曾|从未|不具备|未)(?:独立)?(?:负责|主导|完成|参与|从事|取得|持有))/,
      )
      .map((clause) => clause.trim())
      .filter(Boolean);
    const negativeIndex = clauses.findIndex((clause) =>
      /(?:没有|未曾|从未|不具备|未)(?:独立)?(?:负责|主导|完成|参与|从事|取得|持有)/.test(
        clause,
      ),
    );
    if (
      clauses.length < 2 ||
      negativeIndex <= 0 ||
      !clauses
        .slice(0, negativeIndex)
        .some((clause) => /协助|参与|整理|登记|使用|完成|负责/.test(clause))
    ) {
      return [claim];
    }
    splitCount += clauses.length - 1;
    return clauses.map((statement) => ({
      ...claim,
      statement,
      semanticTags: [...claim.semanticTags],
      pfEvidence: [...claim.pfEvidence],
    }));
  });
  return { data, splitCount };
}

function addProblem(
  problems: Map<string, string[]>,
  pfId: string,
  reason: string,
) {
  const current = problems.get(pfId) ?? [];
  if (!current.includes(reason)) current.push(reason);
  problems.set(pfId, current);
}

function validateCoverageResponse(
  parsed: unknown,
  expectedPfs: ProfileEvidence[],
  rawText: string,
  fullLedger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
): CoverageValidation {
  const accepted = new Map<string, ValidatedCoverageItem>();
  const problems = new Map<string, string[]>();
  const expectedIds = new Set(expectedPfs.map((item) => item.id));
  const envelope = coverageEnvelopeSchema.safeParse(parsed);

  if (!envelope.success) {
    for (const pf of expectedPfs) {
      addProblem(problems, pf.id, "coverage envelope/schema invalid");
    }
    return { accepted, problems };
  }

  const occurrences = new Map<string, unknown[]>();
  for (const rawItem of envelope.data.coverage) {
    const pfId =
      typeof rawItem === "object" &&
      rawItem !== null &&
      "pfId" in rawItem &&
      typeof rawItem.pfId === "string"
        ? rawItem.pfId
        : null;
    if (!pfId || !expectedIds.has(pfId)) continue;
    const list = occurrences.get(pfId) ?? [];
    list.push(rawItem);
    occurrences.set(pfId, list);
  }

  for (const pf of expectedPfs) {
    const candidates = occurrences.get(pf.id) ?? [];
    if (candidates.length !== 1) {
      addProblem(
        problems,
        pf.id,
        candidates.length === 0
          ? "PF has no disposition"
          : "PF has duplicate dispositions",
      );
      continue;
    }

    const itemResult = rawPfCoverageItemSchema.safeParse(candidates[0]);
    if (!itemResult.success) {
      addProblem(problems, pf.id, "PF disposition/atomicClaims schema invalid");
      continue;
    }
    const item = itemResult.data;

    if (
      item.disposition === "duplicate" &&
      (item.duplicateOf === pf.id ||
        !fullLedger.some((entry) => entry.id === item.duplicateOf))
    ) {
      addProblem(problems, pf.id, "duplicateOf does not reference another PF");
      continue;
    }
    if (INSTRUCTION_PATTERN.test(pf.text) && item.disposition !== "instruction_text") {
      addProblem(problems, pf.id, "instruction text must use instruction_text disposition");
      continue;
    }
    if (
      EXPLICIT_NEGATIVE_FACT_PATTERN.test(pf.text) &&
      item.disposition !== "candidate_fact_source"
    ) {
      addProblem(problems, pf.id, "explicit negative candidate fact was not extracted");
      continue;
    }

    const requiredTags = requiredSemanticTags(pf.text);
    if (
      requiredTags.size > 0 &&
      item.disposition !== "candidate_fact_source"
    ) {
      addProblem(
        problems,
        pf.id,
        `PF contains explicit candidate fact semantics: ${[...requiredTags].join(", ")}`,
      );
      continue;
    }

    const claims: ValidatedAtomicClaim[] = [];
    let claimInvalid = false;
    const scopedCourseToolClaim = courseToolCanonicalClaim(pf);
    const scopedRawClaims = scopedCourseToolClaim
      ? [
          ...item.atomicClaims.filter(
            (claim) =>
              !claim.semanticTags.some((tag) =>
                ["project_experience", "skill_usage"].includes(tag),
              ) &&
              !/课程项目|课程作业|(?:了解|接触过|基础|熟悉|掌握|使用过|会使用|使用)\s*[A-Za-z]/i.test(
                claim.statement,
              ),
          ),
          scopedCourseToolClaim,
        ]
      : item.atomicClaims;
    const mixedPolaritySplit = splitMixedPolarityClaims(scopedRawClaims);
    const rawClaims = mixedPolaritySplit.data;
    if (mixedPolaritySplit.splitCount > 0) {
      diagnostics.deterministicCanonicalizationCount +=
        mixedPolaritySplit.splitCount;
      diagnostics.projectionRepairCount += mixedPolaritySplit.splitCount;
    }
    if (scopedCourseToolClaim) {
      diagnostics.deterministicCanonicalizationCount += 1;
      if (
        !item.atomicClaims.some(
          (claim) =>
            claim.statement === scopedCourseToolClaim.statement &&
            claim.semanticTags.includes("project_experience") &&
            claim.semanticTags.includes("skill_usage"),
        )
      ) {
        diagnostics.projectionRepairCount += 1;
      }
    }

    for (const rawClaim of rawClaims) {
      const claim = normalizeAtomicClaim(
        rawClaim,
        pf,
        rawText,
        fullLedger,
        diagnostics,
      );
      if (!claim) {
        claimInvalid = true;
        diagnostics.droppedCandidateFactCount += 1;
        continue;
      }
      const existing = claims.find(
        (candidate) =>
          candidate.statement === claim.statement &&
          candidate.pfEvidence.join("\u0000") === claim.pfEvidence.join("\u0000"),
      );
      if (existing) {
        existing.semanticTags = uniqueTags([
          ...existing.semanticTags,
          ...claim.semanticTags,
        ]);
      } else {
        claims.push(claim);
      }
    }
    if (claimInvalid) {
      addProblem(problems, pf.id, "one or more atomic claims failed strict validation");
      continue;
    }
    if (item.disposition === "candidate_fact_source" && claims.length === 0) {
      addProblem(problems, pf.id, "candidate-fact PF has no validated atomic claims");
      continue;
    }

    const extractedTags = new Set(claims.flatMap((claim) => claim.semanticTags));
    const missingTags = [...requiredTags].filter(
      (tag) => !extractedTags.has(tag),
    );
    if (missingTags.length > 0) {
      addProblem(
        problems,
        pf.id,
        `canonical atomic claims omitted explicit semantics: ${missingTags.join(", ")}; repair the missing semantic content without duplicating statements`,
      );
      continue;
    }

    accepted.set(pf.id, {
      pfId: pf.id,
      disposition: item.disposition,
      atomicClaims: claims,
      duplicateOf: item.duplicateOf,
    });
  }

  return { accepted, problems };
}

async function requestCoverageRepair(
  problemPfs: ProfileEvidence[],
  reasons: string[],
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: ProfileDiagnostics,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
  diagnostics.upstreamAttempts += 1;
  diagnostics.completenessRepairRequestCount += 1;
  diagnostics.atomicClaimRepairCount += problemPfs.length;
  diagnostics.semanticRepairRequestCount += 1;
  return requestCompletion(
    buildCoverageRepairMessages(problemPfs, reasons),
    configuration,
    remaining,
    diagnostics,
  );
}

function buildCandidateProfile(
  coverage: ValidatedCoverageItem[],
  ledger: ProfileEvidence[],
) {
  const canonicalDrafts: ValidatedAtomicClaim[] = [];
  for (const item of coverage) {
    for (const claim of item.atomicClaims) {
      const existing = canonicalDrafts.find(
        (fact) =>
          fact.statement === claim.statement &&
          fact.pfEvidence.join("\u0000") === claim.pfEvidence.join("\u0000"),
      );
      if (existing) {
        existing.semanticTags = uniqueTags([
          ...existing.semanticTags,
          ...claim.semanticTags,
        ]);
      } else {
        canonicalDrafts.push({ ...claim, semanticTags: [...claim.semanticTags] });
      }
    }
  }
  if (canonicalDrafts.length === 0 || canonicalDrafts.length > 60) return null;

  const canonicalFacts = canonicalDrafts.map((fact, index) => ({
    factId: `CF-${String(index + 1).padStart(3, "0")}`,
    statement: fact.statement,
    sourceType: fact.sourceType,
    pfEvidence: fact.pfEvidence,
    semanticTags: fact.semanticTags,
  }));
  const projections: Record<ProfileProjectionKey, string[]> = {
    careerTarget: [],
    education: [],
    experiences: [],
    projects: [],
    skills: [],
    certificates: [],
    portfolio: [],
    preferences: [],
  };
  for (const fact of canonicalFacts) {
    for (const tag of fact.semanticTags) {
      const key = SEMANTIC_TAG_TO_PROJECTION[tag];
      if (!projections[key].includes(fact.factId)) projections[key].push(fact.factId);
    }
  }
  for (const key of Object.keys(projectionCaps) as ProfileProjectionKey[]) {
    if (projections[key].length > projectionCaps[key]) return null;
  }

  return {
    canonicalFacts,
    careerTarget: projections.careerTarget[0] ?? null,
    education: projections.education,
    experiences: projections.experiences,
    projects: projections.projects,
    skills: projections.skills,
    certificates: projections.certificates,
    portfolio: projections.portfolio,
    preferences: projections.preferences,
    derivedObservations: [],
    unknowns: [],
    questionsToConfirm: [],
    evidence: ledger.map(({ id, text }) => ({ id, text })),
  };
}

function finalizeProfile(
  candidateProfile: NonNullable<ReturnType<typeof buildCandidateProfile>>,
  ledger: ProfileEvidence[],
  rawText: string,
): FinalProfileStructure | null {
  const result = finalProfileStructureSchema.safeParse({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profileProvided: true,
    candidateProfile,
  });
  if (!result.success) return null;

  const totalFacts = result.data.candidateProfile.canonicalFacts.length;
  if (ledger.length > 0 && totalFacts === 0) return null;

  const ids = new Set(ledger.map((item) => item.id));
  for (const fact of result.data.candidateProfile.canonicalFacts) {
    if (fact.pfEvidence.some((id) => !ids.has(id))) return null;
  }
  if (ledger.some((item) => !isEvidenceInJd(item.text, rawText))) return null;
  return result.data;
}

function updateCoverageDiagnostics(
  diagnostics: ProfileDiagnostics,
  coverage: ValidatedCoverageItem[],
) {
  diagnostics.pfDispositionCounts = emptyDispositionCounts();
  diagnostics.candidateFactPfCount = 0;
  diagnostics.atomicClaimCount = 0;
  for (const item of coverage) {
    diagnostics.pfDispositionCounts[item.disposition] += 1;
    if (item.disposition === "candidate_fact_source") {
      diagnostics.candidateFactPfCount += 1;
    }
    diagnostics.atomicClaimCount += item.atomicClaims.length;
  }
}

export async function analyzeProfileWithDeepSeek(
  request: AnalyzeProfileRequest,
  options: ProfileOptions = {},
): Promise<FinalProfileStructure> {
  const startedAt = Date.now();
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new ApiError("AI_AUTH_FAILED", 503);

  const configuration: CompletionConfig = {
    fetchImpl: options.fetchImpl ?? fetch,
    apiKey,
    model: options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
    baseUrl: options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL,
  };
  const deadline = Date.now() + (options.timeoutMs ?? TOTAL_TIMEOUT_MS);
  const diagnostics: ProfileDiagnostics = {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    pfLedgerCount: 0,
    pfTotal: 0,
    pfDispositionCounts: emptyDispositionCounts(),
    candidateFactPfCount: 0,
    atomicClaimCount: 0,
    unprocessedPfCount: 0,
    completenessRepairRequestCount: 0,
    atomicClaimRepairCount: 0,
    semanticRepairRequestCount: 0,
    projectionRepairCount: 0,
    deterministicCanonicalizationCount: 0,
    finalFactCount: 0,
    profileFactRecall: null,
    latencyMs: 0,
    removedFactCount: 0,
    invalidEvidenceCount: 0,
    semanticUpgradeViolationCount: 0,
    untraceableFactCount: 0,
    layeringViolationCount: 0,
    unusedPfCount: 0,
    completenessRepairUsed: false,
    completenessRepairSucceeded: false,
    droppedCandidateFactCount: 0,
    profileRepairAttempted: false,
    profileRepairSucceeded: false,
    finalSchemaValidationPassed: false,
    finalEvidenceValidationPassed: false,
    finalValidationPassed: false,
    truncatedByLength: false,
    outputCompletionTokens: 0,
    evidenceCaptureEnabled: options.captureRejectedEvidence === true,
    initialAttempt: initialAttemptDiagnostics(),
    repairState: "not_attempted",
    repairAttempt: initialAttemptDiagnostics(),
    outputEvidence: [],
  };

  try {
    const rawText = request.profileText;
    const ledger = buildProfileEvidenceLedger(rawText);
    diagnostics.pfLedgerCount = ledger.length;
    diagnostics.pfTotal = ledger.length;

    diagnostics.initialAttempt.called = true;
    let initialCompletion: Awaited<ReturnType<typeof requestInitialCoverage>>;
    try {
      initialCompletion = await requestInitialCoverage(
        request,
        ledger,
        configuration,
        deadline,
        diagnostics,
      );
    } catch (error) {
      if (error instanceof CompletionEvidenceError) {
        markCompletionFailure(diagnostics.initialAttempt, error);
        if (diagnostics.evidenceCaptureEnabled) {
          diagnostics.outputEvidence.push(
            captureStrengthGapOutputEvidence({
              stage: "initial",
              rawText: error.evidence.rawText ?? "",
              parsedOutput: null,
              parseError: null,
              validationIssues: [],
              rejected: true,
              completionReceived: error.evidence.completionReceived,
              finishReason: error.evidence.finishReason,
              failureStage: error.evidence.failureStage,
              failureCategory: error.evidence.failureCategory,
              secrets: [apiKey],
            }),
          );
        }
      }
      throw error;
    }
    const { content, finishReason } = initialCompletion;
    markCompletionReceived(diagnostics.initialAttempt, content, finishReason);
    let parsed: unknown;
    try {
      parsed = parseJson(content, "invalid JSON output (coverage)");
      diagnostics.initialAttempt.parseResult = "passed";
    } catch (error) {
      diagnostics.initialAttempt.parseResult = "failed";
      diagnostics.initialAttempt.failureStage = "parse";
      diagnostics.initialAttempt.failureCategory = "parse";
      diagnostics.initialAttempt.rejectionReason = "JSON_PARSE_ERROR";
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureStrengthGapOutputEvidence({
            stage: "initial",
            rawText: content,
            parsedOutput: null,
            parseError: "JSON_PARSE_ERROR",
            validationIssues: [],
            rejected: true,
            finishReason,
            failureStage: "parse",
            failureCategory: "parse",
            secrets: [apiKey],
          }),
        );
      }
      throw error;
    }
    diagnostics.jsonParsePassed = true;
    const validation = validateCoverageResponse(
      parsed,
      ledger,
      rawText,
      ledger,
      diagnostics,
    );
    diagnostics.rawSchemaValidationPassed = validation.problems.size === 0;
    diagnostics.initialAttempt.validationResult =
      validation.problems.size === 0 ? "passed" : "failed";

    if (validation.problems.size > 0) {
      diagnostics.initialAttempt.failureStage = "semantic_validation";
      diagnostics.initialAttempt.failureCategory = "semantic_validation";
      diagnostics.initialAttempt.rejectionReason =
        coverageProblemIssues(validation.problems)[0]?.message ?? "PROFILE_VALIDATION_REJECTED";
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureStrengthGapOutputEvidence({
            stage: "initial",
            rawText: content,
            parsedOutput: parsed,
            parseError: null,
            validationIssues: coverageProblemIssues(validation.problems),
            rejected: true,
            finishReason,
            failureStage: "semantic_validation",
            failureCategory: "semantic_validation",
            secrets: [apiKey],
          }),
        );
      }
      diagnostics.profileRepairAttempted = true;
      diagnostics.repairState = "attempted";
      diagnostics.repairAttempt.called = true;
      diagnostics.completenessRepairUsed = true;
      const problemPfs = ledger.filter((item) => validation.problems.has(item.id));
      const reasons = problemPfs.flatMap((pf) =>
        (validation.problems.get(pf.id) ?? []).map(
          (reason) => `${pf.id}: ${reason}`,
        ),
      );
      let repairCompletion: Awaited<ReturnType<typeof requestCoverageRepair>>;
      try {
        repairCompletion = await requestCoverageRepair(
          problemPfs,
          reasons,
          configuration,
          deadline,
          diagnostics,
        );
      } catch (error) {
        if (error instanceof CompletionEvidenceError) {
          markCompletionFailure(diagnostics.repairAttempt, error);
          diagnostics.repairState = "completion_failed";
          if (diagnostics.evidenceCaptureEnabled) {
            diagnostics.outputEvidence.push(
              captureStrengthGapOutputEvidence({
                stage: "repair",
                rawText: error.evidence.rawText ?? "",
                parsedOutput: null,
                parseError: null,
                validationIssues: [],
                rejected: true,
                completionReceived: error.evidence.completionReceived,
                finishReason: error.evidence.finishReason,
                failureStage: error.evidence.failureStage,
                failureCategory: error.evidence.failureCategory,
                secrets: [apiKey],
              }),
            );
          }
        }
        throw error;
      }
      const { content: repairContent, finishReason: repairFinishReason } = repairCompletion;
      markCompletionReceived(diagnostics.repairAttempt, repairContent, repairFinishReason);
      let repairParsed: unknown;
      try {
        repairParsed = parseJson(
          repairContent,
          "invalid JSON output (coverage repair)",
        );
        diagnostics.repairAttempt.parseResult = "passed";
      } catch (error) {
        diagnostics.repairAttempt.parseResult = "failed";
        diagnostics.repairAttempt.failureStage = "parse";
        diagnostics.repairAttempt.failureCategory = "parse";
        diagnostics.repairAttempt.rejectionReason = "JSON_PARSE_ERROR";
        if (diagnostics.evidenceCaptureEnabled) {
          diagnostics.outputEvidence.push(
            captureStrengthGapOutputEvidence({
              stage: "repair",
              rawText: repairContent,
              parsedOutput: null,
              parseError: "JSON_PARSE_ERROR",
              validationIssues: [],
              rejected: true,
              finishReason: repairFinishReason,
              failureStage: "parse",
              failureCategory: "parse",
              secrets: [apiKey],
            }),
          );
        }
        throw error;
      }
      const repaired = validateCoverageResponse(
        repairParsed,
        problemPfs,
        rawText,
        ledger,
        diagnostics,
      );
      diagnostics.completenessRepairSucceeded = repaired.problems.size === 0;
      diagnostics.profileRepairSucceeded = repaired.problems.size === 0;
      diagnostics.repairAttempt.validationResult =
        repaired.problems.size === 0 ? "passed" : "failed";
      diagnostics.repairState =
        repaired.problems.size === 0 ? "accepted" : "rejected";
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureStrengthGapOutputEvidence({
            stage: "repair",
            rawText: repairContent,
            parsedOutput: repairParsed,
            parseError: null,
            validationIssues: coverageProblemIssues(repaired.problems),
            rejected: repaired.problems.size > 0,
            finishReason: repairFinishReason,
            failureStage:
              repaired.problems.size > 0 ? "semantic_validation" : null,
            failureCategory:
              repaired.problems.size > 0 ? "semantic_validation" : null,
            secrets: [apiKey],
          }),
        );
      }
      if (repaired.problems.size > 0) {
        diagnostics.repairAttempt.failureStage = "semantic_validation";
        diagnostics.repairAttempt.failureCategory = "semantic_validation";
        diagnostics.repairAttempt.rejectionReason =
          coverageProblemIssues(repaired.problems)[0]?.message ?? "PROFILE_VALIDATION_REJECTED";
        diagnostics.unprocessedPfCount = repaired.problems.size;
        diagnostics.unusedPfCount = repaired.problems.size;
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      }
      for (const [pfId, item] of repaired.accepted) {
        validation.accepted.set(pfId, item);
      }
      for (const pfId of repaired.accepted.keys()) {
        validation.problems.delete(pfId);
      }
    } else {
      diagnostics.repairState = "not_needed";
    }

    diagnostics.unprocessedPfCount = ledger.length - validation.accepted.size;
    diagnostics.unusedPfCount = diagnostics.unprocessedPfCount;
    if (diagnostics.unprocessedPfCount !== 0) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const orderedCoverage = ledger.map((pf) => validation.accepted.get(pf.id)!);
    updateCoverageDiagnostics(diagnostics, orderedCoverage);
    const candidateProfile = buildCandidateProfile(orderedCoverage, ledger);
    if (!candidateProfile) throw new ApiError("AI_OUTPUT_INVALID", 502);
    const final = finalizeProfile(candidateProfile, ledger, rawText);
    if (!final) throw new ApiError("AI_OUTPUT_INVALID", 502);

    diagnostics.finalFactCount = final.candidateProfile.canonicalFacts.length;
    diagnostics.finalSchemaValidationPassed = true;
    diagnostics.finalEvidenceValidationPassed = true;
    diagnostics.finalValidationPassed = true;
    return final;
  } finally {
    diagnostics.latencyMs = Date.now() - startedAt;
    options.onDiagnostics?.({
      ...diagnostics,
      initialAttempt: { ...diagnostics.initialAttempt },
      repairAttempt: { ...diagnostics.repairAttempt },
      outputEvidence: diagnostics.outputEvidence.map((entry) =>
        structuredClone(entry),
      ),
    });
  }
}
