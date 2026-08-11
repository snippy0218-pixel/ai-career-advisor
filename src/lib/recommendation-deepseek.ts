import { ApiError } from "./api-errors";
import {
  CompletionEvidenceError,
  initialAttemptDiagnostics,
  markCompletionFailure,
  markCompletionReceived,
  type GenerationAttemptDiagnostics,
  type RepairLifecycleState,
} from "./generation-evidence";
import {
  captureRecommendationOutputEvidence,
  type RecommendationOutputEvidence,
} from "./recommendation-evidence";
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
  evidenceCaptureEnabled: boolean;
  initialAttempt: GenerationAttemptDiagnostics;
  repairState: RepairLifecycleState;
  repairAttempt: GenerationAttemptDiagnostics;
  outputEvidence: RecommendationOutputEvidence[];
}

export interface RecommendationOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  captureRejectedEvidence?: boolean;
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
    }
    if (choice.finish_reason === "content_filter") {
      throw new CompletionEvidenceError("AI_CONTENT_BLOCKED", 422, {
        completionReceived: true,
        rawText: content,
        rawAvailable: true,
        finishReason: "content_filter",
        failureStage: "completion",
        failureCategory: "content_filter",
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
    console.warn("[recommendation] upstream network failure", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
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
    evidenceCaptureEnabled: options.captureRejectedEvidence === true,
    initialAttempt: initialAttemptDiagnostics(),
    repairState: "not_attempted",
    repairAttempt: initialAttemptDiagnostics(),
    outputEvidence: [],
  };

  try {
    diagnostics.initialAttempt.called = true;
    let initialCompletion: Awaited<ReturnType<typeof requestInitial>>;
    try {
      initialCompletion = await requestInitial(
        request,
        configuration,
        deadline,
        diagnostics,
      );
    } catch (error) {
      if (error instanceof CompletionEvidenceError) {
        markCompletionFailure(diagnostics.initialAttempt, error);
        if (diagnostics.evidenceCaptureEnabled) {
          diagnostics.outputEvidence.push(
            captureRecommendationOutputEvidence({
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
      parsed = parseJson(content);
      diagnostics.jsonParsePassed = true;
      diagnostics.initialAttempt.parseResult = "passed";
    } catch {
      parsed = { invalidJson: content };
      diagnostics.initialAttempt.parseResult = "failed";
      diagnostics.initialAttempt.failureStage = "parse";
      diagnostics.initialAttempt.failureCategory = "parse";
      diagnostics.initialAttempt.rejectionReason = "JSON_PARSE_ERROR";
    }
    let validation = validateRecommendationOutput(parsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;
    diagnostics.initialAttempt.validationResult = validation.data ? "passed" : "failed";
    diagnostics.initialValidationIssues = validation.issues.map((issue) => ({
      ...issue,
    }));

    if (!validation.data) {
      if (diagnostics.initialAttempt.failureStage !== "parse") {
        diagnostics.initialAttempt.failureStage = validation.rawValid
          ? "semantic_validation"
          : "raw_schema";
        diagnostics.initialAttempt.failureCategory = validation.rawValid
          ? "semantic_validation"
          : "schema";
        diagnostics.initialAttempt.rejectionReason =
          validation.issues[0]?.message ?? "RECOMMENDATION_VALIDATION_REJECTED";
      }
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureRecommendationOutputEvidence({
            stage: "initial",
            rawText: content,
            parsedOutput: parsed,
            parseError:
              parsed !== null &&
              typeof parsed === "object" &&
              "invalidJson" in parsed
                ? "JSON_PARSE_ERROR"
                : null,
            validationIssues: validation.issues,
            rejected: true,
            finishReason,
            failureStage: diagnostics.initialAttempt.failureStage,
            failureCategory: diagnostics.initialAttempt.failureCategory,
            secrets: [apiKey],
          }),
        );
      }
      diagnostics.recommendationRepairAttempted = true;
      diagnostics.repairState = "attempted";
      diagnostics.repairAttempt.called = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
      diagnostics.upstreamAttempts += 1;
      let repairCompletion: Awaited<ReturnType<typeof requestCompletion>>;
      try {
        repairCompletion = await requestCompletion(
          buildRecommendationRepairMessages(request, parsed, validation.issues),
          configuration,
          remaining,
          diagnostics,
        );
      } catch (error) {
        if (error instanceof CompletionEvidenceError) {
          markCompletionFailure(diagnostics.repairAttempt, error);
          diagnostics.repairState = "completion_failed";
          if (diagnostics.evidenceCaptureEnabled) {
            diagnostics.outputEvidence.push(
              captureRecommendationOutputEvidence({
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
        repairParsed = parseJson(repairContent);
        diagnostics.repairAttempt.parseResult = "passed";
      } catch {
        repairParsed = { invalidJson: repairContent };
        diagnostics.repairAttempt.parseResult = "failed";
        diagnostics.repairAttempt.failureStage = "parse";
        diagnostics.repairAttempt.failureCategory = "parse";
        diagnostics.repairAttempt.rejectionReason = "JSON_PARSE_ERROR";
      }
      validation = validateRecommendationOutput(repairParsed, request);
      diagnostics.repairAttempt.validationResult = validation.data ? "passed" : "failed";
      diagnostics.repairValidationIssues = validation.issues.map((issue) => ({
        ...issue,
      }));
      diagnostics.recommendationRepairSucceeded = validation.data !== null;
      diagnostics.repairState = validation.data ? "accepted" : "rejected";
      if (!validation.data && diagnostics.repairAttempt.failureStage !== "parse") {
        diagnostics.repairAttempt.failureStage = validation.rawValid
          ? "semantic_validation"
          : "raw_schema";
        diagnostics.repairAttempt.failureCategory = validation.rawValid
          ? "semantic_validation"
          : "schema";
        diagnostics.repairAttempt.rejectionReason =
          validation.issues[0]?.message ?? "RECOMMENDATION_VALIDATION_REJECTED";
      }
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureRecommendationOutputEvidence({
            stage: "repair",
            rawText: repairContent,
            parsedOutput: repairParsed,
            parseError:
              repairParsed !== null &&
              typeof repairParsed === "object" &&
              "invalidJson" in repairParsed
                ? "JSON_PARSE_ERROR"
                : null,
            validationIssues: validation.issues,
            rejected: validation.data === null,
            finishReason: repairFinishReason,
            failureStage: validation.data
              ? null
              : diagnostics.repairAttempt.failureStage,
            failureCategory: validation.data
              ? null
              : diagnostics.repairAttempt.failureCategory,
            secrets: [apiKey],
          }),
        );
      }
      if (!validation.data) {
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      }
    } else {
      diagnostics.repairState = "not_needed";
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
      initialAttempt: { ...diagnostics.initialAttempt },
      repairAttempt: { ...diagnostics.repairAttempt },
      outputEvidence: diagnostics.outputEvidence.map((entry) =>
        structuredClone(entry),
      ),
    });
  }
}
