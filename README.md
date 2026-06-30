# 小红书数据自动抓取系统

本项目是一个本地运行的小红书数据研究与运营工作台。前端使用 React + Vite，后端使用 Express + TypeScript，底层通过 `@lucasygu/redbook` 接入小红书浏览器登录态，用于关键词搜索、笔记详情补全、评论读取、作者分析、内容拆解、AI 工作流和报告导出。

> 使用前请确认：只处理你有权访问的账号和数据，遵守小红书平台规则，控制请求频率，不要把 `.env.local`、Cookie、API Key、`data/` 运行数据或导出文件提交到 Git。

## 公开仓库说明

本仓库是个人/研究性质的本地工具，不是小红书、RED 或其关联公司的官方项目。

- 仅用于合法授权的数据研究、内容复盘和本地分析。
- 不要绕过平台访问控制、验证码、风控、隐私设置或付费/权限限制。
- 不要用于骚扰、批量营销、刷量、垃圾评论或其他滥用场景。
- 评论回复等写入类能力必须人工审核后再执行。
- Cookie、API Key、抓取结果、运行数据和导出文件都可能包含敏感信息，不应公开。

## 功能总览

| 模块 | 功能 |
| --- | --- |
| 登录连接 | 浏览器助手扩展、专用 Edge 登录窗口、兼容自动读取、手动 Cookie |
| 话题研究 | 多关键词搜索、排序/类型/页数/评论页数/并发控制 |
| 队列抓取 | 搜索笔记、补正文和媒体、抓评论、补作者资料和作者作品 |
| 笔记库 | 按任务、重复关键词组或全部历史笔记查看；支持搜索、作者、类型、最低赞和排序筛选 |
| 数据集管理 | 清理当前任务前先预览影响范围，可选择是否同时删除关联 AI 产物和报告 |
| 媒体处理 | 图片缓存、视频代理、失效媒体手动刷新，可通过环境变量启用自动刷新 |
| 分析面板 | 总览、爆款拆解、受众洞察、竞品作者、评论运营 |
| AI 工作台 | 模型接入、AI 助手、AI 编排、Prompt 中心、AI 报告和 Markdown 产物 |
| 模型预设 | OpenAI、DeepSeek、Qwen、MiniMax、Doubao、Kimi、SiliconFlow、xAI、Custom |
| 导出 | 任务数据导出为 JSON、CSV、HTML；AI 报告/产物导出为 Markdown |

## 项目入口

| 入口 | 地址或文件 |
| --- | --- |
| 前端页面 | `http://127.0.0.1:5173` |
| 后端 API | `http://127.0.0.1:8787/api` |
| redbook 封装 | `src/server/services/redbookService.ts` |
| 浏览器助手扩展 | `browser-extension/xhs-bridge/` |
| 专用 Edge 登录服务 | `src/server/services/browserAuthService.ts` |
| 任务队列 | `src/server/services/jobService.ts` |
| 数据查询和清理 | `src/server/services/queryService.ts` |
| 媒体代理和刷新 | `src/server/services/mediaService.ts` |
| AI 模型供应商预设 | `src/shared/modelProviders.ts` |
| 本地运行数据 | `data/`，已被 Git 忽略 |
| 本地密钥配置 | `.env.local`，已被 Git 忽略 |

## 环境要求

- Node.js 22 或更高版本。
- npm。
- Microsoft Edge 或 Chrome。
- 一个已在浏览器中登录的小红书账号。
- 如果使用“专用登录窗口”，本机需要安装 Microsoft Edge。

## 安装

```powershell
npm install
```

项目已经在 `package.json` 中声明 `@lucasygu/redbook`，正常安装依赖即可。浏览器助手扩展不需要构建，直接加载 `browser-extension/xhs-bridge/` 目录。

## 配置 `.env.local`

复制示例文件：

```powershell
Copy-Item .env.example .env.local
```

首次使用可以先删除或留空 `XHS_COOKIE_STRING`，后续通过前端登录面板写入。

