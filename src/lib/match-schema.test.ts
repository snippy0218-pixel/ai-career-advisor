import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  aggregateDimensionStatuses,
  finalMatchCoreSchema,
  finalizeRawMatchCore,
  rawMatchCoreSchema,
  type RawMatchCore,
} from "./match-schema";
import { buildMatchFixture, MATCH_CORE_FIXTURES } from "@/test/match-fixtures";

function dimension(
  overrides: Partial<RawMatchCore["matchItems"][number]["dimensions"][number]> = {},
): RawMatchCore["matchItems"][number]["dimensions"][number] {
  return {
    dimensionType: "skill",
    requirementFragment: "测试维度",
    status: "unknown",
    reason: "候选人资料没有提供该维度的充分正证或明确反证。",
    jdEvidence: ["熟练使用 SQL"],
    candidateEvidence: [],
    missingInformation: "SQL 实际使用与熟练程度",
    verificationQuestion: "你是否使用过 SQL，具体在什么场景和熟练程度如何？",
    ...overrides,
  };
}

function finalize(index: number, raw: RawMatchCore) {
  const fixture = MATCH_CORE_FIXTURES[index];
  return finalizeRawMatchCore(
    rawMatchCoreSchema.parse(raw),
    fixture.request.jobAnalysis,
    fixture.request.candidateProfile,
  );
}

