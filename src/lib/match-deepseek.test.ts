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
    const fetchImpl = vi.fn(async () => completion(validRaw));
    const request = MATCH_CORE_FIXTURES[0].request;
    const before = JSON.stringify(request.candidateProfile);
    let diagnostics: MatchDiagnostics | null = null;

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
    let diagnostics: MatchDiagnostics | null = null;

    const result = await analyzeMatchWithDeepSeek(MATCH_CORE_FIXTURES[0].request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.matchItems[0].status).toBe("met");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      matchRepairAttempted: true,
      matchRepairSucceeded: true,
      upstreamAttempts: 2,
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

  it("keeps deepseek-v4-flash as the default runtime model", async () => {
    const fetchImpl = vi.fn(async () => completion(validRaw));
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
    let diagnostics: MatchDiagnostics | null = null;

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
});
