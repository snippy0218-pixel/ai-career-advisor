import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import { analyzeJobWithDeepSeek } from "./deepseek";
import { sampleJd, validAnalysis } from "@/test/fixtures";

function successfulResponse(analysis: unknown = validAnalysis) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(analysis) },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function riskSignal(evidence: string[]) {
  return {
    content: "从职责看，可能职责范围较宽",
    explanation: "岗位同时覆盖多类运营工作，建议确认重心。",
    sourceType: "inference" as const,
    evidence,
    verificationQuestion: null,
  };
}

const distinctValidEvidence = [
  "产品运营岗位",
  "负责活动策划",
  "执行与复盘",
  "协同产品",
  "设计团队",
];

function requirementJd(requirementLine: string) {
  return `产品运营岗位，负责活动策划、执行与复盘，协同产品和设计团队推进活动上线。\n任职要求：\n${requirementLine}`;
}

function analysisWithRequirement(jdText: string, evidence: string) {
  const analysis = structuredClone(validAnalysis);
  analysis.basicInfo.summary = "从JD信息看，可能属于产品运营类岗位。";
  analysis.coreResponsibilities = [validAnalysis.coreResponsibilities[0]];
  analysis.roleProfile.requirements = [
    {
      content: evidence,
      explanation: "回归样例：编号列表中的任职要求。",
      requirementType: "core_requirement" as const,
      sourceType: "jd_explicit" as const,
      evidence: [evidence],
      verificationQuestion: null,
    },
  ];
  analysis.roleProfile.workCharacteristics = [];
  analysis.roleProfile.riskSignals = [];
  analysis.roleProfile.unknowns = [];
  analysis.roleProfile.questionsToConfirm = [];
  analysis.applicationAdvice = {
    ...validAnalysis.applicationAdvice,
    summary: "从JD信息看，岗位职责较明确，可以进一步了解。",
    sourceType: "inference" as const,
    verificationQuestion: null,
    reasons: [validAnalysis.applicationAdvice.reasons[0]],
  };
  return analysis;
}

