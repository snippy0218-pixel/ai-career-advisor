import {
  aggregateDimensionStatuses,
  type MatchStatus,
  type MatchValidationIssue,
  type RawMatchCore,
} from "./match-schema";
import type { FinalCanonicalCandidateFact } from "./profile-schema";

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

function factCanPreservePositiveDimension(
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  fact: FinalCanonicalCandidateFact,
) {
  if (dimension.dimensionType === "responsibility") {
    return /独立|负责|责任|主导|牵头|交付/.test(fact.statement);
  }
  const fragment = dimension.requirementFragment
    .replace(/熟练|精通|能力|经验|经历|项目|要求|相关|具有|具备|能够|能/g, "")
    .toLowerCase();
  const statement = fact.statement.toLowerCase();
  const ascii = fragment.match(/[a-z][a-z0-9+#.]{1,}/g) ?? [];
  if (ascii.some((token) => statement.includes(token))) return true;
  for (const run of fragment.match(/[\p{Script=Han}]+/gu) ?? []) {
    const matchedBigrams = new Set<string>();
    for (let index = 0; index + 2 <= run.length; index += 1) {
      const bigram = run.slice(index, index + 2);
      if (statement.includes(bigram)) matchedBigrams.add(bigram);
    }
    if (matchedBigrams.size >= (run.length === 2 ? 1 : 2)) return true;
  }
  return false;
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
  canonicalFacts: readonly FinalCanonicalCandidateFact[] = [],
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
  const factById = new Map(canonicalFacts.map((fact) => [fact.factId, fact]));
  for (const { itemIndex, dimensionIndex, codes } of grouped.values()) {
    const item = data.matchItems[itemIndex];
    const dimension = item?.dimensions[dimensionIndex];
    if (!item || !dimension || dimension.status === "unmet") continue;

    const previousStatus = dimension.status;
    const removedCandidateFactRefs = dimension.candidateEvidence.map(
      (entry) => entry.factId,
    );
    const exactPositiveFact =
      dimension.status !== "unknown" &&
      dimension.candidateEvidence.length === 1 &&
      dimension.candidateEvidence[0].role === "positive"
        ? factById.get(dimension.candidateEvidence[0].factId)
        : null;
    if (
      exactPositiveFact &&
      factCanPreservePositiveDimension(dimension, exactPositiveFact)
    ) {
      dimension.reason = `${dimension.candidateEvidence[0].factId} 原文：“${exactPositiveFact.statement}”。`;
      actions.push({
        itemIndex,
        dimensionIndex,
        issueCodes: [...codes].sort(),
        previousStatus,
        normalizedStatus: dimension.status,
        removedCandidateFactRefs: [],
        reasonRebuilt: true,
      });
      continue;
    }
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
