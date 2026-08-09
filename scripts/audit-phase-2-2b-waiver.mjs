import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  root,
  "docs/acceptance-artifacts/phase-2-2b/recommendation-core-clean-matrix.json",
);
const outputPath = resolve(
  root,
  "docs/acceptance-artifacts/phase-2-2b/recommendation-waiver-audit.json",
);

const targets = {
  "RC-TC-02": { matchItemRef: "MI-001", status: "unmet", waiverEvidence: false },
  "RC-TC-03": { matchItemRef: "MI-001", status: "unknown", waiverEvidence: false },
  "RC-TC-06": { matchItemRef: "MI-001", status: "unknown", waiverEvidence: false },
  "RC-TC-07": { matchItemRef: "MI-001", status: "unmet", waiverEvidence: true },
  "RC-TC-09": { matchItemRef: "MI-002", status: "unknown", waiverEvidence: false },
};

const waiverPattern =
  /(?:豁免|放宽|例外|弹性|灵活|酌情|特殊政策|替代条件|可替代|弥补|抵消)/i;
const strictnessPattern = /(?:严格(?:筛选)?门槛|严格性|是否为严格|是否属于严格|岗位要求口径|条件口径|要求口径)/i;
const candidateInformationPattern =
  /(?:请补充|请确认)(?!.*(?:豁免|放宽|例外|弹性|特殊政策|替代条件)).*(?:学历|资格|证书|技能|经历|经验|具体情况)/i;
const unmetClaimPattern = /(?:未满足|不满足|不符合|未达成|未达标|无法满足)/i;

function textEntries(data) {
  return [
    { field: "summary", text: data.summary, matchItemRefs: [] },
    ...data.limitations.map((entry, index) => ({
      field: `limitations.${index}.content`,
      text: entry.content,
      matchItemRefs: entry.matchItemRefs,
    })),
    ...data.questionsToConfirm.map((entry, index) => ({
      field: `questionsToConfirm.${index}.question`,
      text: entry.question,
      matchItemRefs: entry.matchItemRefs,
    })),
  ];
}

const artifact = JSON.parse(await readFile(inputPath, "utf8"));
const records = artifact.runs
  .filter((run) => Object.hasOwn(targets, run.tcId))
  .map((run) => {
    const target = targets[run.tcId];
    const texts = textEntries(run.data).map((entry) => {
      const waiverClaim = waiverPattern.test(entry.text);
      const strictnessConfirmation = strictnessPattern.test(entry.text);
      const candidateInformationConfirmation = candidateInformationPattern.test(
        entry.text,
      );
      const unknownToUnmetDrift =
        target.status === "unknown" && unmetClaimPattern.test(entry.text);
      const classifications = [];
      if (waiverClaim && target.waiverEvidence) {
        classifications.push("supported_waiver_claim");
      }
      if (waiverClaim && !target.waiverEvidence) {
        classifications.push("unsupported_waiver_claim");
      }
      if (strictnessConfirmation) {
        classifications.push("strictness_confirmation");
      }
      if (candidateInformationConfirmation) {
        classifications.push("candidate_information_confirmation");
      }
      if (unknownToUnmetDrift) {
        classifications.push("unknown_to_unmet_semantic_drift");
      }
      return { ...entry, classifications };
    });
    const classifications = [
      ...new Set(texts.flatMap((entry) => entry.classifications)),
    ];
    return {
      tcId: run.tcId,
      run: run.run,
      requestId: run.requestId,
      recommendationLevel: run.data.recommendationLevel,
      hardRequirement: target,
      classifications,
      texts,
    };
  });

const countRecords = (classification) =>
  records.filter((record) => record.classifications.includes(classification))
    .length;
const unsupported = records.filter((record) =>
  record.classifications.includes("unsupported_waiver_claim"),
);

const audit = {
  generatedAt: new Date().toISOString(),
  auditMode: "offline; zero model calls; exact persisted matrix text",
  sourceArtifact: "recommendation-core-clean-matrix.json",
  sourceImplementationCommit: artifact.implementationCommit,
  sourceRequestCount: artifact.requestCount,
  auditedHardRequirementRequests: records.length,
  statusCounts: {
    hardUnmet: records.filter((record) => record.hardRequirement.status === "unmet")
      .length,
    hardUnknown: records.filter(
      (record) => record.hardRequirement.status === "unknown",
    ).length,
  },
  classificationCountsByRequest: {
    strictnessConfirmation: countRecords("strictness_confirmation"),
    candidateInformationConfirmation: countRecords(
      "candidate_information_confirmation",
    ),
    supportedWaiverClaim: countRecords("supported_waiver_claim"),
    unsupportedWaiverClaim: unsupported.length,
    unknownToUnmetSemanticDrift: countRecords(
      "unknown_to_unmet_semantic_drift",
    ),
  },
  issue026InitialEvidence: unsupported.map((record) => ({
    tcId: record.tcId,
    run: record.run,
    requestId: record.requestId,
    status: record.hardRequirement.status,
    exactTexts: record.texts
      .filter((entry) =>
        entry.classifications.includes("unsupported_waiver_claim"),
      )
      .map((entry) => ({ field: entry.field, text: entry.text })),
  })),
  records,
};

await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
process.stdout.write(
  `Audited ${records.length} hard-requirement outputs; unsupported waiver=${unsupported.length}; wrote ${outputPath}\n`,
);