async function classifyRequirement(requirementLine: string, evidence: string) {
  const jdText = requirementJd(requirementLine);
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(
    successfulResponse(analysisWithRequirement(jdText, evidence)),
  );

  const result = await analyzeJobWithDeepSeek(
    { jdText },
    { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
  );

  return { result, fetchMock };
}

describe("DeepSeek adapter", () => {
  it("sends a non-thinking JSON request and returns validated data", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse());

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result).toEqual(validAnalysis);
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(String(request?.body));
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("retries one rate-limit response and then succeeds", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(successfulResponse());

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
      ),
    ).resolves.toEqual(validAnalysis);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries an empty response only once", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
      ),
    ).rejects.toMatchObject({ code: "AI_EMPTY_RESPONSE" } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repairs core responsibility evidence without regenerating the analysis", async () => {
    const invalid = structuredClone(validAnalysis);
    invalid.coreResponsibilities[0].evidence = ["JD 中不存在的职责"];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(invalid))
      .mockResolvedValueOnce(
        successfulResponse({
          items: [
            {
              index: 0,
              action: "replace_evidence",
              evidence: ["负责活动策划、执行与复盘"],
            },
          ],
        }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        {
          fetchImpl: fetchMock,
          apiKey: "test-key",
          timeoutMs: 2_000,
          onDiagnostics: diagnostics,
        },
      ),
    ).resolves.toEqual(validAnalysis);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        coreTargetedRepairAttempted: true,
        coreTargetedRepairSucceeded: true,
        removedCoreResponsibilities: 0,
        finalValidationPassed: true,
      }),
    );

    const repairBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairBody.messages[1].content).toContain("<candidates>");
    expect(repairBody.messages[1].content).not.toContain("applicationAdvice");
  });

  it("rejects the result when core repair leaves fewer than the schema minimum", async () => {
    const invalid = structuredClone(validAnalysis);
    invalid.coreResponsibilities[0].evidence = ["JD 中不存在的职责"];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(invalid))
      .mockResolvedValueOnce(
        successfulResponse({
          items: [{ index: 0, action: "delete" }],
        }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        {
          fetchImpl: fetchMock,
          apiKey: "test-key",
          timeoutMs: 2_000,
          onDiagnostics: diagnostics,
        },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        coreTargetedRepairAttempted: true,
        coreTargetedRepairSucceeded: false,
        finalValidationPassed: false,
      }),
    );
  });

  it("removes a risk signal whose evidence is empty", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [riskSignal([])];
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result.roleProfile.riskSignals).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts an empty riskSignals array", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse());

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
      ),
    ).resolves.toMatchObject({ roleProfile: { riskSignals: [] } });
  });

  it("prioritizes required to_verify questions without exceeding the limit", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.questionsToConfirm = Array.from(
      { length: 8 },
      (_, index) => ({
        question: `普通确认问题${index + 1}？`,
        reason: "JD信息不足。",
      }),
    );
    analysis.roleProfile.workCharacteristics = [
      {
        content: "实际参与深度需要确认",
        explanation: "JD未说明独立负责范围。",
        sourceType: "to_verify",
        evidence: ["负责活动策划、执行与复盘"],
        verificationQuestion: null,
      },
    ];
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result.roleProfile.questionsToConfirm).toHaveLength(8);
    expect(result.roleProfile.questionsToConfirm[0].question).toContain(
      "实际参与深度需要确认",
    );
  });

  it("removes one advice reason with empty evidence and keeps valid reasons", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.applicationAdvice.reasons.push({
      content: "从职责看，可能岗位要求较清晰",
      sourceType: "inference",
      evidence: [],
      verificationQuestion: null,
    });
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result.applicationAdvice.reasons).toHaveLength(1);
    expect(result.applicationAdvice.reasons[0]).toEqual(
      validAnalysis.applicationAdvice.reasons[0],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs one targeted repair when all advice reasons have empty evidence", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.applicationAdvice.reasons[0].evidence = [];
    analysis.applicationAdvice.reasons.push({
      content: "从职责看，可能强调跨团队协作",
      sourceType: "inference",
      evidence: [],
      verificationQuestion: null,
    });
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({
          items: [
            {
              index: 0,
              action: "replace_evidence",
              evidence: ["负责活动策划、执行与复盘"],
            },
            { index: 1, action: "delete" },
          ],
        }),
      );

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.applicationAdvice.reasons).toEqual([
      {
        content: validAnalysis.applicationAdvice.reasons[0].content,
        sourceType: validAnalysis.applicationAdvice.reasons[0].sourceType,
        evidence: ["负责活动策划、执行与复盘"],
        verificationQuestion: null,
      },
    ]);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        targetedRepairAttempted: true,
        targetedRepairSucceeded: true,
        removedAdviceReasons: 1,
        finalValidationPassed: true,
      }),
    );

    const repairBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairBody.messages[1].content).toContain("<candidates>");
    expect(repairBody.messages[1].content).not.toContain("hrGreeting");
  });

  it("removes non-core evidence that does not exist in the JD", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [riskSignal(["JD 中不存在的风险描述"])];
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result.roleProfile.riskSignals).toEqual([]);
  });

  it("returns AI_OUTPUT_INVALID when the single targeted repair fails", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.applicationAdvice.reasons[0].evidence = [];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({
          items: [{ index: 0, action: "delete" }],
        }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        {
          fetchImpl: fetchMock,
          apiKey: "test-key",
          timeoutMs: 2_000,
          onDiagnostics: diagnostics,
        },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        targetedRepairAttempted: true,
        targetedRepairSucceeded: false,
        finalValidationPassed: false,
      }),
    );
  });

  it("keeps the whole analysis when invalid non-core items can be removed", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [riskSignal([])];
    analysis.applicationAdvice.reasons.push({
      content: "从职责看，可能存在缺少可验证依据的次要理由",
      sourceType: "inference",
      evidence: ["JD 中不存在的内容"],
      verificationQuestion: null,
    });
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.riskSignals).toEqual([]);
    expect(result.applicationAdvice.reasons).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        targetedRepairAttempted: false,
        removedRiskSignals: 1,
        removedAdviceReasons: 1,
        finalValidationPassed: true,
      }),
    );
  });

  it("keeps the first three of four valid risk evidence items", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      riskSignal(distinctValidEvidence.slice(0, 4)),
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.riskSignals[0].evidence).toEqual(
      distinctValidEvidence.slice(0, 3),
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceOverLimitCount: 1,
        truncatedEvidenceCount: 1,
        finalSchemaValidationPassed: true,
        finalEvidenceValidationPassed: true,
      }),
    );
  });

  it("removes invalid evidence before keeping three later valid items", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      riskSignal([
        "不存在的证据一",
        "不存在的证据二",
        ...distinctValidEvidence.slice(0, 3),
      ]),
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.riskSignals[0].evidence).toEqual(
      distinctValidEvidence.slice(0, 3),
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceOverLimitCount: 1,
        removedInvalidEvidenceCount: 2,
        truncatedEvidenceCount: 0,
      }),
    );
  });

  it("deduplicates evidence in model order before applying the limit", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      riskSignal([
        distinctValidEvidence[0],
        distinctValidEvidence[0],
        distinctValidEvidence[1],
        distinctValidEvidence[2],
        distinctValidEvidence[3],
      ]),
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.riskSignals[0].evidence).toEqual(
      distinctValidEvidence.slice(0, 3),
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        removedDuplicateEvidenceCount: 1,
        truncatedEvidenceCount: 1,
      }),
    );
  });

  it("trims only evidence edges before exact JD matching", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      riskSignal([" \t负责活动策划、执行与复盘  "]),
    ];
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    expect(result.roleProfile.riskSignals[0].evidence).toEqual([
      "负责活动策划、执行与复盘",
    ]);
  });

  it("deletes a risk signal when more than three evidence items are all invalid", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      riskSignal(["无效一", "无效二", "无效三", "无效四"]),
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.riskSignals).toEqual([]);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceOverLimitCount: 1,
        removedInvalidEvidenceCount: 4,
        truncatedEvidenceCount: 0,
        removedRiskSignals: 1,
      }),
    );
  });

  it("keeps an advice reason and limits four valid evidence items to three", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.applicationAdvice.reasons[0].evidence =
      distinctValidEvidence.slice(0, 4);
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.applicationAdvice.reasons[0].evidence).toEqual(
      distinctValidEvidence.slice(0, 3),
    );
    expect(result.applicationAdvice.reasons).toHaveLength(1);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceOverLimitCount: 1,
        truncatedEvidenceCount: 1,
        removedAdviceReasons: 0,
        finalSchemaValidationPassed: true,
        finalEvidenceValidationPassed: true,
      }),
    );
  });

  it("repairs an unsupported candidate claim without changing other fields", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.hrGreeting.safeGreeting =
      "您好，我具备优秀的文档能力，也长期使用AI工具，希望进一步了解该岗位。";
    const repairedGreeting = structuredClone(validAnalysis.hrGreeting);
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({ hrGreeting: repairedGreeting }),
      );

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(validAnalysis);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        hrBoundaryViolationCount: 1,
        hrTargetedRepairAttempted: true,
        hrTargetedRepairSucceeded: true,
        hrBoundaryValidationPassed: true,
        finalValidationPassed: true,
      }),
    );

    const repairBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairBody.messages[1].content).toContain("<invalid_hr_greeting>");
    expect(repairBody.messages[1].content).not.toContain("candidateAdvantages");
    expect(repairBody.messages[0].content).toContain("candidateProfileProvided=false");
  });

  it("uses the fixed safe fallback when the HR repair still contains a candidate claim", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.hrGreeting.safeGreeting =
      "您好，我是计算机专业应届生，也有AI项目经验，希望进一步沟通。";
    const invalidRepair = structuredClone(validAnalysis.hrGreeting);
    invalidRepair.safeGreeting =
      "您好，我熟悉AI工具并长期使用大模型，希望进一步沟通。";
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({ hrGreeting: invalidRepair }),
      );

    const result = await analyzeJobWithDeepSeek(
      { jdText: sampleJd },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.hrGreeting.safeGreeting).toBe(
      "您好，我对该岗位很感兴趣，希望进一步了解岗位的具体职责和团队情况，期待与您沟通。",
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        hrTargetedRepairAttempted: true,
        hrTargetedRepairSucceeded: true,
        hrRepairUsedSafeFallback: true,
        hrBoundaryValidationPassed: true,
        finalValidationPassed: true,
      }),
    );
  });

  it("does not return an untrusted greeting when the single HR repair is structurally invalid", async () => {
    const analysis = structuredClone(validAnalysis);
    analysis.hrGreeting.safeGreeting =
      "您好，我是计算机专业应届生，希望进一步沟通。";
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({
          hrGreeting: {
            personalizationStatus: "not_personalized",
            safeGreeting: "您好，我具备优秀文档能力。",
          },
        }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText: sampleJd },
        {
          fetchImpl: fetchMock,
          apiKey: "test-key",
          timeoutMs: 2_000,
          onDiagnostics: diagnostics,
        },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" } satisfies Partial<ApiError>);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        hrTargetedRepairAttempted: true,
        hrTargetedRepairSucceeded: false,
        hrRepairUsedSafeFallback: false,
        hrBoundaryValidationPassed: false,
        finalValidationPassed: false,
      }),
    );
  });
});

