# 小红书数据自动抓取系统

本项目是一个本地运行的小红书数据研究与运营工作台。前端使用 React + Vite，后端使用 Express + TypeScript，底层通过 `@lucasygu/redbook` 接入小红书登录态，完成关键词搜索、笔记详情、评论、作者信息、作者作品、本地分析、AI 工作流和报告导出。

> 使用前请确认：只使用你有权访问的账号和数据，遵守小红书平台规则，控制抓取频率，不要把 `.env.local`、Cookie、API Key 或 `data/` 运行数据提交到 Git。

## 公开仓库说明

本仓库是一个个人/研究性质的本地数据分析项目，不是小红书、RED 或其关联公司的官方项目，也不代表平台立场。

请在使用前确认以下边界：

- 仅在你有合法权限的账号、数据和场景下使用。
- 不要绕过平台访问控制、验证码、风控、隐私设置或付费/权限限制。
- 不要将本项目用于骚扰、批量营销、垃圾评论、刷量或其他滥用行为。
- Cookie、API Key、抓取结果、运行数据和导出文件都可能包含敏感信息，不应提交或公开。
- 评论回复等写入类能力必须人工审核后再执行；默认流程更偏向读取、分析和报告生成。

如果你 fork 或二次开发，请同时保留这些安全边界，并根据自己的使用场景补充合规说明。

## 入口总览

| 入口 | 说明 |
| --- | --- |
| 前端页面 | `http://127.0.0.1:5173`，开发模式下由 Vite 提供 |
| 后端 API | `http://127.0.0.1:8787/api`，Express 服务 |
| Redbook 封装 | `src/server/services/redbookService.ts`，把 `@lucasygu/redbook` 包装成本项目服务 |
| 浏览器助手扩展 | `browser-extension/xhs-bridge/`，把当前浏览器的小红书登录态同步到本机后端 |
| 专用登录窗口 | `src/server/services/browserAuthService.ts`，启动独立 Edge profile 读取登录 Cookie |
| 任务队列 | `src/server/services/jobService.ts`，负责搜索、补详情、评论、作者、分析 |
| Markdown 阅读器 | 前端内置渲染器，用于 AI 报告、工作流产物和分析面板 |
| 本地数据 | `data/*.json`，运行时自动生成，已被 Git 忽略 |
| 本地密钥 | `.env.local`，保存 Cookie 和 AI 模型 Key，已被 Git 忽略 |

## 环境要求

- Node.js 22 或更高版本。本机已验证可用版本：Node `v24.15.0`，npm `11.13.0`。
- npm。
- Microsoft Edge 或 Chrome 浏览器。
- 一个已在浏览器中登录的小红书账号。
- 如果使用“专用登录窗口”，本机需要安装 Microsoft Edge。

## 安装依赖

```powershell
npm install
```

项目已经在 `package.json` 中声明了 `@lucasygu/redbook`，因此正常安装依赖即可，不需要为了本项目额外全局安装 redbook CLI。

浏览器助手扩展不需要 npm 构建，直接以“加载解压缩的扩展”的方式安装 `browser-extension/xhs-bridge/` 目录。

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

后端启动后会把历史 Cookie 标记为“待验证”，前端会自动调用 `POST /api/auth/verify` 重新验证本机 `.env.local` 中的 Cookie。验证通过后恢复为“已连接”；验证失败时，请重新使用浏览器助手扩展、专用 Edge 登录窗口或手动 Cookie。

推荐顺序：

1. 浏览器助手扩展：推荐。适合把当前 Edge/Chrome profile 里的小红书登录态同步到本机后端。
2. 专用 Edge 登录窗口：推荐给不想读取日常浏览器 profile 的场景。系统会打开独立 Edge profile，登录后从本机 DevTools 通道读取 Cookie。
3. 兼容自动读取：调用 `@lucasygu/redbook/cookies` 尝试读取 Chrome Cookie，部分 Windows/Chrome 版本可能失败。
4. 手动 Cookie：最后兜底，手动复制 `a1` 和 `web_session`。

### 方式一：浏览器助手扩展