describe("match-core schema and status contract", () => {
  it("implements the frozen aggregate truth table", () => {
    expect(aggregateDimensionStatuses(["met", "met"])).toBe("met");
    expect(aggregateDimensionStatuses(["met", "unknown"])).toBe("partial");
    expect(aggregateDimensionStatuses(["partial", "unknown"])).toBe("partial");
    expect(aggregateDimensionStatuses(["unknown", "unknown"])).toBe("unknown");
    expect(aggregateDimensionStatuses(["met", "unmet", "unknown"])).toBe("unmet");
  });

  it("MC-TC-01 accepts explicit bachelor support as met", () => {
    const result = finalize(0, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            dimension({
              dimensionType: "qualification",
              requirementFragment: "本科及以上",
              status: "met",
              reason: "候选人明确提供本科学历，与要求一致。",
              jdEvidence: ["本科及以上"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    });
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].status).toBe("met");
    expect(result.data?.matchItems[0].requirementDimensions[0].pfEvidence).toEqual([
      "PF-001",
    ]);
  });

  it("MC-TC-02 requires explicit junior-college counter-evidence for unmet", () => {
    const result = finalize(1, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            dimension({
              dimensionType: "qualification",
              requirementFragment: "本科及以上",
              status: "unmet",
              reason: "候选人明确提供大专学历，与本科及以上门槛相冲突。",
              jdEvidence: ["本科及以上"],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).toBe("unmet");
    expect(result.data?.matchItems[0].requirementDimensions[0].candidateEvidenceRole).toBe(
      "counter",
    );
  });

  it("MC-TC-03 keeps absent SQL evidence unknown", () => {
    const result = finalize(2, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [dimension()],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).toBe("unknown");
    expect(result.data?.matchItems[0].requirementDimensions[0].candidateFactRefs).toEqual([]);
  });

  it("MC-TC-04 treats explicit lower Python proficiency as partial", () => {
    const result = finalize(3, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "partial",
          dimensions: [
            dimension({
              dimensionType: "proficiency",
              requirementFragment: "熟练使用 Python",
              status: "partial",
              reason: "候选人仅明确了解 Python 基础语法，程度低于熟练。",
              jdEvidence: ["熟练使用 Python"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: "达到熟练程度的实际使用深度",
              verificationQuestion: "你使用 Python 完成过哪些任务，熟练程度如何？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).toBe("partial");
  });

  it("MC-TC-05 preserves product-domain positive and duration unknown", () => {
    const result = finalize(4, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "partial",
          dimensions: [
            dimension({
              dimensionType: "domain",
              requirementFragment: "产品相关经验",
              status: "met",
              reason: "校园产品项目明确涉及需求调研和原型设计。",
              jdEvidence: ["2年以上产品相关经验"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
            dimension({
              dimensionType: "duration",
              requirementFragment: "2年以上",
              status: "unknown",
              reason: "项目事实未提供可核验的持续时间。",
              jdEvidence: ["2年以上产品相关经验"],
              candidateEvidence: [],
              missingInformation: "产品相关经历的累计时长",
              verificationQuestion: "你的产品相关经历累计持续多久？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).toBe("partial");
    expect(result.data?.matchItems[0].requirementDimensions.map((item) => item.status)).toEqual([
      "met",
      "unknown",
    ]);
  });

  it("MC-TC-06 does not turn a course project into full-time counter-evidence", () => {
    const result = finalize(5, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              dimensionType: "employment_type",
              requirementFragment: "全职产品经理工作经验",
              status: "unknown",
              reason: "课程项目不能证明或否定全职产品经理工作经历。",
              jdEvidence: ["2年以上全职产品经理工作经验"],
              missingInformation: "是否具有全职产品经理工作经历",
              verificationQuestion: "你是否有全职产品经理工作经历？",
            }),
            dimension({
              dimensionType: "duration",
              requirementFragment: "2年以上",
              status: "unknown",
              reason: "候选人资料没有提供全职工作年限。",
              jdEvidence: ["2年以上全职产品经理工作经验"],
              missingInformation: "全职产品经理工作的累计时长",
              verificationQuestion: "你的全职产品经理工作累计多久？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).not.toBe("unmet");
  });

  it("MC-TC-07 allows explicit no-work fact to support unmet", () => {
    const result = finalize(6, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            dimension({
              dimensionType: "employment_type",
              requirementFragment: "全职产品经理工作经验",
              status: "unmet",
              reason: "候选人明确表示没有正式工作经历。",
              jdEvidence: ["2年以上全职产品经理工作经验"],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
            dimension({
              dimensionType: "duration",
              requirementFragment: "2年以上",
              status: "unknown",
              reason: "没有独立的全职年限信息。",
              jdEvidence: ["2年以上全职产品经理工作经验"],
              missingInformation: "全职产品经理工作年限",
              verificationQuestion: "是否存在未写入资料的正式全职经历？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].status).toBe("unmet");
  });

  it("MC-TC-08 lets one scoped multi-tag CF support skill and project requirements", () => {
    const request = MATCH_CORE_FIXTURES[7].request;
    const raw: RawMatchCore = {
      matchItems: ["使用 Python 处理数据", "具有数据处理项目经验"].map(
        (fragment, index) => ({
          requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
          aggregateStatus: "met" as const,
          dimensions: [
            dimension({
              dimensionType: index === 0 ? "skill" : "domain",
              requirementFragment: fragment,
              status: "met",
              reason: "同一课程作业事实明确支持该限定范围内的要求。",
              jdEvidence: [fragment],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        }),
      ),
    };
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.data?.matchItems.map((item) => item.status)).toEqual(["met", "met"]);
    expect(
      result.data?.matchItems.every(
        (item) => item.requirementDimensions[0].candidateFactRefs[0] === "CF-001",
      ),
    ).toBe(true);
  });

  it("MC-TC-09 keeps preferred unknown as an unknown preferred item", () => {
    const result = finalize(8, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              requirementFragment: "SQL 项目经验",
              jdEvidence: ["有 SQL 项目经验者优先"],
              missingInformation: "SQL 项目经验",
              verificationQuestion: "你是否有 SQL 项目经验？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0]).toMatchObject({
      requirementType: "preferred_requirement",
      status: "unknown",
    });
  });

  it("MC-TC-10 never permits instruction PF text to become candidate evidence", () => {
    const result = finalize(9, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              dimensionType: "skill",
              requirementFragment: "熟悉数据分析",
              jdEvidence: ["熟悉数据分析"],
              missingInformation: "数据分析能力与使用经历",
              verificationQuestion: "你是否有数据分析实践经历？",
            }),
          ],
        },
      ],
    });
    expect(result.data?.matchItems[0].requirementDimensions[0].pfEvidence).toEqual([]);
  });

  it("rejects invented JD evidence, missing candidate support, and wrong aggregate", () => {
    const result = finalize(0, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              dimensionType: "qualification",
              requirementFragment: "本科及以上",
              status: "met",
              jdEvidence: ["硕士优先"],
              candidateEvidence: [],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    });
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message).join(" ")).toMatch(
      /aggregateStatus|JD evidence|positive candidate evidence/,
    );
  });

  it("rejects a duration requirement that was not decomposed", () => {
    const result = finalize(4, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              dimensionType: "other",
              requirementFragment: "2年以上产品相关经验",
              jdEvidence: ["2年以上产品相关经验"],
              missingInformation: "完整要求的满足情况",
              verificationQuestion: "请补充产品经验与年限信息。",
            }),
          ],
        },
      ],
    });
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message).join(" ")).toMatch(
      /duration dimension|separate duration/,
    );
  });

  it("rejects unknown that silently omits explicit same-domain project evidence", () => {
    const result = finalize(4, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              dimensionType: "duration",
              requirementFragment: "2年以上",
              jdEvidence: ["2年以上产品相关经验"],
              missingInformation: "产品相关经历的累计时长",
              verificationQuestion: "你的产品相关经历累计多久？",
            }),
            dimension({
              dimensionType: "domain",
              requirementFragment: "产品相关经验",
              jdEvidence: ["2年以上产品相关经验"],
              missingInformation: "产品相关经历",
              verificationQuestion: "请补充产品相关经历。",
            }),
          ],
        },
      ],
    });
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message).join(" ")).toContain(
      "unknown omitted explicit same-domain positive evidence: CF-001",
    );
  });

  it("rejects unmet without counter-evidence and unknown with contradiction", () => {
    const unmet = finalize(1, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            dimension({
              status: "unmet",
              jdEvidence: ["本科及以上"],
              candidateEvidence: [],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    });
    expect(unmet.data).toBeNull();

    const unknown = finalize(1, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            dimension({
              status: "unknown",
              jdEvidence: ["本科及以上"],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
            }),
          ],
        },
      ],
    });
    expect(unknown.data).toBeNull();
  });

  it("does not mutate the validated candidate profile and Final stays scope-strict", () => {
    const fixture = MATCH_CORE_FIXTURES[0];
    const before = JSON.stringify(fixture.request.candidateProfile);
    const result = finalize(0, {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            dimension({
              dimensionType: "qualification",
              requirementFragment: "本科及以上",
              status: "met",
              jdEvidence: ["本科及以上"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    });
    expect(JSON.stringify(fixture.request.candidateProfile)).toBe(before);
    expect(
      finalMatchCoreSchema.safeParse({ ...result.data, recommendation: "priority" }).success,
    ).toBe(false);
  });
});

describe("M-J Requirement Set Integrity", () => {
  const request = buildMatchFixture(
    [
      { content: "本科及以上", requirementType: "hard_requirement" },
      { content: "熟练使用 SQL", requirementType: "core_requirement" },
      {
        content: "有 Figma 经验者优先",
        requirementType: "preferred_requirement",
      },
      {
        content: "英语能力要求范围不明确",
        requirementType: "unclear",
        verificationQuestion: "岗位具体要求何种英语能力？",
      },
    ],
    [{ statement: "学历：本科", semanticTags: ["education"] }],
  );

  function unknownItem(
    index: number,
  ): RawMatchCore["matchItems"][number] {
    const requirement = request.jobAnalysis.roleProfile.requirements[index];
    return {
      requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
      aggregateStatus: "unknown",
      dimensions: [
        dimension({
          dimensionType: "other",
          requirementFragment: requirement.content,
          jdEvidence: [...requirement.evidence],
          missingInformation: `缺少 ${requirement.content} 的候选人证据`,
          verificationQuestion: `请确认：${requirement.content}？`,
        }),
      ],
    };
  }

  function finalizeRequirementSet(matchItems: RawMatchCore["matchItems"]) {
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse({ matchItems }),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  it("MJ-TC-01 represents all four eligible requirements exactly once", () => {
    const result = finalizeRequirementSet([0, 1, 2, 3].map(unknownItem));
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems.map((item) => item.requirementId)).toEqual([
      "REQ-001",
      "REQ-002",
      "REQ-003",
      "REQ-004",
    ]);
  });

  it("M-K rejects an unsupported frequency modifier in a Match observation", () => {
    const item = unknownItem(0);
    item.dimensions[0].reason = "候选人资料显示可频繁处理该要求。";
    const result = finalizeRequirementSet([item, unknownItem(1), unknownItem(2), unknownItem(3)]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("M-K unsupported modifier upgrade") }),
      ]),
    );
  });

  it("MJ-TC-02 rejects a missing requirement", () => {
    const result = finalizeRequirementSet([0, 1, 2].map(unknownItem));
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message)).toContain(
      "matchItems must cover every validated JD requirement exactly once",
    );
  });

  it("MJ-TC-03 rejects a duplicate requirement reference", () => {
    const duplicated = [0, 1, 2, 0].map(unknownItem);
    const result = finalizeRequirementSet(duplicated);
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message)).toContain(
      "matchItems must cover every validated JD requirement exactly once",
    );
  });

  it("MJ-TC-04 rejects a fabricated requirement reference", () => {
    const fabricated = unknownItem(3);
    fabricated.requirementId = "REQ-999";
    const result = finalizeRequirementSet([
      unknownItem(0),
      unknownItem(1),
      unknownItem(2),
      fabricated,
    ]);
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.message)).toContain(
      "unknown requirement reference",
    );
  });

  it("MJ-TC-05 rejects model-emitted type mutation and preserves Phase 1 type", () => {
    const mutated = {
      ...unknownItem(2),
      requirementType: "hard_requirement",
    };
    expect(
      rawMatchCoreSchema.safeParse({
        matchItems: [unknownItem(0), unknownItem(1), mutated, unknownItem(3)],
      }).success,
    ).toBe(false);

    const result = finalizeRequirementSet([0, 1, 2, 3].map(unknownItem));
    expect(result.data?.matchItems[2].requirementType).toBe(
      "preferred_requirement",
    );
  });

  it("MJ-TC-06 keeps one compound requirement as one top-level match item", () => {
    const compound = MATCH_CORE_FIXTURES[4].request;
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "partial",
          dimensions: [
            dimension({
              dimensionType: "domain",
              requirementFragment: "产品相关经验",
              status: "met",
              jdEvidence: ["2年以上产品相关经验"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
            dimension({
              dimensionType: "duration",
              requirementFragment: "2年以上",
              jdEvidence: ["2年以上产品相关经验"],
              missingInformation: "产品相关经历的累计时长",
              verificationQuestion: "你的产品相关经历累计多久？",
            }),
          ],
        },
      ],
    };
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      compound.jobAnalysis,
      compound.candidateProfile,
    );
    expect(result.data?.matchItems).toHaveLength(1);
    expect(result.data?.matchItems[0].requirementDimensions).toHaveLength(2);
  });
});

