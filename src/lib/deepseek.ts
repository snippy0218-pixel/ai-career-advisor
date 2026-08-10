import {
  adviceEvidenceRepairSchema,
  ANALYSIS_SCHEMA_VERSION,
  coreEvidenceRepairSchema,
  EDITABLE_GENERIC_GREETING_TEMPLATE,
  finalStructureJobAnalysisSchema,
  findInvalidEvidence,
  findHrGreetingBoundaryViolations,
  findNormalizedEvidenceSpans,
  findRequirementSectionContext,
  findSingleSubstitutionEvidenceSpan,
  findUnsupportedGrowthClaims,
  hasCautiousInferenceLanguage,
  hasHardQualifier,
  hasPreferredQualifier,
  hasUnclearQualifierScope,
  hrGreetingRepairSchema,
  isEvidenceInJd,
  jobAnalysisSchema,
  pendingAdviceJobAnalysisSchema,
  pendingCoreJobAnalysisSchema,
  pendingRequirementJobAnalysisSchema,
  PERSONALIZATION_NOTICE,
  PERSONALIZATION_STATUS,
  rawAdviceEvidenceRepairSchema,
  rawCoreEvidenceRepairSchema,
  rawHrGreetingRepairSchema,
  rawJobAnalysisSchema,
  rawRequirementEvidenceRepairSchema,
  requirementEvidenceRepairSchema,
  SAFE_GENERIC_GREETING,
  type AnalyzeJobRequest,
  type JobAnalysis,
  type RawJobAnalysis,
} from "./analysis-schema";
import { stripUnsupportedModifiers } from "./modifier-integrity";
import { ApiError } from "./api-errors";
import {
  buildAdviceEvidenceRepairMessages,
  buildCoreEvidenceRepairMessages,
  buildDeepSeekMessages,
  buildHrGreetingRepairMessages,
  buildRequirementEvidenceRepairMessages,
  type AdviceEvidenceRepairCandidate,
  type CoreEvidenceRepairCandidate,
  type RequirementEvidenceRepairCandidate,
} from "./prompt";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const TOTAL_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 4096;

type FetchLike = typeof fetch;
type DeepSeekMessage = { role: "system" | "user"; content: string };
type RawAdviceReason = RawJobAnalysis["applicationAdvice"]["reasons"][number];
type RawRequirement = RawJobAnalysis["roleProfile"]["requirements"][number];
type RawProfileItem = RawJobAnalysis["roleProfile"]["workCharacteristics"][number];
type RawCoreResponsibility = RawJobAnalysis["coreResponsibilities"][number];

interface DeepSeekChoice {
  finish_reason?: string | null;
  message?: { content?: string | null };
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  usage?: { completion_tokens?: number };
}

interface AdviceRepairCandidate {
  index: number;
  reason: Pick<
    RawAdviceReason,
    "content" | "sourceType" | "verificationQuestion"
  >;
}

interface CoreRepairCandidate {
  index: number;
  responsibility: Omit<RawCoreResponsibility, "evidence">;
}

interface RequirementRepairCandidate {
  index: number;
  requirement: Omit<RawRequirement, "evidence">;
}

export interface AnalysisDiagnostics {
  upstreamAttempts: number;
  jsonParsePassed: boolean;
  rawSchemaValidationPassed: boolean;
  evidenceOverLimitCount: number;
  truncatedEvidenceCount: number;
  recoveredEvidenceCount: number;
  remappedEvidenceCount: number;
  removedInvalidEvidenceCount: number;
  removedDuplicateEvidenceCount: number;
  supplementedRequirementCount: number;
  deduplicatedRequirementCount: number;
  removedEvidenceSamples: Array<{
    path: string;
    evidence: string;
    reason: "no_exact_match" | "ambiguous_span";
  }>;
  targetedRepairAttempted: boolean;
  targetedRepairSucceeded: boolean;
  coreTargetedRepairAttempted: boolean;
  coreTargetedRepairSucceeded: boolean;
  requirementTargetedRepairAttempted: boolean;
  requirementTargetedRepairSucceeded: boolean;
  removedCoreResponsibilities: number;
  hrBoundaryViolationCount: number;
  hrTargetedRepairAttempted: boolean;
  hrTargetedRepairSucceeded: boolean;
  hrRepairUsedSafeFallback: boolean;
  hrBoundaryValidationPassed: boolean;
  truncatedByLength: boolean;
  outputCompletionTokens: number;
  removedRiskSignals: number;
  removedAdviceReasons: number;
  finalSchemaValidationPassed: boolean;
  finalEvidenceValidationPassed: boolean;
  finalValidationPassed: boolean;
}

interface AnalyzeOptions {
  fetchImpl?: FetchLike;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  onDiagnostics?: (diagnostics: AnalysisDiagnostics) => void;
}

interface PreparedAnalysis {
  analysis: unknown;
  repairCandidates: AdviceRepairCandidate[];
  coreRepairCandidates: CoreRepairCandidate[];
  requirementRepairCandidates: RequirementRepairCandidate[];
  removedRiskSignals: number;
  removedAdviceReasons: number;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mapHttpError(status: number) {
  switch (status) {
    case 400:
    case 422:
      return new ApiError("AI_REQUEST_INVALID", 502);
    case 401:
      return new ApiError("AI_AUTH_FAILED", 503);
    case 402:
      return new ApiError("AI_BALANCE_INSUFFICIENT", 503);
    case 429:
      return new ApiError("AI_RATE_LIMITED", 503, true);
    case 500:
    case 503:
      return new ApiError("AI_SERVICE_UNAVAILABLE", 503, true);
    default:
      return new ApiError("AI_SERVICE_UNAVAILABLE", 503);
  }
}

function validateFinishReason(
  finishReason: string | null | undefined,
  diagnostics?: AnalysisDiagnostics,
) {
  if (finishReason === "stop") return;

  console.warn("[deepseek] abnormal finish reason", {
    finishReason: finishReason ?? "missing",
  });

  if (finishReason === "length") {
    console.warn("[deepseek] output truncated by max_tokens");
    if (diagnostics) {
      diagnostics.truncatedByLength = true;
    }
  }

  if (finishReason === "content_filter") {
    throw new ApiError("AI_CONTENT_BLOCKED", 422);
  }

  if (finishReason === "insufficient_system_resource") {
    throw new ApiError("AI_SERVICE_UNAVAILABLE", 503);
  }

  throw new ApiError("AI_OUTPUT_INVALID", 502);
}

function parseJson(content: string, warning: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    console.warn(`[deepseek] ${warning}`);
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

function logSchemaIssues(
  warning: string,
  issues: ReadonlyArray<{ code: string; path: PropertyKey[] }>,
) {
  console.warn(
    `[deepseek] ${warning}`,
    issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
    })),
  );
}

