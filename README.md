# 小红书数据自动抓取系统

本项目是一个本地运行的小红书数据研究与运营工作台。前端使用 React + Vite，后端使用 Express + TypeScript，底层通过 `@lucasygu/redbook` 接入小红书登录态，完成关键词搜索、笔记详情、评论、作者信息、作者作品、本地分析、AI 工作流和报告导出。

> 使用前请确认：只使用你有权访问的账号和数据，遵守小红书平台规则，控制抓取频率，不要把 `.env.local`、Cookie、API Key 或 `data/` 运行数据提交到 Git。

## 入口总览

| 入口 | 说明 |
| --- | --- |
| 前端页面 | `http://127.0.0.1:5173`，开发模式下由 Vite 提供 |
| 后端 API | `http://127.0.0.1:8787/api`，Express 服务 |
| Redbook 封装 | `src/server/services/redbookService.ts`，把 `@lucasygu/redbook` 包装成本项目服务 |
| 任务队列 | `src/server/services/jobService.ts`，负责搜索、补详情、评论、作者、分析 |
| 本地数据 | `data/*.json`，运行时自动生成，已被 Git 忽略 |
| 本地密钥 | `.env.local`，保存 Cookie 和 AI 模型 Key，已被 Git 忽略 |

## 环境要求

- Node.js 22 或更高版本。本机已验证可用版本：Node `v24.15.0`，npm `11.13.0`。
- npm。
- Chrome 浏览器。
- 一个已在 Chrome 中登录的小红书账号。

## 安装依赖

```powershell
npm install
```

项目已经在 `package.json` 中声明了 `@lucasygu/redbook`，因此正常安装依赖即可，不需要为了本项目额外全局安装 redbook CLI。

## 配置 `.env.local`

项目会读取 `.env.local`，其次读取普通环境变量。你可以从示例文件复制一份：

```powershell
Copy-Item .env.example .env.local
```

复制后请把示例 Cookie 替换为真实值，或先删除 `XHS_COOKIE_STRING` 这一行，后续通过前端登录面板写入。

常用配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 后端监听端口 |
| `XHS_COOKIE_STRING` | 空 | 小红书 Cookie 字符串，可通过前端登录面板写入 |
| `XHS_SEARCH_INTERVAL_SEC` | `15` | 搜索分页之间的基础间隔秒数 |
| `XHS_SEARCH_JITTER_PCT` | `70` | 搜索间隔随机抖动比例 |
| `XHS_DETAIL_INTERVAL_SEC` | `60` | 详情、评论、作者等队列请求基础间隔秒数 |
| `XHS_DETAIL_JITTER_PCT` | `50` | 详情队列间隔随机抖动比例 |
| `XHS_JOB_CONCURRENCY` | `2` | 默认任务并发 |
| `XHS_MAX_JOB_CONCURRENCY` | `2` | 允许的最大并发 |
| `XHS_DAILY_READ_BUDGET` | `0` | 每日读取预算，`0` 表示不启用本地预算限制 |
| `XHS_AUTO_RESUME_JOBS` | `false` | 重启后是否自动恢复历史运行中任务 |

如果你通过前端保存 Cookie，系统会自动把 `XHS_COOKIE_STRING` 写入 `.env.local`。不要把真实 Cookie 写进 `.env.example`。

## 接入小红书 Cookie

本项目使用浏览器 Cookie 登录态，不需要小红书官方 API Key。

推荐路径：

1. 用 Chrome 登录 `https://www.xiaohongshu.com`。
2. 启动本项目。
3. 打开前端页面，进入顶部或总览里的登录/认证区域。
4. 优先点击“自动读取”。
5. 如果自动读取失败，手动填写 `a1`、`web_session`，可选填写 `webId`。
6. 点击验证，看到账号信息或连接成功状态后再开始任务。

Windows 上 Chrome 127+ 可能因为 App-Bound Encryption 导致自动读取失败。可以先关闭 Chrome 后重试自动读取；仍失败时，用 Chrome DevTools 手动复制 Cookie：

1. 在小红书网页按 `F12`。
2. 打开 `Application` -> `Cookies` -> `https://www.xiaohongshu.com`。
3. 复制 `a1` 和 `web_session` 的值。
4. 回到本项目登录面板，分别填入并验证。

也可以直接在 `.env.local` 中写入：

```env
XHS_COOKIE_STRING="a1=你的值; web_session=你的值; webId=可选值"
```

修改 `.env.local` 后需要重启后端服务。

## 启动开发环境

一条命令同时启动后端和前端：

```powershell
npm run dev
```

启动过程：

1. 后端启动在 `http://127.0.0.1:8787`。
2. 脚本等待 `/api/health` 可用。
3. 前端启动在 `http://127.0.0.1:5173`。
4. 前端通过 Vite proxy 把 `/api` 请求转发到后端。

也可以分开启动：

```powershell
npm run dev:server
npm run dev:client
```

## 第一次使用流程

1. 启动项目并打开 `http://127.0.0.1:5173`。
2. 在登录/认证区域验证小红书 Cookie。
3. 进入“话题研究”。
4. 输入一个或多个关键词，多个关键词可以用逗号或换行分隔。
5. 选择排序、笔记类型、页数、评论页数和并发。
6. 创建任务。
7. 等待任务队列完成：系统会先搜索笔记，再补正文、评论、作者、作者作品，并做本地分析。
8. 在“笔记库”筛选、查看笔记详情和评论。
9. 在“爆款拆解”“受众洞察”“竞品作者”“AI 工作台”等模块查看分析结果。
10. 需要导出时，使用页面上的导出入口，或访问后端导出 API。

## 任务是如何运行的

创建关键词任务后，后端会执行以下链路：

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

任务可能出现这些状态：

