/**
 * 咨询表单：前端校验 + 提交。
 *
 * 姓名、手机、邮箱和留言属于个人信息，不在浏览器持久化。后端不可用时明确提示
 * “未提交成功”，由用户在服务恢复后重新提交。
 */

import { api } from '../core/api.js';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_STORAGE_KEYS = ['cfsg_inquiry_queue', 'cfsg_inquiry_draft'];

function clearLegacyLocalData() {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // 浏览器禁用站点存储时无需处理
  }
}

function showNote(node, message, tone) {
  if (!node) return;
  node.textContent = message;
  node.className = `form-note ${tone === 'error' ? 'is-error' : tone === 'success' ? 'is-success' : ''}`;
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
  // v2.1 及更早版本曾在本地持久化咨询内容；升级后主动清理遗留个人信息。
  clearLegacyLocalData();
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
        showNote(
          note,
          '当前无法连接服务器，本次信息未提交、也未保存在浏览器中。请稍后重新提交。',
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
