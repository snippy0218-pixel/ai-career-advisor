import { ApiError } from "./api-errors";
import { findNormalizedEvidenceSpans, isEvidenceInJd } from "./analysis-schema";
import { buildProfileStructuringMessages } from "./profile-prompt";
import {
  buildProfileEvidenceLedger,
  finalProfileStructureSchema,
  findSemanticUpgradeViolations,
  hasFactTraceability,
  hasHighTraceability,
  PROFILE_SCHEMA_VERSION,
  rawProfileAnalysisSchema,
  resolveEvidenceToPf,
  resolvePfText,
} from "./profile-schema";
import type { AnalyzeProfileRequest, FinalProfileStructure, ProfileEvidence } from "./profile-schema";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 4096;

export interface ProfileDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  pfLedgerCount: number;
  removedFactCount: number;
  invalidEvidenceCount: number;
  semanticUpgradeViolationCount: number;
  untraceableFactCount: number;
  layeringViolationCount: number;
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

type CompletionConfig = Required<Pick<ProfileOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">>;
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

    let payload: { choices?: Array<{ finish_reason?: string; message?: { content?: string } }>; usage?: { completion_tokens?: number } };
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
      console.warn("[profile] abnormal finish reason", { finishReason: choice.finish_reason });
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

async function requestStructuring(
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
      const apiError = error instanceof ApiError ? error : new ApiError("AI_SERVICE_UNAVAILABLE", 503);
      lastError = apiError;
      const canRetry = attempt === 0 && apiError.autoRetryable && deadline - Date.now() > RETRY_DELAY_MS;
      if (!canRetry) throw apiError;
      await wait(RETRY_DELAY_MS);
    }
  }
  throw lastError ?? new ApiError("AI_SERVICE_UNAVAILABLE", 503);
}

interface NormalizedFact {
  value: string;
  sourceType: "profile_stated" | "normalized_stated";
  pfEvidence: string[];
  verificationQuestion: null;
}

