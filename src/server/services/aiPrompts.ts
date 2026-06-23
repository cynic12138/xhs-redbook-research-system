import type {
  AiPromptInfo,
  AiPromptSource,
  AiWorkflowKey,
  AnalyticsReport,
  AuthorPostRecord,
  AuthorRecord,
  CommentRecord,
  NoteRecord,
  SearchJob
} from "../../shared/types.js";

export const AI_PROMPT_VERSION = "xhs-ops-v2.0";
export const AI_ASSISTANT_PROMPT_VERSION = "xhs-assistant-v2.0";
export const AI_REPORT_PROMPT_VERSION = "xhs-report-v2.0";

export interface AiPromptContext {
  job?: SearchJob;
  analytics?: AnalyticsReport;
  notes: NoteRecord[];
  selectedNote?: NoteRecord;
  comments: CommentRecord[];
  authors: AuthorRecord[];
  authorPosts: AuthorPostRecord[];
}

interface BuiltPrompt {
  prompt: string;
  promptKey: AiWorkflowKey;
  promptTitle: string;
  promptSource: AiPromptSource;
  promptVersion: string;
  contextSummary: string;
}

type PromptBuilder = (context: AiPromptContext, focus?: string) => string;

const promptInfos: AiPromptInfo[] = [
  {
    key: "content-planning",
    title: "内容策划",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["关键词任务", "数据总览", "关键词指标", "热门笔记", "高赞评论", "作者样本"],
    outputSections: ["核心机会判断", "关键词分层", "未来 7 天选题日历", "标题方向库", "正文结构模板", "优先级建议", "数据缺口与风险"]
  },
  {
    key: "audience-insight",
    title: "受众洞察",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["关键词任务", "数据总览", "热门笔记", "高赞评论", "选中笔记"],
    outputSections: ["受众画像摘要", "评论需求聚类", "用户原话素材库", "未满足需求", "内容机会", "评论运营建议", "数据缺口与风险"]
  },
  {
    key: "competitor-analysis",
    title: "竞品分析",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["关键词任务", "数据总览", "作者榜", "作者作品样本", "热门笔记", "关键词指标"],
    outputSections: ["竞品格局摘要", "作者分层", "内容支柱拆解", "爆款差异", "追赶机会", "7 天竞品跟进动作", "不建议模仿的点"]
  },
  {
    key: "viral-deep-dive",
    title: "AI 爆款拆解",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["选中笔记", "本地爆款分析", "高赞评论", "作者基线", "同任务热门笔记"],
    outputSections: ["爆款结论", "标题钩子", "正文结构", "媒体与呈现", "互动结构", "评论心理", "可复刻模板", "风险"]
  },
  {
    key: "viral-template",
    title: "爆款模板",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["关键词任务", "关键词指标", "爆款模板候选", "热门笔记", "高赞评论"],
    outputSections: ["模板总览", "标题公式", "正文结构模板", "评论触发机制", "选题复用方式", "不适合复用的结构", "数据缺口"]
  },
  {
    key: "note-analysis",
    title: "单篇笔记分析",
    version: AI_PROMPT_VERSION,
    inputRequirements: ["选中笔记", "正文与媒体", "互动数据", "高赞评论", "作者信息", "同任务热门笔记"],
    outputSections: ["当前表现判断", "标题诊断", "正文诊断", "媒体诊断", "评论需求", "下一步动作", "风险与限制"]
  }
];

const workflowPromptBuilders: Record<AiWorkflowKey, PromptBuilder> = {
  "content-planning": buildContentPlanningPrompt,
  "audience-insight": buildAudienceInsightPrompt,
  "competitor-analysis": buildCompetitorAnalysisPrompt,
  "viral-deep-dive": buildViralDeepDivePrompt,
  "viral-template": buildViralTemplatePrompt,
  "note-analysis": buildNoteAnalysisPrompt
};

