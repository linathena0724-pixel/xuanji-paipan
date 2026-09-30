// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// README 写的口径必须跟代码一致（版本号、五行权重），防止文档跟配置走偏。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG_VERSION, WUXING_RING } from '../src/config.js';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README 里出现的配置版本号都是当前版本', () => {
  const versions = [...readme.matchAll(/\d{4}-\d{2}-\d{2}\.v[\d.]+/g)].map((m) => m[0]);
  assert.ok(versions.length > 0);
  for (const v of versions) assert.equal(v, CONFIG_VERSION);
});

test('README 写的五行权重跟配置一致', () => {
  const w = WUXING_RING.hiddenWeightsByCount;
  assert.ok(readme.includes(w[3].join(' / ')), `README 应写三藏干 ${w[3].join(' / ')}`);
  assert.ok(readme.includes(w[2].join(' / ')), `README 应写两藏干 ${w[2].join(' / ')}`);
});
