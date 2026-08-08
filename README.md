# AI 求职顾问

面向应届毕业生和 0–1 年工作经验求职者的招聘 JD 解读 Demo。用户粘贴招聘 JD 后，服务端调用 DeepSeek API，返回经过结构和证据校验的岗位分析，并在网页中展示。

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

5. 浏览器打开 [http://localhost:3000](http://localhost:3000)。

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
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── analysis-result.tsx
│   │   ├── jd-input-form.tsx
│   │   └── job-analyzer.tsx
│   ├── lib/
│   │   ├── analysis-schema.ts
│   │   ├── api-errors.ts
│   │   ├── deepseek.ts
│   │   └── prompt.ts
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

- 浏览器只调用本项目的 `/api/analyze`；
- DeepSeek API Key 只在 Next.js 服务端读取；
- Phase 1 不保存 JD 或分析历史；
- 服务端不把完整 JD 写入日志；
- 模型原始响应只有通过 JSON、Zod 和证据校验后才返回页面；
- `candidateAdvantages` 在 Phase 1 固定为 `null`，避免编造用户优势。

## 项目文档

- [产品需求文档](docs/PRD.md)
- [AI 输出协议](docs/analysis-schema.md)
- [技术方案](docs/技术方案.md)
- [Prompt 设计](docs/Prompt设计.md)
- [开发计划](docs/开发计划.md)
- [开发前评审](docs/开发前评审.md)
- [更新日志](docs/更新日志.md)
- [项目长期规则](PROJECT_RULES.md)
