/**
 * 审计日志路由：/api/audit-logs
 * 仅 owner 可查询。只读，不提供任何删除端点（见 PROJECT_CONVENTIONS 规则一）。
 */

import express from 'express';
import { parsePagination, sanitizeText } from '../lib/validation.js';

export function createAuditRoutes({ prisma, authenticateUser, authorizeRoles }) {
  const router = express.Router();

  /** 日志列表：支持 action / actorId / 日期范围筛选与分页 */
  router.get('/', authenticateUser, authorizeRoles('owner'), async (req, res) => {
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 500 });
    const action = sanitizeText(req.query.action, 64);
    const actorId = sanitizeText(req.query.actorId, 64);
    const startDate = sanitizeText(req.query.startDate, 10);
    const endDate = sanitizeText(req.query.endDate, 10);

    const createdAt = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);

    const where = {
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    };

    try {
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.auditLog.count({ where }),
      ]);
      res.json({ success: true, items, total, limit, offset });
    } catch (err) {
      console.error('[audit.list]', err.message);
      res.status(500).json({ error: '读取审计日志失败。' });
    }
  });

  /** 统计汇总（近 N 天，按 action 聚合） */
  router.get('/stats/summary', authenticateUser, authorizeRoles('owner'), async (req, res) => {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 7, 1), 90);
    const since = new Date(Date.now() - days * 86_400_000);
    try {
      const grouped = await prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      });
      res.json({
        success: true,
        days,
        summary: grouped.map((g) => ({ action: g.action, count: g._count._all })),
      });
    } catch (err) {
      console.error('[audit.stats]', err.message);
      res.status(500).json({ error: '读取审计统计失败。' });
    }
  });

  return router;
}
