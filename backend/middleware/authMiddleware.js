/**
 * 认证中间件工厂。
 *
 * 与 foodtestlab 同款结构：createAuthMiddleware 统一导出 authenticateUser / authorizeRoles，
 * 禁止在各路由内重复实现认证逻辑。
 *
 * DB 回查策略：签名通过后回查用户 status（禁用/删除立即 401）与 role
 * （DB 权威角色覆盖 token 角色，后台改角色后无需重新登录）。
 * 回查异常采用 fail-soft → fail-closed 折中：连续失败达到阈值才 503，
 * 阈值内沿用 token 身份并告警，避免数据库瞬时抖动触发全站认证雪崩。
 */

import { AuthService } from '../lib/authService.js';

const DB_FAILURE_THRESHOLD = 3;

export function createAuthMiddleware({ prisma, jwtSecret, jwtExpire }) {
  const authService = new AuthService(prisma, jwtSecret, jwtExpire);
  let consecutiveDbFailures = 0;

  /**
   * 解析并校验 Bearer 令牌，成功后挂 req.user。
   * 挂载到具体路由上（非全局），保证公开页面与 /api/content 无需鉴权。
   */
  async function authenticateUser(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) return res.status(401).json({ error: '未认证：缺少访问令牌。' });

    const payload = authService.verifySignature(token);
    if (!payload) return res.status(401).json({ error: '令牌无效或已过期，请重新登录。' });

    try {
      if (await authService.isRevoked({ jti: payload.jti, userId: payload.userId, iat: payload.iat })) {
        return res.status(401).json({ error: '令牌已被吊销，请重新登录。' });
      }

      const user = await prisma.adminUser.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, displayName: true, role: true, status: true, mustChangePassword: true },
      });

      if (!user) return res.status(401).json({ error: '账号不存在或已被移除。' });
      if (user.status !== 'active') return res.status(401).json({ error: '账号已被停用。' });

      consecutiveDbFailures = 0;

      // DB 为权威源：角色以库内为准，避免令牌内旧角色被用于越权
      req.user = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
      };
      req.token = token;
      req.authService = authService;
      next();
    } catch (err) {
      consecutiveDbFailures += 1;
      console.error(`[AUTH_DB_FAILURE ${consecutiveDbFailures}/${DB_FAILURE_THRESHOLD}]`, err.message);
      if (consecutiveDbFailures >= DB_FAILURE_THRESHOLD) {
        return res.status(503).json({ error: '认证服务暂时不可用，请稍后重试。' });
      }
      // 阈值内降级放行：沿用令牌身份，保证数据库抖动不致全站登出
      req.user = {
        userId: payload.userId,
        username: payload.username,
        displayName: payload.username,
        role: payload.role,
        status: 'active',
        mustChangePassword: false,
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
        degraded: true,
      };
      req.token = token;
      req.authService = authService;
      next();
    }
  }

  /** 角色守卫：authorizeRoles('owner') / authorizeRoles('owner','editor') */
  function authorizeRoles(...roles) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: '未认证。' });
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: '权限不足：当前角色无权执行该操作。' });
      }
      next();
    };
  }

  return { authService, authenticateUser, authorizeRoles };
}
