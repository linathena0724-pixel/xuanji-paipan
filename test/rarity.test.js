// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 稀有度：星级边界、图谱权重对齐、比例表生成器可复现。生辰全部是合成数据。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paipan } from '../src/paipan.js';
import { starsOf } from '../src/components/shensha.js';
import { SHENSHA_DIMENSIONS } from '../src/config.js';
import { SHENSHA_RARITY_SAMPLE } from '../src/rarity.js';
import { ANCHOR, STEP_DAYS, sampleDates, countRange, mergeCounts, renderTable } from '../scripts/rarity.mjs';

test('星级阈值边界：15／30／45／60 各自落在下一档', () => {
  const cases = [[0, 5], [14.99, 5], [15, 4], [29.99, 4], [30, 3], [44.99, 3], [45, 2], [59.99, 2], [60, 1], [100, 1]];
  for (const [p, stars] of cases) assert.equal(starsOf(p), stars, `${p}%`);
});

test('图谱维度：weights 跟 shensha 一一对应，且等于配置里的权重', () => {
  for (const date of ['1966-03-09', '1983-08-27', '1999-12-02', '2004-06-18']) {
    for (const time of ['03:30', '15:30']) {
      const dims = paipan({ date, time, city: '北京市', gender: 'male' }).components.shenshaPanel.dimensions;
      for (const d of dims) {
        assert.equal(d.weights.length, d.shensha.length, `${date} ${d.name}`);
        const members = SHENSHA_DIMENSIONS.find((x) => x.key === d.key).members;
        d.shensha.forEach((name, i) => assert.equal(d.weights[i], members[name], `${date} ${d.name} ${name}`));
      }
    }
  }
});

test('抽样日期挂在全局网格上：分段取和整段取是同一批日期', () => {
  const whole = sampleDates('1950-01-01', '1953-12-31');
  const parts = ['1950', '1951', '1952', '1953'].flatMap((y) => sampleDates(`${y}-01-01`, `${y}-12-31`));
  assert.deepEqual(parts, whole);
  assert.equal(whole[0], ANCHOR);
  for (let i = 1; i < whole.length; i++) assert.equal(Date.parse(whole[i]) - Date.parse(whole[i - 1]), STEP_DAYS * 86400000);
  // 起点不在网格上的分段，也落回同一网格
  assert.deepEqual(sampleDates('1950-01-03', '1950-01-31'), ['1950-01-08', '1950-01-15', '1950-01-22', '1950-01-29']);
});

test('计数：分段合并与整段一次跑完全相同', () => {
  const hours = [0, 12];
  const whole = countRange({ from: '1990-01-01', to: '1990-03-31', hours });
  const merged = mergeCounts([
    countRange({ from: '1990-02-15', to: '1990-03-31', hours }),
    countRange({ from: '1990-01-01', to: '1990-02-14', hours }),
  ]);
  assert.equal(merged.ok, whole.ok);
  assert.equal(merged.failed, 0);
  assert.deepEqual(merged.counts, whole.counts);
  assert.throws(() => mergeCounts([countRange({ from: '1990-01-01', to: '1990-01-10', hours }), countRange({ from: '1990-01-12', to: '1990-01-31', hours })]), /首尾相接/);
});

test('夏令时跳时的钟表时间单列为跳过，不算失败', () => {
  // 1990-04-15 是当年夏令时开始日，02:30 不存在
  const r = countRange({ from: '1990-04-15', to: '1990-04-15', hours: [2, 12] });
  assert.equal(r.skipped, 1);
  assert.equal(r.failed, 0);
  assert.equal(r.ok, 1);
  assert.deepEqual(r.skippedInputs.map((x) => x.time), ['02:30']);
});

test('比例表：分母是成功样本数；现行表没有失败样本', () => {
  const js = renderTable({ from: '2000-01-01', to: '2000-12-31', ok: 200, skipped: 2, failed: 3, counts: { 甲星: 50, 乙星: 1 } });
  assert.match(js, /甲星: 25,/);
  assert.match(js, /乙星: 0.5,/);
  assert.match(js, /ok: 200, skipped: 2, failed: 3/);
  assert.equal(SHENSHA_RARITY_SAMPLE.failed, 0);
  assert.ok(SHENSHA_RARITY_SAMPLE.ok > 30000);
});
