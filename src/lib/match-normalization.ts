import {
  aggregateDimensionStatuses,
  type MatchStatus,
  type MatchValidationIssue,
  type RawMatchCore,
} from "./match-schema";

export interface MatchNormalizationAction {
  itemIndex: number;
  dimensionIndex: number;
  issueCodes: string[];
  previousStatus: MatchStatus;
  normalizedStatus: MatchStatus;
  removedCandidateFactRefs: string[];
  reasonRebuilt: true;
}

export interface MatchNormalizationResult {
  data: RawMatchCore;
  applied: boolean;
  actions: MatchNormalizationAction[];
}

const REASON_PATH = /^matchItems\.(\d+)\.dimensions\.(\d+)\.reason$/;
const NORMALIZABLE_REASON_RULE = /\b(?:M-CANDIDATE-LINEAGE|M-K)\b/;

function issueCode(message: string) {
  return message.match(/\bM-[A-Z][A-Z0-9-]*\b/)?.[0] ?? "MATCH_VALIDATION_REJECTED";
}

function safeFragment(fragment: string) {
  return fragment.replace(/[“”"]/g, "").slice(0, 120);
}

function unknownReason() {
  return "现有资料无法确认该维度是否满足。";
}

function missingInformation(fragment: string) {
  return `尚缺少可验证的“${safeFragment(fragment)}”同维度候选人证据。`;
}

function verificationQuestion(fragment: string) {
  return `请补充可验证的“${safeFragment(fragment)}”相关事实或经历。`;
}

/**
 * Terminal, bounded recovery for a model repair that is otherwise structurally
 * valid but still emits a Candidate claim rejected by the existing lineage or
 * modifier guards.
 *
 * It never upgrades a status or invents evidence. Unknown reasons are rebuilt
 * without Candidate narration. A rejected met/partial claim is conservatively
 * downgraded to unknown and loses all Candidate refs. Unmet is intentionally
 * not normalized because discarding explicit counter-evidence would change a
 * known negative conclusion. The caller must run the complete validator again.
 */
export function normalizeRejectedMatchReasons(
  raw: RawMatchCore,
  issues: MatchValidationIssue[],
): MatchNormalizationResult {
  const grouped = new Map<string, { itemIndex: number; dimensionIndex: number; codes: Set<string> }>();
  for (const issue of issues) {
    if (!NORMALIZABLE_REASON_RULE.test(issue.message)) continue;
    const match = issue.path.match(REASON_PATH);
    if (!match) continue;
    const itemIndex = Number(match[1]);
    const dimensionIndex = Number(match[2]);
    const key = `${itemIndex}:${dimensionIndex}`;
    const entry = grouped.get(key) ?? {
      itemIndex,
      dimensionIndex,
      codes: new Set<string>(),
    };
    entry.codes.add(issueCode(issue.message));
    grouped.set(key, entry);
  }

  const data = structuredClone(raw);
  const actions: MatchNormalizationAction[] = [];
  for (const { itemIndex, dimensionIndex, codes } of grouped.values()) {
    const item = data.matchItems[itemIndex];
    const dimension = item?.dimensions[dimensionIndex];
    if (!item || !dimension || dimension.status === "unmet") continue;

    const previousStatus = dimension.status;
    const removedCandidateFactRefs = dimension.candidateEvidence.map(
      (entry) => entry.factId,
    );
    dimension.reason = unknownReason();
    if (dimension.status !== "unknown") {
      dimension.status = "unknown";
      dimension.candidateEvidence = [];
      dimension.missingInformation ??= missingInformation(
        dimension.requirementFragment,
      );
      dimension.verificationQuestion ??= verificationQuestion(
        dimension.requirementFragment,
      );
    }
    actions.push({
      itemIndex,
      dimensionIndex,
      issueCodes: [...codes].sort(),
      previousStatus,
      normalizedStatus: dimension.status,
      removedCandidateFactRefs,
      reasonRebuilt: true,
    });
  }

  for (const item of data.matchItems) {
    item.aggregateStatus = aggregateDimensionStatuses(
      item.dimensions.map((dimension) => dimension.status),
    );
  }
  return { data, applied: actions.length > 0, actions };
}
