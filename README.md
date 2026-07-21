# 小红书数据自动抓取系统

本项目是一个本地运行的小红书数据研究与运营工作台。前端使用 React + Vite，后端使用 Express + TypeScript，底层通过 `@lucasygu/redbook` 接入小红书浏览器登录态，用于关键词搜索、笔记详情补全、评论读取、作者分析、内容拆解、AI 工作流、内容创作和报告导出。

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
| 数据集管理 | 数据集管理器、空/失败数据集删除、清理预览、已选笔记批量删除、关联 AI 产物可选清理 |
| 媒体处理 | 图片缓存、视频代理、失效媒体手动刷新，可通过环境变量启用自动刷新 |
| 分析面板 | 总览、爆款拆解、受众洞察、竞品作者、评论运营 |
| AI 工作台 | 模型接入、AI 助手、AI 编排、提示词中心、自定义提示词、AI 报告和 Markdown 产物 |
| 内容创作台 | 内容项目、素材池、规则库 Playbook、AI 审稿、批量审稿、笔记撰写、批量生成和结果归档 |
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
| 内容创作台服务 | `src/server/services/contentStudioService.ts` |
| AI 提示词和自定义提示词 | `src/server/services/aiPrompts.ts`、`src/server/services/aiService.ts` |
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

## Windows 桌面试用版（D-003）

D-003 使用 Electron 包装现有 React 和 Express 应用，复用相同 HTTP API 和业务逻辑，并使用 Node 24 内置 `node:sqlite` 保存业务数据。安装版只监听 `127.0.0.1:8787`，不向局域网开放，也不要求业务员另行安装 Node.js、npm 或数据库。小红书 Cookie 和 AI 模型 Key 通过 Electron `safeStorage` 使用当前 Windows 用户的保护能力加密后写入 SQLite。

本机调试桌面壳：

```powershell
npm run desktop:start
```

生成未安装的 Windows x64 应用目录：

```powershell
npm run desktop:package
```

生成未签名的 Squirrel 安装包：

```powershell
npm run desktop:make
```

产物位于：

```text
out/小红书运营台-win32-x64/
out/make/squirrel.windows/x64/小红书运营台-0.3.0-Setup.exe
```

