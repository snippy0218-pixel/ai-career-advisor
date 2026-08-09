import { describe, expect, it } from "vitest";

import {
  aggregateDimensionStatuses,
  finalMatchCoreSchema,
  finalizeRawMatchCore,
  rawMatchCoreSchema,
  type RawMatchCore,
} from "./match-schema";
import { MATCH_CORE_FIXTURES } from "@/test/match-fixtures";

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