常用配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 后端监听端口 |
| `XHS_COOKIE_STRING` | 空 | 小红书 Cookie 字符串，可由前端认证流程写入 |
| `XHS_SEARCH_INTERVAL_SEC` | `15` | 搜索分页基础间隔秒数 |
| `XHS_SEARCH_JITTER_PCT` | `70` | 搜索间隔随机抖动比例 |
| `XHS_DETAIL_INTERVAL_SEC` | `60` | 详情、评论、作者队列基础间隔秒数 |
| `XHS_DETAIL_JITTER_PCT` | `50` | 详情队列间隔随机抖动比例 |
| `XHS_WORKER_STAGGER_SEC` | `12` | 后台 worker 错峰启动间隔 |
| `XHS_JOB_CONCURRENCY` | `2` | 默认任务并发 |
| `XHS_MAX_JOB_CONCURRENCY` | `2` | 允许的最大并发 |
| `XHS_DAILY_READ_BUDGET` | `0` | 每日读取预算，`0` 表示不启用本地预算限制 |
| `XHS_MEDIA_AUTO_REFRESH` | `false` | 媒体代理失败时是否自动重新读取笔记媒体链接 |
| `XHS_AUTO_RESUME_JOBS` | `false` | 重启后是否自动恢复历史运行中任务 |

真实 Cookie、模型 Key 和运行数据都不要写入 `.env.example`。

## 启动

开发模式一条命令启动后端和前端：

```powershell
npm run dev
```

启动逻辑：

1. `scripts/dev.mjs` 检查 `http://127.0.0.1:8787/api/health`。
2. 如果已有健康后端，会复用当前后端。
3. 如果没有后端，会启动 `npm run dev:server`。
4. 后端可用后启动 `npm run dev:client`。
5. 前端通过 Vite proxy 把 `/api` 请求转发到后端。

也可以分开启动：

```powershell
npm run dev:server
npm run dev:client
```

生产模式：

```powershell
npm run build
npm start
```

## 登录小红书

本项目使用浏览器 Cookie 登录态，不需要小红书官方 API Key。后端启动后会把历史 Cookie 标记为“待验证”，前端会自动调用 `POST /api/auth/verify` 重新验证 `.env.local` 中的 Cookie。

推荐顺序：

1. 浏览器助手扩展：推荐，适合直接同步当前 Edge/Chrome profile 的登录态。
2. 专用 Edge 登录窗口：推荐给需要隔离日常浏览器 profile 的场景。
3. 兼容自动读取：调用 redbook 的浏览器 Cookie 提取能力，部分 Windows/Chrome 版本可能失败。
4. 手动 Cookie：最后兜底，手动复制 `a1` 和 `web_session`。

### 浏览器助手扩展

1. 启动项目，确保后端 `http://127.0.0.1:8787` 和前端 `http://127.0.0.1:5173` 可用。
2. 打开 Edge 的 `edge://extensions/` 或 Chrome 的 `chrome://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”，选择 `browser-extension/xhs-bridge/`。
5. 在同一个浏览器 profile 中登录 `https://www.xiaohongshu.com/`。
6. 回到本项目“登录连接”区域，点击“检测助手”，再点击“同步登录态”。
7. 也可以点击扩展图标，在弹窗里点击“同步当前浏览器登录态”。

扩展在浏览器中显示为“小红书运营台助手”。如果刚更新或重新加载扩展，请刷新本地运营台页面和已打开的小红书页面。

扩展权限：

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取 `xiaohongshu.com` 相关 Cookie |
| `tabs` / `scripting` | 检测当前小红书页面和打开原帖 |
| `storage` | 浏览器扩展本地能力预留 |
| `host_permissions` | 仅覆盖小红书域名、本机 `5173` 和本机 `8787` |

Cookie 只会通过 `POST /api/auth/extension-cookie` 发送到本机后端，不会发送到云端。接口响应不会回显 Cookie 明文。

### 专用 Edge 登录窗口

在前端登录连接区域启动专用窗口后，后端会：

1. 打开 Microsoft Edge。
2. 使用独立 profile：`data/xhs-login-edge-profile/`。
3. 打开 `https://www.xiaohongshu.com/`。
4. 通过本机 DevTools 调试端口读取 `a1` 和 `web_session`。
5. 使用 redbook 验证 Cookie。
6. 验证通过后写入 `.env.local`。

该 profile 位于 `data/` 下，已被 Git 忽略。

### 手动 Cookie

1. 在小红书网页按 `F12`。
2. 打开 `Application` -> `Cookies` -> `https://www.xiaohongshu.com`。
3. 复制 `a1` 和 `web_session`。
4. 回到前端登录面板填写并验证。

也可以直接写入：

```env
XHS_COOKIE_STRING="a1=你的值; web_session=你的值; webId=可选值"
```

修改 `.env.local` 后需要重启后端。

## 第一次使用流程

