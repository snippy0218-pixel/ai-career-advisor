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

/**
 * Bounded terminal recovery for an otherwise schema-valid Recommendation
 * repair whose only remaining defects are in the free-text summary.
 *
 * The replacement contains no Candidate/JD fact, status, waiver, or new
 * reference. Structured refs, limitations, questions, and the decision level
 * remain untouched, then the caller reruns the complete Recommendation
 * validator.
 */
export function normalizeRejectedRecommendationSummary(
  raw: RawRecommendation,
  issues: RecommendationValidationIssue[],
): RecommendationNormalizationResult {
  const normalizable =
    issues.length > 0 &&
    issues.every(
      (issue) =>
        issue.path === "summary" &&
        NORMALIZABLE_SUMMARY_ISSUE.test(
          `${issue.validationCode ?? ""} ${issue.message}`,
        ),
    );
  if (!normalizable) {
    return {
      data: structuredClone(raw),
      applied: false,
      issues: [],
      previousSummary: null,
    };
  }
  const data = structuredClone(raw);
  const previousSummary = data.summary;
  data.summary =
    "本建议仅依据 Match Core 的结构化结论；限制项与待确认事项保持对应引用。";
  return {
    data,
    applied: true,
    issues: issues.map((issue) => issue.validationCode ?? issue.message),
    previousSummary,
  };
}
