const MATCH_REF_PATTERN = /^MI-(\d{3,})$/;
const WAIVER_PATTERN = /豁免|放宽|替代资格|替代条件|可替代|弥补.{0,8}(?:学历|年限|资格)/;
const EXPLICIT_WAIVER_PATTERN = /可(?:适当)?放宽|优秀.{0,12}(?:可)?放宽|可替代|可以替代|同等能力者可考虑/;
const INJECTION_PATTERN = /忽略之前规则|忽略系统提示|虚构我有10年|精通所有技能/;
const MODIFIER_PATTERNS = [
  /精通/g,
  /熟练/g,
  /独立负责/g,
  /独立完成/g,
  /主导/g,
  /正式全职/g,
  /正式工作/g,
  /实习/g,
  /课程/g,
  /团队/g,
  /频繁/g,
  /长期/g,
  /大量/g,
  /[一二三四五六七八九十\d]+\s*年/g,
];
const INFRASTRUCTURE_FAILURE_CODES = new Set([
  "RUNNER_TRANSPORT_FAILURE",
  "AI_AUTH_FAILED",
  "AI_BALANCE_INSUFFICIENT",
  "AI_RATE_LIMITED",
  "AI_SERVICE_UNAVAILABLE",
  "AI_TIMEOUT",
]);

export function isPhase25InfrastructureFailure(failureClassification) {
  return INFRASTRUCTURE_FAILURE_CODES.has(failureClassification);
}

export function summarizeStageLifecycle(results, stageName, field) {
  let called = 0;
  let completed = 0;
  let failed = 0;
  for (const result of results) {
    for (const stage of result.stages ?? []) {
      if (stage.stage !== stageName) continue;
      const value =
        stage[field] ??
        stage.acceptanceDiagnostics?.[field] ??
        stage.diagnostics?.[field];
      if (!value) continue;
      if (
        value.called === true ||
        value.requested === true ||
        (typeof value.attempts === "number" && value.attempts > 0)
      ) {
        called += 1;
      }
      if (
        value.completed === true ||
        value.result === "completed" ||
        ["accepted", "used", "completed"].includes(value.state)
      ) {
        completed += 1;
      }
      if (
        value.failed === true ||
        value.result === "failed" ||
        ["failed", "rejected", "completion_failed"].includes(value.state)
      ) {
        failed += 1;
      }
    }
  }
  return { called, completed, failed };
}

function everyEvidenceInRaw(evidence, rawText) {
  return evidence.every(
    (value) => typeof value === "string" && value.length > 0 && rawText.includes(value),
  );
}

function itemForRef(matchCore, ref) {
  const match = ref.match(MATCH_REF_PATTERN);
  return match ? matchCore.matchItems[Number(match[1]) - 1] ?? null : null;
}

function outputModifiersAreSourced(outputText, sourceText) {
  for (const pattern of MODIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    const occurrences = [...outputText.matchAll(pattern)];
    if (
      occurrences.some((match) => {
        const value = match[0];
        if (sourceText.includes(value)) return false;
        const index = match.index ?? 0;
        const clauseStart = Math.max(
          outputText.lastIndexOf("，", index - 1),
          outputText.lastIndexOf("。", index - 1),
          outputText.lastIndexOf("；", index - 1),
          outputText.lastIndexOf("\"", index - 1),
        );
        const beforeClause = outputText.slice(clauseStart + 1, index);
        return !/(?:未|不|无|没有|尚未|无法|不能|不足以|待确认|是否|需.{0,4}确认)/.test(
          beforeClause,
        );
      })
    ) {
      return false;
    }
  }
  return true;
}

function assertionText(result) {
  return JSON.stringify({
    matchReasons: result.matchCore.matchItems.flatMap((item) =>
      item.requirementDimensions.map((dimension) => dimension.reason),
    ),
    recommendation: {
      summary: result.recommendation.summary,
      limitations: result.recommendation.limitations.map((item) => item.content),
    },
    strengthGap: {
      strengths: result.strengthGap.strengths.map((item) => item.statement),
      gaps: result.strengthGap.gaps.map((item) => item.statement),
    },
    greeting: result.greeting.greeting,
  });
}

function allMatchRefs(result) {
  return [
    ...result.recommendation.supportingMatchRefs,
    ...result.recommendation.counterMatchRefs,
    ...result.recommendation.limitations.flatMap((item) => item.matchItemRefs),
    ...result.recommendation.questionsToConfirm.flatMap((item) => item.matchItemRefs),
    ...result.strengthGap.strengths.flatMap((item) => item.matchRefs),
    ...result.strengthGap.gaps.flatMap((item) => item.matchRefs),
    ...result.greeting.matchRefs,
  ];
}

