// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 玄玑 xuanji-paipan · 算法配置表
// 口径只改这里，计算函数只读不写死数字。改了任何一项都要升 CONFIG_VERSION。

export const CONFIG_VERSION = '2026-09-30.v1.5';

export const ELEMENTS = ['木', '火', '土', '金', '水'];

export const TEN_GOD_ORDER = ['比肩', '劫财', '食神', '伤官', '正财', '偏财', '正官', '七杀', '正印', '偏印'];

// ── 五行能量环：加权计数 ──
// 天干每字 1；地支藏干按个数分权，顺序＝本气、中气、余气（藏干表取自 mingyu-core）。
// v1.1（按样本盘网格拟合）：三个藏干的支 0.5 / 0.25 / 0.05（三项和是 0.8，照拟合原值用），
// 一个藏干的支 1，两个藏干的支（亥、午）0.7 / 0.3 不变。土行仍系统性偏高（+2.5～+8），疑为合局／旺衰修正，待 v2。
export const WUXING_RING = {
  stemWeight: 1,
  hiddenWeightsByCount: { 1: [1], 2: [0.7, 0.3], 3: [0.5, 0.25, 0.05] },
  includeDayMaster: true,
  // 旧的极差阈值：只作参考值输出，不再决定类型标签（样本盘验证下来极差规则只对一半）
  typeThresholds: { balancedMax: 25, dominantMax: 40 },
};

// ── 类型标签：身强弱强度分 → 四档（v0，按样本盘标定，分界线较薄，样本多了要复校）──
// 强度分 = 月令项 + 通根项 + 得势项，三项都取自引擎的身强弱判断（ruleBasis 与通根字段）
export const STRENGTH_SCORE = {
  month: { 扶身: 25, 相持: 20, 制身: 10 },       // 月令与司令合看
  root: { strong: 40, has: 10, none: 0 },        // 通根：强根／有根／无根
  momentum: { 扶身: 20, 相持: 10, 制身: 0 },     // 成局、明根明透及中余气合看（得势）
};
// 从高到低：分数 ≥ 下限就是这一档
export const STRENGTH_TYPE_BANDS = [
  { min: 80, type: '极强型' },
  { min: 60, type: '身强型' },
  { min: 55, type: '均衡型' },
  { min: 0, type: '偏弱型' },
];

// ── 十神占比条：扁平计数 ──
// 天干每字 1、每个藏干 1、日主不计；归一后每项去尾取整，总和可以不足 100。
export const TEN_GOD_BAR = {
  includeDayMaster: false,
};

// ── 神煞图谱：维度分 = 组内命中神煞权重之和，封顶 ──
// 名称用 mingyu-core 的叫法（勾绞 → 勾绞煞，童子 → 童子煞，红艳 → 红艳煞）。
export const SHENSHA_SCORE_CAP = 99;
export const SHENSHA_DIMENSIONS = [
  { key: 'guiren', name: '贵人', members: { 天乙贵人: 35, 天德贵人: 33, 月德贵人: 25, 福星贵人: 14, 德秀贵人: 6, 月德合: 45, 天德合: 24 } },
  { key: 'caihua', name: '才华', members: { 文昌贵人: 50, 词馆: 48, 学堂: 40, 天医: 35 } },
  { key: 'qinggan', name: '情感', members: { 红艳煞: 48, 桃花: 48, 天喜: 47, 红鸾: 4 } },
  { key: 'poli', name: '魄力', members: { 将星: 45, 羊刃: 45 } },
  { key: 'huigen', name: '慧根', members: { 华盖: 35, 十灵日: 35, 太极贵人: 30, 童子煞: 25 } },
  { key: 'chengjiu', name: '成就', members: { 国印贵人: 40, 金舆: 40, 禄神: 50 } },
  { key: 'kaoyan', name: '考验', members: { 天罗地网: 27, 勾绞煞: 15, 劫煞: 15, 亡神: 13, 十恶大败: 8, 六厄: 7, 元辰: 7 } },
];
// 档位下限，从高到低；判词按「维度 × 档位」在主站配
export const SHENSHA_TIERS = [90, 70, 50];

// 稀有前三：从命中的吉神（外加华盖）里，按出现比例（有这颗星的盘占多少）从小到大取前三。
// 比例表在 src/rarity.js，是用本服务按出生时间抽样排盘统计出来的（不是任何用户库的数据），见 scripts/rarity.mjs。
export const SHENSHA_FEATURED_EXTRA = ['华盖'];
// 星级分界（%）：出现比例 <15 五星／15–30 四星／30–45 三星／45–60 二星／≥60 一星；只由出现比例决定，越少见星越多
export const SHENSHA_STAR_BANDS = [15, 30, 45, 60];

// ── 大运 / 流年分数（方案 A）──
// score = base + xiJiWeight×(干喜忌 + 支喜忌) + tenGodWeight×(干十神 + 支十神)，再夹到 clip 区间；地支取本气。
// v1 的十神项跟喜忌项重复（引擎的「用神类别」就是第一喜用五行对应的十神），分数被锁在 50～90、最低档永远出不来 →
// A：十神项权重归 0，喜忌权重 4→8，分数落在 38～98，五档都能出现
export const LUCK_SCORE = {
  base: 70,
  xiJiWeight: 8,
  tenGodWeight: 0,
  clip: [35, 98],
  xiJi: { primaryFavorable: 2, favorable: 1, primaryUnfavorable: -2, unfavorable: -1 },
  tenGod: { useful: 1, avoid: -1 },
};
// 档位下限，从高到低：上上 ≥90 / 上 75–89 / 中 60–74 / 下 45–59 / 下下 <45
export const LUCK_TIERS = [90, 75, 60, 45];

// mingyu-core 喜用「类别」对应的十神
export const TEN_GOD_GROUPS = {
  比劫: ['比肩', '劫财'],
  食伤: ['食神', '伤官'],
  财星: ['正财', '偏财'],
  官杀: ['正官', '七杀'],
  印星: ['正印', '偏印'],
};
