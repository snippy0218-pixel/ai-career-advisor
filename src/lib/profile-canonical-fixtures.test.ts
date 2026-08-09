import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PROFILE_SEMANTIC_TAGS } from "./profile-schema";

interface FrozenCase {
  id: string;
  sha256: string;
  characters: number;
  input: {
    lines?: string[];
    prefixLines?: string[];
    repeatedLine?: string;
    repeatCount?: number;
  };
  expectedFacts: Array<{
    category: string;
    terms: string[];
    expectedSemanticTags: string[];
  }>;
}

function materializeInput(input: FrozenCase["input"]) {
  if (input.lines) return input.lines.join("\n");
  return [
    ...(input.prefixLines ?? []),
    ...Array.from(
      { length: input.repeatCount ?? 0 },
      () => input.repeatedLine ?? "",
    ),
  ].join("\n");
}

describe("Phase 2.1 frozen canonical-fact fixtures", () => {
  const frozen = JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "docs/acceptance-artifacts/phase-2-1/frozen-cases.json",
      ),
      "utf8",
    ),
  ) as { schemaVersion: string; cases: FrozenCase[] };

  it("keeps all eight frozen inputs byte-stable", () => {
    expect(frozen.schemaVersion).toBe("phase-2-1-frozen-cases-v2");
    expect(frozen.cases).toHaveLength(8);
    for (const testCase of frozen.cases) {
      const input = materializeInput(testCase.input);
      expect(input).toHaveLength(testCase.characters);
      expect(createHash("sha256").update(input, "utf8").digest("hex")).toBe(
        testCase.sha256,
      );
    }
  });

  it("adds explicit PF-I tags without deleting any expected semantic facts", () => {
    const facts = frozen.cases.flatMap((testCase) => testCase.expectedFacts);
    expect(facts).toHaveLength(38);
    expect(
      facts.reduce(
        (total, fact) => total + fact.expectedSemanticTags.length,
        0,
      ),
    ).toBe(39);
    for (const fact of facts) {
      expect(fact.terms.length).toBeGreaterThan(0);
      expect(fact.expectedSemanticTags.length).toBeGreaterThan(0);
      expect(
        fact.expectedSemanticTags.every((tag) =>
          (PROFILE_SEMANTIC_TAGS as readonly string[]).includes(tag),
        ),
      ).toBe(true);
    }
  });

  it("makes the TC04 course-tool expectation explicitly multi-tag", () => {
    const tc04 = frozen.cases.find((testCase) => testCase.id === "PF-TC-04")!;
    const courseTool = tc04.expectedFacts.find(
      (fact) => fact.terms.includes("Python") && fact.terms.includes("课程作业"),
    )!;
    expect(courseTool.expectedSemanticTags).toEqual([
      "project_experience",
      "skill_usage",
    ]);
  });
});
