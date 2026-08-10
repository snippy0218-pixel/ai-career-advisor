import { ApiError } from "./api-errors";
import {
  captureStrengthGapOutputEvidence,
  type StrengthGapOutputEvidence,
} from "./strength-gap-evidence";
import {
  finalStrengthGapSchema,
  finalizeRawStrengthGap,
  rawStrengthGapSchema,
  type FinalStrengthGap,
  type GapType,
  type StrengthGapCoreRequest,
  type StrengthGapValidationIssue,
  type StrengthType,
} from "./strength-gap-schema";
import {
  buildStrengthGapMessages,
  buildStrengthGapRepairMessages,
} from "./strength-gap-prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 8192;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface StrengthGapDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  strengthGapRepairAttempted: boolean;
  strengthGapRepairSucceeded: boolean;
  initialValidationIssues: StrengthGapValidationIssue[];
  repairValidationIssues: StrengthGapValidationIssue[];
  finalSchemaValidationPassed: boolean;
  strengthEvidenceIntegrityPassed: boolean;
  strengthTruthfulnessPassed: boolean;
  transferableRelationBoundaryIntegrityPassed: boolean;
  gapTypeIntegrityPassed: boolean;
  unknownIntegrityPassed: boolean;
  hardGapCounterEvidencePassed: boolean;
  suggestedActionIntegrityPassed: boolean;
  referenceIntegrityPassed: boolean;
  sourceFactIsolationPassed: boolean;
  matchCoreImmutable: boolean;
  recommendationIsolationPassed: boolean;
  fabricatedClaimCount: number;
  candidateClaimUpgradeCount: number;
  ownershipUpgradeCount: number;
  proficiencyUpgradeCount: number;
  employmentUpgradeCount: number;
  contextUpgradeCount: number;
  unknownDeficiencyCount: number;
  unsupportedActionCount: number;
  strengthCount: number;
  gapCount: number;
  strengthTypeCounts: Record<StrengthType, number>;
  gapTypeCounts: Record<GapType, number>;
  latencyMs: number;
  outputCompletionTokens: number;
  truncatedByLength: boolean;
  evidenceCaptureEnabled: boolean;
  outputEvidence: StrengthGapOutputEvidence[];
}

export interface StrengthGapOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  captureRejectedEvidence?: boolean;
  onDiagnostics?: (diagnostics: StrengthGapDiagnostics) => void;
}

