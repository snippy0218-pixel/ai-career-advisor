import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import { analyzeMatchWithDeepSeek, type MatchDiagnostics } from "./match-deepseek";
import { MATCH_CORE_FIXTURES } from "@/test/match-fixtures";

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
});
