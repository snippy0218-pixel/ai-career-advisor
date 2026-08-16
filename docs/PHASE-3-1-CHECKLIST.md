# Phase 3.1 Implementation Checklist — Persistent Candidate Profile

> Status: IN PROGRESS（checklist 先于编码提交）
> Governing plan: `PHASE-3-1-PLAN.md`（已获 Product Owner 批准）
> Frozen implementation baseline: `6479978`（Phase 2.5 最终验收基线；当前 HEAD `67928df` 为其证据提交）

## 1. 冻结原则（不得违反）

- [ ] raw profile text 是唯一 truth source；`candidate-profile-v2` 契约不修改；
- [ ] match / recommendation / strength-gap / greeting 核心 API contract 不修改；
- [ ] personalized-match 不自动触发分析；已保存 Profile 仅**预填**文本框，仍由用户手动提交；
- [ ] localStorage 只持久化 `{ schemaVersion, updatedAt, rawText, rawTextSha256 }`，不保存结构化派生数据；
- [ ] 既有 acceptance tests 与 Phase 2.5 acceptance artifacts 不修改；
- [ ] 不引入用户注册 / 登录 / 云端同步 / 多用户 / 数据库。

## 2. 文档前置（Commit 1）

- [x] 提交 `PHASE-3-1-PLAN.md`（已批准方案落库）；
- [x] 提交本 checklist；
- [x] `PLANS.md` 增加 Phase 3.1 状态入口。

## 3. Storage 层

- [ ] 新增 `src/lib/candidate-profile-storage.ts`：strict Zod schema、localStorage key 版本化、load/save/clear、SSR 守卫、损坏数据 fail-safe；
- [ ] `rawTextSha256` 使用自包含 SHA-256（无新依赖）；
- [ ] 新增 `src/lib/candidate-profile-storage.test.ts`：已知向量、往返、非法输入、损坏 JSON、版本不符、sha 篡改、unavailable、clear；
- [ ] 新增 `src/lib/profile-completeness.ts` + 测试：教育背景 / 技能 / 项目 / 工作与实习经历 / 求职目标 五项轻量提示，纯前端、不阻塞、无评分模型。

## 4. `/profile` 页面（我的候选人档案）

- [ ] 新增 `src/components/profile-manager.tsx`：查看 / 编辑 / 保存 / 清除；
- [ ] 保存成功提示与更新时间；清除带确认；
- [ ] AI 结构化分析降级为辅助能力（展示 `candidate-profile-v2` 结果，不写入 localStorage）；
- [ ] 档案完整性提示（前端 only）；空状态引导；
- [ ] 重写 `src/app/profile/page.tsx` 接入 ProfileManager；
- [ ] 新增 `src/components/profile-manager.test.tsx`。

## 5. `/personalized-match` 预填

- [ ] `src/components/personalized-match-advisor.tsx`：mount 时读取已保存档案并预填资料文本框；
- [ ] 已加载徽标 +「编辑档案」入口 +「清除」操作；无档案时提供创建入口；
- [ ] 不自动调用任何分析 API；
- [ ] 追加 `personalized-match-advisor.test.tsx` 预填 / 清除 / 无档案测试（既有测试不改）。

## 6. 文档同步

- [ ] `PRD.md` / `技术方案.md` / `QA-GATES.md` / `更新日志.md` / `CODEX-HANDOFF.md` / `README.md` 增加 Phase 3.1 记录。

## 7. 验证 Gate（Commit 2 前）

- [ ] `npm test` 全绿（既有 652 + 新增）；
- [ ] `npm run lint` 0 warnings；
- [ ] `npm run build` + TypeScript PASS；
- [ ] diff / scope / secret 检查；
- [ ] 本地 smoke：保存档案 → 刷新 `/profile` 持久 → `/personalized-match` 预填 → 清除无残留；
- [ ] 确认 Phase 2.5 acceptance 不受影响（6 个 API contract、runner、fixtures、artifacts 均未触碰）。

## 8. 提交（Commit 2）

- [ ] implementation + tests + docs 提交；
- [ ] 工作树 clean。
