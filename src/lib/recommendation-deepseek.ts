import { ApiError } from "./api-errors";
import {
  finalizeRawRecommendation,
  rawRecommendationSchema,
  type FinalRecommendation,
  type RecommendationCoreRequest,
  type RecommendationValidationIssue,
} from "./recommendation-schema";
import {
  buildRecommendationMessages,
  buildRecommendationRepairMessages,
} from "./recommendation-prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 4096;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface RecommendationDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  recommendationRepairAttempted: boolean;
  recommendationRepairSucceeded: boolean;
  initialValidationIssues: RecommendationValidationIssue[];
  repairValidationIssues: RecommendationValidationIssue[];
  finalSchemaValidationPassed: boolean;
  allowedLevelValidationPassed: boolean;
  referenceValidationPassed: boolean;
  statusFidelityPassed: boolean;
  unknownPreservationPassed: boolean;
  hardGapExplanationPassed: boolean;
  waiverEvidenceIntegrityPassed: boolean;
  matchCoreImmutable: boolean;
  fabricatedClaimCount: number;
  unsupportedWaiverClaimCount: number;
  unknownToUnmetDriftCount: number;
  fabricatedFlexibilityClaimCount: number;
  recommendationLevel: FinalRecommendation["recommendationLevel"] | null;
  allowedRecommendationLevels: FinalRecommendation["allowedRecommendationLevels"];
  supportingRefCount: number;
  counterRefCount: number;
  latencyMs: number;
  outputCompletionTokens: number;
  truncatedByLength: boolean;
}

export interface RecommendationOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  onDiagnostics?: (diagnostics: RecommendationDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<RecommendationOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
>;

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

async function requestCompletion(
  messages: ChatMessage[],
  configuration: CompletionConfig,
  timeoutMs: number,
  diagnostics: RecommendationDiagnostics,
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
          temperature: 0.1,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.warn("[recommendation] upstream HTTP failure", {
        status: response.status,
      });
      throw mapHttpError(response.status);
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
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }
    if (choice.finish_reason === "content_filter") {
      throw new ApiError("AI_CONTENT_BLOCKED", 422);
    }
    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("AI_TIMEOUT", 504);
    }
    console.warn("[recommendation] upstream network failure", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw new ApiError("AI_SERVICE_UNAVAILABLE", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestInitial(
  request: RecommendationCoreRequest,
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: RecommendationDiagnostics,
) {
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildRecommendationMessages(request),
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
      if (
        attempt !== 0 ||
        !apiError.autoRetryable ||
        deadline - Date.now() <= RETRY_DELAY_MS
      ) {
        throw apiError;
      }
      await wait(RETRY_DELAY_MS);
    }
  }
  throw lastError ?? new ApiError("AI_SERVICE_UNAVAILABLE", 503);
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

function schemaIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateRecommendationOutput(
  parsed: unknown,
  request: RecommendationCoreRequest,
): {
  data: FinalRecommendation | null;
  issues: RecommendationValidationIssue[];
  rawValid: boolean;
} {
  const rawResult = rawRecommendationSchema.safeParse(parsed);
  if (!rawResult.success) {
    return { data: null, issues: schemaIssues(rawResult.error), rawValid: false };
  }
  const finalized = finalizeRawRecommendation(rawResult.data, request.matchCore);
  return { ...finalized, rawValid: true };
}

function fillSuccessDiagnostics(
  diagnostics: RecommendationDiagnostics,
  result: FinalRecommendation,
) {
  diagnostics.finalSchemaValidationPassed = true;
  diagnostics.allowedLevelValidationPassed = true;
  diagnostics.referenceValidationPassed = true;
  diagnostics.statusFidelityPassed = true;
  diagnostics.unknownPreservationPassed = true;
  diagnostics.hardGapExplanationPassed = true;
  diagnostics.waiverEvidenceIntegrityPassed = true;
  diagnostics.fabricatedClaimCount = 0;
  diagnostics.unsupportedWaiverClaimCount = 0;
  diagnostics.unknownToUnmetDriftCount = 0;
  diagnostics.fabricatedFlexibilityClaimCount = 0;
  diagnostics.recommendationLevel = result.recommendationLevel;
  diagnostics.allowedRecommendationLevels = [
    ...result.allowedRecommendationLevels,
  ];
  diagnostics.supportingRefCount = result.supportingMatchRefs.length;
  diagnostics.counterRefCount = result.counterMatchRefs.length;
}

export async function analyzeRecommendationWithDeepSeek(
  request: RecommendationCoreRequest,
  options: RecommendationOptions = {},
): Promise<FinalRecommendation> {
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
  const matchSnapshot = JSON.stringify(request.matchCore);
  const diagnostics: RecommendationDiagnostics = {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    recommendationRepairAttempted: false,
    recommendationRepairSucceeded: false,
    initialValidationIssues: [],
    repairValidationIssues: [],
    finalSchemaValidationPassed: false,
    allowedLevelValidationPassed: false,
    referenceValidationPassed: false,
    statusFidelityPassed: false,
    unknownPreservationPassed: false,
    hardGapExplanationPassed: false,
    waiverEvidenceIntegrityPassed: false,
    matchCoreImmutable: true,
    fabricatedClaimCount: 0,
    unsupportedWaiverClaimCount: 0,
    unknownToUnmetDriftCount: 0,
    fabricatedFlexibilityClaimCount: 0,
    recommendationLevel: null,
    allowedRecommendationLevels: [],
    supportingRefCount: 0,
    counterRefCount: 0,
    latencyMs: 0,
    outputCompletionTokens: 0,
    truncatedByLength: false,
  };

  try {
    const content = await requestInitial(
      request,
      configuration,
      deadline,
      diagnostics,
    );
    let parsed: unknown;
    try {
      parsed = parseJson(content);
      diagnostics.jsonParsePassed = true;
    } catch {
      parsed = { invalidJson: content };
    }
    let validation = validateRecommendationOutput(parsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;
    diagnostics.initialValidationIssues = validation.issues.map((issue) => ({
      ...issue,
    }));

    if (!validation.data) {
      diagnostics.recommendationRepairAttempted = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
      diagnostics.upstreamAttempts += 1;
      const repairContent = await requestCompletion(
        buildRecommendationRepairMessages(request, parsed, validation.issues),
        configuration,
        remaining,
        diagnostics,
      );
      const repairParsed = parseJson(repairContent);
      validation = validateRecommendationOutput(repairParsed, request);
      diagnostics.repairValidationIssues = validation.issues.map((issue) => ({
        ...issue,
      }));
      diagnostics.recommendationRepairSucceeded = validation.data !== null;
      if (!validation.data) throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.matchCoreImmutable =
      matchSnapshot === JSON.stringify(request.matchCore);
    if (!diagnostics.matchCoreImmutable) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }
    fillSuccessDiagnostics(diagnostics, validation.data);
    return validation.data;
  } finally {
    diagnostics.latencyMs = Date.now() - startedAt;
    options.onDiagnostics?.({
      ...diagnostics,
      allowedRecommendationLevels: [
        ...diagnostics.allowedRecommendationLevels,
      ],
      initialValidationIssues: diagnostics.initialValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
      repairValidationIssues: diagnostics.repairValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
    });
  }
}
