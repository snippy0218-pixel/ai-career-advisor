import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { sampleJd, validAnalysis } from "@/test/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
});

describe("POST /api/analyze", () => {
  it("rejects invalid input before calling DeepSeek", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ jdText: "太短" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload).toMatchObject({
      data: null,
      error: {
        code: "INVALID_INPUT",
        message: expect.any(String),
        request_id: expect.any(String),
        retryable: false,
      },
    });
    expect(response.headers.get("x-request-id")).toBe(payload.error.request_id);
  });

  it("returns validated analysis data", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(validAnalysis) },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: sampleJd }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toEqual(expect.any(String));
    await expect(response.json()).resolves.toEqual({
      data: validAnalysis,
      error: null,
    });
  });
});
