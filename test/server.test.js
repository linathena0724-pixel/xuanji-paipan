// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// HTTP 层回归测试：起一个真的服务，用真的请求打。生辰全部虚构。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
const { server } = await import('../src/server.js');

let port;
before(() => new Promise((resolve) => server.listen(0, () => { port = server.address().port; resolve(); })));
after(() => new Promise((resolve) => server.close(resolve)));

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { 'content-type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], json: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const OK_BODY = JSON.stringify({ date: '2000-01-01', time: '12:00', city: '北京市', gender: 'female' });

test('正常请求：200 且返回排盘结果', async () => {
  const r = await request('POST', '/v1/bazi', OK_BODY);
  assert.equal(r.status, 200);
  assert.match(r.type, /application\/json/);
  assert.equal(r.json.version.api, 'v1');
});

test('请求体超过 4KB：正常返回 JSON 413，不断开连接', async () => {
  const big = JSON.stringify({ date: '2000-01-01', time: '12:00', city: '北京市', gender: 'female', pad: 'x'.repeat(8000) });
  const r = await request('POST', '/v1/bazi', big);
  assert.equal(r.status, 413);
  assert.match(r.type, /application\/json/);
  assert.equal(r.json.error.code, 'BODY_TOO_LARGE');
});

test('请求体更大（1MB）也是 413 JSON', async () => {
  const r = await request('POST', '/v1/bazi', 'x'.repeat(1024 * 1024));
  assert.equal(r.status, 413);
  assert.equal(r.json.error.code, 'BODY_TOO_LARGE');
});

test('/v1/bazi 带任何查询参数都拒绝', async () => {
  for (const q of ['?date=2000-01-01&time=12:00', '?a=1', '?debug']) {
    const r = await request('POST', '/v1/bazi' + q, OK_BODY);
    assert.equal(r.status, 400, q);
    assert.equal(r.json.error.code, 'QUERY_NOT_ALLOWED', q);
  }
});

test('请求体不是 JSON：400 BAD_JSON', async () => {
  const r = await request('POST', '/v1/bazi', 'not json');
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'BAD_JSON');
});

test('健康检查', async () => {
  const r = await request('GET', '/v1/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});
