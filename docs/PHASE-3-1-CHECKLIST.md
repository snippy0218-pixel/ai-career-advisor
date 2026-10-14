# Phase 3.1 Implementation Checklist — Persistent Candidate Profile

> Status: COMPLETE / CLOSED（全部 checklist 项已完成；Commit 2 已提交，工作树 clean）
> Governing plan: `PHASE-3-1-PLAN.md`（已获 Product Owner 批准）
> Frozen implementation baseline: `6479978`（Phase 2.5 最终验收基线，证据提交 `67928df`；Phase 3.1 实现位于其后的 `b39c041` → `a9e071a`）

## 1. 冻结原则（不得违反）

- [x] raw profile text 是唯一 truth source；`candidate-profile-v2` 契约不修改；
- [x] match / recommendation / strength-gap / greeting 核心 API contract 不修改；
- [x] personalized-match 不自动触发分析；已保存 Profile 仅**预填**文本框，仍由用户手动提交；
- [x] localStorage 只持久化 `{ schemaVersion, updatedAt, rawText, rawTextSha256 }`，不保存结构化派生数据；
- [x] 既有 acceptance tests 与 Phase 2.5 acceptance artifacts 不修改；
- [x] 不引入用户注册 / 登录 / 云端同步 / 多用户 / 数据库。

## 2. 文档前置（Commit 1）

- [x] 提交 `PHASE-3-1-PLAN.md`（已批准方案落库）；
- [x] 提交本 checklist；
- [x] `PLANS.md` 增加 Phase 3.1 状态入口。

## 3. Storage 层

- [x] 新增 `src/lib/candidate-profile-storage.ts`：strict Zod schema、localStorage key 版本化、load/save/clear、SSR 守卫、损坏数据 fail-safe；
- [x] `rawTextSha256` 使用自包含 SHA-256（无新依赖）；
- [x] 新增 `src/lib/candidate-profile-storage.test.ts`：已知向量、往返、非法输入、损坏 JSON、版本不符、sha 篡改、unavailable、clear；
- [x] 新增 `src/lib/profile-completeness.ts` + 测试：教育背景 / 技能 / 项目 / 工作与实习经历 / 求职目标 五项轻量提示，纯前端、不阻塞、无评分模型。

## 4. `/profile` 页面（我的候选人档案）

- [x] 新增 `src/components/profile-manager.tsx`：查看 / 编辑 / 保存 / 清除；
- [x] 保存成功提示与更新时间；清除带确认；
- [x] AI 结构化分析降级为辅助能力（展示 `candidate-profile-v2` 结果，不写入 localStorage）；
- [x] 档案完整性提示（前端 only）；空状态引导；
- [x] 重写 `src/app/profile/page.tsx` 接入 ProfileManager；
- [x] 新增 `src/components/profile-manager.test.tsx`。

## 5. `/personalized-match` 预填

- [x] `src/components/personalized-match-advisor.tsx`：mount 时读取已保存档案并预填资料文本框；
- [x] 已加载徽标 +「编辑档案」入口 +「清除」操作；无档案时提供创建入口；
- [x] 不自动调用任何分析 API；
- [x] 追加 `personalized-match-advisor.test.tsx` 预填 / 清除 / 无档案测试（既有测试不改）。

## 6. 文档同步

- [x] `PRD.md` / `技术方案.md` / `QA-GATES.md` / `更新日志.md` / `CODEX-HANDOFF.md` / `README.md` 增加 Phase 3.1 记录。

## 7. 验证 Gate（Commit 2 前）

- [x] `npm test` 全绿（36 files / 693 tests：既有 652 + 新增 41；既有测试未修改）；
- [x] `npm run lint` 0 warnings；
- [x] `npm run build` + TypeScript PASS；
- [x] diff / scope / secret 检查（0 secret hits；`next-env.d.ts` 保持 clean）；
- [x] 本地 smoke：production server `/profile` 与 `/personalized-match` 均 200；localStorage 保存/预填/清除由 jsdom 组件测试覆盖；
- [x] 确认 Phase 2.5 acceptance 不受影响（6 个 API contract、runner、fixtures、artifacts 均未触碰；Phase 2.5 acceptance tests 原样通过）。

## 8. 提交（Commit 2）

- [x] implementation + tests + docs 提交；
- [x] 工作树 clean。