function normalizeEvidence(
  evidence: string[],
  jdText: string,
  diagnostics: AnalysisDiagnostics,
  path = "unknown",
) {
  if (evidence.length > 3) {
    diagnostics.evidenceOverLimitCount += 1;
  }

  const seen = new Set<string>();
  const validEvidence: string[] = [];

  for (const rawEvidence of evidence) {
    const trimmedEvidence = rawEvidence.trim();

    if (isEvidenceInJd(trimmedEvidence, jdText)) {
      if (seen.has(trimmedEvidence)) {
        diagnostics.removedDuplicateEvidenceCount += 1;
        continue;
      }

      seen.add(trimmedEvidence);
      validEvidence.push(trimmedEvidence);
      continue;
    }

    const normalizedSpans = findNormalizedEvidenceSpans(
      trimmedEvidence,
      jdText,
    );

    if (normalizedSpans.length !== 1) {
      // ISSUE-012A: only when no whitespace-normalized candidate exists, try
      // the unique single-character-substitution remap; otherwise fail-closed.
      let recovered: string | null = null;
      if (normalizedSpans.length === 0) {
        recovered = findSingleSubstitutionEvidenceSpan(
          trimmedEvidence,
          jdText,
        );
      }

      if (recovered === null) {
        diagnostics.removedInvalidEvidenceCount += 1;
        if (diagnostics.removedEvidenceSamples.length < 10) {
          diagnostics.removedEvidenceSamples.push({
            path,
            evidence: trimmedEvidence.slice(0, 100),
            reason:
              normalizedSpans.length === 0 ? "no_exact_match" : "ambiguous_span",
          });
        }
        continue;
      }

      diagnostics.remappedEvidenceCount += 1;
      if (seen.has(recovered)) {
        diagnostics.removedDuplicateEvidenceCount += 1;
        continue;
      }

      seen.add(recovered);
      validEvidence.push(recovered);
      continue;
    }

    const recoveredEvidence = normalizedSpans[0];
    diagnostics.recoveredEvidenceCount += 1;

    if (seen.has(recoveredEvidence)) {
      diagnostics.removedDuplicateEvidenceCount += 1;
      continue;
    }

    seen.add(recoveredEvidence);
    validEvidence.push(recoveredEvidence);
  }

  if (validEvidence.length > 3) {
    diagnostics.truncatedEvidenceCount += validEvidence.length - 3;
  }

  return validEvidence.slice(0, 3);
}

type ConfirmQuestion =
  RawJobAnalysis["roleProfile"]["questionsToConfirm"][number];

function buildVerificationQuestion(content: string) {
  const statement = content.replace(/[？?。！!]$/, "");
  return `请向HR确认“${statement}”的具体要求和实际情况？`;
}

function addVerificationQuestion(
  questions: ConfirmQuestion[],
  question: string,
  content: string,
) {
  if (questions.some((item) => item.question === question)) return;
  questions.push({
    question,
    reason: `该结论无法由JD直接确定，需要确认：${content}`,
  });
}

function isDirectConclusion(content: string, evidence: string[]) {
  return evidence.some(
    (item) => item.includes(content) || content.includes(item),
  );
}

function normalizeInferenceContent(content: string) {
  if (hasCautiousInferenceLanguage(content)) return content;
  return `从职责看，可能${content}`;
}

function normalizeGrowthBoundary(content: string, evidence: string[]) {
  if (findUnsupportedGrowthClaims(content, evidence).length === 0) {
    return null;
  }

  return "从职责看，可能接触相关工作；实际参与深度和成长收益需要确认";
}

function requiresHrVerification(content: string) {
  return (
    /(?:团队结构|实际参与深度|培养机制|晋升|业务权重|独立负责|负责模块)/.test(
      content,
    ) &&
    /(?:确认|未说明|未明确|未知|不确定|如何|是否)/.test(content)
  );
}

// ISSUE-020/022: narrow deterministic split for a single requirement whose
// evidence contains a qualifier (hard and/or preferred) that applies to only one
// clearly separable clause, while the other clause is an independent requirement
// (core or the other qualifier). Examples:
//   "具备5年以上…工作经验，有…者优先"        -> hard + preferred
//   "拥有4年以上…工作经验，具备…背景"       -> hard + core
//   "能流利使用英语…，熟悉印尼语者优先"     -> core + preferred
// Returns the two clause fragments when separable; returns null otherwise
// (including inseparable units such as "有5年以上销售经验者优先" and compound
// conditions joined by 并/且/以及/并且 such as "有A，并有B者优先").
function findSeparableQualifierSplit(
  evidenceText: string,
): [string, string] | null {
  if (
    !hasHardQualifier(evidenceText) &&
    !hasPreferredQualifier(evidenceText)
  ) {
    return null;
  }

  const separators = Array.from(
    evidenceText.matchAll(/[，,；;]/g),
    (match) => match.index,
  );

  for (let index = separators.length - 1; index >= 0; index -= 1) {
    const separator = separators[index];
    const first = evidenceText.slice(0, separator).trim();
    const second = evidenceText.slice(separator + 1).trim();
    const firstHard = hasHardQualifier(first);
    const firstPreferred = hasPreferredQualifier(first);
    const secondHard = hasHardQualifier(second);
    const secondPreferred = hasPreferredQualifier(second);
    const firstQualifierCount = (firstHard ? 1 : 0) + (firstPreferred ? 1 : 0);
    const secondQualifierCount = (secondHard ? 1 : 0) + (secondPreferred ? 1 : 0);

    // Protect compound conditions where the qualifier scopes the combination
    // (e.g. "有A，并有B者优先" must stay whole preferred).
    if (/^(?:并|且|以及|并且)/.test(second)) {
      continue;
    }

    const separable =
      (firstQualifierCount === 1 &&
        secondQualifierCount === 1 &&
        firstHard !== secondHard) ||
      (firstQualifierCount === 1 && secondQualifierCount === 0) ||
      (firstQualifierCount === 0 && secondQualifierCount === 1);

    if (separable) {
      return [first, second];
    }
  }

  return null;
}

