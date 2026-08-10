import { describe, expect, it } from "vitest";

import {
  analyzeJobRequestSchema,
  findInvalidEvidence,
  findRequirementSectionContext,
  findSingleSubstitutionEvidenceSpan,
  hasHardQualifier,
  hasPreferredQualifier,
  jobAnalysisSchema,
  rawJobAnalysisSchema,
  recoverEvidenceFromJd,
} from "./analysis-schema";
import { sampleJd as jdText, validAnalysis } from "@/test/fixtures";

function analysisWithRequirement(
  requirement: (typeof validAnalysis.roleProfile.requirements)[number],
  question?: string,
) {
  const analysis = structuredClone(validAnalysis);
  analysis.roleProfile.requirements = [requirement];
  analysis.roleProfile.questionsToConfirm = question
    ? [{ question, reason: "限定词范围不清，需要确认。" }]
    : [];
  return analysis;
}

describe("analysis schema", () => {
  it("rejects objective JD transport corruption without rejecting unusual readable punctuation", () => {
    const readable = `岗位说明：${"职责、要求；待确认！？".repeat(12)}`;
    expect(analyzeJobRequestSchema.safeParse({ jdText: readable }).success).toBe(true);
    expect(
      analyzeJobRequestSchema.safeParse({ jdText: `${readable}\uFFFD` }).success,
    ).toBe(false);
    expect(
      analyzeJobRequestSchema.safeParse({ jdText: `${readable}\u0000` }).success,
    ).toBe(false);
  });
  it("accepts a valid Phase 1 analysis", () => {
    expect(jobAnalysisSchema.parse(validAnalysis)).toEqual(validAnalysis);
  });

  it("requires candidate advantages to remain null", () => {
    const result = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      candidateAdvantages: { items: [] },
    });
    expect(result.success).toBe(false);
  });

  it("requires candidateProfileProvided to remain false in Phase 1", () => {
    const result = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      candidateProfileProvided: true,
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["document ability", "您好，我具备优秀的文档能力，希望进一步了解该岗位。"],
    ["AI tools", "您好，我熟悉AI工具并长期使用大模型，希望进一步沟通。"],
    ["graduate status", "您好，我是应届生，对该岗位很感兴趣。"],
    ["major", "您好，我的专业是计算机，对该岗位很感兴趣。"],
  ])("rejects an unsupported candidate claim: %s", (_, safeGreeting) => {
    const result = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      hrGreeting: { ...validAnalysis.hrGreeting, safeGreeting },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a direct-send generic greeting without candidate facts", () => {
    expect(jobAnalysisSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it("rejects an implied candidate profile without a first-person keyword", () => {
    const result = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      hrGreeting: {
        ...validAnalysis.hrGreeting,
        safeGreeting: "您好，文档能力较强，对AI很有兴趣，希望进一步了解该岗位。",
      },
    });
    expect(result.success).toBe(false);
  });

  it("requires editable personal facts to remain approved placeholders", () => {
    const missingPlaceholder = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      hrGreeting: {
        ...validAnalysis.hrGreeting,
        editableGreetingTemplate:
          "您好，我对该岗位感兴趣。我具备优秀文档能力，希望进一步沟通。",
      },
    });
    const unknownPlaceholder = jobAnalysisSchema.safeParse({
      ...validAnalysis,
      hrGreeting: {
        ...validAnalysis.hrGreeting,
        editableGreetingTemplate: "您好，我是【计算机应届生】，希望进一步沟通。",
      },
    });
    expect(missingPlaceholder.success).toBe(false);
    expect(unknownPlaceholder.success).toBe(false);
  });

  it("requires at least 100 trimmed JD characters", () => {
    expect(analyzeJobRequestSchema.safeParse({ jdText: "过短的 JD" }).success).toBe(false);
    expect(analyzeJobRequestSchema.safeParse({ jdText }).success).toBe(true);
  });

  it("finds evidence that is not present in the JD", () => {
    expect(findInvalidEvidence(validAnalysis, jdText)).toEqual([]);
    const invalid = structuredClone(validAnalysis);
    invalid.coreResponsibilities[0].evidence = ["负责不存在的海外市场投放"];
    expect(findInvalidEvidence(invalid, jdText)).toEqual([
      "负责不存在的海外市场投放",
    ]);
  });

  it("keeps Raw AI Output separate from the strict Final Analysis Schema", () => {
    const emptyRiskEvidence = structuredClone(validAnalysis);
    emptyRiskEvidence.roleProfile.riskSignals = [
      {
        content: "从职责看，可能职责范围较宽",
        explanation: "需要确认实际工作重心。",
        sourceType: "inference",
        evidence: [],
        verificationQuestion: null,
      },
    ];
    expect(jobAnalysisSchema.safeParse(emptyRiskEvidence).success).toBe(false);
    expect(rawJobAnalysisSchema.safeParse(emptyRiskEvidence).success).toBe(true);

    const emptyCoreEvidence = structuredClone(validAnalysis);
    emptyCoreEvidence.coreResponsibilities[0].evidence = [];
    expect(rawJobAnalysisSchema.safeParse(emptyCoreEvidence).success).toBe(true);
    expect(jobAnalysisSchema.safeParse(emptyCoreEvidence).success).toBe(false);

    const overLimitEvidence = structuredClone(validAnalysis);
    overLimitEvidence.roleProfile.riskSignals = [
      {
        content: "从职责看，可能职责范围较宽",
        explanation: "需要确认实际工作重心。",
        sourceType: "inference",
        evidence: ["证据1", "证据2", "证据3", "证据4"],
        verificationQuestion: null,
      },
    ];
    expect(rawJobAnalysisSchema.safeParse(overLimitEvidence).success).toBe(true);
    expect(jobAnalysisSchema.safeParse(overLimitEvidence).success).toBe(false);
  });

  it("classifies 本科及以上 as a hard requirement, never preferred", () => {
    const hard = structuredClone(validAnalysis.roleProfile.requirements[0]);
    expect(jobAnalysisSchema.safeParse(analysisWithRequirement(hard)).success).toBe(true);
    hard.requirementType = "preferred_requirement";
    expect(jobAnalysisSchema.safeParse(analysisWithRequirement(hard)).success).toBe(false);
  });

  it("does not allow related internship experience without 优先 to be preferred", () => {
    const requirement = {
      content: "有相关实习经验",
      explanation: "JD直接提出相关经验要求。",
      requirementType: "preferred_requirement" as const,
      sourceType: "jd_explicit" as const,
      evidence: ["有相关实习经验"],
      verificationQuestion: null,
    };
    expect(jobAnalysisSchema.safeParse(analysisWithRequirement(requirement)).success).toBe(false);
    expect(
      jobAnalysisSchema.safeParse(
        analysisWithRequirement({ ...requirement, requirementType: "core_requirement" }),
      ).success,
    ).toBe(true);
  });

  it("requires 相关经历优先 to be preferred_requirement", () => {
    const preferred = {
      content: "相关经历优先",
      explanation: "原文包含明确优先限定。",
      requirementType: "preferred_requirement" as const,
      sourceType: "jd_explicit" as const,
      evidence: ["相关经历优先"],
      verificationQuestion: null,
    };
    expect(jobAnalysisSchema.safeParse(analysisWithRequirement(preferred)).success).toBe(true);
    expect(
      jobAnalysisSchema.safeParse(
        analysisWithRequirement({ ...preferred, requirementType: "core_requirement" }),
      ).success,
    ).toBe(false);
  });

  it("requires unclear qualifier scope to be unclear and to generate a question", () => {
    const question = "请确认计算机/设计/AI专业与后续能力要求之间的限定关系？";
    const unclear = {
      content: "专业不限，计算机/设计/AI具备优秀的逻辑思维和文档能力",
      explanation: "原文粘连，限定词范围不清。",
      requirementType: "unclear" as const,
      sourceType: "to_verify" as const,
      evidence: ["专业不限，计算机/设计/AI具备优秀的逻辑思维和文档能力"],
      verificationQuestion: question,
    };
    expect(
      jobAnalysisSchema.safeParse(analysisWithRequirement(unclear, question)).success,
    ).toBe(true);
    expect(
      jobAnalysisSchema.safeParse(
        analysisWithRequirement({
          ...unclear,
          requirementType: "core_requirement",
          sourceType: "jd_explicit",
          verificationQuestion: null,
        }),
      ).success,
    ).toBe(false);
  });

  it("requires a synthesized role judgment to be inference", () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.workCharacteristics = [
      {
        content: "从职责看，可能偏向产品助理型岗位",
        explanation: "由活动、协作等职责综合判断。",
        sourceType: "inference",
        evidence: ["负责活动策划、执行与复盘", "协同产品和设计团队"],
        verificationQuestion: null,
      },
    ];
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(true);
    analysis.roleProfile.workCharacteristics[0].sourceType = "jd_explicit";
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("does not treat evidence presence as proof that a conclusion is jd_explicit", () => {
    const analysis = structuredClone(validAnalysis);
    analysis.roleProfile.riskSignals = [
      {
        content: "岗位工作压力较大",
        explanation: "这是由多项职责推断的结论。",
        sourceType: "jd_explicit",
        evidence: ["负责活动策划、执行与复盘"],
        verificationQuestion: null,
      },
    ];
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("rejects unsupported deterministic growth claims", () => {
    const analysis = structuredClone(validAnalysis);
    analysis.applicationAdvice.summary = "能快速成长";
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("requires every to_verify conclusion to expose the same HR question", () => {
    const analysis = structuredClone(validAnalysis);
    const question = "请确认实际参与深度？";
    analysis.roleProfile.workCharacteristics = [
      {
        content: "实际参与深度需要确认",
        explanation: "JD没有说明独立负责范围。",
        sourceType: "to_verify",
        evidence: ["负责活动策划、执行与复盘"],
        verificationQuestion: question,
      },
    ];
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(false);
    analysis.roleProfile.questionsToConfirm = [
      { question, reason: "JD未说明独立负责范围。" },
    ];
    expect(jobAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});

describe("hasHardQualifier minimum work-year coverage", () => {
  it.each([
    ["3年以上相关工作经验", true],
    ["至少3年相关工作经验", true],
    ["至少有2年相关工作经验", true],
    ["3年及以上相关工作经验", true],
    ["1年及以上相关经验", true],
    ["有3年相关经验者优先", false],
    ["3年相关工作经验", false],
    ["有相关工作经验", false],
  ])("recognizes %s as hard qualifier = %s", (value, expected) => {
    expect(hasHardQualifier(value)).toBe(expected);
  });
});

describe("hasHardQualifier eligibility/age coverage (ISSUE-024)", () => {
  it.each([
    ["具有驾驶证", true],
    ["具备驾驶证", true],
    ["持有C1驾照", true],
    ["有驾驶证", true],
    ["需要驾驶证", true],
    ["须持有上岗证", true],
    ["40岁以下", true],
    ["年龄不超过40岁", true],
    ["年龄不低于22岁", true],
    ["年满18周岁", true],
    ["22岁以上", true],
    ["没有驾驶证", false],
    ["未持有驾驶证", false],
    ["不具备驾驶证", false],
    ["具备预测、计划制定及活动策划背景", false],
    ["有主人翁意识，能够对项目结果负责", false],
    ["能流利使用英语进行专业交流", false],
    ["抗压能力强，适应高频商务拜访", false],
    ["有相关工作经验", false],
  ])("recognizes %s as hard qualifier = %s", (value, expected) => {
    expect(hasHardQualifier(value)).toBe(expected);
  });
});

describe("hasPreferredQualifier explicit qualifier coverage", () => {
  it.each([
    ["有炸鸡、小吃、快餐等品类经验者尤佳", true],
    ["有相关经验者优先", true],
    ["有则更佳", true],
    ["相关经历优先", true],
    ["有相关工作经验", false],
  ])("recognizes %s as preferred qualifier = %s", (value, expected) => {
    expect(hasPreferredQualifier(value)).toBe(expected);
  });
});

describe("recoverEvidenceFromJd whitespace-normalized span recovery", () => {
  it("recovers the original JD span when evidence folds a line break inside a word", () => {
    const jd = "电子信息、自\n动化等相关专业优先";
    expect(recoverEvidenceFromJd("自动化等相关专业优先", jd)).toBe(
      "自\n动化等相关专业优先",
    );
  });

  it("recovers the original JD span for consecutive-space differences", () => {
    const jd = "负责  设备调试与维护";
    expect(recoverEvidenceFromJd("负责 设备调试与维护", jd)).toBe(
      "负责  设备调试与维护",
    );
  });

  it("returns null when the model corrected a JD typo (non-whitespace difference)", () => {
    const jd = "期间己获得或即将获得博士/硕士学位";
    expect(recoverEvidenceFromJd("期间已获得或即将获得博士/硕士学位", jd)).toBe(
      null,
    );
  });

  it("returns null when multiple normalized candidate spans exist", () => {
    const jd = "负责活动 策划；负责活动\n策划";
    expect(recoverEvidenceFromJd("负责活动策划", jd)).toBeNull();
  });

  it("returns the verbatim substring for exact evidence", () => {
    const jd = "负责活动策划、执行与复盘";
    expect(recoverEvidenceFromJd("负责活动策划、执行与复盘", jd)).toBe(
      "负责活动策划、执行与复盘",
    );
  });
});

describe("findSingleSubstitutionEvidenceSpan single-char remap (ISSUE-012A)", () => {
  it("returns the unique JD span for a single Unicode character substitution", () => {
    const jd = "根据企业的选址需求提供专业的选址方案及咨询服乐";
    expect(
      findSingleSubstitutionEvidenceSpan(
        "根据企业的选址需求提供专业的选址方案及咨询服务",
        jd,
      ),
    ).toBe("根据企业的选址需求提供专业的选址方案及咨询服乐");
  });

  it("returns null when multiple candidates exist at distance one", () => {
    const jd = "AC AD";
    expect(findSingleSubstitutionEvidenceSpan("AB", jd)).toBeNull();
  });

  it("returns null when two characters differ", () => {
    const jd = "提供专业的选址方案及咨询务服";
    expect(
      findSingleSubstitutionEvidenceSpan("提供专业的选址方案及咨询服务", jd),
    ).toBeNull();
  });

  it("returns null for insertion/deletion differences", () => {
    expect(findSingleSubstitutionEvidenceSpan("咨询服务X", "咨询服务")).toBeNull();
    expect(findSingleSubstitutionEvidenceSpan("咨询服务", "咨询服务X")).toBeNull();
  });

  it("returns null for exact evidence (handled earlier in the pipeline)", () => {
    expect(findSingleSubstitutionEvidenceSpan("咨询服务", "咨询服务")).toBeNull();
  });

  it("trims the evidence before matching", () => {
    expect(findSingleSubstitutionEvidenceSpan(" 咨询服务 ", "咨询服乐")).toBe(
      "咨询服乐",
    );
  });
});

describe("findRequirementSectionContext section-level preferred scope", () => {
  it("marks a requirement inside 加分项 as preferred with the section header", () => {
    const jd = "加分项：\n有uni-app跨端开发经验";
    const index = jd.indexOf("有uni-app跨端开发经验");
    expect(findRequirementSectionContext(jd, index)).toEqual({
      isPreferred: true,
      header: "加分项：",
    });
  });

  it.each([
    "加分条件：\n有相关经验",
    "优先条件：\n有相关经验",
    "优先项：\n有相关经验",
    "【加分项】\n有相关经验",
  ])("recognizes preferred section header: %s", (jd) => {
    const index = jd.indexOf("有相关经验");
    expect(findRequirementSectionContext(jd, index).isPreferred).toBe(true);
  });

  it("ends the preferred scope at the next known section title", () => {
    const jd = "加分项：\n有uni-app跨端开发经验\n任职要求：\n有相关实习经验";
    const index = jd.indexOf("有相关实习经验");
    expect(findRequirementSectionContext(jd, index)).toEqual({
      isPreferred: false,
      header: null,
    });
  });

  it("does not treat requirements before any section header as preferred", () => {
    const jd = "有相关实习经验\n任职要求：";
    expect(findRequirementSectionContext(jd, 0).isPreferred).toBe(false);
  });
});
