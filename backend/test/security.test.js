import test from 'node:test';
import assert from 'node:assert/strict';

import {
  corsConfigHasWildcard,
  isSafeUrl,
  isStrongPassword,
  validateJwtSecret,
} from '../lib/securityGuards.js';
import { clientIp, parsePagination, sanitizeObjectKeys, stripControlChars } from '../lib/validation.js';

test('启动安全守卫拒绝弱 JWT 密钥与通配符 CORS', () => {
  assert.match(validateJwtSecret('secret'), /弱密钥|长度不足/);
  assert.equal(validateJwtSecret('x'.repeat(48)), null);
  assert.equal(corsConfigHasWildcard('https://example.com,*'), true);
  assert.equal(corsConfigHasWildcard('https://example.com'), false);
});

test('密码和 URL 白名单按预期工作', () => {
  assert.equal(isStrongPassword('foodsafety2026'), true);
  assert.equal(isStrongPassword('onlyletters'), false);
  assert.equal(isSafeUrl('/images/demo.png'), true);
  assert.equal(isSafeUrl('https://example.com/demo'), true);
  assert.equal(isSafeUrl('//evil.example'), false);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
});

test('输入工具限制分页并剔除原型链污染键', () => {
  assert.deepEqual(parsePagination({ limit: '9999', offset: '-1' }), { limit: 200, offset: 0 });
  const cleaned = sanitizeObjectKeys(JSON.parse('{"safe":1,"__proto__":{"polluted":true}}'));
  assert.deepEqual(cleaned, { safe: 1 });
  assert.equal({}.polluted, undefined);
  assert.equal(stripControlChars('safe\u0000text\u007f'), 'safetext');
});

test('客户端 IP 只使用 Express 已解析的 req.ip', () => {
  const req = {
    ip: '203.0.113.10',
    headers: { 'x-forwarded-for': '198.51.100.99' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert.equal(clientIp(req), '203.0.113.10');
});
