# Phase 3.1 Implementation Plan — Persistent Candidate Profile

> Status: APPROVED（2026-08-16，Product Owner 批准并附 5 项调整）
> Scope: 第一版本地持久化候选人档案（localStorage），不引入注册 / 登录 / 云端同步 / 多用户 / 数据库
> Frozen implementation baseline: `6479978`；Phase 2.5 = PASS / CLOSED

## 0. Product Owner 调整（已纳入本方案）

1. 保留核心原则：raw profile text 是唯一 truth source；`candidate-profile-v2` 契约不修改；personalized-match 不自动触发分析；使用预填方式加载 Profile。
2. Storage schema 不保存 `lastAnalysis`：只持久化 `{ schemaVersion, updatedAt, rawText, rawTextSha256 }`；结构化 Candidate Profile v2 不进入 localStorage（避免派生数据缓存复杂化 truth boundary）。
3. `/profile` 产品定位改为「我的候选人档案」：查看 / 编辑 / 保存 / 清除为主，AI 结构化分析为辅助能力。
4. 增加轻量 Profile Completeness 前端提示（教育背景 / 技能 / 项目 / 经历 / 求职目标），不影响分析流程，无评分模型。
5. 开发流程：先提交 implementation checklist → 编码 → `npm test` / `npm run lint` / `npm run build` → 报告修改文件、测试结果、Phase 2.5 acceptance 影响、git diff summary。

## A. 当前架构分析

- Next.js 16 App Router、React 19、TypeScript strict、Zod 4、Vitest + Testing Library；无任何持久化层。
- `/profile`：单文本框 → `POST /api/profile/analyze` → 展示 `candidate-profile-v2` JSON；状态仅存 React 内存。
- `/personalized-match`：JD + 资料双文本框 → `runPersonalizedMatchFlow` 顺序调用 6 个 API；Profile 每次手输。
- Profile API 仅接受 `{ profileText }`（trim 20–12,000，strict，无损坏控制字符），返回冻结 `candidate-profile-v2`。
- 约束：`PHASE-2-CONTRACT.md` 中 Profile 原始文本是唯一 Candidate truth source；Phase 1 技术方案明确「浏览器长期存储不作为正式功能」→ localStorage 是本阶段新增授权能力，可编辑单元必须是原始文本。

## B. 修改范围

**In scope**：

1. localStorage 持久化 `rawText`（+ `updatedAt` / `rawTextSha256`）；
2. `/profile` →「我的候选人档案」查看 / 编辑 / 保存 / 清除；
3. `/personalized-match` 挂载时预填已保存资料（可编辑、可清除、手动提交）；
4. 严格 Zod storage schema + 版本化 key + 损坏数据 fail-safe；
5. Profile Completeness 轻量前端提示；
6. 隐私提示与文档同步。

**Out of scope**：注册 / 登录、多用户、云端同步、数据库、服务端存储、导入导出、跨标签页同步、直接编辑结构化 JSON、API contract 变更、既有 acceptance tests 修改。

## C. 新增文件

- `src/lib/candidate-profile-storage.ts`（schema + load/save/clear + SSR 守卫）
- `src/lib/candidate-profile-storage.test.ts`
- `src/lib/profile-completeness.ts` + `profile-completeness.test.ts`
- `src/components/profile-manager.tsx` + `profile-manager.test.tsx`
- `docs/PHASE-3-1-PLAN.md`、`docs/PHASE-3-1-CHECKLIST.md`

## D. 修改文件

- `src/app/profile/page.tsx`（接入 ProfileManager，AI 结构化降为辅助）
- `src/components/personalized-match-advisor.tsx`（预填 + 徽标 + 清除 + 编辑入口）
- `src/components/personalized-match-advisor.test.tsx`（仅追加新测试）
- `docs/PRD.md`、`docs/技术方案.md`、`docs/QA-GATES.md`、`docs/PLANS.md`、`docs/更新日志.md`、`docs/CODEX-HANDOFF.md`、`README.md`

## E. Schema 设计

localStorage key：`ai-career-advisor:candidate-profile:v1`

```ts
candidateProfileStorageV1 = z.object({
  schemaVersion: z.literal("candidate-profile-storage-v1"),
  updatedAt: z.string().refine(可解析为合法时间),     // ISO-8601
  rawText: z.string().trim().min(20).max(12_000)
    .refine(无损坏控制字符),                          // 复用现有校验
  rawTextSha256: z.string().regex(/^[a-f0-9]{64}$/),  // 自包含 SHA-256
}).strict();
```

规则：

1. `rawText` 是唯一事实源；不保存任何结构化派生数据。
2. 加载时重算 SHA-256 与存储值比对；损坏 / 版本不符 / JSON 损坏 → `invalid`，**不覆盖原 key**（非破坏性），UI 降级为手动输入。
3. 仅在客户端 `useEffect` / 事件中读写，SSR 守卫，避免 hydration mismatch。
4. 提供「清除档案」；隐私提示说明数据只存在本浏览器。
5. 跨标签页同步留待后续版本。

## F. 风险分析

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 个人信息留在浏览器 | 中 | 本地存储 + 清除入口 + 隐私提示；不写服务器 |
| SSR hydration 不一致 | 中 | 仅在客户端 effect 读写 |
| localStorage 不可用 / 配额 | 低 | 降级为手动输入，不阻塞核心链路 |
| 数据损坏 / 版本漂移 | 低 | fail-safe 忽略且不覆盖；rawText 重新生成结构化结果 |
| 预填被误解为自动分析 | 中 | 预填 + 手动提交；不自动触发模型调用 |
| 污染 Phase 2.5 验收 | 低 | 只新增客户端文件与测试；6 个 API contract 与 runner/artifacts 不触碰 |

## G. 测试计划

1. Unit（storage）：SHA-256 已知向量；保存 / 读取往返；空 / 超长 / 控制字符拒绝；损坏 JSON / 版本不符 / sha 篡改 → invalid 且不覆盖；clear；SSR 守卫；unavailable。
2. Unit（completeness）：五项命中与缺失；空文本；minimal/partial/complete 分类。
3. Component（ProfileManager）：回显 → 编辑 → 保存 → 成功提示；<20 字禁用保存；清除确认；localStorage 不可用降级；AI 结构化辅助调用。
4. Component（PersonalizedMatchAdvisor）：有档案预填 + 徽标；无档案引导；清除；可编辑后提交；既有测试不变。
5. Gate：`npm test`、`npm run lint`、`npm run build`、diff/scope/secret、本地 smoke。
