import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-errors";
import {
  analyzeStrengthGapWithDeepSeek,
  type StrengthGapDiagnostics,
} from "./strength-gap-deepseek";
import { STRENGTH_GAP_FIXTURES } from "@/test/strength-gap-fixtures";

function completion(payload: unknown, finishReason = "stop") {
  return completionText(JSON.stringify(payload), finishReason);
}

function completionText(content: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: { content },
        },
      ],
      usage: { completion_tokens: 120 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function candidateUpgradeOutput() {
  return {
    strengths: [
      {
        type: "transferable_strength",
        statement: "你具备独立负责完整需求流程的能力，并具有可迁移性。",
        matchRefs: ["MI-001"],
      },
    ],
    gaps: STRENGTH_GAP_FIXTURES[6].validRaw.gaps,
  };
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

  it("EC-TC-01 captures the full initial rejected Strength", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const rejected = candidateUpgradeOutput();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(rejected))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: StrengthGapDiagnostics | null = null;

    await analyzeStrengthGapWithDeepSeek(
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

    expect(diagnostics?.outputEvidence).toHaveLength(2);
    expect(diagnostics?.outputEvidence[0]).toMatchObject({
      stage: "initial",
      rejected: true,
      parseError: null,
      artifactTruncated: false,
      rejectedItems: [
        expect.objectContaining({
          collection: "strengths",
          index: 0,
          type: "transferable_strength",
          statement: rejected.strengths[0].statement,
          matchRefs: ["MI-001"],
          validatorRules: expect.arrayContaining(["SG-B", "SG-D"]),
        }),
      ],
    });
    expect(diagnostics?.outputEvidence[0].rawText).toContain(
      rejected.strengths[0].statement,
    );
  });

  it("EC-TC-02 preserves rejected initial and repair evidence", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const rejected = candidateUpgradeOutput();
    const fetchImpl = vi.fn(async () => completion(rejected));
    let diagnostics: StrengthGapDiagnostics | null = null;
    let caught: unknown;

    try {
      await analyzeStrengthGapWithDeepSeek(
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
    expect(diagnostics?.outputEvidence.map((item) => [item.stage, item.rejected]))
      .toEqual([
        ["initial", true],
        ["repair", true],
      ]);
    expect(diagnostics?.outputEvidence[1].rejectedItems[0].statement).toBe(
      rejected.strengths[0].statement,
    );
  });

  it("EC-TC-03 preserves bounded raw text and parse errors", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const malformed = `{"invalid":"${"x".repeat(13_000)}`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completionText(malformed))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: StrengthGapDiagnostics | null = null;

    await analyzeStrengthGapWithDeepSeek(
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
      stage: "initial",
      rejected: true,
      parseError: "JSON_PARSE_ERROR",
      artifactTruncated: true,
      rawTextLength: malformed.length,
    });
    expect(diagnostics?.outputEvidence[0].rawText).toHaveLength(12_000);
  });

  it("EC-TC-04 scrubs configured and structured secrets", async () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const apiKey = "sk-fake-api-key-123456";
    const authorization = "Bearer auth-token-987654";
    const cookie = "session=cookie-secret-654321";
    const invalid = {
      strengths: [],
      gaps: [],
      apiKey,
      authorization,
      cookie,
      credential: "credential-secret-111111",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: StrengthGapDiagnostics | null = null;

    await analyzeStrengthGapWithDeepSeek(
      { matchCore: fixture.matchCore },
      {
        apiKey,
        fetchImpl,
        captureRejectedEvidence: true,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      },
    );

    const serialized = JSON.stringify(diagnostics?.outputEvidence);
    expect(serialized).toContain("[REDACTED_SECRET]");
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(authorization);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain("credential-secret-111111");
  });
});
