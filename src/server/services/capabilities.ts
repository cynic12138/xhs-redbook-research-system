import type { RedbookCapability } from "../../shared/types.js";

export const redbookCapabilities: RedbookCapability[] = [
  {
    key: "search",
    command: "search",
    module: "话题研究",
    label: "关键词搜索",
    description: "搜索关键词并种子化笔记列表，保留 webUrl 与 xsec_token。",
    status: "ready",
    risk: "read",
    route: "/api/search-jobs"
  },
  {
    key: "read",
    command: "read",
    module: "笔记库",
    label: "正文抓取",
    description: "读取标题、正文、类型、封面和互动数据。",
    status: "ready",
    risk: "read",
    route: "/api/notes/:id"
  },
  {
    key: "comments",
    command: "comments",
    module: "评论运营",
    label: "评论抓取",
    description: "按游标分页抓取评论，默认 3 页。",
    status: "ready",
    risk: "read",
    route: "/api/notes/:id"
  },
  {
    key: "user",
    command: "user / user-posts / followers / following",
    module: "竞品作者",
    label: "作者画像",
    description: "读取作者资料、近期作品、粉丝与关注列表。",
    status: "partial",
    risk: "read",
    route: "/api/redbook/followers"
  },
  {
    key: "feed",
    command: "feed",
    module: "内容发现",
    label: "推荐流读取",
    description: "读取首页推荐流，后续可作为趋势发现入口。",
    status: "ready",
    risk: "read",
    route: "/api/redbook/feed"
  },
  {
    key: "topics",
    command: "topics",
    module: "话题研究",
    label: "话题搜索",
    description: "搜索话题标签，用于选题和发布草稿。",
    status: "ready",
    risk: "read",
    route: "/api/redbook/topics"
  },
  {
    key: "favorites",
    command: "favorites / boards / board",
    module: "收藏与专辑",
    label: "收藏与专辑",
    description: "读取收藏笔记和专辑内容，适合做竞品素材库分析。",
    status: "ready",
    risk: "read",
    route: "/api/redbook/favorites"
  },
  {
    key: "health",
    command: "health",
    module: "限流检测",
    label: "限流检测",
    description: "基于创作者后台 level、敏感词和标签数量生成风险报告。",
    status: "partial",
    risk: "read",
    route: "/api/health-check/:jobId"
  },
  {
    key: "analyze-viral",
    command: "analyze-viral / viral-template",
    module: "爆款拆解",
    label: "爆款拆解",
    description: "分析钩子、正文结构、互动比例、评论主题和作者基线。",
    status: "ready",
    risk: "read",
    route: "/api/analytics/:jobId"
  },
  {
    key: "comment-reply",
    command: "comment / reply / batch-reply",
    module: "评论运营",
    label: "评论回复",
    description: "先生成候选和草稿，人工确认后进入限速发送队列。",
    status: "guarded",
    risk: "write",
    route: "/api/comment-plans"
  },
  {
    key: "collect-like",
    command: "collect / uncollect / like",
    module: "安全动作",
    label: "收藏点赞",
    description: "写入动作已保留后端边界，前端默认不做自动触发。",
    status: "guarded",
    risk: "write"
  },
  {
    key: "render",
    command: "render",
    module: "内容生产",
    label: "图文卡片",
    description: "Markdown 渲染为小红书风格 PNG，后续作为报告转卡片入口。",
    status: "planned",
    risk: "read"
  },
  {
    key: "post-delete",
    command: "post / delete",
    module: "安全动作",
    label: "发布删除",
    description: "高风险写入，二期仅展示能力，不默认开放。",
    status: "guarded",
    risk: "danger"
  }
];

