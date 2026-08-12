# Phase 2.4 Issue Ledger

本表是当前状态索引；根因和历史细节仍以各 Issue/E2E 文档及 immutable artifacts 为准。

| Issue | Severity | Current engineering disposition | Remaining closure evidence |
| --- | --- | --- | --- |
| ISSUE-028 Rejected-output evidence preservation | P1 | OPEN / batch-3 Match + zero-call preflight preservation PASS | Recommendation failure-path runtime still pending |
| ISSUE-029 Cross-CF Candidate scope contamination | P1 | OPEN / Match runtime fix verified; preservation PASS | final closure audit |
| ISSUE-030 SG-E valid evidence-boundary false positive | P1 | OPEN / batch-3 run-2 initial runtime PASS | stable multi-run closure evidence |
| ISSUE-031 Recommendation status attribution | P1 | OPEN / batch-3 run-2 initial runtime PASS | stable multi-run reachability + final closure audit |
| ISSUE-032 runner artifact-state semantics | P1 | OPEN / business-failure runtime + precheck local/runtime preservation PASS | final closure audit |
| ISSUE-033 Match repair unsupported Candidate claim stability | P1 | OPEN / batch-3 repair robustness NOT VERIFIED; guards fail-closed | Product Owner / QA escalation decision |
| ISSUE-034 dimension-local relational conclusion | P1 | OPEN / fix verified at relation runtime; preservation PASS | final closure audit |
| ISSUE-035 Match same-domain evidence polarity | P1 | OPEN / latest runtime verdict FIX VERIFIED | final closure audit |
| ISSUE-036 Match experience-type lexical precision | P1 | OPEN / local fix verified; latest runtime inconclusive | accepted Match runtime |
| ISSUE-037 Match lineage semantic classification | P1 | OPEN / original behavior FIX VERIFIED at batch-3 runtime | final closure audit after Match stability |

## ISSUE-037 root cause record

- Reproduction: replacement RB-05 repair raw in `phase-2-4-post-035-036-replacement-rb-05.json`.
- Failure: legal dimension-local uncertainty explanation is split into fragments and classified as Candidate factual assertion, requiring refs that Contract says must remain empty for `unknown`.
- Distinctness: not ISSUE-029 qualifier contamination; not ISSUE-033 unsupported negative generation; not ISSUE-035 polarity set; not ISSUE-036 lexical work qualifier.
- Authorized surface: internal Match deterministic validator/tests and durable Phase 2.4 records only. No Contract, schema, prompt, fixture, provider or Phase 2.5 change.
- Batch-1 adjacent finding: the same M-CANDIDATE-LINEAGE support layer rejected the weaker `参与团队项目` claim despite CF-003 proving four-person team completion and assistance. The Issue scope now covers bounded evidence-relation classification plus conservative weaker-entailment recognition; no sentence-level Issue was added.
- Batch-2 adjacent evidence: a legal terminal evidence-force boundary was split between Match lineage and M-K, while explicit `CF-xxx` factual narration could omit its CF from structured refs and evade dimension-local review. Cycle 3 centralizes evidence-force semantics and requires explicit CF narration ownership; this exhausts the 3-cycle budget for the broad lineage/status lexical root.
- Batch-3 final evidence: run 1/3 repairs both narrate positive CF-003 facts inside an `unknown` dimension while refs correctly remain `[]`, which the frozen prompt explicitly forbids; lineage correctly rejects both. Both repairs also upgrade assistance into `个人交付/个人职责` evidence and are correctly rejected by M-K. Legal CF-004 explicit-negative scope boundaries are accepted, so original ISSUE-037 behavior is not observed. Batch result 1/3 complete; ISSUE-033 repair robustness remains open; STOP & ESCALATE. No new implementation cycle is authorized.
