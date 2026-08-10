import { describe, expect, it } from "vitest";

import {
  finalStrengthGapSchema,
  finalizeRawStrengthGap,
  rawStrengthGapSchema,
} from "./strength-gap-schema";
import { STRENGTH_GAP_FIXTURES } from "@/test/strength-gap-fixtures";

function validateFixture(index: number) {
  const fixture = STRENGTH_GAP_FIXTURES[index];
  return finalizeRawStrengthGap(fixture.validRaw, fixture.matchCore);
}

describe("finalizeRawStrengthGap", () => {
  it("accepts all twelve authorized scenarios and assigns stable server IDs", () => {
    for (const fixture of STRENGTH_GAP_FIXTURES) {
      const result = finalizeRawStrengthGap(fixture.validRaw, fixture.matchCore);
      expect(result.issues, fixture.id).toEqual([]);
      expect(result.data, fixture.id).not.toBeNull();
      expect(finalStrengthGapSchema.safeParse(result.data).success, fixture.id).toBe(true);
      expect(result.data?.strengths.map((entry) => entry.strengthId)).toEqual(
        fixture.validRaw.strengths.map((_, index) =>
          `ST-${String(index + 1).padStart(3, "0")}`,
        ),
      );
      expect(result.data?.gaps.map((entry) => entry.gapId)).toEqual(
        fixture.validRaw.gaps.map((_, index) =>
          `GP-${String(index + 1).padStart(3, "0")}`,
        ),
      );
    }
  });

  it("SG-A rejects omission and ineligible Strength evidence", () => {
    const fixture = STRENGTH_GAP_FIXTURES[0];
    const omitted = finalizeRawStrengthGap(
      { ...fixture.validRaw, strengths: [] },
      fixture.matchCore,
    );
    expect(omitted.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-A") }),
      ]),
    );

    const partialFixture = STRENGTH_GAP_FIXTURES[1];
    const wrongType = finalizeRawStrengthGap(
      {
        ...partialFixture.validRaw,
        strengths: [
          {
            ...partialFixture.validRaw.strengths[0],
            type: "direct_match",
          },
        ],
      },
      partialFixture.matchCore,
    );
    expect(wrongType.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-C") }),
      ]),
    );
  });

  it("SG-B preserves Candidate evidence scope and rejects claim upgrades", () => {
    const fixture = STRENGTH_GAP_FIXTURES[8];
    const upgraded = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            ...fixture.validRaw.strengths[0],
            statement: "你已独立负责成熟的 Python 数据处理项目。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(upgraded.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-B") }),
      ]),
    );
  });

  it("applies evidence-boundary rules without forcing Candidate scope words into a Gap", () => {
    const fixture = STRENGTH_GAP_FIXTURES[1];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            statement: "现有需求拆解经历尚不足以证明完整覆盖产品需求分析职责。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
  });

  it("SG-D rejects a transferable Strength presented as a mature match", () => {
    const fixture = STRENGTH_GAP_FIXTURES[1];
    const invalid = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            ...fixture.validRaw.strengths[0],
            statement: "你已成熟地独立负责产品需求分析。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-D") }),
      ]),
    );
  });

  it("SG-E/SG-F keep unknown separate from learnable deficiency", () => {
    const fixture = STRENGTH_GAP_FIXTURES[4];
    const invalid = finalizeRawStrengthGap(
      {
        strengths: [],
        gaps: [
          {
            type: "learnable_skill",
            statement: "你缺少 SQL 能力，需要学习 SQL。",
            matchRefs: ["MI-001"],
            suggestedAction: "学习 SQL。",
            actionType: "learn",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringMatching(/SG-E|SG-F/) }),
      ]),
    );
  });

  it("SG-G rejects hard constraints without hard unmet counter-evidence", () => {
    const fixture = STRENGTH_GAP_FIXTURES[4];
    const invalid = finalizeRawStrengthGap(
      {
        strengths: [],
        gaps: [
          {
            type: "hard_constraint",
            statement: "SQL 条件未满足。",
            matchRefs: ["MI-001"],
            suggestedAction: "确认该条件是否属于严格门槛。",
            actionType: "structural",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-G") }),
      ]),
    );
  });

  it("SG-H rejects unbounded time promises and mismatched actions", () => {
    const fixture = STRENGTH_GAP_FIXTURES[5];
    const invalid = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            suggestedAction: "七天学会并掌握 Python，达到岗位要求。",
            actionType: "confirm",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-H") }),
      ]),
    );
  });

  it("SG-I rejects references outside the immutable Match ledger", () => {
    const fixture = STRENGTH_GAP_FIXTURES[0];
    const invalid = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          { ...fixture.validRaw.strengths[0], matchRefs: ["MI-999"] },
        ],
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-I") }),
      ]),
    );
  });

  it("SG-J rejects instruction-like text promoted into a Candidate fact", () => {
    const fixture = STRENGTH_GAP_FIXTURES[9];
    const invalid = finalizeRawStrengthGap(
      {
        strengths: [
          {
            type: "direct_match",
            statement: "候选人拥有五年数据分析经验。",
            matchRefs: ["MI-001"],
          },
        ],
        gaps: fixture.validRaw.gaps,
      },
      fixture.matchCore,
    );
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-J") }),
      ]),
    );
  });

  it("SG-L rejects extra public fields while allowing an empty Strength list", () => {
    expect(validateFixture(11).data?.strengths).toEqual([]);
    expect(
      rawStrengthGapSchema.safeParse({
        ...STRENGTH_GAP_FIXTURES[11].validRaw,
        severity: "high",
      }).success,
    ).toBe(false);
    expect(
      finalStrengthGapSchema.safeParse({
        ...validateFixture(11).data,
        recommendation: "apply",
      }).success,
    ).toBe(false);
  });
});
