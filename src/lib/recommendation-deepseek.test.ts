import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import {
  analyzeRecommendationWithDeepSeek,
  type RecommendationDiagnostics,
} from "./recommendation-deepseek";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";
import { buildRecommendationMatchCore } from "@/test/recommendation-fixtures";

function completion(payload: unknown, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: { content: JSON.stringify(payload) },
        },
      ],
      usage: { completion_tokens: 120 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("analyzeRecommendationWithDeepSeek", () => {
  it("E28-R1 accepts a legal output without manufacturing rejection evidence", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    const before = JSON.stringify(fixture.matchCore);
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.recommendationLevel).toBe("priority");
    expect(result.allowedRecommendationLevels).toEqual(["priority", "try"]);
    expect(JSON.stringify(fixture.matchCore)).toBe(before);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      recommendationRepairAttempted: false,
      finalSchemaValidationPassed: true,
      matchCoreImmutable: true,
      fabricatedClaimCount: 0,
      initialAttempt: {
        validationResult: "passed",
      },
      repairState: "not_needed",
      outputEvidence: [],
    });
  });

  it("E28-R3 preserves a structured R-C initial rejection and accepted repair", async () => {
    const fixture = RECOMMENDATION_FIXTURES[3];
    const invalid = { ...fixture.validRaw, summary: "MI-001 已满足。" };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: RecommendationDiagnostics | null = null;

    await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        stage: "initial",
        rejected: true,
        validationIssues: [
          expect.objectContaining({
            validationLayer: "semantic_validation",
            validationCode: "R-C_STATUS_CONTRADICTION",
            rule: "R-C",
            path: "summary",
            matchItemRefs: ["MI-001"],
          }),
        ],
        rejectedItem: { path: "summary", matchItemRef: "MI-001" },
      }),
      expect.objectContaining({
        stage: "repair",
        rejected: false,
        validationIssues: [],
      }),
    ]);
    expect(diagnostics?.repairState).toBe("accepted");
  });

  it("E28-R4 preserves structured rule/code and raw for rejected initial and repair", async () => {
    const fixture = RECOMMENDATION_FIXTURES[3];
    const invalid = { ...fixture.validRaw, summary: "MI-001 已满足。" };
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: RecommendationDiagnostics | null = null;

    await expect(
      analyzeRecommendationWithDeepSeek(
        { matchCore: fixture.matchCore },
        {
          apiKey: "test-key",
          fetchImpl,
          captureRejectedEvidence: true,
          onDiagnostics: (value) => {
            diagnostics = value;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });

    expect(diagnostics?.outputEvidence).toHaveLength(2);
    for (const evidence of diagnostics?.outputEvidence ?? []) {
      expect(evidence).toMatchObject({
        rejected: true,
        rawAvailable: true,
        validationIssues: [
          expect.objectContaining({
            validationCode: "R-C_STATUS_CONTRADICTION",
            rule: "R-C",
            path: "summary",
          }),
        ],
      });
      expect(evidence.rawText).toContain("MI-001 已满足");
    }
    expect(diagnostics?.repairState).toBe("rejected");
  });

  it("normalizes only a terminal ambiguous repair summary and revalidates the full output", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const ambiguous = {
      ...fixture.validRaw,
      summary: "MI-001 与 MI-002 的状态综合来看，整体已满足。",
    };
    const fetchImpl = vi.fn(async () => completion(ambiguous));
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.summary).not.toBe(ambiguous.summary);
    expect(result.supportingMatchRefs).toEqual(ambiguous.supportingMatchRefs);
    expect(diagnostics).toMatchObject({
      repairAttempt: { validationResult: "failed" },
      repairState: "accepted",
      recommendationNormalizationAttempted: true,
      recommendationNormalizationSucceeded: true,
      normalizationValidationIssues: [],
      normalizedRepairOutput: expect.any(Object),
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: false }),
      ],
    });
  });

  it("adds a missing hard-unmet strictness question after repair and revalidates", async () => {
    const fixture = RECOMMENDATION_FIXTURES[1];
    const missingStrictness = {
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
    const fetchImpl = vi.fn(async () => completion(missingStrictness));
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.questionsToConfirm).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: "请向招聘方确认 MI-001 是否属于严格筛选门槛？",
          matchItemRefs: ["MI-001"],
        }),
      ]),
    );
    expect(diagnostics).toMatchObject({
      recommendationNormalizationAttempted: true,
      recommendationNormalizationSucceeded: true,
      normalizationValidationIssues: [],
    });
  });

  it("performs exactly one bounded repair for a forbidden level", async () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const invalid = {
      ...fixture.validRaw,
      recommendationLevel: "not_recommended",
      counterMatchRefs: [],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.recommendationLevel).toBe("cautious");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      recommendationRepairAttempted: true,
      recommendationRepairSucceeded: true,
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: false }),
      ],
      upstreamAttempts: 2,
    });
    expect(diagnostics?.initialValidationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "recommendationLevel" }),
      ]),
    );
    expect(diagnostics?.repairValidationIssues).toEqual([]);
    const repairBody = JSON.parse(
      String((fetchImpl.mock.calls[1][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(repairBody.messages[1].content).toContain("有界 Recommendation Repair");
    expect(repairBody.messages[1].content).toContain("allowed-level");
  });

  it("R9 does not repair a legal multi-MI status expression", async () => {
    const matchCore = buildRecommendationMatchCore([
      {
        requirement: "本科及以上",
        requirementType: "hard_requirement",
        status: "met",
      },
      {
        requirement: "熟练使用 Python",
        requirementType: "core_requirement",
        status: "partial",
      },
    ]);
    const validRaw = {
      recommendationLevel: "try" as const,
      summary: "学历要求已满足（MI-001），Python 要求有部分支持（MI-002）。",
      supportingMatchRefs: ["MI-001", "MI-002"],
      counterMatchRefs: [],
      limitations: [
        { content: "MI-002 仅为部分匹配。", matchItemRefs: ["MI-002"] },
      ],
      questionsToConfirm: [
        { question: "请补充 MI-002 的实际应用程度？", matchItemRefs: ["MI-002"] },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(validRaw));
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.summary).toBe(validRaw.summary);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      recommendationRepairAttempted: false,
      upstreamAttempts: 1,
    });
  });

  it("R31-15 accepts the exact runtime summary without validator-induced repair", async () => {
    const matchCore = buildRecommendationMatchCore([
      { requirement: "熟练掌握 Python", requirementType: "core_requirement", status: "partial" },
      { requirement: "具有独立负责数据产品的正式工作经验", requirementType: "core_requirement", status: "unmet", dimensionType: "employment_type" },
      { requirement: "能主导跨团队项目并对个人交付结果负责", requirementType: "core_requirement", status: "partial", dimensionType: "responsibility" },
      { requirement: "本科及以上学历", requirementType: "hard_requirement", status: "met", dimensionType: "qualification" },
    ]);
    const validRaw = {
      recommendationLevel: "cautious" as const,
      summary:
        "Match Core 正向证据包括 MI-004（学历要求已满足）以及 MI-001、MI-003 的部分匹配；反证为 MI-002（正式数据产品工作经验未满足）。待确认项集中在 MI-001 与 MI-003 的掌握深度和主导程度。",
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
        { question: "请描述您使用 Python 完成的具体项目或任务，以及您对 Python 高级特性的熟悉程度。", matchItemRefs: ["MI-001"] },
        { question: "请描述您在团队项目中承担的具体职责，以及您如何协调跨团队合作。", matchItemRefs: ["MI-003"] },
        { question: "请举例说明您在项目中如何对个人交付结果负责。", matchItemRefs: ["MI-003"] },
        { question: "该正式数据产品工作经验是否为严格筛选门槛？请确认具体口径。", matchItemRefs: ["MI-002"] },
      ],
    };
    const fetchImpl = vi.fn(async () => completion(validRaw));
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.summary).toBe(validRaw.summary);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      recommendationRepairAttempted: false,
      recommendationRepairSucceeded: false,
      repairState: "not_needed",
      outputEvidence: [],
    });
  });

  it("E28-R7 preserves an ambiguous R-C code without fabricating an MI reference", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const ambiguous = {
      ...fixture.validRaw,
      summary: "MI-001 与 MI-002 的状态综合来看，整体已满足。",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(ambiguous))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: RecommendationDiagnostics | null = null;

    await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(diagnostics?.outputEvidence[0]).toMatchObject({
      rejected: true,
      rejectedItem: null,
      validationIssues: [
        expect.objectContaining({
          validationCode: "R-C_AMBIGUOUS_STATUS_ATTRIBUTION",
          rule: "R-C",
          matchItemRefs: [],
        }),
      ],
    });
  });

  it("fails closed when the one repair still omits an unknown", async () => {
    const fixture = RECOMMENDATION_FIXTURES[2];
    const invalid = {
      ...fixture.validRaw,
      limitations: [],
      questionsToConfirm: [],
    };
    const fetchImpl = vi.fn(async () => completion(invalid));

    let caught: unknown;
    let diagnostics: RecommendationDiagnostics | null = null;
    try {
      await analyzeRecommendationWithDeepSeek(
        { matchCore: fixture.matchCore },
        {
          apiKey: "test-key",
          fetchImpl,
          captureRejectedEvidence: true,
          onDiagnostics: (value) => {
            diagnostics = value;
          },
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("AI_OUTPUT_INVALID");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics?.repairValidationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("unknown") }),
      ]),
    );
    expect(diagnostics).toMatchObject({
      evidenceCaptureEnabled: true,
      outputEvidence: [
        expect.objectContaining({ stage: "initial", rejected: true }),
        expect.objectContaining({ stage: "repair", rejected: true }),
      ],
    });
  });

  it("EC4 preserves truncated Recommendation raw", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw, "length"));
    let diagnostics: RecommendationDiagnostics | null = null;
    await expect(
      analyzeRecommendationWithDeepSeek(
        { matchCore: fixture.matchCore },
        {
          apiKey: "test-key",
          fetchImpl,
          captureRejectedEvidence: true,
          onDiagnostics: (value) => {
            diagnostics = value;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        rawAvailable: true,
        finishReason: "length",
        failureCategory: "truncated",
        validationIssues: [],
        rejectedItem: null,
      }),
    ]);
  });

  it("E28-R8 does not assign an R-C rule to a provider failure", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    let diagnostics: RecommendationDiagnostics | null = null;

    await expect(
      analyzeRecommendationWithDeepSeek(
        { matchCore: fixture.matchCore },
        {
          apiKey: "test-key",
          fetchImpl,
          captureRejectedEvidence: true,
          onDiagnostics: (value) => {
            diagnostics = value;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AI_SERVICE_UNAVAILABLE" });
    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        rawAvailable: false,
        failureCategory: "provider",
        validationIssues: [],
        rejectedItem: null,
      }),
    ]);
  });

  it("keeps deepseek-v4-flash as the default runtime model", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      { apiKey: "test-key", fetchImpl },
    );
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { model: string; temperature: number };
    expect(body).toMatchObject({ model: "deepseek-v4-flash", temperature: 0.1 });
  });
});
