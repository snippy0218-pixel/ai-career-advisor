import { describe, expect, it } from "vitest";

import { normalizeRejectedRecommendationSummary } from "./recommendation-normalization";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";

describe("Recommendation rejected-summary normalization", () => {
  it("rebuilds only the summary for an R-C ambiguity", () => {
    const raw = structuredClone(RECOMMENDATION_FIXTURES[0].validRaw);
    raw.summary = "整体部分满足。";
    const result = normalizeRejectedRecommendationSummary(raw, [
      {
        path: "summary",
        message: "ambiguous status phrase attribution: 部分满足",
        validationCode: "R-C_AMBIGUOUS_STATUS_ATTRIBUTION",
        validationLayer: "semantic_validation",
        rule: "R-C",
      },
    ]);
    expect(result.applied).toBe(true);
    expect(result.data.summary).not.toContain("部分满足");
    expect(result.data.supportingMatchRefs).toEqual(raw.supportingMatchRefs);
    expect(result.data.limitations).toEqual(raw.limitations);
    expect(raw.summary).toBe("整体部分满足。");
  });

  it("does not hide non-summary or structural failures", () => {
    const raw = RECOMMENDATION_FIXTURES[0].validRaw;
    expect(
      normalizeRejectedRecommendationSummary(raw, [
        { path: "supportingMatchRefs", message: "unknown match reference" },
      ]),
    ).toMatchObject({ applied: false, previousSummary: null });
  });
});
