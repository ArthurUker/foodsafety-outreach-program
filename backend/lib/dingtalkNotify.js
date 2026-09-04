/**
 * 钉钉群机器人通知：新咨询留言实时推送到运营群。
 *
 * 配置（backend/.env，均可选；未配置 DINGTALK_WEBHOOK 时通知链路整体关闭）：
 *   DINGTALK_WEBHOOK  机器人 Webhook 完整地址（含 access_token）
 *   DINGTALK_SECRET   加签密钥（机器人安全方式选「加签」时填写；选「自定义关键词」则留空）
 *
 * 设计要点：
 * - fire-and-forget：推送失败仅记录日志，绝不影响留言落库与用户响应
 * - 兼容「自定义关键词」安全模式：消息 title 与 text 恒含「留言」二字，群机器人关键词填「留言」即可
 * - 机器人限流 20 条/分钟；留言侧已有 3 条/10 分钟/IP 的提交限流，天然远低于该阈值
 * - 环境变量在调用时读取（而非模块加载时），以兼容 dotenv 的加载时序
 */

import crypto from 'crypto';

const TIMEOUT_MS = 5000;
const MESSAGE_PREVIEW_LIMIT = 500;

function config() {
  return {
    webhook: process.env.DINGTALK_WEBHOOK || '',
    secret: process.env.DINGTALK_SECRET || '',
  };
}

/** 加签模式：在 Webhook 上追加 timestamp 与 HMAC-SHA256 签名（钉钉加签规范） */
function buildUrl() {
  const { webhook, secret } = config();
  if (!secret) return webhook;
  const timestamp = Date.now();
  const sign = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}\n${secret}`)
    .digest('base64');
  return `${webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
}

function truncate(text, limit) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function dingtalkConfigured() {
  return Boolean(config().webhook);
}

/** 发送一条文本消息（连通性自检 / 通用低频通知用） */
export async function sendDingtalkText(content) {
  const res = await fetch(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errcode !== 0) {
    throw new Error(`HTTP ${res.status} errcode=${body.errcode} ${body.errmsg || ''}`.trim());
  }
  return body;
}

async function sendMarkdown(title, text) {
  const res = await fetch(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { title, text } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errcode !== 0) {
    throw new Error(`HTTP ${res.status} errcode=${body.errcode} ${body.errmsg || ''}`.trim());
  }
  return body;
}

/** 新留言推送：markdown 卡片，含联系方式与内容预览。永不抛错，失败返回 { ok:false } */
export async function notifyInquiry(inquiry) {
  if (!dingtalkConfigured()) return { skipped: true };

  const lines = [
    '### 【网站留言】收到新咨询',
    '',
    `- **姓名**：${inquiry.name || '（未提供）'}`,
    inquiry.org ? `- **单位**：${inquiry.org}` : null,
    `- **电话**：${inquiry.phone || '（未提供）'}`,
    `- **邮箱**：${inquiry.email || '（未提供）'}`,
    `- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
    '',
    '**咨询内容**：',
    '',
    `> ${truncate(String(inquiry.message || ''), MESSAGE_PREVIEW_LIMIT).replace(/\n/g, '\n> ')}`,
  ].filter((line) => line !== null);

  try {
    await sendMarkdown('【网站留言】收到新咨询', lines.join('\n'));
    console.log(`[dingtalk.notify] 已推送新留言（${inquiry.name || '匿名'}）`);
    return { ok: true };
  } catch (err) {
    console.error('[dingtalk.notify] 推送失败：', err.message);
    return { ok: false, error: err.message };
  }
}