type CompletionConfig = Required<
  Pick<StrengthGapOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
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
  diagnostics: StrengthGapDiagnostics,
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
  request: StrengthGapCoreRequest,
  configuration: CompletionConfig,
  deadline: number,
  diagnostics: StrengthGapDiagnostics,
) {
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildStrengthGapMessages(request),
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

export function validateStrengthGapOutput(
  parsed: unknown,
  request: StrengthGapCoreRequest,
): {
  data: FinalStrengthGap | null;
  issues: StrengthGapValidationIssue[];
  rawValid: boolean;
} {
  const rawResult = rawStrengthGapSchema.safeParse(parsed);
  if (!rawResult.success) {
    return { data: null, issues: schemaIssues(rawResult.error), rawValid: false };
  }
  const finalized = finalizeRawStrengthGap(rawResult.data, request.matchCore);
  return { ...finalized, rawValid: true };
}

function fillSuccessDiagnostics(
  diagnostics: StrengthGapDiagnostics,
  result: FinalStrengthGap,
) {
  diagnostics.finalSchemaValidationPassed =
    finalStrengthGapSchema.safeParse(result).success;
  diagnostics.strengthEvidenceIntegrityPassed = true;
  diagnostics.strengthTruthfulnessPassed = true;
  diagnostics.transferableRelationBoundaryIntegrityPassed = true;
  diagnostics.gapTypeIntegrityPassed = true;
  diagnostics.unknownIntegrityPassed = true;
  diagnostics.hardGapCounterEvidencePassed = true;
  diagnostics.suggestedActionIntegrityPassed = true;
  diagnostics.referenceIntegrityPassed = true;
  diagnostics.sourceFactIsolationPassed = true;
  diagnostics.fabricatedClaimCount = 0;
  diagnostics.candidateClaimUpgradeCount = 0;
  diagnostics.ownershipUpgradeCount = 0;
  diagnostics.proficiencyUpgradeCount = 0;
  diagnostics.employmentUpgradeCount = 0;
  diagnostics.contextUpgradeCount = 0;
  diagnostics.unknownDeficiencyCount = 0;
  diagnostics.unsupportedActionCount = 0;
  diagnostics.strengthCount = result.strengths.length;
  diagnostics.gapCount = result.gaps.length;
  for (const entry of result.strengths) {
    diagnostics.strengthTypeCounts[entry.type] += 1;
  }
  for (const entry of result.gaps) diagnostics.gapTypeCounts[entry.type] += 1;
}

export async function analyzeStrengthGapWithDeepSeek(
  request: StrengthGapCoreRequest,
  options: StrengthGapOptions = {},
): Promise<FinalStrengthGap> {
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
  const diagnostics: StrengthGapDiagnostics = {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    strengthGapRepairAttempted: false,
    strengthGapRepairSucceeded: false,
    initialValidationIssues: [],
    repairValidationIssues: [],
    finalSchemaValidationPassed: false,
    strengthEvidenceIntegrityPassed: false,
    strengthTruthfulnessPassed: false,
    transferableRelationBoundaryIntegrityPassed: false,
    gapTypeIntegrityPassed: false,
    unknownIntegrityPassed: false,
    hardGapCounterEvidencePassed: false,
    suggestedActionIntegrityPassed: false,
    referenceIntegrityPassed: false,
    sourceFactIsolationPassed: false,
    matchCoreImmutable: true,
    recommendationIsolationPassed: true,
    fabricatedClaimCount: 0,
    candidateClaimUpgradeCount: 0,
    ownershipUpgradeCount: 0,
    proficiencyUpgradeCount: 0,
    employmentUpgradeCount: 0,
    contextUpgradeCount: 0,
    unknownDeficiencyCount: 0,
    unsupportedActionCount: 0,
    strengthCount: 0,
    gapCount: 0,
    strengthTypeCounts: {
      direct_match: 0,
      transferable_strength: 0,
      supporting_strength: 0,
    },
    gapTypeCounts: {
      hard_constraint: 0,
      evidence_expression: 0,
      learnable_skill: 0,
      information: 0,
    },
    latencyMs: 0,
    outputCompletionTokens: 0,
    truncatedByLength: false,
    evidenceCaptureEnabled: options.captureRejectedEvidence === true,
    outputEvidence: [],
  };

  try {
    const content = await requestInitial(
      request,
      configuration,
      deadline,
      diagnostics,
    );
    const initialJson = parseJsonForEvidence(content);
    diagnostics.jsonParsePassed = initialJson.parseError === null;
    const parsed =
      initialJson.parseError === null
        ? initialJson.parsed
        : { invalidJson: content };
    let validation = validateStrengthGapOutput(parsed, request);
    diagnostics.rawSchemaValidationPassed = validation.rawValid;
    diagnostics.initialValidationIssues = validation.issues.map((issue) => ({
      ...issue,
    }));

    if (!validation.data) {
      if (options.captureRejectedEvidence === true) {
        diagnostics.outputEvidence.push(
          captureStrengthGapOutputEvidence({
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
      diagnostics.strengthGapRepairAttempted = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ApiError("AI_TIMEOUT", 504);
      diagnostics.upstreamAttempts += 1;
      const repairContent = await requestCompletion(
        buildStrengthGapRepairMessages(request, parsed, validation.issues),
        configuration,
        remaining,
        diagnostics,
      );
      const repairJson = parseJsonForEvidence(repairContent);
      const repairParsed =
        repairJson.parseError === null
          ? repairJson.parsed
          : { invalidJson: repairContent };
      validation = validateStrengthGapOutput(repairParsed, request);
      diagnostics.repairValidationIssues = validation.issues.map((issue) => ({
        ...issue,
      }));
      diagnostics.strengthGapRepairSucceeded = validation.data !== null;
      if (options.captureRejectedEvidence === true) {
        diagnostics.outputEvidence.push(
          captureStrengthGapOutputEvidence({
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
      initialValidationIssues: diagnostics.initialValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
      repairValidationIssues: diagnostics.repairValidationIssues.map(
        (issue) => ({ ...issue }),
      ),
      strengthTypeCounts: { ...diagnostics.strengthTypeCounts },
      gapTypeCounts: { ...diagnostics.gapTypeCounts },
      outputEvidence: diagnostics.outputEvidence.map((entry) =>
        structuredClone(entry),
      ),
    });
  }
}
