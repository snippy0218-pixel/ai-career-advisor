import { describe, expect, it } from "vitest";

import { normalizeRejectedMatchReasons } from "./match-normalization";
import { rawMatchCoreSchema, type MatchValidationIssue } from "./match-schema";

function dimension(overrides: Record<string, unknown> = {}) {
  return {
    dimensionType: "responsibility",
    requirementFragment: "对个人交付结果负责",
    status: "partial",
    reason: "CF-001 表明协助测试，体现个人职责。",
    jdEvidence: ["对个人交付结果负责"],
    candidateEvidence: [{ factId: "CF-001", role: "positive" }],
    missingInformation: "责任范围尚未明确",
    verificationQuestion: "请说明责任范围？",
    ...overrides,
  };
}

function raw(overrides: Record<string, unknown> = {}) {
  return rawMatchCoreSchema.parse({
    matchItems: [
      {
        requirementId: "REQ-001",
        aggregateStatus: "partial",
        dimensions: [dimension(overrides)],
      },
    ],
  });
}

function reasonIssue(message: string): MatchValidationIssue {
  return { path: "matchItems.0.dimensions.0.reason", message };
}

describe("Match rejected-reason normalization", () => {
  it("N1 removes positive Candidate narration from unknown without adding refs", () => {
    const input = raw({
      status: "unknown",
      reason: "CF-001 仅表明协助测试，未体现个人交付责任。",
      candidateEvidence: [],
    });
    input.matchItems[0].aggregateStatus = "unknown";
    const before = structuredClone(input);
    const result = normalizeRejectedMatchReasons(input, [
      reasonIssue(
        "M-CANDIDATE-LINEAGE explicit Candidate Fact reference missing from candidateEvidence: CF-001",
      ),
    ]);

    expect(input).toEqual(before);
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unknown",
      reason: "现有资料无法确认该维度是否满足。",
      candidateEvidence: [],
    });
    expect(result.actions[0]).toMatchObject({
      previousStatus: "unknown",
      normalizedStatus: "unknown",
      issueCodes: ["M-CANDIDATE-LINEAGE"],
    });
  });

  it.each([
    "体现个人职责",
    "可视为个人交付正证",
    "反映其承担个人结果责任",
  ])("N2 conservatively downgrades an unsupported ownership paraphrase: %s", (claim) => {
    const input = raw({ reason: `CF-001 表明协助测试，${claim}。` });
    const result = normalizeRejectedMatchReasons(input, [
      reasonIssue("M-K cross-CF modifier isolation failed: ownership:个人->CF-001"),
    ]);

    expect(result.data.matchItems[0]).toMatchObject({ aggregateStatus: "unknown" });
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unknown",
      candidateEvidence: [],
      reason: "现有资料无法确认该维度是否满足。",
    });
    expect(result.actions[0].removedCandidateFactRefs).toEqual(["CF-001"]);
  });

  it("N3 does not touch a legitimate ownership statement when validation has no issue", () => {
    const input = raw({ reason: "CF-001 表明独立负责交付结果，支持当前要求。" });
    const result = normalizeRejectedMatchReasons(input, []);
    expect(result).toEqual({ data: input, applied: false, actions: [] });
  });

  it("N3a rebuilds a single positive partial reason from exact CF text", () => {
    const input = raw({
      dimensionType: "skill",
      requirementFragment: "熟悉项目数据复盘",
      reason: "候选人在校园项目中参与复盘。",
    });
    const result = normalizeRejectedMatchReasons(
      input,
      [reasonIssue("M-K cross-CF modifier isolation failed: experience_type:校园->CF-001")],
      [
        {
          factId: "CF-001",
          statement: "参与消费者调研项目，整理问卷数据并与团队共同完成复盘报告",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["project_experience"],
        },
      ],
    );
    expect(result.data.matchItems[0]).toMatchObject({ aggregateStatus: "partial" });
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "partial",
      reason: "CF-001 原文：“参与消费者调研项目，整理问卷数据并与团队共同完成复盘报告”。",
      candidateEvidence: [{ factId: "CF-001", role: "positive" }],
    });
    expect(result.actions[0].removedCandidateFactRefs).toEqual([]);
  });

  it("N3b does not preserve a cross-domain partial from one generic bigram", () => {
    const input = raw({
      dimensionType: "domain",
      requirementFragment: "产品运营经验",
      reason: "候选人参与产品设计。",
    });
    const result = normalizeRejectedMatchReasons(
      input,
      [reasonIssue("M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion")],
      [
        {
          factId: "CF-001",
          statement: "参与校园产品设计项目",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["project_experience"],
        },
      ],
    );
    expect(result.data.matchItems[0]).toMatchObject({ aggregateStatus: "unknown" });
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unknown",
      candidateEvidence: [],
    });
  });

  it("N4 never normalizes unmet counter-evidence", () => {
    const input = raw({
      status: "unmet",
      reason: "CF-001 表明未负责交付结果。",
      candidateEvidence: [{ factId: "CF-001", role: "counter" }],
      missingInformation: null,
      verificationQuestion: null,
    });
    input.matchItems[0].aggregateStatus = "unmet";
    const result = normalizeRejectedMatchReasons(input, [
      reasonIssue("M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion"),
    ]);
    expect(result).toEqual({ data: input, applied: false, actions: [] });
  });

  it("N5 does not hide reference, status, schema, or non-reason failures", () => {
    const input = raw();
    const result = normalizeRejectedMatchReasons(input, [
      { path: "matchItems.0.dimensions.0.candidateEvidence", message: "unknown candidate fact" },
    ]);
    expect(result).toEqual({ data: input, applied: false, actions: [] });
  });

  it("N5a recalculates an aggregate-only terminal validation failure", () => {
    const input = raw({ status: "unknown", candidateEvidence: [] });
    input.matchItems[0].aggregateStatus = "partial";
    const result = normalizeRejectedMatchReasons(input, [
      { path: "matchItems.0.aggregateStatus", message: "aggregateStatus must be unknown" },
    ]);

    expect(result.data.matchItems[0].aggregateStatus).toBe("unknown");
    expect(result.data.matchItems[0].dimensions).toEqual(input.matchItems[0].dimensions);
    expect(result.actions).toEqual([
      expect.objectContaining({
        itemIndex: 0,
        dimensionIndex: null,
        issueCodes: ["M-AGGREGATE"],
        previousStatus: "partial",
        normalizedStatus: "unknown",
        reasonRebuilt: false,
      }),
    ]);
  });

  it("N6 recalculates aggregate while preserving a valid sibling dimension", () => {
    const input = raw();
    input.matchItems[0].dimensions.push(
      dimension({
        dimensionType: "skill",
        requirementFragment: "Python",
        status: "met",
        reason: "CF-002 表明使用 Python。",
        jdEvidence: ["对个人交付结果负责"],
        candidateEvidence: [{ factId: "CF-002", role: "positive" }],
        missingInformation: null,
        verificationQuestion: null,
      }),
    );
    const result = normalizeRejectedMatchReasons(input, [
      reasonIssue("M-K cross-CF modifier isolation failed: ownership:个人->CF-001"),
    ]);
    expect(result.data.matchItems[0].aggregateStatus).toBe("partial");
    expect(result.data.matchItems[0].dimensions[1]).toEqual(input.matchItems[0].dimensions[1]);
  });
});
