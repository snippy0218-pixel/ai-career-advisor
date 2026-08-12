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

  const unsupportedWorkFact = [
    {
      factId: "CF-003",
      statement: "与四人团队共同完成数据展示作业，我协助整理需求和测试",
    },
  ];

  it("M36-1 treats 仅参与部分工作 as a generic work noun", () => {
    expect(
      findCrossFactModifierContamination("候选人仅参与部分工作。", unsupportedWorkFact),
    ).toEqual([]);
  });

  it("M36-2 treats 测试工作 as a generic task phrase", () => {
    expect(
      findCrossFactModifierContamination("候选人协助完成测试工作。", unsupportedWorkFact),
    ).toEqual([]);
  });

  it("M36-3 treats 需求整理工作 as a generic task phrase", () => {
    expect(
      findCrossFactModifierContamination("候选人负责需求整理工作。", unsupportedWorkFact),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "experience_type", value: "工作" }),
      ]),
    );
  });

  it("M36-4 preserves 在工作中 as an employment-context qualifier", () => {
    expect(
      findCrossFactModifierContamination("候选人在工作中使用 Python。", [
        { factId: "CF-001", statement: "使用 Python" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "工作",
          unsupportedFactIds: ["CF-001"],
        }),
      ]),
    );
  });

  it("M36-5 preserves 正式工作 as an employment-type qualifier", () => {
    expect(
      findCrossFactModifierContamination("候选人具有正式工作经历。", [
        { factId: "CF-001", statement: "具有相关经历" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "正式工作",
          unsupportedFactIds: ["CF-001"],
        }),
      ]),
    );
  });

  it("M36-6 preserves full-time employment and duration qualifiers", () => {
    const result = findCrossFactModifierContamination("候选人有两年全职工作经验。", [
      { factId: "CF-001", statement: "具有相关经验" },
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "duration", value: "两年" }),
        expect.objectContaining({ category: "experience_type", value: "全职" }),
      ]),
    );
  });

  it("M36-7 preserves internship work scope", () => {
    expect(
      findCrossFactModifierContamination("候选人在实习工作中使用 SQL。", [
        { factId: "CF-001", statement: "使用 SQL" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "实习",
          unsupportedFactIds: ["CF-001"],
        }),
      ]),
    );
  });

  it("M36-8 accepts the exact current generic-work reason", () => {
    expect(
      findCrossFactModifierContamination(
        "候选人在团队项目中协助整理需求和测试，未表明主导角色，仅参与部分工作。",
        unsupportedWorkFact,
      ),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "experience_type", value: "工作" }),
      ]),
    );
  });

  it("M36-9 still rejects formal-work propagation", () => {
    expect(
      findCrossFactModifierContamination("候选人在正式工作中完成数据展示。", [
        { factId: "CF-003", statement: "完成数据展示作业" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "正式工作",
          unsupportedFactIds: ["CF-003"],
        }),
      ]),
    );
  });

  it("M36-10 still rejects 在工作中 propagation", () => {
    expect(
      findCrossFactModifierContamination("候选人在工作中完成数据展示。", [
        { factId: "CF-003", statement: "完成数据展示作业" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "工作",
          unsupportedFactIds: ["CF-003"],
        }),
      ]),
    );
  });

  it("M36-11 preserves the frozen fail-closed behavior for 工作项目", () => {
    expect(
      findCrossFactModifierContamination("候选人完成了工作项目。", [
        { factId: "CF-003", statement: "完成个人项目" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "工作",
          unsupportedFactIds: ["CF-003"],
        }),
      ]),
    );
  });

  it("M36-12 applies employment ownership only to the explicit employment phrase", () => {
    const result = findCrossFactModifierContamination(
      "候选人协助测试工作，并在正式工作中使用 SQL。",
      [{ factId: "CF-001", statement: "协助测试并使用 SQL" }],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "experience_type",
          value: "正式工作",
          unsupportedFactIds: ["CF-001"],
        }),
      ]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "experience_type", value: "测试工作" }),
      ]),
    );
  });

  it("M37-1 ignores a requirement qualifier inside an evidence-force boundary", () => {
    expect(
      findCrossFactModifierContamination(
        "CF-002 表明在课程中了解 Python 基础语法，不足以构成熟练掌握的正证。",
        [
          {
            factId: "CF-002",
            statement: "课程项目：在课程中了解 Python 基础语法",
          },
        ],
      ),
    ).toEqual([]);
  });

  it("M37-2 still rejects an asserted proficiency upgrade", () => {
    expect(
      findCrossFactModifierContamination("CF-002 表明候选人熟练掌握 Python。", [
        {
          factId: "CF-002",
          statement: "课程项目：在课程中了解 Python 基础语法",
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "proficiency",
          value: "熟练掌握",
          unsupportedFactIds: ["CF-002"],
        }),
      ]),
    );
  });
});
