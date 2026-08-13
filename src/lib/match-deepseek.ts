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
  captureMatchOutputEvidence,
  type MatchOutputEvidence,
} from "./match-evidence";
import {
  finalizeRawMatchCore,
  rawMatchCoreSchema,
  type FinalMatchCore,
  type MatchCoreRequest,
  type MatchValidationIssue,
  type RawMatchCore,
} from "./match-schema";
import {
  normalizeRejectedMatchReasons,
  type MatchNormalizationAction,
} from "./match-normalization";
import { buildMatchMessages, buildMatchRepairMessages } from "./match-prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 8192;
const MATCH_TEMPERATURE = 0.1;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface MatchDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  matchRepairAttempted: boolean;
  matchRepairSucceeded: boolean;
  initialValidationIssues: MatchValidationIssue[];
  repairValidationIssues: MatchValidationIssue[];
  matchNormalizationAttempted: boolean;
  matchNormalizationSucceeded: boolean;
  normalizationActions: MatchNormalizationAction[];
  normalizationValidationIssues: MatchValidationIssue[];
  normalizedRepairOutput: RawMatchCore | null;
  finalSchemaValidationPassed: boolean;
  jdEvidenceValidationPassed: boolean;
  candidateEvidenceValidationPassed: boolean;
  statusValidationPassed: boolean;
  aggregateValidationPassed: boolean;
  candidateProfileImmutable: boolean;
  requirementCount: number;
  dimensionCount: number;
  statusCounts: Record<"met" | "partial" | "unmet" | "unknown", number>;
  latencyMs: number;
  outputCompletionTokens: number;
  truncatedByLength: boolean;
  evidenceCaptureEnabled: boolean;
  initialAttempt: GenerationAttemptDiagnostics;
  repairState: RepairLifecycleState;
  repairAttempt: GenerationAttemptDiagnostics;
  outputEvidence: MatchOutputEvidence[];
  modelMetadata: {
    model: string;
    temperature: number;
    maxOutputTokens: number;
  };
}

