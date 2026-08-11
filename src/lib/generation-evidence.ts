import { ApiError, type ApiErrorCode } from "./api-errors";

export type GenerationAttemptStage = "initial" | "repair";

export type GenerationFailureStage =
  | "provider_request"
  | "provider_response"
  | "completion"
  | "parse"
  | "raw_schema"
  | "semantic_validation"
  | "immutability";

export type GenerationFailureCategory =
  | "transport"
  | "provider"
  | "timeout"
  | "content_filter"
  | "truncated"
  | "empty_output"
  | "parse"
  | "schema"
  | "semantic_validation"
  | "immutability"
  | "unknown";

export type AttemptResultState = "not_run" | "passed" | "failed";

export type RepairLifecycleState =
  | "not_attempted"
  | "not_needed"
  | "attempted"
  | "completion_failed"
  | "rejected"
  | "accepted";

export interface GenerationAttemptDiagnostics {
  called: boolean;
  completionReceived: boolean;
  rawAvailable: boolean;
  parseResult: AttemptResultState;
  validationResult: AttemptResultState;
  rejectionReason: string | null;
  finishReason: string | null;
  failureStage: GenerationFailureStage | null;
  failureCategory: GenerationFailureCategory | null;
}

export interface CompletionFailureEvidence {
  completionReceived: boolean;
  rawText: string | null;
  rawAvailable: boolean;
  finishReason: string | null;
  failureStage: GenerationFailureStage;
  failureCategory: GenerationFailureCategory;
}

/**
 * Internal-only completion failure. Public routes still serialize the inherited
 * ApiError fields; raw output remains available only to acceptance diagnostics.
 */
export class CompletionEvidenceError extends ApiError {
  constructor(
    code: ApiErrorCode,
    status: number,
    public readonly evidence: CompletionFailureEvidence,
    autoRetryable = false,
  ) {
    super(code, status, autoRetryable);
    this.name = "CompletionEvidenceError";
  }
}

export function initialAttemptDiagnostics(): GenerationAttemptDiagnostics {
  return {
    called: false,
    completionReceived: false,
    rawAvailable: false,
    parseResult: "not_run",
    validationResult: "not_run",
    rejectionReason: null,
    finishReason: null,
    failureStage: null,
    failureCategory: null,
  };
}

export function markCompletionReceived(
  attempt: GenerationAttemptDiagnostics,
  content: string,
  finishReason: string | null,
) {
  attempt.called = true;
  attempt.completionReceived = true;
  attempt.rawAvailable = content.length > 0;
  attempt.finishReason = finishReason;
}

export function markCompletionFailure(
  attempt: GenerationAttemptDiagnostics,
  error: CompletionEvidenceError,
) {
  attempt.called = true;
  attempt.completionReceived = error.evidence.completionReceived;
  attempt.rawAvailable = error.evidence.rawAvailable;
  attempt.finishReason = error.evidence.finishReason;
  attempt.failureStage = error.evidence.failureStage;
  attempt.failureCategory = error.evidence.failureCategory;
  attempt.rejectionReason = error.code;
}