describe("ISSUE-010 list-numbered requirement boundaries", () => {
  it.each([
    ["1.本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["1. 本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["1．本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["1、本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["1、 本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["（1）本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
    ["(1) 本科及以上，电气工程、自动化、机电一体化相关专业", "本科及以上，电气工程、自动化、机电一体化相关专业"],
  ])(
    "classifies a numbered hard education requirement as hard_requirement: %s",
    async (requirementLine, evidence) => {
      const { result, fetchMock } = await classifyRequirement(
        requirementLine,
        evidence,
      );
      const requirement = result.roleProfile.requirements[0];
      expect(requirement.requirementType).toBe("hard_requirement");
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["2.3年以上电气相关工作经验", "3年以上电气相关工作经验"],
    ["2. 至少3年电气相关工作经验", "至少3年电气相关工作经验"],
  ])(
    "classifies a numbered minimum work-year requirement as hard_requirement: %s",
    async (requirementLine, evidence) => {
      const { result, fetchMock } = await classifyRequirement(
        requirementLine,
        evidence,
      );
      expect(result.roleProfile.requirements[0].requirementType).toBe(
        "hard_requirement",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps preferred_requirement for a numbered preferred requirement", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "3.有电气相关经验者优先",
      "有电气相关经验者优先",
    );
    expect(result.roleProfile.requirements[0].requirementType).toBe(
      "preferred_requirement",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still treats genuinely fused requirement text as unclear after the numbering fix", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "要求能熟练使用AutoCAD/EPLAN，独立完成电气图纸绘制",
      "能熟练使用AutoCAD/EPLAN，独立完成电气图纸绘制",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("unclear");
    expect(requirement.sourceType).toBe("to_verify");
    expect(requirement.verificationQuestion).not.toBeNull();
    expect(
      result.roleProfile.questionsToConfirm.some(
        (item) => item.question === requirement.verificationQuestion,
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ISSUE-011 minimum work-year hard qualifiers", () => {
  it.each([
    ["2.3年以上相关工作经验", "3年以上相关工作经验", "hard_requirement"],
    ["2.至少3年相关工作经验", "至少3年相关工作经验", "hard_requirement"],
    ["2.3年及以上相关工作经验", "3年及以上相关工作经验", "hard_requirement"],
    ["2.1年及以上相关经验", "1年及以上相关经验", "hard_requirement"],
  ])(
    "classifies a numbered minimum work-year requirement as hard_requirement: %s",
    async (requirementLine, evidence, expected) => {
      const { result, fetchMock } = await classifyRequirement(
        requirementLine,
        evidence,
      );
      const requirement = result.roleProfile.requirements[0];
      expect(requirement.requirementType).toBe(expected);
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps a preferred requirement hard-qualifier-free even when it mentions years", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "3.有3年相关经验者优先",
      "有3年相关经验者优先",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("preferred_requirement");
    expect(requirement.verificationQuestion).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["3年相关工作经验"],
    ["有相关工作经验"],
  ])(
    "does not treat ordinary experience wording without minimum-limit semantics as hard: %s",
    async (evidence) => {
      const { result, fetchMock } = await classifyRequirement(
        `2.${evidence}`,
        evidence,
      );
      const requirement = result.roleProfile.requirements[0];
      expect(requirement.requirementType).toBe("core_requirement");
      expect(requirement.verificationQuestion).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});

describe("ISSUE-012 requirement evidence span recovery and targeted repair", () => {
  it("recovers the original JD span for requirement evidence folded across a line break", async () => {
    const diagnostics = vi.fn();
    const jdLine = "1.本科及以上，电子信息、自\n动化等相关专业";
    const evidence = "本科及以上，电子信息、自动化等相关专业";
    const jdText = requirementJd(jdLine);
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successfulResponse(analysisWithRequirement(jdText, evidence)),
    );

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );
    const requirement = result.roleProfile.requirements[0];

    expect(requirement.requirementType).toBe("hard_requirement");
    expect(requirement.evidence).toEqual([
      "本科及以上，电子信息、自\n动化等相关专业",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveredEvidenceCount: 1,
        removedInvalidEvidenceCount: 0,
        requirementTargetedRepairAttempted: false,
        finalValidationPassed: true,
      }),
    );
  });

  it("recovers the original JD span for consecutive-space differences", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "2.本科 及以上学历",
      "本科及以上学历",
    );
    const requirement = result.roleProfile.requirements[0];

    expect(requirement.requirementType).toBe("hard_requirement");
    expect(requirement.evidence).toEqual(["本科 及以上学历"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("remaps a unique single-character JD typo back to the JD original without a targeted repair (ISSUE-012A)", async () => {
    const diagnostics = vi.fn();
    const jdLine =
      "1.本科及以上，2026.9-2027.8 期间己获得或即将获得博士/硕士学位";
    const evidence =
      "本科及以上，2026.9-2027.8 期间已获得或即将获得博士/硕士学位";
    const jdOriginalEvidence =
      "本科及以上，2026.9-2027.8 期间己获得或即将获得博士/硕士学位";
    const jdText = requirementJd(jdLine);
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      successfulResponse(analysisWithRequirement(jdText, evidence)),
    );

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );
    const requirement = result.roleProfile.requirements[0];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requirement.requirementType).toBe("hard_requirement");
    expect(requirement.evidence).toEqual([jdOriginalEvidence]);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveredEvidenceCount: 0,
        remappedEvidenceCount: 1,
        requirementTargetedRepairAttempted: false,
        finalValidationPassed: true,
      }),
    );
  });

  it("does not silently delete a hard requirement when the targeted repair returns delete", async () => {
    const jdLine = "1.本科及以上，有相关实习经验";
    const evidence = "JD 中不存在的学历要求";
    const jdText = requirementJd(jdLine);
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        successfulResponse(analysisWithRequirement(jdText, evidence)),
      )
      .mockResolvedValueOnce(
        successfulResponse({ items: [{ index: 0, action: "delete" }] }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText },
        { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps Final Schema failure when the targeted repair returns non-verbatim evidence", async () => {
    const jdLine = "1.本科及以上，有相关实习经验";
    const evidence = "JD 中不存在的学历要求";
    const jdText = requirementJd(jdLine);
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        successfulResponse(analysisWithRequirement(jdText, evidence)),
      )
      .mockResolvedValueOnce(
        successfulResponse({
          items: [
            {
              index: 0,
              action: "replace_evidence",
              evidence: ["JD 中不存在的证据"],
            },
          ],
        }),
      );

    await expect(
      analyzeJobWithDeepSeek(
        { jdText },
        { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" } satisfies Partial<ApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs requirement repair before core repair when both need evidence", async () => {
    const jdLine = "1.本科及以上\n2.能独立完成电气设计";
    const jdText = requirementJd(jdLine);
    const analysis = analysisWithRequirement(jdText, "不存在的学历要求");
    analysis.coreResponsibilities = [
      {
        title: "电气设计",
        description: "负责电气设计。",
        sourceType: "jd_explicit" as const,
        evidence: ["不存在的职责原文"],
      },
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successfulResponse(analysis))
      .mockResolvedValueOnce(
        successfulResponse({
          items: [
            {
              index: 0,
              action: "replace_evidence",
              evidence: ["本科及以上"],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        successfulResponse({
          items: [
            {
              index: 0,
              action: "replace_evidence",
              evidence: ["能独立完成电气设计"],
            },
          ],
        }),
      );

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.roleProfile.requirements[0].evidence).toEqual(["本科及以上"]);
    expect(result.roleProfile.requirements[0].requirementType).toBe(
      "hard_requirement",
    );
    expect(result.coreResponsibilities[0].evidence).toEqual([
      "能独立完成电气设计",
    ]);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementTargetedRepairAttempted: true,
        requirementTargetedRepairSucceeded: true,
        coreTargetedRepairAttempted: true,
        coreTargetedRepairSucceeded: true,
        finalValidationPassed: true,
      }),
    );
  });
});

describe("ISSUE-015 mid-sentence hard/preferred qualifier priority", () => {
  it.each([
    [
      "2.3年以上产品经验，且至少有2年负责过Agent产品经验",
      "至少有2年负责过Agent产品经验",
      "hard_requirement",
    ],
    [
      "2.具备相关经验，其中至少3年负责大型项目",
      "至少3年负责大型项目",
      "hard_requirement",
    ],
    [
      "2.要求本科及以上学历，并具备良好沟通能力",
      "本科及以上学历",
      "hard_requirement",
    ],
    [
      "2.3年以上产品经验，且至少有2年负责过Agent平台、智能客服、智能质检、RAG产品等LLM应用平台的持续迭代和优化经验",
      "至少有2年负责过Agent平台、智能客服、智能质检、RAG产品等LLM应用平台的持续迭代和优化经验",
      "hard_requirement",
    ],
  ])(
    "classifies a mid-sentence explicit hard qualifier as hard_requirement: %s",
    async (requirementLine, evidence, expected) => {
      const { result, fetchMock } = await classifyRequirement(
        requirementLine,
        evidence,
      );
      const requirement = result.roleProfile.requirements[0];
      expect(requirement.requirementType).toBe(expected);
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("classifies a mid-sentence explicit preferred qualifier as preferred_requirement", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "2.具备产品经验且有AI项目经验者优先",
      "有AI项目经验者优先",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("preferred_requirement");
    expect(requirement.verificationQuestion).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps genuinely fused text without qualifiers as unclear", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "要求能熟练使用AutoCAD/EPLAN，独立完成电气图纸绘制",
      "能熟练使用AutoCAD/EPLAN，独立完成电气图纸绘制",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("unclear");
    expect(requirement.sourceType).toBe("to_verify");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ISSUE-016 section-level preferred scope", () => {
  it("classifies an item under 加分项 as preferred and keeps real section evidence", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "加分项：\n有uni-app跨端开发经验",
      "有uni-app跨端开发经验",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("preferred_requirement");
    expect(requirement.sourceType).toBe("jd_explicit");
    expect(requirement.verificationQuestion).toBeNull();
    expect(requirement.evidence).toContain("有uni-app跨端开发经验");
    expect(requirement.evidence).toContain("加分项：");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies preferred to all items in the section and stops at the next section", async () => {
    const jdText =
      "产品运营岗位，负责活动策划、执行与复盘，协同产品和设计团队推进活动上线。\n任职要求：\n加分项：\n有uni-app跨端开发经验\n熟悉微前端架构或低代码平台开发经验\n任职要求：\n有相关实习经验";
    const analysis = analysisWithRequirement(jdText, "有uni-app跨端开发经验");
    analysis.roleProfile.requirements = [
      {
        content: "有uni-app跨端开发经验",
        explanation: "加分项章节条目。",
        requirementType: "core_requirement" as const,
        sourceType: "jd_explicit" as const,
        evidence: ["有uni-app跨端开发经验"],
        verificationQuestion: null,
      },
      {
        content: "熟悉微前端架构或低代码平台开发经验",
        explanation: "加分项章节条目。",
        requirementType: "core_requirement" as const,
        sourceType: "jd_explicit" as const,
        evidence: ["熟悉微前端架构或低代码平台开发经验"],
        verificationQuestion: null,
      },
      {
        content: "有相关实习经验",
        explanation: "任职要求章节条目。",
        requirementType: "core_requirement" as const,
        sourceType: "jd_explicit" as const,
        evidence: ["有相关实习经验"],
        verificationQuestion: null,
      },
    ];
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      { fetchImpl: fetchMock, apiKey: "test-key", timeoutMs: 2_000 },
    );

    const requirements = result.roleProfile.requirements;
    expect(requirements[0].requirementType).toBe("preferred_requirement");
    expect(requirements[0].evidence).toContain("加分项：");
    expect(requirements[1].requirementType).toBe("preferred_requirement");
    expect(requirements[1].evidence).toContain("加分项：");
    expect(requirements[2].requirementType).toBe("core_requirement");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing hard/preferred split of 统招本科及以上学历，计算机相关专业优先", async () => {
    const jdLine = "1.统招本科及以上学历，计算机相关专业优先";
    const { result: hardResult, fetchMock: hardFetch } = await classifyRequirement(
      jdLine,
      "统招本科及以上学历",
    );
    expect(hardResult.roleProfile.requirements[0].requirementType).toBe(
      "hard_requirement",
    );
    expect(hardFetch).toHaveBeenCalledTimes(1);

    const { result: preferredResult, fetchMock: preferredFetch } =
      await classifyRequirement(jdLine, "计算机相关专业优先");
    expect(preferredResult.roleProfile.requirements[0].requirementType).toBe(
      "preferred_requirement",
    );
    expect(preferredFetch).toHaveBeenCalledTimes(1);
  });

  it("lets an explicit hard qualifier win over the 加分项 section (conflict observation)", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "加分项：\n必须具备5年以上经验",
      "必须具备5年以上经验",
    );
    expect(result.roleProfile.requirements[0].requirementType).toBe(
      "hard_requirement",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ISSUE-018 preferred qualifier 尤佳", () => {
  it("classifies a 尤佳 requirement as preferred without extra confirmation", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "3、有炸鸡、小吃、快餐等品类经验者尤佳。",
      "有炸鸡、小吃、快餐等品类经验者尤佳。",
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.requirementType).toBe("preferred_requirement");
    expect(requirement.sourceType).toBe("jd_explicit");
    expect(requirement.evidence).toEqual(["有炸鸡、小吃、快餐等品类经验者尤佳。"]);
    expect(requirement.verificationQuestion).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ISSUE-020 mixed hard+preferred compound split", () => {
  it("splits 5年以上 + 者优先 compound into hard + preferred (TC-08 case)", async () => {
    const jdLine =
      "2、具备5年以上工业仪器仪表行业工作经验，有PLC、DCS、变频器等自动化相关产品销售或项目经验者优先。";
    const evidence =
      "具备5年以上工业仪器仪表行业工作经验，有PLC、DCS、变频器等自动化相关产品销售或项目经验者优先。";
    const { result, fetchMock } = await classifyRequirement(jdLine, evidence);
    const requirements = result.roleProfile.requirements;

    expect(requirements).toHaveLength(2);
    expect(requirements[0].requirementType).toBe("hard_requirement");
    expect(requirements[0].content).toBe("具备5年以上工业仪器仪表行业工作经验");
    expect(requirements[0].evidence).toEqual([
      "具备5年以上工业仪器仪表行业工作经验",
    ]);
    expect(requirements[1].requirementType).toBe("preferred_requirement");
    expect(requirements[1].content).toBe(
      "有PLC、DCS、变频器等自动化相关产品销售或项目经验者优先。",
    );
    expect(requirements[1].evidence).toEqual([
      "有PLC、DCS、变频器等自动化相关产品销售或项目经验者优先。",
    ]);
    requirements.forEach((requirement) => {
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("splits 本科及以上学历，计算机相关专业优先 into hard + preferred", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "1、本科及以上学历，计算机相关专业优先",
      "本科及以上学历，计算机相关专业优先",
    );
    const requirements = result.roleProfile.requirements;
    expect(requirements).toHaveLength(2);
    expect(requirements[0].requirementType).toBe("hard_requirement");
    expect(requirements[1].requirementType).toBe("preferred_requirement");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not split inseparable 有5年以上销售经验者优先 (whole preferred)", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "1、有5年以上销售经验者优先",
      "有5年以上销售经验者优先",
    );
    const requirements = result.roleProfile.requirements;
    expect(requirements).toHaveLength(1);
    expect(requirements[0].requirementType).toBe("preferred_requirement");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps TC-08 first compound as whole preferred (no hard qualifier)", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "1、有烟草行业或工业大企业销售经验，并有落地项目经验者优先。",
      "有烟草行业或工业大企业销售经验，并有落地项目经验者优先。",
    );
    const requirements = result.roleProfile.requirements;
    expect(requirements).toHaveLength(1);
    expect(requirements[0].requirementType).toBe("preferred_requirement");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Phase 2.4 requirement completeness and deduplication", () => {
  it("ISSUE-017 restores a verbatim preferred sibling when the model emitted only the hard clause", async () => {
    const jdText = requirementJd(
      "1、统招本科及以上学历，计算机相关专业优先",
    );
    const analysis = analysisWithRequirement(jdText, "统招本科及以上学历");
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: "统招本科及以上学历",
          requirementType: "hard_requirement",
        }),
        expect.objectContaining({
          content: "计算机相关专业优先",
          requirementType: "preferred_requirement",
          evidence: ["计算机相关专业优先"],
        }),
      ]),
    );
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ supplementedRequirementCount: 1 }),
    );
  });

  it("ISSUE-023 removes stable duplicates when split items and the full compound are both emitted", async () => {
    const jdText = requirementJd(
      "5、能流利使用英语进行专业交流，熟悉印尼语者优先",
    );
    const analysis = analysisWithRequirement(
      jdText,
      "能流利使用英语进行专业交流",
    );
    analysis.roleProfile.requirements = [
      analysis.roleProfile.requirements[0],
      {
        ...analysis.roleProfile.requirements[0],
        content: "熟悉印尼语者优先",
        evidence: ["熟悉印尼语者优先"],
      },
      {
        ...analysis.roleProfile.requirements[0],
        content: "能流利使用英语进行专业交流，熟悉印尼语者优先",
        evidence: ["能流利使用英语进行专业交流，熟悉印尼语者优先"],
      },
    ];
    const diagnostics = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successfulResponse(analysis));

    const result = await analyzeJobWithDeepSeek(
      { jdText },
      {
        fetchImpl: fetchMock,
        apiKey: "test-key",
        timeoutMs: 2_000,
        onDiagnostics: diagnostics,
      },
    );

    expect(result.roleProfile.requirements).toHaveLength(2);
    expect(result.roleProfile.requirements.map((item) => item.content)).toEqual([
      "能流利使用英语进行专业交流",
      "熟悉印尼语者优先",
    ]);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ deduplicatedRequirementCount: 2 }),
    );
  });
});

