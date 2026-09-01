/**
 * 站点内容存储层：章节白名单、payload 校验、读写封装。
 *
 * 与前端 js/modules/registry.js 的章节注册表一一对应：
 * 后端只做「key 白名单 + 结构/安全校验」，渲染语义完全由前端 registry 决定。
 * 新增章节 = 前端 registry 登记 + 本文件 SECTION_KEYS 同步，两处改动即可，零改码渲染管线。
 */

import { sanitizeObjectKeys, jsonDepth, jsonByteSize, sanitizeText } from './validation.js';
import { isHexColor, isSafeUrl } from './securityGuards.js';

/** 章节 key 白名单（顺序即页面渲染顺序，与前端 SECTION_ORDER 保持一致） */
export const SECTION_KEYS = [
  'hero',
  'background',
  'overview',
  'capability',
  'technology',
  'practice',
  'roadmap',
  'contact',
];

/** 单字段体积上限（200KB）与嵌套深度上限（6 层） */
const MAX_PAYLOAD_BYTES = 200 * 1024;
const MAX_PAYLOAD_DEPTH = 6;
const MAX_TEXT_LENGTH = 4000;

export function isValidSectionKey(key) {
  return SECTION_KEYS.includes(key);
}

/**
 * 章节 payload 校验。
 * 通用校验：深度、体积、字符串长度、链接安全性。
 * 专项校验：对已知章节的高价值字段做形状检查（缺失即 400，避免前端渲染崩溃）。
 * @returns {{ ok: true, payload: object } | { ok: false, errors: string[] }}
 */
export function validateSectionPayload(key, rawPayload) {
  const errors = [];

  if (!isValidSectionKey(key)) {
    return { ok: false, errors: [`未知的章节 key：${key}`] };
  }
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { ok: false, errors: ['payload 必须是 JSON 对象。'] };
  }

  const payload = sanitizeObjectKeys(rawPayload);
  if (!payload) return { ok: false, errors: ['payload 嵌套层级过深。'] };

  if (jsonDepth(payload) > MAX_PAYLOAD_DEPTH) {
    errors.push(`payload 嵌套深度不得超过 ${MAX_PAYLOAD_DEPTH} 层。`);
  }
  if (jsonByteSize(payload) > MAX_PAYLOAD_BYTES) {
    errors.push('payload 体积超过 200KB 上限。');
  }

  // 递归扫描：字符串长度与 URL 安全性
  const walk = (node, path) => {
    if (typeof node === 'string') {
      if (node.length > MAX_TEXT_LENGTH) errors.push(`${path} 文本长度超过 ${MAX_TEXT_LENGTH} 字符。`);
      if (/(^|\.)image$|(^|\.)imageUrl$|(^|\.)href$|(^|\.)url$/.test(path) && !isSafeUrl(node)) {
        errors.push(`${path} 不是合法的链接（仅允许 http/https 或站内相对路径）。`);
      }
      if (/(^|\.)color$|(^|\.)accent$/.test(path) && !isHexColor(node)) {
        errors.push(`${path} 不是合法的 HEX 颜色值。`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(payload, '');

  // 专项形状校验
  const requireArray = (field) => {
    if (!Array.isArray(payload[field])) errors.push(`缺少数组字段：${field}`);
  };
  const requireObject = (field) => {
    if (!payload[field] || typeof payload[field] !== 'object') errors.push(`缺少对象字段：${field}`);
  };

  if (key === 'hero') {
    if (!payload.title) errors.push('hero 缺少 title');
    requireArray('metrics');
  }
  if (key === 'background') requireArray('points');
  if (key === 'overview') requireArray('pillars');
  if (key === 'capability') requireArray('groups');
  if (key === 'technology') requireArray('layers');
  if (key === 'practice') {
    requireArray('metrics');
    requireArray('highlights');
  }
  if (key === 'roadmap') requireArray('phases');
  if (key === 'contact') requireObject('channels');

  return errors.length > 0 ? { ok: false, errors } : { ok: true, payload };
}

/** 读取全部章节（按 sortOrder 升序） */
export async function listSections(prisma) {
  const rows = await prisma.contentSection.findMany({
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  });
  return rows.map((row) => ({
    key: row.key,
    title: row.title,
    subtitle: row.subtitle,
    payload: row.payload,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }));
}

/** 读取单个章节 */
export async function getSection(prisma, key) {
  const row = await prisma.contentSection.findUnique({ where: { key } });
  if (!row) return null;
  return {
    key: row.key,
    title: row.title,
    subtitle: row.subtitle,
    payload: row.payload,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

/** 写入（upsert）单个章节 */
export async function putSection(prisma, { key, title, subtitle, payload, updatedBy }) {
  return prisma.contentSection.upsert({
    where: { key },
    update: {
      title: title ? sanitizeText(title, 120) : null,
      subtitle: subtitle ? sanitizeText(subtitle, 300) : null,
      payload,
      updatedBy: updatedBy ?? null,
    },
    create: {
      key,
      title: title ? sanitizeText(title, 120) : null,
      subtitle: subtitle ? sanitizeText(subtitle, 300) : null,
      payload,
      sortOrder: SECTION_KEYS.indexOf(key),
      updatedBy: updatedBy ?? null,
    },
  });
}

/** 站点配置读写 */
export async function listSettings(prisma) {
  const rows = await prisma.siteSetting.findMany();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function putSetting(prisma, { key, value, updatedBy }) {
  return prisma.siteSetting.upsert({
    where: { key },
    update: { value, updatedBy: updatedBy ?? null },
    create: { key, value, updatedBy: updatedBy ?? null },
  });
}
