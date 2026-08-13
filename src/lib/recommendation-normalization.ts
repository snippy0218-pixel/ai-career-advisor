import type {
  RawRecommendation,
  RecommendationValidationIssue,
} from "./recommendation-schema";

export interface RecommendationNormalizationResult {
  data: RawRecommendation;
  applied: boolean;
  issues: string[];
  previousSummary: string | null;
}

const NORMALIZABLE_SUMMARY_ISSUE =
  /(?:R-C_AMBIGUOUS_STATUS_ATTRIBUTION|unsupported waiver\/flexibility claim|Recommendation must reference Match Items)/;
const NORMALIZABLE_STRICTNESS_ISSUE =
  /^R-K (MI-\d{3,}) cautious hard unmet without waiver evidence requires strictness confirmation/;

/**
 * Bounded terminal recovery for an otherwise schema-valid Recommendation
 * repair whose only remaining defects are in the free-text summary or a
 * missing strictness-confirmation question for an explicitly referenced hard
 * unmet Match item.
 *
 * The replacement contains no Candidate/JD fact, status, waiver, or new
 * reference. Structured refs, limitations, questions, and the decision level
 * remain untouched except for the canonical, fact-free HR strictness question,
 * then the caller reruns the complete Recommendation validator.
 */
export function normalizeRejectedRecommendationSummary(
  raw: RawRecommendation,
  issues: RecommendationValidationIssue[],
): RecommendationNormalizationResult {
  const normalizable = issues.length > 0 && issues.every((issue) => {
    const summaryIssue =
      issue.path === "summary" &&
      NORMALIZABLE_SUMMARY_ISSUE.test(
        `${issue.validationCode ?? ""} ${issue.message}`,
      );
    const strictnessIssue =
      issue.path === "questionsToConfirm" &&
      NORMALIZABLE_STRICTNESS_ISSUE.test(issue.message);
    return summaryIssue || strictnessIssue;
  });
  if (!normalizable) {
    return {
      data: structuredClone(raw),
      applied: false,
      issues: [],
      previousSummary: null,
    };
  }
  const data = structuredClone(raw);
  const hasSummaryIssue = issues.some((issue) => issue.path === "summary");
  const previousSummary = hasSummaryIssue ? data.summary : null;
  if (hasSummaryIssue) {
    data.summary =
      "本建议仅依据 Match Core 的结构化结论；限制项与待确认事项保持对应引用。";
  }
  for (const issue of issues) {
    const strictnessMatch = issue.message.match(NORMALIZABLE_STRICTNESS_ISSUE);
    const matchRef = strictnessMatch?.[1];
    if (!matchRef) continue;
    data.questionsToConfirm.push({
      question: `请向招聘方确认 ${matchRef} 是否属于严格筛选门槛？`,
      matchItemRefs: [matchRef],
    });
  }
  return {
    data,
    applied: true,
    issues: issues.map((issue) => issue.validationCode ?? issue.message),
    previousSummary,
  };
}
