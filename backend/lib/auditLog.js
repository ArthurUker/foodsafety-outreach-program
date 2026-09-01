/**
 * 审计日志单一入口。
 *
 * 约定（见 docs/PROJECT_CONVENTIONS.md 规则一）：
 * 生产环境审计记录不得物理删除，仅允许新增与查询。
 * 关键安全事件（登录、改密、内容变更、留言状态变更）一律由服务端内部强制写入，
 * 不信任客户端上报。
 */

import { sanitizeText } from './validation.js';
import { clientIp } from './validation.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} params
 * @param {object} [params.actor] 当前操作者（req.user）
 * @param {import('express').Request} [params.req]
 * @param {string} params.action
 * @param {string} [params.resourceType]
 * @param {string} [params.resourceId]
 * @param {object|string} [params.details]
 */
export async function writeAuditLog(prisma, { actor, req, action, resourceType, resourceId, details }) {
  try {
    const ip = req ? clientIp(req) : null;
    const safeDetails =
      details === undefined || details === null
        ? null
        : typeof details === 'string'
          ? { message: sanitizeText(details, 2000) }
          : JSON.parse(JSON.stringify(details)); // 确保是可序列化的纯对象

    await prisma.auditLog.create({
      data: {
        actorId: actor?.userId ?? null,
        actorName: sanitizeText(actor?.displayName || actor?.username || 'anonymous', 64) || 'anonymous',
        action: sanitizeText(action, 64),
        resourceType: resourceType ? sanitizeText(resourceType, 64) : null,
        resourceId: resourceId ? sanitizeText(resourceId, 128) : null,
        details: safeDetails ?? undefined,
        ip,
      },
    });
  } catch (err) {
    // 审计写入失败不得阻断主流程，但必须高声告警（避免静默丢失合规证据）
    console.error(`[AUDIT_WRITE_FAILED] action=${action}`, err.message);
  }
}

/**
 * 统计窗口内某类审计事件次数（用于登录失败锁定）。
 * 查询失败时 fail-open（不锁定），避免数据库抖动导致账号大面积不可用。
 */
export async function countAuditEvents(prisma, { action, detailsPath, detailsValue, since }) {
  try {
    const where = {
      action,
      createdAt: { gte: since },
    };
    if (detailsPath && detailsValue !== undefined) {
      where.details = { path: [detailsPath], equals: detailsValue };
    }
    return await prisma.auditLog.count({ where });
  } catch (err) {
    console.error(`[AUDIT_COUNT_FAILED] action=${action}`, err.message);
    return 0;
  }
}
