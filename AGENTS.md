# Codex Repository Instructions

- 开始工作前读取 `docs/CODEX-HANDOFF.md` 和当前 Phase Contract。
- 遵守 `docs/CODEX-OPERATING-PROTOCOL.md` 与 `PROJECT_RULES.md`；不要在本文件复制或改写完整协议。
- 当前 Phase、Gate 与授权范围以最新 Handoff 和 Git 记录为准，优先于旧聊天上下文。
- 架构边界：Raw JD/Profile 是唯一原始事实源；Canonical Candidate Fact 是唯一 Candidate truth layer；Match、Recommendation、Strength/Gap、Greeting 只能消费引用，不得成为第二事实源。
- Candidate claim 必须满足 `CF -> PF -> Raw Profile`；JD claim 必须满足 `JD Evidence -> Raw JD`。严格保持 `unknown != unmet`、缺证据不等于反证、显式反证和关系结论只在本维度生效，并禁止语义或 qualifier upgrade。
- 不修改冻结 Product Contract、public Schema、Phase 边界或 Gate；若正确行为无法由现有 Contract 唯一确定，立即 Stop & Escalate。
- 在已授权 Gate 内自主完成实现、测试、lint、build、文档、diff 与 commit；低风险、可逆、Scope 内操作不重复询问。
- 代码变更必须有 focused regression，并依次通过 targeted/full suite、lint、production build 与 diff/scope/secret 检查；真实 rejected raw 可用时优先固化为 exact replay。
- Phase 2.4 model-backed E2E 以 `docs/PHASE-2-4-AUTONOMOUS-PLAN.md` 的冻结 batch 为准：同一 baseline 最多三次、fixture 不变、批次间不改代码、全部 artifact 永久保留且不得挑选结果。
- 维护 `docs/PLANS.md`、`docs/ISSUE-LEDGER.md` 与 `docs/QA-GATES.md`；Issue 只有在可复现、调查目标明确且不重复时创建，只有 closure evidence 充分时关闭。
- 不得降低 Gate、删除失败历史、跨 Phase 或将 secrets 写入仓库。
- Stop & Escalate 触发后停止产品扩展，仅执行人工明确授权的诊断、证据保全或收尾工作。