describe("ISSUE-022 qualifier + core compound split", () => {
  it("splits TC-09 A into hard + core", async () => {
    const jdLine =
      "1、拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景";
    const evidence =
      "拥有4年以上增长/需求规划、战略规划或咨询相关工作经验，具备预测、计划制定及活动策划背景";
    const { result, fetchMock } = await classifyRequirement(jdLine, evidence);
    const requirements = result.roleProfile.requirements;

    expect(requirements).toHaveLength(2);
    expect(requirements[0].requirementType).toBe("hard_requirement");
    expect(requirements[0].content).toBe(
      "拥有4年以上增长/需求规划、战略规划或咨询相关工作经验",
    );
    expect(requirements[0].evidence).toEqual([
      "拥有4年以上增长/需求规划、战略规划或咨询相关工作经验",
    ]);
    expect(requirements[1].requirementType).toBe("core_requirement");
    expect(requirements[1].content).toBe(
      "具备预测、计划制定及活动策划背景",
    );
    expect(requirements[1].evidence).toEqual(["具备预测、计划制定及活动策划背景"]);
    requirements.forEach((requirement) => {
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("splits TC-09 B into core + preferred", async () => {
    const jdLine = "5、能流利使用英语进行专业交流，熟悉印尼语者优先";
    const evidence = "能流利使用英语进行专业交流，熟悉印尼语者优先";
    const { result, fetchMock } = await classifyRequirement(jdLine, evidence);
    const requirements = result.roleProfile.requirements;

    expect(requirements).toHaveLength(2);
    expect(requirements[0].requirementType).toBe("core_requirement");
    expect(requirements[0].content).toBe("能流利使用英语进行专业交流");
    expect(requirements[0].evidence).toEqual(["能流利使用英语进行专业交流"]);
    expect(requirements[1].requirementType).toBe("preferred_requirement");
    expect(requirements[1].content).toBe("熟悉印尼语者优先");
    expect(requirements[1].evidence).toEqual(["熟悉印尼语者优先"]);
    requirements.forEach((requirement) => {
      expect(requirement.sourceType).toBe("jd_explicit");
      expect(requirement.verificationQuestion).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ISSUE-024 explicit eligibility/age hard classification", () => {
  it.each([
    ["1、具有驾驶证", "具有驾驶证"],
    ["1、40岁以下", "40岁以下"],
    ["1、年龄不超过40岁", "年龄不超过40岁"],
    ["1、年龄不低于22岁", "年龄不低于22岁"],
  ])("classifies %s as hard_requirement", async (jdLine, evidence) => {
    const { result, fetchMock } = await classifyRequirement(jdLine, evidence);
    const requirements = result.roleProfile.requirements;
    expect(requirements).toHaveLength(1);
    expect(requirements[0].requirementType).toBe("hard_requirement");
    expect(requirements[0].evidence).toEqual([evidence]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an ordinary core requirement as core_requirement", async () => {
    const { result, fetchMock } = await classifyRequirement(
      "1、有主人翁意识，能够对项目结果负责、保持积极乐观的工作心态",
      "有主人翁意识，能够对项目结果负责、保持积极乐观的工作心态",
    );
    const requirements = result.roleProfile.requirements;
    expect(requirements).toHaveLength(1);
    expect(requirements[0].requirementType).toBe("core_requirement");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps preferred counterexamples as preferred_requirement", async () => {
    for (const evidence of [
      "有5年以上销售经验者优先",
      "两年以上商务洽谈及开发区或园区招商运营经验优先",
    ]) {
      const { result, fetchMock } = await classifyRequirement(
        `1、${evidence}`,
        evidence,
      );
      const requirements = result.roleProfile.requirements;
      expect(requirements).toHaveLength(1);
      expect(requirements[0].requirementType).toBe("preferred_requirement");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });
});

describe("ISSUE-012A single-character typo evidence remap", () => {
  it("remaps corrected evidence back to the JD original and keeps final evidence verbatim", async () => {
    const jdLine = "1、根据企业的选址需求提供专业的选址方案及咨询服乐";
    const correctedEvidence = "根据企业的选址需求提供专业的选址方案及咨询服务";
    const { result, fetchMock } = await classifyRequirement(
      jdLine,
      correctedEvidence,
    );
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.evidence).toEqual([
      "根据企业的选址需求提供专业的选址方案及咨询服乐",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps exact-match evidence unchanged (no remap, no repair)", async () => {
    const jdLine = "1、根据企业的选址需求提供专业的选址方案及咨询服乐";
    const evidence = "根据企业的选址需求提供专业的选址方案及咨询服乐";
    const { result, fetchMock } = await classifyRequirement(jdLine, evidence);
    const requirement = result.roleProfile.requirements[0];
    expect(requirement.evidence).toEqual([evidence]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
