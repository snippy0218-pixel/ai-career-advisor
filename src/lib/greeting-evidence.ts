import { scrubStrengthGapEvidenceText } from "./strength-gap-evidence";
import type {
  GenerationFailureCategory,
  GenerationFailureStage,
} from "./generation-evidence";
import type { GreetingValidationIssue } from "./greeting-schema";

export const GREETING_RAW_CAPTURE_LIMIT = 12_000;

export interface GreetingRejectedFragmentEvidence {
  candidateFactRef: string | null;
  statement: string | null;
  validatorRules: string[];
  rejectionReasons: string[];
}

export interface GreetingOutputEvidence {
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
  validationIssues: GreetingValidationIssue[];
  rejectedGreeting: string | null;
  rejectedFragments: GreetingRejectedFragmentEvidence[];
}

interface CaptureOptions {
  stage: GreetingOutputEvidence["stage"];
  rawText: string;
  parsedOutput: unknown;
  parseError: GreetingOutputEvidence["parseError"];
  validationIssues: GreetingValidationIssue[];
  rejected: boolean;
  completionReceived?: boolean;
  finishReason?: string | null;
  failureStage?: GenerationFailureStage | null;
  failureCategory?: GenerationFailureCategory | null;
  secrets?: string[];
}

function scrubUnknown(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") {
    return scrubStrengthGapEvidenceText(value, secrets);
  }
  if (Array.isArray(value)) return value.map((item) => scrubUnknown(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(?:authorization|api[_-]?key|cookie|password|credential|access[_-]?token)$/i.test(key)
          ? "[REDACTED_SECRET]"
          : scrubUnknown(item, secrets),
      ]),
    );
  }
  return value;
}

function parsedRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function rulesForPath(path: string, issues: GreetingValidationIssue[]) {
  return [
    ...new Set(
      issues
        .filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`))
        .flatMap((issue) => issue.message.match(/\bPG-[A-M]\b/g) ?? ["RAW_SCHEMA"]),
    ),
  ];
}

export function captureGreetingOutputEvidence({
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
}: CaptureOptions): GreetingOutputEvidence {
  const scrubbedRaw = scrubStrengthGapEvidenceText(rawText, secrets);
  const parsed = parsedRecord(parsedOutput);
  const claims = Array.isArray(parsed?.candidateClaims)
    ? parsed.candidateClaims
    : [];
  const scrubbedIssues = validationIssues.map((issue) => ({
    path: scrubStrengthGapEvidenceText(issue.path, secrets),
    message: scrubStrengthGapEvidenceText(issue.message, secrets),
  }));
  return {
    stage,
    rejected,
    completionReceived,
    rawAvailable: rawText.length > 0,
    rawText: scrubbedRaw.slice(0, GREETING_RAW_CAPTURE_LIMIT),
    rawTextLength: scrubbedRaw.length,
    artifactTruncated: scrubbedRaw.length > GREETING_RAW_CAPTURE_LIMIT,
    parseError,
    parsedOutputAvailable: parsedOutput !== null,
    parsedOutput: scrubUnknown(parsedOutput, secrets),
    finishReason,
    failureStage,
    failureCategory,
    validationIssues: scrubbedIssues,
    rejectedGreeting:
      typeof parsed?.greeting === "string"
        ? scrubStrengthGapEvidenceText(parsed.greeting, secrets)
        : null,
    rejectedFragments: claims.map((claim, index) => {
      const record = parsedRecord(claim);
      const path = `candidateClaims.${index}`;
      const relatedIssues = scrubbedIssues.filter(
        (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
      );
      return {
        candidateFactRef:
          typeof record?.candidateFactRef === "string"
            ? scrubStrengthGapEvidenceText(record.candidateFactRef, secrets)
            : null,
        statement:
          typeof record?.statement === "string"
            ? scrubStrengthGapEvidenceText(record.statement, secrets)
            : null,
        validatorRules: rulesForPath(path, scrubbedIssues),
        rejectionReasons: relatedIssues.map((issue) => issue.message),
      };
    }),
  };
}
