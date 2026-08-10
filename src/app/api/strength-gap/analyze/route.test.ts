import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { STRENGTH_GAP_FIXTURES } from "@/test/strength-gap-fixtures";

const { analyzeStrengthGapWithDeepSeek } = vi.hoisted(() => ({
  analyzeStrengthGapWithDeepSeek: vi.fn(),
}));

vi.mock("@/lib/strength-gap-deepseek", () => ({
  analyzeStrengthGapWithDeepSeek,
}));

import { POST } from "./route";

describe("POST /api/strength-gap/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS;
  });

  it("rejects anything other than validated Match Core", async () => {
    const response = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore: {}, recommendation: {} }),
      }),
    );
    expect(response.status).toBe(400);
    expect(analyzeStrengthGapWithDeepSeek).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "INVALID_INPUT", retryable: false },
    });
  });

  it("returns only the validated Strength+Gap envelope", async () => {
    const data = {
      schemaVersion: "strength-gap-core-v1",
      matchSchemaVersion: "match-core-v1",
      strengths: [],
      gaps: [],
    };
    analyzeStrengthGapWithDeepSeek.mockResolvedValue(data);
    const response = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore: STRENGTH_GAP_FIXTURES[0].matchCore }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("fails closed when Strength+Gap validation fails", async () => {
    analyzeStrengthGapWithDeepSeek.mockRejectedValue(
      new ApiError("AI_OUTPUT_INVALID", 502),
    );
    const response = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore: STRENGTH_GAP_FIXTURES[0].matchCore }),
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "AI_OUTPUT_INVALID", retryable: true },
    });
  });
});
