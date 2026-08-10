export interface UnsupportedModifier {
  category:
    | "frequency"
    | "intensity"
    | "duration"
    | "scope"
    | "quantity"
    | "certainty"
    | "experience_type"
    | "ownership"
    | "proficiency"
    | "responsibility";
  value: string;
}

export interface CrossFactModifierContamination extends UnsupportedModifier {
  supportedFactIds: string[];
  unsupportedFactIds: string[];
}

const MODIFIER_LEXICON: ReadonlyArray<UnsupportedModifier> = [
  { category: "frequency", value: "频繁" },
  { category: "frequency", value: "高频" },
  { category: "frequency", value: "经常" },
  { category: "frequency", value: "反复" },
  { category: "frequency", value: "定期" },
  { category: "intensity", value: "高强度" },
  { category: "intensity", value: "精通" },
  { category: "intensity", value: "熟练掌握" },
  { category: "duration", value: "长期" },
  { category: "duration", value: "多年" },
  { category: "scope", value: "全流程" },
  { category: "scope", value: "端到端" },
  { category: "scope", value: "独立负责" },
  { category: "scope", value: "全面负责" },
  { category: "scope", value: "主导" },
  { category: "quantity", value: "大量" },
  { category: "quantity", value: "多个" },
  { category: "quantity", value: "多项" },
  { category: "quantity", value: "多次" },
  { category: "certainty", value: "必然" },
  { category: "certainty", value: "一定能够" },
  { category: "certainty", value: "完全能够" },
] as const;

export function findUnsupportedModifiers(
  content: string,
  evidence: readonly string[],
): UnsupportedModifier[] {
  return MODIFIER_LEXICON.filter(
    ({ value }) => {
      const index = content.indexOf(value);
      if (index < 0 || evidence.some((item) => item.includes(value))) return false;
      const localContext = content.slice(Math.max(0, index - 10), index + value.length + 8);
      return !/(?:没有|未|无法|不能|不得|并非|不是|是否|尚待|需.{0,4}确认|需要.{0,4}确认)/.test(
        localContext,
      );
    },
  );
}

export function stripUnsupportedModifiers(
  content: string,
  evidence: readonly string[],
) {
  return findUnsupportedModifiers(content, evidence).reduce(
    (result, { value }) => result.replaceAll(value, ""),
    content,
  );
}

const CANDIDATE_QUALIFIER_PATTERNS: ReadonlyArray<{
  category: UnsupportedModifier["category"];
  pattern: RegExp;
}> = [
  { category: "frequency", pattern: /频繁|高频|经常|反复|定期/g },
  { category: "intensity", pattern: /高强度/g },
  {
    category: "duration",
    pattern: /(?:[一二三四五六七八九十两\d]+)\s*(?:个)?(?:年|个月|月|周|天)|长期|多年/g,
  },
  { category: "scope", pattern: /全流程|端到端/g },
  {
    category: "experience_type",
    pattern: /正式工作|课程|课堂|校园|实习|全职|工作/g,
  },
  {
    category: "quantity",
    pattern: /(?:[一二三四五六七八九十两\d]+)\s*(?:个|项|次|名|人|份|条|家|场|组)|大量|多个|多项|多次/g,
  },
  { category: "certainty", pattern: /必然|一定能够|完全能够/g },
  { category: "ownership", pattern: /个人|独立|共同|团队/g },
  {
    category: "proficiency",
    pattern: /精通|熟练掌握|熟练使用|熟练|掌握/g,
  },
  {
    category: "responsibility",
    pattern: /独立负责|全面负责|独立完成|个人完成|主导|牵头|负责/g,
  },
] as const;

function isNegatedOrRequirementQualifier(
  content: string,
  index: number,
  value: string,
) {
  const clauseStart = Math.max(
    content.lastIndexOf("，", index - 1),
    content.lastIndexOf("。", index - 1),
    content.lastIndexOf("；", index - 1),
    content.lastIndexOf("！", index - 1),
    content.lastIndexOf("？", index - 1),
  );
  const clauseEndCandidates = ["，", "。", "；", "！", "？"]
    .map((separator) => content.indexOf(separator, index + value.length))
    .filter((position) => position >= 0);
  const clauseEnd =
    clauseEndCandidates.length > 0
      ? Math.min(...clauseEndCandidates)
      : content.length;
  const before = content.slice(
    Math.max(clauseStart + 1, index - 12),
    index,
  );
  const after = content.slice(
    index + value.length,
    Math.min(clauseEnd, index + value.length + 10),
  );
  if (
    /(?:没有|未|无法|不能|不得|并非|不是|低于|不及|是否|尚待|需.{0,4}确认|需要.{0,4}确认)/.test(before) ||
    /^(?:并)?(?:不能|无法|不得|并非|不是)/.test(after)
  ) {
    return true;
  }
  return (
    /(?:岗位|任职|职位|JD|该项|本项).{0,5}(?:要求|需要)$/.test(before) ||
    /^(?:的)?(?:经验|经历|项目|能力|程度|年限)?(?:要求|门槛|标准)/.test(after)
  );
}

function isAssertedQualifier(content: string, index: number) {
  const clauseStart = Math.max(
    content.lastIndexOf("，", index - 1),
    content.lastIndexOf("。", index - 1),
    content.lastIndexOf("；", index - 1),
    content.lastIndexOf("！", index - 1),
    content.lastIndexOf("？", index - 1),
  );
  const before = content.slice(
    Math.max(clauseStart + 1, index - 16),
    index,
  );
  return /(?:为|是|属于|来自|由候选人)$/.test(before);
}

function candidateQualifierOccurrences(
  content: string,
  options: { assertedOnly?: boolean } = {},
) {
  const occurrences: Array<UnsupportedModifier & { index: number }> = [];
  for (const { category, pattern } of CANDIDATE_QUALIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const value = match[0];
      const index = match.index;
      if (
        index === undefined ||
        isNegatedOrRequirementQualifier(content, index, value) ||
        (options.assertedOnly === true && !isAssertedQualifier(content, index))
      ) {
        continue;
      }
      occurrences.push({ category, value, index });
    }
  }
  return occurrences;
}

/**
 * Enforces qualifier ownership inside one Match dimension. If a reason cites
 * multiple CFs, every asserted sensitive qualifier must be independently
 * present in every cited CF. The model can preserve differently-scoped facts
 * by splitting them into separate dimensions instead of flattening provenance.
 */
export function findCrossFactModifierContamination(
  content: string,
  candidateFacts: ReadonlyArray<{ factId: string; statement: string }>,
  options: { assertedOnly?: boolean } = {},
): CrossFactModifierContamination[] {
  if (candidateFacts.length === 0) return [];
  const contaminations = new Map<string, CrossFactModifierContamination>();
  for (const occurrence of candidateQualifierOccurrences(content, options)) {
    const supportedFactIds = candidateFacts
      .filter((fact) => fact.statement.includes(occurrence.value))
      .map((fact) => fact.factId);
    const unsupportedFactIds = candidateFacts
      .filter((fact) => !fact.statement.includes(occurrence.value))
      .map((fact) => fact.factId);
    if (unsupportedFactIds.length === 0) continue;
    const key = `${occurrence.category}:${occurrence.value}`;
    contaminations.set(key, {
      category: occurrence.category,
      value: occurrence.value,
      supportedFactIds,
      unsupportedFactIds,
    });
  }
  return [...contaminations.values()];
}
