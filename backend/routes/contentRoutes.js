/**
 * 站点章节内容路由：/api/content
 *
 * 读（GET）公开 —— 宣传站首页无需登录即可渲染。
 * 写（PUT / reset）需 editor 及以上角色。
 *
 * 内容落 ContentSection 表，payload 为 JSON；前端渲染完全由 payload 驱动，
 * 改文案不再需要改代码或重新构建 dist/。
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SECTION_KEYS,
  validateSectionPayload,
  listSections,
  getSection,
  putSection,
} from '../lib/contentStore.js';
import { writeAuditLog } from '../lib/auditLog.js';
import { sanitizeText } from '../lib/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../data/content.seed.json');

function readSeed() {
  if (!fs.existsSync(SEED_PATH)) return null;
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
}

export function createContentRoutes({ prisma, authenticateUser, authorizeRoles }) {
  const router = express.Router();

  /** 章节元信息（供后台生成编辑表单） */
  router.get('/meta', (_req, res) => {
    res.json({ success: true, keys: SECTION_KEYS });
  });

  /** 全部章节内容（公开） */
  router.get('/', async (_req, res) => {
    try {
      const sections = await listSections(prisma);
      // 内容可能被后台修改，禁用强缓存；交由 CDN/浏览器协商缓存
      res.setHeader('Cache-Control', 'no-cache');
      res.json({ success: true, sections });
    } catch (err) {
      console.error('[content.list]', err.message);
      res.status(500).json({ error: '读取站点内容失败。' });
    }
  });

  /** 单章节内容（公开） */
  router.get('/:key', async (req, res) => {
    const key = sanitizeText(req.params.key, 64);
    if (!SECTION_KEYS.includes(key)) return res.status(404).json({ error: '章节不存在。' });
    const section = await getSection(prisma, key);
    if (!section) return res.status(404).json({ error: '章节内容尚未初始化。' });
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ success: true, section });
  });

  /** 更新章节内容（editor+）。整体覆盖语义，写入前做结构与安全校验。 */
  router.put('/:key', authenticateUser, authorizeRoles('owner', 'editor'), async (req, res) => {
    const key = sanitizeText(req.params.key, 64);
    const { ok, payload, errors } = validateSectionPayload(key, req.body?.payload);

    if (!ok) return res.status(400).json({ error: '内容校验未通过。', details: errors.slice(0, 10) });

    try {
      await putSection(prisma, {
        key,
        title: req.body?.title,
        subtitle: req.body?.subtitle,
        payload,
        updatedBy: req.user.username,
      });
      await writeAuditLog(prisma, {
        req,
        actor: req.user,
        action: 'content_update',
        resourceType: 'content',
        resourceId: key,
        details: { bytes: JSON.stringify(payload).length },
      });
      const section = await getSection(prisma, key);
      res.json({ success: true, section });
    } catch (err) {
      console.error('[content.update]', err.message);
      res.status(500).json({ error: '保存内容失败。' });
    }
  });

  /**
   * 恢复章节为种子内容（owner）。
   * body: { key?: string } —— 不传 key 则恢复全部章节。
   */
  router.post('/reset', authenticateUser, authorizeRoles('owner'), async (req, res) => {
    const seed = readSeed();
    if (!seed) return res.status(500).json({ error: '未找到种子内容文件 data/content.seed.json。' });

    const key = req.body?.key ? sanitizeText(req.body.key, 64) : null;
    const targets = key ? [key] : SECTION_KEYS;

    try {
      let count = 0;
      for (const k of targets) {
        const entry = seed.sections?.[k];
        if (!entry) continue;
        const { ok, payload } = validateSectionPayload(k, entry.payload);
        if (!ok) continue;
        await putSection(prisma, {
          key: k,
          title: entry.title,
          subtitle: entry.subtitle,
          payload,
          updatedBy: req.user.username,
        });
        count += 1;
      }
      await writeAuditLog(prisma, {
        req,
        actor: req.user,
        action: 'content_reset',
        resourceType: 'content',
        resourceId: key || 'all',
        details: { count },
      });
      res.json({ success: true, restored: count });
    } catch (err) {
      console.error('[content.reset]', err.message);
      res.status(500).json({ error: '恢复种子内容失败。' });
    }
  });

  return router;
}
