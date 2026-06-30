# AI Handoff

## 项目目标
构建一个本地运行的小红书数据抓取、笔记研究、运营分析与 AI 报告工作台。

## 当前启动方式
```powershell
cd 'C:\data\work file\小红书数据自动抓取系统'
npm run dev
```

已知脚本来自 `package.json`：
- `npm run dev`：运行 `scripts/dev.mjs`，先检查后端健康，再启动前端。
- `npm run dev:server`：启动 Express/TypeScript 后端。
- `npm run dev:client`：启动 Vite 前端。
- `npm test`：运行 Vitest。
- `npm run typecheck`：运行前后端 TypeScript 检查。
- `npm run build`：构建后端与前端。

## 当前真实状态
- 当前 git 分支：`main`。
- 写入本文件前，`git status --short` 为空，`git diff --stat` 为空。
- 最近提交包括：
  - `262fbec docs: rewrite README for current features`
  - `889df05 refactor: improve note media refresh experience`
  - `5335e2f refactor: group duplicate note scopes`
  - `841104d refactor: add dataset cleanup confirmation`
  - `43d39c2 refactor: improve note scope selection`
  - `88a8798 refactor: add model provider presets`
- 当前技术栈：React + Vite 前端、Express + TypeScript 后端、Vitest 测试、npm 包管理。
- `@lucasygu/redbook` 已在依赖中，用于小红书相关读取能力。
- 本地运行数据、密钥、Cookie、导出和媒体缓存已由 `.gitignore` 排除。
- README 当前存在，但终端读取时中文显示可能受编码环境影响；不要据此判断文件内容损坏。

## 关键目录与文件
- `package.json`：脚本、依赖和项目入口。
- `AGENTS.md`：项目约束和禁止事项。
- `README.md`：当前功能、启动、认证、API 与排查说明。
- `scripts/dev.mjs`：开发模式启动编排。
- `src/client/App.tsx`：主要前端页面、AI 助手、笔记库、模型设置等 UI。
- `src/client/lib/api.ts`：前端 API 客户端。
- `src/client/styles.css`：主要样式。
- `src/server/index.ts`：Express 服务入口。
- `src/server/routes/api.ts`：公共 API 路由集中入口。
- `src/server/services/jobService.ts`：搜索和抓取队列。
- `src/server/services/queryService.ts`：笔记查询、数据范围、删除预览、导出。
- `src/server/services/mediaService.ts`：媒体代理与单条媒体刷新。
- `src/server/services/browserAuthService.ts`：专用浏览器登录窗口。
- `src/server/services/aiService.ts`：模型、Prompt、AI 工作流、报告、产物。
- `src/server/services/aiOrchestratorService.ts`：AI 编排会话。
- `src/server/services/aiToolCallingService.ts`：function call 兼容与 fallback。
- `src/server/storage/localStore.ts`：本地 JSON 存储。
- `src/shared/types.ts`：前后端共享类型。
- `src/shared/modelProviders.ts`：AI 模型厂商预设。
- `browser-extension/xhs-bridge/`：浏览器助手扩展。
- `test/`：Vitest 覆盖。

## 最近已完成
- 模型厂商预设已存在，包含 OpenAI、DeepSeek、Qwen、MiniMax、Doubao、Kimi、SiliconFlow、xAI、Custom。
- 笔记库支持数据范围摘要、当前任务、全部历史、重复关键词组和空任务分组。
- 数据集清理前可预览影响范围，并可选择是否删除关联 AI 产物/报告。
- 笔记详情中已接入媒体状态说明和 `POST /api/notes/:id/media-refresh` 单条刷新。
- AI 相关接口包括模型管理、Prompt、工作流、助手聊天、编排会话、SSE 事件、产物和报告。
- 浏览器认证路径包括浏览器助手扩展、专用浏览器会话、兼容自动读取和手动 Cookie。
- Markdown 阅读器已有测试文件 `test/markdownView.test.tsx`。

