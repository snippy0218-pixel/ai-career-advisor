import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import {
  buildExplicitStageLedger,
  buildInvariantAudit,
  downstreamCallsAfterFailure,
  isSafeFailure,
  probeAcceptanceCapabilities,
} from "./phase-2-4-runner-utils.mjs";
import {
  buildPhase25FixtureManifest,
  loadPhase1Fixtures,
  PHASE2_FIXTURES,
} from "./phase-2-5-fixtures.mjs";
import {
  adjudicatePhase2Expectation,
  acceptedStageOutput,
  buildProductScorecardTemplate,
  inspectPhase1Result,
  inspectPhase2Invariants,
  isPhase25InfrastructureFailure,
  summarizeStageLifecycle,
} from "./phase-2-5-runner-utils.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const baseUrl = (args.get("--base-url") ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const suite = args.get("--suite") ?? "all";
if (!new Set(["phase1", "phase2", "all"]).has(suite)) {
  throw new Error("--suite must be phase1, phase2, or all");
}
const repetitions = Number(args.get("--repetitions") ?? "3");
const dryRun = args.get("--dry-run") === "true";
if (!dryRun && repetitions !== 3) {
  throw new Error("formal Phase 2.5 acceptance requires exactly 3 repetitions");
}
const implementationCommit = args.get("--implementation-commit") ?? "WORKTREE";
const runId = args.get("--run-id") ?? `phase-2-5-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const artifactRoot = resolve(
  args.get("--artifact-root") ?? `docs/acceptance-artifacts/phase-2-5/${runId}`,
);

const modelConfiguration = {
  provider: "DeepSeek",
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  temperature: { jd: 0.2, profile: 0.2, match: 0.1, recommendation: 0.1, strengthGap: 0.1, greeting: 0.1 },
  maxOutputTokens: { jd: 4096, profile: 4096, match: 8192, recommendation: 4096, strengthGap: 8192, greeting: 4096 },
  totalTimeoutMs: { jd: 60_000, profile: 60_000, match: 90_000, recommendation: 90_000, strengthGap: 90_000, greeting: 90_000 },
  repairPolicy: "released single targeted repair path; no top-level replacement sample",
};
const fixtureManifest = buildPhase25FixtureManifest();
const runManifest = {
  schemaVersion: "phase-2-5-run-manifest-v1",
  phase: "2.5",
  runId,
  implementationCommit,
  suite,
  repetitions,
  dryRun,
  baseUrl,
  fixtureSchemaVersion: fixtureManifest.schemaVersion,
  fixtureManifestSha256: fixtureManifest.manifestSha256,
  modelConfiguration,
  policy: {
    phase1: "TC-01..10 x 3 complete matrix",
    phase2: "TC-P2-01..14 x 3 complete full-chain matrix",
    cherryPick: false,
    fourthRun: false,
    partialRerunComposition: false,
    incrementalEvidenceWrite: true,
  },
};

async function persistJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeDiagnostics(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return { diagnosticsDecodeError: true };
  }
}

const diagnosticHeaders = {
  profile: "x-profile-acceptance-diagnostics",
  match: "x-match-acceptance-diagnostics",
  recommendation: "x-recommendation-acceptance-diagnostics",
  strengthGap: "x-strength-gap-acceptance-diagnostics",
  greeting: "x-greeting-acceptance-diagnostics",
};

async function requestStage(stage, path, body) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const latencyMs = Math.round(performance.now() - started);
    const payload = await response.json().catch(() => null);
    return {
      stage,
      callState: "called",
      completionState: response.ok && payload?.data ? "completed" : "failed",
      status: response.status,
      latencyMs,
      requestId: response.headers.get("x-request-id"),
      diagnostics: diagnosticHeaders[stage]
        ? decodeDiagnostics(response.headers.get(diagnosticHeaders[stage]))
        : null,
      acceptanceDiagnostics: payload?.acceptanceDiagnostics ?? null,
      data: payload?.data ?? null,
      error: payload?.error ?? null,
      failureClassification:
        response.ok && payload?.data
          ? null
          : payload?.error?.code ?? (payload ? "HTTP_FAILURE" : "NON_JSON_RESPONSE"),
    };
  } catch (error) {
    return {
      stage,
      callState: "called",
      completionState: "failed",
      status: null,
      latencyMs: Math.round(performance.now() - started),
      requestId: null,
      diagnostics: null,
      acceptanceDiagnostics: null,
      data: null,
      error: { code: "RUNNER_TRANSPORT_FAILURE", message: error instanceof Error ? error.message : "unknown transport failure" },
      failureClassification: "infrastructure_transport_failure",
    };
  }
}

function stageEvidence(stage) {
  return {
    stage: stage.stage,
    callState: stage.callState,
    completionState: stage.completionState,
    httpStatus: stage.status,
    latencyMs: stage.latencyMs,
    requestId: stage.requestId,
    output: acceptedStageOutput(stage),
    rawAndRepairEvidence: stage.acceptanceDiagnostics?.outputEvidence ?? null,
    normalization: stage.acceptanceDiagnostics?.normalizationActions ?? stage.acceptanceDiagnostics?.normalizedRepairOutput ?? null,
    validatorDiagnostics: stage.acceptanceDiagnostics?.validationIssues ?? stage.acceptanceDiagnostics?.issues ?? null,
    diagnostics: stage.diagnostics,
    acceptanceDiagnostics: stage.acceptanceDiagnostics,
    error: stage.error,
    failureClassification: stage.failureClassification,
  };
}

function classifyFailure(stages) {
  const failed = stages.find((stage) => stage.completionState === "failed");
  if (!failed) return null;
  return {
    stage: failed.stage,
    category: failed.failureClassification,
    infrastructure: isPhase25InfrastructureFailure(failed.failureClassification),
    httpStatus: failed.status,
    error: failed.error,
  };
}

async function stopForInfrastructureFailure(result, completedContentSamples) {
  if (!result.failure?.infrastructure) return;
  const artifact = {
    schemaVersion: "phase-2-5-infrastructure-failure-v1",
    runId,
    implementationCommit,
    fixtureManifestSha256: fixtureManifest.manifestSha256,
    failedExecutionId: result.executionId,
    completedContentSamples,
    failedAttemptCountsAsContentSample: false,
    additionalScheduledRequestsAfterFailure: 0,
    failure: result.failure,
    stage: result.stage ?? result.stages?.find((item) => item.stage === result.failure.stage) ?? null,
  };
  await persistJson(resolve(artifactRoot, "infrastructure-failure.json"), artifact);
  throw new Error(
    `INFRASTRUCTURE_FAILURE at ${result.executionId}; contentSamples=${completedContentSamples}; batch stopped`,
  );
}

async function runPhase1Case(fixture, repetition) {
  const executionId = `${fixture.id}-R${repetition}`;
  const stage = await requestStage("jd", "/api/analyze", { jdText: fixture.jdText });
  const audit = stage.data ? inspectPhase1Result(fixture.jdText, stage.data) : { passed: false, checks: null };
  const result = {
    schemaVersion: "phase-2-5-phase1-result-v1",
    runId,
    executionId,
    fixtureId: fixture.id,
    repetition,
    implementationCommit,
    input: {
      jdCharacters: fixture.jdText.length,
      jdSha256: fixture.expectedSha256,
      source: fixture.source,
    },
    expected: fixture.expected,
    stage: stageEvidence(stage),
    finalOutput: stage.data,
    audit,
    failure: classifyFailure([stage]),
    passed: stage.status === 200 && audit.passed,
  };
  await persistJson(resolve(artifactRoot, "phase1", `${executionId}.json`), result);
  return result;
}

const phase2StageConfig = [
  ["jd", "/api/analyze", (state) => ({ jdText: state.jdText })],
  ["profile", "/api/profile/analyze", (state) => ({ profileText: state.profileText })],
  ["match", "/api/match/analyze", (state) => ({ jobAnalysis: state.jd, candidateProfile: state.profile })],
  ["recommendation", "/api/recommendation/analyze", (state) => ({ matchCore: state.match })],
  ["strengthGap", "/api/strength-gap/analyze", (state) => ({ matchCore: state.match })],
  ["greeting", "/api/greeting/analyze", (state) => ({ candidateProfile: state.profile, matchCore: state.match, recommendation: state.recommendation, strengthGap: state.strengthGap })],
];

async function runPhase2Case(fixture, repetition) {
  const executionId = `${fixture.id}-R${repetition}`;
  const state = { jdText: fixture.jdText, profileText: fixture.profileText };
  const calledStages = [];
  let stoppedAt = null;
  for (const [stage, path, body] of phase2StageConfig) {
    const response = await requestStage(stage, path, body(state));
    calledStages.push(response);
    if (response.status !== 200 || response.data === null) {
      stoppedAt = stage;
      break;
    }
    state[stage] = response.data;
  }
  const explicitLedger = buildExplicitStageLedger(calledStages);
  const completed = !stoppedAt && Boolean(state.greeting);
  const finalOutput = completed
    ? { jobAnalysis: state.jd, candidateProfile: state.profile, matchCore: state.match, recommendation: state.recommendation, strengthGap: state.strengthGap, greeting: state.greeting }
    : null;
  const invariantAudit = buildInvariantAudit(
    completed,
    completed ? inspectPhase2Invariants(fixture, finalOutput).values : null,
  );
  const execution = {
    completed,
    finalOutput,
    safeFailure: false,
    stoppedAt,
    stages: explicitLedger,
  };
  execution.safeFailure = isSafeFailure(execution);
  const expectation = adjudicatePhase2Expectation(fixture, execution);
  const result = {
    schemaVersion: "phase-2-5-phase2-result-v1",
    runId,
    executionId,
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    repetition,
    implementationCommit,
    input: fixture.input,
    expected: fixture.expected,
    coverage: fixture.coverage,
    completed,
    stoppedAt,
    downstreamCallsAfterFailure: downstreamCallsAfterFailure(explicitLedger),
    safeFailure: execution.safeFailure,
    failure: classifyFailure(calledStages),
    stages: explicitLedger.map((ledgerStage) => {
      const called = calledStages.find((item) => item.stage === ledgerStage.stage);
      return called ? { ...ledgerStage, ...stageEvidence(called) } : ledgerStage;
    }),
    downstreamState: completed
      ? "complete"
      : `stopped_after_${stoppedAt ?? "preflight"}`,
    finalOutput,
    invariantAudit,
    expectation,
    productScorecard: buildProductScorecardTemplate(),
    passed:
      expectation.passed &&
      (completed ? invariantAudit.passed === true : execution.safeFailure) &&
      downstreamCallsAfterFailure(explicitLedger) === 0,
  };
  await persistJson(resolve(artifactRoot, "phase2", `${executionId}.json`), result);
  return result;
}

function latencySummary(results) {
  const valuesByStage = new Map();
  for (const result of results) {
    const stages = result.stages ?? [result.stage];
    for (const stage of stages) {
      if (typeof stage.latencyMs !== "number") continue;
      const values = valuesByStage.get(stage.stage) ?? [];
      values.push(stage.latencyMs);
      valuesByStage.set(stage.stage, values);
    }
  }
  return Object.fromEntries(
    [...valuesByStage.entries()].map(([stage, values]) => [
      stage,
      {
        samples: values.length,
        minimumMs: Math.min(...values),
        averageMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        maximumMs: Math.max(...values),
      },
    ]),
  );
}

await persistJson(resolve(artifactRoot, "run-manifest.json"), runManifest);
await persistJson(resolve(artifactRoot, "fixture-manifest.json"), fixtureManifest);
if (dryRun) {
  process.stdout.write(`Phase 2.5 dry-run manifest PASS; ${artifactRoot}\n`);
  process.exit(0);
}

let preflight = null;
if (suite === "phase2" || suite === "all") {
  preflight = await probeAcceptanceCapabilities({ baseUrl });
  await persistJson(resolve(artifactRoot, "preflight.json"), preflight);
  if (!preflight.available) {
    await persistJson(resolve(artifactRoot, "infrastructure-failure.json"), {
      schemaVersion: "phase-2-5-infrastructure-failure-v1",
      runId,
      implementationCommit,
      requestCount: 0,
      modelCalls: 0,
      contentSamples: 0,
      preflight,
    });
    throw new Error("ACCEPTANCE_DIAGNOSTICS_UNAVAILABLE; contentSamples=0");
  }
}

const results = { phase1: [], phase2: [] };
if (suite === "phase1" || suite === "all") {
  for (const fixture of loadPhase1Fixtures()) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const result = await runPhase1Case(fixture, repetition);
      await stopForInfrastructureFailure(result, results.phase1.length + results.phase2.length);
      results.phase1.push(result);
      process.stdout.write(`${result.executionId} ${result.passed ? "PASS" : "FAIL"}\n`);
    }
  }
}
if (suite === "phase2" || suite === "all") {
  for (const fixture of PHASE2_FIXTURES) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const result = await runPhase2Case(fixture, repetition);
      await stopForInfrastructureFailure(result, results.phase1.length + results.phase2.length);
      results.phase2.push(result);
      process.stdout.write(`${result.executionId} ${result.passed ? "PASS" : "FAIL"}\n`);
    }
  }
}

const allResults = [...results.phase1, ...results.phase2];
const summary = {
  schemaVersion: "phase-2-5-acceptance-summary-v1",
  runManifest,
  preflight,
  generatedAt: new Date().toISOString(),
  resultFiles: {
    phase1: results.phase1.map((item) => `phase1/${item.executionId}.json`),
    phase2: results.phase2.map((item) => `phase2/${item.executionId}.json`),
  },
  counts: {
    scheduled: allResults.length,
    passed: allResults.filter((item) => item.passed).length,
    failed: allResults.filter((item) => !item.passed).length,
    phase1Passed: results.phase1.filter((item) => item.passed).length,
    phase1Scheduled: results.phase1.length,
    phase2Passed: results.phase2.filter((item) => item.passed).length,
    phase2Scheduled: results.phase2.length,
    completedChains: results.phase2.filter((item) => item.completed).length,
    safeFailures: results.phase2.filter((item) => item.safeFailure).length,
    downstreamCallsAfterFailure: results.phase2.reduce(
      (sum, item) => sum + item.downstreamCallsAfterFailure,
      0,
    ),
  },
  metrics: {
    latency: latencySummary(allResults),
    profileRepairs: summarizeStageLifecycle(results.phase2, "profile", "repair"),
    matchRepairs: summarizeStageLifecycle(results.phase2, "match", "repair"),
    recommendationRepairs: summarizeStageLifecycle(results.phase2, "recommendation", "repair"),
    strengthGapRepairs: summarizeStageLifecycle(results.phase2, "strengthGap", "repair"),
    greetingRepairs: summarizeStageLifecycle(results.phase2, "greeting", "repair"),
    hrSafeFallback: {
      disposition: "report_only_non_blocking",
      requests: summarizeStageLifecycle(results.phase2, "greeting", "personalizedFallback"),
      phase1FallbackRequests: summarizeStageLifecycle(results.phase2, "greeting", "phase1Fallback"),
    },
  },
  passed: allResults.length > 0 && allResults.every((item) => item.passed),
};
await persistJson(resolve(artifactRoot, "summary.json"), summary);
process.stdout.write(
  `Phase 2.5 acceptance ${summary.counts.passed}/${summary.counts.scheduled}; summary ${resolve(artifactRoot, "summary.json")}\n`,
);
if (!summary.passed) process.exitCode = 1;
