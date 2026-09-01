/**
 * 咨询留言路由：/api/inquiries
 *
 * POST 公开（限流：同一 IP 每 10 分钟 3 条，防灌水）
 * 管理与导出需登录（状态变更与删除需 owner）
 */

import express from 'express';
import {
  sanitizeText,
  sanitizeMultilineText,
  parsePagination,
  escapeHtml,
} from '../lib/validation.js';
import { isPhone, isEmail } from '../lib/securityGuards.js';
import { writeAuditLog } from '../lib/auditLog.js';
import { rateLimitBy, requestSafetyGuard } from '../middleware/validationMiddleware.js';

const VALID_STATUS = ['new', 'processing', 'closed'];

/** CSV 公式注入防护：= + - @ TAB CR 开头前置单引号 */
function csvSafe(value) {
  const s = value === null || value === undefined ? '' : String(value);
  const escaped = s.replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
}

function toCsv(rows) {
  const header = ['提交时间', '姓名', '单位', '联系电话', '邮箱', '咨询内容', '状态', '处理备注'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        r.name,
        r.org || '',
        r.phone,
        r.email,
        r.message,
        r.status,
        r.note || '',
      ]
        .map(csvSafe)
        .map((v) => `"${v}"`)
        .join(','),
    );
  }
  // BOM 让 Excel 正确识别 UTF-8
  return `﻿${lines.join('\n')}`;
}

export function createInquiryRoutes({ prisma, authenticateUser, authorizeRoles }) {
  const router = express.Router();

  // 提交限流：IP 维度，10 分钟 3 条
  const submitLimit = rateLimitBy(3, 10 * 60 * 1000);

  /**
   * 提交咨询（公开）。
   * requestSafetyGuard 先行拦截 XSS / SQL 注入特征 —— 这是唯一面向匿名用户的写入端点，
   * 必须做纵深防御（渲染层已用 textContent 兜底，此处把恶意输入挡在入库之前）。
   */
  router.post('/', requestSafetyGuard, (req, res) => {
    const name = sanitizeText(req.body?.name, 40).replace(/[<>]/g, '');
    const phone = sanitizeText(req.body?.phone, 20).replace(/[<>]/g, '');
    const email = sanitizeText(req.body?.email, 120).replace(/[<>]/g, '');
    const org = sanitizeText(req.body?.org, 100).replace(/[<>]/g, '');
    const message = sanitizeMultilineText(req.body?.message, 2000);

    if (!name) return res.status(400).json({ error: '请输入姓名。' });
    if (!isPhone(phone)) return res.status(400).json({ error: '请输入有效的中国大陆手机号。' });
    if (!isEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱地址。' });
    if (message.length < 10) return res.status(400).json({ error: '咨询内容不少于 10 个字。' });

    if (!submitLimit(`inquiry:${req.ip}`, res)) {
      return res.status(429).json({ error: '提交过于频繁，请稍后再试。' });
    }

    prisma.inquiry
      .create({
        data: {
          name,
          phone,
          email,
          org: org || null,
          message,
          ip: req.ip,
          userAgent: sanitizeText(req.headers['user-agent'] || '', 300) || null,
        },
        select: { id: true, createdAt: true },
      })
      .then(async (created) => {
        await writeAuditLog(prisma, {
          req,
          action: 'inquiry_create',
          resourceType: 'inquiry',
          resourceId: created.id,
          details: { name, org: org || null },
        });
        res.status(201).json({ success: true, id: created.id, message: '提交成功，我们会尽快与您联系。' });
      })
      .catch((err) => {
        console.error('[inquiry.create]', err.message);
        res.status(500).json({ error: '提交失败，请稍后重试。' });
      });
  });

  /** 留言列表（登录可见，支持状态筛选与分页） */
  router.get('/', authenticateUser, async (req, res) => {
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
    const status = VALID_STATUS.includes(req.query.status) ? req.query.status : undefined;
    const keyword = sanitizeText(req.query.keyword, 40);

    const where = {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { org: { contains: keyword, mode: 'insensitive' } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    };

    try {
      const [items, total] = await Promise.all([
        prisma.inquiry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.inquiry.count({ where }),
      ]);
      res.json({ success: true, items, total, limit, offset });
    } catch (err) {
      console.error('[inquiry.list]', err.message);
      res.status(500).json({ error: '读取留言列表失败。' });
    }
  });

  /** 更新留言状态 / 备注 */
  router.patch('/:id', authenticateUser, authorizeRoles('owner', 'editor'), async (req, res) => {
    const status = VALID_STATUS.includes(req.body?.status) ? req.body.status : undefined;
    const note = req.body?.note === undefined ? undefined : sanitizeMultilineText(req.body.note, 1000);
    if (!status && note === undefined) {
      return res.status(400).json({ error: '没有需要更新的字段。' });
    }

    try {
      const updated = await prisma.inquiry.update({
        where: { id: req.params.id },
        data: {
          ...(status ? { status } : {}),
          ...(note !== undefined ? { note } : {}),
          handledBy: req.user.username,
          handledAt: new Date(),
        },
      });
      await writeAuditLog(prisma, {
        req,
        actor: req.user,
        action: 'inquiry_update',
        resourceType: 'inquiry',
        resourceId: updated.id,
        details: { status, hasNote: note !== undefined },
      });
      res.json({ success: true, item: updated });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: '留言不存在。' });
      console.error('[inquiry.update]', err.message);
      res.status(500).json({ error: '更新留言失败。' });
    }
  });

  /** 删除留言（仅 owner；审计层面只记日志，不保留副本） */
  router.delete('/:id', authenticateUser, authorizeRoles('owner'), async (req, res) => {
    try {
      const removed = await prisma.inquiry.delete({ where: { id: req.params.id } });
      await writeAuditLog(prisma, {
        req,
        actor: req.user,
        action: 'inquiry_delete',
        resourceType: 'inquiry',
        resourceId: removed.id,
        details: { name: removed.name, phone: removed.phone },
      });
      res.json({ success: true });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: '留言不存在。' });
      console.error('[inquiry.delete]', err.message);
      res.status(500).json({ error: '删除留言失败。' });
    }
  });

  /** CSV 导出（owner，带公式注入防护） */
  router.get('/export.csv', authenticateUser, authorizeRoles('owner'), async (req, res) => {
    const status = VALID_STATUS.includes(req.query.status) ? req.query.status : undefined;
    const rows = await prisma.inquiry.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    await writeAuditLog(prisma, {
      req,
      actor: req.user,
      action: 'inquiry_export',
      resourceType: 'inquiry',
      details: { count: rows.length },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inquiries.csv"');
    res.send(toCsv(rows));
  });

  return router;
}

export { escapeHtml };
