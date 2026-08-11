import { beforeEach, describe, expect, it, vi } from "vitest";

import { GREETING_FIXTURES } from "@/test/greeting-fixtures";

const { analyzeGreetingWithDeepSeek } = vi.hoisted(() => ({
  analyzeGreetingWithDeepSeek: vi.fn(),
}));

vi.mock("@/lib/greeting-deepseek", () => ({
  analyzeGreetingWithDeepSeek,
}));

import { POST } from "./route";

describe("POST /api/greeting/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GREETING_ACCEPTANCE_DIAGNOSTICS;
  });

  it("rejects anything other than validated upstream cores", async () => {
    const response = await POST(
      new Request("http://localhost/api/greeting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateProfile: {}, matchCore: {} }),
      }),
    );
    expect(response.status).toBe(400);
    expect(analyzeGreetingWithDeepSeek).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "INVALID_INPUT", retryable: false },
    });
  });

  it("returns only the validated Personalized Greeting envelope", async () => {
    const data = {
      schemaVersion: "personalized-greeting-v1",
      personalizationStatus: "personalized",
      greeting: "您好，我有真实项目经历，与岗位部分职责相关，希望进一步沟通。",
      candidateFactRefs: ["CF-001"],
      matchRefs: ["MI-001"],
      jdEvidence: ["岗位职责"],
      strengthRefs: [],
    };
    analyzeGreetingWithDeepSeek.mockResolvedValue(data);
    const response = await POST(
      new Request("http://localhost/api/greeting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(GREETING_FIXTURES[0].request),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data, error: null });
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("PF5 proves Greeting capability without invoking generation", async () => {
    process.env.GREETING_ACCEPTANCE_DIAGNOSTICS = "1";
    const response = await POST(
      new Request("http://localhost/api/greeting/analyze", {
        method: "POST",
        headers: { "X-Phase-2-Acceptance-Preflight": "1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { module: "greeting", rejectedOutputCapture: true },
    });
    expect(analyzeGreetingWithDeepSeek).not.toHaveBeenCalled();
  });

  it("puts full rejected evidence only in the acceptance response body", async () => {
    process.env.GREETING_ACCEPTANCE_DIAGNOSTICS = "1";
    const data = {
      schemaVersion: "personalized-greeting-v1",
      personalizationStatus: "personalized",
      greeting: "您好，我有真实项目经历，与岗位部分职责相关，希望进一步沟通。",
      candidateFactRefs: ["CF-001"],
      matchRefs: ["MI-001"],
      jdEvidence: ["岗位职责"],
      strengthRefs: [],
    };
    const outputEvidence = [{ stage: "initial", rawText: "rejected output" }];
    analyzeGreetingWithDeepSeek.mockImplementation(async (_request, options) => {
      options.onDiagnostics({
        personalizedGreetingRepairAttempted: true,
        outputEvidence,
      });
      return data;
    });
    const response = await POST(
      new Request("http://localhost/api/greeting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(GREETING_FIXTURES[0].request),
      }),
    );
    const body = await response.json();
    const header = JSON.parse(
      Buffer.from(
        response.headers.get("X-Greeting-Acceptance-Diagnostics")!,
        "base64url",
      ).toString("utf8"),
    );
    expect(body.acceptanceDiagnostics.outputEvidence).toEqual(outputEvidence);
    expect(header).not.toHaveProperty("outputEvidence");
    expect(analyzeGreetingWithDeepSeek).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ captureRejectedEvidence: true }),
    );
  });
});