describe("ISSUE-029 cross-CF qualifier ownership", () => {
  function crossFactResult(
    facts: Array<{ statement: string; semanticTags: ["project_experience"] }>,
    reason: string,
  ) {
    const request = buildMatchFixture(
      [{ content: "完成相关项目", requirementType: "core_requirement" }],
      facts,
    );
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            dimension({
              dimensionType: "domain",
              requirementFragment: "完成相关项目",
              status: "met",
              reason,
              jdEvidence: ["完成相关项目"],
              candidateEvidence: [{ factId: "CF-002", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    };
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  const expectIsolationFailure = (
    result: ReturnType<typeof crossFactResult>,
    signal: string,
  ) => {
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringMatching(
            new RegExp(`M-K cross-CF modifier isolation failed: .*${signal}`),
          ),
        }),
      ]),
    );
  };

  it("Case A rejects course scope propagated to an independent project CF", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "在课程中学习 X", semanticTags: ["project_experience"] },
          { statement: "完成 Y 项目", semanticTags: ["project_experience"] },
        ],
        "候选人在课程项目中完成 Y。",
      ),
      "课程",
    );
  });

  it("Case B rejects work scope propagated to a personal project CF", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "在工作中使用 X", semanticTags: ["project_experience"] },
          { statement: "个人完成 Y 项目", semanticTags: ["project_experience"] },
        ],
        "候选人个人完成的 Y 是工作项目。",
      ),
      "工作",
    );
  });

  it("Case C rejects internship scope propagated to a course project CF", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "在实习中负责 X", semanticTags: ["project_experience"] },
          { statement: "课程中完成 Y", semanticTags: ["project_experience"] },
        ],
        "候选人在实习工作中完成 Y。",
      ),
      "实习",
    );
  });

  it("Case D rejects duration propagated to another skill or project CF", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "有 2 年 X 经验", semanticTags: ["project_experience"] },
          { statement: "使用过 Y", semanticTags: ["project_experience"] },
        ],
        "候选人有 2 年 Y 经验。",
      ),
      "2 年",
    );
  });

  it("Case E rejects frequency or intensity propagated to another CF", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "频繁拜访客户", semanticTags: ["project_experience"] },
          { statement: "参与客户沟通", semanticTags: ["project_experience"] },
        ],
        "候选人频繁进行客户沟通。",
      ),
      "频繁",
    );
  });

  it("Case F rejects quantity propagated to project B", () => {
    expectIsolationFailure(
      crossFactResult(
        [
          { statement: "负责 5 个项目", semanticTags: ["project_experience"] },
          { statement: "参与项目 B", semanticTags: ["project_experience"] },
        ],
        "候选人负责 5 个项目 B。",
      ),
      "5 个",
    );
  });

  it("positive control preserves a qualifier supported by the same canonical CF", () => {
    const request = buildMatchFixture(
      [{ content: "使用 Python 完成数据分析", requirementType: "core_requirement" }],
      [
        {
          statement: "在课程项目中使用 Python 完成数据分析",
          semanticTags: ["project_experience", "skill_usage"],
        },
      ],
    );
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            dimension({
              dimensionType: "skill",
              requirementFragment: "使用 Python 完成数据分析",
              status: "met",
              reason: "候选人在课程项目中使用 Python 完成数据分析。",
              jdEvidence: ["使用 Python 完成数据分析"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    };
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].requirementDimensions[0].reason).toContain(
      "课程项目",
    );
  });
});

