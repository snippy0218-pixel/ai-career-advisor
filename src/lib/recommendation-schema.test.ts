import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildRecommendationDeterministicConstraints,
  computeAllowedRecommendationLevels,
  finalizeRawRecommendation,
  finalRecommendationSchema,
  inspectRecommendationStatusClaimIntegrity,
  rawRecommendationSchema,
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

describe("ISSUE-031 status phrase attribution regression matrix", () => {
  const replacementMatchCore = buildRecommendationMatchCore([
    {
      requirement: "熟练掌握 Python",
      requirementType: "core_requirement",
      status: "partial",
      dimensionType: "proficiency",
    },
    {
      requirement: "具有正式数据产品工作经验",
      requirementType: "hard_requirement",
      status: "unmet",
      dimensionType: "employment_type",
    },
    {
      requirement: "主导跨团队项目并承担交付责任",
      requirementType: "core_requirement",
      status: "partial",
      dimensionType: "responsibility",
    },
    {
      requirement: "本科及以上",
      requirementType: "hard_requirement",
      status: "met",
      dimensionType: "qualification",
    },
  ]);
  const exactReplacementRaw = {
    recommendationLevel: "cautious" as const,
    summary:
      "Match Core 正向证据包括学历要求已满足（MI-004）及跨团队项目中承担部分交付责任（MI-003 部分维度）；反证为正式数据产品工作经验未满足（MI-002）；待确认项为 Python 熟练度（MI-001）及跨团队项目主导角色（MI-003）。",
    supportingMatchRefs: ["MI-001", "MI-003", "MI-004"],
    counterMatchRefs: ["MI-002"],
    limitations: [
      {
        content: "正式数据产品工作经验要求未满足，属于硬性门槛。",
        matchItemRefs: ["MI-002"],
      },
      {
        content: "Python 熟练度证据不足，需确认实际应用水平。",
        matchItemRefs: ["MI-001"],
      },
      {
        content: "跨团队项目主导角色未知，需确认具体职责。",
        matchItemRefs: ["MI-003"],
      },
    ],
    questionsToConfirm: [
      {
        question: "请描述你在实际项目中使用 Python 的具体场景和熟练程度。",
        matchItemRefs: ["MI-001"],
      },
      {
        question: "请描述你在团队项目中是否担任主导角色，以及如何协调跨团队合作。",
        matchItemRefs: ["MI-003"],
      },
      {
        question: "请具体说明你在项目中个人负责的交付物及其结果。",
        matchItemRefs: ["MI-003"],
      },
      {
        question: "请确认正式数据产品工作经验是否为严格筛选门槛，以及具体口径。",
        matchItemRefs: ["MI-002"],
      },
    ],
  };

  it("R1 accepts the original replacement multi-MI meaning", () => {
    expect(
      finalizeRawRecommendation(exactReplacementRaw, replacementMatchCore).issues,
    ).toEqual([]);
  });

  it("R2 accepts clearly local met and partial wording in one sentence", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "本科及以上", requirementType: "hard_requirement", status: "met" },
      { requirement: "熟练使用 Python", requirementType: "core_requirement", status: "partial" },
    ]);
    const raw = {
      recommendationLevel: "try" as const,
      summary: "MI-001 已满足，MI-002 仅有部分支持。",
      supportingMatchRefs: ["MI-001", "MI-002"],
      counterMatchRefs: [],
      limitations: [{ content: "MI-002 仅为部分匹配。", matchItemRefs: ["MI-002"] }],
      questionsToConfirm: [{ question: "请补充 MI-002 的应用程度？", matchItemRefs: ["MI-002"] }],
    };
    expect(finalizeRawRecommendation(raw, matchCore).issues).toEqual([]);
  });

  it("R3 accepts clearly local met and unknown wording in one sentence", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "本科及以上", requirementType: "hard_requirement", status: "met" },
      { requirement: "持有资格证", requirementType: "core_requirement", status: "unknown" },
    ]);
    const raw = {
      recommendationLevel: "try" as const,
      summary: "MI-001 已满足，MI-002 待确认。",
      supportingMatchRefs: ["MI-001"],
      counterMatchRefs: [],
      limitations: [{ content: "MI-002 当前未知。", matchItemRefs: ["MI-002"] }],
      questionsToConfirm: [{ question: "请确认 MI-002 的资格信息？", matchItemRefs: ["MI-002"] }],
    };
    expect(finalizeRawRecommendation(raw, matchCore).issues).toEqual([]);
  });

  it("R4 rejects a true explicit contradiction for a partial MI", () => {
    const fixture = RECOMMENDATION_FIXTURES[3];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "MI-001 已完全满足。" },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("MI-001 text contradicts"))).toBe(true);
  });

  it("R5 rejects an explicit unmet claim for a met MI", () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "MI-001 未满足。" },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("MI-001 text contradicts"))).toBe(true);
  });

  it("R6 binds a status phrase through exact requirement wording", () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const valid = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "本科及以上已满足。" },
      fixture.matchCore,
    );
    expect(valid.issues).toEqual([]);
    const invalid = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "本科及以上未满足。" },
      fixture.matchCore,
    );
    expect(invalid.issues.some((issue) => issue.message.includes("MI-001 text contradicts"))).toBe(true);
  });

  it("R7 fail-closes an ambiguous grouped multi-MI status phrase", () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const result = finalizeRawRecommendation(
      {
        ...fixture.validRaw,
        summary: "MI-001 与 MI-002 的状态综合来看，整体已满足。",
      },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("ambiguous status phrase attribution"))).toBe(true);
  });

  it("R8 preserves existing single-MI contradiction validation", () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const result = finalizeRawRecommendation(
      { ...fixture.validRaw, summary: "MI-001 已经满足。" },
      fixture.matchCore,
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("MI-001 text contradicts"))).toBe(true);
  });

  it("R9 keeps a legal initial eligible without validator-induced repair", () => {
    const result = finalizeRawRecommendation(exactReplacementRaw, replacementMatchCore);
    expect(result.data).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  it("R10 accepts the exact rejected replacement raw summary", () => {
    const result = finalizeRawRecommendation(
      { ...exactReplacementRaw },
      replacementMatchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.summary).toBe(exactReplacementRaw.summary);
  });
});

