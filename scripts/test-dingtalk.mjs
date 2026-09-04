/**
 * 钉钉机器人连通性自检：读取 backend/.env 的 DINGTALK_WEBHOOK / DINGTALK_SECRET，
 * 向群内发送一条测试消息。用于部署后验证通知链路。
 *
 * 用法：npm run dingtalk:test
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendDingtalkText } from '../backend/lib/dingtalkNotify.js';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend/.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ 未找到 backend/.env，请先完成环境配置。');
  process.exit(1);
}

// 手动解析 backend/.env（与 systemd EnvironmentFile 同源），注入当前进程
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  if (!(key in process.env)) process.env[key] = trimmed.slice(idx + 1).trim();
}

if (!process.env.DINGTALK_WEBHOOK) {
  console.error('❌ backend/.env 未配置 DINGTALK_WEBHOOK，通知链路处于关闭状态。');
  console.error('   配置方法：群设置 → 机器人 → 添加「自定义」机器人，把生成的 Webhook 地址填入后重试。');
  process.exit(1);
}

try {
  await sendDingtalkText('【网站留言】连通性测试：如果你在群里看到这条消息，说明通知链路已就绪。');
  console.log('✅ 测试消息已发送，请到钉钉群确认收到。');
} catch (err) {
  console.error('❌ 发送失败：', err.message);
  console.error('   排查：Webhook 是否完整、安全方式（关键词/加签）与 DINGTALK_SECRET 是否匹配、服务器出网是否正常。');
  process.exit(1);
}
