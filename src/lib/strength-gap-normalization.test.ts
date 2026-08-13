import { describe, expect, it } from "vitest";

import { normalizeRejectedTransferableStrengths } from "./strength-gap-normalization";
import type { RawStrengthGap } from "./strength-gap-schema";
import type { FinalMatchCore } from "./match-schema";

const raw: RawStrengthGap = {
  strengths: [
    {
      type: "direct_match",
      statement: "本科学历满足要求。",
      matchRefs: ["MI-004"],
    },
    {
      type: "transferable_strength",
      statement:
        "在团队作业中协助整理需求和测试，可迁移至跨团队项目协作，部分支持主导跨团队项目的要求。",
      matchRefs: ["MI-003"],
    },
  ],
  gaps: [
    {
      type: "information",
      statement: "资料缺少是否主导跨团队项目的信息。",
      matchRefs: ["MI-003"],
      suggestedAction: "请补充真实职责。",
      actionType: "confirm",
    },
  ],
};

describe("normalizeRejectedTransferableStrengths", () => {
  it("removes only an optional transferable strength rejected by SG-B/SG-M", () => {
    const result = normalizeRejectedTransferableStrengths(raw, [
      { path: "strengths.1", message: "SG-M transferable relation boundary integrity failed" },
      {
        path: "strengths.1.statement",
        message: "SG-B Candidate scope/modifier from Match evidence must be preserved",
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.data.strengths).toEqual([raw.strengths[0]]);
    expect(result.data.gaps).toEqual(raw.gaps);
    expect(result.actions).toEqual([
      expect.objectContaining({
        strengthIndex: 1,
        issueCodes: ["SG-B", "SG-M"],
        removedMatchRefs: ["MI-003"],
      }),
    ]);
    expect(raw.strengths).toHaveLength(2);
  });

  it("does not remove mandatory direct or supporting strengths", () => {
    const result = normalizeRejectedTransferableStrengths(raw, [
      { path: "strengths.0.statement", message: "SG-B Candidate claim upgrade" },
    ]);
    expect(result).toMatchObject({ applied: false, actions: [] });
    expect(result.data).toEqual(raw);
  });

  it("does not normalize schema, reference, gap, or unrelated semantic failures", () => {
    const result = normalizeRejectedTransferableStrengths(raw, [
      { path: "strengths.1.matchRefs", message: "SG-I unknown Match reference" },
      { path: "gaps.0.statement", message: "SG-B Candidate claim upgrade" },
    ]);
    expect(result.applied).toBe(false);
  });

  it("keeps the first schema-valid gap when the model repeats a type/reference key", () => {
    const input = structuredClone(raw);
    input.gaps.push({
      ...input.gaps[0],
      statement: "资料还缺少该项职责范围。",
      suggestedAction: "请补充职责范围。",
    });
    const result = normalizeRejectedTransferableStrengths(input, [
      { path: "gaps", message: "duplicate Gap type/reference entry" },
    ]);
    expect(result.applied).toBe(true);
    expect(result.data.gaps).toEqual([input.gaps[0]]);
    expect(result.actions).toEqual([
      expect.objectContaining({
        gapIndex: 1,
        issueCodes: ["SG-DUPLICATE-GAP"],
        removedMatchRefs: ["MI-003"],
      }),
    ]);
  });

  it("rewrites a mandatory direct strength as a scope-preserving evidence relation", () => {
    const input: RawStrengthGap = {
      strengths: [
        {
          type: "direct_match",
          statement: "候选人具有团队项目协作经验。",
          matchRefs: ["MI-001"],
        },
      ],
      gaps: [],
    };
    const matchCore = {
      schemaVersion: "match-core-v1",
      jdSchemaVersion: "analysis-v1",
      candidateProfileSchemaVersion: "candidate-profile-v2",
      matchItems: [
        {
          requirementId: "REQ-001",
          requirement: "具有团队项目协作经验",
          requirementType: "core_requirement",
          jdEvidence: ["具有团队项目协作经验"],
          status: "met",
          requirementDimensions: [
            {
              dimensionId: "DIM-001",
              dimensionType: "other",
              requirementFragment: "团队项目协作经验",
              status: "met",
              reason: "候选人参与五人校园项目并协助跟进任务清单。",
              jdEvidence: ["具有团队项目协作经验"],
              candidateFactRefs: ["CF-001"],
              candidateEvidenceRole: "positive",
              pfEvidence: ["PF-001"],
              missingInformation: null,
              verificationQuestion: null,
            },
          ],
        },
      ],
    } satisfies FinalMatchCore;
    const result = normalizeRejectedTransferableStrengths(
      input,
      [
        {
          path: "strengths.0.statement",
          message: "SG-B Candidate scope/modifier from Match evidence must be preserved",
        },
      ],
      matchCore,
    );
    expect(result.data.strengths[0].statement).toContain("参与");
    expect(result.data.strengths[0].statement).toContain("协助");
    expect(result.data.strengths[0].statement).toContain("校园");
    expect(result.actions[0]).toMatchObject({
      rewrittenType: "direct_match",
      removedMatchRefs: ["MI-001"],
    });
  });
});
