import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(
  root,
  "docs/acceptance-artifacts/phase-2-2a/match-core-clean-matrix.json",
);
const outputPath = resolve(
  root,
  "docs/acceptance-artifacts/phase-2-2a/requirement-set-audit.json",
);

const expectedByCase = {
  "MC-TC-01": [
    { requirementId: "REQ-001", requirement: "本科及以上", requirementType: "hard_requirement" },
  ],
  "MC-TC-02": [
    { requirementId: "REQ-001", requirement: "本科及以上", requirementType: "hard_requirement" },
  ],
  "MC-TC-03": [
    { requirementId: "REQ-001", requirement: "熟练使用 SQL", requirementType: "core_requirement" },
  ],
  "MC-TC-04": [
    { requirementId: "REQ-001", requirement: "熟练使用 Python", requirementType: "core_requirement" },
  ],
  "MC-TC-05": [
    { requirementId: "REQ-001", requirement: "2年以上产品相关经验", requirementType: "hard_requirement" },
  ],
  "MC-TC-06": [
    { requirementId: "REQ-001", requirement: "2年以上全职产品经理工作经验", requirementType: "hard_requirement" },
  ],
  "MC-TC-07": [
    { requirementId: "REQ-001", requirement: "2年以上全职产品经理工作经验", requirementType: "hard_requirement" },
  ],
  "MC-TC-08": [
    { requirementId: "REQ-001", requirement: "使用 Python 处理数据", requirementType: "core_requirement" },
    { requirementId: "REQ-002", requirement: "具有数据处理项目经验", requirementType: "core_requirement" },
  ],
  "MC-TC-09": [
    { requirementId: "REQ-001", requirement: "有 SQL 项目经验者优先", requirementType: "preferred_requirement" },
  ],
  "MC-TC-10": [
    { requirementId: "REQ-001", requirement: "熟悉数据分析", requirementType: "core_requirement" },
  ],
};

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ requirementId: value, count }));
}

const artifact = JSON.parse(await readFile(sourcePath, "utf8"));
const runs = artifact.runs.map((run) => {
  const expected = expectedByCase[run.tcId];
  if (!expected) throw new Error(`No frozen expected set for ${run.tcId}`);
  const finalItems = Array.isArray(run.data?.matchItems) ? run.data.matchItems : [];
  const expectedById = new Map(expected.map((item) => [item.requirementId, item]));
  const expectedIds = new Set(expectedById.keys());
  const finalIds = finalItems.map((item) => item.requirementId);
  const finalIdSet = new Set(finalIds);
  const missingRequirementIds = [...expectedIds].filter((id) => !finalIdSet.has(id));
  const duplicateRequirements = duplicates(finalIds);
  const fabricatedRequirementIds = [...finalIdSet].filter((id) => !expectedIds.has(id));
  const typeMutations = finalItems.flatMap((item) => {
    const expectedItem = expectedById.get(item.requirementId);
    return expectedItem && expectedItem.requirementType !== item.requirementType
      ? [
          {
            requirementId: item.requirementId,
            expected: expectedItem.requirementType,
            actual: item.requirementType,
          },
        ]
      : [];
  });
  const contentMutations = finalItems.flatMap((item) => {
    const expectedItem = expectedById.get(item.requirementId);
    return expectedItem && expectedItem.requirement !== item.requirement
      ? [
          {
            requirementId: item.requirementId,
            expected: expectedItem.requirement,
            actual: item.requirement,
          },
        ]
      : [];
  });
  const pass =
    finalItems.length === expected.length &&
    missingRequirementIds.length === 0 &&
    duplicateRequirements.length === 0 &&
    fabricatedRequirementIds.length === 0 &&
    typeMutations.length === 0 &&
    contentMutations.length === 0;
  return {
    tcId: run.tcId,
    run: run.run,
    requestId: run.requestId,
    inputSha256: run.inputSha256,
    expectedRequirementCount: expected.length,
    finalMatchItemCount: finalItems.length,
    missingRequirementIds,
    duplicateRequirements,
    fabricatedRequirementIds,
    typeMutations,
    contentMutations,
    pass,
  };
});

const sum = (values) => values.reduce((total, value) => total + value, 0);
const summary = {
  generatedAt: new Date().toISOString(),
  sourceArtifact: "match-core-clean-matrix.json",
  sourceImplementationCommit: artifact.implementationCommit,
  auditMethod:
    "Offline deterministic comparison of each frozen case's expected REQ identity/content/type set against persisted Final matchItems; no model calls.",
  requestCount: runs.length,
  expectedRequirementCount: sum(runs.map((run) => run.expectedRequirementCount)),
  finalMatchItemCount: sum(runs.map((run) => run.finalMatchItemCount)),
  missingRequirementCount: sum(runs.map((run) => run.missingRequirementIds.length)),
  duplicateRequirementCount: sum(runs.map((run) => run.duplicateRequirements.length)),
  fabricatedRequirementCount: sum(
    runs.map((run) => run.fabricatedRequirementIds.length),
  ),
  typeMutationCount: sum(runs.map((run) => run.typeMutations.length)),
  contentMutationCount: sum(runs.map((run) => run.contentMutations.length)),
  passedRequests: runs.filter((run) => run.pass).length,
  gateResults: {
    "M-J_requirement_set_integrity": runs.every((run) => run.pass),
    coverage100Percent: runs.every(
      (run) =>
        run.finalMatchItemCount === run.expectedRequirementCount &&
        run.missingRequirementIds.length === 0,
    ),
    uniquenessExactlyOnce: runs.every(
      (run) => run.duplicateRequirements.length === 0,
    ),
    noFabrication: runs.every(
      (run) => run.fabricatedRequirementIds.length === 0,
    ),
    typeFidelity: runs.every((run) => run.typeMutations.length === 0),
    contentIdentityFidelity: runs.every(
      (run) => run.contentMutations.length === 0,
    ),
  },
  runs,
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);
process.stdout.write(
  `M-J ${summary.passedRequests}/${summary.requestCount}; expected/final ${summary.expectedRequirementCount}/${summary.finalMatchItemCount}; missing ${summary.missingRequirementCount}; duplicate ${summary.duplicateRequirementCount}; fabricated ${summary.fabricatedRequirementCount}; type mutation ${summary.typeMutationCount}\n`,
);
if (!summary.gateResults["M-J_requirement_set_integrity"]) process.exitCode = 1;