1. 执行 `npm run dev`。
2. 打开 `http://127.0.0.1:5173`。
3. 在“登录连接”区域验证小红书 Cookie。
4. 进入“话题研究”。
5. 输入一个或多个关键词，多个关键词可用逗号或换行分隔。
6. 选择排序、笔记类型、搜索页数、评论页数和并发。
7. 创建任务。
8. 等待任务队列完成：系统会搜索笔记、补正文和媒体、抓评论、补作者资料和作者作品。
9. 进入“笔记库”，选择数据范围并筛选笔记。
10. 在“爆款拆解”“受众洞察”“竞品分析”“评论运营”“AI 工作台”中查看分析结果。
11. 需要留档时，使用导出接口或前端导出入口。

## 笔记库数据范围

笔记库默认不自动展开历史数据，避免旧任务内容被误认为当前任务结果。点击“数据范围”可以选择：

| 范围 | 说明 |
| --- | --- |
| 暂不打开历史数据 | 没有当前任务时保持空列表 |
| 全部历史笔记 | 跨任务检索 `data/notes.json` 中所有笔记 |
| 有笔记的历史任务 | 只查看某一次任务关联的笔记 |
| 重复关键词组 | 多次抓取相同关键词时，把相关任务合并查看 |
| 空任务 / 抓取失败任务 | 显示失败、暂停、未入库或仍在运行的任务，并给出原因提示 |

列表支持标题/正文/关键词搜索、作者筛选、最低赞筛选、类型筛选和热度/点赞/评论/收藏/最新排序。

## 数据集管理

在笔记库选择单个任务后，可以点击“管理当前数据集”。系统会先调用 `/api/note-scopes/:jobId/clear-preview` 预览影响范围：

- 影响笔记数量。
- 仅解除任务关联的笔记数量。
- 真正删除的孤立笔记数量。
- 将删除的评论、队列项和本地分析报告数量。
- 关联的 AI 产物和 AI 报告数量。

确认清理后，系统默认只移除当前任务与笔记的关联；只有不再属于任何任务的笔记才会被真正删除。勾选“同时删除该任务关联的 AI 产物和 AI 报告”后，才会清理关联 AI 输出。

## 媒体刷新

笔记图片和视频通过 `/api/media` 代理加载，图片会缓存到 `data/media-cache/`。如果历史媒体链接过期、CDN 防盗链或登录态变化导致显示异常，可以在笔记详情中点击“刷新媒体”。后端会重新读取原帖并更新该笔记的图片/视频链接。

可选自动刷新：

```env
XHS_MEDIA_AUTO_REFRESH=true
```

启用后，媒体代理请求失败时会尝试自动刷新该笔记媒体链接。自动刷新会额外读取小红书页面，请按需开启。

## 任务链路

```text
关键词任务
  -> redbook.search 搜索笔记
  -> 写入 data/notes.json
  -> 创建队列项
  -> redbook.read 补正文和媒体
  -> redbook.comments 抓评论
  -> redbook.user / redbook.userPosts 补作者画像和作者作品
  -> 本地分析：热度、互动比例、内容类型、评论主题、关键词机会分
  -> 生成分析报告数据
```

任务状态：

| 状态 | 含义 |
| --- | --- |
| `queued` | 等待执行 |
| `running` | 正在运行 |
| `paused` | 遇到 Cookie、风控、预算等风险后暂停 |
| `completed` | 队列完成 |
| `failed` | 创建或执行过程中失败 |

如果任务暂停，优先重新验证 Cookie，降低并发到 `1`，并适当增大 `XHS_SEARCH_INTERVAL_SEC` 和 `XHS_DETAIL_INTERVAL_SEC`。

## AI 模型配置

AI 能力是可选项。未配置模型时，项目仍可生成本地规则版分析和报告。

配置路径：

1. 打开前端页面。
2. 点击顶部“模型设置”。
3. 点击“新增模型”。
4. 选择厂商预设。
5. 填写模型名称和 API Key。
6. 保存后点击“测试”。
7. 需要工具调用时点击“工具检测”。
8. 设置默认模型。

内置厂商预设：

| 预设 | Base URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Qwen / DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` 或国际站地址 |
| MiniMax | `https://api.minimax.io/v1` |
| Doubao / Volcengine Ark | `https://ark.cn-beijing.volces.com/api/v3` |
| Kimi / Moonshot | `https://api.moonshot.ai/v1` |
| SiliconFlow | `https://api.siliconflow.cn/v1` |
| xAI | `https://api.x.ai/v1` |
| Custom | 自定义 OpenAI-compatible 地址 |

