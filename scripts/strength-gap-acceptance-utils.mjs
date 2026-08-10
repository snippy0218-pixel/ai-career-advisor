export function decodeAcceptanceDiagnostics(response, body) {
  if (body?.acceptanceDiagnostics) return body.acceptanceDiagnostics;
  const encoded = response.headers.get(
    "x-strength-gap-acceptance-diagnostics",
  );
  return encoded
    ? JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    : null;
}

export function aggregateRepairMetrics(results) {
  const attempted = results.filter(
    (item) => item.diagnostics?.strengthGapRepairAttempted === true,
  ).length;
  const succeeded = results.filter(
    (item) => item.diagnostics?.strengthGapRepairSucceeded === true,
  ).length;
  return {
    repairRequests: attempted,
    repairSucceeded: succeeded,
    repairFailed: attempted - succeeded,
    repairRate: results.length > 0 ? attempted / results.length : null,
  };
}

function matchItemForRef(testCase, matchRef) {
  const match = /^MI-(\d{3,})$/.exec(matchRef);
  if (!match) return null;
  const item = testCase.matchCore.matchItems[Number(match[1]) - 1];
  return item ? { matchRef, ...item } : null;
}

function unique(values) {
  return [...new Set(values)];
}

export function buildRejectedEvidenceTrace(testCase, diagnostics) {
  const context = testCase.acceptanceContext ?? {
    candidateFacts: [],
    profileEvidence: [],
  };
  return (diagnostics?.outputEvidence ?? []).map((output) => ({
    ...output,
    rejectedItems: (output.rejectedItems ?? []).map((item) => {
      const implicatedMatch = item.matchRefs
        .map((matchRef) => matchItemForRef(testCase, matchRef))
        .filter(Boolean);
      const candidateFactRefs = unique(
        implicatedMatch.flatMap((matchItem) =>
          matchItem.requirementDimensions.flatMap(
            (dimension) => dimension.candidateFactRefs,
          ),
        ),
      );
      const profileEvidenceRefs = unique(
        implicatedMatch.flatMap((matchItem) =>
          matchItem.requirementDimensions.flatMap(
            (dimension) => dimension.pfEvidence,
          ),
        ),
      );
      return {
        ...item,
        implicatedMatch: implicatedMatch.map((matchItem) => ({
          matchRef: matchItem.matchRef,
          requirementId: matchItem.requirementId,
          requirement: matchItem.requirement,
          requirementType: matchItem.requirementType,
          status: matchItem.status,
          dimensions: matchItem.requirementDimensions.map((dimension) => ({
            dimensionId: dimension.dimensionId,
            dimensionType: dimension.dimensionType,
            status: dimension.status,
            reason: dimension.reason,
            candidateEvidenceRole: dimension.candidateEvidenceRole,
            candidateFactRefs: dimension.candidateFactRefs,
            profileEvidenceRefs: dimension.pfEvidence,
            jdEvidence: dimension.jdEvidence,
          })),
        })),
        implicatedCandidateFacts: context.candidateFacts.filter((fact) =>
          candidateFactRefs.includes(fact.candidateFactRef),
        ),
        implicatedProfileEvidence: context.profileEvidence.filter((evidence) =>
          profileEvidenceRefs.includes(evidence.profileEvidenceRef),
        ),
      };
    }),
  }));
}
