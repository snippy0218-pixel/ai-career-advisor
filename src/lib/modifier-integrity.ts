export interface UnsupportedModifier {
  category:
    | "frequency"
    | "intensity"
    | "duration"
    | "scope"
    | "quantity"
    | "certainty";
  value: string;
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
