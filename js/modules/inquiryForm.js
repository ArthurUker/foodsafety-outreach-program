/**
 * 咨询表单：前端校验 + 提交 + 离线降级。
 *
 * 后端可用时 POST /api/inquiries 落库；后端不可用时写入 localStorage 队列并提示，
 * 保证纯静态部署下用户提交不丢失（后续可导出或补提）。
 */

import { api } from '../core/api.js';

const STORAGE_KEY = 'cfsg_inquiry_queue';
const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showNote(node, message, tone) {
  if (!node) return;
  node.textContent = message;
  node.className = `form-note ${tone === 'error' ? 'is-error' : tone === 'success' ? 'is-success' : ''}`;
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* 隐私模式下忽略 */
  }
}

function validate(values) {
  if (!values.name) return '请输入姓名。';
  if (!values.phone) return '请输入联系电话。';
  if (!PHONE_RE.test(values.phone)) return '请输入有效的中国大陆手机号。';
  if (!values.email) return '请输入电子邮箱。';
  if (!EMAIL_RE.test(values.email)) return '请输入有效的邮箱地址。';
  if (values.message.length < 10) return '咨询内容不少于 10 个字。';
  return null;
}

export function initInquiryForm() {
  const form = document.getElementById('inquiryForm');
  if (!form) return;

  const note = form.querySelector('#inqMessage2');
  const submitBtn = form.querySelector('#inqSubmit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const values = {
      name: form.name?.value?.trim() || '',
      phone: form.phone?.value?.trim() || '',
      email: form.email?.value?.trim() || '',
      org: form.org?.value?.trim() || '',
      message: form.message?.value?.trim() || '',
    };

    // 先做一次本地校验，命中异常数据直接提示（另存一份到 localStorage 兜底）
    try {
      localStorage.setItem(
        'cfsg_inquiry_draft',
        JSON.stringify({ ...values, savedAt: new Date().toISOString() }),
      );
    } catch {
      /* 忽略 */
    }

    const error = validate(values);
    if (error) {
      showNote(note, error, 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    showNote(note, '', '');

    try {
      const res = await api.post('/inquiries', values);
      showNote(note, res?.message || '提交成功，我们会尽快与您联系。', 'success');
      form.reset();
    } catch (err) {
      const status = err.status || 0;
      if (status === 0) {
        // 网络不可达 / 无后端：写入本地队列，保证不丢
        const queue = readQueue();
        queue.push({ ...values, createdAt: new Date().toISOString() });
        writeQueue(queue);
        showNote(
          note,
          '当前无法连接服务器，信息已暂存在本机。恢复服务后可再次提交，或联系我们获取补提方式。',
          'error',
        );
      } else {
        showNote(note, err.message || '提交失败，请稍后重试。', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '提交信息';
    }
  });
}
