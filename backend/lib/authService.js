/**
 * 认证服务：密码哈希、JWT 签发/校验、令牌吊销、登录保护。
 *
 * 安全设计（与 foodtestlab 同源）：
 * - bcrypt 存储，登录失败统一文案（不区分"用户不存在/密码错误/已禁用"），防用户名枚举。
 * - 不存在用户也执行一次假 bcrypt 比较，拉平各失败分支的响应时间，防时序侧信道。
 * - 登录失败计数锁定（生产 5 次/15 分钟，开发环境放宽）。
 * - 高危操作（改密、禁用、登出）后吊销令牌，降权即时生效，不等 JWT 自然过期。
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 10;
// 不存在的用户也参与一次 bcrypt 比较，保证失败分支耗时量级一致
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/** 拉平时序：对不存在的用户执行一次等价耗时的比较 */
export function dummyCompare(plain) {
  try {
    bcrypt.compareSync(plain ?? '', DUMMY_HASH);
  } catch {
    /* 忽略 */
  }
}

export class AuthService {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   * @param {string} jwtSecret
   * @param {string} [expiresIn]
   */
  constructor(prisma, jwtSecret, expiresIn = '8h') {
    if (!jwtSecret) throw new Error('AuthService 初始化失败：缺少 JWT_SECRET');
    this.prisma = prisma;
    this.jwtSecret = jwtSecret;
    this.expiresIn = expiresIn;
  }

  /** 签发访问令牌（带 jti，便于精确吊销） */
  issueToken(user) {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        jti,
      },
      this.jwtSecret,
      { expiresIn: this.expiresIn },
    );
    const payload = jwt.decode(token);
    return { token, jti, expiresAt: new Date(payload.exp * 1000), expiresIn: payload.exp - payload.iat };
  }

  /** 校验签名；失败返回 null（不抛异常） */
  verifySignature(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      return null;
    }
  }

  /** 精确吊销单个令牌 */
  async revokeToken(jti, userId, expiresAt) {
    if (!jti) return;
    try {
      await this.prisma.revokedToken.upsert({
        where: { jti },
        update: {},
        create: { jti, userId: userId ?? null, expiresAt: expiresAt ?? new Date(Date.now() + 86_400_000) },
      });
    } catch (err) {
      console.error('[REVOCATION_WRITE_FAILED]', err.message);
    }
  }

  /** 吊销某用户全部令牌（user_all 语义：按 userId 记录，校验时比对签发时间） */
  async revokeAllUserTokens(userId, expiresAt = new Date(Date.now() + 7 * 86_400_000)) {
    if (!userId) return;
    try {
      await this.prisma.revokedToken.create({
        data: { jti: `user_all:${crypto.randomUUID()}`, userId, expiresAt },
      });
    } catch (err) {
      console.error('[REVOCATION_WRITE_FAILED]', err.message);
    }
  }

  /**
   * 令牌吊销检查：
   * - jti 精确命中 → 失效
   * - 存在该用户的 user_all 记录且吊销时间晚于令牌签发时间 → 失效
   */
  async isRevoked({ jti, userId, iat }) {
    if (jti) {
      const exact = await this.prisma.revokedToken.findUnique({ where: { jti }, select: { id: true } });
      if (exact) return true;
    }
    if (!userId) return false;
    const issuedAtMs = (iat ?? 0) * 1000;
    const bulk = await this.prisma.revokedToken.findFirst({
      where: {
        userId,
        jti: { startsWith: 'user_all:' },
        revokedAt: { gte: new Date(issuedAtMs - 1000) }, // 1s 时钟抖动容忍
      },
      select: { id: true },
    });
    return Boolean(bulk);
  }

  /** 清理过期吊销记录（随令牌自然过期后即可安全删除） */
  async cleanupExpiredRevocations() {
    try {
      const { count } = await this.prisma.revokedToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return count;
    } catch (err) {
      console.error('[REVOCATION_CLEANUP_FAILED]', err.message);
      return 0;
    }
  }
}
