// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 接口层测试。生辰全部虚构。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paipan } from '../src/paipan.js';

const BASE = { date: '2000-01-01', time: '12:00', city: '北京市', gender: 'female' };

test('正常排盘返回完整结构', () => {
  const out = paipan(BASE);
  assert.equal(out.version.api, 'v1');
  assert.equal(out.input.timeKnown, true);
  for (const key of ['year', 'month', 'day', 'hour']) assert.ok(out.bazi.pillars[key].ganZhi);
  assert.equal(out.components.tenGodBar.rows.length, 10);
  assert.equal(out.components.wuxingRing.rows.reduce((s, r) => s + r.percent, 0), 100);
  assert.ok(out.bazi.luck.cycles.length > 0);
  assert.ok(out.bazi.luck.cycles.every((c) => typeof c.score === 'number'));
});

test('时辰不详：时柱为空，不默认午时', () => {
  const out = paipan({ ...BASE, time: null });
  assert.equal(out.bazi.pillars.hour, null);
  assert.equal(out.input.timeKnown, false);
  assert.ok(out.warnings.some((w) => w.includes('时辰未知')));
});

test('性别不许默认', () => {
  assert.throws(() => paipan({ ...BASE, gender: undefined }), { code: 'GENDER_REQUIRED' });
  assert.throws(() => paipan({ ...BASE, gender: '' }), { code: 'GENDER_REQUIRED' });
});

test('输入校验', () => {
  assert.throws(() => paipan({ ...BASE, date: '2000/01/01' }), { code: 'DATE_REQUIRED' });
  assert.throws(() => paipan({ ...BASE, time: '25:00' }), { code: 'TIME_INVALID' });
  assert.throws(() => paipan({ ...BASE, city: '' }), { code: 'CITY_REQUIRED' });
  assert.throws(() => paipan({ ...BASE, city: '不存在的城市xyz' }), { code: 'LOCATION_NOT_FOUND' });
});

test('真太阳时按城市经度校正', () => {
  // 北京经度 116.4°：经度差约 −14 分钟，1 月 1 日均时差约 −4 分钟
  assert.equal(paipan(BASE).input.trueSolarTime, '2000-01-01 11:42');
  // 乌鲁木齐钟表 12:00 的真太阳时还不到 10 点，落在巳时
  const west = paipan({ ...BASE, city: '乌鲁木齐市' });
  assert.ok(west.input.trueSolarTime < '2000-01-01 10:00');
  assert.equal(west.bazi.pillars.hour.zhi, '巳');
});

test('时间口径：默认真太阳时，可切北京时间；两种排出来不同就提示', () => {
  // 北京 12:00：两种都是午时，不提示
  const bj = paipan(BASE);
  assert.equal(bj.input.timeMode, 'true_solar');
  assert.equal(bj.timeCheck.differs, false);
  assert.ok(!bj.warnings.some((w) => w.includes('时辰交界')));
  // 乌鲁木齐 12:00：北京时间是午时，真太阳时不到 10 点是巳时
  const clock = paipan({ ...BASE, city: '乌鲁木齐市', timeMode: 'clock' });
  assert.equal(clock.bazi.pillars.hour.zhi, '午');
  assert.equal(clock.input.trueSolarTime, null);
  assert.equal(clock.timeCheck.differs, true);
  assert.ok(clock.warnings.some((w) => w.includes('本盘按北京时间')));
  const solar = paipan({ ...BASE, city: '乌鲁木齐市' });
  assert.equal(solar.bazi.pillars.hour.zhi, '巳');
  assert.ok(solar.warnings.some((w) => w.includes('本盘按真太阳时')));
  // 晚子时（23 点）按北京时间也要能排
  assert.equal(paipan({ ...BASE, time: '23:30', timeMode: 'clock' }).bazi.pillars.hour.zhi, '子');
  assert.throws(() => paipan({ ...BASE, timeMode: 'local' }), { code: 'TIME_MODE_INVALID' });
});

test('大运：每步 years 正好是 startYear～endYear 十年，前后两步不重叠', () => {
  for (const body of [BASE, { ...BASE, gender: 'male' }, { ...BASE, date: '1990-06-15', time: '03:20', city: '广州市' }]) {
    const cycles = paipan(body).bazi.luck.cycles;
    assert.ok(cycles.length >= 8);
    cycles.forEach((c, i) => {
      assert.equal(c.endYear, c.startYear + 9);
      assert.equal(c.years.length, 10, `${c.ganZhi} 应该 10 年`);
      assert.equal(c.years[0].year, c.startYear);
      assert.equal(c.years.at(-1).year, c.endYear);
      if (i + 1 < cycles.length) assert.equal(cycles[i + 1].startYear, c.endYear + 1);
    });
  }
});
