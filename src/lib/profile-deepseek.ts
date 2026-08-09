import { z } from "zod";

import { ApiError } from "./api-errors";
import { findNormalizedEvidenceSpans, isEvidenceInJd } from "./analysis-schema";
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
  rawPfCoverageItemSchema,
  resolveEvidenceToPf,
  resolvePfText,
} from "./profile-schema";
import type {
  AnalyzeProfileRequest,
  FinalProfileStructure,
  PfDisposition,
  ProfileEvidence,
  ProfileFactCategory,
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
}

interface ProfileOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  onDiagnostics?: (diagnostics: ProfileDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<ProfileOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
>;
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface NormalizedFact {
  value: string;
  sourceType: "profile_stated" | "normalized_stated";
  pfEvidence: string[];
  verificationQuestion: null;
}

interface ValidatedAtomicClaim extends NormalizedFact {
  category: ProfileFactCategory;
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

const categoryCaps: Record<ProfileFactCategory, number> = {
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

    if (!response.ok) throw mapHttpError(response.status);

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
      throw new ApiError("AI_EMPTY_RESPONSE", 502, true);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!choice || !content) throw new ApiError("AI_EMPTY_RESPONSE", 502, true);

    if (typeof payload.usage?.completion_tokens === "number") {
      diagnostics.outputCompletionTokens = Math.max(
        diagnostics.outputCompletionTokens,
        payload.usage.completion_tokens,
      );
    }
    if (choice.finish_reason === "length") {
      diagnostics.truncatedByLength = true;
      console.warn("[profile] output truncated by max_tokens");
    } else if (choice.finish_reason === "content_filter") {
      throw new ApiError("AI_CONTENT_BLOCKED", 422);
    } else if (
      choice.finish_reason &&
      choice.finish_reason !== "stop" &&
      choice.finish_reason !== "insufficient_system_resource"
    ) {
      console.warn("[profile] abnormal finish reason", {
        finishReason: choice.finish_reason,
      });
    }
    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("AI_TIMEOUT", 504);
    }
    throw new ApiError("AI_SERVICE_UNAVAILABLE", 503);
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
  const upgrades = findSemanticUpgradeViolations(item.value, pfTexts);
  if (upgrades.length > 0) {
    diagnostics.semanticUpgradeViolationCount += upgrades.length;
    return null;
  }

  // Preserve material scope: a tool used only in a course context must not be
  // emitted as an unqualified skill. The complete PF clause is a safe value.
  const exactValueIndex = primaryPf.text.indexOf(item.value);
  const valueSentence =
    exactValueIndex >= 0
      ? primaryPf.text
          .slice(0, exactValueIndex)
          .split(/[。；;！？!?]/)
          .at(-1)! +
        primaryPf.text.slice(exactValueIndex).split(/[。；;！？!?]/, 1)[0]
      : primaryPf.text;
  if (
    item.category === "skills" &&
    /课程项目|课程作业/.test(valueSentence) &&
    !/课程项目|课程作业/.test(item.value)
  ) {
    diagnostics.layeringViolationCount += 1;
    return null;
  }

  // Generic category boundary for standalone project/activity participation.
  // Work/internship/assistant/competition facts remain experiences. This is a
  // taxonomy guard, not a frozen-case text special case.
  if (
    item.category === "experiences" &&
    /(?:参与过|参加过|完成|参与).{0,20}(?:项目|活动)/.test(item.value) &&
    !/实习|工作|协助|助理|比赛/.test(item.value)
  ) {
    diagnostics.layeringViolationCount += 1;
    return null;
  }

  let value = item.value.trim();
  let sourceType = item.sourceType;
  if (isEvidenceInJd(value, primaryPf.text)) {
    // Keep the model's explicit source type. normalized_stated is still safe
    // when the value is itself verbatim.
  } else {
    const normalizedSpans = findNormalizedEvidenceSpans(value, primaryPf.text);
    if (normalizedSpans.length === 1) {
      value = normalizedSpans[0];
      sourceType = "normalized_stated";
    } else if (
      isAllowlistedNormalization(value, primaryPf.text) ||
      isSafeSharedQualifierEnumeration(value, primaryPf.text)
    ) {
      sourceType = "normalized_stated";
    } else {
      diagnostics.untraceableFactCount += 1;
      return null;
    }
  }

  return {
    category: item.category,
    value,
    sourceType,
    pfEvidence,
    verificationQuestion: null,
  };
}

