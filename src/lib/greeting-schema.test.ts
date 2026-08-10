import { describe, expect, it } from "vitest";

import { GREETING_FIXTURES } from "@/test/greeting-fixtures";
import {
  buildGreetingFactSelection,
  buildPersonalizedSafeFallback,
  buildPhase1SafeFallback,
  finalPersonalizedGreetingSchema,
  finalizeRawPersonalizedGreeting,
  type RawPersonalizedGreeting,
} from "./greeting-schema";

function validFixture(index: number) {
  const fixture = GREETING_FIXTURES[index];
  if (!fixture.validRaw) throw new Error(`${fixture.id} has no model raw fixture`);
  return { fixture, raw: structuredClone(fixture.validRaw) };
}

function issuesFor(index: number, mutate: (raw: RawPersonalizedGreeting) => void) {
  const { fixture, raw } = validFixture(index);
  mutate(raw);
  return finalizeRawPersonalizedGreeting(raw, fixture.request).issues;
}

describe("personalized greeting schema", () => {
  it("accepts every model-backed PG fixture", () => {
    for (const fixture of GREETING_FIXTURES.filter((item) => item.validRaw)) {
      const result = finalizeRawPersonalizedGreeting(
        fixture.validRaw!,
        fixture.request,
      );
      expect(result.issues, fixture.id).toEqual([]);
      expect(result.data?.personalizationStatus).toBe("personalized");
    }
  });

  it("selects at most two positive Candidate Facts and prioritizes critical evidence", () => {
    const selection = buildGreetingFactSelection(GREETING_FIXTURES[1].request);
    expect(selection.map((item) => item.candidateFact.factId)).toEqual([
      "CF-001",
      "CF-002",
    ]);
    expect(selection.every((item) => item.matchRefs.length > 0)).toBe(true);
  });

  it("PG-A/PG-C reject a Candidate claim that changes canonical ownership", () => {
    const issues = issuesFor(3, (raw) => {
      raw.candidateClaims[0].statement = "负责需求分析";
      raw.greeting = raw.greeting.replace("协助需求整理", "负责需求分析");
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-A") }),
        expect.objectContaining({ message: expect.stringContaining("PG-C") }),
      ]),
    );
  });

  it("PG-C rejects an extra proficiency upgrade outside structured claims", () => {
    const issues = issuesFor(2, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我已熟练掌握 Python，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-C") }),
      ]),
    );
  });

  it("PG-C preserves course-project context", () => {
    const issues = issuesFor(4, (raw) => {
      raw.candidateClaims[0].statement = "使用 Figma 完成原型设计";
      raw.greeting = raw.greeting.replace(
        "在课程项目中使用 Figma 完成原型设计",
        "使用 Figma 完成原型设计",
      );
    });
    expect(issues.some((issue) => issue.message.includes("PG-C"))).toBe(true);
  });

  it("accepts natural claim wrappers and traceable bounded relation wording", () => {
    const { fixture, raw } = validFixture(1);
    raw.greeting =
      "您好，看到贵司的岗位。我拥有本科学历，并且了解 Python 基础语法。这些经历与岗位的部分职责存在一定相关性，希望有机会进一步交流。";
    const result = finalizeRawPersonalizedGreeting(raw, fixture.request);
    expect(result.issues).toEqual([]);
    expect(result.data?.candidateFactRefs).toEqual(["CF-001", "CF-002"]);
  });

  it("still rejects a JD requirement transferred into an extra Candidate claim", () => {
    const issues = issuesFor(3, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我独立负责需求分析，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-A") }),
        expect.objectContaining({ message: expect.stringContaining("PG-C") }),
      ]),
    );
  });

  it("PG-F rejects team achievement attributed to the individual", () => {
    const issues = issuesFor(5, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我获得了一等奖，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-F") }),
      ]),
    );
  });

  it("PG-E rejects numbers absent from Candidate Facts", () => {
    const issues = issuesFor(9, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "曾提升 30% 效率，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-E") }),
      ]),
    );
  });

  it("PG-G rejects an unknown SQL claim", () => {
    const issues = issuesFor(6, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我熟悉 SQL，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-G") }),
      ]),
    );
  });

  it("PG-H/PG-J reject strong overall-fit language for cautious", () => {
    const issues = issuesFor(7, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我的背景与岗位高度匹配，希望有机会进一步沟通",
      );
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("PG-H") }),
        expect.objectContaining({ message: expect.stringContaining("PG-J") }),
      ]),
    );
  });

  it("PG-J rejects overall match for not_recommended", () => {
    const issues = issuesFor(8, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "我能够胜任岗位，希望有机会进一步沟通",
      );
    });
    expect(issues.some((issue) => issue.message.includes("PG-J"))).toBe(true);
  });

  it("PG-I rejects unsupported waiver language", () => {
    const issues = issuesFor(7, (raw) => {
      raw.greeting = raw.greeting.replace(
        "希望有机会进一步沟通",
        "相信项目经验可以弥补学历，希望有机会进一步沟通",
      );
    });
    expect(issues.some((issue) => issue.message.includes("PG-I"))).toBe(true);
  });

  it("PG-K rejects unrelated Strength references", () => {
    const issues = issuesFor(0, (raw) => {
      raw.strengthRefs = ["ST-999"];
    });
    expect(issues.some((issue) => issue.message.includes("PG-K"))).toBe(true);
  });

  it("builds validated personalized and Phase 1 safe fallbacks", () => {
    const personalized = buildPersonalizedSafeFallback(
      GREETING_FIXTURES[3].request,
    );
    expect(personalized.personalizationStatus).toBe("personalized");
    expect(personalized.greeting).toContain("协助需求整理");
    expect(finalPersonalizedGreetingSchema.safeParse(personalized).success).toBe(
      true,
    );

    const phase1 = buildPhase1SafeFallback();
    expect(phase1).toMatchObject({
      personalizationStatus: "not_personalized",
      candidateFactRefs: [],
      matchRefs: [],
    });
  });

  it("PG-TC-12 has no eligible fact and requires Phase 1 fallback", () => {
    const fixture = GREETING_FIXTURES[11];
    expect(buildGreetingFactSelection(fixture.request)).toEqual([]);
    expect(fixture.validRaw).toBeNull();
  });
});
