import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PROFILE_LENGTH } from "@/lib/profile-schema";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
});

const validProfileResponse = {
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          careerTarget: null,
          education: [],
          experiences: [],
          projects: [],
          skills: [
            {
              value: "Python：了解",
              sourceType: "normalized_stated",
              pfEvidence: ["PF-001"],
              verificationQuestion: null,
            },
          ],
          certificates: [],
          portfolio: [],
          preferences: [],
          derivedObservations: [],
          unknowns: [],
          questionsToConfirm: [],
        }),
      },
    },
  ],
};

describe("POST /api/profile/analyze", () => {
  it("rejects short input before calling DeepSeek", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/profile/analyze", {
        method: "POST",
        body: JSON.stringify({ profileText: "太短" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.code).toBe("INVALID_INPUT");
  });

  it("rejects over-limit input with a structured error (no silent truncation)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/profile/analyze", {
        method: "POST",
        body: JSON.stringify({ profileText: "字".repeat(MAX_PROFILE_LENGTH + 1) }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.code).toBe("INVALID_INPUT");
  });

  it("returns a validated candidate profile", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(validProfileResponse), { status: 200 }),
        ),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileText: "计算机本科，应届生，了解 Python。参与过课程项目。",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.error).toBeNull();
    expect(payload.data.profileProvided).toBe(true);
    expect(payload.data.candidateProfile.skills[0].value).toBe("Python：了解");
    expect(payload.data.candidateProfile.evidence).toEqual([
      {
        id: "PF-001",
        text: "计算机本科，应届生，了解 Python。参与过课程项目。",
      },
    ]);
  });
});
