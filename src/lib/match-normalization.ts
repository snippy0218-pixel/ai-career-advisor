import {
  aggregateDimensionStatuses,
  type MatchStatus,
  type MatchValidationIssue,
  type RawMatchCore,
} from "./match-schema";
import type { FinalCanonicalCandidateFact } from "./profile-schema";

export interface MatchNormalizationAction {
  itemIndex: number;
  dimensionIndex: number | null;
  issueCodes: string[];
  previousStatus: MatchStatus;
  normalizedStatus: MatchStatus;
  removedCandidateFactRefs: string[];
  reasonRebuilt: boolean;
}

export interface MatchNormalizationResult {
  data: RawMatchCore;
  applied: boolean;
  actions: MatchNormalizationAction[];
}

const REASON_PATH = /^matchItems\.(\d+)\.dimensions\.(\d+)\.reason$/;
const STATUS_PATH = /^matchItems\.(\d+)\.dimensions\.(\d+)\.status$/;
const AGGREGATE_PATH = /^matchItems\.(\d+)\.aggregateStatus$/;
const DIMENSIONS_PATH = /^matchItems\.(\d+)\.dimensions$/;
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

function canPreserveExplicitEmploymentCounter(
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  fact: FinalCanonicalCandidateFact | undefined,
) {
  if (
    dimension.dimensionType !== "employment_type" ||
    dimension.status !== "unmet" ||
    dimension.candidateEvidence.length !== 1 ||
    dimension.candidateEvidence[0].role !== "counter" ||
    !fact ||
    !/(?:没有|尚无|不具备|未曾|从未|未从事)/.test(fact.statement) ||
    !/(?:工作|经历|经验)/.test(fact.statement)
  ) {
    return false;
  }
  const requirementContext = `${dimension.requirementFragment} ${dimension.jdEvidence.join(" ")}`;
  return ["正式", "全职", "实习"].some(
    (qualifier) =>
      requirementContext.includes(qualifier) && fact.statement.includes(qualifier),
  );
}

