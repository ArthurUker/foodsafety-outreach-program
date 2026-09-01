/**
 * 限流与请求校验中间件。
 *
 * ⚠️ 单实例假设：限流计数存于进程内存。若将来水平扩容，必须先迁移到 Redis 等共享存储，
 * 否则各实例计数独立，限流形同虚设（与 foodtestlab 同款约束）。
 */

import { isSafeInput, clientIp } from '../lib/validation.js';

/**
 * 通用 IP 限流（滑动窗口）。
 * @param {number} max 窗口内最大请求数
 * @param {number} windowMs 窗口长度（毫秒）
 */
export function rateLimit(max = 1000, windowMs = 60_000) {
  const hits = new Map(); // ip -> number[]（时间戳）

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const ip = clientIp(req);

    // 定期清理过期条目，避免 Map 无界增长
    if (hits.size > 5000) {
      for (const [key, timestamps] of hits) {
        const alive = timestamps.filter((t) => now - t < windowMs);
        if (alive.length === 0) hits.delete(key);
        else hits.set(key, alive);
      }
    }

    const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - timestamps[0])) / 1000));
      return res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

/**
 * 针对单个 key 的限流（如登录端点按「IP + 用户名」限流）。
 */
export function rateLimitBy(max = 10, windowMs = 15 * 60 * 1000) {
  const hits = new Map();

  return function keyedRateLimit(key, res) {
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) return false;
    timestamps.push(now);
    hits.set(key, timestamps);
    if (hits.size > 10000) {
      for (const [k, list] of hits) {
        if (list.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    return true;
  };
}

/**
 * 请求体 / 查询串安全检查：命中 XSS 或 SQL 注入特征直接 400。
 * 只对字符串叶子节点做检测，避免误伤正常的结构化内容 payload。
 */
export function requestSafetyGuard(req, res, next) {
  const suspicious = [];
  const walk = (value, path) => {
    if (typeof value === 'string') {
      if (!isSafeInput(value)) suspicious.push(path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };

  if (req.body && typeof req.body === 'object') walk(req.body, '');
  for (const [k, v] of Object.entries(req.query || {})) walk(v, `query.${k}`);

  if (suspicious.length > 0) {
    return res.status(400).json({
      error: '请求内容包含不安全的字符序列，已被拒绝。',
      fields: suspicious.slice(0, 5),
    });
  }
  next();
}
