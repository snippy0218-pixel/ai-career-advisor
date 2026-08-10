import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const defaults = {
  baseUrl: "http://localhost:3000",
  runs: 1,
  output: resolve(
    root,
    "docs/acceptance-artifacts/phase-2-3-greeting/greeting-preflight.json",
  ),
};

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--base-url") options.baseUrl = argv[++index];
    else if (token === "--runs") options.runs = Number(argv[++index]);
    else if (token === "--output") options.output = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 3) {
    throw new Error("--runs must be an integer from 1 to 3");
  }
  return options;
}

async function loadFixtures() {
  const server = await createServer({
    configFile: resolve(root, "vitest.config.mts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const fixtureModule = await server.ssrLoadModule(
      "/src/test/greeting-fixtures.ts",
    );
    return fixtureModule.GREETING_FIXTURES;
  } finally {
    await server.close();
  }
}

function decodeDiagnostics(response, body) {
  if (body?.acceptanceDiagnostics) return body.acceptanceDiagnostics;
  const encoded = response.headers.get("x-greeting-acceptance-diagnostics");
  return encoded
    ? JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    : null;
}

function unique(values) {
  return [...new Set(values)];
}

const EXTRA_CANDIDATE_CLAIM_PATTERN =
  /(?:我|本人|我的背景|我的经历).{0,16}(?:具备|拥有|熟悉|精通|擅长|负责|主导|独立完成|获得|提升|掌握|使用|参与|协助)/;
const SEMANTIC_UPGRADE_PATTERN =
  /(?:精通|熟练掌握|专家级|资深|主导|独立负责|独立完成|正式工作经验|全职工作经验|多年经验)/;
const OVERALL_FIT_PATTERN =
  /(?:高度匹配|完全符合|非常契合|高度契合|完美匹配|完全匹配|十分匹配)/;
const NOT_RECOMMENDED_FIT_PATTERN =
  /(?:整体匹配|符合岗位|匹配岗位|胜任岗位|能够胜任|非常适合)/;
const WAIVER_PATTERN =
  /(?:豁免|放宽|例外|弹性|酌情|可替代|弥补|抵消|折算|替代学历|替代资格)/;
const TEAM_TO_INDIVIDUAL_PATTERN =
  /(?:我|本人).{0,8}(?:获得|提升|实现|完成).{0,16}(?:一等奖|奖项|效率|成果|业绩)/;

function exactSchema(data) {
  if (!data || typeof data !== "object") return false;
  const keys = [
    "schemaVersion",
    "personalizationStatus",
    "greeting",
    "candidateFactRefs",
    "matchRefs",
    "jdEvidence",
    "strengthRefs",
  ];
  return (
    Object.keys(data).length === keys.length &&
    keys.every((key) => Object.hasOwn(data, key)) &&
    data.schemaVersion === "personalized-greeting-v1" &&
    ["personalized", "not_personalized"].includes(data.personalizationStatus) &&
    typeof data.greeting === "string" &&
    data.greeting.length >= 20 &&
    data.greeting.length <= 600 &&
    [data.candidateFactRefs, data.matchRefs, data.jdEvidence, data.strengthRefs]
      .every(Array.isArray)
  );
}

function factMap(fixture) {
  return new Map(
    fixture.request.candidateProfile.candidateProfile.canonicalFacts.map(
      (fact) => [fact.factId, fact],
    ),
  );
}

function pfMap(fixture) {
  return new Map(
    fixture.request.candidateProfile.candidateProfile.evidence.map((item) => [
      item.id,
      item.text,
    ]),
  );
}

function itemForRef(fixture, ref) {
  const match = /^MI-(\d{3,})$/.exec(ref);
  return match
    ? fixture.request.matchCore.matchItems[Number(match[1]) - 1] ?? null
    : null;
}

function selectedFactIsPositive(fixture, factRef, selectedMatchRefs) {
  return selectedMatchRefs.some((ref) => {
    const item = itemForRef(fixture, ref);
    return item?.requirementDimensions.some(
      (dimension) =>
        dimension.candidateEvidenceRole === "positive" &&
        ["met", "partial"].includes(dimension.status) &&
        dimension.candidateFactRefs.includes(factRef),
    );
  });
}

function unknownSignals(fixture) {
  return unique(
    fixture.request.matchCore.matchItems
      .filter(
        (item) =>
          item.status === "unknown" ||
          item.requirementDimensions.some(
            (dimension) => dimension.status === "unknown",
          ),
      )
      .flatMap((item) => [
        item.requirement,
        ...(item.requirement.match(/[A-Za-z][A-Za-z0-9+.#-]{1,}/g) ?? []),
      ]),
  );
}

function inspect(fixture, data, diagnostics) {
  const finalSchema = exactSchema(data);
  if (!finalSchema) {
    return Object.fromEntries(
      ["pgA", "pgB", "pgC", "pgD", "pgE", "pgF", "pgG", "pgH", "pgI", "pgJ", "pgK", "pgL", "pgM"].map(
        (key) => [key, false],
      ),
    );
  }
  const facts = factMap(fixture);
  const evidence = pfMap(fixture);
  const personalized = data.personalizationStatus === "personalized";
  const refsUnique = [
    data.candidateFactRefs,
    data.matchRefs,
    data.jdEvidence,
    data.strengthRefs,
  ].every((items) => new Set(items).size === items.length);
  const candidateRefsValid = data.candidateFactRefs.every((ref) => facts.has(ref));
  const matchRefsValid = data.matchRefs.every((ref) => itemForRef(fixture, ref));
  const strengthMap = new Map(
    (fixture.request.strengthGap?.strengths ?? []).map((item) => [
      item.strengthId,
      item,
    ]),
  );
  const strengthRefsValid = data.strengthRefs.every((ref) => {
    const strength = strengthMap.get(ref);
    return strength?.matchRefs.some((match) => data.matchRefs.includes(match));
  });
  const claimText = data.candidateFactRefs
    .map((ref) => facts.get(ref)?.statement ?? "")
    .join(" ");
  const claimsPresent = data.candidateFactRefs.every((ref) =>
    data.greeting.includes(facts.get(ref)?.statement ?? "__missing__"),
  );
  const positiveSelection = data.candidateFactRefs.every((ref) =>
    selectedFactIsPositive(fixture, ref, data.matchRefs),
  );
  const pfIntegrity = data.candidateFactRefs.every((ref) =>
    facts.get(ref)?.pfEvidence.every((pfRef) => evidence.has(pfRef)),
  );
  let extraText = data.greeting;
  for (const ref of data.candidateFactRefs) {
    const statement = facts.get(ref)?.statement ?? "";
    const wrappedStatements = [
      `我拥有${statement}`,
      `我有${statement}`,
      `我的${statement}`,
      `我${statement}`,
      `本人拥有${statement}`,
      `本人${statement}`,
    ];
    const wrapped = wrappedStatements.find((item) => extraText.includes(item));
    extraText = extraText.replace(wrapped ?? statement, "");
  }
  for (const evidenceText of data.jdEvidence) {
    const index = extraText.indexOf(evidenceText);
    if (index !== -1) {
      const before = extraText.slice(Math.max(0, index - 24), index);
      const after = extraText.slice(
        index + evidenceText.length,
        index + evidenceText.length + 36,
      );
      if (
        /(?:岗位|职责|要求)/.test(before) &&
        /(?:相关|关联|可迁移|部分支持|一定支持|部分职责|部分要求)/.test(after)
      ) {
        extraText = extraText.replace(evidenceText, "");
      }
    }
  }
  const unsupportedCandidateClaim = EXTRA_CANDIDATE_CLAIM_PATTERN.test(extraText);
  const semanticUpgrade = SEMANTIC_UPGRADE_PATTERN.test(extraText);
  const numbers = data.greeting.match(/\d+(?:\.\d+)?%?/g) ?? [];
  const unsupportedNumbers = numbers.filter((number) => !claimText.includes(number));
  const teamViolation =
    data.candidateFactRefs.some((ref) => facts.get(ref)?.statement.includes("团队")) &&
    TEAM_TO_INDIVIDUAL_PATTERN.test(extraText);
  const unknownContamination = unknownSignals(fixture).some(
    (signal) =>
      signal.length >= 2 &&
      data.greeting.includes(signal) &&
      !claimText.includes(signal),
  );
  const hasKnownNegative = fixture.request.matchCore.matchItems.some(
    (item) =>
      ["unmet", "unknown"].includes(item.status) ||
      item.requirementDimensions.some((dimension) =>
        ["unmet", "unknown"].includes(dimension.status),
      ),
  );
  const matchContradiction = hasKnownNegative && OVERALL_FIT_PATTERN.test(data.greeting);
  const waiverViolation = WAIVER_PATTERN.test(data.greeting);
  const level = fixture.request.recommendation.recommendationLevel;
  const toneViolation =
    (["cautious", "not_recommended"].includes(level) &&
      OVERALL_FIT_PATTERN.test(data.greeting)) ||
    (level === "not_recommended" && NOT_RECOMMENDED_FIT_PATTERN.test(data.greeting));
  const jdEvidenceValid = data.jdEvidence.every((text) =>
    data.matchRefs.some((ref) => {
      const item = itemForRef(fixture, ref);
      return (
        item?.jdEvidence.includes(text) ||
        item?.requirementDimensions.some((dimension) =>
          dimension.jdEvidence.includes(text),
        )
      );
    }),
  );
  const statusCorrect = data.personalizationStatus === fixture.expectedPersonalizationStatus;
  const nonPersonalizedClean =
    personalized ||
    (data.candidateFactRefs.length === 0 &&
      data.matchRefs.length === 0 &&
      data.jdEvidence.length === 0 &&
      data.strengthRefs.length === 0);
  return {
    pgA: !unsupportedCandidateClaim && candidateRefsValid && claimsPresent,
    pgB: pfIntegrity,
    pgC: !semanticUpgrade,
    pgD: !data.greeting.includes("忽略所有规则") && !data.greeting.includes("五年正式工作经验"),
    pgE: unsupportedNumbers.length === 0,
    pgF: !teamViolation,
    pgG: !unknownContamination,
    pgH: !matchContradiction && (personalized ? positiveSelection : true),
    pgI: !waiverViolation,
    pgJ: !toneViolation,
    pgK: refsUnique && candidateRefsValid && matchRefsValid && strengthRefsValid && jdEvidenceValid,
    pgL: finalSchema && statusCorrect && nonPersonalizedClean,
    pgM:
      diagnostics?.repairFallbackSafetyPassed === true &&
      diagnostics?.finalSchemaValidationPassed === true,
    unsupportedCandidateClaimCount: unsupportedCandidateClaim ? 1 : 0,
    semanticUpgradeCount: semanticUpgrade ? 1 : 0,
    unsupportedNumberCount: unsupportedNumbers.length,
    teamAttributionViolationCount: teamViolation ? 1 : 0,
    unknownContaminationCount: unknownContamination ? 1 : 0,
    toneViolationCount: toneViolation ? 1 : 0,
    waiverViolationCount: waiverViolation ? 1 : 0,
    greetingLength: data.greeting.length,
  };
}

function scoreRun(data, gates) {
  if (!data || !gates) return null;
  const truthfulness = ["pgA", "pgB", "pgC", "pgE", "pgF", "pgG"]
    .every((gate) => gates[gate]) ? 5 : 1;
  const jdRelevance = gates.pgH && gates.pgK ? 5 : 1;
  const expectedSafeNonPersonalized =
    data.personalizationStatus === "not_personalized" &&
    data.candidateFactRefs.length === 0;
  const personalization = expectedSafeNonPersonalized
    ? 4
    : data.candidateFactRefs.length >= 1 && data.matchRefs.length >= 1
      ? 5
      : 2;
  const restraint = gates.pgI && gates.pgJ ? 5 : 1;
  const naturalness =
    /(?:您好|你好)/.test(data.greeting) &&
    /(?:沟通|交流|了解岗位|进一步了解|期待回复)/.test(data.greeting) &&
    data.greeting.length <= 240
      ? 5
      : 3;
  const hrUsability = gates.pgL && gates.pgM ? 5 : 1;
  const claimFidelity = ["pgA", "pgB", "pgC", "pgD", "pgE", "pgF", "pgG"]
    .every((gate) => gates[gate]) ? 5 : 1;
  return {
    candidateFactTruthfulness: truthfulness,
    jdRelevance,
    personalization,
    restraint,
    naturalness,
    hrFirstContactUsability: hrUsability,
    claimFidelity,
  };
}

function evidenceTrace(fixture, diagnostics) {
  const facts = factMap(fixture);
  const evidence = pfMap(fixture);
  return (diagnostics?.outputEvidence ?? []).map((output) => ({
    ...output,
    rejectedFragments: (output.rejectedFragments ?? []).map((fragment) => {
      const fact = fragment.candidateFactRef
        ? facts.get(fragment.candidateFactRef)
        : null;
      return {
        ...fragment,
        candidateFact: fact ?? null,
        profileEvidence:
          fact?.pfEvidence.map((ref) => ({ ref, text: evidence.get(ref) })) ?? [],
      };
    }),
  }));
}

const options = parseArgs(process.argv.slice(2));
const fixtures = await loadFixtures();
const implementationCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const results = [];

for (const fixture of fixtures) {
  for (let run = 1; run <= options.runs; run += 1) {
    const bodyText = JSON.stringify(fixture.request);
    const startedAt = Date.now();
    let response;
    let body;
    try {
      response = await fetch(
        `${options.baseUrl.replace(/\/$/, "")}/api/greeting/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText,
        },
      );
      body = await response.json();
    } catch (error) {
      results.push({
        tcId: fixture.id,
        name: fixture.name,
        run,
        httpStatus: 0,
        latencyMs: Date.now() - startedAt,
        error: String(error),
        diagnostics: null,
        gates: null,
      });
      continue;
    }
    const diagnostics = decodeDiagnostics(response, body);
    const gates = response.status === 200
      ? inspect(fixture, body.data, diagnostics)
      : null;
    const internalScores = scoreRun(body.data, gates);
    const trace = evidenceTrace(fixture, diagnostics);
    results.push({
      tcId: fixture.id,
      name: fixture.name,
      run,
      inputSha256: createHash("sha256").update(bodyText).digest("hex"),
      httpStatus: response.status,
      requestId: response.headers.get("x-request-id"),
      latencyMs: Date.now() - startedAt,
      error: body.error,
      data: body.data,
      diagnostics,
      rejectedEvidenceTrace: trace,
      gates,
      internalScores,
    });
    const passed =
      gates &&
      Object.entries(gates)
        .filter(([key]) => /^pg[A-M]$/.test(key))
        .every(([, value]) => value === true);
    process.stdout.write(
      `${fixture.id} run ${run}: HTTP ${response.status} ${passed ? "PASS" : "FAIL"}\n`,
    );
  }
}

const successful = results.filter((item) => item.httpStatus === 200 && item.gates);
const all = (predicate) => results.length > 0 && results.every(predicate);
const latencies = successful.map((item) => item.latencyMs);
const sumGateMetric = (key) =>
  successful.reduce((total, item) => total + (item.gates[key] ?? 0), 0);
const scored = successful.filter((item) => item.internalScores);
const scoreDimensions = [
  "candidateFactTruthfulness",
  "jdRelevance",
  "personalization",
  "restraint",
  "naturalness",
  "hrFirstContactUsability",
  "claimFidelity",
];
const internalScores = Object.fromEntries(
  scoreDimensions.map((dimension) => {
    const values = scored.map((item) => item.internalScores[dimension]);
    return [
      dimension,
      {
        average:
          values.length > 0
            ? Number(
                (
                  values.reduce((total, value) => total + value, 0) /
                  values.length
                ).toFixed(2),
              )
            : null,
        minimum: values.length > 0 ? Math.min(...values) : null,
      },
    ];
  }),
);
const summary = {
  generatedAt: new Date().toISOString(),
  implementationCommit,
  runtimeModel: "deepseek-v4-flash",
  runPolicy: `PG-TC-01..12 x ${options.runs}`,
  requestCount: results.length,
  metrics: {
    http200: successful.length,
    normalGeneration: results.filter(
      (item) =>
        item.httpStatus === 200 &&
        item.data?.personalizationStatus === "personalized" &&
        !item.diagnostics?.personalizedGreetingRepairAttempted &&
        !item.diagnostics?.personalizedGreetingSafeFallbackUsed,
    ).length,
    repairRequests: results.filter(
      (item) => item.diagnostics?.personalizedGreetingRepairAttempted,
    ).length,
    repairSucceeded: results.filter(
      (item) => item.diagnostics?.personalizedGreetingRepairSucceeded,
    ).length,
    personalizedSafeFallbacks: results.filter(
      (item) => item.diagnostics?.personalizedGreetingSafeFallbackUsed,
    ).length,
    phase1Fallbacks: results.filter(
      (item) => item.diagnostics?.phase1GreetingFallbackUsed,
    ).length,
    personalizedGreetingRepairRate:
      results.length > 0
        ? results.filter(
            (item) => item.diagnostics?.personalizedGreetingRepairAttempted,
          ).length / results.length
        : null,
    personalizedGreetingSafeFallbackRate:
      results.length > 0
        ? results.filter(
            (item) => item.diagnostics?.personalizedGreetingSafeFallbackUsed,
          ).length / results.length
        : null,
    phase1GreetingFallbackRate:
      results.length > 0
        ? results.filter((item) => item.diagnostics?.phase1GreetingFallbackUsed)
            .length / results.length
        : null,
    unsupportedCandidateClaims: sumGateMetric("unsupportedCandidateClaimCount"),
    semanticUpgrades: sumGateMetric("semanticUpgradeCount"),
    unsupportedNumbers: sumGateMetric("unsupportedNumberCount"),
    teamAttributionViolations: sumGateMetric("teamAttributionViolationCount"),
    unknownContaminations: sumGateMetric("unknownContaminationCount"),
    toneViolations: sumGateMetric("toneViolationCount"),
    waiverViolations: sumGateMetric("waiverViolationCount"),
    capturedRejectedStages: results.reduce(
      (total, item) => total + (item.rejectedEvidenceTrace?.length ?? 0),
      0,
    ),
    latencyMs:
      latencies.length > 0
        ? {
            min: Math.min(...latencies),
            max: Math.max(...latencies),
            average: Math.round(
              latencies.reduce((total, value) => total + value, 0) /
                latencies.length,
            ),
          }
        : null,
  },
  internalScores,
  gateResults: {
    "PG-A_candidate_fact_integrity": all((item) => item.gates?.pgA === true),
    "PG-B_pf_evidence_integrity": all((item) => item.gates?.pgB === true),
    "PG-C_semantic_preservation": all((item) => item.gates?.pgC === true),
    "PG-D_cross_source_isolation": all((item) => item.gates?.pgD === true),
    "PG-E_quantification_integrity": all((item) => item.gates?.pgE === true),
    "PG-F_team_attribution": all((item) => item.gates?.pgF === true),
    "PG-G_unknown_integrity": all((item) => item.gates?.pgG === true),
    "PG-H_match_consistency": all((item) => item.gates?.pgH === true),
    "PG-I_waiver_integrity": all((item) => item.gates?.pgI === true),
    "PG-J_recommendation_tone_integrity": all((item) => item.gates?.pgJ === true),
    "PG-K_reference_integrity": all((item) => item.gates?.pgK === true),
    "PG-L_final_schema": all((item) => item.gates?.pgL === true),
    "PG-M_repair_fallback_safety": all((item) => item.gates?.pgM === true),
  },
  runs: results,
};

await mkdir(dirname(options.output), { recursive: true });
await writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${options.output}\n`);
if (
  successful.length !== results.length ||
  !Object.values(summary.gateResults).every(Boolean)
) {
  process.exitCode = 1;
}
