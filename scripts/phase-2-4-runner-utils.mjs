export const ACCEPTANCE_PREFLIGHT_HEADER = "x-phase-2-acceptance-preflight";
export const ACCEPTANCE_CAPABILITY_HEADER = "x-phase-2-acceptance-capability";
export const ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE =
  "ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE";

export const STAGE_NAMES = [
  "jd",
  "profile",
  "match",
  "recommendation",
  "strengthGap",
  "greeting",
];

export const ACCEPTANCE_CAPABILITIES = [
  ["profile", "/api/profile/analyze"],
  ["match", "/api/match/analyze"],
  ["recommendation", "/api/recommendation/analyze"],
  ["strengthGap", "/api/strength-gap/analyze"],
  ["greeting", "/api/greeting/analyze"],
];

const repairFields = {
  profile: ["profileRepairAttempted", "profileRepairSucceeded"],
  match: ["matchRepairAttempted", "matchRepairSucceeded"],
  recommendation: [
    "recommendationRepairAttempted",
    "recommendationRepairSucceeded",
  ],
  strengthGap: ["strengthGapRepairAttempted", "strengthGapRepairSucceeded"],
  greeting: [
    "personalizedGreetingRepairAttempted",
    "personalizedGreetingRepairSucceeded",
  ],
};

function nullStage(stage) {
  return {
    stage,
    callState: "not_called",
    resultState: "not_run",
    status: null,
    latencyMs: null,
    requestId: null,
    diagnostics: null,
    acceptanceDiagnostics: null,
    error: null,
    attempts: { state: "not_run", count: null },
    repair: { state: "not_run", attempts: null },
    fallback: { state: "not_run", attempts: null },
    personalizedFallback: { state: "not_run", attempts: null },
    phase1Fallback: { state: "not_run", attempts: null },
  };
}

function lifecycleDiagnostics(result) {
  return result.acceptanceDiagnostics ?? result.diagnostics ?? null;
}

function attemptState(result) {
  const diagnostics = lifecycleDiagnostics(result);
  return Number.isInteger(diagnostics?.upstreamAttempts)
    ? { state: "known", count: diagnostics.upstreamAttempts }
    : { state: "unknown", count: null };
}

function repairState(stage, result) {
  const diagnostics = lifecycleDiagnostics(result);
  if (!diagnostics) return { state: "unknown", attempts: null };
  const fields = repairFields[stage];
  if (!fields) return { state: "unknown", attempts: null };
  const [attemptedField, succeededField] = fields;
  if (diagnostics[attemptedField] === false) {
    return { state: "not_needed", attempts: 0 };
  }
  if (diagnostics[attemptedField] !== true) {
    return { state: "unknown", attempts: null };
  }
  if (diagnostics.repairState === "completion_failed") {
    return { state: "failed", attempts: 1 };
  }
  if (diagnostics[succeededField] === true) {
    return { state: "accepted", attempts: 1 };
  }
  if (diagnostics[succeededField] === false) {
    return { state: "failed", attempts: 1 };
  }
  return { state: "attempted", attempts: 1 };
}

function fallbackState(stage, result) {
  if (stage !== "greeting") {
    return stage === "jd"
      ? { state: "unknown", attempts: null }
      : { state: "not_used", attempts: 0 };
  }
  const diagnostics = lifecycleDiagnostics(result);
  if (!diagnostics) return { state: "unknown", attempts: null };
  const values = [
    diagnostics.personalizedGreetingSafeFallbackUsed,
    diagnostics.phase1GreetingFallbackUsed,
  ];
  if (values.some((value) => value === true)) {
    return { state: "used", attempts: 1 };
  }
  if (values.every((value) => value === false)) {
    return { state: "not_used", attempts: 0 };
  }
  return { state: "unknown", attempts: null };
}

function fallbackFieldState(stage, result, field) {
  if (stage !== "greeting") return { state: "not_used", attempts: 0 };
  const diagnostics = lifecycleDiagnostics(result);
  if (!diagnostics || typeof diagnostics[field] !== "boolean") {
    return { state: "unknown", attempts: null };
  }
  return diagnostics[field]
    ? { state: "used", attempts: 1 }
    : { state: "not_used", attempts: 0 };
}