const promptVariables = [
  { key: "job", label: "任务信息", description: "当前关键词任务、排序、类型、进度。" },
  { key: "overview", label: "数据总览", description: "笔记数、图文/视频数、平均点赞、总评论、总收藏。" },
  { key: "keywords", label: "关键词指标", description: "关键词层级、Top1、Top10 均值、机会分等。" },
  { key: "topNotes", label: "热门笔记", description: "当前任务内按热度排序的笔记样本。" },
  { key: "topComments", label: "高赞评论", description: "与当前任务或选中笔记相关的评论样本。" },
  { key: "authors", label: "作者榜", description: "作者粉丝、样本作品、均赞、爆发倍数等。" },
  { key: "authorPosts", label: "作者作品样本", description: "作者近期作品标题和互动数据。" },
  { key: "templates", label: "爆款模板候选", description: "本地规则提取的爆款分、钩子和内容类型。" },
  { key: "selectedNote", label: "选中笔记", description: "当前选中的单篇笔记及正文、互动、媒体信息。" },
  { key: "noteContent", label: "正文与媒体", description: "正文长度、正文预览、图片数量、视频状态。" },
  { key: "engagement", label: "互动数据", description: "点赞、收藏、评论、分享和互动比例。" },
  { key: "authorBaseline", label: "作者基线", description: "选中笔记作者的作品数、均赞、最高赞和样本。" },
  { key: "focus", label: "补充要求", description: "用户在运行工作流时填写的关注点。" }
];

export function listAiPromptInfos(): AiPromptInfo[] {
  return promptInfos;
}

export function buildAiWorkflowPrompt(key: AiWorkflowKey, context: AiPromptContext, focus?: string): BuiltPrompt {
  const info = getPromptInfo(key);
  return {
    prompt: workflowPromptBuilders[key](context, focus),
    promptKey: key,
    promptTitle: info.title,
    promptSource: "default",
    promptVersion: AI_PROMPT_VERSION,
    contextSummary: summarizeContext(context)
  };
}

export function buildCustomWorkflowPrompt(key: AiWorkflowKey, template: string, context: AiPromptContext, focus?: string): BuiltPrompt {
  const info = getPromptInfo(key);
  return {
    prompt: renderPromptTemplate(template, context, focus),
    promptKey: key,
    promptTitle: info.title,
    promptSource: "custom",
    promptVersion: `${AI_PROMPT_VERSION}-custom`,
    contextSummary: summarizeContext(context)
  };
}

export function getDefaultPromptTemplate(key: AiWorkflowKey): string {
  return defaultPromptTemplates[key];
}

export function getPromptVariables(): typeof promptVariables {
  return promptVariables;
}

export function buildAssistantPrompt(message: string, context: AiPromptContext, module?: string): string {
  return `${baseInstruction("当前小红书运营台的 AI 助手")}

用户正在 ${module || "工作台"} 模块中提问。请结合数据回答，输出中文 Markdown。

用户问题：${message}

当前任务：${context.job ? context.job.keywords.join(" / ") : "无"}
数据概览：${json(context.analytics?.overview ?? {})}
当前笔记：${json(context.selectedNote ? compactNote(context.selectedNote) : null)}
热门笔记：${json(context.notes.slice(0, 12).map(compactNote))}
高赞评论：${json(context.comments.slice(0, 20).map(compactComment))}

请给出明确下一步。不要建议自动评论、自动发布、自动点赞或自动收藏。`;
}