describe("ISSUE-031 exact runtime MI/status attribution", () => {
  const runtimeMatchCore = buildRecommendationMatchCore([
    {
      requirement: "熟练掌握 Python",
      requirementType: "core_requirement",
      status: "partial",
      dimensionType: "proficiency",
    },
    {
      requirement: "具有独立负责数据产品的正式工作经验",
      requirementType: "core_requirement",
      status: "unmet",
      dimensionType: "employment_type",
    },
    {
      requirement: "能主导跨团队项目并对个人交付结果负责",
      requirementType: "core_requirement",
      status: "partial",
      dimensionType: "responsibility",
    },
    {
      requirement: "本科及以上学历",
      requirementType: "hard_requirement",
      status: "met",
      dimensionType: "qualification",
    },
  ]);
  const exactSummary =
    "Match Core 正向证据包括 MI-004（学历要求已满足）以及 MI-001、MI-003 的部分匹配；反证为 MI-002（正式数据产品工作经验未满足）。待确认项集中在 MI-001 与 MI-003 的掌握深度和主导程度。";
  const exactRaw = {
    recommendationLevel: "cautious" as const,
    summary: exactSummary,
    supportingMatchRefs: ["MI-001", "MI-003", "MI-004"],
    counterMatchRefs: ["MI-002"],
    limitations: [
      {
        content:
          "MI-002 硬性要求未满足：候选人明确表示没有正式数据产品工作经历，该要求为正式工作经验，需确认是否为严格筛选门槛。",
        matchItemRefs: ["MI-002"],
      },
    ],
    questionsToConfirm: [
      {
        question:
          "请描述您使用 Python 完成的具体项目或任务，以及您对 Python 高级特性的熟悉程度。",
        matchItemRefs: ["MI-001"],
      },
      {
        question:
          "请描述您在团队项目中承担的具体职责，以及您如何协调跨团队合作。",
        matchItemRefs: ["MI-003"],
      },
      {
        question: "请举例说明您在项目中如何对个人交付结果负责。",
        matchItemRefs: ["MI-003"],
      },
      {
        question:
          "该正式数据产品工作经验是否为严格筛选门槛？请确认具体口径。",
        matchItemRefs: ["MI-002"],
      },
    ],
  };
  const statusRaw = (summary: string) => ({
    recommendationLevel: "try" as const,
    summary,
    supportingMatchRefs: [],
    counterMatchRefs: [],
    limitations: [],
    questionsToConfirm: [],
  });

  it("E28-R2 emits a stable structured R-C identity for a real contradiction", () => {
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001 已满足。"),
      buildRecommendationMatchCore([
        { requirement: "A", requirementType: "core_requirement", status: "partial" },
      ]),
    );
    expect(issues).toEqual([
      expect.objectContaining({
        validationLayer: "semantic_validation",
        validationCode: "R-C_STATUS_CONTRADICTION",
        rule: "R-C",
        path: "summary",
        message: "MI-001 text contradicts Match Core status",
      }),
    ]);
  });

  it("R31-1 accepts the exact current failure with four correct attribution groups", () => {
    expect(
      inspectRecommendationStatusClaimIntegrity(exactRaw, runtimeMatchCore),
    ).toEqual([]);
  });

  it("R31-2 accepts reordered locally attributed groups", () => {
    const summary =
      "MI-001、MI-003 的部分匹配，MI-002（正式工作经验未满足），MI-004（学历要求已满足）。";
    expect(
      inspectRecommendationStatusClaimIntegrity(statusRaw(summary), runtimeMatchCore),
    ).toEqual([]);
  });

  it("R31-3 binds one shared partial phrase to multiple partial MIs", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "partial" },
      { requirement: "B", requirementType: "core_requirement", status: "partial" },
    ]);
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001、MI-002 的部分匹配。"),
        matchCore,
      ),
    ).toEqual([]);
  });

  it("R31-4 accepts mixed met and partial groups in one sentence", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "met" },
      { requirement: "B", requirementType: "core_requirement", status: "partial" },
    ]);
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001（已满足），MI-002 的部分匹配。"),
        matchCore,
      ),
    ).toEqual([]);
  });

  it("R31-5 accepts mixed met and unknown groups", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "met" },
      { requirement: "B", requirementType: "core_requirement", status: "unknown" },
    ]);
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001（已满足），MI-002（信息待确认）。"),
        matchCore,
      ),
    ).toEqual([]);
  });

  it("R31-6 accepts mixed unmet and partial groups", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "unmet" },
      { requirement: "B", requirementType: "core_requirement", status: "partial" },
    ]);
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001（未满足），MI-002 的部分匹配。"),
        matchCore,
      ),
    ).toEqual([]);
  });

  it("R31-7 rejects a true met contradiction", () => {
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001 已满足。"),
      buildRecommendationMatchCore([
        { requirement: "A", requirementType: "core_requirement", status: "partial" },
      ]),
    );
    expect(issues).toEqual([
      expect.objectContaining({
        validationCode: "R-C_STATUS_CONTRADICTION",
        rule: "R-C",
        matchItemRefs: ["MI-001"],
      }),
    ]);
  });

  it("R31-8 rejects a true unmet contradiction", () => {
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001 未满足。"),
      buildRecommendationMatchCore([
        { requirement: "A", requirementType: "core_requirement", status: "met" },
      ]),
    );
    expect(issues[0]).toMatchObject({
      validationCode: "R-C_STATUS_CONTRADICTION",
      matchItemRefs: ["MI-001"],
    });
  });

  it("R31-9 rejects every contradicted member of an explicit MI group", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "partial" },
      { requirement: "B", requirementType: "core_requirement", status: "partial" },
    ]);
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001、MI-002 均已满足。"),
      matchCore,
    );
    expect(issues.map((issue) => issue.matchItemRefs?.[0])).toEqual([
      "MI-001",
      "MI-002",
    ]);
  });

  it("R31-10 keeps parenthetical status ownership on the preceding MI", () => {
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-004（学历要求已满足），MI-001 待确认。"),
        runtimeMatchCore,
      ),
    ).toEqual([]);
  });

  it("R31-11 binds a nearby partial phrase to its explicit MI group", () => {
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001、MI-003 的部分匹配。"),
        runtimeMatchCore,
      ),
    ).toEqual([]);
  });

  it("R31-12 does not propagate status across a semicolon boundary", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "met" },
      { requirement: "B", requirementType: "core_requirement", status: "unmet" },
    ]);
    expect(
      inspectRecommendationStatusClaimIntegrity(
        statusRaw("MI-001 已满足；MI-002 未满足。"),
        matchCore,
      ),
    ).toEqual([]);
  });

  it("R31-13 fail-closes a genuinely ambiguous phrase without fabricating an MI ref", () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "A", requirementType: "core_requirement", status: "met" },
      { requirement: "B", requirementType: "core_requirement", status: "met" },
    ]);
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001 与 MI-002 的状态综合来看，整体已满足。"),
      matchCore,
    );
    expect(issues).toEqual([
      expect.objectContaining({
        validationCode: "R-C_AMBIGUOUS_STATUS_ATTRIBUTION",
        rule: "R-C",
      }),
    ]);
    expect(issues[0].matchItemRefs).toBeUndefined();
  });

  it("R31-14 preserves the existing single-MI contradiction guard", () => {
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("MI-001 已经满足。"),
      buildRecommendationMatchCore([
        { requirement: "A", requirementType: "core_requirement", status: "unknown" },
      ]),
    );
    expect(issues[0]).toMatchObject({
      validationCode: "R-C_STATUS_CONTRADICTION",
      message: "MI-001 text contradicts Match Core status",
    });
  });

  it("R31-15 accepts the exact valid initial through the full Recommendation validator", () => {
    const result = finalizeRawRecommendation(exactRaw, runtimeMatchCore);
    expect(result.issues).toEqual([]);
    expect(result.data?.summary).toBe(exactSummary);
  });

  it("R31-16 accepts the byte-equivalent repair output through the same validator", () => {
    const result = finalizeRawRecommendation(
      JSON.parse(JSON.stringify(exactRaw)),
      runtimeMatchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.summary).toBe(exactSummary);
  });

  it("R31-17 binds a status phrase to an explicit multi-MI suffix group", () => {
    const result = inspectRecommendationStatusClaimIntegrity(
      statusRaw("Python 技能与跨团队项目经验为部分匹配（MI-001、MI-003）。"),
      runtimeMatchCore,
    );
    expect(result).toEqual([]);
  });

  it("R31-18 checks every member of an explicit multi-MI suffix group", () => {
    const issues = inspectRecommendationStatusClaimIntegrity(
      statusRaw("两项能力均已满足（MI-001、MI-003）。"),
      runtimeMatchCore,
    );
    expect(issues.map((issue) => issue.matchItemRefs?.[0])).toEqual([
      "MI-001",
      "MI-003",
    ]);
  });
});

