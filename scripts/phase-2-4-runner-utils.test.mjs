import { describe, expect, it, vi } from "vitest";

import {
  ACCEPTANCE_CAPABILITY_HEADER,
  ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE,
  aggregateLifecycle,
  buildExplicitStageLedger,
  buildInvariantAudit,
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
