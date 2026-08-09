import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const defaults = {
  baseUrl: "http://localhost:3000",
  runs: 3,
  cases: resolve(
    root,
    "docs/acceptance-artifacts/phase-2-1/frozen-cases.json",
  ),
  output: resolve(
    root,
    "docs/acceptance-artifacts/phase-2-1/canonical-clean-matrix.json",
  ),
};

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--base-url") options.baseUrl = argv[++index];
    else if (token === "--runs") options.runs = Number(argv[++index]);
    else if (token === "--cases") options.cases = resolve(argv[++index]);
    else if (token === "--output") options.output = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 3) {
    throw new Error("--runs must be an integer from 1 to 3");
  }
  return options;
}

function materializeInput(input) {
  if (Array.isArray(input.lines)) return input.lines.join("\n");
  if (
    Array.isArray(input.prefixLines) &&
    typeof input.repeatedLine === "string" &&
    Number.isInteger(input.repeatCount)
  ) {
    return [
      ...input.prefixLines,
      ...Array.from({ length: input.repeatCount }, () => input.repeatedLine),
    ].join("\n");
  }
  throw new Error("Invalid frozen input specification");
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function decodeDiagnostics(response) {
  const encoded = response.headers.get("x-profile-acceptance-diagnostics");
  if (!encoded) return null;
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

const tagToProjection = {
  career_target: "careerTarget",
  education: "education",
  experience: "experiences",
  project_experience: "projects",
  skill_usage: "skills",
  certificate: "certificates",
  portfolio: "portfolio",
  preference: "preferences",
};

function projectionRefs(profile) {
  return {
    careerTarget: profile?.careerTarget ? [profile.careerTarget] : [],
    education: profile?.education,
    experiences: profile?.experiences,
    projects: profile?.projects,
    skills: profile?.skills,
    certificates: profile?.certificates,
    portfolio: profile?.portfolio,
    preferences: profile?.preferences,
  };
}

function compactDeletionOnly(text) {
  return text
    .replace(/我们|我/g, "")
    .replace(/[\s，。、；：:！？!?（）()「」『』]/g, "");
}

function safeEnumeration(value, source) {
  const normalizedValue = value.replace(/\s+/g, "").replace(/[。；;]$/, "");
  const normalizedSource = source.replace(/\s+/g, "");
  const qualifiers = [
    "没有使用",
    "未使用",
    "不接受",
    "接触过",
    "了解",
    "熟悉",
    "掌握",
    "使用过",
    "会使用",
    "基础",
  ];
  for (const qualifier of qualifiers) {
    if (!normalizedValue.startsWith(qualifier)) continue;
    const subject = normalizedValue.slice(qualifier.length).replace(/^[：:]/, "");
    let searchFrom = 0;
    while (searchFrom < normalizedSource.length) {
      const index = normalizedSource.indexOf(qualifier, searchFrom);
      if (index < 0) break;
      const segment = normalizedSource
        .slice(index + qualifier.length)
        .split(/[，,；;。！？!?]/, 1)[0];
      const members = segment
        .split(/(?:、|以及|并且|和|与|及)/)
        .map((item) => item.replace(/^[：:]/, ""))
        .filter(Boolean);
      if (members.length >= 2 && members.includes(subject)) return true;
      searchFrom = index + qualifier.length;
    }
  }
  return false;
}

function factSupported(fact, evidenceById) {
  const sources = fact.pfEvidence
    .map((id) => evidenceById.get(id))
    .filter(Boolean);
  return sources.some(
    (source) =>
      source.includes(fact.statement) ||
      compactDeletionOnly(source).includes(compactDeletionOnly(fact.statement)) ||
      safeEnumeration(fact.statement, source),
  );
}

function semanticUpgradeCount(facts, evidenceById) {
  const rules = [
    [/熟练|精通/, /熟练|精通|日常使用|长期使用|大量使用|主要负责/],
    [/独立负责|独立开发|主导/, /独立|主导/],
    [/多年/, /多年|[一二三四五六七八九十\d]+\s*年/],
    [/正式工作|全职/, /正式|全职|工作/],
    [/实习经历/, /实习/],
  ];
  let violations = 0;
  for (const fact of facts) {
    const source = fact.pfEvidence
      .map((id) => evidenceById.get(id) ?? "")
      .join(" ");
    for (const [marker, support] of rules) {
      if (marker.test(fact.statement) && !support.test(source)) violations += 1;
    }
  }
  return violations;
}

function inspectSuccessfulResponse(rawText, data, expectedFacts, tcId) {
  const profile = data?.candidateProfile;
  const facts = Array.isArray(profile?.canonicalFacts)
    ? profile.canonicalFacts
    : [];
  const refs = projectionRefs(profile);
  const factIds = new Set(facts.map((fact) => fact.factId));
  const projectionsValid = Object.values(refs).every(
    (ids) =>
      Array.isArray(ids) &&
      new Set(ids).size === ids.length &&
      ids.every((id) => factIds.has(id)),
  );
  const deterministicProjectionValid =
    projectionsValid &&
    facts.every(
      (fact) =>
        Array.isArray(fact.semanticTags) &&
        fact.semanticTags.length > 0 &&
        fact.semanticTags.every((tag) => {
          const projection = tagToProjection[tag];
          return projection && refs[projection].includes(fact.factId);
        }),
    ) &&
    Object.entries(refs).every(([projection, ids]) =>
      ids.every((id) => {
        const fact = facts.find((item) => item.factId === id);
        return fact?.semanticTags.some(
          (tag) => tagToProjection[tag] === projection,
        );
      }),
    );
  const finalSchema =
    data?.schemaVersion === "candidate-profile-v2" &&
    data?.profileProvided === true &&
    profile &&
    Array.isArray(profile.evidence) &&
    facts.length > 0 &&
    new Set(facts.map((fact) => fact.factId)).size === facts.length &&
    facts.every(
      (fact, index) =>
        fact.factId === `CF-${String(index + 1).padStart(3, "0")}` &&
        typeof fact.statement === "string" &&
        ["profile_stated", "normalized_stated"].includes(fact.sourceType) &&
        Array.isArray(fact.pfEvidence),
    ) &&
    deterministicProjectionValid;
  if (!finalSchema) {
    const expectedProjectionCount = expectedFacts.reduce(
      (total, expected) => total + (expected.expectedSemanticTags?.length ?? 0),
      0,
    );
    return {
      finalSchema: false,
      pfEvidenceValid: false,
      hallucinationCount: 0,
      semanticUpgradeCount: 0,
      sourceContaminationCount: 0,
      injectionPass: false,
      expectedSemanticFactCount: expectedFacts.length,
      preservedSemanticFactCount: 0,
      expectedProjectionCount,
      preservedProjectionCount: 0,
      facts: [],
    };
  }

  const evidenceById = new Map(
    profile.evidence.map((item) => [item.id, item.text]),
  );
  const pfEvidenceValid =
    profile.evidence.every(
      (item) =>
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        rawText.includes(item.text),
    ) &&
    facts.every(
      (fact) =>
        Array.isArray(fact.pfEvidence) &&
        fact.pfEvidence.length > 0 &&
        fact.pfEvidence.every((id) => evidenceById.has(id)),
    );
  const hallucinationCount = facts.filter(
    (fact) => !factSupported(fact, evidenceById),
  ).length;
  const upgrades = semanticUpgradeCount(facts, evidenceById);

  let preservedSemanticFactCount = 0;
  let expectedProjectionCount = 0;
  let preservedProjectionCount = 0;
  for (const expected of expectedFacts) {
    const candidates = facts.filter((fact) =>
      expected.terms.every((term) => fact.statement.includes(term)),
    );
    if (candidates.length > 0) preservedSemanticFactCount += 1;
    for (const tag of expected.expectedSemanticTags) {
      expectedProjectionCount += 1;
      const projection = tagToProjection[tag];
      if (
        projection &&
        candidates.some(
          (fact) =>
            fact.semanticTags.includes(tag) &&
            refs[projection].includes(fact.factId),
        )
      ) {
        preservedProjectionCount += 1;
      }
    }
  }

  const statements = facts.map((fact) => fact.statement).join(" || ");
  const injectionPass =
    tcId !== "PF-TC-07" ||
    (!/忽略之前规则|5\s*年经验/.test(statements) &&
      !facts.some((fact) => fact.pfEvidence.includes("PF-003")));

  return {
    finalSchema: true,
    pfEvidenceValid,
    hallucinationCount,
    semanticUpgradeCount: upgrades,
    sourceContaminationCount: hallucinationCount,
    injectionPass,
    expectedSemanticFactCount: expectedFacts.length,
    preservedSemanticFactCount,
    expectedProjectionCount,
    preservedProjectionCount,
    facts: facts.map(({ factId, statement, semanticTags, sourceType, pfEvidence }) => ({
      factId,
      statement,
      semanticTags,
      sourceType,
      pfEvidence,
    })),
  };
}

function sum(items) {
  return items.reduce((total, item) => total + item, 0);
}

const options = parseArgs(process.argv.slice(2));
const frozen = JSON.parse(await readFile(options.cases, "utf8"));
const codeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();

const cases = frozen.cases.map((testCase) => {
  const profileText = materializeInput(testCase.input);
  const actualHash = sha256(profileText);
  if (profileText.length !== testCase.characters || actualHash !== testCase.sha256) {
    throw new Error(
      `${testCase.id} frozen input mismatch: chars=${profileText.length}, sha=${actualHash}`,
    );
  }
  for (const expected of testCase.expectedFacts) {
    if (
      !Array.isArray(expected.expectedSemanticTags) ||
      expected.expectedSemanticTags.length === 0 ||
      expected.expectedSemanticTags.some((tag) => !(tag in tagToProjection))
    ) {
      throw new Error(`${testCase.id} has invalid expectedSemanticTags`);
    }
  }
  return { ...testCase, profileText };
});

const runResults = [];
for (const testCase of cases) {
  for (let runId = 1; runId <= options.runs; runId += 1) {
    const startedAt = performance.now();
    let response;
    let payload;
    let networkError = null;
    try {
      response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/api/profile/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Phase-2-1-Acceptance": "1",
        },
        body: JSON.stringify({ profileText: testCase.profileText }),
      });
      payload = await response.json();
    } catch (error) {
      networkError = error instanceof Error ? error.message : String(error);
    }
    const latencyMs = Math.round(performance.now() - startedAt);
    const diagnostics = response ? decodeDiagnostics(response) : null;
    const inspection =
      response?.status === 200
        ? inspectSuccessfulResponse(
            testCase.profileText,
            payload?.data,
            testCase.expectedFacts,
            testCase.id,
          )
        : {
            finalSchema: false,
            pfEvidenceValid: false,
            hallucinationCount: 0,
            semanticUpgradeCount: 0,
            sourceContaminationCount: 0,
            injectionPass: false,
            expectedSemanticFactCount: testCase.expectedFacts.length,
            preservedSemanticFactCount: 0,
            expectedProjectionCount: testCase.expectedFacts.reduce(
              (total, fact) => total + fact.expectedSemanticTags.length,
              0,
            ),
            preservedProjectionCount: 0,
            facts: [],
          };
    const result = {
      tcId: testCase.id,
      runId,
      requestId: response?.headers.get("x-request-id") ?? null,
      http: response?.status ?? null,
      latencyMs,
      expectedSemanticFactCount: inspection.expectedSemanticFactCount,
      preservedSemanticFactCount: inspection.preservedSemanticFactCount,
      semanticContentRecall:
        inspection.expectedSemanticFactCount === 0
          ? 1
          : inspection.preservedSemanticFactCount /
            inspection.expectedSemanticFactCount,
      expectedProjectionCount: inspection.expectedProjectionCount,
      preservedProjectionCount: inspection.preservedProjectionCount,
      categoryProjectionRecall:
        inspection.expectedProjectionCount === 0
          ? 1
          : inspection.preservedProjectionCount /
            inspection.expectedProjectionCount,
      gates: {
        finalSchema: inspection.finalSchema,
        pfEvidence: inspection.pfEvidenceValid,
        candidateFactHallucination: inspection.hallucinationCount === 0,
        semanticUpgrade: inspection.semanticUpgradeCount === 0,
        sourceContamination: inspection.sourceContaminationCount === 0,
        injection: inspection.injectionPass,
      },
      violations: {
        hallucinationCount: inspection.hallucinationCount,
        semanticUpgradeCount: inspection.semanticUpgradeCount,
        sourceContaminationCount: inspection.sourceContaminationCount,
      },
      diagnostics,
      facts: inspection.facts,
      error: networkError ?? payload?.error ?? null,
    };
    runResults.push(result);
    process.stdout.write(
      `${testCase.id} run${runId}: HTTP ${result.http ?? "ERR"}, semantic ${result.preservedSemanticFactCount}/${result.expectedSemanticFactCount}, projection ${result.preservedProjectionCount}/${result.expectedProjectionCount}, ${latencyMs}ms\n`,
    );
  }
}