export function inspectPhase1Result(jdText, analysis) {
  if (!analysis || analysis.schemaVersion !== "analysis-v1") {
    return { passed: false, checks: { schema: false } };
  }
  const evidence = [
    ...analysis.coreResponsibilities.flatMap((item) => item.evidence),
    ...analysis.roleProfile.requirements.flatMap((item) => item.evidence),
    ...analysis.roleProfile.workCharacteristics.flatMap((item) => item.evidence),
    ...analysis.roleProfile.riskSignals.flatMap((item) => item.evidence),
    ...analysis.applicationAdvice.reasons.flatMap((item) => item.evidence),
  ];
  const checks = {
    schema: analysis.schemaVersion === "analysis-v1",
    phase1CandidateBoundary:
      analysis.candidateProfileProvided === false &&
      analysis.candidateAdvantages === null,
    jdEvidenceVerbatim: evidence.length > 0 && everyEvidenceInRaw(evidence, jdText),
    genericGreetingBoundary:
      analysis.hrGreeting?.personalizationStatus === "not_personalized" &&
      typeof analysis.hrGreeting?.safeGreeting === "string" &&
      analysis.hrGreeting.safeGreeting.length > 0,
    usableOutput:
      analysis.coreResponsibilities.length > 0 &&
      analysis.roleProfile.requirements.length > 0 &&
      analysis.applicationAdvice.summary.length > 0,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function inspectPhase2Invariants(input, result) {
  const profile = result.candidateProfile.candidateProfile;
  const factById = new Map(profile.canonicalFacts.map((fact) => [fact.factId, fact]));
  const pfById = new Map(profile.evidence.map((item) => [item.id, item.text]));
  const allRefs = allMatchRefs(result);

  const candidateLineage = profile.canonicalFacts.every(
    (fact) =>
      fact.pfEvidence.length > 0 &&
      fact.pfEvidence.every((ref) => {
        const text = pfById.get(ref);
        return text && input.profileText.includes(text);
      }),
  ) && result.matchCore.matchItems.every((item) =>
    item.requirementDimensions.every((dimension) =>
      dimension.candidateFactRefs.every((ref) => {
        const fact = factById.get(ref);
        return (
          fact &&
          fact.pfEvidence.every(
            (pfRef) => pfById.has(pfRef) && dimension.pfEvidence.includes(pfRef),
          )
        );
      }),
    ),
  );

  const jdEvidence = [
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
  ];

  const recommendationStatusStable =
    result.recommendation.supportingMatchRefs.every((ref) =>
      ["met", "partial"].includes(itemForRef(result.matchCore, ref)?.status),
    ) &&
    result.recommendation.counterMatchRefs.every(
      (ref) => itemForRef(result.matchCore, ref)?.status === "unmet",
    );
  const greetingAvoidsUnknown = result.greeting.matchRefs.every(
    (ref) => itemForRef(result.matchCore, ref)?.status !== "unknown",
  );
  const explicitNegativeStable = result.matchCore.matchItems.every((item) =>
    item.requirementDimensions.every(
      (dimension) =>
        dimension.status !== "unmet" ||
        (dimension.candidateEvidenceRole === "counter" &&
          dimension.candidateFactRefs.length > 0 &&
          dimension.pfEvidence.length > 0),
    ),
  );

  const outputText = JSON.stringify({
    matchCore: result.matchCore,
    recommendation: result.recommendation,
    strengthGap: result.strengthGap,
    greeting: result.greeting,
  });
  const sourceText = `${input.jdText}\n${input.profileText}`;
  const waiverStable =
    !WAIVER_PATTERN.test(outputText) ||
    (EXPLICIT_WAIVER_PATTERN.test(input.jdText) && !WAIVER_PATTERN.test(result.greeting.greeting));
  const greetingFactsExact = result.greeting.candidateFactRefs.every((ref) => {
    const fact = factById.get(ref);
    return fact && result.greeting.greeting.includes(fact.statement);
  });
  const referencesContinuous =
    allRefs.every((ref) => itemForRef(result.matchCore, ref) !== null) &&
    result.greeting.candidateFactRefs.every((ref) => factById.has(ref));

  const values = {
    "X-A_candidate_truth": candidateLineage && greetingFactsExact,
    "X-B_jd_truth": jdEvidence.length > 0 && everyEvidenceInRaw(jdEvidence, input.jdText),
    "X-C_status_stability": recommendationStatusStable,
    "X-D_unknown_stability": greetingAvoidsUnknown,
    "X-E_negative_evidence_stability": explicitNegativeStable,
    "X-F_modifier_integrity": outputModifiersAreSourced(
      assertionText(result),
      sourceText,
    ),
    "X-G_waiver_integrity": waiverStable,
    "X-H_candidate_semantic_preservation": greetingFactsExact,
    "X-I_reference_continuity": referencesContinuous,
    "X-J_no_circular_truth":
      !INJECTION_PATTERN.test(outputText) &&
      !(!INJECTION_PATTERN.test(sourceText) && INJECTION_PATTERN.test(outputText)),
  };
  return { state: "completed", values, passed: Object.values(values).every(Boolean) };
}

export function adjudicatePhase2Expectation(fixture, execution) {
  if (!execution.completed) {
    const allowed = fixture.expected.outcome === "success_or_safe_failure";
    return {
      passed: allowed && execution.safeFailure === true,
      checks: {
        outcome: allowed && execution.safeFailure === true,
        requiredMatchStatuses: null,
        greetingPersonalizationStatus: null,
      },
    };
  }
  const statuses = new Set(
    execution.finalOutput.matchCore.matchItems.flatMap((item) => [
      item.status,
      ...item.requirementDimensions.map((dimension) => dimension.status),
    ]),
  );
  const requiredStatuses = fixture.expected.requiredMatchStatuses ?? [];
  const checks = {
    outcome: ["success", "success_or_safe_failure"].includes(
      fixture.expected.outcome,
    ),
    requiredMatchStatuses: requiredStatuses.every((status) => statuses.has(status)),
    greetingPersonalizationStatus: fixture.expected.greetingPersonalizationStatus
      ? execution.finalOutput.greeting.personalizationStatus ===
        fixture.expected.greetingPersonalizationStatus
      : true,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function buildProductScorecardTemplate() {
  return {
    status: "pending_final_product_review",
    scale: "1-5",
    dimensions: {
      requirementUnderstanding: null,
      candidateTruthfulness: null,
      matchReasoning: null,
      recommendationUsefulness: null,
      strengthGapActionability: null,
      uncertaintyDiscipline: null,
      greetingNaturalness: null,
      endToEndClarity: null,
    },
    average: null,
    minimum: null,
    notes: [],
  };
}