模型配置写入 `data/aiModels.json`，真实 Key 写入 `.env.local`，变量名形如：

```env
AI_MODEL_MODEL_ABC123_KEY="你的模型 Key"
```

支持 OpenAI-compatible chat completions：

```text
POST {baseUrl}/chat/completions
Authorization: Bearer <apiKey>
```

## AI 工作台

AI 工作台包含：

- AI 助手：基于当前任务、当前笔记和当前模块上下文对话。
- AI 编排：把自然语言指令转成可审计步骤，自动创建只读搜索任务、等待笔记入库并生成分析产物。
- Prompt 中心：查看、编辑、启用和重置各工作流 Prompt。
- AI 报告：按任务生成 Markdown 报告。
- 工作流产物：生成内容规划、受众洞察、竞品分析、爆款拆解、爆款模板、单篇笔记分析。

AI 编排实时进度通过 Server-Sent Events：

```text
GET /api/ai/orchestrations/:id/events
```

模型 tools 调用只允许项目内定义的只读工具。服务端会校验工具名和参数，不接受删除数据、读取密钥、读取 Cookie、发送评论或修改配置等危险请求。

前端内置 Markdown 阅读器支持标题、列表、引用、代码块、表格、链接、行内代码、粗体、斜体和删除线。导出接口返回原始 Markdown。

## Redbook 能力

本项目通过 `@lucasygu/redbook` 的 `XhsClient` 使用这些能力：

| 能力 | 本项目用法 |
| --- | --- |
| 登录验证 | `getSelfInfo`，确认 Cookie 是否有效 |
| 关键词搜索 | `searchNotes`，生成种子笔记 |
| 笔记详情 | `getNoteById` / `getNoteFromHtml`，补正文、封面和互动数据 |
| 评论读取 | `getComments`，用于评论洞察和回复计划 |
| 用户资料 | `getUserInfo`，用于作者画像 |
| 作者作品 | `getUserNotes`，用于竞品作者分析 |
| 推荐流 | `getHomeFeed`，后端保留 `/api/redbook/feed` |
| 话题搜索 | `searchTopics`，后端保留 `/api/redbook/topics` |
| 收藏和专辑 | `getUserCollectedNotes`、`getUserBoards`、`getBoardNotes` |
| 评论回复 | `replyComment`，只在人工批准回复动作后进入队列 |

写入类动作默认需要人工批准。主流程偏读取和分析。

## 常用脚本

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 同时启动后端和前端 |
| `npm run dev:server` | 只启动后端 |
| `npm run dev:client` | 只启动前端 |
| `npm test` | 运行 Vitest 测试 |
| `npm run typecheck` | 运行客户端和服务端 TypeScript 检查 |
| `npm run build` | 构建服务端和前端 |
| `npm start` | 从 `dist/server/index.js` 启动生产服务 |

## 运行数据

运行数据默认写入 `data/`：

| 文件或目录 | 内容 |
| --- | --- |
| `data/searchJobs.json` | 搜索任务 |
| `data/queueItems.json` | 后台队列 |
| `data/notes.json` | 笔记 |
| `data/comments.json` | 评论 |
| `data/authors.json` | 作者资料 |
| `data/authorPosts.json` | 作者作品 |
| `data/analysisReports.json` | 本地分析结果 |
| `data/aiModels.json` | AI 模型配置，不含明文 Key |
| `data/aiReports.json` | AI 或本地 Markdown 报告 |
| `data/aiArtifacts.json` | AI 工作流产物 |
| `data/browserBridgeStatus.json` | 浏览器助手最近检测和同步状态 |
| `data/media-cache/` | 媒体代理缓存 |
| `data/xhs-login-edge-profile/` | 专用 Edge 登录窗口 profile |

这些目录和文件都不应提交到 Git。

## 常用 API

认证和浏览器辅助：

```text
GET  /api/auth/status
POST /api/auth/verify
POST /api/auth/cookie
POST /api/auth/browser
GET  /api/auth/extension/status
POST /api/auth/extension-cookie
POST /api/auth/browser-session
POST /api/auth/browser-session/:id/capture
DELETE /api/auth/browser-session/:id
POST /api/browser/open-url
```

任务、笔记和数据集：