1. 启动本项目，确保后端 `http://127.0.0.1:8787` 和前端 `http://127.0.0.1:5173` 都可用。
2. 打开 Edge 的 `edge://extensions/` 或 Chrome 的 `chrome://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”，选择 `browser-extension/xhs-bridge/`。
5. 在同一个浏览器 profile 中登录 `https://www.xiaohongshu.com/`。
6. 回到本项目登录连接区域，点击“检测助手”，再点击“同步登录态”。
7. 也可以点击扩展图标，在弹窗里点“同步当前浏览器登录态”。

扩展在浏览器中显示为“小红书运营台助手”。如果刚更新或重新加载过扩展，请同时刷新本地运营台页面和已打开的小红书页面。

扩展只请求这些权限：

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取 `xiaohongshu.com` 相关 Cookie |
| `tabs` / `scripting` | 检查当前小红书页面和打开原帖 |
| `storage` | 浏览器扩展本地能力预留 |
| `host_permissions` | 仅覆盖小红书域名、本机 `5173` 和本机 `8787` |

Cookie 只会通过 `POST /api/auth/extension-cookie` 发送到本机 `http://127.0.0.1:8787`，不会发送到云端。后端验证成功后会写入 `.env.local`，接口响应不会回显 Cookie 明文。

扩展还用于“智能打开原帖”：优先在当前浏览器打开小红书链接；如果没有安装扩展，前端会回退到专用 Edge 环境。

### 方式二：专用 Edge 登录窗口

在前端登录连接区域使用专用登录窗口时，后端会：

1. 启动 Microsoft Edge。
2. 使用独立 profile：`data/xhs-login-edge-profile/`。
3. 打开 `https://www.xiaohongshu.com/`。
4. 通过本机 `127.0.0.1` DevTools 调试端口读取 `a1` 和 `web_session`。
5. 用 Redbook 验证 Cookie。
6. 验证通过后写入 `.env.local`。

这个 profile 目录位于 `data/` 下，已被 Git 忽略。专用窗口适合隔离日常浏览器 Cookie，但仍然只应在你自己的账号和本机环境中使用。

### 方式三：兼容自动读取

点击“读取本机浏览器（兼容）”会调用 Redbook 的浏览器 Cookie 提取能力。Windows 上 Chrome 127+ 可能因为 App-Bound Encryption 导致自动读取失败。可以先关闭 Chrome 后重试；仍失败时，改用浏览器助手扩展或手动 Cookie。

### 方式四：手动 Cookie

如果自动方式都失败，可以用 Chrome/Edge DevTools 手动复制 Cookie：

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

1. `scripts/dev.mjs` 先检查 `http://127.0.0.1:8787/api/health`。
2. 如果已有健康后端，会复用当前后端。
3. 如果没有后端，会启动 `npm run dev:server`。
4. 后端可用后启动 `npm run dev:client`。
5. 前端通过 Vite proxy 把 `/api` 请求转发到后端。

也可以分开启动：

```powershell
npm run dev:server
npm run dev:client
```

## 第一次使用流程

1. 启动项目并打开 `http://127.0.0.1:5173`。
2. 在登录/认证区域验证小红书 Cookie，优先使用浏览器助手扩展或专用 Edge 登录窗口。
3. 进入“话题研究”。
4. 输入一个或多个关键词，多个关键词可以用逗号或换行分隔。
5. 选择排序、笔记类型、页数、评论页数和并发。
6. 创建任务。
7. 等待任务队列完成：系统会先搜索笔记，再补正文、评论、作者、作者作品，并做本地分析。
8. 在“笔记库”选择当前任务、某个历史任务或“查看全部历史笔记”，再筛选、查看笔记详情和评论。
9. 在“爆款拆解”“受众洞察”“竞品作者”“AI 工作台”等模块查看分析结果。
10. 需要导出时，使用页面上的导出入口，或访问后端导出 API。

## 笔记库和历史数据

笔记库默认不自动展开历史数据，避免第一次打开页面时把旧任务内容误认为当前任务结果。

可选数据范围：

| 范围 | 说明 |
| --- | --- |
| 暂不打开历史数据 | 没有当前任务时，笔记列表保持为空 |
| 查看全部历史笔记 | 从 `data/notes.json` 读取所有已入库笔记 |
| 指定历史任务 | 只查看某一次关键词任务关联的笔记 |

