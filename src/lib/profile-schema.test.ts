import { describe, expect, it } from "vitest";

import {
  buildProfileEvidenceLedger,
  findSemanticUpgradeViolations,
  finalProfileStructureSchema,
  hasFactTraceability,
  hasHighTraceability,
  resolveEvidenceToPf,
} from "./profile-schema";

describe("buildProfileEvidenceLedger", () => {
  it("assigns stable sequential PF ids per non-empty line and dedupes", () => {
    const raw = "教育背景：计算机本科\n\n技能：了解 Python\n技能：了解 Python\n实习：某公司运营实习生";
    const ledger = buildProfileEvidenceLedger(raw);
    expect(ledger).toEqual([
      { id: "PF-001", text: "教育背景：计算机本科" },
      { id: "PF-002", text: "技能：了解 Python" },
      { id: "PF-003", text: "实习：某公司运营实习生" },
    ]);
  });
});

describe("resolveEvidenceToPf", () => {
  const raw = "技能：了解 Python，熟悉 Excel\n项目：参与团队推荐系统课程项目";
  const ledger = buildProfileEvidenceLedger(raw);

  it("accepts an existing PF id", () => {
    expect(resolveEvidenceToPf("PF-002", raw, ledger)).toBe("PF-002");
  });

  it("rejects an unknown PF id", () => {
    expect(resolveEvidenceToPf("PF-099", raw, ledger)).toBeNull();
  });

  it("maps verbatim raw text to its containing PF", () => {
    expect(resolveEvidenceToPf("了解 Python", raw, ledger)).toBe("PF-001");
  });

  it("supports whitespace-normalized unique spans", () => {
    expect(resolveEvidenceToPf("了解 Python，熟悉\nExcel", raw, ledger)).toBe(
      "PF-001",
    );
  });

  it("returns null for semantically similar but non-verbatim text", () => {
    expect(resolveEvidenceToPf("熟悉 Python", raw, ledger)).toBeNull();
  });
});

describe("findSemanticUpgradeViolations", () => {
  it("flags degree upgrades unsupported by raw text", () => {
    expect(
      findSemanticUpgradeViolations("Python：熟练", ["技能：了解 Python"]),
    ).toEqual(expect.arrayContaining(["熟练|精通"]));
  });

  it("flags course-project promoted to work experience", () => {
    expect(
      findSemanticUpgradeViolations("正式工作经验：推荐系统", [
        "参与团队推荐系统课程项目",
      ]),
    ).toEqual(expect.arrayContaining(["正式工作|全职"]));
  });

  it("allows degree words when raw supports them", () => {
    expect(
      findSemanticUpgradeViolations("Python：熟练", ["日常使用 Python 进行数据分析"]),
    ).toEqual([]);
  });

  it("allows plain statements without upgrades", () => {
    expect(
      findSemanticUpgradeViolations("Python：了解", ["技能：了解 Python"]),
    ).toEqual([]);
  });
});

describe("hasFactTraceability", () => {
  it("returns true when a fact shares a meaningful token with its PF", () => {
    expect(hasFactTraceability("Python：了解", ["技能：了解 Python，熟悉 Excel"])).toBe(
      true,
    );
  });

  it("returns false when a fact has no raw support (hallucination guard)", () => {
    expect(hasFactTraceability("掌握 SQL", ["技能：了解 Python"])).toBe(false);
  });

  it("returns true for near-verbatim minimal normalization", () => {
    expect(
      hasHighTraceability(
        "团队项目「校园二手平台」获得校赛三等奖，我负责用户调研部分",
        ["项目：团队项目「校园二手平台」获得校赛三等奖，我负责用户调研部分"],
      ),
    ).toBe(true);
  });

  it("returns false for a heavy paraphrase", () => {
    expect(
      hasHighTraceability("我有数据分析能力", [
        "参与团队推荐系统课程项目，负责数据分析",
      ]),
    ).toBe(false);
  });
});

describe("finalProfileStructureSchema", () => {
  it("accepts a valid structured profile", () => {
    const profile = {
      schemaVersion: "candidate-profile-v1",
      profileProvided: true,
      candidateProfile: {
        careerTarget: null,
        education: [
          {
            value: "计算机本科",
            sourceType: "normalized_stated",
            pfEvidence: ["PF-001"],
            verificationQuestion: null,
          },
        ],
        experiences: [],
        projects: [],
        skills: [
          {
            value: "Python：了解",
            sourceType: "normalized_stated",
            pfEvidence: ["PF-002"],
            verificationQuestion: null,
          },
        ],
        certificates: [],
        portfolio: [],
        preferences: [],
        derivedObservations: [],
        unknowns: ["期望城市未说明"],
        questionsToConfirm: [],
        evidence: [
          { id: "PF-001", text: "计算机本科" },
          { id: "PF-002", text: "技能：了解 Python" },
        ],
      },
    };
    expect(finalProfileStructureSchema.safeParse(profile).success).toBe(true);
  });

  it("rejects profile_inferred inside candidate facts", () => {
    const profile = {
      schemaVersion: "candidate-profile-v1",
      profileProvided: true,
      candidateProfile: {
        careerTarget: null,
        education: [],
        experiences: [],
        projects: [],
        skills: [
          {
            value: "可能具备 Python 开发能力",
            sourceType: "profile_inferred",
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
        evidence: [{ id: "PF-001", text: "技能：了解 Python" }],
      },
    };
    expect(finalProfileStructureSchema.safeParse(profile).success).toBe(false);
  });
});