export function buildExplicitStageLedger(calledStages) {
  const byStage = new Map(calledStages.map((stage) => [stage.stage, stage]));
  return STAGE_NAMES.map((stage) => {
    const result = byStage.get(stage);
    if (!result) return nullStage(stage);
    const resultState =
      result.status === 200 && result.data !== null ? "completed" : "failed";
    return {
      stage,
      callState: "called",
      resultState,
      status: result.status,
      latencyMs: result.latencyMs,
      requestId: result.requestId ?? null,
      diagnostics: result.diagnostics ?? null,
      acceptanceDiagnostics: result.acceptanceDiagnostics ?? null,
      error: result.error ?? null,
      attempts: attemptState(result),
      repair: repairState(stage, result),
      fallback: fallbackState(stage, result),
      personalizedFallback: fallbackFieldState(
        stage,
        result,
        "personalizedGreetingSafeFallbackUsed",
      ),
      phase1Fallback: fallbackFieldState(
        stage,
        result,
        "phase1GreetingFallbackUsed",
      ),
    };
  });
}

export function downstreamCallsAfterFailure(stages) {
  const failureIndex = stages.findIndex(
    (stage) => stage.callState === "called" && stage.resultState === "failed",
  );
  if (failureIndex === -1) return 0;
  return stages
    .slice(failureIndex + 1)
    .filter((stage) => stage.callState === "called").length;
}

export function buildInvariantAudit(completed, values) {
  if (!completed) {
    return { status: "not_run", values: null, passed: null };
  }
  if (
    !values ||
    Object.values(values).some((value) => typeof value !== "boolean")
  ) {
    return { status: "unknown", values: values ?? null, passed: null };
  }
  const passed = Object.values(values).every(Boolean);
  return { status: passed ? "pass" : "fail", values, passed };
}

export function isSafeFailure(result) {
  if (!result.stoppedAt) return false;
  if (!['safe_failure', 'success_or_safe_failure'].includes(result.expected)) {
    return false;
  }
  const failedStage = result.stages.find(
    (stage) => stage.callState === "called" && stage.resultState === "failed",
  );
  return (
    Boolean(failedStage) &&
    [400, 422].includes(failedStage.status) &&
    downstreamCallsAfterFailure(result.stages) === 0
  );
}

export function expectationPassed(result) {
  if (result.expected === "success") return result.completed;
  if (result.expected === "safe_failure") return result.safeFailure;
  return result.completed || result.safeFailure;
}

export function aggregateLifecycle(results, stageName, field) {
  const states = results.map(
    (result) => result.stages.find((stage) => stage.stage === stageName)[field],
  );
  const knownCount = states.reduce(
    (total, state) => total + (Number.isInteger(state.attempts) ? state.attempts : 0),
    0,
  );
  const unknownCount = states.filter((state) => state.state === "unknown").length;
  const notRunCount = states.filter((state) => state.state === "not_run").length;
  return {
    knownCount,
    unknownCount,
    notRunCount,
    complete: unknownCount === 0,
  };
}

export function summarizeSafeFailures(results) {
  return results.filter((result) => result.safeFailure === true).length;
}

export async function probeAcceptanceCapabilities({ baseUrl, fetchImpl = fetch }) {
  const capabilities = [];
  for (const [module, path] of ACCEPTANCE_CAPABILITIES) {
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { [ACCEPTANCE_PREFLIGHT_HEADER]: "1" },
      });
      const payload = await response.json().catch(() => null);
      const enabled =
        response.status === 200 &&
        response.headers.get(ACCEPTANCE_CAPABILITY_HEADER) === "enabled" &&
        payload?.data?.rejectedOutputCapture === true;
      capabilities.push({
        module,
        path,
        status: response.status,
        enabled,
        error: payload?.error?.code ?? null,
      });
    } catch {
      capabilities.push({
        module,
        path,
        status: null,
        enabled: false,
        error: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
      });
    }
  }
  const available = capabilities.every((capability) => capability.enabled);
  return {
    status: available ? "passed" : "failed",
    available,
    error: available ? null : ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
    modelCalls: 0,
    capabilities,
  };
}

export async function executeAfterPreflight(preflight, execute) {
  if (!preflight.available) {
    return {
      executed: false,
      modelCalls: 0,
      error: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
    };
  }
  return { executed: true, modelCalls: await execute(), error: null };
}
