import { describe, expect, it } from "vitest";

import { normalizeRejectedRecommendationSummary } from "./recommendation-normalization";
import { finalizeRawRecommendation } from "./recommendation-schema";
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

  it("adds only the canonical strictness question for an R-K terminal failure", () => {
    const fixture = RECOMMENDATION_FIXTURES[1];
    const raw = {
      recommendationLevel: "cautious" as const,
      summary: "MI-001 为 unmet，硬性要求未满足。",
      supportingMatchRefs: [],
      counterMatchRefs: ["MI-001"],
      limitations: [
        {
          content: "MI-001 硬性学历要求未满足。",
          matchItemRefs: ["MI-001"],
        },
      ],
      questionsToConfirm: [
        {
          question: "MI-001 的具体学历情况如何？",
          matchItemRefs: ["MI-001"],
        },
      ],
    };
    const result = normalizeRejectedRecommendationSummary(raw, [
      {
        path: "questionsToConfirm",
        message:
          "R-K MI-001 cautious hard unmet without waiver evidence requires strictness confirmation, not waiver inference",
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.previousSummary).toBeNull();
    expect(result.data.summary).toBe(raw.summary);
    expect(result.data.questionsToConfirm.at(-1)).toEqual({
      question: "请向招聘方确认 MI-001 是否属于严格筛选门槛？",
      matchItemRefs: ["MI-001"],
    });
    expect(finalizeRawRecommendation(result.data, fixture.matchCore).issues).toEqual([]);
  });

  it("removes an unsupported substitution example from an otherwise valid strictness question", () => {
    const fixture = RECOMMENDATION_FIXTURES[1];
    const raw = structuredClone(fixture.validRaw);
    raw.questionsToConfirm = [
      {
        question:
          "请确认 MI-001 的学历要求是否为严格筛选门槛，以及具体口径（如是否接受其他学历形式）。",
        matchItemRefs: ["MI-001"],
      },
    ];
    const result = normalizeRejectedRecommendationSummary(raw, [
      {
        path: "questionsToConfirm.0.question",
        message:
          "R-K unsupported substitution claim has no explicit JD alternative qualification",
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.data.questionsToConfirm).toEqual([
      {
        question: "请向招聘方确认 MI-001 是否属于严格筛选门槛？",
        matchItemRefs: ["MI-001"],
      },
    ]);
    expect(finalizeRawRecommendation(result.data, fixture.matchCore).issues).toEqual([]);
  });

  it("removes only an aggregate-unmet ref rejected from supportingMatchRefs", () => {
    const raw = structuredClone(RECOMMENDATION_FIXTURES[0].validRaw);
    raw.supportingMatchRefs = ["MI-001", "MI-003"];
    const result = normalizeRejectedRecommendationSummary(raw, [
      {
        path: "supportingMatchRefs",
        message: "MI-001 has no positive Match Core evidence",
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.data.supportingMatchRefs).toEqual(["MI-003"]);
    expect(result.data.counterMatchRefs).toEqual(raw.counterMatchRefs);
    expect(result.data.summary).toBe(raw.summary);
  });
});
