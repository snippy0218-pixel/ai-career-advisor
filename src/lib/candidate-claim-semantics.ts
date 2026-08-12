const EVIDENCE_FORCE_OPERATOR =
  /(?:不构成|不能作为|无法作为|不足以(?:作为|构成))/;
const EVIDENCE_FORCE_NOUN = /(?:正证|反证|证据|支持)/;
const CLAUSE_SEPARATORS = ["，", "。", "；", "！", "？"] as const;

export function isEvidenceForceBoundaryClause(content: string) {
  const clause = content.trim();
  if (
    !/^(?:(?:并|且|但)\s*)?(?:(?:该|此|其|上述)(?:事实|证据|陈述)?\s*)?(?:不构成|不能作为|无法作为|不足以(?:作为|构成))/.test(
      clause,
    )
  ) {
    return false;
  }
  return EVIDENCE_FORCE_NOUN.test(clause);
}

export function isQualifierInsideEvidenceForceBoundary(
  content: string,
  index: number,
  value: string,
) {
  const clauseStart = Math.max(
    ...CLAUSE_SEPARATORS.map((separator) => content.lastIndexOf(separator, index - 1)),
  );
  const clauseEndCandidates = CLAUSE_SEPARATORS.map((separator) =>
    content.indexOf(separator, index + value.length),
  ).filter((position) => position >= 0);
  const clauseEnd =
    clauseEndCandidates.length > 0 ? Math.min(...clauseEndCandidates) : content.length;
  const before = content.slice(clauseStart + 1, index);
  const after = content.slice(index + value.length, clauseEnd);
  return EVIDENCE_FORCE_OPERATOR.test(before) && EVIDENCE_FORCE_NOUN.test(after);
}
