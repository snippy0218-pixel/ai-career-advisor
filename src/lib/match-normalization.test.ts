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

  it("N4 does not normalize an unsupported responsibility counter", () => {
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

  it("N4b preserves an exact same-dimension employment counter without the rejected generic relation", () => {
    const input = raw({
      dimensionType: "employment_type",
      requirementFragment: "正式全职数据分析经验",
      status: "unmet",
      reason: "CF-002 明确表明目前没有正式全职数据分析经验，与要求直接冲突。",
      jdEvidence: ["必须具有3年以上正式全职数据分析经验"],
      candidateEvidence: [{ factId: "CF-002", role: "counter" }],
      missingInformation: null,
      verificationQuestion: null,
    });
    input.matchItems[0].aggregateStatus = "unmet";
    const result = normalizeRejectedMatchReasons(
      input,
      [
        reasonIssue(
          "M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 与要求直接冲突",
        ),
      ],
      [
        {
          factId: "CF-002",
          statement: "目前没有正式全职数据分析经验",
          sourceType: "profile_stated",
          pfEvidence: ["PF-002"],
          semanticTags: ["experience"],
        },
      ],
    );

    expect(result.data.matchItems[0]).toMatchObject({ aggregateStatus: "unmet" });
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unmet",
      reason: "CF-002 原文：“目前没有正式全职数据分析经验”。",
      candidateEvidence: [{ factId: "CF-002", role: "counter" }],
    });
    expect(result.actions).toEqual([
      expect.objectContaining({
        previousStatus: "unmet",
        normalizedStatus: "unmet",
        removedCandidateFactRefs: [],
      }),
    ]);
  });

  it("N4a conservatively downgrades a rejected unsupported unmet relation", () => {
    const input = raw({
      status: "unmet",
      reason:
        "CF-005 表明参与团队项目页面开发，且项目由团队负责人统一上线，明确否定独立上线职责。",
      candidateEvidence: [{ factId: "CF-005", role: "counter" }],
      missingInformation: null,
      verificationQuestion: null,
    });
    input.matchItems[0].aggregateStatus = "unmet";
    const result = normalizeRejectedMatchReasons(
      input,
      [
        reasonIssue(
          "M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 且项目由团队负责人统一上线",
        ),
      ],
      [
        {
          factId: "CF-005",
          statement: "项目经历：参与团队项目页面开发",
          sourceType: "profile_stated",
          pfEvidence: ["PF-004"],
          semanticTags: ["project_experience"],
        },
      ],
    );

    expect(result.data.matchItems[0]).toMatchObject({ aggregateStatus: "unknown" });
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unknown",
      reason: "现有资料无法确认该维度是否满足。",
      candidateEvidence: [],
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          previousStatus: "unmet",
          normalizedStatus: "unknown",
          removedCandidateFactRefs: ["CF-005"],
        }),
      ]),
    );
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

  it("N7 converts an explicit numeric duration shortfall from partial to unmet", () => {
    const input = raw({
      dimensionType: "duration",
      requirementFragment: "具有3年以上前端开发经验",
      reason: "候选人明确有1年前端开发工作经验，未达到3年要求。",
      jdEvidence: ["具有3年以上前端开发经验"],
    });
    const result = normalizeRejectedMatchReasons(
      input,
      [
        {
          path: "matchItems.0.dimensions.0.status",
          message: "M-DURATION explicit numeric shortfall must be unmet",
        },
      ],
      [
        {
          factId: "CF-001",
          statement: "有1年前端开发工作经验",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["experience"],
        },
      ],
    );

    expect(result.data.matchItems[0].aggregateStatus).toBe("unmet");
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unmet",
      candidateEvidence: [{ factId: "CF-001", role: "counter" }],
      missingInformation: null,
      verificationQuestion: null,
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueCodes: ["M-DURATION"],
          previousStatus: "partial",
          normalizedStatus: "unmet",
        }),
      ]),
    );
  });

  it("N8 adds only a fact-free unknown employment dimension required by explicit formal-work text", () => {
    const input = raw({
      dimensionType: "domain",
      requirementFragment: "具有海外支付行业正式工作经验",
      status: "unknown",
      reason: "现有资料无法确认该维度是否满足。",
      jdEvidence: ["具有海外支付行业正式工作经验"],
      candidateEvidence: [],
      missingInformation: "是否具有海外支付行业正式工作经验",
      verificationQuestion: "请补充海外支付行业正式工作经验。",
    });
    input.matchItems[0].aggregateStatus = "unknown";
    const result = normalizeRejectedMatchReasons(input, [
      {
        path: "matchItems.0.dimensions",
        message:
          "explicit full-time/formal-work requirement requires an employment_type dimension",
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.data.matchItems[0].aggregateStatus).toBe("unknown");
    expect(result.data.matchItems[0].dimensions).toHaveLength(2);
    expect(result.data.matchItems[0].dimensions[1]).toMatchObject({
      dimensionType: "employment_type",
      requirementFragment: "具有海外支付行业正式工作经验",
      status: "unknown",
      reason: "现有资料无法确认该维度是否满足。",
      jdEvidence: ["具有海外支付行业正式工作经验"],
      candidateEvidence: [],
    });
  });

  it.each([
    ["M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 明确少于3年要求"],
    [
      "M-CANDIDATE-LINEAGE referenced Candidate Facts do not support assertion: 明确少于要求的3年",
      "M-K cross-CF modifier isolation failed: duration:3年->CF-001",
    ],
  ])("N9 rebuilds an already-unmet numeric shortfall reason from CF and JD values", (...messages) => {
    const input = raw({
      dimensionType: "duration",
      requirementFragment: "具有3年以上前端开发经验",
      status: "unmet",
      reason: "CF-001 明确有1年前端开发经验，明确少于3年要求。",
      jdEvidence: ["具有3年以上前端开发经验"],
      candidateEvidence: [{ factId: "CF-001", role: "counter" }],
      missingInformation: null,
      verificationQuestion: null,
    });
    input.matchItems[0].aggregateStatus = "unmet";
    const result = normalizeRejectedMatchReasons(
      input,
      messages.map((message) => reasonIssue(message)),
      [
        {
          factId: "CF-001",
          statement: "有1年前端开发工作经验",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["experience"],
        },
      ],
    );

    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "unmet",
      reason: "CF-001 原文：“有1年前端开发工作经验”，1年低于3年要求。",
      candidateEvidence: [{ factId: "CF-001", role: "counter" }],
    });
    expect(result.actions[0]).toMatchObject({
      normalizedStatus: "unmet",
      removedCandidateFactRefs: [],
    });
  });

  it("N10 restores partial from an explicit same-skill fact without upgrading proficiency", () => {
    const input = raw({
      dimensionType: "skill",
      requirementFragment: "熟练掌握 Vue3",
      status: "unknown",
      reason: "现有资料不足以确认熟练掌握 Vue3。",
      jdEvidence: ["熟练掌握 Vue3 和 TypeScript"],
      candidateEvidence: [],
      missingInformation: "未表明 Vue3 的熟练程度",
      verificationQuestion: "Vue3 的使用频率和熟练程度如何？",
    });
    input.matchItems[0].aggregateStatus = "partial";
    const result = normalizeRejectedMatchReasons(
      input,
      [
        {
          path: "matchItems.0.aggregateStatus",
          message: "aggregateStatus must be unknown",
        },
      ],
      [
        {
          factId: "CF-001",
          statement: "日常使用 Vue3",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["skill_usage"],
        },
      ],
    );

    expect(result.data.matchItems[0].aggregateStatus).toBe("partial");
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "partial",
      reason: "CF-001 原文：“日常使用 Vue3”。",
      candidateEvidence: [{ factId: "CF-001", role: "positive" }],
      missingInformation: "未表明 Vue3 的熟练程度",
    });
  });

  it("N11 reduces a rejected multi-CF met skill claim to one exact partial CF", () => {
    const input = raw({
      dimensionType: "skill",
      requirementFragment: "能使用 SQL 进行数据分析",
      status: "met",
      reason: "CF-001 和 CF-002 表明在课程中负责 SQL 数据分析。",
      jdEvidence: ["能使用 SQL 进行数据分析"],
      candidateEvidence: [
        { factId: "CF-001", role: "positive" },
        { factId: "CF-002", role: "positive" },
      ],
      missingInformation: null,
      verificationQuestion: null,
    });
    input.matchItems[0].aggregateStatus = "met";
    const result = normalizeRejectedMatchReasons(
      input,
      [reasonIssue("M-K cross-CF modifier isolation failed: experience_type:课程->CF-002")],
      [
        {
          factId: "CF-001",
          statement: "在课程项目中使用 SQL 分析公开数据",
          sourceType: "profile_stated",
          pfEvidence: ["PF-001"],
          semanticTags: ["project_experience", "skill_usage"],
        },
        {
          factId: "CF-002",
          statement: "日常使用 SQL",
          sourceType: "profile_stated",
          pfEvidence: ["PF-002"],
          semanticTags: ["skill_usage"],
        },
      ],
    );

    expect(result.data.matchItems[0].aggregateStatus).toBe("partial");
    expect(result.data.matchItems[0].dimensions[0]).toMatchObject({
      status: "partial",
      candidateEvidence: [{ factId: "CF-001", role: "positive" }],
      reason: "CF-001 原文：“在课程项目中使用 SQL 分析公开数据”。",
      missingInformation: "尚缺少可验证的“能使用 SQL 进行数据分析”同维度候选人证据。",
      verificationQuestion: "请补充可验证的“能使用 SQL 进行数据分析”相关事实或经历。",
    });
  });
});