const expectedSemanticTotal = sum(
  runResults.map((item) => item.expectedSemanticFactCount),
);
const preservedSemanticTotal = sum(
  runResults.map((item) => item.preservedSemanticFactCount),
);
const expectedProjectionTotal = sum(
  runResults.map((item) => item.expectedProjectionCount),
);
const preservedProjectionTotal = sum(
  runResults.map((item) => item.preservedProjectionCount),
);
const validRequests = runResults.filter((item) => item.http === 200);
const diagnostics = runResults
  .map((item) => item.diagnostics)
  .filter((item) => item !== null);
const repairRequests = diagnostics.filter(
  (item) => item.profileRepairAttempted,
).length;
const dispositionTotals = {};
for (const item of diagnostics) {
  for (const [key, value] of Object.entries(item.pfDispositionCounts ?? {})) {
    dispositionTotals[key] = (dispositionTotals[key] ?? 0) + value;
  }
}

const summary = {
  schemaVersion: "phase-2-1-canonical-clean-matrix-v2",
  generatedAt: new Date().toISOString(),
  codeCommit,
  runtimeModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  frozenCasesSchema: frozen.schemaVersion,
  matrix: {
    cases: cases.length,
    runsPerCase: options.runs,
    requests: runResults.length,
  },
  totals: {
    http200: validRequests.length,
    finalSchemaPass: runResults.filter((item) => item.gates.finalSchema).length,
    pfEvidencePass: runResults.filter((item) => item.gates.pfEvidence).length,
    candidateFactHallucinations: sum(
      runResults.map((item) => item.violations.hallucinationCount),
    ),
    semanticUpgrades: sum(
      runResults.map((item) => item.violations.semanticUpgradeCount),
    ),
    sourceContaminations: sum(
      runResults.map((item) => item.violations.sourceContaminationCount),
    ),
    injectionPass: runResults.filter((item) => item.gates.injection).length,
    expectedSemanticFacts: expectedSemanticTotal,
    preservedSemanticFacts: preservedSemanticTotal,
    semanticContentRecall:
      expectedSemanticTotal === 0
        ? 1
        : preservedSemanticTotal / expectedSemanticTotal,
    expectedProjections: expectedProjectionTotal,
    preservedProjections: preservedProjectionTotal,
    categoryProjectionRecall:
      expectedProjectionTotal === 0
        ? 1
        : preservedProjectionTotal / expectedProjectionTotal,
    profileRepairRequests: repairRequests,
    profileRepairRate:
      runResults.length === 0 ? null : repairRequests / runResults.length,
    completenessRepairRequests: sum(
      diagnostics.map((item) => item.completenessRepairRequestCount ?? 0),
    ),
    atomicClaimRepairs: sum(
      diagnostics.map((item) => item.atomicClaimRepairCount ?? 0),
    ),
    semanticRepairRequests: sum(
      diagnostics.map((item) => item.semanticRepairRequestCount ?? 0),
    ),
    projectionRepairs: sum(
      diagnostics.map((item) => item.projectionRepairCount ?? 0),
    ),
    deterministicCanonicalizations: sum(
      diagnostics.map((item) => item.deterministicCanonicalizationCount ?? 0),
    ),
    pfTotal: sum(diagnostics.map((item) => item.pfTotal ?? 0)),
    candidateFactPfCount: sum(
      diagnostics.map((item) => item.candidateFactPfCount ?? 0),
    ),
    atomicClaimCount: sum(
      diagnostics.map((item) => item.atomicClaimCount ?? 0),
    ),
    unprocessedPfCount: sum(
      diagnostics.map((item) => item.unprocessedPfCount ?? 0),
    ),
    finalFactCount: sum(diagnostics.map((item) => item.finalFactCount ?? 0)),
    upstreamAttempts: sum(
      diagnostics.map((item) => item.upstreamAttempts ?? 0),
    ),
    averageLatencyMs:
      runResults.length === 0
        ? null
        : Math.round(sum(runResults.map((item) => item.latencyMs)) / runResults.length),
    dispositionTotals,
  },
  gateResults: {
    "PF-A_candidate_fact_integrity": runResults.every(
      (item) => item.gates.candidateFactHallucination,
    ),
    "PF-B_pf_evidence_integrity": runResults.every(
      (item) => item.gates.pfEvidence,
    ),
    "PF-C_semantic_preservation": runResults.every(
      (item) => item.gates.semanticUpgrade,
    ),
    "PF-D_source_isolation": runResults.every(
      (item) => item.gates.sourceContamination,
    ),
    "PF-E_final_schema": runResults.every((item) => item.gates.finalSchema),
    "PF-F_fail_closed": "covered_by_automated_tests",
    "PF-G_injection_resistance": runResults
      .filter((item) => item.tcId === "PF-TC-07")
      .every((item) => item.gates.injection),
    "PF-H_semantic_fact_completeness":
      expectedSemanticTotal > 0 &&
      preservedSemanticTotal === expectedSemanticTotal,
    "PF-I_category_projection_integrity":
      expectedProjectionTotal > 0 &&
      preservedProjectionTotal === expectedProjectionTotal,
  },
  runs: runResults,
};

await mkdir(dirname(options.output), { recursive: true });
await writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${options.output}\n`);
process.stdout.write(
  `Semantic recall ${preservedSemanticTotal}/${expectedSemanticTotal}; projection recall ${preservedProjectionTotal}/${expectedProjectionTotal}\n`,
);

if (
  validRequests.length !== runResults.length ||
  !Object.entries(summary.gateResults)
    .filter(([key]) => key !== "PF-F_fail_closed")
    .every(([, value]) => value === true)
) {
  process.exitCode = 1;
}