创建新任务或 AI 编排任务生成新搜索任务后，前端会自动切回当前任务范围。

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

## AI 编排与工具调用

当前版本包含一个受控的 AI 编排流程，用于把自然语言指令转成一组可审计步骤：

```text
用户指令
  -> 提取或确认关键词
  -> 创建只读搜索任务
  -> 等待笔记入库
  -> 运行内容规划、爆款模板、受众洞察等 AI 工作流
  -> 汇总为本地 Markdown 产物
```

模型 tools 调用只允许使用项目内定义的只读工具。服务端会校验工具名和参数，不接受删除数据、读取密钥、读取 Cookie、发送评论或修改配置等危险请求。

前端通过 Server-Sent Events 订阅 `/api/ai/orchestrations/:id/events`，可以在 AI 助手抽屉里看到编排任务的实时步骤进度。

AI 报告和工作流产物使用前端内置 Markdown 阅读器展示。当前支持标题、列表、引用、代码块、表格、链接、行内代码、粗体、斜体和删除线；导出接口仍返回原始 Markdown。

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
| `data/browserBridgeStatus.json` | 浏览器助手最近检测和同步状态 |
| `data/media-cache/` | 媒体代理缓存 |
| `data/xhs-login-edge-profile/` | 专用 Edge 登录窗口 profile |

导出接口：

```text
GET /api/export/:jobId?format=json
GET /api/export/:jobId?format=csv
GET /api/export/:jobId?format=html
GET /api/ai/reports/:id/export
GET /api/ai/artifacts/:id/export
```

登录/浏览器辅助接口：

```text
POST /api/auth/verify
GET /api/auth/extension/status
POST /api/auth/extension-cookie
POST /api/auth/browser-session
POST /api/auth/browser-session/:id/capture
DELETE /api/auth/browser-session/:id
POST /api/browser/open-url
GET /api/ai/orchestrations/:id/events
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

1. 确认后端 `8787` 已启动。
2. 如果页面显示“待验证”，先等待自动复验；如果变成“连接失效”，继续下面步骤。
3. 如果使用扩展，确认扩展已加载、当前浏览器已登录小红书，并刷新过小红书标签页。
4. 回到本项目点击“检测助手”和“同步登录态”。
5. 如果扩展失败，尝试专用 Edge 登录窗口。
6. 仍失败时，手动复制 `a1` 和 `web_session`。
7. 保存后重启后端。

### 浏览器助手未连接

检查：

1. Edge/Chrome 是否已开启开发人员模式并加载 `browser-extension/xhs-bridge/`。
2. 本地前端是否运行在 `http://127.0.0.1:5173` 或 `http://localhost:5173`。
3. 本地后端是否运行在 `http://127.0.0.1:8787`。
4. 是否在同一个浏览器 profile 中登录了小红书。
5. 扩展更新后，刷新小红书标签页和本地前端页面。

### 专用 Edge 登录窗口打不开

专用登录窗口需要 Microsoft Edge。若系统提示未找到 Edge，可以安装/修复 Edge，或改用浏览器助手扩展、兼容自动读取、手动 Cookie。

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
- 浏览器助手扩展只保留本地开发版源码，不提交打包产物、商店私钥或发布账号信息。
- 行为保持型重构时，优先运行 `npm test`、`npm run typecheck`、`npm run build`。
- 前端目前没有组件/E2E/视觉测试，改 UI 时需要额外人工验证。
- 后端公共接口集中在 `src/server/routes/api.ts`，类型合同集中在 `src/shared/types.ts`。

## 安全检查清单

公开、fork、提交 PR 或分享仓库前，请至少确认：

- `git status` 没有误加入 `.env.local`、`data/`、`output/`、日志或导出文件。
- `.env.example` 只包含占位值，不包含真实 Cookie 或 API Key。
- 运行数据目录 `data/` 没有被加入 Git，尤其是 `data/xhs-login-edge-profile/`。
- README、测试和文档中的 Key 都是示例值。
- 浏览器扩展里没有加入远程服务器地址、发布密钥或真实 Cookie。
- 如修改 AI tools 或写入类接口，必须补充服务端参数校验和测试。

## License

MIT License. See [LICENSE](LICENSE).
