import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { RECOMMENDATION_FIXTURES } from "@/test/recommendation-fixtures";

const { analyzeRecommendationWithDeepSeek } = vi.hoisted(() => ({
  analyzeRecommendationWithDeepSeek: vi.fn(),
}));

vi.mock("@/lib/recommendation-deepseek", () => ({
  analyzeRecommendationWithDeepSeek,
}));

import { POST } from "./route";

describe("POST /api/recommendation/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS;
  });

  it("PF5 proves Recommendation capability without invoking generation", async () => {
    process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS = "1";
    const response = await POST(
      new Request("http://localhost/api/recommendation/analyze", {
        method: "POST",
        headers: { "X-Phase-2-Acceptance-Preflight": "1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { module: "recommendation", rejectedOutputCapture: true },
    });
    expect(analyzeRecommendationWithDeepSeek).not.toHaveBeenCalled();
  });

  it("preserves acceptance diagnostics on a Recommendation 502", async () => {
    process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS = "1";
    const outputEvidence = [
      { stage: "initial", rejected: true, rawText: "rejected recommendation" },
    ];
    analyzeRecommendationWithDeepSeek.mockImplementation(
      async (_request, options) => {
        options.onDiagnostics({
          recommendationRepairAttempted: true,
          outputEvidence,
        });
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      },
    );
    const response = await POST(
      new Request("http://localhost/api/recommendation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchCore: RECOMMENDATION_FIXTURES[0].matchCore,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.acceptanceDiagnostics.outputEvidence).toEqual(outputEvidence);
  });

  it("does not expose rejected raw in ordinary production mode", async () => {
    analyzeRecommendationWithDeepSeek.mockRejectedValue(
      new ApiError("AI_OUTPUT_INVALID", 502),
    );
    const response = await POST(
      new Request("http://localhost/api/recommendation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchCore: RECOMMENDATION_FIXTURES[0].matchCore,
        }),
      }),
    );
    const body = await response.json();
    expect(body).not.toHaveProperty("acceptanceDiagnostics");
    expect(JSON.stringify(body)).not.toContain("rejected recommendation");
  });
});