function explicitDurationShortfall(
  dimension: RawMatchCore["matchItems"][number]["dimensions"][number],
  fact: FinalCanonicalCandidateFact | undefined,
) {
  if (
    dimension.dimensionType !== "duration" ||
    dimension.status !== "unmet" ||
    dimension.candidateEvidence.length !== 1 ||
    dimension.candidateEvidence[0].role !== "counter" ||
    !fact
  ) {
    return null;
  }
  const requirementContext = `${dimension.requirementFragment} ${dimension.jdEvidence.join(" ")}`;
  const requiredYears = Number(requirementContext.match(/(\d+)\s*年/)?.[1]);
  const candidateYears = Number(fact.statement.match(/(\d+)\s*年/)?.[1]);
  return Number.isFinite(requiredYears) &&
    Number.isFinite(candidateYears) &&
    candidateYears < requiredYears
    ? { requiredYears, candidateYears }
    : null;
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
  for (const issue of issues) {
    const match = issue.path.match(DIMENSIONS_PATH);
    if (
      !match ||
      issue.message !==
        "explicit full-time/formal-work requirement requires an employment_type dimension"
    ) {
      continue;
    }
    const itemIndex = Number(match[1]);
    const item = data.matchItems[itemIndex];
    const sourceDimension = item?.dimensions.find(
      (dimension) =>
        dimension.status === "unknown" &&
        /(?:正式工作|全职)/.test(
          `${dimension.requirementFragment} ${dimension.jdEvidence.join(" ")}`,
        ),
    );
    if (
      !item ||
      !sourceDimension ||
      item.dimensions.some((dimension) => dimension.dimensionType === "employment_type")
    ) {
      continue;
    }
    item.dimensions.push({
      dimensionType: "employment_type",
      requirementFragment: sourceDimension.requirementFragment,
      status: "unknown",
      reason: unknownReason(),
      jdEvidence: [...sourceDimension.jdEvidence],
      candidateEvidence: [],
      missingInformation: missingInformation(sourceDimension.requirementFragment),
      verificationQuestion: verificationQuestion(sourceDimension.requirementFragment),
    });
    actions.push({
      itemIndex,
      dimensionIndex: item.dimensions.length - 1,
      issueCodes: ["MATCH_VALIDATION_REJECTED"],
      previousStatus: item.aggregateStatus,
      normalizedStatus: item.aggregateStatus,
      removedCandidateFactRefs: [],
      reasonRebuilt: true,
    });
  }
  for (const issue of issues) {
    const match = issue.path.match(STATUS_PATH);
    if (
      !match ||
      !issue.message.includes("M-DURATION explicit numeric shortfall must be unmet")
    ) {
      continue;
    }
    const itemIndex = Number(match[1]);
    const dimensionIndex = Number(match[2]);
    const dimension = data.matchItems[itemIndex]?.dimensions[dimensionIndex];
    if (!dimension || dimension.dimensionType !== "duration" || dimension.status !== "partial") {
      continue;
    }
    const requirementContext = `${dimension.requirementFragment} ${dimension.jdEvidence.join(" ")}`;
    const requiredYears = Number(requirementContext.match(/(\d+)\s*年/)?.[1]);
    const shortfall = dimension.candidateEvidence
      .map((entry) => ({ entry, fact: factById.get(entry.factId) }))
      .find(({ fact }) => {
        const candidateYears = Number(fact?.statement.match(/(\d+)\s*年/)?.[1]);
        return Number.isFinite(candidateYears) && candidateYears < requiredYears;
      });
    if (!shortfall?.fact || !Number.isFinite(requiredYears)) continue;
    const candidateYears = Number(shortfall.fact.statement.match(/(\d+)\s*年/)?.[1]);
    dimension.status = "unmet";
    dimension.reason = `${shortfall.entry.factId} 原文：“${shortfall.fact.statement}”，${candidateYears}年低于${requiredYears}年要求。`;
    dimension.candidateEvidence = [
      { factId: shortfall.entry.factId, role: "counter" },
    ];
    dimension.missingInformation = null;
    dimension.verificationQuestion = null;
    actions.push({
      itemIndex,
      dimensionIndex,
      issueCodes: ["M-DURATION"],
      previousStatus: "partial",
      normalizedStatus: "unmet",
      removedCandidateFactRefs: [],
      reasonRebuilt: true,
    });
  }
  for (const { itemIndex, dimensionIndex, codes } of grouped.values()) {
    const item = data.matchItems[itemIndex];
    const dimension = item?.dimensions[dimensionIndex];
    if (!item || !dimension) continue;

    const previousStatus = dimension.status;
    const removedCandidateFactRefs = dimension.candidateEvidence.map(
      (entry) => entry.factId,
    );
    if (dimension.status === "unmet") {
      const exactCounterFact =
        dimension.candidateEvidence.length === 1
          ? factById.get(dimension.candidateEvidence[0].factId)
          : undefined;
      const durationShortfall = explicitDurationShortfall(
        dimension,
        exactCounterFact,
      );
      if (
        durationShortfall &&
        [...codes].every((code) =>
          ["M-CANDIDATE-LINEAGE", "M-K"].includes(code),
        )
      ) {
        dimension.reason = `${dimension.candidateEvidence[0].factId} 原文：“${exactCounterFact!.statement}”，${durationShortfall.candidateYears}年低于${durationShortfall.requiredYears}年要求。`;
        actions.push({
          itemIndex,
          dimensionIndex,
          issueCodes: [...codes].sort(),
          previousStatus,
          normalizedStatus: "unmet",
          removedCandidateFactRefs: [],
          reasonRebuilt: true,
        });
        continue;
      }
      if (
        codes.size === 1 &&
        codes.has("M-CANDIDATE-LINEAGE") &&
        canPreserveExplicitEmploymentCounter(dimension, exactCounterFact)
      ) {
        dimension.reason = `${dimension.candidateEvidence[0].factId} 原文：“${exactCounterFact!.statement}”。`;
        actions.push({
          itemIndex,
          dimensionIndex,
          issueCodes: [...codes],
          previousStatus,
          normalizedStatus: "unmet",
          removedCandidateFactRefs: [],
          reasonRebuilt: true,
        });
        continue;
      }
      if (
        canonicalFacts.length === 0 ||
        !codes.has("M-CANDIDATE-LINEAGE") ||
        dimension.dimensionType !== "responsibility" ||
        !/(?:独立|主导|负责)/.test(dimension.requirementFragment) ||
        !/(?:团队负责人|由团队.{0,8}(?:负责|统一))/.test(dimension.reason)
      ) {
        continue;
      }
      dimension.status = "unknown";
      dimension.reason = unknownReason();
      dimension.candidateEvidence = [];
      dimension.missingInformation ??= missingInformation(
        dimension.requirementFragment,
      );
      dimension.verificationQuestion ??= verificationQuestion(
        dimension.requirementFragment,
      );
      actions.push({
        itemIndex,
        dimensionIndex,
        issueCodes: [...codes].sort(),
        previousStatus,
        normalizedStatus: "unknown",
        removedCandidateFactRefs,
        reasonRebuilt: true,
      });
      continue;
    }
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

  const aggregateIssueItems = new Set(
    issues.flatMap((issue) => {
      const match = issue.path.match(AGGREGATE_PATH);
      return match && /aggregateStatus must be/.test(issue.message)
        ? [Number(match[1])]
        : [];
    }),
  );
  for (const [itemIndex, item] of data.matchItems.entries()) {
    const computed = aggregateDimensionStatuses(
      item.dimensions.map((dimension) => dimension.status),
    );
    if (
      item.aggregateStatus !== computed &&
      (aggregateIssueItems.has(itemIndex) ||
        actions.some((action) => action.itemIndex === itemIndex))
    ) {
      const previousStatus = item.aggregateStatus;
      item.aggregateStatus = computed;
      actions.push({
        itemIndex,
        dimensionIndex: null,
        issueCodes: ["M-AGGREGATE"],
        previousStatus,
        normalizedStatus: computed,
        removedCandidateFactRefs: [],
        reasonRebuilt: false,
      });
    }
  }
  return { data, applied: actions.length > 0, actions };
}
