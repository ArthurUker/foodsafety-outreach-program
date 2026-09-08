import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('生产 seed 缺少管理员密码时拒绝继续', () => {
  const result = spawnSync(process.execPath, ['prisma/seed.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SEED_ADMIN_PASSWORD: '',
      AUTO_SEED_CONTENT: 'false',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /生产环境必须设置 SEED_ADMIN_PASSWORD/);
});
