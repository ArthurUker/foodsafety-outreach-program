/**
 * 联系我们：联系渠道 + 常见问题 + 咨询表单容器。
 * 表单交互由 js/modules/inquiryForm.js 挂载（保持章节渲染器为纯渲染函数）。
 */

import { el } from '../core/dom.js';

const CHANNEL_FIELDS = [
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '电子邮箱' },
  { key: 'address', label: '联系单位' },
  { key: 'hours', label: '服务时间' },
];

function channelList(channels) {
  if (!channels) return null;
  return el(
    'div.contact-list',
    {},
    CHANNEL_FIELDS.filter(({ key }) => channels[key]).map(({ key, label }) =>
      el('div.contact-item.glass-panel', {}, [el('h3', { text: label }), el('p', { text: channels[key] })]),
    ),
  );
}

function faqList(items) {
  if (!items || items.length === 0) return null;

  return el(
    'div.faq',
    {},
    items.map((item, index) =>
      el('details.faq-item.glass', { class: index === 0 ? 'is-open' : '', attrs: index === 0 ? { open: true } : {} }, [
        el('summary.faq-q', { text: item.q ?? '' }),
        el('div.faq-a', {}, [el('p', { text: item.a ?? '' })]),
      ]),
    ),
  );
}

function formSkeleton() {
  return el('form.contact-form#inquiryForm', { attrs: { novalidate: true } }, [
    el('h3', { text: '提交咨询信息' }),
    el('div.field-row', {}, [
      el('div.field', {}, [
        el('label', { for: 'inqName', text: '姓名' }),
        el('input#inqName.input', { type: 'text', name: 'name', autocomplete: 'name', attrs: { placeholder: '请输入您的姓名', maxlength: '40', required: true } }),
      ]),
      el('div.field', {}, [
        el('label', { for: 'inqPhone', text: '联系电话' }),
        el('input#inqPhone.input', { type: 'tel', name: 'phone', autocomplete: 'tel', attrs: { placeholder: '请输入手机号', maxlength: '20', required: true } }),
      ]),
    ]),
    el('div.field-row', {}, [
      el('div.field', {}, [
        el('label', { for: 'inqEmail', text: '电子邮箱' }),
        el('input#inqEmail.input', { type: 'email', name: 'email', autocomplete: 'email', attrs: { placeholder: '请输入邮箱', maxlength: '120', required: true } }),
      ]),
      el('div.field', {}, [
        el('label', { for: 'inqOrg', text: '单位 / 学校（选填）' }),
        el('input#inqOrg.input', { type: 'text', name: 'org', autocomplete: 'organization', attrs: { placeholder: '请输入单位名称', maxlength: '100' } }),
      ]),
    ]),
    el('div.field', {}, [
      el('label', { for: 'inqMessage', text: '咨询内容' }),
      el('textarea#inqMessage.textarea', { name: 'message', attrs: { rows: '5', placeholder: '请简要描述您的需求或希望了解的内容（不少于 10 字）', maxlength: '2000', required: true } }),
    ]),
    el('button.btn.btn-primary.btn-block#inqSubmit', { type: 'submit', text: '提交信息' }),
    el('p.form-note#inqMessage2', { attrs: { role: 'status', 'aria-live': 'polite' } }),
  ]);
}

export function renderContact(payload) {
  return el('section.section.section-contact', { id: 'contact' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Contact' }),
        el('h2', { text: '欢迎交流合作' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      el('div.contact-grid', {}, [
        el('div.contact-info.reveal', {}, [channelList(payload.channels)]),
        el('div.contact-form-wrap.reveal', { style: { '--i': '1' } }, [formSkeleton()]),
      ]),
      faqList(payload.faq),
    ]),
  ]);
}
