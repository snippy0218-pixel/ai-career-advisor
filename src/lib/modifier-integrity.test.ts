import { describe, expect, it } from "vitest";

import {
  findCrossFactModifierContamination,
  findUnsupportedModifiers,
  stripUnsupportedModifiers,
} from "./modifier-integrity";

describe("Modifier Inference Contract", () => {
  it("rejects a frequency upgrade that is absent from evidence", () => {
    expect(
      findUnsupportedModifiers("可能需要频繁拜访客户", ["拜访客户"]),
    ).toEqual([{ category: "frequency", value: "频繁" }]);
  });

  it("allows an explicitly supported modifier", () => {
    expect(
      findUnsupportedModifiers("需要频繁拜访客户", ["需要频繁拜访客户"]),
    ).toEqual([]);
  });

  it("removes only unsupported modifiers without inventing replacement facts", () => {
    expect(
      stripUnsupportedModifiers("可能需要频繁拜访多个客户", ["拜访客户"]),
    ).toBe("可能需要拜访客户");
  });

  it("keeps qualifier ownership isolated to every cited Candidate Fact", () => {
    expect(
      findCrossFactModifierContamination("候选人在课程项目中完成 Y。", [
        { factId: "CF-002", statement: "完成 Y 项目" },
      ]),
    ).toEqual([
      {
        category: "experience_type",
        value: "课程",
        supportedFactIds: [],
        unsupportedFactIds: ["CF-002"],
      },
    ]);
  });

  it("preserves a modifier supported by the same Candidate Fact", () => {
    expect(
      findCrossFactModifierContamination(
        "在课程项目中使用 Python 完成数据分析",
        [
          {
            factId: "CF-001",
            statement: "在课程项目中使用 Python 完成数据分析",
          },
        ],
      ),
    ).toEqual([]);
  });

  it("does not let an earlier negated clause suppress a later qualifier claim", () => {
    expect(
      findCrossFactModifierContamination(
        "候选人参与团队项目，但未体现主导角色，且项目为课程作业。",
        [{ factId: "CF-003", statement: "参与团队项目" }],
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "课程",
          unsupportedFactIds: ["CF-003"],
        }),
      ]),
    );
  });

  it("distinguishes an asserted missing-info qualifier from a target qualifier", () => {
    const facts = [{ factId: "CF-003", statement: "参与团队项目" }];
    expect(
      findCrossFactModifierContamination("且项目为课程作业", facts, {
        assertedOnly: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "课程" }),
      ]),
    );
    expect(
      findCrossFactModifierContamination("达到熟练程度的实际使用深度", facts, {
        assertedOnly: true,
      }),
    ).toEqual([]);
  });

  it("does not treat a compared JD requirement phrase as a Candidate claim", () => {
    expect(
      findCrossFactModifierContamination(
        "候选人明确表示没有正式数据产品工作经历，与正式工作经验要求不符。",
        [
          {
            factId: "CF-004",
            statement: "没有正式数据产品工作经历",
          },
        ],
      ),
    ).toEqual([]);
  });
});
