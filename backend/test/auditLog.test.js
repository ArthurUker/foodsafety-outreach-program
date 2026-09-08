import test from 'node:test';
import assert from 'node:assert/strict';

import { countAuditEvents } from '../lib/auditLog.js';

test('登录失败锁定统计同时限定用户名、时间窗口和 IP', async () => {
  let receivedWhere = null;
  const prisma = {
    auditLog: {
      count: async ({ where }) => {
        receivedWhere = where;
        return 3;
      },
    },
  };
  const since = new Date('2026-09-08T00:00:00.000Z');
  const count = await countAuditEvents(prisma, {
    action: 'login_failed',
    detailsPath: 'username',
    detailsValue: 'admin',
    since,
    ip: '203.0.113.10',
  });

  assert.equal(count, 3);
  assert.deepEqual(receivedWhere, {
    action: 'login_failed',
    createdAt: { gte: since },
    ip: '203.0.113.10',
    details: { path: ['username'], equals: 'admin' },
  });
});