export interface MatchOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  captureRejectedEvidence?: boolean;
  onDiagnostics?: (diagnostics: MatchDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<MatchOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
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
  diagnostics: MatchDiagnostics,
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
          temperature: MATCH_TEMPERATURE,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.warn("[match] upstream HTTP failure", { status: response.status });
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
    console.warn("[match] upstream network failure", {
      name: error instanceof Error ? error.name : "UnknownError",
      causeCode:
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause
          ? String(error.cause.code)
          : null,
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
  request: MatchCoreRequest,
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: MatchDiagnostics,
) {
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildMatchMessages(request),
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

function schemaIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function validateOutput(
  parsed: unknown,
  request: MatchCoreRequest,
): {
  data: FinalMatchCore | null;
  issues: MatchValidationIssue[];
  rawValid: boolean;
  raw: RawMatchCore | null;
} {
  const rawResult = rawMatchCoreSchema.safeParse(parsed);
  if (!rawResult.success) {
    return {
      data: null,
      issues: schemaIssues(rawResult.error),
      rawValid: false,
      raw: null,
    };
  }
  const finalized = finalizeRawMatchCore(
    rawResult.data,
    request.jobAnalysis,
    request.candidateProfile,
  );
  return { ...finalized, rawValid: true, raw: rawResult.data };
}

function fillSuccessDiagnostics(
  diagnostics: MatchDiagnostics,
  result: FinalMatchCore,
) {
  diagnostics.finalSchemaValidationPassed = true;
  diagnostics.jdEvidenceValidationPassed = true;
  diagnostics.candidateEvidenceValidationPassed = true;
  diagnostics.statusValidationPassed = true;
  diagnostics.aggregateValidationPassed = true;
  diagnostics.requirementCount = result.matchItems.length;
  diagnostics.dimensionCount = result.matchItems.reduce(
    (total, item) => total + item.requirementDimensions.length,
    0,
  );
  for (const item of result.matchItems) diagnostics.statusCounts[item.status] += 1;
}

export async function analyzeMatchWithDeepSeek(
  request: MatchCoreRequest,
  options: MatchOptions = {},
): Promise<FinalMatchCore> {
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
  const profileSnapshot = JSON.stringify(request.candidateProfile);
  const diagnostics: MatchDiagnostics = {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    matchRepairAttempted: false,
    matchRepairSucceeded: false,
    initialValidationIssues: [],
    repairValidationIssues: [],
    matchNormalizationAttempted: false,
    matchNormalizationSucceeded: false,
    normalizationActions: [],
    normalizationValidationIssues: [],
    normalizedRepairOutput: null,
    finalSchemaValidationPassed: false,
    jdEvidenceValidationPassed: false,
    candidateEvidenceValidationPassed: false,
    statusValidationPassed: false,
    aggregateValidationPassed: false,
    candidateProfileImmutable: true,
    requirementCount: 0,
    dimensionCount: 0,
    statusCounts: { met: 0, partial: 0, unmet: 0, unknown: 0 },
    latencyMs: 0,
    outputCompletionTokens: 0,
    truncatedByLength: false,
    evidenceCaptureEnabled: options.captureRejectedEvidence === true,
    initialAttempt: initialAttemptDiagnostics(),
    repairState: "not_attempted",
    repairAttempt: initialAttemptDiagnostics(),
    outputEvidence: [],
    modelMetadata: {
      model: configuration.model,
      temperature: MATCH_TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
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
            captureMatchOutputEvidence({
              stage: "initial",
              rejected: true,
              rawText: error.evidence.rawText,
              parsedOutput: null,
              parseError: null,
              validationIssues: [],
              rawSchemaValid: null,
              finishReason: error.evidence.finishReason,
              completionReceived: error.evidence.completionReceived,
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
    let validation = validateOutput(parsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;
    diagnostics.initialAttempt.validationResult = validation.data
      ? "passed"
      : "failed";
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
          validation.issues[0]?.message ?? "MATCH_VALIDATION_REJECTED";
      }
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureMatchOutputEvidence({
            stage: "initial",
            rejected: true,
            rawText: content,
            parsedOutput: parsed,
            parseError:
              parsed !== null &&
              typeof parsed === "object" &&
              "invalidJson" in parsed
                ? "JSON_PARSE_ERROR"
                : null,
            validationIssues: validation.issues,
            rawSchemaValid: validation.rawValid,
            finishReason,
            failureStage: diagnostics.initialAttempt.failureStage,
            failureCategory: diagnostics.initialAttempt.failureCategory,
            secrets: [apiKey],
          }),
        );
      }
      diagnostics.matchRepairAttempted = true;
      diagnostics.repairState = "attempted";
      diagnostics.repairAttempt.called = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
      diagnostics.upstreamAttempts += 1;
      let repairCompletion: Awaited<ReturnType<typeof requestCompletion>>;
      try {
        repairCompletion = await requestCompletion(
          buildMatchRepairMessages(request, parsed, validation.issues),
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
              captureMatchOutputEvidence({
                stage: "repair",
                rejected: true,
                rawText: error.evidence.rawText,
                parsedOutput: null,
                parseError: null,
                validationIssues: [],
                rawSchemaValid: null,
                finishReason: error.evidence.finishReason,
                completionReceived: error.evidence.completionReceived,
                failureStage: error.evidence.failureStage,
                failureCategory: error.evidence.failureCategory,
                secrets: [apiKey],
              }),
            );
          }
        }
        throw error;
      }
      const { content: repairContent, finishReason: repairFinishReason } =
        repairCompletion;
      markCompletionReceived(
        diagnostics.repairAttempt,
        repairContent,
        repairFinishReason,
      );
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
      const rawRepairValidation = validateOutput(repairParsed, request);
      diagnostics.repairAttempt.validationResult = rawRepairValidation.data
        ? "passed"
        : "failed";
      diagnostics.repairValidationIssues = rawRepairValidation.issues.map((issue) => ({
        ...issue,
      }));
      validation = rawRepairValidation;
      if (!rawRepairValidation.data && rawRepairValidation.raw) {
        const normalization = normalizeRejectedMatchReasons(
          rawRepairValidation.raw,
          rawRepairValidation.issues,
          request.candidateProfile.candidateProfile.canonicalFacts,
        );
        diagnostics.matchNormalizationAttempted = normalization.applied;
        diagnostics.normalizationActions = normalization.actions.map((action) => ({
          ...action,
          issueCodes: [...action.issueCodes],
          removedCandidateFactRefs: [...action.removedCandidateFactRefs],
        }));
        if (normalization.applied) {
          diagnostics.normalizedRepairOutput = normalization.data;
          const normalizedValidation = validateOutput(normalization.data, request);
          diagnostics.normalizationValidationIssues =
            normalizedValidation.issues.map((issue) => ({ ...issue }));
          diagnostics.matchNormalizationSucceeded =
            normalizedValidation.data !== null;
          validation = normalizedValidation;
        }
      }
      diagnostics.matchRepairSucceeded = validation.data !== null;
      diagnostics.repairState = validation.data ? "accepted" : "rejected";
      if (!validation.data && diagnostics.repairAttempt.failureStage !== "parse") {
        diagnostics.repairAttempt.failureStage = validation.rawValid
          ? "semantic_validation"
          : "raw_schema";
        diagnostics.repairAttempt.failureCategory = validation.rawValid
          ? "semantic_validation"
          : "schema";
        diagnostics.repairAttempt.rejectionReason =
          validation.issues[0]?.message ?? "MATCH_VALIDATION_REJECTED";
      }
      if (diagnostics.evidenceCaptureEnabled) {
        diagnostics.outputEvidence.push(
          captureMatchOutputEvidence({
            stage: "repair",
            rejected: rawRepairValidation.data === null,
            rawText: repairContent,
            parsedOutput: repairParsed,
            parseError:
              repairParsed !== null &&
              typeof repairParsed === "object" &&
              "invalidJson" in repairParsed
                ? "JSON_PARSE_ERROR"
                : null,
            validationIssues: rawRepairValidation.issues,
            rawSchemaValid: rawRepairValidation.rawValid,
            finishReason: repairFinishReason,
            failureStage: rawRepairValidation.data
              ? null
              : "semantic_validation",
            failureCategory: rawRepairValidation.data
              ? null
              : "semantic_validation",
            secrets: [apiKey],
          }),
        );
      }
      if (!validation.data) throw new ApiError("AI_OUTPUT_INVALID", 502);
    } else {
      diagnostics.repairState = "not_needed";
    }

    diagnostics.candidateProfileImmutable =
      profileSnapshot === JSON.stringify(request.candidateProfile);
    if (!diagnostics.candidateProfileImmutable) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }
    fillSuccessDiagnostics(diagnostics, validation.data);
    return validation.data;
  } finally {
    diagnostics.latencyMs = Date.now() - startedAt;
    options.onDiagnostics?.({
      ...diagnostics,
      statusCounts: { ...diagnostics.statusCounts },
      initialValidationIssues: diagnostics.initialValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
      repairValidationIssues: diagnostics.repairValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
      outputEvidence: diagnostics.outputEvidence.map((evidence) => ({
        ...evidence,
      })),
      normalizationActions: diagnostics.normalizationActions.map((action) => ({
        ...action,
        issueCodes: [...action.issueCodes],
        removedCandidateFactRefs: [...action.removedCandidateFactRefs],
      })),
      normalizationValidationIssues:
        diagnostics.normalizationValidationIssues.map((issue) => ({ ...issue })),
      normalizedRepairOutput: diagnostics.normalizedRepairOutput
        ? structuredClone(diagnostics.normalizedRepairOutput)
        : null,
      modelMetadata: { ...diagnostics.modelMetadata },
      initialAttempt: { ...diagnostics.initialAttempt },
      repairAttempt: { ...diagnostics.repairAttempt },
    });
  }
}
