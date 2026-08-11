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

  it("E28-R6 preserves structured acceptance diagnostics on a Recommendation 502", async () => {
    process.env.RECOMMENDATION_ACCEPTANCE_DIAGNOSTICS = "1";
    const outputEvidence = [
      {
        stage: "initial",
        rejected: true,
        rawText: "rejected recommendation",
        validationIssues: [
          {
            validationLayer: "semantic_validation",
            validationCode: "R-C_STATUS_CONTRADICTION",
            rule: "R-C",
            path: "summary",
            message: "MI-001 text contradicts Match Core status",
            matchItemRefs: ["MI-001"],
          },
        ],
      },
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
    expect(
      body.acceptanceDiagnostics.outputEvidence[0].validationIssues[0],
    ).toMatchObject({
      validationCode: "R-C_STATUS_CONTRADICTION",
      rule: "R-C",
      path: "summary",
    });
  });

  it("E28-R5 does not expose rejected raw or internal rules in production mode", async () => {
    analyzeRecommendationWithDeepSeek.mockImplementation(
      async (_request, options) => {
        options.onDiagnostics({
          outputEvidence: [
            {
              rawText: "rejected recommendation",
              validationCode: "R-C_STATUS_CONTRADICTION",
              rule: "R-C",
            },
          ],
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
    expect(body).not.toHaveProperty("acceptanceDiagnostics");
    expect(JSON.stringify(body)).not.toContain("rejected recommendation");
    expect(JSON.stringify(body)).not.toContain("R-C_STATUS_CONTRADICTION");
    expect(JSON.stringify(body)).not.toContain('"rule":"R-C"');
  });
});