function normalizeRequirementItems(
  item: RawRequirement,
  jdText: string,
  diagnostics: AnalysisDiagnostics,
  questions: ConfirmQuestion[],
  path: string,
): Array<Omit<RawRequirement, "evidence"> & { evidence: string[] }> {
  const rawEvidence = item.evidence;
  const mixedSplit =
    rawEvidence.length === 1 && isEvidenceInJd(rawEvidence[0], jdText)
      ? findSeparableQualifierSplit(rawEvidence[0])
      : null;

  if (!mixedSplit) {
    return [normalizeRequirement(item, jdText, diagnostics, questions, path)];
  }

  return mixedSplit.map((fragment, fragmentIndex) =>
    normalizeRequirement(
      { ...item, content: fragment, evidence: [fragment] },
      jdText,
      diagnostics,
      questions,
      `${path}.fragment${fragmentIndex}`,
    ),
  );
}

type NormalizedRequirement = Omit<RawRequirement, "evidence"> & {
  evidence: string[];
};

function requirementSectionLines(jdText: string) {
  const lines = jdText.split(/\r?\n/);
  const result: string[] = [];
  let inRequirements = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:任职要求|职位要求|岗位要求|资格要求|基本要求|加分项|优先条件)\s*[：:]?/.test(line)) {
      inRequirements = true;
      const sameLine = line.replace(
        /^(?:任职要求|职位要求|岗位要求|资格要求|基本要求|加分项|优先条件)\s*[：:]?\s*/,
        "",
      );
      if (sameLine) result.push(sameLine);
      continue;
    }
    if (
      inRequirements &&
      /^(?:岗位职责|工作职责|职位描述|工作内容|岗位描述|福利待遇|薪资福利)\s*[：:]?/.test(
        line,
      )
    ) {
      inRequirements = false;
      continue;
    }
    if (inRequirements) result.push(line);
  }

  return result.map((line) =>
    line.replace(/^(?:[（(]?\d+[）).、．]|[-—•·])\s*/, "").trim(),
  );
}

// ISSUE-017: if the model emitted one exact clause of an explicitly separable
// requirement line but silently omitted its sibling clause, restore only that
// verbatim sibling. This is deliberately narrower than a general JD parser.
function supplementSeparableRequirementClauses(
  requirements: NormalizedRequirement[],
  jdText: string,
  diagnostics: AnalysisDiagnostics,
  questions: ConfirmQuestion[],
) {
  const supplemented = [...requirements];
  const isCovered = (fragment: string) =>
    supplemented.some((item) =>
      item.evidence.some(
        (evidence) => evidence === fragment || evidence.includes(fragment),
      ),
    );

  for (const line of requirementSectionLines(jdText)) {
    const split = findSeparableQualifierSplit(line);
    if (!split) continue;
    const covered = split.map(isCovered);
    if (covered.filter(Boolean).length !== 1) continue;
    const missingIndex = covered[0] ? 1 : 0;
    const missing = split[missingIndex];
    if (missing.length < 4 || !isEvidenceInJd(missing, jdText)) continue;
    const source = supplemented.find((item) =>
      item.evidence.some((evidence) => evidence === split[covered[0] ? 0 : 1]),
    );
    if (!source) continue;
    supplemented.push(
      normalizeRequirement(
        { ...source, content: missing, evidence: [missing] },
        jdText,
        diagnostics,
        questions,
        `requirements.supplemented${diagnostics.supplementedRequirementCount}`,
      ),
    );
    diagnostics.supplementedRequirementCount += 1;
  }

  return supplemented;
}