如果 Electron 官方 GitHub 下载在中国网络中断，可以仅对当前 PowerShell 会话使用 Electron README 推荐的镜像，不需要写入项目配置：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm run desktop:make
```

安装和使用限制：

- 当前安装包没有 Windows 代码签名，只用于少量内部工程验收；SmartScreen 可能显示未知发布者提示。
- 安装版运行数据位于 `%APPDATA%\小红书运营台`，其中包含 `data/app.db`、`output/`、`media-cache/`、`browser-profile/` 和 `.env.local`。
- D-003 安装版会把 Cookie 和模型 Key 加密写入 `data/app.db`；`.env.local` 仅保留端口等非敏感设置。开发模式仍由 `.env.local` 管理凭证。
- `safeStorage` 主要防止凭证以明文文件保存，不能防御以同一 Windows 用户权限运行的恶意程序。
- 将 `app.db` 复制到另一台电脑或另一个 Windows 用户后，业务数据仍可使用，但 Cookie 和模型 Key 需要重新填写。
- 应用使用单实例锁。再次启动会聚焦已有窗口，不会打开第二套 Store 或 HTTP 服务。
- 如果 `127.0.0.1:8787` 被开发服务器或其他程序占用，桌面版会显示中文启动失败信息；先正常关闭占用进程再重试。
- 关闭应用时如有抓取任务，会先要求确认并把任务安全暂停；下次启动后可以恢复。
- 当前版本不包含自动备份、自动更新、正式图标和代码签名，这些属于后续里程碑。

双击 `Setup.exe` 可以按当前 Windows 用户安装，不要求管理员权限。覆盖安装不得依赖或写入程序目录；用户数据与安装目录相互分离。

### 从 0.1.1 迁移旧数据

1. 覆盖安装 `0.2.0` 并启动应用。
2. 如果 `%APPDATA%\小红书运营台\data` 中检测到旧 JSON，模型设置会自动打开“数据存储”栏目。
3. 点击“预检旧数据”，确认识别文件和记录数量。
4. 点击“确认迁入 SQLite”。导入使用单个事务，失败会整体回滚；成功后应用会立即安全暂停旧版运行中任务并启用后台服务，不要求重启。
5. 原 JSON 和 `.env.local` 不会被删除、改名或覆盖；成功后新业务数据只写入 `data/app.db`。

如需从其他旧项目迁移，点击“选择文件夹”并选择该项目的 `data` 目录。一个数据库只能导入一个来源，不能合并多个业务员的数据。

如果界面提示“旧数据与当前数据库发生冲突”，应用会继续阻止业务写入，也不会允许直接覆盖导入。请先完整备份 `%APPDATA%\小红书运营台\data`，再联系维护人员处理，不要手工删除旧 JSON。

### 从 0.2.0 升级并加密凭证

1. 关闭 `0.2.0`，覆盖安装 `0.3.0` 后启动应用。
2. 安装版会在 HTTP 服务和后台任务启动前扫描本机 `.env.local` 中的 Cookie 与模型 Key。
3. 全部加密并回读验证成功后，应用只移除对应明文行，注释、空行和非敏感配置保持不变。
4. 打开“模型设置 → 凭证安全”，确认显示“Cookie 和 AI Key 已使用 Windows 加密保护”。
5. 如显示“需要清理旧凭证”，点击“重新检查并清理”；如显示“需要重新配置凭证”，重新连接小红书或填写相应模型 Key。

迁移失败时应用不会删除原明文；若密文已可用但清理失败，安装版仍只使用密文，不会回退读取明文。

## 登录小红书

本项目使用浏览器 Cookie 登录态，不需要小红书官方 API Key。后端启动后会把历史 Cookie 标记为“待验证”，前端会自动调用 `POST /api/auth/verify` 重新验证当前凭证仓库中的 Cookie；安装版使用 Windows 加密仓库，开发模式使用 `.env.local`。

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
11. 如果要把研究结果转成内容，进入“内容创作台”，建立项目、导入素材、配置规则库并生成或审稿。
12. 需要留档时，使用导出接口或前端导出入口。

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

笔记库里提供两个层级的数据删除能力：数据集管理器和已选笔记批量删除。删除前都会先展示影响范围，避免误删共用笔记或关联产物。

点击“数据集管理”可以集中查看全部数据范围，包括：

- 全部历史笔记。
- 有笔记的历史任务。
- 重复关键词组。
- 空任务、抓取失败任务和仍在运行的任务。
- 每个数据集关联的笔记数、队列项、队列错误、AI 产物和 AI 报告数量。

在笔记库选择单个任务后，可以点击“管理当前数据集”或在数据集管理器中删除指定数据集。系统会先调用 `/api/note-scopes/:jobId/clear-preview` 预览影响范围：

- 影响笔记数量。
- 仅解除任务关联的笔记数量。
- 真正删除的孤立笔记数量。
- 将删除的评论、队列项和本地分析报告数量。
- 关联的 AI 产物和 AI 报告数量。

确认清理后，系统默认只移除当前任务与笔记的关联；只有不再属于任何任务的笔记才会被真正删除。勾选“同时删除该任务关联的 AI 产物和 AI 报告”后，才会清理关联 AI 输出。

空数据集或失败数据集也可以删除。即使某个任务没有入库笔记，删除时也会清理它的任务记录、队列项和本地分析报告，使它从数据范围列表中移除。

在笔记列表中勾选多篇笔记后，可以点击“删除已选”。系统会先调用 `/api/notes/bulk-delete-preview` 展示：

- 本次命中的笔记数量。
- 当前数据集内只解除关联的笔记数量。
- 会被真正删除的孤立笔记数量。
- 会被清理的评论和本地分析报告数量。

如果当前限定在单个数据集内，共用笔记只会从该数据集中解除关联；如果未限定单个数据集，则按全局笔记删除处理。确认后调用 `/api/notes/bulk-delete` 执行。

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
- 提示词中心：查看、编辑、预览、启用和重置各工作流的 AI 提示词，支持引导式配置和高级模板。
- 自定义提示词：从系统提示词复制，也可以新建个人提示词；支持版本记录、恢复、预览、运行和归档。
- AI 报告：按任务生成 Markdown 报告。
- 工作流产物：生成内容规划、受众洞察、竞品分析、爆款拆解、爆款模板、单篇笔记分析。
- 产物范围：默认展示全部任务的产物和报告，也可以切换为仅看当前任务；从审稿记录或助手卡片打开的跨任务产物会按 ID 恢复，不会因列表筛选消失。
- 后台任务：Goal 和 AI 编排完成后保留当前页面、任务和阅读中的产物，通过卡片中的“查看研究档案与终稿”或“打开产物”显式查看结果。

AI 编排实时进度通过 Server-Sent Events：

```text
GET /api/ai/orchestrations/:id/events
```

模型 tools 调用只允许项目内定义的只读工具。服务端会校验工具名和参数，不接受删除数据、读取密钥、读取 Cookie、发送评论或修改配置等危险请求。

前端内置 Markdown 阅读器支持标题、列表、引用、代码块、表格、链接、行内代码、粗体、斜体和删除线。导出接口返回原始 Markdown。

## 内容创作台

内容创作台用于把研究数据转成可复盘的文案生产流程。未配置 AI 模型时，会回退到本地规则版草稿或审稿结果；配置模型后，会通过 OpenAI-compatible chat completions 生成 JSON 结构化结果。

主要能力：

- 内容项目：维护产品名、目标人群、场景、目标、关联规则库和关联搜索任务。
- 素材池：手动录入素材，或从已选笔记导入正文、标签、作者和互动数据。
- 规则库 Playbook：配置禁用词、敏感功效词、允许卖点、必备结构、语气词、人群、场景、标签和替换规则。
- 规则库版本：每次保存都会保留版本，可查看历史版本并恢复；规则库统计会汇总审稿次数、问题数、高风险数和高频问题类别。
- AI 审稿：对标题、正文和标签做风险扫描，输出通过/低风险/中风险/高风险、分数、问题清单、修改建议和修改稿。
- 批量审稿：可以批量审查手动输入的文案，也可以把笔记库中已补正文的选中笔记送入批量审稿。
- 周十五蜂蜜露专项：未绑定规则时默认执行内置专项政策；提示词中心、服务端扫描和前端模板共享同一政策。审稿会在 AI 或本地降级改稿后进行确定性产品纠错、原标签保护和二次扫描，并生成可复制的标题、内容和文末标签区块。
- 回填复审：审稿结果可载入修改稿继续人工调整并再次审稿，每次都会生成独立审稿记录和 AI 产物；人工粘贴文案的回填不会自动标记定稿。
- 笔记撰写：按产品、身份、痛点、场景、了解渠道、卖点、口吻、篇幅和关键词生成小红书笔记草稿。
- 批量生成：基于项目和素材池批量生成 1 到 8 篇草稿，每篇草稿会自动进入审稿流程。
- 结果归档：草稿、审稿报告和内容助手输出都会保存为 AI 产物，可在前端查看和导出 Markdown。

推荐使用流程：

1. 在“内容创作台”建立内容项目。
2. 从笔记库选择有正文的笔记，导入为项目素材，或手动添加素材。
3. 配置或选择一个规则库 Playbook。
4. 先用“审稿”检查现有文案的风险和表达问题。
5. 再用“笔记撰写”或“批量生成”生成草稿。
6. 查看自动审稿结果，必要时接受审稿修改稿。
7. 在“结果归档”导出草稿和审稿报告。

内容创作台不会自动发布笔记，也不会自动评论。发布前仍需要人工核对产品事实、体验真实性、素材授权和平台规则。

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
| `npm start` | 从 `dist/server/server/index.js` 启动生产服务 |
| `npm run desktop:start` | 构建后启动 Electron 桌面壳 |
| `npm run desktop:package` | 生成 Windows x64 未安装应用目录 |
| `npm run desktop:make` | 生成未签名 Windows x64 Setup.exe |

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
| `data/aiPromptConfigs.json` | 系统提示词的引导式/高级模板配置 |
| `data/aiCustomPrompts.json` | 用户自定义提示词 |
| `data/aiCustomPromptRevisions.json` | 自定义提示词版本记录 |
| `data/aiReports.json` | AI 或本地 Markdown 报告 |
| `data/aiArtifacts.json` | AI 工作流产物 |
| `data/aiOrchestrations.json` | AI 编排任务和步骤状态 |
| `data/contentPlaybooks.json` | 内容创作台规则库 |
| `data/contentPlaybookRevisions.json` | 规则库历史版本 |
| `data/contentProjects.json` | 内容项目 |
| `data/contentProjectMaterials.json` | 项目素材池 |
| `data/contentDrafts.json` | 内容草稿 |
| `data/contentReviews.json` | 审稿记录 |
| `data/browserBridgeStatus.json` | 浏览器助手最近检测和同步状态 |
| `data/media-cache/` | 媒体代理缓存 |
| `data/xhs-login-edge-profile/` | 专用 Edge 登录窗口 profile |

这些目录和文件都不应提交到 Git。`0.3.0` 正式运行只写 `data/app.db`；上表中的 JSON 文件仅作为 `0.1.1` 旧数据来源保留。

以上路径适用于浏览器开发模式。Electron 安装版使用 `%APPDATA%\小红书运营台` 作为根目录，避免把数据库、媒体、Edge Profile 或 `.env.local` 写入只读安装目录。

## 常用 API

存储与旧数据迁移：

```text
GET  /api/system/storage-status
POST /api/system/legacy-import/preview
POST /api/system/legacy-import/execute
```

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
POST   /api/notes/bulk-delete-preview
POST   /api/notes/bulk-delete
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
GET  /api/ai/prompts/:key
PUT  /api/ai/prompts/:key/guided
PUT  /api/ai/prompts/:key/advanced
PUT  /api/ai/prompts/:key
POST /api/ai/prompts/:key/reset
POST /api/ai/prompts/:key/activate
POST /api/ai/prompts/:key/preview
GET  /api/ai/custom-prompts
POST /api/ai/custom-prompts
POST /api/ai/custom-prompts/from-system
GET  /api/ai/custom-prompts/:id
PUT  /api/ai/custom-prompts/:id
DELETE /api/ai/custom-prompts/:id
GET  /api/ai/custom-prompts/:id/revisions
POST /api/ai/custom-prompts/:id/revisions/:revisionId/restore
POST /api/ai/custom-prompts/:id/preview
POST /api/ai/custom-prompts/:id/run
POST /api/ai/workflows/run
POST /api/ai/assistant/chat
POST /api/ai/orchestrations
GET  /api/ai/orchestrations/:id/events
GET  /api/ai/reports/:id/export
GET  /api/ai/artifacts/:id/export
```

