/**
 * 站点配置路由：/api/settings
 * 读公开（联系信息、页脚、SEO 等），写需 editor+。
 */

import express from 'express';
import { listSettings, putSetting } from '../lib/contentStore.js';
import { writeAuditLog } from '../lib/auditLog.js';
import { sanitizeText, sanitizeObjectKeys, jsonDepth, jsonByteSize } from '../lib/validation.js';

/** 允许写入的配置 key 白名单（防止任意 key 注入） */
const ALLOWED_KEYS = ['site', 'seo', 'footer', 'contactInfo'];

export function createSettingRoutes({ prisma, authenticateUser, authorizeRoles }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache');
      res.json({ success: true, settings: await listSettings(prisma) });
    } catch (err) {
      console.error('[settings.list]', err.message);
      res.status(500).json({ error: '读取站点配置失败。' });
    }
  });

  router.put('/:key', authenticateUser, authorizeRoles('owner', 'editor'), async (req, res) => {
    const key = sanitizeText(req.params.key, 64);
    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(400).json({ error: `不允许的配置项：${key}` });
    }
    const value = sanitizeObjectKeys(req.body?.value);
    if (!value || jsonDepth(value) > 6 || jsonByteSize(value) > 100 * 1024) {
      return res.status(400).json({ error: '配置内容不合法（深度 ≤6 层、体积 ≤100KB）。' });
    }

    try {
      await putSetting(prisma, { key, value, updatedBy: req.user.username });
      await writeAuditLog(prisma, {
        req,
        actor: req.user,
        action: 'setting_update',
        resourceType: 'setting',
        resourceId: key,
      });
      res.json({ success: true, settings: await listSettings(prisma) });
    } catch (err) {
      console.error('[settings.update]', err.message);
      res.status(500).json({ error: '保存站点配置失败。' });
    }
  });

  return router;
}