```text
GET    /api/search-jobs
POST   /api/search-jobs
GET    /api/search-jobs/:id
POST   /api/search-jobs/:id/resume
POST   /api/search-jobs/:id/stop
GET    /api/notes
GET    /api/notes/:id
DELETE /api/notes/:id
GET    /api/note-scopes
GET    /api/note-scopes/:jobId/clear-preview
DELETE /api/notes?jobId=:jobId
DELETE /api/notes?jobId=:jobId&deleteAiArtifacts=true
POST   /api/notes/:id/media-refresh
GET    /api/media
```

分析、AI 和导出：

```text
GET  /api/analytics/:jobId
GET  /api/export/:jobId?format=json
GET  /api/export/:jobId?format=csv
GET  /api/export/:jobId?format=html
GET  /api/ai/models
POST /api/ai/models
POST /api/ai/models/test
POST /api/ai/models/:id/tools-probe
GET  /api/ai/workflows
GET  /api/ai/prompts
PUT  /api/ai/prompts/:key
POST /api/ai/workflows/run
POST /api/ai/assistant/chat
POST /api/ai/orchestrations
GET  /api/ai/orchestrations/:id/events
GET  /api/ai/reports/:id/export
GET  /api/ai/artifacts/:id/export
```

## 导出

任务数据：

```text
GET /api/export/:jobId?format=json
GET /api/export/:jobId?format=csv
GET /api/export/:jobId?format=html
```

AI 输出：

```text
GET /api/ai/reports/:id/export
GET /api/ai/artifacts/:id/export
```

## 排查

### 后端不可用

确认后端已启动：

```powershell
npm run dev:server
```

如果端口被占用，可以在 `.env.local` 修改：

```env
PORT=8788
```

同时需要同步调整开发等待地址和 Vite 代理地址，或继续使用默认 `8787`。

### Cookie 验证失败

1. 确认后端 `8787` 已启动。
2. 如果页面显示“待验证”，先等待自动复验。
3. 如果变成“连接失效”，重新点击“检测助手”和“同步登录态”。
4. 如果扩展失败，尝试专用 Edge 登录窗口。
5. 仍失败时，手动复制 `a1` 和 `web_session`。
6. 保存后重启后端。

### 浏览器助手未连接

1. Edge/Chrome 是否开启开发人员模式并加载 `browser-extension/xhs-bridge/`。
2. 本地前端是否运行在 `http://127.0.0.1:5173` 或 `http://localhost:5173`。
3. 本地后端是否运行在 `http://127.0.0.1:8787`。
4. 是否在同一个浏览器 profile 中登录了小红书。
5. 扩展更新后，刷新小红书标签页和本地前端页面。

### 笔记库为空

1. 检查“数据范围”是否仍是“暂不打开历史数据”。
2. 切换到某个有笔记的历史任务，或选择“全部历史笔记”。
3. 检查标题/作者/最低赞/类型筛选条件是否过窄。
4. 如果任务仍在运行，回到总览查看队列进度。

### 图片或视频显示异常

1. 点击笔记详情中的“刷新媒体”。
2. 确认 Cookie 仍有效。
3. 如果频繁过期，可设置 `XHS_MEDIA_AUTO_REFRESH=true` 后重启后端。
4. 仍失败时点击“智能打开原帖”查看原页面。

### AI 报告不是 AI 生成

如果没有默认模型、模型没有 API Key 或模型测试失败，系统会回退到本地规则版报告。进入“模型设置”，保存并测试一个可用的 OpenAI-compatible 模型。

## 开发约定

- 不提交 `data/`、`dist/`、`.env.local`、`output/`、日志、Cookie、token 或模型 Key。
- 浏览器助手扩展只保留本地开发源码，不提交商店私钥或发布账号信息。
- 修改功能后优先运行 `npm test`、`npm run typecheck`、`npm run build`。
- 后端公共接口集中在 `src/server/routes/api.ts`。
- 前后端类型合同集中在 `src/shared/types.ts`。
- 模型供应商预设集中在 `src/shared/modelProviders.ts`。

## 公开前安全检查

- `git status` 没有误加入 `.env.local`、`data/`、`output/`、日志或导出文件。
- `.env.example` 只包含占位值。
- README、测试和文档中的 Key 都是示例值。
- 浏览器扩展里没有远程服务器地址、发布密钥或真实 Cookie。
- 如修改 AI tools 或写入类接口，补充服务端参数校验和测试。
- GitHub 仓库为 Public 时，外部用户只能 fork 或提交 Pull Request，不能直接 push 到你的仓库，除非你授予写权限。

## License

MIT License. See [LICENSE](LICENSE).
