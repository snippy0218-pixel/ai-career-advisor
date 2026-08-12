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

  it("PF3/PF5 proves Strength+Gap capability at the route boundary", async () => {
    const disabled = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "X-Phase-2-Acceptance-Preflight": "1" },
      }),
    );
    expect(disabled.status).toBe(503);
    process.env.STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS = "1";
    const enabled = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "X-Phase-2-Acceptance-Preflight": "1" },
      }),
    );
    expect(enabled.status).toBe(200);
    expect(await enabled.json()).toMatchObject({
      data: { module: "strengthGap", rejectedOutputCapture: true },
    });
    expect(analyzeStrengthGapWithDeepSeek).not.toHaveBeenCalled();
  });

  it("persists full evidence only in the acceptance response body", async () => {
    process.env.STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS = "1";
    const data = {
      schemaVersion: "strength-gap-core-v1",
      matchSchemaVersion: "match-core-v1",
      strengths: [],
      gaps: [],
    };
    const evidence = {
      stage: "initial",
      rejected: true,
      rawText: "rejected raw output",
      rejectedItems: [{ statement: "rejected statement" }],
    };
    const normalizedRepairOutput = { strengths: [], gaps: [] };
    analyzeStrengthGapWithDeepSeek.mockImplementation(
      async (_request, options) => {
        options.onDiagnostics({
          strengthGapRepairAttempted: true,
          normalizedRepairOutput,
          outputEvidence: [evidence],
        });
        return data;
      },
    );

    const response = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore: STRENGTH_GAP_FIXTURES[0].matchCore }),
      }),
    );
    const body = await response.json();
    const header = JSON.parse(
      Buffer.from(
        response.headers.get("X-Strength-Gap-Acceptance-Diagnostics")!,
        "base64url",
      ).toString("utf8"),
    );

    expect(body).toEqual({
      data,
      error: null,
      acceptanceDiagnostics: {
        strengthGapRepairAttempted: true,
        normalizedRepairOutput,
        outputEvidence: [evidence],
      },
    });
    expect(header).toEqual({ strengthGapRepairAttempted: true });
    expect(header).not.toHaveProperty("outputEvidence");
    expect(header).not.toHaveProperty("normalizedRepairOutput");
    expect(analyzeStrengthGapWithDeepSeek).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ captureRejectedEvidence: true }),
    );
  });

  it("EC7 preserves Strength/Gap evidence on an acceptance-mode 502", async () => {
    process.env.STRENGTH_GAP_ACCEPTANCE_DIAGNOSTICS = "1";
    const outputEvidence = [
      { stage: "initial", rejected: true, rawText: "rejected strength" },
    ];
    analyzeStrengthGapWithDeepSeek.mockImplementation(
      async (_request, options) => {
        options.onDiagnostics({
          strengthGapRepairAttempted: true,
          outputEvidence,
        });
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      },
    );
    const response = await POST(
      new Request("http://localhost/api/strength-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchCore: STRENGTH_GAP_FIXTURES[0].matchCore }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.acceptanceDiagnostics.outputEvidence).toEqual(outputEvidence);
  });
});
