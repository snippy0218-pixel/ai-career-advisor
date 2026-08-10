import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import {
  analyzeStrengthGapWithDeepSeek,
  type StrengthGapDiagnostics,
} from "./strength-gap-deepseek";
import { STRENGTH_GAP_FIXTURES } from "@/test/strength-gap-fixtures";

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

describe("analyzeStrengthGapWithDeepSeek", () => {
  it("returns validated Strength+Gap without mutating Match Core", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    const before = JSON.stringify(fixture.matchCore);
    let diagnostics: StrengthGapDiagnostics | null = null;

    const result = await analyzeStrengthGapWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.schemaVersion).toBe("strength-gap-core-v1");
    expect(JSON.stringify(fixture.matchCore)).toBe(before);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      strengthGapRepairAttempted: false,
      finalSchemaValidationPassed: true,
      matchCoreImmutable: true,
      recommendationIsolationPassed: true,
      fabricatedClaimCount: 0,
      candidateClaimUpgradeCount: 0,
      unknownDeficiencyCount: 0,
      unsupportedActionCount: 0,
    });
  });

  it("performs exactly one bounded repair", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[4];
    const invalid = { strengths: [], gaps: [] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: StrengthGapDiagnostics | null = null;

    const result = await analyzeStrengthGapWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey: "test-key",
        fetchImpl,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    expect(result.gaps[0].type).toBe("information");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      strengthGapRepairAttempted: true,
      strengthGapRepairSucceeded: true,
      upstreamAttempts: 2,
    });
    expect(diagnostics?.initialValidationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-F") }),
      ]),
    );
  });

  it("fails closed when the one repair remains invalid", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[4];
    const fetchImpl = vi.fn(async () => completion({ strengths: [], gaps: [] }));
    let caught: unknown;
    let diagnostics: StrengthGapDiagnostics | null = null;

    try {
      await analyzeStrengthGapWithDeepSeek(
        { matchCore: fixture.matchCore },
        {
          apiKey: "test-key",
          fetchImpl,
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
        expect.objectContaining({ message: expect.stringContaining("SG-F") }),
      ]),
    );
  });

  it("uses the authorized runtime model and bounded temperature", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    await analyzeStrengthGapWithDeepSeek(
      { matchCore: fixture.matchCore },
      { apiKey: "test-key", fetchImpl },
    );
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { model: string; temperature: number };
    expect(body).toMatchObject({ model: "deepseek-v4-flash", temperature: 0.1 });
  });
});
