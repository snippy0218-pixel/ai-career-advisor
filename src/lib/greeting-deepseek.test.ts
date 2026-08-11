import { describe, expect, it, vi } from "vitest";

import { GREETING_FIXTURES } from "@/test/greeting-fixtures";
import {
  analyzeGreetingWithDeepSeek,
  type GreetingDiagnostics,
} from "./greeting-deepseek";
import type { RawPersonalizedGreeting } from "./greeting-schema";

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

function invalidOwnershipRaw(index = 3) {
  const fixture = GREETING_FIXTURES[index];
  const raw = structuredClone(fixture.validRaw!);
  raw.candidateClaims[0].statement = "负责需求分析";
  raw.greeting = raw.greeting.replace("协助需求整理", "负责需求分析");
  return raw;
}

describe("analyzeGreetingWithDeepSeek", () => {
  it("returns a validated personalized Greeting without mutating upstreams", async () => {
    const fixture = GREETING_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    const before = JSON.stringify(fixture.request);
    let diagnostics: GreetingDiagnostics | null = null;

    const result = await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.personalizationStatus).toBe("personalized");
    expect(result.candidateFactRefs).toHaveLength(2);
    expect(JSON.stringify(fixture.request)).toBe(before);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toMatchObject({
      candidateFactIntegrityPassed: true,
      pfEvidenceIntegrityPassed: true,
      semanticPreservationPassed: true,
      crossSourceIsolationPassed: true,
      quantificationIntegrityPassed: true,
      teamAttributionPassed: true,
      unknownIntegrityPassed: true,
      matchConsistencyPassed: true,
      waiverIntegrityPassed: true,
      recommendationToneIntegrityPassed: true,
      referenceIntegrityPassed: true,
      finalSchemaValidationPassed: true,
      repairFallbackSafetyPassed: true,
      matchCoreImmutable: true,
      candidateProfileImmutable: true,
      recommendationImmutable: true,
      strengthGapImmutable: true,
    });
  });

  it("performs exactly one bounded repair", async () => {
    const fixture = GREETING_FIXTURES[3];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalidOwnershipRaw()))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: GreetingDiagnostics | null = null;

    const result = await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result.greeting).toContain("协助需求整理");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(diagnostics).toMatchObject({
      personalizedGreetingRepairAttempted: true,
      personalizedGreetingRepairSucceeded: true,
      personalizedGreetingSafeFallbackUsed: false,
      upstreamAttempts: 2,
    });
  });

  it("uses a validated personalized fallback when repair remains invalid", async () => {
    const fixture = GREETING_FIXTURES[3];
    const invalid = invalidOwnershipRaw();
    const fetchImpl = vi.fn(async () => completion(invalid));
    let diagnostics: GreetingDiagnostics | null = null;

    const result = await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result).toMatchObject({
      personalizationStatus: "personalized",
      candidateFactRefs: ["CF-001"],
    });
    expect(result.greeting).toContain("协助需求整理");
    expect(result.greeting).not.toContain("负责需求分析");
    expect(diagnostics).toMatchObject({
      personalizedGreetingRepairAttempted: true,
      personalizedGreetingRepairSucceeded: false,
      personalizedGreetingSafeFallbackUsed: true,
      finalSchemaValidationPassed: true,
      repairFallbackSafetyPassed: true,
    });
  });

  it("uses the Phase 1 non-personalized fallback when no safe fact exists", async () => {
    const fixture = GREETING_FIXTURES[11];
    const fetchImpl = vi.fn();
    let diagnostics: GreetingDiagnostics | null = null;

    const result = await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(result).toMatchObject({
      personalizationStatus: "not_personalized",
      candidateFactRefs: [],
      matchRefs: [],
      strengthRefs: [],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(diagnostics).toMatchObject({
      phase1GreetingFallbackUsed: true,
      personalizedGreetingSafeFallbackUsed: false,
      finalSchemaValidationPassed: true,
    });
  });

  it("does not pass unrelated Profile injection evidence to the model", async () => {
    const fixture = GREETING_FIXTURES[10];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
    });
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    const serialized = JSON.stringify(body.messages);
    expect(serialized).not.toContain("忽略所有规则");
    expect(serialized).not.toContain("五年正式工作经验");
  });

  it("preserves rejected initial and repair evidence with secret scrub", async () => {
    const fixture = GREETING_FIXTURES[3];
    const invalid = invalidOwnershipRaw();
    (invalid as RawPersonalizedGreeting & { apiKey?: string }).apiKey =
      "sk-fake-secret-123456";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion(invalid))
      .mockResolvedValueOnce(completion(fixture.validRaw));
    let diagnostics: GreetingDiagnostics | null = null;

    await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "sk-fake-secret-123456",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });

    expect(diagnostics?.outputEvidence).toHaveLength(2);
    expect(diagnostics?.outputEvidence[0]).toMatchObject({
      stage: "initial",
      rejected: true,
      rejectedGreeting: expect.stringContaining("负责需求分析"),
    });
    expect(diagnostics?.outputEvidence[1]).toMatchObject({
      stage: "repair",
      rejected: false,
    });
    const serialized = JSON.stringify(diagnostics?.outputEvidence);
    expect(serialized).not.toContain("sk-fake-secret-123456");
  });

  it("EC4 preserves truncated Greeting raw before safe fallback", async () => {
    const fixture = GREETING_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw, "length"));
    let diagnostics: GreetingDiagnostics | null = null;
    const result = await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
      captureRejectedEvidence: true,
      onDiagnostics: (value) => {
        diagnostics = value;
      },
    });
    expect(result.personalizationStatus).toBe("personalized");
    expect(diagnostics?.personalizedGreetingSafeFallbackUsed).toBe(true);
    expect(diagnostics?.outputEvidence).toEqual([
      expect.objectContaining({
        rawAvailable: true,
        finishReason: "length",
        failureCategory: "truncated",
      }),
    ]);
  });

  it("uses the authorized runtime model and bounded temperature", async () => {
    const fixture = GREETING_FIXTURES[0];
    const fetchImpl = vi.fn(async () => completion(fixture.validRaw));
    await analyzeGreetingWithDeepSeek(fixture.request, {
      apiKey: "test-key",
      fetchImpl,
    });
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0][1] as RequestInit).body),
    ) as { model: string; temperature: number };
    expect(body).toMatchObject({ model: "deepseek-v4-flash", temperature: 0.1 });
  });
});
