// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 神煞区：稀有前三 + 图谱维度分（只出数字和档位，判词在主站按「维度×档位」配）

import { getShenShaType } from 'mingyu-core/bazi';
import {
  SHENSHA_DIMENSIONS,
  SHENSHA_SCORE_CAP,
  SHENSHA_TIERS,
  SHENSHA_RARITY_ORDER,
} from '../config.js';
import { presentPillars } from '../chart.js';

export function tierOf(score, tiers) {
  const i = tiers.findIndex((min) => score >= min);
  return i === -1 ? tiers.length : i;
}

// 名字 → 命中的柱位（同一柱不重复）
export function collectHits(chart) {
  const hits = new Map();
  for (const [key, pillar] of presentPillars(chart)) {
    for (const name of pillar.shensha ?? []) {
      if (!hits.has(name)) hits.set(name, []);
      if (!hits.get(name).includes(key)) hits.get(name).push(key);
    }
  }
  return hits;
}

export function shenshaPanel(chart) {
  const hits = collectHits(chart);

  const featured = SHENSHA_RARITY_ORDER.filter((name) => hits.has(name))
    .slice(0, 3)
    .map((name) => ({ name, pillars: hits.get(name), pillarCount: hits.get(name).length }));

  const dimensions = [];
  for (const dim of SHENSHA_DIMENSIONS) {
    const matched = Object.keys(dim.members).filter((name) => hits.has(name));
    if (matched.length === 0) continue;
    const sum = matched.reduce((s, name) => s + dim.members[name], 0);
    const score = Math.min(SHENSHA_SCORE_CAP, sum);
    dimensions.push({ key: dim.key, name: dim.name, score, tier: tierOf(score, SHENSHA_TIERS), shensha: matched });
  }

  const all = [...hits.entries()].map(([name, pillars]) => ({ name, type: getShenShaType(name), pillars }));

  return { featured, dimensions, all };
}
