import type {
  GenerationFailureCategory,
  GenerationFailureStage,
} from "./generation-evidence";
import type { RecommendationValidationIssue } from "./recommendation-schema";
import {
  scrubEvidenceValue,
  scrubStrengthGapEvidenceText,
} from "./strength-gap-evidence";

export const RECOMMENDATION_RAW_CAPTURE_LIMIT = 12_000;

export interface RecommendationEvidenceValidationIssue {
  validationLayer: "semantic_validation" | null;
  validationCode: RecommendationValidationIssue["validationCode"] | null;
  rule: RecommendationValidationIssue["rule"] | null;
  path: string;
  message: string;
  matchItemRefs: string[];
}

export interface RecommendationRejectedItemEvidence {
  path: string;
  matchItemRef: string;
}

export interface RecommendationOutputEvidence {
  stage: "initial" | "repair";
  rejected: boolean;
  completionReceived: boolean;
  rawAvailable: boolean;
  rawText: string;
  rawTextLength: number;
  artifactTruncated: boolean;
  parseError: "JSON_PARSE_ERROR" | null;
  parsedOutputAvailable: boolean;
  parsedOutput: unknown;
  finishReason: string | null;
  failureStage: GenerationFailureStage | null;
  failureCategory: GenerationFailureCategory | null;
  validationIssues: RecommendationEvidenceValidationIssue[];
  rejectedItem: RecommendationRejectedItemEvidence | null;
}

interface CaptureOptions {
  stage: RecommendationOutputEvidence["stage"];
  rawText: string;
  parsedOutput: unknown;
  parseError: RecommendationOutputEvidence["parseError"];
  validationIssues: RecommendationValidationIssue[];
  rejected: boolean;
  completionReceived?: boolean;
  finishReason?: string | null;
  failureStage?: GenerationFailureStage | null;
  failureCategory?: GenerationFailureCategory | null;
  secrets?: string[];
}

export function captureRecommendationOutputEvidence({
  stage,
  rawText,
  parsedOutput,
  parseError,
  validationIssues,
  rejected,
  completionReceived = true,
  finishReason = null,
  failureStage = null,
  failureCategory = null,
  secrets = [],
}: CaptureOptions): RecommendationOutputEvidence {
  const scrubbedRaw = scrubStrengthGapEvidenceText(rawText, secrets);
  const issues = validationIssues.map((issue) => ({
    validationLayer: issue.validationLayer ?? null,
    validationCode: issue.validationCode ?? null,
    rule: issue.rule ?? null,
    path: scrubStrengthGapEvidenceText(issue.path, secrets),
    message: scrubStrengthGapEvidenceText(issue.message, secrets),
    matchItemRefs: (issue.matchItemRefs ?? []).map((ref) =>
      scrubStrengthGapEvidenceText(ref, secrets),
    ),
  }));
  const uniquelyLocated = [
    ...new Set(issues.flatMap((issue) => issue.matchItemRefs)),
  ];
  const locatedIssue =
    uniquelyLocated.length === 1
      ? issues.find((issue) => issue.matchItemRefs.includes(uniquelyLocated[0]))
      : null;

  return {
    stage,
    rejected,
    completionReceived,
    rawAvailable: rawText.length > 0,
    rawText: scrubbedRaw.slice(0, RECOMMENDATION_RAW_CAPTURE_LIMIT),
    rawTextLength: scrubbedRaw.length,
    artifactTruncated: scrubbedRaw.length > RECOMMENDATION_RAW_CAPTURE_LIMIT,
    parseError,
    parsedOutputAvailable: parsedOutput !== null,
    parsedOutput: scrubEvidenceValue(parsedOutput, secrets),
    finishReason,
    failureStage,
    failureCategory,
    validationIssues: issues,
    rejectedItem:
      locatedIssue && uniquelyLocated.length === 1
        ? { path: locatedIssue.path, matchItemRef: uniquelyLocated[0] }
        : null,
  };
}