const defaultPromptTemplates: Record<AiWorkflowKey, string> = {
  "content-planning": `你是一名小红书内容增长策略总监，擅长从搜索结果、互动数据和评论需求中制定可执行选题计划。

统一规则：
- 只基于输入数据分析，不编造数字、作者、评论或结论。
- 必须输出中文 Markdown。
- 必须区分“数据结论”和“运营建议”。
- 必须标注数据缺口。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
任务信息：{job}
数据总览：{overview}
关键词指标：{keywords}
热门笔记：{topNotes}
高赞评论：{topComments}
作者样本：{authors}
补充要求：{focus}

请输出：# 内容策划方案，并包含核心机会判断、关键词分层、未来 7 天选题日历、标题方向库、正文结构模板、优先级建议、数据缺口与风险。`,
  "audience-insight": `你是一名小红书用户研究与评论洞察专家，擅长从评论区识别用户痛点、决策阻碍、真实语言和潜在内容需求。

统一规则：
- 只基于输入数据分析，不编造数字、作者、评论或结论。
- 必须输出中文 Markdown。
- 优先引用评论原话，不要把普通情绪过度解释为强需求。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
任务信息：{job}
数据总览：{overview}
热门笔记：{topNotes}
高赞评论：{topComments}
选中笔记：{selectedNote}
补充要求：{focus}

请输出：# 受众洞察报告，并包含受众画像摘要、评论需求聚类、用户原话素材库、未满足需求、内容机会、评论运营建议、数据缺口与风险。`,
  "competitor-analysis": `你是一名小红书竞品账号分析顾问，擅长从作者榜、作品样本、互动表现和内容风格中拆解竞品策略。

统一规则：
- 不要把单篇爆款等同于账号长期能力。
- 同时看粉丝规模、平均互动、最高互动、内容稳定性和爆款倍率。
- 区分“值得学习的结构”和“不建议模仿的风险”。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
任务信息：{job}
数据总览：{overview}
作者榜：{authors}
作者作品样本：{authorPosts}
热门笔记：{topNotes}
关键词指标：{keywords}
补充要求：{focus}

请输出：# 竞品分析报告，并包含竞品格局摘要、作者分层、内容支柱拆解、爆款差异、追赶机会、7 天竞品跟进动作、不建议模仿的点。`,
  "viral-deep-dive": `你是一名小红书爆款内容拆解专家，擅长分析单篇笔记为什么获得高互动，以及哪些结构可以复用。

统一规则：
- 必须围绕选中笔记，不要泛泛分析整个任务。
- 区分“可复用结构”和“不可复制因素”。
- 不输出洗稿内容，只输出结构化复刻建议。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
选中笔记：{selectedNote}
本地爆款分析：{selectedNote}
高赞评论：{topComments}
作者基线：{authorBaseline}
同任务热门笔记：{topNotes}
补充要求：{focus}

请输出：# 单篇爆款拆解，并包含爆款结论、标题钩子、正文结构、媒体与呈现、互动结构、评论心理、可复刻模板、风险。`,
  "viral-template": `你是一名小红书内容模板设计师，擅长从多篇高表现笔记中提炼可复用的标题公式、正文框架和内容生产模板。

统一规则：
- 模板必须来自多篇笔记的共同结构，不要只从一篇笔记过拟合。
- 模板用于启发创作，不用于复制原文。
- 优先提炼可批量生产的结构。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
任务信息：{job}
关键词指标：{keywords}
爆款模板候选：{templates}
热门笔记：{topNotes}
高赞评论：{topComments}
补充要求：{focus}

请输出：# 爆款模板库，并包含模板总览、标题公式、正文结构模板、评论触发机制、选题复用方式、不适合复用的结构、数据缺口。`,
  "note-analysis": `你是一名小红书单篇内容优化顾问，擅长从标题、正文、媒体、评论和互动数据中给出具体改写建议。

统一规则：
- 建议必须具体到标题、正文段落、封面/媒体、评论回复或续篇选题。
- 不要只说“优化标题”“提高互动”，必须给出可执行改法。
- 回复评论只能给草稿建议，不能自动发送。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。

输入数据：
选中笔记：{selectedNote}
正文与媒体：{noteContent}
互动数据：{engagement}
高赞评论：{topComments}
作者基线：{authorBaseline}
同任务热门笔记：{topNotes}
补充要求：{focus}

请输出：# 单篇笔记优化分析，并包含当前表现判断、标题诊断、正文诊断、媒体诊断、评论需求、下一步动作、风险与限制。`
};

export function buildReportPrompt(
  title: string,
  analytics: AnalyticsReport,
  notes: NoteRecord[],
  comments: CommentRecord[],
  focus?: string
): string {
  return `${baseInstruction("小红书内容增长分析师")}

请基于以下结构化数据输出一份中文 Markdown 报告。

报告标题：${title}
分析重点：${focus?.trim() || "话题机会、爆款结构、评论需求、可执行选题"}

总体数据：
${json(analytics.overview)}

关键词指标：
${json(analytics.keywords.slice(0, 12))}

作者榜：
${json(analytics.authors.slice(0, 10))}

热门笔记：
${json(
    notes.slice(0, 20).map((note) => ({
      title: note.title,
      desc: note.desc.slice(0, 300),
      author: note.authorName,
      type: note.type,
      likes: note.likedCount,
      collects: note.collectedCount,
      comments: note.commentCount,
      hotScore: note.hotScore,
      url: note.webUrl
    }))
  )}

高赞评论样本：
${json([...comments].sort((a, b) => b.likedCount - a.likedCount).slice(0, 30).map(compactComment))}

请按这些章节输出：
1. 市场概览
2. 关键词机会
3. 爆款标题与正文结构
4. 评论需求洞察
5. 竞品作者画像
6. 未来 7 天选题建议
7. 风险与数据局限`;
}