describe("ISSUE-031 autonomous batch exact Recommendation replay", () => {
  const artifact = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/acceptance-artifacts/phase-2-4/phase-2-4-autonomous-issue-037-rb-05-batch-run-1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    results: Array<{
      failureContext: { matchCore: Parameters<typeof finalizeRawRecommendation>[1] };
      stages: Array<{
        stage: string;
        acceptanceDiagnostics?: {
          outputEvidence?: Array<{ stage: string; rawText?: string }>;
        } | null;
      }>;
    }>;
  };
  const result = artifact.results[0];
  const recommendationEvidence = result.stages.find(
    (stage) => stage.stage === "recommendation",
  )?.acceptanceDiagnostics?.outputEvidence;

  it.each(["initial", "repair"] as const)(
    "R31-19 accepts the exact batch run-1 %s Recommendation output",
    (stageName) => {
      const rawText = recommendationEvidence?.find((entry) => entry.stage === stageName)?.rawText;
      if (!rawText) throw new Error(`missing ${stageName} Recommendation raw evidence`);
      const raw = rawRecommendationSchema.parse(JSON.parse(rawText));
      const finalized = finalizeRawRecommendation(raw, result.failureContext.matchCore);
      expect(finalized.issues).toEqual([]);
      expect(finalized.data?.recommendationLevel).toBe("cautious");
    },
  );
});

