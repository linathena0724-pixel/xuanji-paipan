// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 玄玑排盘服务 HTTP 入口
// 隐私：日志只记方法、路径、状态码、耗时，请求体（生辰）一律不落日志。

import http from 'node:http';
import { paipan, InputError, ENGINE } from './paipan.js';
import { CONFIG_VERSION } from './config.js';

const PORT = Number(process.env.PORT ?? 8080);
// 设了就要求请求带 Authorization: Bearer <token>，只给主站服务器用
const TOKEN = process.env.PAIPAN_TOKEN ?? '';
const MAX_BODY_BYTES = 4 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

// 超过上限不直接断连接（客户端会拿不到响应）：停止缓存、读完剩下的，再正常回 413
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(new InputError('BODY_TOO_LARGE', '请求体不能超过 4KB'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/v1/health') {
    return send(res, 200, { ok: true, engine: ENGINE, config: CONFIG_VERSION });
  }
  if (path !== '/v1/bazi') return send(res, 404, { error: { code: 'NOT_FOUND' } });
  if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
  // 生辰只许放在请求体里：网址带任何查询参数都拒绝，免得生辰被写进代理或网关的访问日志
  if (url.search) {
    return send(res, 400, { error: { code: 'QUERY_NOT_ALLOWED', message: '不接受网址参数，生辰请放在 POST 请求体里' } });
  }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(res, 401, { error: { code: 'UNAUTHORIZED' } });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    if (err instanceof InputError) return send(res, 413, { error: { code: err.code, message: err.message } });
    return send(res, 400, { error: { code: 'BAD_JSON', message: '请求体不是合法 JSON' } });
  }

  try {
    return send(res, 200, paipan(body));
  } catch (err) {
    if (err instanceof InputError) return send(res, 400, { error: { code: err.code, message: err.message } });
    // 引擎自己的校验错误（如日期不存在）也按输入错误回，但不带原始输入
    if (err instanceof Error && /[一-龥]/.test(err.message)) {
      return send(res, 400, { error: { code: 'ENGINE_REJECTED', message: err.message } });
    }
    return send(res, 500, { error: { code: 'INTERNAL' } });
  }
}

export const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    const path = new URL(req.url, 'http://localhost').pathname;
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  handle(req, res).catch(() => send(res, 500, { error: { code: 'INTERNAL' } }));
});
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS;

// 测试时只导入不监听
if (process.env.NODE_ENV !== 'test') server.listen(PORT, () => console.log(`xuanji-paipan listening on :${PORT}`));
