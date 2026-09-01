/**
 * 启动期安全守卫与通用安全工具。
 *
 * 设计原则（沿用 foodtestlab 的 fail-closed 思路）：
 * 不安全配置 = 拒绝启动，而不是"带病运行"。默认密钥、通配符 CORS 这类问题
 * 一旦进入生产就是实质性漏洞，靠人工 review 拦不住，必须由进程自身兜底。
 */

/** 已知弱/占位密钥黑名单：命中即拒绝启动 */
export const KNOWN_WEAK_SECRETS = [
  'your-super-secret-jwt-key-change-this-in-production',
  'your-secret-key-change-in-production',
  'local-dev-jwt-secret',
  'food-lab-secret-key',
  'foodsafety-secret',
  'please_change_this_secret',
  'secret',
  'changeme',
];

/**
 * CORS 配置是否包含通配符。
 * 本站 CORS 恒开 credentials:true，「Allow-Origin: *」与凭证是无效且危险的组合，
 * 不能依赖浏览器拒绝 —— 服务端启动期直接判死。
 */
export function corsConfigHasWildcard(raw) {
  if (!raw) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((origin) => origin.includes('*'));
}

/** 校验 JWT_SECRET 强度：存在、非弱密钥、长度足够 */
export function validateJwtSecret(secret) {
  if (!secret) return 'JWT_SECRET 未设置';
  if (KNOWN_WEAK_SECRETS.includes(secret)) return 'JWT_SECRET 命中已知弱密钥黑名单';
  if (secret.length < 32) return 'JWT_SECRET 长度不足 32 位，强度不够';
  return null;
}

/** 校验密码强度：至少 8 位且含字母与数字 */
export function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

/** 用户名格式：3-32 位字母数字下划线 */
export function isValidUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9_]{3,32}$/.test(username);
}

/** 中国大陆手机号 */
export function isPhone(phone) {
  return typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone);
}

/** 邮箱（宽松但足够拦截明显非法输入） */
export function isEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

/**
 * 校验图片/链接 URL 安全性。
 * 允许：http(s) 绝对地址、站内相对路径（以单斜杠开头，排除 // 协议相对地址）、
 *       站内锚点（以 # 开头）。
 * 阻断：javascript: / data: / vbscript: 等可执行协议，以及 //host 形式的协议相对地址。
 */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.startsWith('#')) return true; // 站内锚点
  if (url.startsWith('/') && !url.startsWith('//')) return true; // 站内相对路径
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** HEX 颜色：#RGB 或 #RRGGBB */
export function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}
