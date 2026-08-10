import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { MATCH_CORE_FIXTURES } from "@/test/match-fixtures";

const { analyzeMatchWithDeepSeek } = vi.hoisted(() => ({
  analyzeMatchWithDeepSeek: vi.fn(),
}));

vi.mock("@/lib/match-deepseek", () => ({
  analyzeMatchWithDeepSeek,
}));

import { POST } from "./route";

describe("POST /api/match/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MATCH_ACCEPTANCE_DIAGNOSTICS;
  });

  it("rejects malformed or unvalidated inputs without calling the model", async () => {
    const response = await POST(
      new Request("http://localhost/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobAnalysis: {}, candidateProfile: {} }),
      }),
    );
    expect(response.status).toBe(400);
    expect(analyzeMatchWithDeepSeek).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "INVALID_INPUT", retryable: false },
    });
  });

  it("returns only the validated Match Core envelope", async () => {
    const data = {
      schemaVersion: "match-core-v1",
      jdSchemaVersion: "analysis-v1",
      candidateProfileSchemaVersion: "candidate-profile-v2",
      matchItems: [],
    };
    analyzeMatchWithDeepSeek.mockResolvedValue(data);
    const response = await POST(
      new Request("http://localhost/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(MATCH_CORE_FIXTURES[0].request),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("fails closed when Match validation fails", async () => {
    analyzeMatchWithDeepSeek.mockRejectedValue(
      new ApiError("AI_OUTPUT_INVALID", 502),
    );
    const response = await POST(
      new Request("http://localhost/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(MATCH_CORE_FIXTURES[0].request),
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "AI_OUTPUT_INVALID", retryable: true },
    });
  });

  it("puts full rejected and repair evidence only in the acceptance response body", async () => {
    process.env.MATCH_ACCEPTANCE_DIAGNOSTICS = "1";
    const data = {
      schemaVersion: "match-core-v1",
      jdSchemaVersion: "analysis-v1",
      candidateProfileSchemaVersion: "candidate-profile-v2",
      matchItems: [],
    };
    const outputEvidence = [
      { stage: "initial", rejected: true, rawText: "rejected output" },
      { stage: "repair", rejected: false, rawText: "accepted repair" },
    ];
    analyzeMatchWithDeepSeek.mockImplementation(
      async (_request, options) => {
        options.onDiagnostics({
          upstreamAttempts: 2,
          outputEvidence,
        });
        return data;
      },
    );

    const response = await POST(
      new Request("http://localhost/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(MATCH_CORE_FIXTURES[0].request),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.acceptanceDiagnostics.outputEvidence).toEqual(outputEvidence);
    const header = JSON.parse(
      Buffer.from(
        String(response.headers.get("X-Match-Acceptance-Diagnostics")),
        "base64url",
      ).toString("utf8"),
    );
    expect(header.outputEvidence).toBeUndefined();
    expect(analyzeMatchWithDeepSeek).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ captureRejectedEvidence: true }),
    );
  });
});