function buildContentPlanningPrompt(context: AiPromptContext, focus?: string): string {
  return `${baseInstruction("小红书内容增长策略总监")}

你的任务：
基于当前关键词任务、热门笔记、关键词指标、评论样本和作者样本，生成一份可直接执行的小红书内容策划方案。

分析原则：
- 不要编造数据，所有判断必须来自输入样本。
- 优先寻找“高收藏/点赞比”“高评论/点赞比”“Top1 高但整体竞争低”的机会。
- 区分红海话题、蓝海话题、可切入角度。
- 选题必须服务真实用户需求，而不是只复刻爆款标题。
- 输出要适合运营人员直接安排拍摄/写作。

输入数据：
任务信息：${json(compactJob(context.job))}
数据总览：${json(context.analytics?.overview ?? {})}
关键词指标：${json(context.analytics?.keywords.slice(0, 12) ?? [])}
热门笔记：${json(context.notes.slice(0, 25).map(compactNote))}
高赞评论：${json(context.comments.slice(0, 40).map(compactComment))}
作者样本：${json(context.analytics?.authors.slice(0, 12) ?? [])}
补充要求：${focus?.trim() || "给出可执行建议，并标注依据来自哪些数据。"}

请按以下 Markdown 结构输出：
# 内容策划方案

## 1. 核心机会判断
用 3-5 条说明当前最值得做的内容机会，并标注依据。

## 2. 关键词分层
用表格输出：关键词、热度判断、竞争判断、用户意图、建议切入角度、风险。

## 3. 未来 7 天选题日历
用表格输出：日期、选题标题、内容角度、正文结构、参考数据、目标互动、执行难度。

## 4. 标题方向库
分别给出清单型、避坑型、对比型、经验型、问答型标题，每类 3 个。

## 5. 正文结构模板
给出 3 套可复用正文结构：开头钩子、主体段落、证据材料、结尾 CTA。

## 6. 优先级建议
按“立刻做 / 观察后做 / 暂不建议做”分类。

## 7. 数据缺口与风险
说明当前数据不足、风控风险、内容误判风险。`;
}

function buildAudienceInsightPrompt(context: AiPromptContext, focus?: string): string {
  return `${baseInstruction("小红书用户研究与评论洞察专家")}

你的任务：
基于评论样本、笔记表现和关键词任务，提炼目标受众画像、需求层级、痛点聚类和可转化选题。

分析原则：
- 优先引用评论原话，不要把普通情绪过度解释为强需求。
- 区分“显性问题”“隐性焦虑”“购买/行动阻碍”“情绪共鸣”。
- 如果评论样本不足，必须明确说明置信度低。
- 输出必须能帮助运营人员写标题、正文和回复评论。

输入数据：
任务信息：${json(compactJob(context.job))}
数据总览：${json(context.analytics?.overview ?? {})}
热门笔记：${json(context.notes.slice(0, 25).map(compactNote))}
高赞评论：${json(context.comments.slice(0, 50).map(compactComment))}
选中笔记：${json(context.selectedNote ? compactNote(context.selectedNote) : null)}
补充要求：${focus?.trim() || "优先提炼用户痛点、原话和可转化选题。"}

请按以下 Markdown 结构输出：
# 受众洞察报告

## 1. 受众画像摘要
输出 2-4 类典型用户画像：身份、目标、焦虑、行动阻碍、常用表达。

## 2. 评论需求聚类
用表格输出：需求主题、代表评论、情绪强度、出现频率判断、可转化内容方向。

## 3. 用户原话素材库
摘取可用于标题或正文开头的用户原话，并说明适合怎么用。

## 4. 未满足需求
列出当前内容区还没有充分回答的问题。

## 5. 内容机会
给出 FAQ 笔记、经验笔记、对比笔记、清单笔记各 2 个方向。

## 6. 评论运营建议
给出人工回复策略和回复语气建议，只生成草稿方向，不自动发送。

## 7. 数据缺口与风险
说明评论样本不足、偏样本、争议话题等风险。`;
}

