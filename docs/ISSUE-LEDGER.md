# Phase 2.4 Issue Ledger

本表是当前状态索引；根因和历史细节仍以各 Issue/E2E 文档及 immutable artifacts 为准。

| Issue | Severity | Current engineering disposition | Remaining closure evidence |
| --- | --- | --- | --- |
| ISSUE-028 Rejected-output evidence preservation | P1 | OPEN / local completion + preflight runtime verified | Recommendation runtime rejected-evidence path |
| ISSUE-029 Cross-CF Candidate scope contamination | P1 | OPEN / Match runtime fix verified; preservation PASS | final closure audit |
| ISSUE-030 SG-E valid evidence-boundary false positive | P1 | OPEN / local fix verified | Strength/Gap runtime acceptance + guards |
| ISSUE-031 Recommendation status attribution | P1 | OPEN / local fix verified | Recommendation runtime |
| ISSUE-032 runner artifact-state semantics | P1 | OPEN / business-failure runtime + precheck local/runtime preservation PASS | final closure audit |
| ISSUE-033 Match repair unsupported negative stability | P1 | OPEN / fix verified at repair runtime; preservation PASS | final closure audit |
| ISSUE-034 dimension-local relational conclusion | P1 | OPEN / fix verified at relation runtime; preservation PASS | final closure audit |
| ISSUE-035 Match same-domain evidence polarity | P1 | OPEN / latest runtime verdict FIX VERIFIED | final closure audit |
| ISSUE-036 Match experience-type lexical precision | P1 | OPEN / local fix verified; latest runtime inconclusive | accepted Match runtime |
| ISSUE-037 Match meta-evidence boundary false positive | P1 | OPEN / LOCAL FIX VERIFIED | fixed three-run E2E batch + final closure audit |

## ISSUE-037 root cause record

- Reproduction: replacement RB-05 repair raw in `phase-2-4-post-035-036-replacement-rb-05.json`.
- Failure: legal dimension-local uncertainty explanation is split into fragments and classified as Candidate factual assertion, requiring refs that Contract says must remain empty for `unknown`.
- Distinctness: not ISSUE-029 qualifier contamination; not ISSUE-033 unsupported negative generation; not ISSUE-035 polarity set; not ISSUE-036 lexical work qualifier.
- Authorized surface: internal Match deterministic validator/tests and durable Phase 2.4 records only. No Contract, schema, prompt, fixture, provider or Phase 2.5 change.
