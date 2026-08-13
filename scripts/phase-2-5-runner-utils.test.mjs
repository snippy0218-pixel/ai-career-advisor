import { describe, expect, it } from "vitest";

import { finalizeRawPersonalizedGreeting } from "../src/lib/greeting-schema.ts";
import { GREETING_FIXTURES } from "../src/test/greeting-fixtures.ts";
import { validAnalysis } from "../src/test/fixtures.ts";
import {
  adjudicatePhase2Expectation,
  acceptedStageOutput,
  buildProductScorecardTemplate,
  inspectPhase1Result,
  inspectPhase2Invariants,
  isPhase25InfrastructureFailure,
  summarizeStageLifecycle,
} from "./phase-2-5-runner-utils.mjs";

function completeResult() {
  const fixture = GREETING_FIXTURES[0];
  if (!fixture.validRaw) throw new Error("expected valid raw greeting");
  const greeting = finalizeRawPersonalizedGreeting(
    fixture.validRaw,
    fixture.request,
  ).data;
  if (!greeting) throw new Error("expected final greeting");
  return {
    jobAnalysis: validAnalysis,
    candidateProfile: fixture.request.candidateProfile,
    matchCore: fixture.request.matchCore,
    recommendation: fixture.request.recommendation,
    strengthGap: fixture.request.strengthGap,
    greeting,
  };
}

function rawInputs(result) {
  return {
    jdText: [
      ...result.jobAnalysis.coreResponsibilities.flatMap((item) => item.evidence),
      ...result.jobAnalysis.roleProfile.requirements.flatMap((item) => item.evidence),
      ...result.jobAnalysis.roleProfile.workCharacteristics.flatMap((item) => item.evidence),
      ...result.jobAnalysis.roleProfile.riskSignals.flatMap((item) => item.evidence),
      ...result.jobAnalysis.applicationAdvice.reasons.flatMap((item) => item.evidence),
      ...result.matchCore.matchItems.flatMap((item) => [
        ...item.jdEvidence,
        ...item.requirementDimensions.flatMap((dimension) => dimension.jdEvidence),
      ]),
      ...result.greeting.jdEvidence,
    ].join("\n"),
    profileText: result.candidateProfile.candidateProfile.evidence
      .map((item) => item.text)
      .join("\n"),
  };
}

describe("Phase 2.5 runner utilities", () => {
  it("audits the released Phase 1 boundaries and verbatim evidence", () => {
    const jdText = [
      ...validAnalysis.coreResponsibilities.flatMap((item) => item.evidence),
      ...validAnalysis.roleProfile.requirements.flatMap((item) => item.evidence),
      ...validAnalysis.roleProfile.workCharacteristics.flatMap((item) => item.evidence),
      ...validAnalysis.roleProfile.riskSignals.flatMap((item) => item.evidence),
      ...validAnalysis.applicationAdvice.reasons.flatMap((item) => item.evidence),
    ].join("\n");
    expect(inspectPhase1Result(jdText, validAnalysis)).toMatchObject({
      passed: true,
    });
    expect(inspectPhase1Result("unrelated", validAnalysis)).toMatchObject({
      passed: false,
      checks: { jdEvidenceVerbatim: false },
    });
  });

  it("audits X-A through X-J on a complete released fixture", () => {
    const result = completeResult();
    const audit = inspectPhase2Invariants(rawInputs(result), result);
    expect(Object.keys(audit.values)).toEqual([
      "X-A_candidate_truth",
      "X-B_jd_truth",
      "X-C_status_stability",
      "X-D_unknown_stability",
      "X-E_negative_evidence_stability",
      "X-F_modifier_integrity",
      "X-G_waiver_integrity",
      "X-H_candidate_semantic_preservation",
      "X-I_reference_continuity",
      "X-J_no_circular_truth",
    ]);
    expect(audit.passed).toBe(true);
  });

  it("X-F audits assertions without treating verification actions as Candidate claims", () => {
    const result = completeResult();
    result.strengthGap.gaps.push({
      type: "information",
      statement: "资料尚缺少该项信息。",
      matchRefs: ["MI-001"],
      suggestedAction: "请补充是否在正式工作或实习中完成该任务。",
      actionType: "confirm",
    });
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(true);

    result.strengthGap.gaps.at(-1).statement = "候选人具有10年正式工作经历。";
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(false);

    result.strengthGap.gaps.at(-1).statement =
      "现有证据尚不足以证明候选人熟练使用该工具，也未独立负责该任务。";
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(true);

    result.strengthGap.gaps.at(-1).statement =
      "候选人参与项目复盘，需提升项目复盘的独立性和熟练程度。";
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(true);

    result.strengthGap.gaps.at(-1).statement =
      "候选人仅有基础应用证据，技能熟练度不足，需要学习或补强。";
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(true);

    result.strengthGap.gaps.at(-1).statement =
      "缺少剩余2年经验的证据。";
    expect(
      inspectPhase2Invariants(rawInputs(result), result).values[
        "X-F_modifier_integrity"
      ],
    ).toBe(true);
  });

  it("preserves a completed stage output for failed-chain artifact continuity", () => {
    const data = { schemaVersion: "candidate-profile-v2", nested: { value: 1 } };
    const output = acceptedStageOutput({ completionState: "completed", data });
    expect(output).toEqual(data);
    expect(output).not.toBe(data);
    expect(acceptedStageOutput({ completionState: "failed", data })).toBeNull();
  });

  it("fails expected status and fallback mismatches", () => {
    const result = completeResult();
    const execution = {
      completed: true,
      finalOutput: result,
    };
    expect(
      adjudicatePhase2Expectation(
        {
          expected: {
            outcome: "success",
            requiredMatchStatuses: ["unmet"],
            greetingPersonalizationStatus: "not_personalized",
          },
        },
        execution,
      ),
    ).toMatchObject({
      passed: false,
      checks: {
        requiredMatchStatuses: false,
        greetingPersonalizationStatus: false,
      },
    });
  });

  it("keeps Gate F scoring pending until the final product review", () => {
    expect(buildProductScorecardTemplate()).toMatchObject({
      status: "pending_final_product_review",
      average: null,
      minimum: null,
    });
  });

  it("separates provider and transport infrastructure failures from content samples", () => {
    for (const code of [
      "RUNNER_TRANSPORT_FAILURE",
      "AI_AUTH_FAILED",
      "AI_BALANCE_INSUFFICIENT",
      "AI_RATE_LIMITED",
      "AI_SERVICE_UNAVAILABLE",
      "AI_TIMEOUT",
    ]) {
      expect(isPhase25InfrastructureFailure(code)).toBe(true);
    }
    expect(isPhase25InfrastructureFailure("AI_OUTPUT_INVALID")).toBe(false);
    expect(isPhase25InfrastructureFailure("INVALID_INPUT")).toBe(false);
  });

  it("aggregates normalized stage repair and fallback lifecycle fields", () => {
    const results = [
      {
        stages: [
          {
            stage: "greeting",
            repair: { state: "failed", attempts: 1 },
            personalizedFallback: { state: "used", attempts: 1 },
          },
        ],
      },
      {
        stages: [
          {
            stage: "greeting",
            repair: { state: "accepted", attempts: 1 },
            personalizedFallback: { state: "not_used", attempts: 0 },
          },
        ],
      },
    ];
    expect(summarizeStageLifecycle(results, "greeting", "repair")).toEqual({
      called: 2,
      completed: 1,
      failed: 1,
    });
    expect(
      summarizeStageLifecycle(results, "greeting", "personalizedFallback"),
    ).toEqual({ called: 1, completed: 1, failed: 0 });
  });
});
