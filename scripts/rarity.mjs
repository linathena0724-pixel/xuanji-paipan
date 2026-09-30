// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 神煞出现比例统计：按日期枚举合成生辰排盘，数每个神煞出现在多少张盘里，生成 src/rarity.js。
// 全部是按日期生成的合成生辰，不含任何真人数据。
//
// 抽样规则（整段跑和分段跑抽到的是同一批日期）：
//   从全局起点 1950-01-01 起每 7 天取一天（7 与 60 互质，六十日柱都轮得到），
//   每天取 12 个时辰（00:30、02:30 … 22:30），出生地北京、钟表时，性别按样本序号奇偶交替。
//
// 用法：
//   node scripts/rarity.mjs count <起始日 YYYY-MM-DD> <结束日 YYYY-MM-DD> <输出计数.json> [--keep-going]
//   node scripts/rarity.mjs build <输出 src/rarity.js> <计数1.json> [计数2.json …]
// 1986～1991 年夏令时拨钟那天，凌晨 02:00～02:59 的钟表时间不存在，引擎拒排：这类样本单列为 skipped（记数量和输入），不算失败。
// 其余任何排盘错误默认直接退出（非零）；加 --keep-going 才跳过，失败数和失败输入写进计数文件。比例只用成功样本作分母。
// 现行表的生成命令见 README「稀有前三」。

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { paipan } from '../src/paipan.js';

export const ANCHOR = '1950-01-01';
export const STEP_DAYS = 7;
export const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const DAY = 86400000;
const ms = (iso) => Date.parse(iso + 'T00:00:00Z');

// [from, to] 闭区间里落在全局抽样网格上的日期
export function sampleDates(from, to) {
  const a = ms(ANCHOR), lo = ms(from), hi = ms(to);
  let k = Math.max(0, Math.ceil((lo - a) / (STEP_DAYS * DAY)));
  const out = [];
  for (let t = a + k * STEP_DAYS * DAY; t <= hi; t = a + ++k * STEP_DAYS * DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// 夏令时跳时造成的「钟表时间不存在」（引擎报错原文里带这两个词）
const isNonexistentLocalTime = (e) => /不存在/.test(e.message) && /夏令时/.test(e.message);

// 样本序号从全局起点算，性别按序号交替，所以分段跑跟整段跑每张盘的输入完全一样
function sampleIndex(date, hourIdx, hours) {
  return ((ms(date) - ms(ANCHOR)) / (STEP_DAYS * DAY)) * hours.length + hourIdx;
}

export function countRange({ from, to, hours = HOURS, keepGoing = false }) {
  const counts = {};
  const failures = [];
  const skipped = [];
  let ok = 0;
  for (const date of sampleDates(from, to)) {
    hours.forEach((h, hi) => {
      const input = { date, time: String(h).padStart(2, '0') + ':30', city: '北京市', gender: sampleIndex(date, hi, hours) % 2 ? 'male' : 'female', timeMode: 'clock' };
      let r;
      try {
        r = paipan(input);
      } catch (e) {
        if (isNonexistentLocalTime(e)) { skipped.push(input); return; }
        if (!keepGoing) throw new Error(`排盘失败 ${JSON.stringify(input)}：${e.message}`);
        failures.push({ input, error: String(e.message).slice(0, 200) });
        return;
      }
      for (const s of r.components.shenshaPanel.all) counts[s.name] = (counts[s.name] || 0) + 1;
      ok += 1;
    });
  }
  return { from, to, hours, ok, skipped: skipped.length, skippedInputs: skipped, failed: failures.length, failures, counts };
}

// 几段计数合并；分段必须首尾相接、不重叠
export function mergeCounts(parts) {
  const sorted = [...parts].sort((x, y) => ms(x.from) - ms(y.from));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = ms(sorted[i - 1].to), next = ms(sorted[i].from);
    if (next !== prevEnd + DAY) throw new Error(`分段没有首尾相接：${sorted[i - 1].to} → ${sorted[i].from}`);
  }
  const counts = {};
  for (const p of sorted) for (const [k, v] of Object.entries(p.counts)) counts[k] = (counts[k] || 0) + v;
  return {
    from: sorted[0].from,
    to: sorted[sorted.length - 1].to,
    ok: sorted.reduce((s, p) => s + p.ok, 0),
    skipped: sorted.reduce((s, p) => s + (p.skipped || 0), 0),
    failed: sorted.reduce((s, p) => s + p.failed, 0),
    counts,
  };
}

export function renderTable(m) {
  const names = Object.keys(m.counts).sort();
  let js = '// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan\n';
  js += '// 各神煞的出现比例（%）＝抽样排盘里有这颗星的盘占多少，供稀有前三排序和星级。\n';
  js += '// 本文件由 scripts/rarity.mjs 生成，别手改；抽样规则和生成命令见脚本开头与 README。\n';
  js += `// 抽样：${m.from}～${m.to}，自 ${ANCHOR} 起每 ${STEP_DAYS} 天一天，每天 ${HOURS.length} 个时辰，北京、钟表时。\n`;
  js += `// skipped＝夏令时跳时、钟表时间不存在的样本（不排盘、不进分母）。\n`;
  js += `export const SHENSHA_RARITY_SAMPLE = { ok: ${m.ok}, skipped: ${m.skipped || 0}, failed: ${m.failed} };\n`;
  js += 'export const SHENSHA_RARITY = {\n';
  for (const nm of names) js += `  ${nm}: ${Math.round((m.counts[nm] / m.ok) * 10000) / 100},\n`;
  return js + '};\n';
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'count') {
    const [from, to, out] = rest.filter((a) => !a.startsWith('--'));
    const r = countRange({ from, to, keepGoing: rest.includes('--keep-going') });
    fs.writeFileSync(out, JSON.stringify(r));
    console.log(`${from}～${to}：成功 ${r.ok}，跳过（时间不存在）${r.skipped}，失败 ${r.failed}`);
  } else if (cmd === 'build') {
    const [out, ...files] = rest;
    const m = mergeCounts(files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))));
    fs.writeFileSync(out, renderTable(m));
    console.log(`${m.from}～${m.to}：成功 ${m.ok}，跳过（时间不存在）${m.skipped}，失败 ${m.failed} → ${out}`);
  } else {
    console.error('用法见脚本开头注释');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