interface NormalizedDerived {
  content: string;
  sourceType: "profile_inferred";
  pfEvidence: string[];
  verificationQuestion: string | null;
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

function normalizeFact(
  item: {
    value: string;
    sourceType?: string;
    pfEvidence?: string[];
    verificationQuestion?: string | null;
  },
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
): NormalizedFact | null {
  const sourceType = item.sourceType ?? "normalized_stated";
  if (sourceType === "profile_inferred" || sourceType === "to_verify") {
    diagnostics.layeringViolationCount += 1;
    return null;
  }
  if (item.verificationQuestion != null) {
    diagnostics.layeringViolationCount += 1;
    return null;
  }

  const pfEvidence = resolveEvidenceIds(item.pfEvidence ?? [], rawText, ledger, diagnostics);
  if (pfEvidence.length === 0) {
    diagnostics.invalidEvidenceCount += 1;
    return null;
  }

  const pfTexts = pfEvidence
    .map((id) => resolvePfText(ledger, id) ?? "")
    .filter((text) => text.length > 0);

  if (sourceType === "profile_stated") {
    if (isEvidenceInJd(item.value, rawText)) {
      return { value: item.value, sourceType, pfEvidence, verificationQuestion: null };
    }
    const spans = findNormalizedEvidenceSpans(item.value, rawText);
    if (spans.length !== 1) {
      // Mislabeled minimal normalization (e.g. label prefix stripped): keep the
      // fact as normalized_stated only when it is a near-verbatim normalization
      // with no semantic upgrade. This does not relax fact/evidence rules.
      const upgrades = findSemanticUpgradeViolations(item.value, pfTexts);
      if (upgrades.length === 0 && hasHighTraceability(item.value, pfTexts)) {
        return {
          value: item.value,
          sourceType: "normalized_stated",
          pfEvidence,
          verificationQuestion: null,
        };
      }
      diagnostics.invalidEvidenceCount += 1;
      return null;
    }
    return { value: spans[0], sourceType, pfEvidence, verificationQuestion: null };
  }

  const upgrades = findSemanticUpgradeViolations(item.value, pfTexts);
  if (upgrades.length > 0) {
    diagnostics.semanticUpgradeViolationCount += upgrades.length;
    return null;
  }
  if (!hasFactTraceability(item.value, pfTexts)) {
    diagnostics.untraceableFactCount += 1;
    return null;
  }
  return { value: item.value, sourceType: "normalized_stated", pfEvidence, verificationQuestion: null };
}

function normalizeDerived(
  item: {
    content: string;
    sourceType?: string;
    pfEvidence?: string[];
    verificationQuestion?: string | null;
  },
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
): NormalizedDerived | null {
  if (item.sourceType !== "profile_inferred") {
    diagnostics.layeringViolationCount += 1;
    return null;
  }
  const pfEvidence = resolveEvidenceIds(item.pfEvidence ?? [], rawText, ledger, diagnostics);
  if (pfEvidence.length === 0) {
    diagnostics.invalidEvidenceCount += 1;
    return null;
  }
  return {
    content: item.content,
    sourceType: "profile_inferred",
    pfEvidence,
    verificationQuestion: item.verificationQuestion ?? null,
  };
}

function normalizeCategory(
  items: Array<{
    value: string;
    sourceType?: string;
    pfEvidence?: string[];
    verificationQuestion?: string | null;
  }>,
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
  max: number,
): NormalizedFact[] {
  const facts: NormalizedFact[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fact = normalizeFact(item, rawText, ledger, diagnostics);
    if (!fact) {
      diagnostics.removedFactCount += 1;
      continue;
    }
    if (seen.has(fact.value)) continue; // dedupe: benign normalization, not a defect
    seen.add(fact.value);
    facts.push(fact);
    if (facts.length >= max) break;
  }
  return facts;
}

function prepareCandidateProfile(
  raw: {
    careerTarget?: {
      value: string;
      sourceType?: string;
      pfEvidence?: string[];
      verificationQuestion?: string | null;
    } | null;
    education?: unknown[];
    experiences?: unknown[];
    projects?: unknown[];
    skills?: unknown[];
    certificates?: unknown[];
    portfolio?: unknown[];
    preferences?: unknown[];
    derivedObservations?: unknown[];
    unknowns?: string[];
    questionsToConfirm?: Array<{ question: string; reason: string }>;
  },
  rawText: string,
  ledger: ProfileEvidence[],
  diagnostics: ProfileDiagnostics,
) {
  const categories: Array<keyof Pick<typeof raw, "education" | "experiences" | "projects" | "skills" | "certificates" | "portfolio" | "preferences">> =
    ["education", "experiences", "projects", "skills", "certificates", "portfolio", "preferences"];
  const maxes: Record<string, number> = {
    education: 6,
    experiences: 8,
    projects: 8,
    skills: 12,
    certificates: 6,
    portfolio: 6,
    preferences: 4,
  };
  const normalized: Record<string, NormalizedFact[]> = {};
  for (const category of categories) {
    normalized[category] = normalizeCategory(
      (raw[category] ?? []) as Array<{
        value: string;
        sourceType?: string;
        pfEvidence?: string[];
        verificationQuestion?: string | null;
      }>,
      rawText,
      ledger,
      diagnostics,
      maxes[category],
    );
  }
  const derivedObservations = ((raw.derivedObservations ?? []) as Array<{
    content: string;
    sourceType?: string;
    pfEvidence?: string[];
    verificationQuestion?: string | null;
  }>)
    .map((item) => normalizeDerived(item, rawText, ledger, diagnostics))
    .filter((item): item is NormalizedDerived => item !== null)
    .slice(0, 6);

  const careerTarget =
    raw.careerTarget == null
      ? null
      : normalizeFact(raw.careerTarget, rawText, ledger, diagnostics);

  return {
    careerTarget,
    education: normalized.education,
    experiences: normalized.experiences,
    projects: normalized.projects,
    skills: normalized.skills,
    certificates: normalized.certificates,
    portfolio: normalized.portfolio,
    preferences: normalized.preferences,
    derivedObservations,
    unknowns: (raw.unknowns ?? []).slice(0, 8),
    questionsToConfirm: (raw.questionsToConfirm ?? []).slice(0, 8),
    evidence: ledger.map(({ id, text }) => ({ id, text })),
  };
}

function finalizeProfile(
  candidateProfile: ReturnType<typeof prepareCandidateProfile>,
  ledger: ProfileEvidence[],
  rawText: string,
): { ok: boolean; value?: FinalProfileStructure } {
  const result = finalProfileStructureSchema.safeParse({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profileProvided: true,
    candidateProfile,
  });
  if (!result.success) return { ok: false };

  const ids = new Set(ledger.map((item) => item.id));
  const profile = result.data.candidateProfile;
  const totalFacts =
    (profile.careerTarget ? 1 : 0) +
    profile.education.length +
    profile.experiences.length +
    profile.projects.length +
    profile.skills.length +
    profile.certificates.length +
    profile.portfolio.length +
    profile.preferences.length;
  // Fail-closed when the input had content but no fact survived validation:
  // a silently empty profile is not a valid result (Phase 2.1 gate: no silent
  // loss of user-provided facts).
  if (ledger.length > 0 && totalFacts === 0 && profile.derivedObservations.length === 0) {
    return { ok: false };
  }

  const factGroups = [
    profile.careerTarget ? [profile.careerTarget] : [],
    profile.education,
    profile.experiences,
    profile.projects,
    profile.skills,
    profile.certificates,
    profile.portfolio,
    profile.preferences,
    profile.derivedObservations,
  ];
  for (const group of factGroups) {
    for (const fact of group) {
      for (const ref of fact.pfEvidence) {
        if (!ids.has(ref)) return { ok: false };
      }
    }
  }
  for (const evidence of ledger) {
    if (!isEvidenceInJd(evidence.text, rawText)) return { ok: false };
  }
  return { ok: true, value: result.data };
}

function buildRepairMessages(
  request: AnalyzeProfileRequest,
  ledger: ProfileEvidence[],
  errors: string[],
): ChatMessage[] {
  const ledgerText = ledger.map((item) => `${item.id}：${item.text}`).join("\n");
  const system = [
    "你是候选人资料结构化引擎的修复器。上一次结构化结果未通过校验，请重新输出完整、正确的结构化 JSON。",
    "必须遵守：事实只能来自用户原文并引用 PF；sourceType 只允许 profile_stated/normalized_stated；禁止程度/经历/归属升级；derivedObservations 独立且可留空。",
  ].join("\n");
  const user = [
    "校验错误：",
    ...errors,
    "",
    "=== PF Evidence 列表 ===",
    ledgerText,
    "",
    "=== 候选人原始资料 ===",
    "<<<PROFILE_START>>>",
    request.profileText,
    "<<<PROFILE_END>>>",
    "",
    "请输出修正后的完整结构化结果 JSON。",
  ].join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

async function repairProfile(
  request: AnalyzeProfileRequest,
  ledger: ProfileEvidence[],
  errors: string[],
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: ProfileDiagnostics,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
  diagnostics.upstreamAttempts += 1;
  return requestCompletion(
    buildRepairMessages(request, ledger, errors),
    configuration,
    remaining,
    diagnostics,
  );
}

export async function analyzeProfileWithDeepSeek(
  request: AnalyzeProfileRequest,
  options: ProfileOptions = {},
): Promise<FinalProfileStructure> {
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
    removedFactCount: 0,
    invalidEvidenceCount: 0,
    semanticUpgradeViolationCount: 0,
    untraceableFactCount: 0,
    layeringViolationCount: 0,
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

    const content = await requestStructuring(request, ledger, configuration, deadline, diagnostics);
    const parsed = parseJson(content, "invalid JSON output");
    diagnostics.jsonParsePassed = true;

    const raw = rawProfileAnalysisSchema.safeParse(parsed);
    diagnostics.rawSchemaValidationPassed = raw.success;
    let candidateProfile = raw.success
      ? prepareCandidateProfile(raw.data, rawText, ledger, diagnostics)
      : null;
    let finalized = candidateProfile
      ? finalizeProfile(candidateProfile, ledger, rawText)
      : { ok: false as const };

    const hasProfileProblems =
      !raw.success ||
      !finalized.ok ||
      diagnostics.layeringViolationCount > 0 ||
      diagnostics.semanticUpgradeViolationCount > 0 ||
      diagnostics.untraceableFactCount > 0 ||
      diagnostics.invalidEvidenceCount > 0;

    if (hasProfileProblems) {
      diagnostics.profileRepairAttempted = true;
      const errors = [
        "原始结果未通过结构化/证据校验。重点检查：① 每个事实必须引用 PF 列表中存在的编号，且可回溯原文；② profile_stated 必须是原文逐字子串，最小标准化（如去掉“项目：”等标签前缀）必须使用 normalized_stated；③ 禁止程度/经历/归属升级；④ 事实中禁止 profile_inferred/to_verify。",
        "请重新输出完整结构化结果，并确保每个事实可回溯到 PF Evidence。",
      ];
      const repairContent = await repairProfile(
        request,
        ledger,
        errors,
        configuration,
        deadline,
        diagnostics,
      );
      const repairParsed = parseJson(repairContent, "invalid JSON output (profile repair)");
      const repairRaw = rawProfileAnalysisSchema.safeParse(repairParsed);
      if (repairRaw.success) {
        candidateProfile = prepareCandidateProfile(repairRaw.data, rawText, ledger, diagnostics);
        finalized = finalizeProfile(candidateProfile, ledger, rawText);
      }
      diagnostics.profileRepairSucceeded = finalized.ok;
    }

    if (!finalized.ok || !finalized.value) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.finalSchemaValidationPassed = true;
    diagnostics.finalEvidenceValidationPassed = true;
    diagnostics.finalValidationPassed = true;
    return finalized.value;
  } finally {
    options.onDiagnostics?.({ ...diagnostics });
  }
}