function deduplicateRequirements(
  requirements: NormalizedRequirement[],
  diagnostics: AnalysisDiagnostics,
) {
  const seen = new Set<string>();
  return requirements.filter((item) => {
    const key = `${item.requirementType}\u0000${item.content}\u0000${item.evidence.join("\u0001")}`;
    if (seen.has(key)) {
      diagnostics.deduplicatedRequirementCount += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeProfileItem(
  item: RawProfileItem,
  jdText: string,
  diagnostics: AnalysisDiagnostics,
  questions: ConfirmQuestion[],
  path = "profileItem",
) {
  const evidence = normalizeEvidence(item.evidence, jdText, diagnostics, path);
  let sourceType = item.sourceType;
  const modifierBoundedContent = stripUnsupportedModifiers(item.content, evidence);
  const modifierBoundedExplanation = stripUnsupportedModifiers(
    item.explanation,
    evidence,
  );
  const boundedGrowthContent = normalizeGrowthBoundary(
    modifierBoundedContent,
    evidence,
  );
  const content = boundedGrowthContent ?? modifierBoundedContent;

  if (
    boundedGrowthContent ||
    requiresHrVerification(`${content} ${item.explanation}`)
  ) {
    sourceType = "to_verify";
  }

  if (sourceType === "jd_explicit" && !isDirectConclusion(content, evidence)) {
    sourceType = "inference";
  }

  if (sourceType === "to_verify") {
    const verificationQuestion =
      item.verificationQuestion ?? buildVerificationQuestion(content);
    addVerificationQuestion(questions, verificationQuestion, content);
    return {
      ...item,
      content,
      explanation: modifierBoundedExplanation,
      sourceType,
      evidence,
      verificationQuestion,
    };
  }

  return {
    ...item,
    explanation: modifierBoundedExplanation,
    content:
      sourceType === "inference"
        ? normalizeInferenceContent(content)
        : content,
    sourceType,
    evidence,
    verificationQuestion: null,
  };
}

function normalizeRequirement(
  item: RawRequirement,
  jdText: string,
  diagnostics: AnalysisDiagnostics,
  questions: ConfirmQuestion[],
  path = "requirements",
): Omit<RawRequirement, "evidence"> & { evidence: string[] } {
  const evidence = normalizeEvidence(item.evidence, jdText, diagnostics, path);
  const evidenceText = evidence.join(" ");
  const firstEvidenceIndex = evidence[0]
    ? jdText.indexOf(evidence[0])
    : -1;
  const previousCharacter =
    firstEvidenceIndex > 0 ? jdText[firstEvidenceIndex - 1] : undefined;
  // ISSUE-010: legal list-number boundaries must not be treated as fused text.
  // Besides sentence punctuation, treat whitespace, "、", ".", "．", ")" and "）"
  // (used by "1.本科及以上", "1、本科及以上", "（1）本科及以上", "(1) 本科及以上")
  // as separated clause boundaries.
  const startsInsideUnseparatedClause =
    previousCharacter !== undefined &&
    !/[\s\r\n。；;：:，,、.．)）]/.test(previousCharacter);
  // ISSUE-015: an explicit hard/preferred qualifier must take priority over the
  // mid-sentence-start heuristic. The heuristic only guards genuinely ambiguous
  // text that carries no clear qualifier (e.g. "要求能熟练使用AutoCAD").
  const explicitPreferredQualifier = hasPreferredQualifier(evidenceText);
  const explicitHardQualifier = hasHardQualifier(evidenceText);
  // ISSUE-016: section-level preferred context (加分项/加分条件/优先条件/优先项)
  // is applied deterministically from the JD structure, not from model output.
  const sectionContext =
    firstEvidenceIndex >= 0
      ? findRequirementSectionContext(jdText, firstEvidenceIndex)
      : { isPreferred: false, header: null };
  const sectionPreferred =
    sectionContext.isPreferred &&
    !explicitPreferredQualifier &&
    !explicitHardQualifier;
  const requirementType =
    hasUnclearQualifierScope(evidenceText) ||
    (startsInsideUnseparatedClause &&
      !explicitPreferredQualifier &&
      !explicitHardQualifier &&
      !sectionPreferred)
      ? "unclear"
      : explicitPreferredQualifier
        ? "preferred_requirement"
        : explicitHardQualifier
          ? "hard_requirement"
          : sectionPreferred
            ? "preferred_requirement"
          : "core_requirement";

  if (requirementType === "unclear") {
    const verificationQuestion =
      item.verificationQuestion ?? buildVerificationQuestion(item.content);
    addVerificationQuestion(questions, verificationQuestion, item.content);
    return {
      ...item,
      content: evidence[0] ?? item.content,
      explanation: "原文存在粘连或限定词范围不清，需要向HR确认。",
      requirementType,
      sourceType: "to_verify" as const,
      evidence,
      verificationQuestion,
    };
  }

  if (sectionPreferred) {
    const itemText = evidence[0] ?? item.content;
    const headerEvidence =
      sectionContext.header && !evidence.includes(sectionContext.header)
        ? [sectionContext.header, ...evidence].slice(0, 3)
        : evidence;
    return {
      ...item,
      content: itemText,
      explanation: "JD包含明确的加分项/优先项章节作用域，归为偏好要求。",
      requirementType: "preferred_requirement" as const,
      sourceType: "jd_explicit" as const,
      evidence: headerEvidence,
      verificationQuestion: null,
    };
  }

  return {
    ...item,
    content: evidence[0] ?? item.content,
    explanation:
      requirementType === "hard_requirement"
        ? "JD包含明确限制条件，归为硬性要求。"
        : requirementType === "preferred_requirement"
          ? "JD包含明确的优先或加分限定词，归为偏好要求。"
          : "JD未包含明确的优先或加分限定词，按核心要求展示。",
    requirementType,
    sourceType: "jd_explicit" as const,
    evidence,
    verificationQuestion: null,
  };
}

function normalizeAdviceReason(
  item: RawAdviceReason,
  evidence: string[],
  questions: ConfirmQuestion[],
) {
  let sourceType = item.sourceType;
  const modifierBoundedContent = stripUnsupportedModifiers(item.content, evidence);
  const boundedGrowthContent = normalizeGrowthBoundary(
    modifierBoundedContent,
    evidence,
  );
  const content = boundedGrowthContent ?? modifierBoundedContent;

  if (boundedGrowthContent || requiresHrVerification(content)) {
    sourceType = "to_verify";
  }

  if (sourceType === "jd_explicit" && !isDirectConclusion(content, evidence)) {
    sourceType = "inference";
  }

  if (sourceType === "to_verify") {
    const verificationQuestion =
      item.verificationQuestion ?? buildVerificationQuestion(content);
    addVerificationQuestion(questions, verificationQuestion, content);
    return { ...item, content, sourceType, evidence, verificationQuestion };
  }

  return {
    ...item,
    content:
      sourceType === "inference"
        ? normalizeInferenceContent(content)
        : content,
    sourceType,
    evidence,
    verificationQuestion: null,
  };
}

function prepareAnalysis(
  parsed: unknown,
  jdText: string,
  diagnostics: AnalysisDiagnostics,
): PreparedAnalysis {
  const rawAnalysis = rawJobAnalysisSchema.safeParse(parsed);

  if (!rawAnalysis.success) {
    logSchemaIssues("raw schema validation failed", rawAnalysis.error.issues);
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.rawSchemaValidationPassed = true;

  let removedRiskSignals = 0;
  let removedAdviceReasons = 0;
  const repairCandidates: AdviceRepairCandidate[] = [];
  const coreRepairCandidates: CoreRepairCandidate[] = [];
  const requirementRepairCandidates: RequirementRepairCandidate[] = [];
  const questionsToConfirm: ConfirmQuestion[] = [];

  const coreResponsibilities = rawAnalysis.data.coreResponsibilities.map(
    (item, index) => {
      const evidence = normalizeEvidence(
        item.evidence,
        jdText,
        diagnostics,
        `coreResponsibilities[${index}].evidence`,
      );

      if (evidence.length === 0) {
        coreRepairCandidates.push({
          index,
          responsibility: {
            title: item.title,
            description: item.description,
            sourceType: item.sourceType,
          },
        });
      }

      return {
      ...item,
        evidence,
      };
    },
  );

  const normalizedRequirements: NormalizedRequirement[] = [];
  rawAnalysis.data.roleProfile.requirements.forEach((item, index) => {
    const normalizedItems = normalizeRequirementItems(
      item,
      jdText,
      diagnostics,
      questionsToConfirm,
      `requirements[${index}].evidence`,
    );

    for (const normalized of normalizedItems) {
      normalizedRequirements.push(normalized);
    }
  });
  const requirements = deduplicateRequirements(
    supplementSeparableRequirementClauses(
      normalizedRequirements,
      jdText,
      diagnostics,
      questionsToConfirm,
    ),
    diagnostics,
  );
  requirements.forEach((normalized, index) => {
    if (normalized.evidence.length === 0) {
      requirementRepairCandidates.push({
        index,
        requirement: {
          content: normalized.content,
          explanation: normalized.explanation,
          requirementType: normalized.requirementType,
          sourceType: normalized.sourceType,
          verificationQuestion: normalized.verificationQuestion,
        },
      });
    }
  });
  const workCharacteristics =
    rawAnalysis.data.roleProfile.workCharacteristics.map((item, index) =>
      normalizeProfileItem(
        item,
        jdText,
        diagnostics,
        questionsToConfirm,
        `workCharacteristics[${index}].evidence`,
      ),
    );
  const normalizedRiskSignals = rawAnalysis.data.roleProfile.riskSignals.map(
    (item, index) =>
      normalizeProfileItem(
        item,
        jdText,
        diagnostics,
        questionsToConfirm,
        `riskSignals[${index}].evidence`,
      ),
  );

  const riskSignals = normalizedRiskSignals.flatMap((item) => {
    if (item.evidence.length === 0) {
      removedRiskSignals += 1;
      return [];
    }

    return [item];
  });

  const reasons = rawAnalysis.data.applicationAdvice.reasons.flatMap(
    (item, index) => {
      const evidence = normalizeEvidence(
        item.evidence,
        jdText,
        diagnostics,
        `applicationAdvice.reasons[${index}].evidence`,
      );

      if (evidence.length === 0) {
        removedAdviceReasons += 1;
        repairCandidates.push({
          index,
          reason: {
            content: item.content,
            sourceType: item.sourceType,
            verificationQuestion: item.verificationQuestion,
          },
        });
        return [];
      }

      return [normalizeAdviceReason(item, evidence, questionsToConfirm)];
    },
  );

  const adviceEvidence = reasons.flatMap((item) => item.evidence);
  const modifierBoundedAdviceSummary = stripUnsupportedModifiers(
    rawAnalysis.data.applicationAdvice.summary,
    adviceEvidence,
  );
  const boundedAdviceSummary = normalizeGrowthBoundary(
    modifierBoundedAdviceSummary,
    adviceEvidence,
  );
  const applicationAdviceSummary =
    boundedAdviceSummary ?? modifierBoundedAdviceSummary;
  const applicationAdviceSourceType =
    boundedAdviceSummary || requiresHrVerification(applicationAdviceSummary)
    ? "to_verify"
    : rawAnalysis.data.applicationAdvice.sourceType;
  const applicationAdvice = applicationAdviceSourceType === "to_verify"
    ? (() => {
        const verificationQuestion =
          rawAnalysis.data.applicationAdvice.verificationQuestion ??
          buildVerificationQuestion(applicationAdviceSummary);
        addVerificationQuestion(
          questionsToConfirm,
          verificationQuestion,
          applicationAdviceSummary,
        );
        return {
          ...rawAnalysis.data.applicationAdvice,
          summary: applicationAdviceSummary,
          sourceType: "to_verify" as const,
          verificationQuestion,
          reasons,
        };
      })()
    : {
        ...rawAnalysis.data.applicationAdvice,
        sourceType: "inference" as const,
        summary: hasCautiousInferenceLanguage(
          applicationAdviceSummary,
        )
          ? applicationAdviceSummary
          : `从JD信息看，${applicationAdviceSummary}`,
        verificationQuestion: null,
        reasons,
      };

  for (const question of rawAnalysis.data.roleProfile.questionsToConfirm) {
    if (questionsToConfirm.length >= 8) break;
    const isRequirementClassificationQuestion =
      /(?:必须|硬性|加分项|优先)/.test(question.question);
    const relatesToUnclearRequirement = requirements
      .filter((item) => item.requirementType === "unclear")
      .some((item) =>
        question.question.includes(item.content.slice(0, 8)),
      );

    if (isRequirementClassificationQuestion && !relatesToUnclearRequirement) {
      continue;
    }
    if (
      !questionsToConfirm.some(
        (existing) => existing.question === question.question,
      )
    ) {
      questionsToConfirm.push(question);
    }
  }

  return {
    analysis: {
      ...rawAnalysis.data,
      basicInfo: {
        ...rawAnalysis.data.basicInfo,
        summary: hasCautiousInferenceLanguage(rawAnalysis.data.basicInfo.summary)
          ? rawAnalysis.data.basicInfo.summary
          : `从JD信息看，可能${rawAnalysis.data.basicInfo.summary}`,
        summarySourceType: "inference" as const,
      },
      coreResponsibilities,
      roleProfile: {
        ...rawAnalysis.data.roleProfile,
        requirements,
        workCharacteristics,
        riskSignals,
        questionsToConfirm,
      },
      applicationAdvice,
    },
    repairCandidates,
    coreRepairCandidates,
    requirementRepairCandidates,
    removedRiskSignals,
    removedAdviceReasons,
  };
}

function validateFinalAnalysis(
  analysis: unknown,
  jdText: string,
  diagnostics: AnalysisDiagnostics,
): JobAnalysis {
  const validated = jobAnalysisSchema.safeParse(analysis);

  if (!validated.success) {
    logSchemaIssues("final schema validation failed", validated.error.issues);
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.finalSchemaValidationPassed = true;

  const invalidEvidence = findInvalidEvidence(validated.data, jdText);

  if (invalidEvidence.length > 0) {
    console.warn("[deepseek] evidence validation failed", {
      invalidEvidenceCount: invalidEvidence.length,
    });
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.finalEvidenceValidationPassed = true;

  if (validated.data.schemaVersion !== ANALYSIS_SCHEMA_VERSION) {
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  return validated.data;
}

async function requestCompletion(
  messages: DeepSeekMessage[],
  options: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  timeoutMs: number,
  diagnostics?: AnalysisDiagnostics,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await options.fetchImpl(
      `${options.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          thinking: { type: "disabled" },
          stream: false,
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    let payload: DeepSeekResponse;

    try {
      payload = (await response.json()) as DeepSeekResponse;
    } catch {
      throw new ApiError("AI_EMPTY_RESPONSE", 502, true);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();

    if (!choice || !content) {
      throw new ApiError("AI_EMPTY_RESPONSE", 502, true);
    }

    if (diagnostics && typeof payload.usage?.completion_tokens === "number") {
      diagnostics.outputCompletionTokens = Math.max(
        diagnostics.outputCompletionTokens,
        payload.usage.completion_tokens,
      );
    }

    validateFinishReason(choice.finish_reason, diagnostics);
    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("AI_TIMEOUT", 504);
    }

    throw new ApiError("AI_SERVICE_UNAVAILABLE", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestInitialAnalysis(
  request: AnalyzeJobRequest,
  configuration: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  deadline: number,
  diagnostics: AnalysisDiagnostics,
) {
  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new ApiError("AI_TIMEOUT", 504);
    }

    try {
      diagnostics.upstreamAttempts += 1;
      return await requestCompletion(
        buildDeepSeekMessages(request),
        configuration,
        remaining,
        diagnostics,
      );
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError("AI_SERVICE_UNAVAILABLE", 503);
      lastError = apiError;

      const canRetry =
        attempt === 0 &&
        apiError.autoRetryable &&
        deadline - Date.now() > RETRY_DELAY_MS;

      if (!canRetry) throw apiError;
      await wait(RETRY_DELAY_MS);
    }
  }

  throw lastError ?? new ApiError("AI_SERVICE_UNAVAILABLE", 503);
}

async function repairCoreResponsibilityEvidence(
  request: AnalyzeJobRequest,
  pendingAnalysis: unknown,
  candidates: CoreRepairCandidate[],
  configuration: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  deadline: number,
  diagnostics: AnalysisDiagnostics,
  requestId?: string,
) {
  const pending = pendingCoreJobAnalysisSchema.safeParse(pendingAnalysis);

  if (!pending.success || candidates.length === 0) {
    if (!pending.success) {
      logSchemaIssues(
        "pending core repair schema validation failed",
        pending.error.issues,
      );
    }
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.coreTargetedRepairAttempted = true;
  const repairCandidates: CoreEvidenceRepairCandidate[] = candidates.map(
    ({ index, responsibility }) => ({ index, ...responsibility }),
  );

  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_OUTPUT_INVALID", 502);

    diagnostics.upstreamAttempts += 1;
    const content = await requestCompletion(
      buildCoreEvidenceRepairMessages(request, repairCandidates),
      configuration,
      remaining,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid core evidence repair JSON");
    const rawRepair = rawCoreEvidenceRepairSchema.safeParse(parsed);

    if (!rawRepair.success) {
      logSchemaIssues(
        "raw core evidence repair schema validation failed",
        rawRepair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const normalizedRepair = {
      items: rawRepair.data.items.map((item) =>
        item.action === "replace_evidence"
          ? {
              ...item,
              evidence: normalizeEvidence(
                item.evidence,
                request.jdText,
                diagnostics,
              ),
            }
          : item,
      ),
    };
    const repair = coreEvidenceRepairSchema.safeParse(normalizedRepair);

    if (!repair.success) {
      logSchemaIssues(
        "core evidence repair schema validation failed",
        repair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const actions = new Map(repair.data.items.map((item) => [item.index, item]));
    const coversEveryCandidate =
      actions.size === candidates.length &&
      candidates.every((candidate) => actions.has(candidate.index));

    if (!coversEveryCandidate) throw new ApiError("AI_OUTPUT_INVALID", 502);

    const candidateIndexes = new Set(
      candidates.map((candidate) => candidate.index),
    );
    let removedCoreResponsibilities = 0;
    const coreResponsibilities = pending.data.coreResponsibilities.flatMap(
      (responsibility, index) => {
        if (!candidateIndexes.has(index)) return [responsibility];

        const action = actions.get(index);
        if (!action || action.action === "delete") {
          removedCoreResponsibilities += 1;
          return [];
        }

        if (
          !action.evidence.every((item) =>
            isEvidenceInJd(item, request.jdText),
          )
        ) {
          throw new ApiError("AI_OUTPUT_INVALID", 502);
        }

        return [{ ...responsibility, evidence: action.evidence }];
      },
    );

    const repairedAnalysis = {
      ...pending.data,
      coreResponsibilities,
    };
    const validated = pendingAdviceJobAnalysisSchema.safeParse(repairedAnalysis);

    if (!validated.success) {
      logSchemaIssues(
        "core evidence repaired analysis validation failed",
        validated.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.coreTargetedRepairSucceeded = true;
    diagnostics.removedCoreResponsibilities = removedCoreResponsibilities;
    return validated.data;
  } catch (error) {
    console.warn("[deepseek] targeted core evidence repair failed", {
      requestId: requestId ?? "untracked",
      code: error instanceof ApiError ? error.code : "UNKNOWN",
    });
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

async function repairRequirementEvidence(
  request: AnalyzeJobRequest,
  pendingAnalysis: unknown,
  candidates: RequirementRepairCandidate[],
  configuration: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  deadline: number,
  diagnostics: AnalysisDiagnostics,
  requestId?: string,
) {
  const pending = pendingRequirementJobAnalysisSchema.safeParse(pendingAnalysis);

  if (!pending.success || candidates.length === 0) {
    if (!pending.success) {
      logSchemaIssues(
        "pending requirement repair schema validation failed",
        pending.error.issues,
      );
    }
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.requirementTargetedRepairAttempted = true;
  const repairCandidates: RequirementEvidenceRepairCandidate[] = candidates.map(
    ({ index, requirement }) => ({ index, ...requirement }),
  );

  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ApiError("AI_OUTPUT_INVALID", 502);

    diagnostics.upstreamAttempts += 1;
    const content = await requestCompletion(
      buildRequirementEvidenceRepairMessages(request, repairCandidates),
      configuration,
      remaining,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid requirement evidence repair JSON");
    const rawRepair = rawRequirementEvidenceRepairSchema.safeParse(parsed);

    if (!rawRepair.success) {
      logSchemaIssues(
        "raw requirement evidence repair schema validation failed",
        rawRepair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const normalizedRepair = {
      items: rawRepair.data.items.map((item) => ({
        ...item,
        evidence: normalizeEvidence(
          item.evidence,
          request.jdText,
          diagnostics,
          "requirement-repair",
        ),
      })),
    };
    const repair = requirementEvidenceRepairSchema.safeParse(normalizedRepair);

    if (!repair.success) {
      logSchemaIssues(
        "requirement evidence repair schema validation failed",
        repair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const actions = new Map(repair.data.items.map((item) => [item.index, item]));
    const coversEveryCandidate =
      actions.size === candidates.length &&
      candidates.every((candidate) => actions.has(candidate.index));

    if (!coversEveryCandidate) throw new ApiError("AI_OUTPUT_INVALID", 502);

    const candidateIndexes = new Set(
      candidates.map((candidate) => candidate.index),
    );
    const questionsToConfirm = [
      ...pending.data.roleProfile.questionsToConfirm,
    ];
    const requirements = pending.data.roleProfile.requirements.map(
      (item, index) => {
        if (!candidateIndexes.has(index)) return item;

        const action = actions.get(index);
        if (!action || action.action !== "replace_evidence") {
          throw new ApiError("AI_OUTPUT_INVALID", 502);
        }

        if (
          !action.evidence.every((evidenceItem) =>
            isEvidenceInJd(evidenceItem, request.jdText),
          )
        ) {
          throw new ApiError("AI_OUTPUT_INVALID", 502);
        }

        return normalizeRequirement(
          { ...item, evidence: action.evidence },
          request.jdText,
          diagnostics,
          questionsToConfirm,
          `requirements[${index}].evidence`,
        );
      },
    );

    const repairedAnalysis = {
      ...pending.data,
      roleProfile: {
        ...pending.data.roleProfile,
        requirements,
        questionsToConfirm,
      },
    };
    const validated = pendingCoreJobAnalysisSchema.safeParse(repairedAnalysis);

    if (!validated.success) {
      logSchemaIssues(
        "requirement evidence repaired analysis validation failed",
        validated.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.requirementTargetedRepairSucceeded = true;
    return validated.data;
  } catch (error) {
    console.warn("[deepseek] targeted requirement evidence repair failed", {
      requestId: requestId ?? "untracked",
      code: error instanceof ApiError ? error.code : "UNKNOWN",
    });
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

async function repairAdviceEvidence(
  request: AnalyzeJobRequest,
  pendingAnalysis: unknown,
  candidates: AdviceRepairCandidate[],
  configuration: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  deadline: number,
  diagnostics: AnalysisDiagnostics,
  requestId?: string,
) {
  const pending = pendingAdviceJobAnalysisSchema.safeParse(pendingAnalysis);

  if (!pending.success || candidates.length === 0) {
    if (!pending.success) {
      logSchemaIssues("pending repair schema validation failed", pending.error.issues);
    }
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }

  diagnostics.targetedRepairAttempted = true;
  const repairCandidates: AdviceEvidenceRepairCandidate[] = candidates.map(
    ({ index, reason }) => ({ index, ...reason }),
  );

  try {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.upstreamAttempts += 1;
    const content = await requestCompletion(
      buildAdviceEvidenceRepairMessages(request, repairCandidates),
      configuration,
      remaining,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid targeted repair JSON");
    const rawRepair = rawAdviceEvidenceRepairSchema.safeParse(parsed);

    if (!rawRepair.success) {
      logSchemaIssues(
        "raw targeted repair schema validation failed",
        rawRepair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const normalizedRepair = {
      items: rawRepair.data.items.map((item) =>
        item.action === "replace_evidence"
          ? {
              ...item,
              evidence: normalizeEvidence(
                item.evidence,
                request.jdText,
                diagnostics,
              ),
            }
          : item,
      ),
    };
    const repair = adviceEvidenceRepairSchema.safeParse(normalizedRepair);

    if (!repair.success) {
      logSchemaIssues("targeted repair schema validation failed", repair.error.issues);
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const actions = new Map(repair.data.items.map((item) => [item.index, item]));
    const coversEveryCandidate =
      actions.size === candidates.length &&
      candidates.every((candidate) => actions.has(candidate.index));

    if (!coversEveryCandidate) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const questionsToConfirm = [
      ...pending.data.roleProfile.questionsToConfirm,
    ];
    const reasons = candidates.flatMap((candidate) => {
      const action = actions.get(candidate.index);

      if (!action || action.action === "delete") return [];

      if (!action.evidence.every((item) => isEvidenceInJd(item, request.jdText))) {
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      }

      return [
        normalizeAdviceReason(
          { ...candidate.reason, evidence: action.evidence },
          action.evidence,
          questionsToConfirm,
        ),
      ];
    });

    if (reasons.length === 0) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.targetedRepairSucceeded = true;
    diagnostics.removedAdviceReasons = candidates.length - reasons.length;

    return {
      ...pending.data,
      roleProfile: {
        ...pending.data.roleProfile,
        questionsToConfirm,
      },
      applicationAdvice: { ...pending.data.applicationAdvice, reasons },
    };
  } catch (error) {
    console.warn("[deepseek] targeted evidence repair failed", {
      requestId: requestId ?? "untracked",
      code: error instanceof ApiError ? error.code : "UNKNOWN",
    });
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

async function repairHrGreeting(
  request: AnalyzeJobRequest,
  analysis: JobAnalysis,
  configuration: Required<
    Pick<AnalyzeOptions, "fetchImpl" | "apiKey" | "model" | "baseUrl">
  >,
  deadline: number,
  diagnostics: AnalysisDiagnostics,
  requestId?: string,
) {
  const violations = findHrGreetingBoundaryViolations(analysis.hrGreeting);

  if (violations.length === 0) {
    return analysis;
  }

  diagnostics.hrBoundaryViolationCount = violations.length;
  diagnostics.hrTargetedRepairAttempted = true;

  try {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    diagnostics.upstreamAttempts += 1;
    const content = await requestCompletion(
      buildHrGreetingRepairMessages(request, analysis.hrGreeting),
      configuration,
      remaining,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid HR greeting repair JSON");
    const rawRepair = rawHrGreetingRepairSchema.safeParse(parsed);

    if (!rawRepair.success) {
      logSchemaIssues(
        "raw HR greeting repair schema validation failed",
        rawRepair.error.issues,
      );
      throw new ApiError("AI_OUTPUT_INVALID", 502);
    }

    const repair = hrGreetingRepairSchema.safeParse(rawRepair.data);
    let repairedGreeting: JobAnalysis["hrGreeting"];

    if (!repair.success) {
      const boundaryOnlyFailure = repair.error.issues.every(
        (issue) => issue.code === "custom",
      );

      if (!boundaryOnlyFailure) {
        logSchemaIssues(
          "HR greeting repair schema validation failed",
          repair.error.issues,
        );
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      }

      const fallback = hrGreetingRepairSchema.safeParse({
        hrGreeting: {
          personalizationStatus: PERSONALIZATION_STATUS,
          personalizationNotice: PERSONALIZATION_NOTICE,
          safeGreeting: SAFE_GENERIC_GREETING,
          editableGreetingTemplate: EDITABLE_GENERIC_GREETING_TEMPLATE,
        },
      });

      if (!fallback.success) {
        throw new ApiError("AI_OUTPUT_INVALID", 502);
      }

      diagnostics.hrRepairUsedSafeFallback = true;
      repairedGreeting = fallback.data.hrGreeting;
    } else {
      repairedGreeting = repair.data.hrGreeting;
    }

    diagnostics.hrTargetedRepairSucceeded = true;

    return {
      ...analysis,
      hrGreeting: repairedGreeting,
    };
  } catch (error) {
    console.warn("[deepseek] targeted HR greeting repair failed", {
      requestId: requestId ?? "untracked",
      code: error instanceof ApiError ? error.code : "UNKNOWN",
    });
    throw new ApiError("AI_OUTPUT_INVALID", 502);
  }
}

export async function analyzeJobWithDeepSeek(
  request: AnalyzeJobRequest,
  options: AnalyzeOptions = {},
): Promise<JobAnalysis> {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new ApiError("AI_AUTH_FAILED", 503);
  }

  const configuration = {
    fetchImpl: options.fetchImpl ?? fetch,
    apiKey,
    model: options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
    baseUrl: options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL,
  };
  const deadline = Date.now() + (options.timeoutMs ?? TOTAL_TIMEOUT_MS);
  const diagnostics: AnalysisDiagnostics = {
    upstreamAttempts: 0,
    jsonParsePassed: false,
    rawSchemaValidationPassed: false,
    evidenceOverLimitCount: 0,
    truncatedEvidenceCount: 0,
    recoveredEvidenceCount: 0,
    remappedEvidenceCount: 0,
    removedInvalidEvidenceCount: 0,
    removedDuplicateEvidenceCount: 0,
    supplementedRequirementCount: 0,
    deduplicatedRequirementCount: 0,
    removedEvidenceSamples: [],
    targetedRepairAttempted: false,
    targetedRepairSucceeded: false,
    coreTargetedRepairAttempted: false,
    coreTargetedRepairSucceeded: false,
    requirementTargetedRepairAttempted: false,
    requirementTargetedRepairSucceeded: false,
    removedCoreResponsibilities: 0,
    hrBoundaryViolationCount: 0,
    hrTargetedRepairAttempted: false,
    hrTargetedRepairSucceeded: false,
    hrRepairUsedSafeFallback: false,
    hrBoundaryValidationPassed: false,
    truncatedByLength: false,
    outputCompletionTokens: 0,
    removedRiskSignals: 0,
    removedAdviceReasons: 0,
    finalSchemaValidationPassed: false,
    finalEvidenceValidationPassed: false,
    finalValidationPassed: false,
  };

  try {
    const content = await requestInitialAnalysis(
      request,
      configuration,
      deadline,
      diagnostics,
    );
    const parsed = parseJson(content, "invalid JSON output");
    diagnostics.jsonParsePassed = true;
    const prepared = prepareAnalysis(parsed, request.jdText, diagnostics);
    diagnostics.removedRiskSignals = prepared.removedRiskSignals;
    diagnostics.removedAdviceReasons = prepared.removedAdviceReasons;

    const requirementEvidenceReadyAnalysis =
      prepared.requirementRepairCandidates.length > 0
        ? await repairRequirementEvidence(
            request,
            prepared.analysis,
            prepared.requirementRepairCandidates,
            configuration,
            deadline,
            diagnostics,
            options.requestId,
          )
        : prepared.analysis;
    const coreEvidenceReadyAnalysis =
      prepared.coreRepairCandidates.length > 0
        ? await repairCoreResponsibilityEvidence(
            request,
            requirementEvidenceReadyAnalysis,
            prepared.coreRepairCandidates,
            configuration,
            deadline,
            diagnostics,
            options.requestId,
          )
        : requirementEvidenceReadyAnalysis;
    const preparedResult = finalStructureJobAnalysisSchema.safeParse(
      coreEvidenceReadyAnalysis,
    );
    const evidenceReadyAnalysis = preparedResult.success
      ? preparedResult.data
      : await repairAdviceEvidence(
          request,
          coreEvidenceReadyAnalysis,
          prepared.repairCandidates,
          configuration,
          deadline,
          diagnostics,
          options.requestId,
        );
    const analysis = await repairHrGreeting(
      request,
      evidenceReadyAnalysis,
      configuration,
      deadline,
      diagnostics,
      options.requestId,
    );
    const validated = validateFinalAnalysis(
      analysis,
      request.jdText,
      diagnostics,
    );
    diagnostics.hrBoundaryValidationPassed = true;
    diagnostics.finalValidationPassed = true;
    return validated;
  } finally {
    options.onDiagnostics?.({ ...diagnostics });
  }
}
