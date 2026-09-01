/**
 * 仅导入/覆盖章节内容（不影响管理员账号）。
 * 用法：cd backend && npm run seed:content
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { SECTION_KEYS, validateSectionPayload } from '../lib/contentStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../data/content.seed.json');
const prisma = new PrismaClient();

async function main() {
  if (!fs.existsSync(SEED_PATH)) throw new Error(`未找到种子文件：${SEED_PATH}`);
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  let count = 0;

  for (const key of SECTION_KEYS) {
    const entry = seed.sections?.[key];
    if (!entry) continue;
    const { ok, payload, errors } = validateSectionPayload(key, entry.payload);
    if (!ok) {
      console.error(`❌ 章节 ${key} 校验失败：${errors.join('；')}`);
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
  console.log(`✅ 已导入/覆盖 ${count} 个章节内容。`);
}

main()
  .catch((e) => {
    console.error('❌ 内容导入失败：', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
