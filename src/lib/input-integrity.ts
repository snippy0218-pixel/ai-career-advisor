// Reject only objective transport/copy corruption. Semantic sparsity, unusual
// punctuation, duplicated chunks, and reordered-but-readable text remain valid
// inputs and are handled by unknown/evidence/fail-closed semantics downstream.
const INVALID_TEXT_PATTERN = /\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function hasInvalidTransportCharacters(value: string) {
  return INVALID_TEXT_PATTERN.test(value);
}
