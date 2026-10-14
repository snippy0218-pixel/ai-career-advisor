import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import { analyzeMatchWithDeepSeek, type MatchDiagnostics } from "./match-deepseek";
import { buildMatchFixture, MATCH_CORE_FIXTURES } from "@/test/match-fixtures";

const validRaw = {
  matchItems: [
    {
      requirementId: "REQ-001",
      aggregateStatus: "met",
      dimensions: [
        {
          dimensionType: "qualification",
          requirementFragment: "本科及以上",
          status: "met",
          reason: "候选人明确提供本科学历，与要求一致。",
          jdEvidence: ["本科及以上"],
          candidateEvidence: [{ factId: "CF-001", role: "positive" }],
          missingInformation: null,
          verificationQuestion: null,
        },
      ],
    },
  ],
};

function completion(payload: unknown, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: { content: JSON.stringify(payload) },
        },
      ],
      usage: { completion_tokens: 200 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("analyzeMatchWithDeepSeek", () => {
  it("returns a validated immutable match result", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(validRaw));
    const request = MATCH_CORE_FIXTURES[0].request;
    const before = JSON.stringify(request.candidateProfile);
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("met");
    expect(result.matchItems[0].requirementDimensions[0]).toMatchObject({
      candidateFactRefs: ["CF-001"],
      pfEvidence: ["PF-001"],
    });
    expect(JSON.stringify(request.candidateProfile)).toBe(before);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: false,
      finalSchemaValidationPassed: true,
      candidateProfileImmutable: true,
      requirementCount: 1,
      dimensionCount: 1,
    });
  });

  it("performs one bounded match repair for evidence/status inconsistency", async () => {
    const invalidRaw = {
      matchItems: [
        {
          ...validRaw.matchItems[0],
          aggregateStatus: "unknown",
          dimensions: [
            {
              ...validRaw.matchItems[0].dimensions[0],
              jdEvidence: ["硕士优先"],
            },
          ],
        },
      ],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalidRaw))
      .mockResolvedValueOnce(completion(validRaw));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("met");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      repairState: "accepted",
      initialAttempt: {
        called: true,
        completionReceived: true,
        rawAvailable: true,
        validationResult: "failed",
      },
      repairAttempt: {
        called: true,
        validationResult: "passed",
      },
      upstreamAttempts: 2,
      initialValidationIssues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("JD evidence") }),
      ]),
      repairValidationIssues: [],
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: false }),
      ],
    });
    const repairBody = JSON.parse(
      String((fetchImpl.mock.calls[1][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(repairBody.messages[1].content).toContain("有界 Match Repair");
    expect(repairBody.messages[1].content).toContain("硕士优先");
  });

  it("fails closed when repair still lacks explicit candidate evidence", async () => {
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            {
              ...validRaw.matchItems[0].dimensions[0],
              status: "unmet",
              candidateEvidence: [],
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let caught: unknown;
    try {
      await analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("AI_OUTPUT_INVALID");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("captures Match-specific rule, path, item and dimension on rejection", async () => {
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            {
              ...validRaw.matchItems[0].dimensions[0],
              status: "unmet",
              reason: "候选人没有本科学历。",
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: MatchDiagnostics | null | undefined;

    await expect(
      analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });

    expect(diagnostics?.repairState).toBe("rejected");
    expect(diagnostics?.outputEvidence).toHaveLength(2);
    expect(diagnostics?.outputEvidence[0]).toMatchObject({
      stage: "initial",
      validationLayer: "semantic_validation",
      rawAvailable: true,
      parsedOutputAvailable: true,
      validationIssues: expect.arrayContaining([
        expect.objectContaining({
          validationCode: "M-CANDIDATE-LINEAGE",
          rule: "M-CANDIDATE-LINEAGE",
          path: "matchItems.0.dimensions.0.reason",
          rejectedItem: expect.objectContaining({
            itemIndex: 0,
            dimensionIndex: 0,
          }),
        }),
      ]),
    });
  });

  it("preserves partial raw when finish_reason=length fails before validation", async () => {
    const fetchImpl = vi.fn(async () => completion(validRaw, "length"));
    let diagnostics: MatchDiagnostics | null | undefined;

    await expect(
      analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });

    expect(diagnostics).toMatchObject({
      truncatedByLength: true,
      repairState: "not_attempted",
      initialAttempt: {
        completionReceived: true,
        rawAvailable: true,
        finishReason: "length",
        failureStage: "completion",
        failureCategory: "truncated",
      },
      outputEvidence: [
        expect.objectContaining({
          rawAvailable: true,
          finishReason: "length",
          failureStage: "completion",
          failureCategory: "truncated",
        }),
      ],
    });
    expect(diagnostics?.outputEvidence[0].rawText).toContain("matchItems");
  });

  it("records rawAvailable=false for an empty completion without fabricating evidence", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    let diagnostics: MatchDiagnostics | null | undefined;

    await expect(
      analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_EMPTY_RESPONSE" });

    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        completionReceived: true,
        rawAvailable: false,
        rawText: "",
        failureCategory: "empty_output",
      }),
    ]);
  });

  it("classifies provider failure with no model raw", async () => {
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    let diagnostics: MatchDiagnostics | null | undefined;
    await expect(
      analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        completionReceived: false,
        rawAvailable: false,
        failureStage: "provider_response",
        failureCategory: "provider",
      }),
    ]);
  });

  it("preserves initial rejection and truncated repair raw with terminal lifecycle", async () => {
    const invalidInitial = {
      matchItems: [
        {
          ...validRaw.matchItems[0],
          dimensions: [
            {
              ...validRaw.matchItems[0].dimensions[0],
              jdEvidence: ["not in JD"],
            },
          ],
        },
      ],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalidInitial))
      .mockResolvedValueOnce(completion(validRaw, "length"));
    let diagnostics: MatchDiagnostics | null | undefined;
    await expect(
      analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
    expect(diagnostics).toMatchObject({
      repairState: "completion_failed",
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({
          stage: "repair",
          rejected: true,
          rawAvailable: true,
          finishReason: "length",
          failureCategory: "truncated",
        }),
      ],
    });
  });

  it("keeps deepseek-v4-flash as the default runtime model", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(validRaw));
    await analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
      apiKey: "test-key",
      fetchImpl,
    });
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { model: string; temperature: number };
    expect(body).toMatchObject({ model: "deepseek-v4-flash", temperature: 0.1 });
  });

  it("repairs missing requirement coverage and revalidates the complete set", async () => {
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
    const completeRaw = {
      matchItems: request.jobAnalysis.roleProfile.requirements.map(
        (requirement, index) => ({
          requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
          aggregateStatus: "unknown",
          dimensions: [
            {
              dimensionType: "other",
              requirementFragment: requirement.content,
              status: "unknown",
              reason: "没有充分正证，也没有明确反证。",
              jdEvidence: [...requirement.evidence],
              candidateEvidence: [],
              missingInformation: `缺少 ${requirement.content} 的候选人证据`,
              verificationQuestion: `请确认：${requirement.content}？`,
            },
          ],
        }),
      ),
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        completion({ matchItems: completeRaw.matchItems.slice(0, 3) }),
      )
      .mockResolvedValueOnce(completion(completeRaw));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems).toHaveLength(4);
    expect(result.matchItems.map((item) => item.requirementId)).toEqual([
      "REQ-001",
      "REQ-002",
      "REQ-003",
      "REQ-004",
    ]);
    expect(result.matchItems[2].requirementType).toBe("preferred_requirement");
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      requirementCount: 4,
    });
  });

  it("G33-9 repairs an unsupported negative into a legal uncertainty boundary", async () => {
    const requirement = "主导跨团队项目并对个人交付结果负责";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
          semanticTags: ["experience"],
        },
      ],
    );
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "partial",
          dimensions: [
            {
              dimensionType: "responsibility",
              requirementFragment: requirement,
              status: "partial",
              reason:
                "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但并非主导角色。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: "是否担任主导角色",
              verificationQuestion: "请说明是否担任过主导角色？",
            },
          ],
        },
      ],
    };
    const repaired = {
      matchItems: [
        {
          ...invalid.matchItems[0],
          dimensions: [
            {
              ...invalid.matchItems[0].dimensions[0],
              reason:
                "候选人与四人团队共同完成数据展示作业并协助整理需求和测试；现有资料未表明候选人担任过主导角色。",
            },
          ],
        },
      ],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(repaired));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("partial");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      repairState: "accepted",
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: false }),
      ],
    });
    const initialBody = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(initialBody.messages[0].content).toContain(
      "必须区分 explicit counter-evidence 与 absence of evidence",
    );
    const repairBody = JSON.parse(
      String((fetchImpl.mock.calls[1][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(repairBody.messages[1].content).toContain(
      "M-CANDIDATE-LINEAGE / M-K 专项修复",
    );
    expect(repairBody.messages[1].content).toContain("不得换用另一种否定措辞");
    expect(repairBody.messages[1].content).toContain(
      "positive CF 不得使用此例外",
    );
    expect(repairBody.messages[1].content).not.toContain(
      "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但现有证据不足以证明其担任主导角色",
    );
  });

  it("G33-10 normalizes a repeated unsupported partial claim to unknown and revalidates", async () => {
    const requirement = "主导跨团队项目并对个人交付结果负责";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
          semanticTags: ["experience"],
        },
      ],
    );
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "partial",
          dimensions: [
            {
              dimensionType: "responsibility",
              requirementFragment: requirement,
              status: "partial",
              reason:
                "候选人与四人团队共同完成数据展示作业并协助整理需求和测试，但并非主导角色。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: "是否担任主导角色",
              verificationQuestion: "请说明是否担任过主导角色？",
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.matchItems[0].requirementDimensions[0]).toMatchObject({
      status: "unknown",
      candidateFactRefs: [],
      reason: "现有资料无法确认该维度是否满足。",
    });
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      repairState: "accepted",
      repairAttempt: { validationResult: "failed" },
      matchNormalizationAttempted: true,
      matchNormalizationSucceeded: true,
      normalizationActions: [
        expect.objectContaining({
          previousStatus: "partial",
          normalizedStatus: "unknown",
          removedCandidateFactRefs: ["CF-001"],
        }),
        expect.objectContaining({
          dimensionIndex: null,
          issueCodes: ["M-AGGREGATE"],
          previousStatus: "partial",
          normalizedStatus: "unknown",
          reasonRebuilt: false,
        }),
      ],
      normalizedRepairOutput: expect.any(Object),
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: true }),
      ],
    });
  });

  it("G33-10B removes positive CF narration from an unknown repair without adding refs", async () => {
    const requirement = "主导跨团队项目";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
          semanticTags: ["experience"],
        },
      ],
    );
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unknown",
          dimensions: [
            {
              dimensionType: "responsibility",
              requirementFragment: requirement,
              status: "unknown",
              reason:
                "现有资料未表明候选人主导过跨团队项目。CF-001 仅表明参与团队作业并协助测试，未体现主导。",
              jdEvidence: [requirement],
              candidateEvidence: [],
              missingInformation: "是否有主导经历仍需确认",
              verificationQuestion: "请说明是否有主导经历？",
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].requirementDimensions[0]).toMatchObject({
      status: "unknown",
      candidateFactRefs: [],
      reason: "现有资料无法确认该维度是否满足。",
    });
    expect(diagnostics).toMatchObject({
      matchNormalizationSucceeded: true,
      normalizedRepairOutput: expect.any(Object),
      modelMetadata: {
        model: "deepseek-v4-flash",
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });
  });

  it("G33-10C preserves legitimate ownership wording backed by the canonical fact", async () => {
    const requirement = "对个人交付结果负责";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "我独立负责个人交付结果并承担最终责任",
          semanticTags: ["experience"],
        },
      ],
    );
    const valid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "met",
          dimensions: [
            {
              dimensionType: "responsibility",
              requirementFragment: requirement,
              status: "met",
              reason: "CF-001 表明我独立负责个人交付结果并承担最终责任。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "positive" }],
              missingInformation: null,
              verificationQuestion: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(valid));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("met");
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: false,
      matchNormalizationAttempted: false,
      matchNormalizationSucceeded: false,
    });
  });

  function dimensionLocalRepairFixture() {
    const requirement = "具有独立负责数据产品的正式工作经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "没有正式数据产品工作经历",
          semanticTags: ["experience"],
        },
      ],
    );
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            {
              dimensionType: "employment_type",
              requirementFragment: "正式工作经验",
              status: "unmet",
              reason:
                "候选人没有正式数据产品工作经历，与正式工作经验要求直接冲突。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            },
            {
              dimensionType: "responsibility",
              requirementFragment: "独立负责",
              status: "unmet",
              reason:
                "候选人明确表示没有正式数据产品工作经历，与独立负责要求直接冲突。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            },
          ],
        },
      ],
    };
    const repaired = {
      matchItems: [
        {
          ...invalid.matchItems[0],
          dimensions: [
            invalid.matchItems[0].dimensions[0],
            {
              ...invalid.matchItems[0].dimensions[1],
              status: "unknown",
              reason:
                "现有资料未表明候选人具有独立负责数据产品的经验。",
              candidateEvidence: [],
              missingInformation: "候选人是否具有独立负责数据产品的经验仍需确认。",
              verificationQuestion: "请说明是否具有独立负责数据产品的经验？",
            },
          ],
        },
      ],
    };
    return { request, invalid, repaired };
  }

  it("G33-19 repairs a cross-dimension negative into a responsibility uncertainty boundary", async () => {
    const { request, invalid, repaired } = dimensionLocalRepairFixture();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(repaired));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("unmet");
    expect(result.matchItems[0].requirementDimensions[1]).toMatchObject({
      dimensionType: "responsibility",
      status: "unknown",
      candidateFactRefs: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      repairState: "accepted",
    });
    const repairBody = JSON.parse(
      String((fetchImpl.mock.calls[1][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(repairBody.messages[1].content).toContain(
      "explicit counter-evidence 只能支持它自身的 semantic dimension",
    );
    expect(repairBody.messages[1].content).toContain(
      "没有正式工作经历，因此无法独立负责",
    );
  });

  it("G33-20 remains fail-closed when repair reuses employment evidence for responsibility", async () => {
    const { request, invalid } = dimensionLocalRepairFixture();
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: MatchDiagnostics | null | undefined;

    await expect(
      analyzeMatchWithDeepSeek(request, {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: false,
      repairState: "rejected",
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: true }),
      ],
    });
  });

  it("normalizes an unsupported team-delivery unmet relation to unknown and revalidates", async () => {
    const requirement = "有独立上线项目经验";
    const request = buildMatchFixture(
      [{ content: requirement, requirementType: "core_requirement" }],
      [
        {
          statement: "项目经历：参与团队项目页面开发",
          semanticTags: ["project_experience"],
        },
      ],
    );
    const invalid = {
      matchItems: [
        {
          requirementId: "REQ-001",
          aggregateStatus: "unmet",
          dimensions: [
            {
              dimensionType: "responsibility",
              requirementFragment: "独立上线项目经验",
              status: "unmet",
              reason:
                "CF-001 表明参与团队项目页面开发，且项目由团队负责人统一上线，明确否定独立上线职责。",
              jdEvidence: [requirement],
              candidateEvidence: [{ factId: "CF-001", role: "counter" }],
              missingInformation: null,
              verificationQuestion: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: MatchDiagnostics | null | undefined;

    const result = await analyzeMatchWithDeepSeek(request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.matchItems[0]).toMatchObject({ status: "unknown" });
    expect(result.matchItems[0].requirementDimensions[0]).toMatchObject({
      status: "unknown",
      candidateFactRefs: [],
      candidateEvidenceRole: null,
    });
    expect(diagnostics).toMatchObject({
      matchNormalizationAttempted: true,
      matchNormalizationSucceeded: true,
      normalizationValidationIssues: [],
    });
  });
});

describe("Phase 2.4 batch-3 Match generation-contract recovery", () => {
  interface ArtifactStage {
    stage: string;
    acceptanceDiagnostics?: {
      outputEvidence?: Array<{ stage: "initial" | "repair"; rawText?: string }>;
    } | null;
  }

  function savedOutputs(run: 1 | 3) {
    const artifact = JSON.parse(
      readFileSync(
        new URL(
          `../../docs/acceptance-artifacts/phase-2-4-autonomous-baseline-3-rb-05-batch-model-run-${run}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { results: Array<{ stages: ArtifactStage[] }> };
    const evidence = artifact.results[0].stages.find(
      (stage) => stage.stage === "match",
    )?.acceptanceDiagnostics?.outputEvidence;
    const initial = evidence?.find((entry) => entry.stage === "initial")?.rawText;
    const repair = evidence?.find((entry) => entry.stage === "repair")?.rawText;
    if (!initial || !repair) throw new Error(`missing batch-3 run-${run} Match raw`);
    return { initial: JSON.parse(initial), repair: JSON.parse(repair) };
  }

  function request() {
    return buildMatchFixture(
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
        { statement: "没有正式数据产品工作经历", semanticTags: ["experience"] },
      ],
    );
  }

  it.each([1, 3] as const)(
    "B3-%s preserves raw/repair rejection and accepts only the revalidated normalized Match",
    async (run) => {
      const outputs = savedOutputs(run);
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(completion(outputs.initial))
        .mockResolvedValueOnce(completion(outputs.repair));
      let diagnostics: MatchDiagnostics | null | undefined;

      const result = await analyzeMatchWithDeepSeek(request(), {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(result.matchItems).toHaveLength(4);
      expect(result.matchItems[1].requirementDimensions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            dimensionType: "employment_type",
            status: "unmet",
            candidateFactRefs: ["CF-004"],
          }),
        ]),
      );
      expect(
        result.matchItems.flatMap((item) => item.requirementDimensions),
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: expect.stringMatching(/个人交付的正证|体现了一定的个人职责/),
          }),
        ]),
      );
      expect(diagnostics).toMatchObject({
        matchRepairAttempted: true,
        matchRepairSucceeded: true,
        repairAttempt: { validationResult: "failed" },
        matchNormalizationAttempted: true,
        matchNormalizationSucceeded: true,
        normalizationValidationIssues: [],
        normalizedRepairOutput: expect.any(Object),
        outputEvidence: [
          expect.objectContaining({ stage: "initial", rejected: true }),
          expect.objectContaining({ stage: "repair", rejected: true }),
        ],
      });
      expect(diagnostics?.repairValidationIssues).not.toEqual([]);
    },
  );
});
