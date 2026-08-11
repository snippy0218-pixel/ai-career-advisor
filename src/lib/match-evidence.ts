import type {
  GenerationFailureCategory,
  GenerationFailureStage,
} from "./generation-evidence";
import type { MatchValidationIssue } from "./match-schema";
import {
  scrubEvidenceValue,
  scrubStrengthGapEvidenceText,
  STRENGTH_GAP_RAW_CAPTURE_LIMIT,
} from "./strength-gap-evidence";

export interface MatchRejectedItemLocator {
  collection: "matchItems";
  itemIndex: number;
  dimensionIndex: number | null;
  item: unknown;
  dimension: unknown;
}

export interface MatchEvidenceValidationIssue {
  validationLayer: "raw_schema" | "semantic_validation";
  validationCode: string;
  rule: string | null;
  path: string;
  message: string;
  rejectedItem: MatchRejectedItemLocator | null;
}

export interface MatchOutputEvidence {
  stage: "initial" | "repair";
  rejected: boolean;
  completionReceived: boolean;
  rawAvailable: boolean;
  rawText: string;
  rawTextLength: number;
  artifactTruncated: boolean;
  finishReason: string | null;
  parsedOutputAvailable: boolean;
  parsedOutput: unknown;
  parseError: "JSON_PARSE_ERROR" | null;
  validationLayer:
    | "completion"
    | "parse"
    | "raw_schema"
    | "semantic_validation"
    | null;
  failureStage: GenerationFailureStage | null;
  failureCategory: GenerationFailureCategory | null;
  validationIssues: MatchEvidenceValidationIssue[];
  rejectedItem: MatchRejectedItemLocator | null;
}

interface CaptureMatchEvidenceOptions {
  stage: MatchOutputEvidence["stage"];
  rejected: boolean;
  rawText: string | null;
  parsedOutput: unknown;
  parseError: MatchOutputEvidence["parseError"];
  validationIssues: MatchValidationIssue[];
  rawSchemaValid: boolean | null;
  finishReason?: string | null;
  completionReceived?: boolean;
  failureStage?: GenerationFailureStage | null;
  failureCategory?: GenerationFailureCategory | null;
  secrets?: string[];
}

function ruleFromMessage(message: string) {
  return message.match(/\bM-[A-Z][A-Z0-9-]*\b/)?.[0] ?? null;
}

function locateRejectedItem(
  parsedOutput: unknown,
  path: string,
): MatchRejectedItemLocator | null {
  const match = path.match(
    /^matchItems\.(\d+)(?:\.(?:dimensions|requirementDimensions)\.(\d+))?(?:\.|$)/,
  );
  if (!match || !parsedOutput || typeof parsedOutput !== "object") return null;
  const items = (parsedOutput as Record<string, unknown>).matchItems;
  if (!Array.isArray(items)) return null;
  const itemIndex = Number(match[1]);
  const item = items[itemIndex];
  if (!item || typeof item !== "object") return null;
  const dimensionIndex = match[2] === undefined ? null : Number(match[2]);
  const dimensions = (item as Record<string, unknown>).dimensions;
  const dimension =
    dimensionIndex !== null && Array.isArray(dimensions)
      ? dimensions[dimensionIndex] ?? null
      : null;
  return {
    collection: "matchItems",
    itemIndex,
    dimensionIndex,
    item,
    dimension,
  };
}

export function captureMatchOutputEvidence({
  stage,
  rejected,
  rawText,
  parsedOutput,
  parseError,
  validationIssues,
  rawSchemaValid,
  finishReason = null,
  completionReceived = true,
  failureStage = null,
  failureCategory = null,
  secrets = [],
}: CaptureMatchEvidenceOptions): MatchOutputEvidence {
  const scrubbedRaw = scrubStrengthGapEvidenceText(rawText ?? "", secrets);
  const issueLayer = rawSchemaValid === false ? "raw_schema" : "semantic_validation";
  const scrubbedParsed = scrubEvidenceValue(parsedOutput, secrets);
  const issues = validationIssues.map((issue) => {
    const rule = ruleFromMessage(issue.message);
    const rejectedItem = locateRejectedItem(scrubbedParsed, issue.path);
    return {
      validationLayer: issueLayer,
      validationCode:
        rule ?? (issueLayer === "raw_schema" ? "RAW_SCHEMA_INVALID" : "MATCH_VALIDATION_REJECTED"),
      rule,
      path: scrubStrengthGapEvidenceText(issue.path, secrets),
      message: scrubStrengthGapEvidenceText(issue.message, secrets),
      rejectedItem,
    } satisfies MatchEvidenceValidationIssue;
  });
  const locators = issues
    .map((issue) => issue.rejectedItem)
    .filter((item): item is MatchRejectedItemLocator => item !== null);
  const uniqueLocators = new Map(
    locators.map((item) => [
      `${item.itemIndex}:${item.dimensionIndex ?? "item"}`,
      item,
    ]),
  );
  const validationLayer =
    failureStage === "completion" ||
    failureStage === "provider_request" ||
    failureStage === "provider_response"
      ? "completion"
      : parseError
        ? "parse"
        : validationIssues.length > 0
          ? issueLayer
          : null;
  return {
    stage,
    rejected,
    completionReceived,
    rawAvailable: rawText !== null && rawText.length > 0,
    rawText: scrubbedRaw.slice(0, STRENGTH_GAP_RAW_CAPTURE_LIMIT),
    rawTextLength: scrubbedRaw.length,
    artifactTruncated: scrubbedRaw.length > STRENGTH_GAP_RAW_CAPTURE_LIMIT,
    finishReason,
    parsedOutputAvailable: parsedOutput !== null,
    parsedOutput: scrubbedParsed,
    parseError,
    validationLayer,
    failureStage,
    failureCategory,
    validationIssues: issues,
    rejectedItem:
      uniqueLocators.size === 1 ? [...uniqueLocators.values()][0] : null,
  };
}
