/**
 * 校园食安推广方案站 —— 后端入口（Express 4 / ESM）
 *
 * 设计要点（沿用 foodtestlab 的成熟模式）：
 * - 启动期安全守卫：JWT_SECRET 缺失/弱密钥、CORS 通配符 → 直接拒绝启动（fail-closed）。
 * - 中间件顺序固定：限流 → CORS → 请求体 → 安全头 → 路由 → 404 → 错误处理器。
 * - 审计日志服务端强制写入，不信任客户端上报。
 * - 单实例假设：限流计数存进程内存，水平扩容前须迁移到 Redis。
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import { PrismaClient } from '@prisma/client';

import { corsConfigHasWildcard, validateJwtSecret } from './lib/securityGuards.js';
import { rateLimit, rateLimitBy } from './middleware/validationMiddleware.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createContentRoutes } from './routes/contentRoutes.js';
import { createInquiryRoutes } from './routes/inquiryRoutes.js';
import { createAuditRoutes } from './routes/auditRoutes.js';
import { createSettingRoutes } from './routes/settingRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const serveStatic = process.env.SERVE_STATIC === 'true';

// ============ 启动守卫 ============
const jwtSecretError = validateJwtSecret(process.env.JWT_SECRET);
if (jwtSecretError) {
  console.error(`[FATAL] ${jwtSecretError}。请生成强随机密钥：openssl rand -base64 48`);
  process.exit(1);
}
if (corsConfigHasWildcard(process.env.CORS_ORIGIN)) {
  console.error(
    '[FATAL] CORS_ORIGIN 不得包含通配符 "*"（本站 CORS 恒开 credentials:true）。' +
      '请配置显式来源白名单，例如 CORS_ORIGIN=https://your.domain',
  );
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '8h';
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 1000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);

const prisma = new PrismaClient();
const { authService, authenticateUser, authorizeRoles } = createAuthMiddleware({
  prisma,
  jwtSecret: JWT_SECRET,
  jwtExpire: JWT_EXPIRE,
});

// ============ CORS 来源解析 ============
function parseAllowedOrigins() {
  if (!process.env.CORS_ORIGIN) {
    // 未配置时仅放行本地开发来源，生产必须通过环境变量显式配置
    return [
      'http://localhost:3000',
      'http://localhost:4173',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
    ];
  }
  return process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
}

function parseAllowedHostnames() {
  const raw = process.env.CORS_HOSTNAMES || '';
  return raw.split(',').map((h) => h.trim()).filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();
const allowedHostnames = parseAllowedHostnames();

// ============ 中间件 ============
app.set('trust proxy', 1); // 反代后获取真实客户端 IP（限流与审计依赖）
app.use(rateLimit(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl / 服务端调用
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try {
        const u = new URL(origin);
        const hostWithPort = u.hostname + (u.port ? `:${u.port}` : '');
        if (allowedHostnames.includes(u.hostname) || allowedHostnames.includes(hostWithPort)) {
          return callback(null, true);
        }
      } catch {
        /* 解析失败按拒绝处理 */
      }
      // 不下发任何 Allow-* 头（返回 false 而非 Error，避免变成 500）
      console.warn(`CORS denied origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: process.env.BODY_LIMIT || '2mb' }));

// 安全响应头兜底（反向代理 deploy/ 亦应设置）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', req.path.startsWith('/api/') ? 'DENY' : 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.DOMAIN) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  next();
});

// favicon 内联 SVG，避免浏览器默认请求 404 噪音
app.get('/favicon.ico', (_req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0071e3"/><path d="M32 12l14 6v14c0 11-7 18-14 20-7-2-14-9-14-20V18z" fill="#fff"/><path d="M25 32l5 5 10-11" stroke="#0071e3" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// 本地开发：同源托管仓库静态资源（生产由 Caddy serve dist/）
if (serveStatic) {
  app.use(express.static(path.join(__dirname, '../')));
}

// ============ 健康检查 ============
const healthCheck = (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() });
app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// ============ 路由 ============
app.use('/api/auth', createAuthRoutes({ prisma, authenticateUser, authService, rateLimitBy }));
app.use('/api/content', createContentRoutes({ prisma, authenticateUser, authorizeRoles }));
app.use('/api/inquiries', createInquiryRoutes({ prisma, authenticateUser, authorizeRoles }));
app.use('/api/audit-logs', createAuditRoutes({ prisma, authenticateUser, authorizeRoles }));
app.use('/api/settings', createSettingRoutes({ prisma, authenticateUser, authorizeRoles }));

// ============ 兜底 ============
app.use('/api', notFoundHandler);
app.use(errorHandler);

// ============ 启动 ============
const REVOCATION_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 校园食安推广方案站 API 已启动');
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 监听地址: http://localhost:${PORT}`);
  console.log(`📍 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔐 JWT: ✅ 已配置（有效期 ${JWT_EXPIRE}）`);
  console.log(`🗄️  数据库: PostgreSQL (Prisma)`);
  console.log(`📦 CORS 白名单: ${allowedOrigins.join(', ')}`);
  console.log(`📦 CORS 主机名: ${allowedHostnames.length ? allowedHostnames.join(', ') : '(无)'}`);
  console.log(`🌐 静态托管: ${serveStatic ? 'Express（开发模式）' : 'Caddy（生产模式）'}`);
  console.log(`${'='.repeat(60)}\n`);

  // 过期吊销记录清理（令牌自然过期后即可安全删除，避免表无界增长）
  setInterval(() => {
    authService
      .cleanupExpiredRevocations()
      .then((n) => { if (n > 0) console.log(`🧹 已清理过期吊销记录 ${n} 条`); })
      .catch((e) => console.error('[REVOCATION_CLEANUP_FAILED]', e.message));
  }, REVOCATION_CLEANUP_INTERVAL_MS).unref();
});

// ============ 优雅退出 ============
async function shutdown(signal) {
  console.log(`📌 收到 ${signal}，正在关闭服务...`);
  const forceExit = setTimeout(() => {
    console.error('⚠️ 优雅退出超时，强制退出');
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, prisma };
