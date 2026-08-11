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

function issue030MatchCore(
  reason = "候选人在课程中了解 Python 基础语法，但未表明达到熟练程度。",
) {
  const matchCore = structuredClone(STRENGTH_GAP_FIXTURES[1].matchCore);
  const item = matchCore.matchItems[0];
  const dimension = item.requirementDimensions[0];
  item.requirement = "熟练掌握 Python";
  item.jdEvidence = ["熟练掌握 Python"];
  dimension.requirementFragment = "熟练掌握 Python";
  dimension.reason = reason;
  dimension.jdEvidence = ["熟练掌握 Python"];
  return matchCore;
}

function validateIssue030Statement(
  statement: string,
  matchCore = issue030MatchCore(),
) {
  return finalizeRawStrengthGap(
    {
      strengths: [],
      gaps: [
        {
          type: "evidence_expression",
          statement,
          matchRefs: ["MI-001"],
          suggestedAction:
            "如果候选人确实有实际项目中使用 Python 的经历，可补充相关事实以证明熟练程度。",
          actionType: "evidence",
        },
      ],
    },
    matchCore,
  );
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

  it("SG-N rejects unsupported modifiers in a Strength statement", () => {
    const fixture = STRENGTH_GAP_FIXTURES.find((item) => item.validRaw.strengths.length > 0)!;
    const raw = structuredClone(fixture.validRaw);
    raw.strengths[0].statement += "，可频繁承担相关任务";
    const result = finalizeRawStrengthGap(raw, fixture.matchCore);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-N unsupported modifier upgrade") }),
      ]),
    );
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

  describe("ISSUE-030 bounded evidence-expression structure", () => {
    it("T1 accepts the original RB-05 sentence", () => {
      const result = validateIssue030Statement(
        "现有证据只能表明候选人在课程中了解 Python 基础语法，尚不足以证明其熟练掌握 Python。",
      );
      expect(result.issues).toEqual([]);
      expect(result.data).not.toBeNull();
    });

    it("T2 accepts a supported positive clause longer than the former fixed window", () => {
      const positiveClause =
        "候选人在课程中了解 Python 基础语法并能说明变量、条件判断与循环的基本概念";
      expect([...positiveClause].length).toBeGreaterThan(20);
      const result = validateIssue030Statement(
        `现有证据只能表明${positiveClause}，尚不足以证明其熟练掌握 Python。`,
        issue030MatchCore(`${positiveClause}，但未表明达到熟练程度。`),
      );
      expect(result.issues).toEqual([]);
    });

    it("T3 accepts 当前证据 followed by 不足以证明", () => {
      const result = validateIssue030Statement(
        "当前证据表明候选人在课程中了解 Python 基础语法，不足以证明其熟练掌握 Python。",
      );
      expect(result.issues).toEqual([]);
    });

    it("T4 accepts 现有经历 followed by 未能完整证明", () => {
      const result = validateIssue030Statement(
        "现有经历只能证明候选人在课程中了解 Python 基础语法，未能完整证明其熟练掌握 Python。",
      );
      expect(result.issues).toEqual([]);
    });

    it("T5 rejects an evidence_expression without an insufficiency boundary", () => {
      const result = validateIssue030Statement(
        "现有证据表明候选人在课程中了解 Python 基础语法。",
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("SG-E") }),
        ]),
      );
    });

    it("T6 rejects an insufficiency boundary without an evidence anchor", () => {
      const result = validateIssue030Statement(
        "尚不足以证明其熟练掌握 Python。",
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("SG-E") }),
        ]),
      );
    });

    it("T7 rejects an anchor and unrelated boundary split across sentences", () => {
      const result = validateIssue030Statement(
        "现有证据表明候选人了解 Python。另一个岗位条件尚不足以确认。",
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("SG-E") }),
        ]),
      );
    });

    it("T8 does not let a later boundary excuse a preceding Candidate upgrade", () => {
      const result = validateIssue030Statement(
        "候选人熟练掌握 Python，现有证据只能表明候选人在课程中了解 Python 基础语法，尚不足以证明其熟练掌握 Python。",
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("SG-E") }),
        ]),
      );
    });

    it("T9 preserves the previously accepted compact short form", () => {
      const result = finalizeRawStrengthGap(
        {
          ...STRENGTH_GAP_FIXTURES[1].validRaw,
          gaps: [
            {
              ...STRENGTH_GAP_FIXTURES[1].validRaw.gaps[0],
              statement:
                "现有需求拆解经历尚不足以证明完整覆盖产品需求分析职责。",
            },
          ],
        },
        STRENGTH_GAP_FIXTURES[1].matchCore,
      );
      expect(result.issues).toEqual([]);
    });

    it("T10 rejects unrelated keyword coincidence", () => {
      const result = validateIssue030Statement(
        "现有证据已经归档，预算尚不足以确认采购计划。",
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("SG-E") }),
        ]),
      );
    });
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

  it("allows a transferable Strength to name the JD target without claiming it as Candidate fact", () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            type: "transferable_strength",
            statement: "协助需求整理的经历，对独立负责完整需求流程具有一定可迁移性。",
            matchRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("does not require a course qualifier when the same Match reason has independent daily-use evidence", () => {
    const fixture = STRENGTH_GAP_FIXTURES[0];
    const matchCore = structuredClone(fixture.matchCore);
    matchCore.matchItems[0].requirementDimensions[0].reason =
      "候选人在课程项目中使用 SQL，且日常使用 SQL，正向证据充分。";
    const result = finalizeRawStrengthGap(
      {
        strengths: [
          {
            type: "direct_match",
            statement: "候选人能使用 SQL，满足该要求。",
            matchRefs: ["MI-001"],
          },
        ],
        gaps: [],
      },
      matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("Case B accepts bounded support for a JD target requirement", () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            type: "transferable_strength",
            statement: "候选人在需求整理方面的协助经验可迁移至需求流程相关工作，部分支持独立负责完整需求流程的要求。",
            matchRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it.each([
    ["ownership", "候选人已独立负责完整需求流程，并具有可迁移性。"],
    ["proficiency", "候选人精通需求分析，并具有可迁移性。"],
    ["employment", "候选人拥有正式工作经验，并具有可迁移性。"],
    ["context", "候选人的需求整理经验可迁移至该岗位职责。"],
  ])("SG-M rejects %s boundary upgrades", (_dimension, statement) => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            type: "transferable_strength",
            statement,
            matchRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("SG-M") }),
      ]),
    );
  });

  it("accepts natural but still bounded transferable relationship language", () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            type: "transferable_strength",
            statement: "协助需求整理的经历可为该岗位职责提供基础支持和参考价值。",
            matchRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("does not treat a negated upstream target mention as support for a Candidate upgrade", () => {
    const fixture = STRENGTH_GAP_FIXTURES[6];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        strengths: [
          {
            type: "transferable_strength",
            statement: "你已具备独立负责完整需求流程的能力，并具有可迁移性。",
            matchRefs: ["MI-001"],
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringMatching(/SG-B|SG-D/) }),
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

  it("accepts either natural word order for structural gate confirmation", () => {
    const fixture = STRENGTH_GAP_FIXTURES[7];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            suggestedAction: "该正式工作经验条件属于当前明确门槛，投递前向招聘方确认具体执行口径。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("accepts bounded confirmation of a hard requirement's execution", () => {
    const fixture = STRENGTH_GAP_FIXTURES[7];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            suggestedAction: "投递前向招聘方核实该正式工作经验要求的具体执行方式。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("allows a structural action to state that a hard gate cannot be fixed short-term", () => {
    const fixture = STRENGTH_GAP_FIXTURES[7];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            suggestedAction: "该条件属于明确门槛，无法通过短期积累经历弥补；投递前应确认具体执行口径。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual([]);
  });

  it("rejects structural actions that propose manufacturing a short-term fix", () => {
    const fixture = STRENGTH_GAP_FIXTURES[7];
    const result = finalizeRawStrengthGap(
      {
        ...fixture.validRaw,
        gaps: [
          {
            ...fixture.validRaw.gaps[0],
            suggestedAction: "确认该条件是否属于严格门槛，并通过积累经历弥补。",
          },
        ],
      },
      fixture.matchCore,
    );
    expect(result.issues).toEqual(
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
