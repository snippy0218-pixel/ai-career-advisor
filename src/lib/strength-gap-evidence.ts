import type { StrengthGapValidationIssue } from "./strength-gap-schema";

export const STRENGTH_GAP_RAW_CAPTURE_LIMIT = 12_000;

export interface StrengthGapRejectedItemEvidence {
  collection: "strengths" | "gaps";
  index: number;
  type: string | null;
  statement: string | null;
  matchRefs: string[];
  suggestedAction: string | null;
  validatorRules: string[];
  rejectionCodes: string[];
  rejectionReasons: string[];
}

export interface StrengthGapOutputEvidence {
  stage: "initial" | "repair";
  rejected: boolean;
  rawText: string;
  rawTextLength: number;
  artifactTruncated: boolean;
  parseError: "JSON_PARSE_ERROR" | null;
  parsedOutput: unknown;
  validationIssues: StrengthGapValidationIssue[];
  rejectedItems: StrengthGapRejectedItemEvidence[];
}

interface CaptureOptions {
  stage: StrengthGapOutputEvidence["stage"];
  rawText: string;
  parsedOutput: unknown;
  parseError: StrengthGapOutputEvidence["parseError"];
  validationIssues: StrengthGapValidationIssue[];
  rejected: boolean;
  secrets?: string[];
}

const SECRET_VALUE_PATTERN =
  /((?:authorization|api[_-]?key|cookie|password|credential|access[_-]?token)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;}]+/gi;
const JSON_SECRET_VALUE_PATTERN =
  /("(?:authorization|api[_-]?key|cookie|password|credential|access[_-]?token)"\s*:\s*)"[^"]*"/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi;
const API_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{6,}\b/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scrubStrengthGapEvidenceText(
  value: string,
  secrets: string[] = [],
) {
  let scrubbed = value;
  for (const secret of secrets.filter((entry) => entry.length >= 4)) {
    scrubbed = scrubbed.replace(
      new RegExp(escapeRegExp(secret), "g"),
      "[REDACTED_SECRET]",
    );
  }
  return scrubbed
    .replace(JSON_SECRET_VALUE_PATTERN, '$1"[REDACTED_SECRET]"')
    .replace(SECRET_VALUE_PATTERN, "$1[REDACTED_SECRET]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED_SECRET]")
    .replace(API_KEY_PATTERN, "[REDACTED_SECRET]");
}

function scrubUnknown(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") {
    return scrubStrengthGapEvidenceText(value, secrets);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubUnknown(entry, secrets));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /^(?:authorization|api[_-]?key|cookie|password|credential|access[_-]?token)$/i.test(
          key,
        )
          ? "[REDACTED_SECRET]"
          : scrubUnknown(entry, secrets),
      ]),
    );
  }
  return value;
}

function ruleFromIssue(issue: StrengthGapValidationIssue) {
  return issue.message.match(/\bSG-[A-Z]\b/)?.[0] ?? "RAW_SCHEMA";
}

function rejectionCode(rule: string) {
  return rule === "RAW_SCHEMA" ? "RAW_SCHEMA_INVALID" : `${rule}_REJECTED`;
}

function candidateItem(
  parsedOutput: unknown,
  collection: "strengths" | "gaps",
  index: number,
) {
  if (!parsedOutput || typeof parsedOutput !== "object") return null;
  const entries = (parsedOutput as Record<string, unknown>)[collection];
  if (!Array.isArray(entries)) return null;
  const entry = entries[index];
  return entry && typeof entry === "object"
    ? (entry as Record<string, unknown>)
    : null;
}

function rejectedItems(
  parsedOutput: unknown,
  issues: StrengthGapValidationIssue[],
  secrets: string[],
) {
  const grouped = new Map<
    string,
    {
      collection: "strengths" | "gaps";
      index: number;
      issues: StrengthGapValidationIssue[];
    }
  >();
  for (const issue of issues) {
    const match = issue.path.match(/^(strengths|gaps)\.(\d+)(?:\.|$)/);
    if (!match) continue;
    const collection = match[1] as "strengths" | "gaps";
    const index = Number(match[2]);
    const key = `${collection}.${index}`;
    const existing = grouped.get(key);
    if (existing) existing.issues.push(issue);
    else grouped.set(key, { collection, index, issues: [issue] });
  }
  return [...grouped.values()].map(({ collection, index, issues: itemIssues }) => {
    const item = candidateItem(parsedOutput, collection, index);
    const matchRefs = Array.isArray(item?.matchRefs)
      ? item.matchRefs
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => scrubStrengthGapEvidenceText(entry, secrets))
      : [];
    const rules = [...new Set(itemIssues.map(ruleFromIssue))];
    return {
      collection,
      index,
      type:
        typeof item?.type === "string"
          ? scrubStrengthGapEvidenceText(item.type, secrets)
          : null,
      statement:
        typeof item?.statement === "string"
          ? scrubStrengthGapEvidenceText(item.statement, secrets)
          : null,
      matchRefs,
      suggestedAction:
        typeof item?.suggestedAction === "string"
          ? scrubStrengthGapEvidenceText(item.suggestedAction, secrets)
          : null,
      validatorRules: rules,
      rejectionCodes: rules.map(rejectionCode),
      rejectionReasons: itemIssues.map((issue) =>
        scrubStrengthGapEvidenceText(issue.message, secrets),
      ),
    } satisfies StrengthGapRejectedItemEvidence;
  });
}

export function captureStrengthGapOutputEvidence({
  stage,
  rawText,
  parsedOutput,
  parseError,
  validationIssues,
  rejected,
  secrets = [],
}: CaptureOptions): StrengthGapOutputEvidence {
  const scrubbedRaw = scrubStrengthGapEvidenceText(rawText, secrets);
  return {
    stage,
    rejected,
    rawText: scrubbedRaw.slice(0, STRENGTH_GAP_RAW_CAPTURE_LIMIT),
    rawTextLength: scrubbedRaw.length,
    artifactTruncated: scrubbedRaw.length > STRENGTH_GAP_RAW_CAPTURE_LIMIT,
    parseError,
    parsedOutput: scrubUnknown(parsedOutput, secrets),
    validationIssues: validationIssues.map((issue) => ({
      path: scrubStrengthGapEvidenceText(issue.path, secrets),
      message: scrubStrengthGapEvidenceText(issue.message, secrets),
    })),
    rejectedItems: rejectedItems(parsedOutput, validationIssues, secrets),
  };
}