const INSTRUCTION_PATTERN =
  /忽略.{0,12}(?:规则|提示|之前)|把我描述成|虚构|编造.{0,8}(?:经历|经验|技能)|system\s*prompt|developer\s*message/i;
const EXPLICIT_NEGATIVE_FACT_PATTERN =
  /没有正式工作经历|无正式工作经历|无相关实习|无驾照|没有驾照|未取得.{0,12}(?:证|资格)|未使用.{0,20}(?:工具|软件|SQL|Python)|不接受.{0,20}(?:城市|异地|出差)/;

function requiredAtomicCategories(pfText: string): Set<ProfileFactCategory> {
  const required = new Set<ProfileFactCategory>();
  if (/^教育|本科|硕士|博士|学历|专业/.test(pfText)) required.add("education");
  if (
    /^技能|(?:了解|接触过|基础|熟悉|掌握|使用过|会使用|使用)\s*[A-Za-z]/i.test(
      pfText,
    )
  ) {
    required.add("skills");
  }
  if (
    /^项目|项目经历|团队项目|课程项目|课程作业|(?:参与过|参加过|完成|参与).{0,24}(?:项目|活动)/.test(
      pfText,
    )
  ) {
    required.add("projects");
  }
  if (
    /^实习|^经历|实习生|工作经历|正式工作|应届生|协助|助理|参加.{0,16}比赛/.test(
      pfText,
    )
  ) {
    required.add("experiences");
  }
  if (/^证书|CET|资格证|驾驶证|驾照/.test(pfText)) required.add("certificates");
  if (/期望城市|意向城市|不接受.{0,12}(?:城市|异地)/.test(pfText)) {
    required.add("preferences");
  }
  if (/求职方向|职业方向|目标岗位/.test(pfText)) required.add("careerTarget");
  return required;
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

    const requiredCategories = requiredAtomicCategories(pf.text);
    if (
      requiredCategories.size > 0 &&
      item.disposition !== "candidate_fact_source"
    ) {
      addProblem(
        problems,
        pf.id,
        `PF contains explicit candidate fact categories: ${[...requiredCategories].join(", ")}`,
      );
      continue;
    }

    const claims: ValidatedAtomicClaim[] = [];
    let claimInvalid = false;
    for (const rawClaim of item.atomicClaims) {
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
      const key = `${claim.category}\u0000${claim.value}`;
      if (!claims.some((existing) => `${existing.category}\u0000${existing.value}` === key)) {
        claims.push(claim);
      }
    }
    if (claimInvalid || claims.length !== item.atomicClaims.length) {
      for (const rawClaim of item.atomicClaims) {
        if (
          rawClaim.category === "skills" &&
          /课程项目|课程作业/.test(pf.text) &&
          !/课程项目|课程作业/.test(rawClaim.value)
        ) {
          addProblem(
            problems,
            pf.id,
            "course-context skill claim must preserve 课程项目/课程作业 in its value; copy the complete supporting PF clause",
          );
        }
        if (
          rawClaim.category === "experiences" &&
          /(?:参与过|参加过|完成|参与).{0,20}(?:项目|活动)/.test(
            rawClaim.value,
          ) &&
          !/实习|工作|协助|助理|比赛/.test(rawClaim.value)
        ) {
          addProblem(
            problems,
            pf.id,
            "standalone project/activity participation must use category=projects",
          );
        }
      }
      addProblem(problems, pf.id, "one or more atomic claims failed strict validation");
      continue;
    }
    if (item.disposition === "candidate_fact_source" && claims.length === 0) {
      addProblem(problems, pf.id, "candidate-fact PF has no validated atomic claims");
      continue;
    }

    const extractedCategories = new Set(claims.map((claim) => claim.category));
    const missingCategories = [...requiredCategories].filter(
      (category) => !extractedCategories.has(category),
    );
    if (missingCategories.length > 0) {
      addProblem(
        problems,
        pf.id,
        `atomic claims omitted explicit categories: ${missingCategories.join(", ")}; add one strictly supported claim per category`,
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
  const factsByCategory: Record<ProfileFactCategory, NormalizedFact[]> = {
    careerTarget: [],
    education: [],
    experiences: [],
    projects: [],
    skills: [],
    certificates: [],
    portfolio: [],
    preferences: [],
  };

  for (const item of coverage) {
    for (const claim of item.atomicClaims) {
      const list = factsByCategory[claim.category];
      if (
        list.some(
          (fact) =>
            fact.value === claim.value &&
            fact.pfEvidence.join("\u0000") === claim.pfEvidence.join("\u0000"),
        )
      ) {
        continue;
      }
      if (list.length >= categoryCaps[claim.category]) return null;
      list.push({
        value: claim.value,
        sourceType: claim.sourceType,
        pfEvidence: claim.pfEvidence,
        verificationQuestion: null,
      });
    }
  }

  return {
    careerTarget: factsByCategory.careerTarget[0] ?? null,
    education: factsByCategory.education,
    experiences: factsByCategory.experiences,
    projects: factsByCategory.projects,
    skills: factsByCategory.skills,
    certificates: factsByCategory.certificates,
    portfolio: factsByCategory.portfolio,
    preferences: factsByCategory.preferences,
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

  const totalFacts =
    (result.data.candidateProfile.careerTarget ? 1 : 0) +
    result.data.candidateProfile.education.length +
    result.data.candidateProfile.experiences.length +
    result.data.candidateProfile.projects.length +
    result.data.candidateProfile.skills.length +
    result.data.candidateProfile.certificates.length +
    result.data.candidateProfile.portfolio.length +
    result.data.candidateProfile.preferences.length;
  if (ledger.length > 0 && totalFacts === 0) return null;

  const ids = new Set(ledger.map((item) => item.id));
  const groups = [
    result.data.candidateProfile.careerTarget
      ? [result.data.candidateProfile.careerTarget]
      : [],
    result.data.candidateProfile.education,
    result.data.candidateProfile.experiences,
    result.data.candidateProfile.projects,
    result.data.candidateProfile.skills,
    result.data.candidateProfile.certificates,
    result.data.candidateProfile.portfolio,
    result.data.candidateProfile.preferences,
  ];
  for (const group of groups) {
    for (const fact of group) {
      if (fact.pfEvidence.some((id) => !ids.has(id))) return null;
    }
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
  };

  try {
    const rawText = request.profileText;
    const ledger = buildProfileEvidenceLedger(rawText);
    diagnostics.pfLedgerCount = ledger.length;
    diagnostics.pfTotal = ledger.length;

    const content = await requestInitialCoverage(
      request,
      ledger,
      configuration,
      deadline,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid JSON output (coverage)");
    diagnostics.jsonParsePassed = true;
    const validation = validateCoverageResponse(
      parsed,
      ledger,
      rawText,
      ledger,
      diagnostics,
    );
    diagnostics.rawSchemaValidationPassed = validation.problems.size === 0;

    if (validation.problems.size > 0) {
      diagnostics.profileRepairAttempted = true;
      diagnostics.completenessRepairUsed = true;
      const problemPfs = ledger.filter((item) => validation.problems.has(item.id));
      const reasons = problemPfs.flatMap((pf) =>
        (validation.problems.get(pf.id) ?? []).map(
          (reason) => `${pf.id}: ${reason}`,
        ),
      );
      const repairContent = await requestCoverageRepair(
        problemPfs,
        reasons,
        configuration,
        deadline,
        diagnostics,
      );
      const repairParsed = parseJson(
        repairContent,
        "invalid JSON output (coverage repair)",
      );
      const repaired = validateCoverageResponse(
        repairParsed,
        problemPfs,
        rawText,
        ledger,
        diagnostics,
      );
      diagnostics.completenessRepairSucceeded = repaired.problems.size === 0;
      diagnostics.profileRepairSucceeded = repaired.problems.size === 0;
      if (repaired.problems.size > 0) {
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

    diagnostics.finalFactCount =
      (final.candidateProfile.careerTarget ? 1 : 0) +
      final.candidateProfile.education.length +
      final.candidateProfile.experiences.length +
      final.candidateProfile.projects.length +
      final.candidateProfile.skills.length +
      final.candidateProfile.certificates.length +
      final.candidateProfile.portfolio.length +
      final.candidateProfile.preferences.length;
    diagnostics.finalSchemaValidationPassed = true;
    diagnostics.finalEvidenceValidationPassed = true;
    diagnostics.finalValidationPassed = true;
    return final;
  } finally {
    diagnostics.latencyMs = Date.now() - startedAt;
    options.onDiagnostics?.({ ...diagnostics });
  }
}
