import { ApiError } from "./api-errors";
import {
  captureGreetingOutputEvidence,
  type GreetingOutputEvidence,
} from "./greeting-evidence";
import {
  buildGreetingFactSelection,
  buildPersonalizedSafeFallback,
  buildPhase1SafeFallback,
  finalPersonalizedGreetingSchema,
  finalizeRawPersonalizedGreeting,
  rawPersonalizedGreetingSchema,
  type FinalPersonalizedGreeting,
  type GreetingValidationIssue,
  type PersonalizedGreetingRequest,
} from "./greeting-schema";
import {
  buildGreetingMessages,
  buildGreetingRepairMessages,
} from "./greeting-prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 4096;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface GreetingDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  personalizedGreetingRepairAttempted: boolean;
  personalizedGreetingRepairSucceeded: boolean;
  personalizedGreetingSafeFallbackUsed: boolean;
  phase1GreetingFallbackUsed: boolean;
  initialValidationIssues: GreetingValidationIssue[];
  repairValidationIssues: GreetingValidationIssue[];
  candidateFactIntegrityPassed: boolean;
  pfEvidenceIntegrityPassed: boolean;
  semanticPreservationPassed: boolean;
  crossSourceIsolationPassed: boolean;
  quantificationIntegrityPassed: boolean;
  teamAttributionPassed: boolean;
  unknownIntegrityPassed: boolean;
  matchConsistencyPassed: boolean;
  waiverIntegrityPassed: boolean;
  recommendationToneIntegrityPassed: boolean;
  referenceIntegrityPassed: boolean;
  finalSchemaValidationPassed: boolean;
  repairFallbackSafetyPassed: boolean;
  unsupportedCandidateClaimCount: number;
  semanticUpgradeCount: number;
  crossSourceContaminationCount: number;
  unsupportedNumberCount: number;
  teamAttributionViolationCount: number;
  unknownToCandidateClaimCount: number;
  matchContradictionCount: number;
  waiverViolationCount: number;
  toneViolationCount: number;
  selectedCandidateFactRefs: string[];
  selectedMatchRefs: string[];
  selectedStrengthRefs: string[];
  personalizationStatus: FinalPersonalizedGreeting["personalizationStatus"] | null;
  matchCoreImmutable: boolean;
  candidateProfileImmutable: boolean;
  recommendationImmutable: boolean;
  strengthGapImmutable: boolean;
  latencyMs: number;
  outputCompletionTokens: number;
  truncatedByLength: boolean;
  evidenceCaptureEnabled: boolean;
  outputEvidence: GreetingOutputEvidence[];
}

