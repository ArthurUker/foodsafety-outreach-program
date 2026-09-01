/**
 * 初始化种子：创建后台管理员 + 导入章节内容。
 *
 * 用法：
 *   cd backend && npm run seed
 *
 * 安全约束：
 * - 管理员初始密码必须来自环境变量 SEED_ADMIN_PASSWORD，缺失则拒绝运行（不设默认弱口令）。
 * - 已存在同名账号时跳过创建，可重复执行（幂等）。
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/authService.js';
import { isStrongPassword, isValidUsername } from '../lib/securityGuards.js';
import { SECTION_KEYS, validateSectionPayload } from '../lib/contentStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../data/content.seed.json');

const prisma = new PrismaClient();

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME || '平台管理员';

  if (!password) {
    console.warn('⚠️  未设置 SEED_ADMIN_PASSWORD，跳过管理员创建（如需创建请补充环境变量后重跑）。');
    return null;
  }
  if (!isValidUsername(username)) {
    throw new Error(`SEED_ADMIN_USERNAME 不合法（需 3-32 位字母/数字/下划线）：${username}`);
  }
  if (!isStrongPassword(password)) {
    throw new Error('SEED_ADMIN_PASSWORD 强度不足：至少 8 位且同时包含字母和数字。');
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`ℹ️  管理员 ${username} 已存在，跳过创建。`);
    return existing;
  }

  const user = await prisma.adminUser.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      displayName,
      role: 'owner',
      mustChangePassword: true, // 首次登录强制改密
    },
  });
  console.log(`✅ 已创建管理员：${username}（首次登录需修改密码）`);
  return user;
}

async function seedContent() {
  if (!fs.existsSync(SEED_PATH)) {
    console.warn(`⚠️  未找到种子文件 ${SEED_PATH}，跳过内容导入。`);
    return 0;
  }
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  let count = 0;

  for (const key of SECTION_KEYS) {
    const entry = seed.sections?.[key];
    if (!entry) continue;
    const { ok, payload, errors } = validateSectionPayload(key, entry.payload);
    if (!ok) {
      console.error(`❌ 章节 ${key} 种子内容校验失败：${errors.join('；')}`);
      continue;
    }
    await prisma.contentSection.upsert({
      where: { key },
      update: { title: entry.title ?? null, subtitle: entry.subtitle ?? null, payload },
      create: {
        key,
        title: entry.title ?? null,
        subtitle: entry.subtitle ?? null,
        payload,
        sortOrder: SECTION_KEYS.indexOf(key),
      },
    });
    count += 1;
  }
  console.log(`✅ 已导入/更新 ${count} 个章节内容。`);

  // 站点级配置
  if (seed.settings) {
    for (const [key, value] of Object.entries(seed.settings)) {
      await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    console.log(`✅ 已导入 ${Object.keys(seed.settings).length} 项站点配置。`);
  }

  return count;
}

async function main() {
  console.log('🌱 开始执行种子初始化...');
  await seedAdmin();
  if (process.env.AUTO_SEED_CONTENT !== 'false') {
    await seedContent();
  }
  console.log('🎉 种子初始化完成。');
}

main()
  .catch((err) => {
    console.error('❌ 种子初始化失败：', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