function buildCompetitorAnalysisPrompt(context: AiPromptContext, focus?: string): string {
  return `${baseInstruction("小红书竞品账号分析顾问")}

你的任务：
基于当前任务中的作者榜、作者作品样本、热门笔记和互动数据，输出竞品账号分析与追赶策略。

分析原则：
- 不要把单篇爆款等同于账号长期能力。
- 同时看粉丝规模、平均互动、最高互动、内容稳定性和爆款倍率。
- 区分“值得学习的结构”和“不建议模仿的风险”。
- 输出要能指导账号定位、选题选择和内容差异化。

输入数据：
任务信息：${json(compactJob(context.job))}
数据总览：${json(context.analytics?.overview ?? {})}
作者榜：${json(context.analytics?.authors.slice(0, 12) ?? [])}
作者作品样本：${json(context.authorPosts.slice(0, 60))}
热门笔记：${json(context.notes.slice(0, 25).map(compactNote))}
关键词指标：${json(context.analytics?.keywords.slice(0, 12) ?? [])}
补充要求：${focus?.trim() || "输出竞品格局、内容支柱和追赶机会。"}

请按以下 Markdown 结构输出：
# 竞品分析报告

## 1. 竞品格局摘要
说明当前赛道头部作者、腰部机会和新号切入难度。

## 2. 作者分层
用表格输出：作者、粉丝/作品样本、平均表现、最高表现、内容特征、可学习点、风险。

## 3. 内容支柱拆解
提炼竞品常用的 3-5 类内容支柱。

## 4. 爆款差异
分析高赞笔记与普通笔记在标题、正文、话题、评论触发点上的差异。

## 5. 追赶机会
给出当前账号可以避开正面竞争的差异化方向。

## 6. 7 天竞品跟进动作
输出具体动作：观察对象、要记录的数据、要验证的选题。

## 7. 不建议模仿的点
列出可能带来风控、争议、同质化的问题。`;
}

function buildViralDeepDivePrompt(context: AiPromptContext, focus?: string): string {
  const selected = context.selectedNote;
  return `${baseInstruction("小红书爆款内容拆解专家")}

你的任务：
对选中的单篇笔记进行深度拆解，解释它的爆点、结构、用户心理和可复刻方向。

分析原则：
- 必须围绕选中笔记，不要泛泛分析整个任务。
- 结合标题、正文、媒体类型、点赞、收藏、评论、评论主题和作者基线。
- 区分“可复用结构”和“不可复制因素”。
- 不输出洗稿内容，只输出结构化复刻建议。

输入数据：
选中笔记：${json(selected ? compactNote(selected) : null)}
本地爆款分析：${json(selected?.analysis ?? null)}
高赞评论：${json(context.comments.slice(0, 40).map(compactComment))}
作者基线：${json(authorBaseline(context))}
同任务热门笔记：${json(context.notes.slice(0, 20).map(compactNote))}
补充要求：${focus?.trim() || "解释爆点，并给出可复用但不洗稿的结构化建议。"}

请按以下 Markdown 结构输出：
# 单篇爆款拆解

## 1. 爆款结论
用 3-5 条说明这篇为什么值得拆解。

## 2. 标题钩子
分析标题里的对象、人群、冲突、利益点、情绪词和信息缺口。

## 3. 正文结构
拆成：开头、主体、证据、转折、结尾 CTA。若正文缺失，明确说明。

## 4. 媒体与呈现
分析图文/视频形式对理解成本、信任感和收藏价值的影响。

## 5. 互动结构
分析收藏/点赞比、评论/点赞比、分享/点赞比代表什么用户行为。

## 6. 评论心理
从评论中提炼用户为什么互动、追问、认同或争议。

## 7. 可复刻模板
给出 3 个同结构但不同表达的选题 brief，包括标题、开头、正文骨架。

## 8. 风险
说明哪些点不能直接照搬，哪些点可能造成同质化或误导。`;
}

