/**
 * 后台管理员认证路由：/api/auth
 *
 * 公开端点：POST /login（限流 + 失败锁定）
 * 受保护端点：GET /me、POST /logout、POST /change-password
 */

import express from 'express';
import { sanitizeText } from '../lib/validation.js';
import { writeAuditLog, countAuditEvents } from '../lib/auditLog.js';
import { isValidUsername, isStrongPassword } from '../lib/securityGuards.js';
import { verifyPassword, hashPassword, dummyCompare } from '../lib/authService.js';

const LOGIN_FAIL_ACTION = 'login_failed';
const LOGIN_SUCCESS_ACTION = 'login_success';

export function createAuthRoutes({ prisma, authenticateUser, authService, rateLimitBy }) {
  const router = express.Router();

  const loginMax = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
  const loginWindowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const lockThreshold = Number(process.env.LOGIN_FAIL_LOCK_THRESHOLD || 5);
  const lockWindowMs = Number(process.env.LOGIN_FAIL_LOCK_WINDOW_MS || 15 * 60 * 1000);
  const checkLoginLimit = rateLimitBy(loginMax, loginWindowMs);

  /** 登录：统一失败文案 + 时序拉平，防用户名枚举与侧信道 */
  router.post('/login', async (req, res) => {
    const username = sanitizeText(req.body?.username, 32);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidUsername(username) || !password) {
      return res.status(400).json({ error: '请输入合法的用户名与密码。' });
    }
    if (!checkLoginLimit(`${req.ip}:${username}`)) {
      return res.status(429).json({ error: '登录尝试过于频繁，请 15 分钟后再试。' });
    }

    // 账号锁定：基于窗口内 login_failed 计数（计数查询失败 fail-open，不误伤）
    const recentFailures = await countAuditEvents(prisma, {
      action: LOGIN_FAIL_ACTION,
      detailsPath: 'username',
      detailsValue: username,
      since: new Date(Date.now() - lockWindowMs),
    });
    if (recentFailures >= lockThreshold) {
      return res.status(423).json({ error: '账号因多次登录失败被临时锁定，请稍后再试或联系平台管理员。' });
    }

    const fail = async (reason) => {
      await writeAuditLog(prisma, {
        req,
        action: LOGIN_FAIL_ACTION,
        resourceType: 'auth',
        details: { username, reason },
      });
      return res.status(401).json({ error: '用户名或密码错误。' });
    };

    const user = await prisma.adminUser.findUnique({ where: { username } });

    if (!user) {
      dummyCompare(password); // 拉平「用户不存在」分支的响应时间
      return fail('user_not_found');
    }
    if (!verifyPassword(password, user.passwordHash)) return fail('bad_password');
    if (user.status !== 'active') return fail('account_disabled');

    const { token, expiresIn } = authService.issueToken(user);
    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAuditLog(prisma, {
      req,
      actor: user,
      action: LOGIN_SUCCESS_ACTION,
      resourceType: 'auth',
      resourceId: user.id,
    });

    res.json({
      success: true,
      token,
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  });

  /** 当前登录者信息（角色以 DB 为准） */
  router.get('/me', authenticateUser, (req, res) => {
    res.json({
      success: true,
      user: {
        id: req.user.userId,
        username: req.user.username,
        displayName: req.user.displayName,
        role: req.user.role,
        mustChangePassword: req.user.mustChangePassword,
      },
    });
  });

  /** 登出：吊销当前令牌，使无状态 JWT 立即失效 */
  router.post('/logout', authenticateUser, async (req, res) => {
    await authService.revokeToken(req.user.jti, req.user.userId, new Date((req.user.exp ?? 0) * 1000));
    await writeAuditLog(prisma, { req, actor: req.user, action: 'logout', resourceType: 'auth' });
    res.json({ success: true });
  });

  /** 修改本人密码：成功后吊销全部令牌，强制重新登录 */
  router.post('/change-password', authenticateUser, async (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const user = await prisma.adminUser.findUnique({ where: { id: req.user.userId } });
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: '当前密码不正确。' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: '新密码至少 8 位，且必须同时包含字母和数字。' });
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
    });
    await authService.revokeAllUserTokens(user.id);
    await writeAuditLog(prisma, { req, actor: req.user, action: 'change_password', resourceType: 'auth' });

    res.json({ success: true, message: '密码已更新，请使用新密码重新登录。' });
  });

  return router;
}