## 当前最高优先级问题
1. 复核浏览器助手扩展与后端 `/api/auth/extension-cookie` 的真实同步稳定性。
2. 复核专用浏览器登录窗口与用户常用浏览器登录态之间的体验取舍。
3. 复核笔记库数据范围面板在真实历史数据较多时的筛选、空任务和重复关键词体验。
4. 复核媒体刷新在 Cookie 失效、原帖不可读、CDN 过期时的错误提示是否足够清晰。
5. 复核 AI 助手抽屉在无任务、有任务、编排中、失败、产物完成后的布局和反馈。
6. 复核 AI 编排会话 SSE 与前端轮询/展示是否存在重复状态源。
7. 复核 README 与实际代码是否仍完全一致，尤其认证和模型设置部分。
8. 复核 `AGENTS.md` 中“README 不存在”的历史描述是否需要更新为当前事实。

## 不要继承的旧方案
- 不要默认要求切换到 `codex/model-provider-presets`；当前实际分支是 `main`。
- 不要把旧聊天截图、旧报错、旧 UI 方案当成当前事实；必须重新从代码或运行结果确认。
- 不要把“读取默认 Chrome Profile”作为唯一认证方案；当前代码同时存在浏览器助手、专用浏览器、兼容读取和手动 Cookie。
- 不要继续以任何固定关键词作为默认搜索输入；是否仍有默认值必须从当前代码复核。
- 不要在没有验证的情况下继续实现旧聊天里未落地的功能设想。
- 不要在迁移/排查阶段修改业务代码、接口契约、数据结构或抓取规则。

## 待确认问题
- 用户下一阶段是否优先处理登录/Cookie 稳定性、笔记库历史数据治理，还是 AI 助手体验。
- 当前浏览器助手在 Edge/Chrome 中的实际安装、权限和 Cookie 获取表现。
- 当前本地 `data/` 中是否有需要保留、归档或清理的真实历史数据。
- 当前 `.env.local` 是否包含可用 Cookie 和 AI 模型 Key；不要读取或输出其内容。
- 当前 README 中文是否仅为终端编码显示问题，还是文件本身需要编码复核。
- 是否需要提交本 handoff 文档，或只作为新会话迁移文件保留。

## 下一步最小任务
1. 只读复核认证链路：检查浏览器扩展、`/api/auth/status`、`/api/auth/verify`、`/api/auth/extension-cookie`，运行服务后手动验证一次，不改代码。
2. 只读复核笔记库数据范围：用当前 `data/` 样本检查 `GET /api/note-scopes` 与前端显示是否一致，不做删除操作。
3. 只读复核 AI 助手：检查普通聊天、编排会话、SSE 事件和产物打开路径，记录可复现问题后再决定是否施工。

## 新会话开场提示
请先阅读 `docs/AI_HANDOFF.md`、`AGENTS.md`、`package.json`、`README.md`，并只读复核当前仓库状态。不要立刻改代码。当前项目是本地小红书数据抓取与运营分析工作台，技术栈为 React + Vite 前端、Express + TypeScript 后端、Vitest 测试，依赖 `@lucasygu/redbook`。请先执行 `git status --short --branch`、`git diff --stat`，确认当前分支和工作区状态，再检查关键文件：`src/server/routes/api.ts`、`src/client/App.tsx`、`src/client/lib/api.ts`、`src/server/services/queryService.ts`、`src/server/services/mediaService.ts`、`src/server/services/aiService.ts`、`src/server/services/aiOrchestratorService.ts`、`src/shared/types.ts`、`src/shared/modelProviders.ts`、`browser-extension/xhs-bridge/`。旧聊天内容不要直接继承；凡是没有代码或运行结果证明的信息都标记为待确认。优先只读确认：登录/Cookie 同步、笔记库数据范围、AI 助手编排与产物展示。只有我明确确认施工后，再按最小可验证任务修改代码。