describe("ISSUE-029 M-CANDIDATE-LINEAGE regression matrix", () => {
  const request = buildMatchFixture(
    [
      {
        content: "主导跨团队项目并承担交付责任",
        requirementType: "core_requirement",
      },
    ],
    [
      { statement: "学历：本科", semanticTags: ["education"] },
      {
        statement: "课程项目：在课程中了解 Python 基础语法",
        semanticTags: ["project_experience", "skill_usage"],
      },
      {
        statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
        semanticTags: ["project_experience"],
      },
      {
        statement: "没有正式数据产品工作经历",
        semanticTags: ["experience"],
      },
    ],
  );

  function lineageResult(
    reason: string,
    candidateEvidence: RawMatchCore["matchItems"][number]["dimensions"][number]["candidateEvidence"],
    status: "met" | "partial" | "unmet" | "unknown" = "partial",
  ) {
    const unresolved = status === "partial" || status === "unknown";
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: status,
          dimensions: [
            dimension({
              dimensionType: "responsibility",
              requirementFragment: "主导跨团队项目并承担交付责任",
              status,
              reason,
              jdEvidence: ["主导跨团队项目并承担交付责任"],
              candidateEvidence,
              missingInformation: unresolved ? "是否主导以及个人交付责任" : null,
              verificationQuestion: unresolved
                ? "请说明是否主导项目及个人负责的交付物？"
                : null,
            }),
          ],
        },
      ],
    };
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  const expectLineageFailure = (result: ReturnType<typeof lineageResult>) => {
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("M-CANDIDATE-LINEAGE"),
        }),
      ]),
    );
  };

  it("M1 rejects a positive Candidate claim with no refs", () => {
    expectLineageFailure(
      lineageResult(
        "候选人参与团队项目并协助整理需求和测试，但未体现主导角色。",
        [],
        "unknown",
      ),
    );
  });

  it("M2 accepts a no-ref unknown evidence boundary", () => {
    const result = lineageResult(
      "现有资料未表明候选人是否主导过跨团队项目。",
      [],
      "unknown",
    );
    expect(result.issues).toEqual([]);
  });

  it("M3 accepts positive claims supported by CF-003", () => {
    const result = lineageResult(
      "候选人与四人团队共同完成数据展示作业，并协助整理需求和测试，但未表明主导该项目。",
      [{ factId: "CF-003", role: "positive" }],
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].requirementDimensions[0].candidateFactRefs).toEqual([
      "CF-003",
    ]);
  });

  it("M4 rejects a foreign course qualifier attached to CF-003", () => {
    const result = lineageResult(
      "候选人与四人团队共同完成课程项目，并协助整理需求和测试。",
      [{ factId: "CF-003", role: "positive" }],
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("cross-CF"))).toBe(true);
  });

  it("M5 rejects a wrong CF ref for the team and testing claim", () => {
    expectLineageFailure(
      lineageResult(
        "候选人与四人团队共同完成数据展示作业，并协助整理需求和测试。",
        [{ factId: "CF-002", role: "positive" }],
      ),
    );
  });

  it("M6 rejects multiple refs when only CF-002 owns course scope", () => {
    const result = lineageResult(
      "候选人在课程中与四人团队共同完成数据展示作业，并协助整理需求和测试。",
      [
        { factId: "CF-002", role: "positive" },
        { factId: "CF-003", role: "positive" },
      ],
    );
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("cross-CF"))).toBe(true);
  });

  it("M7 rejects explicit employment negative evidence in a responsibility dimension", () => {
    expectLineageFailure(
      lineageResult(
        "候选人明确表示没有正式数据产品工作经历。",
        [{ factId: "CF-004", role: "counter" }],
        "unmet",
      ),
    );
  });

  it("M8 does not treat a JD-only statement as a Candidate assertion", () => {
    const result = lineageResult(
      "JD 要求候选人主导跨团队项目并承担交付责任。",
      [],
      "unknown",
    );
    expect(result.issues).toEqual([]);
  });

  it("M9 accepts course scope owned by the same CF", () => {
    const scopedRequest = buildMatchFixture(
      [{ content: "使用 Python 完成数据处理", requirementType: "core_requirement" }],
      [
        {
          statement: "在课程项目中使用 Python 完成数据处理",
          semanticTags: ["project_experience", "skill_usage"],
        },
      ],
    );
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            dimension({
              dimensionType: "skill",
              requirementFragment: "使用 Python 完成数据处理",
              status: "met",
              reason: "候选人在课程项目中使用 Python 完成数据处理。",
              jdEvidence: ["使用 Python 完成数据处理"],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            }),
          ],
        },
      ],
    };
    expect(
      finalizeRawMatchCore(
        rawMatchCoreSchema.parse(raw),
        scopedRequest.jobAnalysis,
        scopedRequest.candidateProfile,
      ).issues,
    ).toEqual([]);
  });

  it("M10 rejects the exact replacement MI-003 reason", () => {
    expectLineageFailure(
      lineageResult(
        "候选人参与团队项目并协助整理需求和测试，但未体现主导角色，且项目为课程作业，非正式工作。",
        [],
        "unknown",
      ),
    );
  });
});

