import type { JobAnalysis } from "@/lib/analysis-schema";

export const sampleJd = `${"产品运营岗位，负责活动策划、执行与复盘，协同产品和设计团队推进活动上线。".repeat(4)}本科及以上学历，会使用SQL者优先。`;

export const validAnalysis: JobAnalysis = {
  schemaVersion: "analysis-v1",
  candidateProfileProvided: false,
  basicInfo: {
    jobTitle: "产品运营",
    companyName: null,
    location: null,
    employmentType: null,
    salaryRange: null,
    experienceRequirement: null,
    educationRequirement: "本科及以上学历",
    summary: "从JD信息看，可能是负责活动运营与跨团队协作的初级岗位。",
    summarySourceType: "inference",
  },
  coreResponsibilities: [
    {
      title: "活动运营",
      description: "负责活动策划、执行和效果复盘。",
      sourceType: "jd_explicit",
      evidence: ["负责活动策划、执行与复盘"],
    },
  ],
  roleProfile: {
    requirements: [
      {
        content: "本科及以上学历",
        explanation: "JD包含明确限制条件，归为硬性要求。",
        requirementType: "hard_requirement",
        sourceType: "jd_explicit",
        evidence: ["本科及以上学历"],
        verificationQuestion: null,
      },
      {
        content: "会使用SQL者优先",
        explanation: "JD包含明确的优先或加分限定词，归为偏好要求。",
        requirementType: "preferred_requirement",
        sourceType: "jd_explicit",
        evidence: ["会使用SQL者优先"],
        verificationQuestion: null,
      },
    ],
    workCharacteristics: [],
    riskSignals: [],
    unknowns: ["没有说明汇报对象"],
    questionsToConfirm: [],
  },
  applicationAdvice: {
    level: "worth_exploring",
    summary: "从JD信息看，岗位职责较明确，可以进一步了解。",
    sourceType: "inference",
    verificationQuestion: null,
    reasons: [
      {
        content: "从职责看，可能较容易确认日常工作范围",
        sourceType: "inference",
        evidence: ["负责活动策划、执行与复盘"],
        verificationQuestion: null,
      },
    ],
    limitations: "建议仅基于 JD，不包含个人经历或公司外部信息。",
  },
  candidateAdvantages: null,
  hrGreeting: {
    personalizationStatus: "not_personalized",
    personalizationNotice:
      "未提供个人资料，以下内容仅为通用沟通话术，不代表个人匹配结论。",
    safeGreeting:
      "您好，我关注到贵司的产品运营岗位，希望进一步了解具体工作重点，期待与您沟通。",
    editableGreetingTemplate:
      "您好，我对贵司的产品运营岗位很感兴趣。我是【学历/专业】，具备【真实相关技能】，有【真实项目或实习经历】。希望进一步沟通。",
  },
};
