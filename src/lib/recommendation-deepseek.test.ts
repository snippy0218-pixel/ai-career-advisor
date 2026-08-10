import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import {
  analyzeRecommendationWithDeepSeek,
  type RecommendationDiagnostics,
} from "./recommendation-deepseek";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";

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
  it("returns a validated Recommendation without mutating Match Core", async () => {
    const fixture = RECOMMENDATION_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    const before = JSON.stringify(fixture.matchCore);
    let diagnostics: RecommendationDiagnostics | null = null;

    const result = await analyzeRecommendationWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
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