describe("ISSUE-033 unsupported negative-claim stability", () => {
  type FixtureFacts = Parameters<typeof buildMatchFixture>[1];

  function resultFor({
    requirement = "主导跨团队项目并对个人交付结果负责",
    facts = [
      {
        statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
        semanticTags: ["experience"],
      },
    ],
    status,
    reason,
    refs,
    dimensionType = "responsibility",
  }: {
    requirement?: string;
    facts?: FixtureFacts;
    status: "met" | "partial" | "unmet" | "unknown";
    reason: string;
    refs: Array<{ factId: string; role: "positive" | "counter" }>;
    dimensionType?: RawMatchCore["matchItems"][number]["dimensions"][number]["dimensionType"];
  }) {
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      facts,
    );
    const unresolved = status === "partial" || status === "unknown";
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: status,
          dimensions: [
            dimension({
              dimensionType,
              requirementFragment: requirement,
              status,
              reason,
              jdEvidence: [requirement],
              candidateEvidence: refs,
              missingInformation: unresolved ? "相关能力或经历仍需确认" : null,
              verificationQuestion: unresolved ? "请补充相关能力或经历？" : null,
            }),
          ],
        },
      ],
    };
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  const expectLineageReject = (result: ReturnType<typeof resultFor>) => {
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("M-CANDIDATE-LINEAGE"),
        }),
      ]),
    );
  };

  it("G33-1 rejects an unsupported assertion that the candidate was not the lead", () => {
    expectLineageReject(
      resultFor({
        status: "partial",
        reason: "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但并非主导角色。",
        refs: [{ factId: "CF-001", role: "positive" }],
      }),
    );
  });

  it("G33-2 accepts an uncertainty boundary when leadership is not evidenced", () => {
    const result = resultFor({
      status: "partial",
      reason:
        "候选人与四人团队共同完成数据展示作业并协助整理需求和测试；现有资料未表明候选人担任过主导角色。",
      refs: [{ factId: "CF-001", role: "positive" }],
    });
    expect(result.issues).toEqual([]);
  });

  it("G33-3 rejects an unsupported claim that the candidate cannot independently own work", () => {
    expectLineageReject(
      resultFor({
        requirement: "具有独立负责数据产品的经验",
        status: "unknown",
        reason: "候选人无法满足独立负责的要求。",
        refs: [],
      }),
    );
  });

  it("G33-4 accepts an uncertainty boundary for independent ownership", () => {
    const result = resultFor({
      requirement: "具有独立负责数据产品的经验",
      status: "unknown",
      reason: "现有资料未表明候选人具有独立负责经验。",
      refs: [],
    });
    expect(result.issues).toEqual([]);
  });

  it("G33-5 preserves an explicit negative fact as valid unmet evidence", () => {
    const result = resultFor({
      requirement: "具有正式数据产品工作经验",
      facts: [
        {
          statement: "没有正式数据产品工作经历",
          semanticTags: ["experience"],
        },
      ],
      status: "unmet",
      reason: "候选人没有正式数据产品工作经历，与正式工作经验要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
      dimensionType: "employment_type",
    });
    expect(result.issues).toEqual([]);
  });

  it("G33-6 rejects explicit negative wording for an unknown requirement", () => {
    for (const reason of [
      "候选人不具备主导经验。",
      "候选人无法满足主导要求。",
      "候选人不是主导角色。",
      "候选人并非主导角色。",
      "候选人没有主导经验。",
    ]) {
      expectLineageReject(resultFor({ status: "unknown", reason, refs: [] }));
    }
  });

  it("G33-7 accepts partial evidence with an insufficiency boundary", () => {
    const result = resultFor({
      status: "partial",
      reason:
        "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但尚不足以证明其担任过主导角色。",
      refs: [{ factId: "CF-001", role: "positive" }],
    });
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].status).toBe("partial");
  });

  it("G33-8 rejects both exact unsupported claims from the current repair", () => {
    expectLineageReject(
      resultFor({
        requirement: "具有独立负责数据产品的经验",
        status: "unknown",
        reason: "候选人无法满足独立负责的要求。",
        refs: [],
      }),
    );
    expectLineageReject(
      resultFor({
        status: "partial",
        reason: "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，并非主导角色。",
        refs: [{ factId: "CF-001", role: "positive" }],
      }),
    );
  });

  const employmentNegative = {
    statement: "没有正式数据产品工作经历",
    semanticTags: ["experience"],
  } satisfies FixtureFacts[number];

  it("G33-11 rejects employment counter-evidence used for a responsibility conflict", () => {
    expectLineageReject(
      resultFor({
        requirement: "具有独立负责数据产品的正式工作经验",
        facts: [employmentNegative],
        status: "unmet",
        reason: "候选人没有正式数据产品工作经历，与独立负责要求直接冲突。",
        refs: [{ factId: "CF-001", role: "counter" }],
      }),
    );
  });

  it("G33-12 rejects a direct inability claim inferred from employment absence", () => {
    expectLineageReject(
      resultFor({
        requirement: "独立负责数据产品",
        facts: [employmentNegative],
        status: "unmet",
        reason: "候选人没有正式数据产品工作经历，无法独立负责数据产品。",
        refs: [{ factId: "CF-001", role: "counter" }],
      }),
    );
  });

  it("G33-13 rejects a leadership negative inferred from employment absence", () => {
    expectLineageReject(
      resultFor({
        requirement: "主导数据产品项目",
        facts: [employmentNegative],
        status: "unmet",
        reason: "候选人没有正式数据产品工作经历，并非主导角色。",
        refs: [{ factId: "CF-001", role: "counter" }],
        dimensionType: "role",
      }),
    );
  });

  it("G33-14 accepts a responsibility uncertainty boundary", () => {
    const result = resultFor({
      requirement: "独立负责数据产品",
      facts: [employmentNegative],
      status: "unknown",
      reason: "现有资料未表明候选人具有独立负责数据产品的经验。",
      refs: [],
    });
    expect(result.issues).toEqual([]);
  });

  it("G33-15 accepts employment counter-evidence only in employment_type", () => {
    const result = resultFor({
      requirement: "具有正式数据产品工作经验",
      facts: [employmentNegative],
      status: "unmet",
      reason: "候选人没有正式数据产品工作经历，正式工作经验要求未满足。",
      refs: [{ factId: "CF-001", role: "counter" }],
      dimensionType: "employment_type",
    });
    expect(result.issues).toEqual([]);
  });

  it("G33-16 rejects education counter-evidence in a responsibility dimension", () => {
    expectLineageReject(
      resultFor({
        requirement: "独立负责数据产品",
        facts: [
          {
            statement: "未取得本科学历",
            semanticTags: ["education"],
          },
        ],
        status: "unmet",
        reason: "候选人未取得本科学历，与独立负责要求直接冲突。",
        refs: [{ factId: "CF-001", role: "counter" }],
      }),
    );
  });

  it("G33-17 prevents one negative fact from making another fact negative", () => {
    expectLineageReject(
      resultFor({
        facts: [
          employmentNegative,
          {
            statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
            semanticTags: ["experience"],
          },
        ],
        status: "unmet",
        reason: "候选人没有正式数据产品工作经历，因此在团队作业中并非主导角色。",
        refs: [
          { factId: "CF-001", role: "counter" },
          { factId: "CF-002", role: "counter" },
        ],
      }),
    );
  });

  it("G33-18 rejects the exact current repair sentence", () => {
    expectLineageReject(
      resultFor({
        requirement: "具有独立负责数据产品的正式工作经验",
        facts: [employmentNegative],
        status: "unmet",
        reason: "候选人明确表示没有正式数据产品工作经历，与独立负责要求直接冲突。",
        refs: [{ factId: "CF-001", role: "counter" }],
      }),
    );
  });
});

