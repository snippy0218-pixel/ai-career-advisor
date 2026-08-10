import { describe, expect, it } from "vitest";

import {
  aggregateRepairMetrics,
  buildRejectedEvidenceTrace,
} from "./strength-gap-acceptance-utils.mjs";

describe("strength-gap acceptance evidence utilities", () => {
  it("EC-TC-05 includes failed HTTP requests in repair metrics", () => {
    const metrics = aggregateRepairMetrics([
      {
        httpStatus: 502,
        diagnostics: {
          strengthGapRepairAttempted: true,
          strengthGapRepairSucceeded: false,
        },
      },
      {
        httpStatus: 200,
        diagnostics: {
          strengthGapRepairAttempted: false,
          strengthGapRepairSucceeded: false,
        },
      },
    ]);

    expect(metrics).toEqual({
      repairRequests: 1,
      repairSucceeded: 0,
      repairFailed: 1,
      repairRate: 0.5,
    });
  });

  it("EC-TC-06 resolves rejected Strength to CF, PF, MI status and dimension", () => {
    const testCase = {
      acceptanceContext: {
        candidateFacts: [
          {
            candidateFactRef: "CF-001",
            canonicalStatement: "协助需求整理",
            profileEvidenceRefs: ["PF-001"],
          },
        ],
        profileEvidence: [
          { profileEvidenceRef: "PF-001", text: "协助需求整理" },
        ],
      },
      matchCore: {
        matchItems: [
          {
            requirementId: "REQ-001",
            requirement: "独立负责完整需求流程",
            requirementType: "core_requirement",
            status: "partial",
            requirementDimensions: [
              {
                dimensionId: "DIM-001",
                dimensionType: "responsibility",
                status: "partial",
                reason: "Candidate 只提供协助需求整理的正向证据。",
                candidateEvidenceRole: "positive",
                candidateFactRefs: ["CF-001"],
                pfEvidence: ["PF-001"],
                jdEvidence: ["独立负责完整需求流程"],
              },
            ],
          },
        ],
      },
    };
    const trace = buildRejectedEvidenceTrace(testCase, {
      outputEvidence: [
        {
          stage: "initial",
          rejected: true,
          rejectedItems: [
            {
              collection: "strengths",
              index: 0,
              statement: "你具备需求分析能力。",
              matchRefs: ["MI-001"],
            },
          ],
        },
      ],
    });

    expect(trace[0].rejectedItems[0]).toMatchObject({
      statement: "你具备需求分析能力。",
      implicatedMatch: [
        {
          matchRef: "MI-001",
          status: "partial",
          dimensions: [
            {
              dimensionType: "responsibility",
              candidateFactRefs: ["CF-001"],
              profileEvidenceRefs: ["PF-001"],
            },
          ],
        },
      ],
      implicatedCandidateFacts: [
        { canonicalStatement: "协助需求整理" },
      ],
      implicatedProfileEvidence: [{ text: "协助需求整理" }],
    });
  });
});