内容创作台：

```text
GET    /api/content/playbooks
POST   /api/content/playbooks
PUT    /api/content/playbooks/:id
DELETE /api/content/playbooks/:id
GET    /api/content/playbooks/:id/revisions
GET    /api/content/playbooks/:id/stats
POST   /api/content/playbooks/:id/revisions/:revisionId/restore
GET    /api/content/projects
POST   /api/content/projects
PUT    /api/content/projects/:id
DELETE /api/content/projects/:id
GET    /api/content/projects/:id/materials
POST   /api/content/projects/:id/materials
POST   /api/content/projects/:id/materials/from-notes
DELETE /api/content/projects/:id/materials/:materialId
GET    /api/content/drafts
POST   /api/content/drafts
POST   /api/content/drafts/batch
POST   /api/content/drafts/:id/accept-review
GET    /api/content/reviews
POST   /api/content/reviews
POST   /api/content/reviews/batch
POST   /api/content/assistant/run
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

### AI 目标式内容生产

AI 助手可以把“先研究公开资料，再生成多篇小红书笔记”的请求识别为目标任务。任务在用户确认后依次抓取小红书样本、整理证据、批量写稿、逐篇审稿并归档到 AI 工作台。

公开网页检索是可选适配器。设置 `AI_PUBLIC_SEARCH_ENDPOINT` 后，后端会以 GET 请求调用该地址并附加 `q` 查询参数，响应格式为：

```json
{
  "results": [
    { "url": "https://example.com/public-source" }
  ]
}
```

未配置适配器时，任务会降级为“小红书公开样本 + 用户补充的 HTTPS 资料链接”，并在研究档案中标明数据缺口。公开来源只读，不开放发布、评论、点赞或账号配置工具。

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