| 状态 | 含义 |
| --- | --- |
| `running` | 正在运行 |
| `paused` | 遇到 Cookie、风控、预算等风险后暂停 |
| `completed` | 队列全部完成 |
| `failed` | 创建或执行过程中失败 |

如果任务暂停，先看页面提示。常见处理方式是重新验证 Cookie，然后点击恢复任务。

## Redbook 能力说明

本项目通过 `@lucasygu/redbook` 的 `XhsClient` 接入这些能力：

| 能力 | 本项目用法 |
| --- | --- |
| 登录验证 | `getSelfInfo`，用于确认 Cookie 是否有效 |
| 关键词搜索 | `searchNotes`，用于种子笔记列表 |
| 笔记详情 | `getNoteById` / `getNoteFromHtml`，用于补正文、封面、互动数据 |
| 评论读取 | `getComments`，用于评论洞察和回复计划 |
| 用户资料 | `getUserInfo`，用于作者画像 |
| 作者作品 | `getUserNotes`，用于竞品作者分析 |
| 推荐流 | `getHomeFeed`，后端保留 `/api/redbook/feed` 入口 |
| 话题搜索 | `searchTopics`，后端保留 `/api/redbook/topics` 入口 |
| 收藏和专辑 | `getUserCollectedNotes`、`getUserBoards`、`getBoardNotes` |
| 评论回复 | `replyComment`，本项目只在人工批准回复动作后进入队列发送 |

本项目默认主流程偏读取和分析。写入类动作，例如评论回复，必须先生成候选，再人工批准；后端回复队列也有最小发送间隔。

## 可选：单独验证 redbook CLI

本项目不要求全局安装 redbook CLI，但如果你想单独确认 redbook 在当前机器能否读取小红书登录态，可以安装并运行：

```powershell
npm install -g @lucasygu/redbook
redbook whoami
```

常用调试命令：

```powershell
redbook search "AI编程" --sort popular
redbook read "https://www.xiaohongshu.com/explore/笔记ID"
redbook comments "https://www.xiaohongshu.com/explore/笔记ID" --all
```

如果 CLI 正常但本项目失败，优先检查 `.env.local` 中的 Cookie 是否过期，或在前端重新验证 Cookie。

## AI 模型配置

AI 能力是可选项。未配置模型时，项目仍会生成本地规则版分析和报告。

配置路径：

1. 打开前端页面。
2. 进入模型设置。
3. 新增 OpenAI-compatible 模型。
4. 填写名称、Provider、Base URL、Model 和 API Key。
5. 保存后点击测试。
6. 设置默认模型。

API Key 不会明文展示。保存后，模型配置写入 `data/aiModels.json`，真实 Key 写入 `.env.local`，变量名形如：

```env
AI_MODEL_MODEL_ABC123_KEY="你的模型 Key"
```

支持的接口形态是 OpenAI-compatible chat completions：

```text
POST {baseUrl}/chat/completions
Authorization: Bearer <apiKey>
```

## 常用脚本

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 同时启动后端和前端开发服务 |
| `npm run dev:server` | 只启动后端 |
| `npm run dev:client` | 只启动前端 |
| `npm test` | 运行 Vitest 测试 |
| `npm run typecheck` | 运行客户端和服务端 TypeScript 检查 |
| `npm run build` | 构建服务端和前端 |
| `npm start` | 构建后从 `dist/server/index.js` 启动生产服务 |

生产模式：

```powershell
npm run build
npm start
```

生产启动后，后端会服务 `dist/client` 中的前端静态文件。

## 运行数据和导出

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
| `data/media-cache/` | 媒体代理缓存 |

导出接口：

```text
GET /api/export/:jobId?format=json
GET /api/export/:jobId?format=csv
GET /api/export/:jobId?format=html
GET /api/ai/reports/:id/export
GET /api/ai/artifacts/:id/export
```

## 常见问题

### 后端不可用或 8787 端口报错

确认后端已启动：

```powershell
npm run dev:server
```

如果端口被占用，可以在 `.env.local` 修改：

```env
PORT=8788
```

同时需要同步调整 `package.json` 的开发等待地址和 `vite.config.ts` 的代理地址，或继续使用默认 `8787`。

### Cookie 验证失败

优先处理：

1. 在 Chrome 重新打开并登录小红书。
2. 回到本项目重新点击自动读取。
3. 如果仍失败，手动复制 `a1` 和 `web_session`。
4. 保存后重启后端。

### 任务暂停

任务暂停通常是因为 Cookie 失效、返回空响应、触发风控提示或本地读取预算达到上限。处理顺序：

1. 重新验证 Cookie。
2. 降低并发到 `1`。
3. 增大 `XHS_SEARCH_INTERVAL_SEC` 和 `XHS_DETAIL_INTERVAL_SEC`。
4. 如果设置了 `XHS_DAILY_READ_BUDGET`，确认当天预算是否已用完。
5. 再恢复任务。

### AI 报告不是 AI 生成

如果没有配置默认模型，或模型没有 API Key，系统会回退到本地规则版报告。进入模型设置，保存并测试一个可用的 OpenAI-compatible 模型后再生成。

### 不小心把真实 Cookie 写进文件

真实 Cookie 只能放在 `.env.local`，该文件已被 `.gitignore` 忽略。如果误写进其他文件，先移除内容，再检查 Git 状态和提交历史，避免上传。

## 开发约定

- 不提交 `data/`、`dist/`、`.env.local`、`output/`、日志、Cookie、token 或模型 Key。
- 行为保持型重构时，优先运行 `npm test`、`npm run typecheck`、`npm run build`。
- 前端目前没有组件/E2E/视觉测试，改 UI 时需要额外人工验证。
- 后端公共接口集中在 `src/server/routes/api.ts`，类型合同集中在 `src/shared/types.ts`。