export interface GreetingOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  captureRejectedEvidence?: boolean;
  onDiagnostics?: (diagnostics: GreetingDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<GreetingOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
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
  diagnostics: GreetingDiagnostics,
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
  request: PersonalizedGreetingRequest,
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: GreetingDiagnostics,
) {
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildGreetingMessages(request),
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

function parseJsonForEvidence(content: string): {
  parsed: unknown;
  parseError: "JSON_PARSE_ERROR" | null;
} {
  try {
    return { parsed: JSON.parse(content) as unknown, parseError: null };
  } catch {
    return { parsed: null, parseError: "JSON_PARSE_ERROR" };
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

export function validateGreetingOutput(
  parsed: unknown,
  request: PersonalizedGreetingRequest,
): {
  data: FinalPersonalizedGreeting | null;
  issues: GreetingValidationIssue[];
  rawValid: boolean;
} {
  const rawResult = rawPersonalizedGreetingSchema.safeParse(parsed);
  if (!rawResult.success) {
    return { data: null, issues: schemaIssues(rawResult.error), rawValid: false };
  }
  const finalized = finalizeRawPersonalizedGreeting(rawResult.data, request);
  return { ...finalized, rawValid: true };
}

function countIssues(issues: GreetingValidationIssue[], rule: string) {
  return issues.filter((issue) => issue.message.includes(rule)).length;
}

function fillIssueDiagnostics(
  diagnostics: GreetingDiagnostics,
  issues: GreetingValidationIssue[],
) {
  diagnostics.unsupportedCandidateClaimCount += countIssues(issues, "PG-A");
  diagnostics.semanticUpgradeCount += countIssues(issues, "PG-C");
  diagnostics.crossSourceContaminationCount += countIssues(issues, "PG-D");
  diagnostics.unsupportedNumberCount += countIssues(issues, "PG-E");
  diagnostics.teamAttributionViolationCount += countIssues(issues, "PG-F");
  diagnostics.unknownToCandidateClaimCount += countIssues(issues, "PG-G");
  diagnostics.matchContradictionCount += countIssues(issues, "PG-H");
  diagnostics.waiverViolationCount += countIssues(issues, "PG-I");
  diagnostics.toneViolationCount += countIssues(issues, "PG-J");
}

function fillSuccessDiagnostics(
  diagnostics: GreetingDiagnostics,
  result: FinalPersonalizedGreeting,
) {
  diagnostics.candidateFactIntegrityPassed = true;
  diagnostics.pfEvidenceIntegrityPassed = true;
  diagnostics.semanticPreservationPassed = true;
  diagnostics.crossSourceIsolationPassed = true;
  diagnostics.quantificationIntegrityPassed = true;
  diagnostics.teamAttributionPassed = true;
  diagnostics.unknownIntegrityPassed = true;
  diagnostics.matchConsistencyPassed = true;
  diagnostics.waiverIntegrityPassed = true;
  diagnostics.recommendationToneIntegrityPassed = true;
  diagnostics.referenceIntegrityPassed = true;
  diagnostics.finalSchemaValidationPassed =
    finalPersonalizedGreetingSchema.safeParse(result).success;
  diagnostics.repairFallbackSafetyPassed =
    diagnostics.finalSchemaValidationPassed;
  diagnostics.selectedCandidateFactRefs = [...result.candidateFactRefs];
  diagnostics.selectedMatchRefs = [...result.matchRefs];
  diagnostics.selectedStrengthRefs = [...result.strengthRefs];
  diagnostics.personalizationStatus = result.personalizationStatus;
}

function initialDiagnostics(
  options: GreetingOptions,
): GreetingDiagnostics {
  return {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    personalizedGreetingRepairAttempted: false,
    personalizedGreetingRepairSucceeded: false,
    personalizedGreetingSafeFallbackUsed: false,
    phase1GreetingFallbackUsed: false,
    initialValidationIssues: [],
    repairValidationIssues: [],
    candidateFactIntegrityPassed: false,
    pfEvidenceIntegrityPassed: false,
    semanticPreservationPassed: false,
    crossSourceIsolationPassed: false,
    quantificationIntegrityPassed: false,
    teamAttributionPassed: false,
    unknownIntegrityPassed: false,
    matchConsistencyPassed: false,
    waiverIntegrityPassed: false,
    recommendationToneIntegrityPassed: false,
    referenceIntegrityPassed: false,
    finalSchemaValidationPassed: false,
    repairFallbackSafetyPassed: false,
    unsupportedCandidateClaimCount: 0,
    semanticUpgradeCount: 0,
    crossSourceContaminationCount: 0,
    unsupportedNumberCount: 0,
    teamAttributionViolationCount: 0,
    unknownToCandidateClaimCount: 0,
    matchContradictionCount: 0,
    waiverViolationCount: 0,
    toneViolationCount: 0,
    selectedCandidateFactRefs: [],
    selectedMatchRefs: [],
    selectedStrengthRefs: [],
    personalizationStatus: null,
    matchCoreImmutable: true,
    candidateProfileImmutable: true,
    recommendationImmutable: true,
    strengthGapImmutable: true,
    latencyMs: 0,
    outputCompletionTokens: 0,
    truncatedByLength: false,
    evidenceCaptureEnabled: options.captureRejectedEvidence === true,
    outputEvidence: [],
  };
}

export async function analyzeGreetingWithDeepSeek(
  request: PersonalizedGreetingRequest,
  options: GreetingOptions = {},
): Promise<FinalPersonalizedGreeting> {
  const startedAt = Date.now();
  const diagnostics = initialDiagnostics(options);
  const snapshots = {
    candidateProfile: JSON.stringify(request.candidateProfile),
    matchCore: JSON.stringify(request.matchCore),
    recommendation: JSON.stringify(request.recommendation),
    strengthGap: JSON.stringify(request.strengthGap ?? null),
  };

  try {
    if (buildGreetingFactSelection(request).length === 0) {
      diagnostics.phase1GreetingFallbackUsed = true;
      const fallback = buildPhase1SafeFallback();
      fillSuccessDiagnostics(diagnostics, fallback);
      return fallback;
    }

    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      diagnostics.personalizedGreetingSafeFallbackUsed = true;
      const fallback = buildPersonalizedSafeFallback(request);
      fillSuccessDiagnostics(diagnostics, fallback);
      return fallback;
    }
    const configuration: CompletionConfig = {
      fetchImpl: options.fetchImpl ?? fetch,
      apiKey,
      model: options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
      baseUrl: options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL,
    };
    const deadline = Date.now() + (options.timeoutMs ?? TOTAL_TIMEOUT_MS);
    let content: string;
    try {
      content = await requestInitial(request, configuration, deadline, diagnostics);
    } catch {
      diagnostics.personalizedGreetingSafeFallbackUsed = true;
      const fallback = buildPersonalizedSafeFallback(request);
      fillSuccessDiagnostics(diagnostics, fallback);
      return fallback;
    }
    const initialJson = parseJsonForEvidence(content);
    diagnostics.jsonParsePassed = initialJson.parseError === null;
    const initialParsed =
      initialJson.parseError === null
        ? initialJson.parsed
        : { invalidJson: content };
    let validation = validateGreetingOutput(initialParsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;
    diagnostics.initialValidationIssues = validation.issues.map((issue) => ({
      ...issue,
    }));
    fillIssueDiagnostics(diagnostics, validation.issues);

    if (!validation.data) {
      if (options.captureRejectedEvidence === true) {
        diagnostics.outputEvidence.push(
          captureGreetingOutputEvidence({
            stage: "initial",
            rawText: content,
            parsedOutput: initialJson.parsed,
            parseError: initialJson.parseError,
            validationIssues: validation.issues,
            rejected: true,
            secrets: [apiKey],
          }),
        );
      }
      diagnostics.personalizedGreetingRepairAttempted = true;
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
        diagnostics.upstreamAttempts += 1;
        const repairContent = await requestCompletion(
          buildGreetingRepairMessages(request, initialParsed, validation.issues),
          configuration,
          remaining,
          diagnostics,
        );
        const repairJson = parseJsonForEvidence(repairContent);
        const repairParsed =
          repairJson.parseError === null
            ? repairJson.parsed
            : { invalidJson: repairContent };
        validation = validateGreetingOutput(repairParsed, request);
        diagnostics.repairValidationIssues = validation.issues.map((issue) => ({
          ...issue,
        }));
        fillIssueDiagnostics(diagnostics, validation.issues);
        diagnostics.personalizedGreetingRepairSucceeded = validation.data !== null;
        if (options.captureRejectedEvidence === true) {
          diagnostics.outputEvidence.push(
            captureGreetingOutputEvidence({
              stage: "repair",
              rawText: repairContent,
              parsedOutput: repairJson.parsed,
              parseError: repairJson.parseError,
              validationIssues: validation.issues,
              rejected: validation.data === null,
              secrets: [apiKey],
            }),
          );
        }
      } catch {
        validation = { data: null, issues: [], rawValid: false };
      }
    }

    const result = validation.data ?? buildPersonalizedSafeFallback(request);
    if (!validation.data) diagnostics.personalizedGreetingSafeFallbackUsed = true;
    fillSuccessDiagnostics(diagnostics, result);
    return result;
  } finally {
    diagnostics.candidateProfileImmutable =
      snapshots.candidateProfile === JSON.stringify(request.candidateProfile);
    diagnostics.matchCoreImmutable =
      snapshots.matchCore === JSON.stringify(request.matchCore);
    diagnostics.recommendationImmutable =
      snapshots.recommendation === JSON.stringify(request.recommendation);
    diagnostics.strengthGapImmutable =
      snapshots.strengthGap === JSON.stringify(request.strengthGap ?? null);
    diagnostics.latencyMs = Date.now() - startedAt;
    options.onDiagnostics?.({
      ...diagnostics,
      initialValidationIssues: diagnostics.initialValidationIssues.map((issue) => ({ ...issue })),
      repairValidationIssues: diagnostics.repairValidationIssues.map((issue) => ({ ...issue })),
      selectedCandidateFactRefs: [...diagnostics.selectedCandidateFactRefs],
      selectedMatchRefs: [...diagnostics.selectedMatchRefs],
      selectedStrengthRefs: [...diagnostics.selectedStrengthRefs],
      outputEvidence: diagnostics.outputEvidence.map((item) => structuredClone(item)),
    });
  }
}