function buildViralTemplatePrompt(context: AiPromptContext, focus?: string): string {
  return `${baseInstruction("小红书内容模板设计师")}

你的任务：
基于当前任务 Top 笔记、关键词指标、本地爆款模板和评论样本，生成可复用的爆款模板库。

分析原则：
- 模板必须来自多篇笔记的共同结构，不要只从一篇笔记过拟合。
- 每个模板都要说明适用场景、适合人群和不适合场景。
- 模板用于启发创作，不用于复制原文。
- 优先提炼可批量生产的结构。

输入数据：
任务信息：${json(compactJob(context.job))}
关键词指标：${json(context.analytics?.keywords.slice(0, 12) ?? [])}
爆款模板候选：${json(context.analytics?.templates.slice(0, 12) ?? [])}
热门笔记：${json(context.notes.slice(0, 30).map(compactNote))}
高赞评论：${json(context.comments.slice(0, 40).map(compactComment))}
补充要求：${focus?.trim() || "提炼可批量复用的标题公式、正文框架和评论触发机制。"}

请按以下 Markdown 结构输出：
# 爆款模板库

## 1. 模板总览
说明当前样本中最常见的爆款结构。

## 2. 标题公式
输出 5 个标题公式，每个包含：公式、适用场景、示例标题、注意事项。

## 3. 正文结构模板
输出 3-5 个正文模板，每个包含：开头、主体段落、证据材料、结尾 CTA。

## 4. 评论触发机制
说明哪些表达更容易引发提问、收藏、争议或补充。

## 5. 选题复用方式
给出如何把一个模板扩展成 5 篇不同笔记。

## 6. 不适合复用的结构
说明哪些爆款可能依赖个人经历、特殊资源或争议，不建议模板化。

## 7. 数据缺口
说明样本量、正文缺失、评论缺失对模板判断的影响。`;
}

function buildNoteAnalysisPrompt(context: AiPromptContext, focus?: string): string {
  const selected = context.selectedNote;
  return `${baseInstruction("小红书单篇内容优化顾问")}

你的任务：
分析选中笔记当前表现、内容优劣、用户反馈和后续优化方向。

分析原则：
- 建议必须具体到标题、正文段落、封面/媒体、评论回复或续篇选题。
- 不要只说“优化标题”“提高互动”，必须给出可执行改法。
- 如果正文、图片或评论缺失，要明确指出影响判断。
- 回复评论只能给草稿建议，不能自动发送。

输入数据：
选中笔记：${json(selected ? compactNote(selected) : null)}
正文与媒体：${json(noteContent(selected))}
互动数据：${json(engagement(selected))}
高赞评论：${json(context.comments.slice(0, 40).map(compactComment))}
作者信息：${json(selected?.authorId ? context.authors.find((author) => author.id === selected.authorId) ?? null : null)}
同任务热门笔记：${json(context.notes.slice(0, 20).map(compactNote))}
补充要求：${focus?.trim() || "给出具体标题、正文、媒体和续篇优化建议。"}

请按以下 Markdown 结构输出：
# 单篇笔记优化分析

## 1. 当前表现判断
说明这篇笔记属于高潜、普通、待优化还是数据不足。

## 2. 标题诊断
分析标题清晰度、人群指向、利益点、情绪张力，并给出 5 个改写标题。

## 3. 正文诊断
分析开头、信息密度、段落顺序、可信证据、结尾 CTA，并给出改写方向。

## 4. 媒体诊断
分析封面、图片/视频承载的信息、可读性和第一眼吸引力。

## 5. 评论需求
提炼评论区暴露的问题、反对意见、追问点和可做续篇。

## 6. 下一步动作
输出：立即改什么、下一篇写什么、评论怎么人工回复。

## 7. 风险与限制
说明数据不足、样本偏差和不建议操作。`;
}

