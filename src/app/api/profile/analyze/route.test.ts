import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PROFILE_LENGTH } from "@/lib/profile-schema";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.PROFILE_ACCEPTANCE_DIAGNOSTICS;
});

const validProfileResponse = {
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          coverage: [
            {
              pfId: "PF-001",
              disposition: "candidate_fact_source",
              atomicClaims: [
                {
                  statement: "计算机本科",
                  semanticTags: ["education"],
                  sourceType: "profile_stated",
                  pfEvidence: ["PF-001"],
                },
                {
                  statement: "应届生",
                  semanticTags: ["experience"],
                  sourceType: "profile_stated",
                  pfEvidence: ["PF-001"],
                },
                {
                  statement: "了解 Python",
                  semanticTags: ["skill_usage"],
                  sourceType: "profile_stated",
                  pfEvidence: ["PF-001"],
                },
                {
                  statement: "参与过课程项目",
                  semanticTags: ["project_experience"],
                  sourceType: "profile_stated",
                  pfEvidence: ["PF-001"],
                },
              ],
              duplicateOf: null,
            },
          ],
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
    const skillId = payload.data.candidateProfile.skills[0];
    expect(
      payload.data.candidateProfile.canonicalFacts.find(
        (fact: { factId: string }) => fact.factId === skillId,
      ).statement,
    ).toBe("了解 Python");
    expect(payload.data.candidateProfile.evidence).toEqual([
      {
        id: "PF-001",
        text: "计算机本科，应届生，了解 Python。参与过课程项目。",
      },
    ]);
  });

  it("emits machine-readable diagnostics only in explicit acceptance mode", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.PROFILE_ACCEPTANCE_DIAGNOSTICS = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(validProfileResponse), { status: 200 }),
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

    const encoded = response.headers.get("X-Profile-Acceptance-Diagnostics");
    expect(encoded).not.toBeNull();
    const diagnostics = JSON.parse(
      Buffer.from(encoded!, "base64url").toString("utf8"),
    );
    expect(diagnostics).toEqual(
      expect.objectContaining({
        pfTotal: 1,
        unprocessedPfCount: 0,
        finalValidationPassed: true,
      }),
    );
  });
});
