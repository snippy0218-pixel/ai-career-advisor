import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  ACCEPTANCE_CAPABILITY_HEADER,
  ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
  aggregateLifecycle,
  buildExplicitStageLedger,
  buildInvariantAudit,
  buildPreflightFailureArtifact,
  downstreamCallsAfterFailure,
  executeAfterPreflight,
  isSafeFailure,
  probeAcceptanceCapabilities,
  summarizeSafeFailures,
} from "./phase-2-4-runner-utils.mjs";

function called(stage, diagnostics, overrides = {}) {
  return {
    stage,
    status: 200,
    latencyMs: 10,
    requestId: `${stage}-request`,
    diagnostics,
    acceptanceDiagnostics: null,
    data: {},
    error: null,
    ...overrides,
  };
}

function enabledResponse(module) {
  return Response.json(
    {
      data: {
        module,
        acceptanceDiagnostics: "enabled",
        rejectedOutputCapture: true,
      },
      error: null,
    },
    {
      status: 200,
      headers: { [ACCEPTANCE_CAPABILITY_HEADER]: "enabled" },
    },
  );
}

function unavailableResponse() {
  return Response.json(
    { data: null, error: { code: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE } },
    { status: 503 },
  );
}

function preflightFailureArtifact(preflight) {
  return buildPreflightFailureArtifact({
    phase: "2.4",
    suite: "test",
    implementationCommit: "test-commit",
    generatedAt: "2026-08-12T00:00:00.000Z",
    runPolicy: "E2E-RB-05 x 1 targeted",
    baseUrl: "http://localhost",
    preflight,
  });
}

describe("Phase 2.4 runner artifact semantics", () => {
  it("AS1 records explicit downstream not_called stages after Match fails", () => {
    const stages = buildExplicitStageLedger([
      called("jd", null),
      called("profile", { upstreamAttempts: 1, profileRepairAttempted: false }),
      called("match", null, { status: 502, data: null }),
    ]);

    expect(stages.find((stage) => stage.stage === "recommendation")).toMatchObject({
      callState: "not_called",
      resultState: "not_run",
    });
    expect(stages.find((stage) => stage.stage === "strengthGap")).toMatchObject({
      callState: "not_called",
      resultState: "not_run",
    });
    expect(stages.find((stage) => stage.stage === "greeting")).toMatchObject({
      callState: "not_called",
      resultState: "not_run",
    });
    expect(downstreamCallsAfterFailure(stages)).toBe(0);
  });

  it("AS2 never turns not-run invariants into pass", () => {
    expect(buildInvariantAudit(false, null)).toEqual({
      status: "not_run",
      values: null,
      passed: null,
    });
  });

  it("AS3 records called stage with missing diagnostics as repair unknown", () => {
    const match = buildExplicitStageLedger([called("match", null)]).find(
      (stage) => stage.stage === "match",
    );
    expect(match.attempts).toEqual({ state: "unknown", count: null });
    expect(match.repair).toEqual({ state: "unknown", attempts: null });
  });

  it("AS4 records explicit repair=false as known zero", () => {
    const match = buildExplicitStageLedger([
      called("match", {
        upstreamAttempts: 1,
        matchRepairAttempted: false,
        matchRepairSucceeded: false,
      }),
    ]).find((stage) => stage.stage === "match");
    expect(match.repair).toEqual({ state: "not_needed", attempts: 0 });
  });

  it("AS5 keeps not_called repair and fallback as not_run", () => {
    const greeting = buildExplicitStageLedger([]).find(
      (stage) => stage.stage === "greeting",
    );
    expect(greeting.repair).toEqual({ state: "not_run", attempts: null });
    expect(greeting.fallback).toEqual({ state: "not_run", attempts: null });
    expect(greeting.personalizedFallback).toEqual({
      state: "not_run",
      attempts: null,
    });
    expect(greeting.phase1Fallback).toEqual({
      state: "not_run",
      attempts: null,
    });
    expect(greeting.attempts).toEqual({ state: "not_run", count: null });
  });

  it("AS6 marks completed all-true invariants pass", () => {
    expect(buildInvariantAudit(true, { a: true, b: true })).toMatchObject({
      status: "pass",
      passed: true,
    });
  });

  it("AS7 marks completed invariant false as fail", () => {
    expect(buildInvariantAudit(true, { a: true, b: false })).toMatchObject({
      status: "fail",
      passed: false,
    });
  });

  it("AS8 aggregates unknown separately instead of silently counting zero", () => {
    const unknown = {
      stages: buildExplicitStageLedger([called("match", null)]),
    };
    const knownZero = {
      stages: buildExplicitStageLedger([
        called("match", { matchRepairAttempted: false }),
      ]),
    };
    expect(aggregateLifecycle([unknown, knownZero], "match", "repair")).toEqual({
      knownCount: 0,
      unknownCount: 1,
      notRunCount: 0,
      complete: false,
    });
  });

  it("AS9 uses the same safeFailure value for per-run and summary", () => {
    const stages = buildExplicitStageLedger([
      called("jd", null, { status: 400, data: null }),
    ]);
    const safe = { expected: "safe_failure", stoppedAt: "jd", stages };
    safe.safeFailure = isSafeFailure(safe);
    const ordinary502 = {
      expected: "success",
      stoppedAt: "match",
      stages: buildExplicitStageLedger([
        called("jd", null),
        called("match", null, { status: 502, data: null }),
      ]),
      safeFailure: false,
    };
    ordinary502.safeFailure = isSafeFailure(ordinary502);
    expect(safe.safeFailure).toBe(true);
    expect(ordinary502.safeFailure).toBe(false);
    expect(summarizeSafeFailures([safe, ordinary502])).toBe(1);
  });

  it("AS10 preserves explicit states through JSON serialization", () => {
    const artifact = {
      stages: buildExplicitStageLedger([called("match", null)]),
      invariantAudit: buildInvariantAudit(false, null),
      completedAudit: buildInvariantAudit(true, { check: false }),
      passedAudit: buildInvariantAudit(true, { check: true }),
    };
    const restored = JSON.parse(JSON.stringify(artifact));
    expect(JSON.stringify(restored)).toContain("not_called");
    expect(JSON.stringify(restored)).toContain("unknown");
    expect(JSON.stringify(restored)).toContain("not_run");
    expect(JSON.stringify(restored)).toContain("fail");
    expect(JSON.stringify(restored)).toContain("pass");
  });
});