function baseInstruction(role: string): string {
  return `你是一名${role}。

统一规则：
- 只基于输入数据分析，不编造数字、作者、评论或结论。
- 必须输出中文 Markdown。
- 必须区分“数据结论”和“运营建议”。
- 必须标注数据缺口。
- 不允许建议自动评论、自动发布、自动点赞、自动收藏。`;
}

function compactJob(job?: SearchJob): Record<string, unknown> | null {
  if (!job) return null;
  return {
    id: job.id,
    keywords: job.keywords,
    sort: job.sort,
    noteType: job.noteType,
    status: job.status,
    progress: job.progress
  };
}

function compactNote(note: NoteRecord): Record<string, unknown> {
  return {
    id: note.id,
    title: note.title,
    desc: note.desc.slice(0, 600),
    author: note.authorName,
    type: note.type,
    likes: note.likedCount,
    collects: note.collectedCount,
    comments: note.commentCount,
    shares: note.shareCount,
    hotScore: note.hotScore,
    analysis: note.analysis,
    media: noteContent(note),
    url: note.webUrl
  };
}

function compactComment(comment: CommentRecord): Record<string, unknown> {
  return {
    author: comment.authorName,
    content: comment.content,
    likes: comment.likedCount
  };
}

function noteContent(note?: NoteRecord): Record<string, unknown> | null {
  if (!note) return null;
  return {
    bodyLength: note.desc.length,
    bodyPreview: note.desc.slice(0, 800),
    hasBody: Boolean(note.desc.trim()),
    hasCover: Boolean(note.coverUrl),
    imageCount: note.imageUrls?.length ?? 0,
    hasVideo: Boolean(note.videoUrl),
    type: note.type
  };
}

function engagement(note?: NoteRecord): Record<string, unknown> | null {
  if (!note) return null;
  return {
    likes: note.likedCount,
    collects: note.collectedCount,
    comments: note.commentCount,
    shares: note.shareCount,
    hotScore: note.hotScore,
    collectLikeRatio: ratio(note.collectedCount, note.likedCount),
    commentLikeRatio: ratio(note.commentCount, note.likedCount),
    shareLikeRatio: ratio(note.shareCount, note.likedCount)
  };
}

function authorBaseline(context: AiPromptContext): Record<string, unknown> | null {
  const selected = context.selectedNote;
  if (!selected?.authorId) return null;
  const author = context.authors.find((item) => item.id === selected.authorId);
  const posts = context.authorPosts.filter((post) => post.authorId === selected.authorId);
  return {
    author,
    recentPostCount: posts.length,
    maxLikes: Math.max(0, ...posts.map((post) => post.likedCount)),
    avgLikes: posts.length ? Math.round(posts.reduce((sum, post) => sum + post.likedCount, 0) / posts.length) : 0,
    samples: posts.slice(0, 12)
  };
}

function summarizeContext(context: AiPromptContext): string {
  return [
    context.job ? `任务：${context.job.keywords.join(" / ")}` : "无任务",
    `笔记：${context.notes.length}`,
    `评论：${context.comments.length}`,
    `作者：${context.authors.length}`,
    context.selectedNote ? `选中：${context.selectedNote.title}` : "未选中笔记"
  ].join(" · ");
}

function renderPromptTemplate(template: string, context: AiPromptContext, focus?: string): string {
  const selected = context.selectedNote;
  const values: Record<string, unknown> = {
    job: compactJob(context.job),
    overview: context.analytics?.overview ?? {},
    keywords: context.analytics?.keywords.slice(0, 12) ?? [],
    authors: context.analytics?.authors.slice(0, 12) ?? [],
    templates: context.analytics?.templates.slice(0, 12) ?? [],
    selectedNote: selected ? compactNote(selected) : null,
    topNotes: context.notes.slice(0, 30).map(compactNote),
    topComments: context.comments.slice(0, 50).map(compactComment),
    authorPosts: context.authorPosts.slice(0, 60),
    noteContent: noteContent(selected),
    engagement: engagement(selected),
    authorBaseline: authorBaseline(context),
    focus: focus?.trim() || "给出可执行建议，并标注依据来自哪些数据。"
  };
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? json(values[key]) : match
  );
}

function getPromptInfo(key: AiWorkflowKey): AiPromptInfo {
  return promptInfos.find((info) => info.key === key) ?? promptInfos[0];
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
