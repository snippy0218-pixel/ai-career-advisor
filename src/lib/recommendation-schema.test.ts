import { describe, expect, it } from "vitest";

import {
  buildRecommendationDeterministicConstraints,
  computeAllowedRecommendationLevels,
  finalizeRawRecommendation,
  finalRecommendationSchema,
} from "./recommendation-schema";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";

describe("Recommendation Core deterministic contract", () => {
  it.each(RECOMMENDATION_FIXTURES)(
    "$id computes the frozen allowed level set",
    (fixture) => {
      expect(computeAllowedRecommendationLevels(fixture.matchCore)).toEqual(
        fixture.expectedAllowed,
      );
    },
  );

  it.each(RECOMMENDATION_FIXTURES)(
    "$id finalizes a strict evidence-bound recommendation",
    (fixture) => {
      const result = finalizeRawRecommendation(
        fixture.validRaw,
        fixture.matchCore,
      );
      expect(result.issues).toEqual([]);
      expect(finalRecommendationSchema.safeParse(result.data).success).toBe(true);
      expect(result.data?.allowedRecommendationLevels).toEqual(
        fixture.expectedAllowed,
      );
    },
  );

  it("R-A rejects priority when a hard requirement is unknown", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        recommendationLevel: "priority",
        supportingMatchRefs: ["MI-001"],
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.path === "recommendationLevel")).toBe(true);
  });

  it("R-B rejects not_recommended without eligible counter evidence", () => {
    const fixture = RECOMMENDATION_FIXTURES[7];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, counterMatchRefs: [] },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("counter evidence"))).toBe(true);
  });

  it("R-C rejects a text claim that overrides an unknown Match status", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "MI-001 已经满足，可以直接通过资格审查。" },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("contradicts"))).toBe(true);
  });

  it("R-D rejects silent omission of a critical unknown", () => {
    const fixture = RECOMMENDATION_FIXTURES[5];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        limitations: [{ content: "MI-001 当前未知。", matchItemRefs: ["MI-001"] }],
        questionsToConfirm: [{ question: "请确认 MI-001？", matchItemRefs: ["MI-001"] }],
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("MI-002 critical/core unknown"))).toBe(true);
  });

  it("R-E requires hard-gap explanation and HR confirmation for cautious", () => {
    const fixture = RECOMMENDATION_FIXTURES[6];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        limitations: [{ content: "MI-001 未满足。", matchItemRefs: ["MI-001"] }],
        questionsToConfirm: [],
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("HR confirmation"))).toBe(true);
  });

  it("R-F isolates a preferred-only unmet item from downgrade", () => {
    const fixture = RECOMMENDATION_FIXTURES[4];
    expect(computeAllowedRecommendationLevels(fixture.matchCore)).toEqual([
      "priority",
      "try",
    ]);
    expect(buildRecommendationDeterministicConstraints(fixture.matchCore)).toMatchObject({
      eligibleSupportingMatchRefs: ["MI-001"],
      eligibleCounterMatchRefs: [],
      requiredUnknownMatchRefs: [],
    });
  });

  it("R-G rejects fabricated and role-ineligible references", () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        supportingMatchRefs: ["MI-999"],
        counterMatchRefs: ["MI-001"],
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("unknown match reference"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("negative basis"))).toBe(true);
  });

  it("R-J rejects an ungrounded Candidate fact in recommendation prose", () => {
    const fixture = RECOMMENDATION_FIXTURES[9];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        summary: "候选人拥有五年数据分析经验，建议尝试。",
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("Candidate facts"))).toBe(true);
  });
});
