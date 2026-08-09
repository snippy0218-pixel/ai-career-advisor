import { ApiError } from "./api-errors";
import {
  finalizeRawMatchCore,
  rawMatchCoreSchema,
  type FinalMatchCore,
  type MatchCoreRequest,
  type MatchValidationIssue,
} from "./match-schema";
import { buildMatchMessages, buildMatchRepairMessages } from "./match-prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 8192;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface MatchDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  matchRepairAttempted: boolean;
  matchRepairSucceeded: boolean;
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
}

export interface MatchOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
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
          temperature: 0.1,
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
    throw new ApiError("AI_SERVICE_UNAVAILABLE", 503);
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
): { data: FinalMatchCore | null; issues: MatchValidationIssue[]; rawValid: boolean } {
  const rawResult = rawMatchCoreSchema.safeParse(parsed);
  if (!rawResult.success) {
    return { data: null, issues: schemaIssues(rawResult.error), rawValid: false };
  }
  const finalized = finalizeRawMatchCore(
    rawResult.data,
    request.jobAnalysis,
    request.candidateProfile,
  );
  return { ...finalized, rawValid: true };
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
  };

  try {
    const content = await requestInitial(request, configuration, deadline, diagnostics);
    let parsed: unknown;
    try {
      parsed = parseJson(content);
      diagnostics.jsonParsePassed = true;
    } catch {
      parsed = { invalidJson: content };
    }
    let validation = validateOutput(parsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;

    if (!validation.data) {
      diagnostics.matchRepairAttempted = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
      diagnostics.upstreamAttempts += 1;
      const repairContent = await requestCompletion(
        buildMatchRepairMessages(request, parsed, validation.issues),
        configuration,
        remaining,
        diagnostics,
      );
      const repairParsed = parseJson(repairContent);
      validation = validateOutput(repairParsed, request);
      diagnostics.matchRepairSucceeded = validation.data !== null;
      if (!validation.data) throw new ApiError("AI_OUTPUT_INVALID", 502);
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
    options.onDiagnostics?.({ ...diagnostics, statusCounts: { ...diagnostics.statusCounts } });
  }
}