describe("ISSUE-034 supported CF-to-JD relational conclusions", () => {
  type FixtureFacts = Parameters<typeof buildMatchFixture>[1];

  function relationResult({
    requirement = "具有正式数据产品工作经验",
    requirementFragment = requirement,
    facts,
    status = "unmet",
    reason,
    refs,
    dimensionType = "employment_type",
  }: {
    requirement?: string;
    requirementFragment?: string;
    facts: FixtureFacts;
    status?: "partial" | "unmet" | "unknown";
    reason: string;
    refs: Array<{ factId: string; role: "positive" | "counter" }>;
    dimensionType?: RawMatchCore["matchItems"][number]["dimensions"][number]["dimensionType"];
  }) {
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      facts,
    );
    const unresolved = status !== "unmet";
    const raw: RawMatchCore = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: status,
          dimensions: [
            dimension({
              dimensionType,
              requirementFragment,
              status,
              reason,
              jdEvidence: [requirement],
              candidateEvidence: refs,
              missingInformation: unresolved ? "正式工作经验仍需确认" : null,
              verificationQuestion: unresolved ? "是否具有正式工作经验？" : null,
            }),
          ],
        },
      ],
    };
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(raw),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  const negativeFact = {
    statement: "没有正式数据产品工作经历",
    semanticTags: ["experience"],
  } satisfies Parameters<typeof buildMatchFixture>[1][number];
  const neutralProject = {
    statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
    semanticTags: ["experience"],
  } satisfies Parameters<typeof buildMatchFixture>[1][number];

  it("L34-1 accepts a same-dimension explicit-negative requirement mismatch", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与正式工作经验要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.issues).toEqual([]);
  });

  it("L34-2 rejects mismatch wording without an explicit negative fact", () => {
    const result = relationResult({
      facts: [neutralProject],
      reason: "候选人参与过数据展示项目，与正式工作经验要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("M-CANDIDATE-LINEAGE"))).toBe(
      true,
    );
  });

  it("L34-3 rejects projecting candidate-level absence onto another project", () => {
    const result = relationResult({
      facts: [neutralProject, negativeFact],
      reason: "候选人的数据展示项目不是正式工作。",
      refs: [{ factId: "CF-002", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-4 rejects an explicit negative fact from an unrelated dimension", () => {
    const unrelatedSkill = relationResult({
      requirement: "熟练掌握 Python",
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与 Python 熟练度要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(unrelatedSkill.data).toBeNull();

    const responsibilitySubdimension = relationResult({
      requirement: "具有独立负责数据产品的正式工作经验",
      requirementFragment: "独立负责",
      dimensionType: "responsibility",
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与独立负责要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(responsibilitySubdimension.data).toBeNull();
  });

  it("L34-5 rejects mismatch wording when status is unknown", () => {
    const result = relationResult({
      facts: [negativeFact],
      status: "unknown",
      reason: "现有资料不符合正式工作经验要求。",
      refs: [],
    });
    expect(result.data).toBeNull();
  });

  it("L34-6 rejects complete mismatch wording when status is partial", () => {
    const result = relationResult({
      facts: [neutralProject],
      status: "partial",
      reason: "候选人参与过数据展示项目，但不符合正式工作经验要求。",
      refs: [{ factId: "CF-001", role: "positive" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-7 accepts an equivalent bounded requirement-level mismatch", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，没有满足该正式经验要求。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.issues).toEqual([]);
  });

  it("L34-8 rejects using one negative fact to qualify another referenced fact", () => {
    const result = relationResult({
      facts: [neutralProject, negativeFact],
      reason: "候选人的数据展示项目不是正式工作。",
      refs: [
        { factId: "CF-001", role: "counter" },
        { factId: "CF-002", role: "counter" },
      ],
    });
    expect(result.data).toBeNull();
  });

  it("L34-9 accepts the exact currently rejected phrase with full lineage", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人明确表示没有正式数据产品工作经历，与正式工作经验要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.issues).toEqual([]);
  });

  it("L34-10 keeps the original ISSUE-029 course contamination rejected", () => {
    const result = relationResult({
      facts: [neutralProject, negativeFact],
      reason: "候选人的团队数据展示作业属于课程项目，与正式工作经验要求不符。",
      refs: [{ factId: "CF-002", role: "counter" }],
    });
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("M-K"))).toBe(true);
  });

  it("L34-11 accepts an explicit formal-work conflict in employment_type", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与正式工作经验要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.issues).toEqual([]);
  });

  it("L34-12 rejects a broad domain relation in employment_type", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与数据产品领域要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-13 rejects an employment negative in responsibility", () => {
    const result = relationResult({
      requirement: "具有独立负责数据产品的正式工作经验",
      requirementFragment: "独立负责",
      dimensionType: "responsibility",
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与独立负责要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-14 rejects an employment negative in a leadership role dimension", () => {
    const result = relationResult({
      requirement: "主导数据产品项目",
      requirementFragment: "主导项目",
      dimensionType: "role",
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与主导项目要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-15 permits only the employment sibling of a compound requirement", () => {
    const request = buildMatchFixture(
      [
        {
          content: "具有独立负责数据产品的正式工作经验",
          requirementType: "core_requirement",
        },
      ],
      [negativeFact],
    );
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse({
        matchItems: [
          {
            requirementId: "REQ-001",
            aggregateStatus: "unmet",
            dimensions: [
              dimension({
                dimensionType: "employment_type",
                requirementFragment: "正式工作经验",
                status: "unmet",
                reason: "候选人没有正式数据产品工作经历，与正式工作经验要求直接冲突。",
                jdEvidence: ["具有独立负责数据产品的正式工作经验"],
                candidateEvidence: [{ factId: "CF-001", role: "counter" }],
                missingInformation: null,
                verificationQuestion: null,
              }),
              dimension({
                dimensionType: "responsibility",
                requirementFragment: "独立负责",
                status: "unmet",
                reason: "候选人没有正式数据产品工作经历，与独立负责要求直接冲突。",
                jdEvidence: ["具有独立负责数据产品的正式工作经验"],
                candidateEvidence: [{ factId: "CF-001", role: "counter" }],
                missingInformation: null,
                verificationQuestion: null,
              }),
            ],
          },
        ],
      }),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "matchItems.0.dimensions.1.reason",
          message: expect.stringContaining("M-CANDIDATE-LINEAGE"),
        }),
      ]),
    );
    expect(result.issues.some((issue) => issue.path === "matchItems.0.dimensions.0.reason")).toBe(
      false,
    );
  });

  it("L34-16 requires an employment-defining qualifier in the relation target", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与数据产品要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-17 accepts the relation but rejects a specific-project projection", () => {
    const relation = relationResult({
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与正式工作经验要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(relation.issues).toEqual([]);

    const projection = relationResult({
      facts: [neutralProject, negativeFact],
      reason: "候选人的数据展示项目不是正式工作。",
      refs: [{ factId: "CF-002", role: "counter" }],
    });
    expect(projection.data).toBeNull();
  });

  it("L34-18 prevents relation evidence from bleeding across sibling dimensions", () => {
    const domain = relationResult({
      requirement: "具有独立负责数据产品的正式工作经验",
      requirementFragment: "数据产品领域",
      dimensionType: "domain",
      facts: [negativeFact],
      reason: "候选人没有正式数据产品工作经历，与数据产品领域要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(domain.data).toBeNull();
  });

  it("L34-19 rejects the exact escaped domain phrase", () => {
    const result = relationResult({
      requirement: "具有独立负责数据产品的正式工作经验",
      requirementFragment: "数据产品",
      dimensionType: "domain",
      facts: [negativeFact],
      reason: "候选人明确表示没有正式数据产品工作经历，与数据产品领域要求直接冲突。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.data).toBeNull();
  });

  it("L34-20 keeps the original valid exact phrase accepted", () => {
    const result = relationResult({
      facts: [negativeFact],
      reason: "候选人明确表示没有正式数据产品工作经历，与正式工作经验要求不符。",
      refs: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.issues).toEqual([]);
  });
});

describe("ISSUE-035 evidence polarity in same-domain positive checks", () => {
  type FixtureFacts = Parameters<typeof buildMatchFixture>[1];

  function domainUnknownResult(facts: FixtureFacts) {
    const requirement = "具有数据产品相关经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      facts,
    );
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse({
        matchItems: [
          {
            requirementId: "REQ-001",
            aggregateStatus: "unknown",
            dimensions: [
              dimension({
                dimensionType: "domain",
                requirementFragment: "数据产品",
                status: "unknown",
                reason: "现有资料未表明候选人具有数据产品相关经验。",
                jdEvidence: [requirement],
                candidateEvidence: [],
                missingInformation: "候选人是否具有数据产品相关经验",
                verificationQuestion: "请描述是否具有数据产品相关经验？",
              }),
            ],
          },
        ],
      }),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  const counterFact = {
    statement: "没有正式数据产品工作经历",
    semanticTags: ["experience"],
  } satisfies FixtureFacts[number];
  const positiveProjectFact = {
    statement: "有数据产品项目经验",
    semanticTags: ["project_experience"],
  } satisfies FixtureFacts[number];

  it("E35-1 allows domain unknown when the only anchored fact is counter evidence", () => {
    const result = domainUnknownResult([counterFact]);
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].status).toBe("unknown");
  });

  it("E35-2 preserves explicit counter evidence for employment_type unmet", () => {
    const requirement = "具有正式数据产品工作经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [counterFact],
    );
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse({
        matchItems: [
          {
            requirementId: "REQ-001",
            aggregateStatus: "unmet",
            dimensions: [
              dimension({
                dimensionType: "employment_type",
                requirementFragment: "正式工作经验",
                status: "unmet",
                reason: "候选人没有正式数据产品工作经历，与正式工作经验要求不符。",
                jdEvidence: [requirement],
                candidateEvidence: [{ factId: "CF-001", role: "counter" }],
                missingInformation: null,
                verificationQuestion: null,
              }),
            ],
          },
        ],
      }),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[0].status).toBe("unmet");
  });

  it("E35-3 still rejects unknown that omits a positive domain fact", () => {
    const result = domainUnknownResult([positiveProjectFact]);
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "unknown omitted explicit same-domain positive evidence: CF-001",
        }),
      ]),
    );
  });

  it("E35-4 counts only the positive fact when positive and counter facts coexist", () => {
    const result = domainUnknownResult([positiveProjectFact, counterFact]);
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "unknown omitted explicit same-domain positive evidence: CF-001",
        }),
      ]),
    );
    expect(result.issues.map((issue) => issue.message).join(" ")).not.toContain(
      "positive evidence: CF-001, CF-002",
    );
  });

  it("E35-5 does not confuse opposite polarities with identical semantic tags", () => {
    const result = domainUnknownResult([
      { statement: "有数据产品工作经验", semanticTags: ["experience"] },
      { statement: "没有正式数据产品工作经历", semanticTags: ["experience"] },
    ]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "unknown omitted explicit same-domain positive evidence: CF-001",
        }),
      ]),
    );
  });

  it("E35-5b rejects an explicit counter fact mislabeled as positive evidence", () => {
    const requirement = "具有数据产品相关经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [counterFact],
    );
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse({
        matchItems: [
          {
            requirementId: "REQ-001",
            aggregateStatus: "met",
            dimensions: [
              dimension({
                dimensionType: "domain",
                requirementFragment: "数据产品",
                status: "met",
                reason: "候选人具有数据产品相关经验。",
                jdEvidence: [requirement],
                candidateEvidence: [{ factId: "CF-001", role: "positive" }],
                missingInformation: null,
                verificationQuestion: null,
              }),
            ],
          },
        ],
      }),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "CF-001 counter or evidence-boundary fact cannot be positive candidate evidence",
        }),
      ]),
    );
  });

  it("E35-6 excludes 不具备 explicit-negative facts from the positive set", () => {
    const result = domainUnknownResult([
      {
        statement: "不具备正式数据产品工作经验",
        semanticTags: ["experience"],
      },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("E35-7 keeps evidence-boundary facts neutral", () => {
    const result = domainUnknownResult([
      {
        statement: "未表明有正式数据产品工作经验",
        semanticTags: ["experience"],
      },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("E35-8 preserves the ISSUE-034 employment relation", () => {
    const requirement = "具有正式数据产品工作经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [counterFact],
    );
    const result = finalizeRawMatchCore(
      rawMatchCoreSchema.parse({
        matchItems: [
          {
            requirementId: "REQ-001",
            aggregateStatus: "unmet",
            dimensions: [
              dimension({
                dimensionType: "employment_type",
                requirementFragment: "正式工作经验",
                status: "unmet",
                reason: "候选人没有正式数据产品工作经历，与正式工作经验要求直接冲突。",
                jdEvidence: [requirement],
                candidateEvidence: [{ factId: "CF-001", role: "counter" }],
                missingInformation: null,
                verificationQuestion: null,
              }),
            ],
          },
        ],
      }),
      request.jobAnalysis,
      request.candidateProfile,
    );
    expect(result.issues).toEqual([]);
  });

  it("E35-10 preserves the original positive-domain omission guard", () => {
    const result = domainUnknownResult([
      {
        statement: "参与过校园数据产品项目并负责需求调研",
        semanticTags: ["project_experience"],
      },
    ]);
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("same-domain positive"))).toBe(
      true,
    );
  });
});

describe("post-035/036 exact Match artifact replay", () => {
  interface ArtifactStage {
    stage: string;
    acceptanceDiagnostics?: {
      outputEvidence?: Array<{ stage: string; rawText?: string }>;
    } | null;
  }

  const artifact = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/acceptance-artifacts/phase-2-4/phase-2-4-post-033-034-restabilization-rb-05.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { results: Array<{ stages: ArtifactStage[] }> };
  const matchEvidence = artifact.results[0].stages.find((stage) => stage.stage === "match")
    ?.acceptanceDiagnostics?.outputEvidence;
  const request = buildMatchFixture(
    [
      { content: "熟练掌握 Python", requirementType: "core_requirement" },
      {
        content: "具有独立负责数据产品的正式工作经验",
        requirementType: "core_requirement",
      },
      {
        content: "能主导跨团队项目并对个人交付结果负责",
        requirementType: "core_requirement",
      },
      { content: "本科及以上学历", requirementType: "hard_requirement" },
    ],
    [
      { statement: "教育背景：信息管理本科", semanticTags: ["education"] },
      {
        statement: "课程项目：在课程中了解 Python 基础语法",
        semanticTags: ["project_experience", "skill_usage"],
      },
      {
        statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
        semanticTags: ["experience"],
      },
      {
        statement: "没有正式数据产品工作经历",
        semanticTags: ["experience"],
      },
    ],
  );

  function replay(stageName: "initial" | "repair") {
    const rawText = matchEvidence?.find((entry) => entry.stage === stageName)?.rawText;
    if (!rawText) throw new Error(`missing ${stageName} raw Match evidence`);
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(JSON.parse(rawText)),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  it("keeps the exact initial unsupported domain and responsibility negatives rejected", () => {
    const result = replay("initial");
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "matchItems.1.dimensions.1.reason" }),
        expect.objectContaining({ path: "matchItems.1.dimensions.2.reason" }),
      ]),
    );
    expect(result.issues.map((issue) => issue.message).join(" ")).not.toContain(
      "experience_type:工作->CF-003",
    );
  });

  it("E35-9 and M36-8 accept the exact corrected repair raw", () => {
    const result = replay("repair");
    expect(result.issues).toEqual([]);
    expect(result.data?.matchItems[1].requirementDimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionType: "employment_type",
          status: "unmet",
          candidateFactRefs: ["CF-004"],
        }),
        expect.objectContaining({
          dimensionType: "domain",
          status: "unknown",
          candidateFactRefs: [],
        }),
        expect.objectContaining({
          dimensionType: "responsibility",
          status: "unknown",
          candidateFactRefs: [],
        }),
      ]),
    );
  });
});

