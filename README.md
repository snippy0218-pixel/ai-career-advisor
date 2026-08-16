# AI 求职顾问

面向应届毕业生和 0–1 年工作经验求职者的 AI 求职顾问。用户可以只解读招聘 JD，也可以同时提供 JD 与自己的真实资料，获得经过结构、事实和证据校验的个性化匹配结果。

## 当前状态

Phase 1 MVP 已完成，支持：

- 招聘 JD 文本输入与长度校验；
- DeepSeek 非思考、非流式 JSON 分析；
- `analysis-v1` 运行时结构校验；
- JD 原文证据校验；
- 岗位基本信息、核心职责和岗位画像；
- 审慎的投递建议；
- 不包含虚构个人经历的通用 HR 打招呼消息；
- 加载、错误和重试状态；
- 桌面和移动端响应式布局。

Phase 1 不包含登录、数据库、文件上传、OCR、历史记录、会员、权限或投递管理。

Phase 2 Personalized Match 核心能力已完成，Phase 2.5 正在执行最终 Release Gate。统一用户流位于 `/personalized-match`，支持：

- 原始 JD + 原始候选人资料一次提交，无需构造内部 JSON；
- Candidate Fact → Profile Evidence → Raw Profile 与 JD Evidence → Raw JD 的完整可追溯链；
- 逐项区分已匹配、部分匹配、明确不满足和待确认；
- 投递建议、可验证优势、差距与行动、待确认问题；
- 基于安全候选人事实的 HR 开场白，无相关事实时回落通用版本；
- 六阶段 loading、明确错误、保留输入重试；任何阶段失败后停止下游且不展示未完整验证结果。

Phase 2.5 不增加登录、存储、简历改写、文件解析、面试、投递管理、匹配分数或 confidence。

Phase 3.1「我的候选人档案」已完成第一版（`/profile`）：

- 查看、编辑、保存、清除候选人原始资料（仅保存在当前浏览器 localStorage）；
- 只持久化原始资料文本，不保存结构化派生数据；
- `/personalized-match` 自动载入已保存资料并预填，不自动触发分析；
- 轻量档案内容建议（教育背景 / 技能 / 项目 / 经历 / 求职目标），仅前端提示；
- 不包含注册、登录、云端同步、多用户或数据库。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 6
- Tailwind CSS 4
- DeepSeek API
- Zod
- Vitest + Testing Library

## 环境要求

- Node.js 24 或更高版本
- npm 11 或兼容版本
- 可用的 DeepSeek API Key 和账户余额

## 本地启动

1. 安装依赖：

   ```powershell
   npm install
   ```

2. 创建本地环境文件：

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. 编辑 `.env.local`：

   ```text
   DEEPSEEK_API_KEY=你的真实API密钥
   DEEPSEEK_MODEL=deepseek-v4-flash
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   ```

   模型名可能随 DeepSeek 官方更新而变化，启动前可核对官方文档。不要把 `.env.local` 提交到版本库。

4. 启动开发服务器：

   ```powershell
   npm run dev
   ```

5. 浏览器打开 [http://localhost:3000](http://localhost:3000)；个性化匹配页为 [http://localhost:3000/personalized-match](http://localhost:3000/personalized-match)。

## 工程检查

```powershell
npm test
npm run lint
npm run build
```

生产模式本地运行：

```powershell
npm run build
npm start
```

## 项目结构

```text
AI Career Advisor/
├── .env.example
├── README.md
├── PROJECT_RULES.md
├── package.json
├── src/
│   ├── app/
│   │   ├── api/analyze/route.ts
│   │   ├── api/profile/analyze/route.ts
│   │   ├── api/match/analyze/route.ts
│   │   ├── api/recommendation/analyze/route.ts
│   │   ├── api/strength-gap/analyze/route.ts
│   │   ├── api/greeting/analyze/route.ts
│   │   ├── personalized-match/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── analysis-result.tsx
│   │   ├── jd-input-form.tsx
│   │   ├── job-analyzer.tsx
│   │   └── personalized-match-advisor.tsx
│   ├── lib/
│   │   ├── analysis-schema.ts
│   │   ├── api-errors.ts
│   │   ├── deepseek.ts
│   │   ├── prompt.ts
│   │   └── personalized-match-flow.ts
│   └── test/fixtures.ts
└── docs/
    ├── PRD.md
    ├── analysis-schema.md
    ├── Prompt设计.md
    ├── 技术方案.md
    ├── 开发计划.md
    ├── 开发前评审.md
    └── 更新日志.md
```

测试文件与被测模块放在同一目录中。

## 数据和安全说明

- 浏览器只调用本项目的六个本地 `/api/**/analyze` route；
- DeepSeek API Key 只在 Next.js 服务端读取；
- Phase 1 不保存 JD 或分析历史；
- 服务端不把完整 JD 写入日志；
- 模型原始响应只有通过 JSON、Zod 和证据校验后才返回页面；
- `candidateAdvantages` 在 Phase 1 固定为 `null`，避免编造用户优势。
- Phase 2 Candidate claim 只能来自 Canonical Candidate Fact，并可继续追溯到原始候选人资料；缺少证据保持 unknown，不按 unmet 处理。

## 项目文档

- [产品需求文档](docs/PRD.md)
- [AI 输出协议](docs/analysis-schema.md)
- [技术方案](docs/技术方案.md)
- [Prompt 设计](docs/Prompt设计.md)
- [开发计划](docs/开发计划.md)
- [开发前评审](docs/开发前评审.md)
- [更新日志](docs/更新日志.md)
- [项目长期规则](PROJECT_RULES.md)
