import type { RawStrengthGap, StrengthGapValidationIssue } from "./strength-gap-schema";
import type { FinalMatchCore } from "./match-schema";

export interface StrengthGapNormalizationAction {
  strengthIndex?: number;
  gapIndex?: number;
  issueCodes: string[];
  removedType:
    | "transferable_strength"
    | "direct_match"
    | RawStrengthGap["gaps"][number]["type"];
  removedStatement: string;
  removedMatchRefs: string[];
  rewrittenType?:
    | RawStrengthGap["strengths"][number]["type"]
    | RawStrengthGap["gaps"][number]["type"];
  replacementStatement?: string;
  replacementSuggestedAction?: string;
  replacementActionType?: RawStrengthGap["gaps"][number]["actionType"];
}

export interface StrengthGapNormalizationResult {
  data: RawStrengthGap;
  applied: boolean;
  actions: StrengthGapNormalizationAction[];
}

const OPTIONAL_TRANSFERABLE_PATH = /^strengths\.(\d+)(?:\.statement)?$/;
const TRANSFERABLE_BOUNDARY_RULE = /\bSG-(?:B|M)\b/;

function issueCodes(message: string) {
  return [...new Set(message.match(/\bSG-[A-Z]\b/g) ?? [])].sort();
}

/**
 * Bounded terminal recovery for an otherwise schema-valid repair whose
 * optional transferable strength still violates the existing SG-B/SG-M
 * Candidate boundary.
 *
 * Transferable strengths are optional. Removing a rejected relation neither
 * invents evidence nor changes Match Core, gaps, or mandatory direct/supporting
 * strength coverage. The caller must run the complete SG-A..SG-N validator on
 * the resulting object and may accept it only when every guard passes.
 */