describe("post-033/034 exact Match artifact replay", () => {
  interface ArtifactStage {
    stage: string;
    data?: unknown;
    acceptanceDiagnostics?: {
      outputEvidence?: Array<{ stage: string; rawText?: string }>;
    } | null;
  }

  const artifact = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/acceptance-artifacts/phase-2-4/phase-2-4-post-033-034-rb-05.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { results: Array<{ stages: ArtifactStage[] }> };
  const stages = artifact.results[0].stages;
  const request = buildMatchFixture(
    [
      { content: "熟练掌握 Python", requirementType: "core_requirement" },
      {
        content: "具有独立负责数据产品的正式工作经验",
        requirementType: "core_requirement",
      },
      {
        content: "能主导跨团队项目并对个人交付结果负责",
        requirementType: "core_requirement",
      },
      { content: "本科及以上学历", requirementType: "hard_requirement" },
    ],
    [
      { statement: "教育背景：信息管理本科", semanticTags: ["education"] },
      {
        statement: "课程项目：在课程中了解 Python 基础语法",
        semanticTags: ["project_experience", "skill_usage"],
      },
      {
        statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
        semanticTags: ["experience"],
      },
      {
        statement: "没有正式数据产品工作经历",
        semanticTags: ["experience"],
      },
    ],
  );
  const matchEvidence = stages.find((stage) => stage.stage === "match")
    ?.acceptanceDiagnostics?.outputEvidence;

  function replay(stageName: "initial" | "repair") {
    const rawText = matchEvidence?.find((entry) => entry.stage === stageName)?.rawText;
    if (!rawText) throw new Error(`missing ${stageName} raw Match evidence`);
    return finalizeRawMatchCore(
      rawMatchCoreSchema.parse(JSON.parse(rawText)),
      request.jobAnalysis,
      request.candidateProfile,
    );
  }

  it("rejects the exact initial raw Match with course cross-CF evidence", () => {
    const result = replay("initial");
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("experience_type:课程->CF-004") }),
      ]),
    );
  });

  it("rejects the exact repair raw Match for responsibility and domain sibling relations", () => {
    const result = replay("repair");
    expect(result.data).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "matchItems.1.dimensions.1.reason",
          message: expect.stringContaining("与数据产品领域要求直接冲突"),
        }),
        expect.objectContaining({
          path: "matchItems.1.dimensions.2.reason",
          message: expect.stringContaining("与独立负责要求直接冲突"),
        }),
      ]),
    );
  });
});
