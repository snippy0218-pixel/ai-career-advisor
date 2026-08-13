import type {
  RawStrengthGap,
  StrengthGapValidationIssue,
} from "./strength-gap-schema";

export interface StrengthGapNormalizationAction {
  strengthIndex?: number;
  gapIndex?: number;
  issueCodes: string[];
  removedType: "transferable_strength" | RawStrengthGap["gaps"][number]["type"];
  removedStatement: string;
  removedMatchRefs: string[];
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
  const actions = [...strengthActions, ...gapActions];
  const removedStrengths = new Set(
    strengthActions.map((action) => action.strengthIndex),
  );
  const removedGaps = new Set(gapActions.map((action) => action.gapIndex));
  const data = structuredClone(raw);
  data.strengths = data.strengths.filter(
    (_entry, index) => !removedStrengths.has(index),
  );
  data.gaps = data.gaps.filter((_entry, index) => !removedGaps.has(index));
  return { data, applied: actions.length > 0, actions };
}
