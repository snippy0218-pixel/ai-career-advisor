import { describe, expect, it } from "vitest";

import { finalizeRawPersonalizedGreeting } from "../src/lib/greeting-schema.ts";
import { GREETING_FIXTURES } from "../src/test/greeting-fixtures.ts";
import { validAnalysis } from "../src/test/fixtures.ts";
import {
  adjudicatePhase2Expectation,
  buildProductScorecardTemplate,
  inspectPhase1Result,
  inspectPhase2Invariants,
  isPhase25InfrastructureFailure,
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
});
