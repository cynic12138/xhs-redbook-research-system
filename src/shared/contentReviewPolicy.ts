export const WEEK_FIFTEEN_HONEY_DEW_POLICY_NAME = "周十五蜂蜜露专项审稿规则";
export const WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME = "周十五蜂蜜露";
export const WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID = "week-fifteen-honey-dew";
export const WEEK_FIFTEEN_HONEY_DEW_PROMPT_VERSION = "周十五蜂蜜露专项 2026.07";

const forbiddenTerms = [
  "yyds", "封神", "救命神器", "效果拉满", "绝了", "无敌", "性价比天花板", "闭眼冲", "必囤", "无限回购",
  "保姆式", "秒杀", "第一", "最强", "唯一", "手慢无", "断货王", "全网最低", "不买后悔", "马上下单", "赶紧买"
];

const sensitiveClaims = [
  "治疗", "治愈", "药效", "特效", "根治", "通便特效", "杜绝依赖", "宫缩风险", "早产风险", "永久不复发", "百分百有效",
  "百分百好用", "告别便秘永久不复发", "通便特效药", "立刻见效", "改善体质", "调理身体", "预防疾病"
];

const replacements = [
  { from: "周十五蜂露", to: "周十五蜂蜜露" },
  { from: "告别便秘永久不复发", to: "这是我的个人使用感受" },
  { from: "通便特效药", to: "对我来说使用体验比较顺手" },
  { from: "百分百好用", to: "我个人用下来感觉不错" },
  { from: "闭眼冲", to: "可以按自己的需求看看" },
  { from: "必囤", to: "有需要时可以备着" },
  { from: "无限回购", to: "我会按自己的使用感受决定是否继续购买" },
  { from: "救命神器", to: "对我来说比较方便" },
  { from: "百分百有效", to: "我的个人使用感受是" }
];

export const WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY = {
  name: WEEK_FIFTEEN_HONEY_DEW_POLICY_NAME,
  productName: WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
  defaultPlaybookId: WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID,
  promptVersion: WEEK_FIFTEEN_HONEY_DEW_PROMPT_VERSION,
  category: "小红书种草",
  forbiddenTerms,
  sensitiveClaims,
  competitorDisparagementTerms: ["吊打", "碾压", "完胜", "不如", "秒杀同类", "竞品不行", "绞痛", "难用", "刺激", "垃圾"],
  replacements,
  allowedSellingPoints: ["真实使用感", "生活场景", "温和表达"],
  requiredSections: ["标题", "内容", "标签"],
  toneWords: ["口语化", "真实分享", "生活化", "克制"],
  personas: ["真实用户", "普通上班族", "新手妈妈"],
  scenarios: ["日常通勤", "居家休息", "出门携带", "饭后日常"],
  tags: ["周十五蜂蜜露", "日常分享", "生活好物", "真实使用感"],
  reviewRules: [
    "强营销与表达方式：删除或替换闭眼冲、必囤、无限回购、救命神器、封神、全网最低、马上下单等强营销词，不制造稀缺、催单或绝对购买暗示；禁止商品说明书或商家详情页腔。",
    "医疗、身体表述与绝对化词：删除治疗、治愈、药效、特效、根治、百分百有效、百分百好用、告别便秘永久不复发、通便特效药、杜绝依赖、宫缩风险、早产风险、立刻见效等医疗、功效或绝对化表达；身体直白表述应改为委婉、生活化表达，避免低俗，只可保留有依据的个人主观感受。",
    "竞品贬低：不得使用吊打、碾压、完胜、竞品不行等贬低同类或竞品的表述，不得用其他产品“绞痛、难用、刺激、垃圾”等踩一捧一，也不得作无依据比较。",
    "结构保持与标签：保留原稿的标题、内容、标签、叙事顺序、已给出的事实和原标签；原标签只可纠错，不得新增、删除或改变顺序。修改稿必须以“标题：”“内容：”输出，原标签保持并放在文末。",
    "人设语气与文字逻辑：保留原稿已有的人设、生活场景、情绪和自然口吻，保证前后逻辑一致；弱化“产品看懂我的难受”等过度拟人。只能润色原稿已有或明确暗示的生活场景，不能虚构旅游、待产或其他经历。",
    "产品纠错、精简与扩写限制：产品统一写为周十五蜂蜜露；将“周十五蜂露”更正为“周十五蜂蜜露”，不得删除“周十五”品牌前缀。不杜撰成分、功效、适用人群、数据或体验，不新增事实卖点、经历或场景；修正逻辑夸张或极端情绪，删除重复冗余和堆砌好评。允许少量柔和 emoji，但禁止堆砌，原稿无 emoji 时不强行添加，不主动扩写原稿，不把真实分享改成硬广。"
  ]
} as const;

export const WEEK_FIFTEEN_HONEY_DEW_PROMPT_RULES = [
  `专项产品：${WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName}`,
  "优先级：与用户自定义或其他规则冲突时，专项规则优先。",
  `禁用词（必须删除或按替换规则弱化）：${WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms.join("、")}`,
  `敏感词（必须删除或弱化为有依据的个人感受）：${WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims.join("、")}`,
  `竞品贬低词（不得使用）：${WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.competitorDisparagementTerms.join("、")}`,
  ...WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.reviewRules.map((rule, index) => `${index + 1}. ${rule}`)
].join("\n");