describe("ISSUE-031 autonomous batch-2 described-prefix attribution", () => {
  const artifact = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/acceptance-artifacts/phase-2-4/phase-2-4-autonomous-baseline-2-rb-05-batch-run-2.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    results: Array<{
      failureContext: { matchCore: Parameters<typeof finalizeRawRecommendation>[1] };
      stages: Array<{
        stage: string;
        acceptanceDiagnostics?: {
          outputEvidence?: Array<{ stage: string; rawText?: string }>;
        } | null;
      }>;
    }>;
  };
  const result = artifact.results[0];
  const evidence = result.stages.find((stage) => stage.stage === "recommendation")
    ?.acceptanceDiagnostics?.outputEvidence;

  it.each(["initial", "repair"] as const)(
    "R31-20 accepts the exact batch-2 %s described-prefix status ownership",
    (stageName) => {
      const rawText = evidence?.find((entry) => entry.stage === stageName)?.rawText;
      if (!rawText) throw new Error(`missing ${stageName} Recommendation raw evidence`);
      const finalized = finalizeRawRecommendation(
        rawRecommendationSchema.parse(JSON.parse(rawText)),
        result.failureContext.matchCore,
      );
      expect(finalized.issues).toEqual([]);
    },
  );

  it("R31-21 checks all described-prefix group members for contradiction", () => {
    const rawText = evidence?.find((entry) => entry.stage === "initial")?.rawText;
    if (!rawText) throw new Error("missing initial Recommendation raw evidence");
    const raw = rawRecommendationSchema.parse(JSON.parse(rawText));
    const contradictory = {
      ...raw,
      summary: "MI-001（Python 基础）与 MI-003（跨团队项目参与）均已满足。",
    };
    const issues = inspectRecommendationStatusClaimIntegrity(
      contradictory,
      result.failureContext.matchCore,
    );
    expect(issues.map((issue) => issue.matchItemRefs?.[0])).toEqual([
      "MI-001",
      "MI-003",
    ]);
  });
});
