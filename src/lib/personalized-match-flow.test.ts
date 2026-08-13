import { afterEach, describe, expect, it, vi } from "vitest";

import { finalizeRawPersonalizedGreeting } from "./greeting-schema";
import {
  PersonalizedMatchFlowError,
  runPersonalizedMatchFlow,
} from "./personalized-match-flow";
import { GREETING_FIXTURES } from "@/test/greeting-fixtures";
import { validAnalysis } from "@/test/fixtures";

function success(data: unknown) {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function completeFixture() {
  const fixture = GREETING_FIXTURES[0];
  if (!fixture.validRaw) throw new Error("expected personalized greeting fixture");
  const greeting = finalizeRawPersonalizedGreeting(
    fixture.validRaw,
    fixture.request,
  ).data;
  if (!greeting) throw new Error("expected final greeting");
  return {
    candidateProfile: fixture.request.candidateProfile,
    matchCore: fixture.request.matchCore,
    recommendation: fixture.request.recommendation,
    strengthGap: fixture.request.strengthGap!,
    greeting,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runPersonalizedMatchFlow", () => {
  it("composes the six released APIs in order with validated upstream data", async () => {
    const fixture = completeFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success(validAnalysis))
      .mockResolvedValueOnce(success(fixture.candidateProfile))
      .mockResolvedValueOnce(success(fixture.matchCore))
      .mockResolvedValueOnce(success(fixture.recommendation))
      .mockResolvedValueOnce(success(fixture.strengthGap))
      .mockResolvedValueOnce(success(fixture.greeting));
    vi.stubGlobal("fetch", fetchMock);
    const stages: string[] = [];

    const result = await runPersonalizedMatchFlow(
      "a valid JD",
      "a valid profile",
      (stage) => stages.push(stage),
    );

    expect(stages).toEqual([
      "jd",
      "profile",
      "match",
      "recommendation",
      "strengthGap",
      "greeting",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/analyze",
      "/api/profile/analyze",
      "/api/match/analyze",
      "/api/recommendation/analyze",
      "/api/strength-gap/analyze",
      "/api/greeting/analyze",
    ]);
    expect(
      JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string),
    ).toEqual({
      jobAnalysis: validAnalysis,
      candidateProfile: fixture.candidateProfile,
    });
    expect(
      JSON.parse((fetchMock.mock.calls[5][1] as RequestInit).body as string),
    ).toEqual({
      candidateProfile: fixture.candidateProfile,
      matchCore: fixture.matchCore,
      recommendation: fixture.recommendation,
      strengthGap: fixture.strengthGap,
    });
    expect(result.greeting).toEqual(fixture.greeting);
  });

  it("stops all downstream calls after an upstream failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(success(validAnalysis))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "AI_OUTPUT_INVALID",
              message: "结果未通过校验",
              request_id: "profile-failure-001",
              retryable: true,
            },
          }),
          { status: 502 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runPersonalizedMatchFlow("a valid JD", "a valid profile"),
    ).rejects.toMatchObject({
      stage: "profile",
      requestId: "profile-failure-001",
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("classifies a non-JSON response without exposing its raw body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("provider raw output", {
          status: 502,
          headers: { "X-Request-ID": "bad-json-001" },
        }),
      ),
    );

    const failure = await runPersonalizedMatchFlow("jd", "profile").catch(
      (error) => error,
    );
    expect(failure).toBeInstanceOf(PersonalizedMatchFlowError);
    expect(failure).toMatchObject({ stage: "jd", requestId: "bad-json-001" });
    expect(failure.message).not.toContain("provider raw output");
  });
});
