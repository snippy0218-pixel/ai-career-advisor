import { describe, expect, it } from "vitest";

import {
  buildRecommendationDeterministicConstraints,
  computeAllowedRecommendationLevels,
  finalizeRawRecommendation,
  finalRecommendationSchema,
} from "./recommendation-schema";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";
import { buildRecommendationMatchCore } from "@/test/recommendation-fixtures";

describe("Recommendation Core deterministic contract", () => {
  it.each(RECOMMENDATION_FIXTURES)(
    "$id computes the frozen allowed level set",
    (fixture) => {
      expect(computeAllowedRecommendationLevels(fixture.matchCore)).toEqual(
        fixture.expectedAllowed,
      );
    },
  );

  it("R-L rejects unsupported modifiers in a recommendation summary", () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: `${fixture.validRaw.summary} 候选人能够频繁承担相关工作。` },
      fixture.matchCore,
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("R-L unsupported modifier upgrade") }),
      ]),
    );
  });

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

  it("R-C scopes mixed-status prose to the referenced MI clause", () => {
    const fixture = RECOMMENDATION_FIXTURES[8];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        summary: "MI-001 已满足核心要求，MI-002 信息未知，仍需确认。",
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.recommendationLevel).toBe("try");
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

  it("R-J permits an explicit verification question without treating it as fact", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        questionsToConfirm: [
          {
            question: "请确认候选人是否拥有 MI-001 所需的资格信息？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.recommendationLevel).toBe("cautious");
  });

  it("RK-TC-01 hard unknown requires Candidate information and rejects waiver inference", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const valid = finalizeRawRecommendation(fixture.validRaw, fixture.matchCore);
    expect(valid.issues).toEqual([]);

    const invalid = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        questionsToConfirm: [
          {
            question: "请向 HR 确认 MI-001 是否可以豁免？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.data).toBeNull();
    expect(
      invalid.issues.some((issue) => issue.message.includes("R-K unsupported waiver")),
    ).toBe(true);
    expect(
      invalid.issues.some((issue) =>
        issue.message.includes("Candidate-information question"),
      ),
    ).toBe(true);
  });

  it("R-K accepts natural Candidate-information verbs without accepting HR strictness as a substitute", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const natural = structuredClone(fixture.validRaw);
    natural.questionsToConfirm = [
      {
        question: "请提供您持有的行业资格证书名称及编号。",
        matchItemRefs: ["MI-001"],
      },
    ];
    expect(finalizeRawRecommendation(natural, fixture.matchCore).issues).toEqual([]);

    natural.questionsToConfirm = [
      {
        question: "请向 HR 描述并确认该门槛是否严格。",
        matchItemRefs: ["MI-001"],
      },
    ];
    expect(
      finalizeRawRecommendation(natural, fixture.matchCore).issues.some((issue) =>
        issue.message.includes("Candidate-information question"),
      ),
    ).toBe(true);
  });

  it("RK-TC-02 hard unmet without JD waiver permits strictness confirmation only", () => {
    const fixture = RECOMMENDATION_FIXTURES[1];
    const cautious = {
      recommendationLevel: "cautious" as const,
      summary: "核心职责仍可关注，但 MI-001 硬性资格存在明确反证。",
      supportingMatchRefs: [],
      counterMatchRefs: ["MI-001"],
      limitations: [
        {
          content: "MI-001 硬性学历要求当前明确未满足，投递成功率会受影响。",
          matchItemRefs: ["MI-001"],
        },
      ],
      questionsToConfirm: [
        {
          question: "请向招聘方确认 MI-001 是否属于严格筛选门槛？",
          matchItemRefs: ["MI-001"],
        },
      ],
    };
    expect(finalizeRawRecommendation(cautious, fixture.matchCore).issues).toEqual([]);

    const invalid = finalizeRawRecommendation(
      {
        ...cautious,
        questionsToConfirm: [
          {
            question: "请向 HR 确认 MI-001 是否可放宽？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.data).toBeNull();
    expect(invalid.issues.some((issue) => issue.message.includes("R-K"))).toBe(true);
  });

  it("RK-TC-03 explicit JD waiver may be cited without changing the hard unmet", () => {
    const fixture = RECOMMENDATION_FIXTURES[6];
    const result = finalizeRawRecommendation(fixture.validRaw, fixture.matchCore);
    expect(result.issues).toEqual([]);
    expect(result.data?.recommendationLevel).toBe("cautious");
    expect(fixture.matchCore.matchItems[0].status).toBe("unmet");

    const inventedMechanism = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        questionsToConfirm: [
          {
            question: "请确认 MI-001 是否接受实际经验折算学历？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(inventedMechanism.data).toBeNull();
    expect(
      inventedMechanism.issues.some((issue) =>
        issue.message.includes("unsupported substitution"),
      ),
    ).toBe(true);
  });

  it("RK-TC-04 strong Candidate evidence does not imply an unsupported waiver", () => {
    const matchCore = buildRecommendationMatchCore([
      {
        requirement: "本科及以上",
        requirementType: "hard_requirement",
        status: "unmet",
        dimensionType: "qualification",
      },
      {
        requirement: "熟练使用 SQL 并负责核心分析",
        requirementType: "core_requirement",
        status: "met",
      },
    ]);
    const result = finalizeRawRecommendation(
      {
        recommendationLevel: "cautious",
        summary: "MI-002 核心匹配较强，但能力可以弥补 MI-001 的学历缺口。",
        supportingMatchRefs: ["MI-002"],
        counterMatchRefs: ["MI-001"],
        limitations: [
          {
            content: "MI-001 硬性学历要求当前未满足。",
            matchItemRefs: ["MI-001"],
          },
        ],
        questionsToConfirm: [
          {
            question: "请向招聘方确认 MI-001 是否属于严格筛选门槛？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      matchCore,
    );
    expect(result.data).toBeNull();
    expect(
      result.issues.some((issue) =>
        issue.message.includes("unsupported substitution"),
      ),
    ).toBe(true);
  });

  it("RK-TC-05 explicit experience alternative is qualification logic, not waiver", () => {
    const matchCore = buildRecommendationMatchCore([
      {
        requirement: "本科，或三年以上同类经验",
        requirementType: "hard_requirement",
        status: "met",
        dimensionType: "qualification",
      },
    ]);
    const result = finalizeRawRecommendation(
      {
        recommendationLevel: "priority",
        summary: "MI-001 是 JD 明示的二选一替代资格，Match Core 已记录为满足。",
        supportingMatchRefs: ["MI-001"],
        counterMatchRefs: [],
        limitations: [],
        questionsToConfirm: [],
      },
      matchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.recommendationLevel).toBe("priority");

    const mislabeled = finalizeRawRecommendation(
      {
        recommendationLevel: "priority",
        summary: "MI-001 是 JD 对学历要求的豁免。",
        supportingMatchRefs: ["MI-001"],
        counterMatchRefs: [],
        limitations: [],
        questionsToConfirm: [],
      },
      matchCore,
    );
    expect(mislabeled.data).toBeNull();
    expect(
      mislabeled.issues.some((issue) => issue.message.includes("unsupported waiver")),
    ).toBe(true);
  });

  it("RK-TC-06 hard unknown remains unknown when JD contains a waiver clause", () => {
    const matchCore = buildRecommendationMatchCore([
      {
        requirement: "本科及以上，优秀者可适当放宽学历要求",
        requirementType: "hard_requirement",
        status: "unknown",
        dimensionType: "qualification",
      },
    ]);
    const result = finalizeRawRecommendation(
      {
        recommendationLevel: "cautious",
        summary: "候选资格目前仍待确认。",
        supportingMatchRefs: [],
        counterMatchRefs: [],
        limitations: [
          {
            content: "MI-001 的 Candidate 学历事实未知；JD 同时明示放宽条款，但尚不能判断是否需要或适用。",
            matchItemRefs: ["MI-001"],
          },
        ],
        questionsToConfirm: [
          {
            question: "请补充你的最高学历，以确认 MI-001 的资格事实？",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
      matchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.recommendationLevel).toBe("cautious");
    expect(matchCore.matchItems[0].status).toBe("unknown");
  });
});