export function normalizeRejectedTransferableStrengths(
  raw: RawStrengthGap,
  issues: StrengthGapValidationIssue[],
  matchCore?: FinalMatchCore,
): StrengthGapNormalizationResult {
  const targeted = new Map<number, Set<string>>();
  for (const issue of issues) {
    if (!TRANSFERABLE_BOUNDARY_RULE.test(issue.message)) continue;
    const path = issue.path.match(OPTIONAL_TRANSFERABLE_PATH);
    if (!path) continue;
    const index = Number(path[1]);
    const entry = raw.strengths[index];
    if (!entry || entry.type !== "transferable_strength") continue;
    const codes = targeted.get(index) ?? new Set<string>();
    for (const code of issueCodes(issue.message)) codes.add(code);
    targeted.set(index, codes);
  }

  const strengthActions: StrengthGapNormalizationAction[] = [...targeted.entries()]
    .sort(([left], [right]) => left - right)
    .map(([strengthIndex, codes]) => {
      const entry = raw.strengths[strengthIndex];
      return {
        strengthIndex,
        issueCodes: [...codes].sort(),
        removedType: "transferable_strength" as const,
        removedStatement: entry.statement,
        removedMatchRefs: [...entry.matchRefs],
      };
    });
  const duplicateGapIssue = issues.some(
    (issue) =>
      issue.path === "gaps" &&
      issue.message === "duplicate Gap type/reference entry",
  );
  const gapActions: StrengthGapNormalizationAction[] = [];
  const seenGapKeys = new Set<string>();
  if (duplicateGapIssue) {
    raw.gaps.forEach((entry, gapIndex) => {
      const key = `${entry.type}:${[...entry.matchRefs].sort().join(",")}`;
      if (!seenGapKeys.has(key)) {
        seenGapKeys.add(key);
        return;
      }
      gapActions.push({
        gapIndex,
        issueCodes: ["SG-DUPLICATE-GAP"],
        removedType: entry.type,
        removedStatement: entry.statement,
        removedMatchRefs: [...entry.matchRefs],
      });
    });
  }
  const invalidGapRemovalActions: StrengthGapNormalizationAction[] = [];
  const gapRewriteActions: StrengthGapNormalizationAction[] = [];
  if (matchCore) {
    for (const issue of issues) {
      const path = issue.path.match(/^gaps\.(\d+)$/);
      if (!path) continue;
      const gapIndex = Number(path[1]);
      const entry = raw.gaps[gapIndex];
      if (!entry) continue;
      const items = entry.matchRefs
        .map((ref) => matchCore.matchItems[Number(ref.slice(3)) - 1])
        .filter(Boolean);
      if (
        /SG-F information gap must preserve unknown/.test(issue.message) &&
        entry.type === "information"
      ) {
        gapRewriteActions.push({
          gapIndex,
          issueCodes: ["SG-F"],
          removedType: entry.type,
          removedStatement: entry.statement,
          removedMatchRefs: [...entry.matchRefs],
          rewrittenType: "information",
          replacementStatement:
            "该 Match 项仍为 unknown；现有资料不足以确认是否满足要求。",
          replacementSuggestedAction:
            "请补充或确认与该 Match 项直接相关的可验证信息。",
          replacementActionType: "confirm",
        });
        continue;
      }
      if (
        !/SG-E evidence_expression requires partial positive evidence/.test(
          issue.message,
        ) ||
        entry.type !== "evidence_expression"
      ) {
        continue;
      }
      const allUnknown =
        items.length > 0 &&
        items.every((item) =>
          item.requirementDimensions.some(
            (dimension) => dimension.status === "unknown",
          ),
        );
      const allPartialPositive =
        items.length > 0 &&
        items.every(
          (item) =>
            item.status === "partial" &&
            item.requirementDimensions.some(
              (dimension) => dimension.candidateEvidenceRole === "positive",
            ),
        );
      if (allUnknown || allPartialPositive) {
        gapRewriteActions.push({
          gapIndex,
          issueCodes: ["SG-E"],
          removedType: entry.type,
          removedStatement: entry.statement,
          removedMatchRefs: [...entry.matchRefs],
          rewrittenType: allUnknown ? "information" : "evidence_expression",
          replacementStatement: allUnknown
            ? "该 Match 项仍为 unknown；现有资料不足以确认是否满足要求。"
            : "现有正向 Match 证据仅能表明部分支持，尚不足以证明完整满足该项要求。",
          replacementSuggestedAction: allUnknown
            ? "请补充或确认与该 Match 项直接相关的可验证信息。"
            : "如果确有更完整的相关事实，请补充可验证证据。",
          replacementActionType: allUnknown ? "confirm" : "evidence",
        });
      } else {
        invalidGapRemovalActions.push({
          gapIndex,
          issueCodes: ["SG-E"],
          removedType: entry.type,
          removedStatement: entry.statement,
          removedMatchRefs: [...entry.matchRefs],
        });
      }
    }
  }
  const directActions: StrengthGapNormalizationAction[] = [];
  if (matchCore) {
    for (const issue of issues) {
      const path = issue.path.match(/^strengths\.(\d+)\.statement$/);
      if (!path || !/SG-B Candidate scope\/modifier/.test(issue.message)) {
        continue;
      }
      const strengthIndex = Number(path[1]);
      const entry = raw.strengths[strengthIndex];
      if (!entry || entry.type !== "direct_match") continue;
      const source = entry.matchRefs
        .map((ref) => matchCore.matchItems[Number(ref.slice(3)) - 1])
        .filter(Boolean)
        .flatMap((item) =>
          item.requirementDimensions
            .filter((dimension) => dimension.candidateEvidenceRole === "positive")
            .map((dimension) => dimension.reason),
        )
        .join(" ");
      const preservedScopes = [
        "课程",
        "校园",
        "团队",
        "协助",
        "参与",
        "了解",
        "接触",
      ].filter((scope) => source.includes(scope));
      if (preservedScopes.length === 0) continue;
      const replacementStatement = `正向 Match 证据保留“${preservedScopes.join(
        "、",
      )}”原始范围，并支持该项要求。`;
      directActions.push({
        strengthIndex,
        issueCodes: ["SG-B"],
        removedType: "direct_match",
        removedStatement: entry.statement,
        removedMatchRefs: [...entry.matchRefs],
        rewrittenType: "direct_match",
        replacementStatement,
      });
    }
  }
  const actions = [
    ...strengthActions,
    ...gapActions,
    ...invalidGapRemovalActions,
    ...gapRewriteActions,
    ...directActions,
  ];
  const removedStrengths = new Set(
    strengthActions.map((action) => action.strengthIndex),
  );
  const removedGaps = new Set(
    [...gapActions, ...invalidGapRemovalActions].map((action) => action.gapIndex),
  );
  const data = structuredClone(raw);
  for (const action of gapRewriteActions) {
    if (action.gapIndex === undefined) continue;
    const entry = data.gaps[action.gapIndex];
    if (!entry || !action.rewrittenType || !action.replacementStatement) continue;
    entry.type = action.rewrittenType as RawStrengthGap["gaps"][number]["type"];
    entry.statement = action.replacementStatement;
    entry.suggestedAction = action.replacementSuggestedAction ?? entry.suggestedAction;
    entry.actionType = action.replacementActionType ?? entry.actionType;
  }
  for (const action of directActions) {
    if (
      action.strengthIndex !== undefined &&
      action.replacementStatement !== undefined
    ) {
      data.strengths[action.strengthIndex].statement = action.replacementStatement;
    }
  }
  data.strengths = data.strengths.filter(
    (_entry, index) => !removedStrengths.has(index),
  );
  data.gaps = data.gaps.filter((_entry, index) => !removedGaps.has(index));
  return { data, applied: actions.length > 0, actions };
}
