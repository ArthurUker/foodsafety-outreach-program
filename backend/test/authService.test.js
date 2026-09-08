import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthService, dummyCompare, hashPassword, verifyPassword } from '../lib/authService.js';

const secret = 'test-only-secret-that-is-longer-than-thirty-two-characters';

test('bcrypt 哈希与比较使用异步接口', async () => {
  const hash = await hashPassword('VerifyPass2026');
  assert.equal(await verifyPassword('VerifyPass2026', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  await dummyCompare('unknown-user-password');
});

test('单令牌吊销写入失败必须向上传播', async () => {
  const prisma = {
    revokedToken: {
      upsert: async () => {
        throw new Error('database unavailable');
      },
    },
  };
  const service = new AuthService(prisma, secret);
  await assert.rejects(
    service.revokeToken('jti-1', 'user-1', new Date(Date.now() + 60_000)),
    /database unavailable/,
  );
});

test('全量吊销使用调用方事务客户端，并且记录不会自然过期后复活旧令牌', async () => {
  let data = null;
  const transactionClient = {
    revokedToken: {
      create: async (args) => {
        data = args.data;
      },
    },
  };
  const service = new AuthService({}, secret);
  await service.revokeAllUserTokens('user-1', transactionClient);

  assert.equal(data.userId, 'user-1');
  assert.match(data.jti, /^user_all:/);
  assert.equal(data.expiresAt.getUTCFullYear(), 9999);
});