describe("Phase 2 acceptance capability preflight", () => {
  it("PF1 permits execution when every required route proves capture", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const moduleName = String(url).split("/api/")[1].split("/")[0];
      return enabledResponse(moduleName);
    });
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const execute = vi.fn(async () => 5);
    expect(preflight.available).toBe(true);
    expect(await executeAfterPreflight(preflight, execute)).toEqual({
      executed: true,
      modelCalls: 5,
      error: null,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("PF2 fails before execution when Match capability is missing", async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).includes("/match/")
        ? Response.json(
            { data: null, error: { code: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE } },
            { status: 503 },
          )
        : enabledResponse("module"),
    );
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const execute = vi.fn(async () => 1);
    expect(await executeAfterPreflight(preflight, execute)).toEqual({
      executed: false,
      modelCalls: 0,
      error: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("PF3 fails before execution when Strength/Gap capability is missing", async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).includes("/strength-gap/")
        ? Response.json(
            { data: null, error: { code: ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE } },
            { status: 503 },
          )
        : enabledResponse("module"),
    );
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const execute = vi.fn(async () => 1);
    const result = await executeAfterPreflight(preflight, execute);
    expect(result.modelCalls).toBe(0);
    expect(result.error).toBe(ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("ISSUE-032 precheck-path restabilization", () => {
  it("P32-1 keeps all-unavailable preflight before business execution", async () => {
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl: vi.fn(async () => unavailableResponse()),
    });
    const execute = vi.fn(async () => 1);

    expect(preflight).toMatchObject({
      status: "failed",
      available: false,
      modelCalls: 0,
    });
    expect(preflight.capabilities).toHaveLength(5);
    expect(preflight.capabilities.every((item) => item.rejectedOutputCapture === false)).toBe(true);
    expect(await executeAfterPreflight(preflight, execute)).toMatchObject({
      executed: false,
      modelCalls: 0,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("P32-2 materializes all six expected stages on preflight failure", () => {
    const artifact = preflightFailureArtifact({ available: false });
    expect(artifact.stages).toHaveLength(6);
    expect(artifact.stages.every((stage) =>
      stage.callState === "not_called" && stage.resultState === "not_run"
    )).toBe(true);
  });

  it("P32-3 preserves every expected stage name in serialized JSON", () => {
    const serialized = JSON.stringify(preflightFailureArtifact({ available: false }));
    for (const stage of ["jd", "profile", "match", "recommendation", "strengthGap", "greeting"]) {
      expect(serialized).toContain(`\"stage\":\"${stage}\"`);
    }
  });

  it("P32-4 records unexecuted invariant audit as not_run and null", () => {
    expect(preflightFailureArtifact({ available: false }).invariantAudit).toEqual({
      status: "not_run",
      values: null,
      passed: null,
    });
  });

  it("P32-5 keeps every stage lifecycle at not_run", () => {
    const { stages } = preflightFailureArtifact({ available: false });
    for (const stage of stages) {
      expect(stage.attempts).toEqual({ state: "not_run", count: null });
      expect(stage.repair).toEqual({ state: "not_run", attempts: null });
      expect(stage.fallback).toEqual({ state: "not_run", attempts: null });
    }
  });

  it("P32-6 records business, model, and downstream calls as known zero", () => {
    expect(preflightFailureArtifact({ available: false }).summary).toMatchObject({
      businessCallCount: 0,
      stageCalls: 0,
      modelCalls: 0,
      modelCallsBeforeBusinessExecution: 0,
      downstreamCallsAfterFailure: 0,
    });
  });

  it("P32-7 does not count a precondition failure as product safeFailure", () => {
    const artifact = preflightFailureArtifact({ available: false });
    expect(artifact.executionState).toBe("preflight_failed");
    expect(artifact.safeFailure).toBe(false);
    expect(artifact.summary.safeFailures).toBe(0);
  });

  it("P32-8 keeps a complete ledger when one capability is missing", async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).includes("/match/") ? unavailableResponse() : enabledResponse("module")
    );
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const execute = vi.fn(async () => 1);
    const artifact = preflightFailureArtifact(preflight);

    expect(await executeAfterPreflight(preflight, execute)).toMatchObject({
      executed: false,
      modelCalls: 0,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(artifact.stages).toHaveLength(6);
    expect(artifact.stages.every((stage) => stage.callState === "not_called")).toBe(true);
  });

  it("P32-9 proceeds only when all capabilities are available", async () => {
    const preflight = await probeAcceptanceCapabilities({
      baseUrl: "http://localhost",
      fetchImpl: vi.fn(async () => enabledResponse("module")),
    });
    const execute = vi.fn(async () => 6);

    expect(await executeAfterPreflight(preflight, execute)).toEqual({
      executed: true,
      modelCalls: 6,
      error: null,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("P32-10 preserves the preflight-failure state through serialization", () => {
    const restored = JSON.parse(JSON.stringify(preflightFailureArtifact({ available: false })));
    expect(restored.executionState).toBe("preflight_failed");
    expect(restored.invariantAudit).toMatchObject({ status: "not_run", passed: null });
    expect(restored.summary).toMatchObject({ businessCallCount: 0, modelCalls: 0 });
    expect(restored.stages.every((stage) =>
      stage.callState === "not_called" && stage.resultState === "not_run"
    )).toBe(true);
  });

  it("P32-11 preserves the verified business-stage failure path", () => {
    const stages = buildExplicitStageLedger([
      called("jd", { upstreamAttempts: 1 }),
      called("profile", { upstreamAttempts: 1, profileRepairAttempted: false }),
      called("match", { upstreamAttempts: 2, matchRepairAttempted: true, matchRepairSucceeded: false }, {
        status: 502,
        data: null,
      }),
    ]);
    expect(stages.find((stage) => stage.stage === "match")).toMatchObject({
      callState: "called",
      resultState: "failed",
      repair: { state: "failed", attempts: 1 },
    });
    expect(stages.slice(3).every((stage) => stage.resultState === "not_run")).toBe(true);
    expect(downstreamCallsAfterFailure(stages)).toBe(0);
  });

  it("P32-12 preserves successful-chain state construction", () => {
    const stages = buildExplicitStageLedger([
      called("jd", { upstreamAttempts: 1 }),
      called("profile", { upstreamAttempts: 1, profileRepairAttempted: false }),
      called("match", { upstreamAttempts: 1, matchRepairAttempted: false }),
      called("recommendation", { upstreamAttempts: 1, recommendationRepairAttempted: false }),
      called("strengthGap", { upstreamAttempts: 1, strengthGapRepairAttempted: false }),
      called("greeting", {
        upstreamAttempts: 1,
        personalizedGreetingRepairAttempted: false,
        personalizedGreetingSafeFallbackUsed: false,
        phase1GreetingFallbackUsed: false,
      }),
    ]);
    expect(stages.every((stage) =>
      stage.callState === "called" && stage.resultState === "completed"
    )).toBe(true);
    expect(buildInvariantAudit(true, { integrity: true })).toMatchObject({
      status: "pass",
      passed: true,
    });
  });

  it("reconstructs the immutable current preflight artifact with the fixed state model", () => {
    const historical = JSON.parse(readFileSync(
      new URL(
        "../docs/acceptance-artifacts/phase-2-4/phase-2-4-post-035-036-rb-05.json",
        import.meta.url,
      ),
      "utf8",
    ));
    const reconstructed = buildPreflightFailureArtifact({
      phase: historical.phase,
      suite: historical.suite,
      implementationCommit: historical.implementationCommit,
      generatedAt: historical.generatedAt,
      runPolicy: historical.runPolicy,
      baseUrl: historical.baseUrl,
      preflight: historical.preflight,
    });

    expect(reconstructed.executionState).toBe(historical.executionState);
    expect(reconstructed.stages).toHaveLength(6);
    expect(reconstructed.stages.every((stage) => stage.resultState === "not_run")).toBe(true);
    expect(reconstructed.summary).toMatchObject({
      businessCallCount: 0,
      modelCalls: 0,
      downstreamCallsAfterFailure: 0,
    });
    expect(reconstructed.invariantAudit).toMatchObject({
      status: "not_run",
      passed: null,
    });
    expect(historical).not.toHaveProperty("stages");
  });
});
