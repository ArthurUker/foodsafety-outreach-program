/**
 * 后台管理控制台：登录、章节内容编辑、咨询留言处理、审计日志查看、账号安全。
 *
 * 约定：
 * - 所有写操作带 JWT；收到 401 立即清空令牌并回到登录视图。
 * - 内容以 JSON 编辑，服务端为校验权威源（前端只做 JSON 语法预检）。
 */

import { api, getToken, setToken, clearToken } from '../core/api.js';
import { el, clear } from '../core/dom.js';
import { initCanvas, renderCanvas, getDraft, isCanvasMode, setCanvasMode } from './canvas.js';

const state = {
  user: null,
  sections: [],
  currentKey: null,
  dirty: false,
};

/* ============================ 工具 ============================ */

function note(node, message, tone = '') {
  if (!node) return;
  node.textContent = message || '';
  node.className = `form-note ${tone === 'error' ? 'is-error' : tone === 'success' ? 'is-success' : ''}`;
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 统一 401 处理：清令牌并回到登录视图。
 * @param {Error} err 带 status 字段的请求错误
 * @param {string} source 触发请求的描述（如 'GET /api/inquiries'），用于写回提示区
 *
 * 此前各调用点静默弹回登录页，「登录成功。」提示残留、真实原因（缺令牌/签名无效/
 * 令牌被吊销/账号被停用）全部丢失，线上无从排查 —— 必须把服务端原因写回登录提示。
 */
function handleUnauthorized(err, source = '请求') {
  if (err?.status === 401) {
    clearToken();
    showLogin();
    console.warn(`[admin] ${source} 返回 401：`, err?.message || '未认证');
    const loginNoteNode = document.getElementById('loginNote');
    if (loginNoteNode) {
      note(
        loginNoteNode,
        `登录态已失效（${source} 返回 401）：${err?.message || '未认证'}。请重新登录；若刚登录成功即出现此提示，请截图反馈。`,
        'error',
      );
    }
    return true;
  }
  return false;
}

/* ============================ 视图切换 ============================ */

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');

function showLogin() {
  loginView.hidden = false;
  adminView.hidden = true;
}

function showAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
}

/* ============================ 登录 ============================ */

function initLogin() {
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginSubmit');
  const noteNode = document.getElementById('loginNote');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      note(noteNode, '请输入用户名和密码。', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    note(noteNode, '', '');

    try {
      const res = await api.post('/auth/login', { username, password });
      setToken(res.token, document.getElementById('loginRemember').checked);
      state.user = res.user;
      note(noteNode, '登录成功。', 'success');
      await enterAdmin();
    } catch (err) {
      note(noteNode, err.message || '登录失败。', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '登录';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await api.auth('POST', '/auth/logout');
    } catch {
      /* 即使失败也要清理本地态 */
    }
    clearToken();
    state.user = null;
    showLogin();
  });

  document.getElementById('gotoPasswordBtn').addEventListener('click', () => {
    switchTab('account');
  });
}

async function enterAdmin() {
  showAdmin();

  // 拉取用户信息（权威角色 / 是否强制改密）
  try {
    const res = await api.auth('GET', '/auth/me');
    state.user = res.user;
  } catch (err) {
    if (handleUnauthorized(err, 'GET /api/auth/me')) {
      // 登录刚成功却被判 401：几乎总是浏览器侧问题（站点存储被禁 / 扩展改写请求头）
      const loginNoteNode = document.getElementById('loginNote');
      if (loginNoteNode) {
        note(
          loginNoteNode,
          `会话校验失败（401）：${err.message || '未认证'}。通常是浏览器禁止本站存储数据，或请求被拦截。请用无痕窗口重试，或在浏览器设置中允许本站存储后重新登录。`,
          'error',
        );
      }
      return;
    }
    console.warn('[admin] /api/auth/me 初始化失败（非 401）：', err);
  }

  const label = document.getElementById('adminUserLabel');
  if (label && state.user) {
    label.textContent = `${state.user.displayName || state.user.username}（${state.user.role === 'owner' ? '管理员' : '编辑'}）`;
  }

  // 强制改密：只开放账号安全面板
  const forcePanel = document.getElementById('forcePanel');
  if (forcePanel) forcePanel.hidden = !state.user?.mustChangePassword;
  if (state.user?.mustChangePassword) {
    switchTab('force');
    return;
  }
  // 非强制改密时回到默认工作区：SPA 内改密后重复登录不会整页刷新，
  // 不重置的话会残留上一次会话的激活面板（如账号安全）与旧提示。
  switchTab('content');

  await Promise.all([loadSections(), loadInquiries(), loadAudit()]);
}

/* ============================ Tab ============================ */

function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  });
  document.querySelectorAll('.admin-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === name);
  });
}

/* ============================ 章节内容 ============================ */

const sectionSelect = document.getElementById('sectionSelect');
const editor = document.getElementById('contentEditor');
const contentNote = document.getElementById('contentNote');

async function loadSections() {
  try {
    const res = await api.get('/content');
    if (!res?.success) throw new Error('内容接口返回异常。');
    state.sections = res.sections;

    clear(sectionSelect);
    for (const section of state.sections) {
      sectionSelect.appendChild(el('option', { value: section.key, text: `${section.key}` }));
    }
    if (!state.currentKey && state.sections.length > 0) {
      selectSection(state.sections[0].key);
    }
  } catch (err) {
    if (!handleUnauthorized(err, 'GET /api/content')) {
      note(contentNote, `载入章节失败：${err.message}`, 'error');
    }
  }
}

function selectSection(key) {
  state.currentKey = key;
  const section = state.sections.find((s) => s.key === key);
  if (!section) return;
  editor.value = JSON.stringify(section.payload, null, 2);
  // 画布始终渲染服务端当前内容：切章节即丢弃上一段未保存草稿（避免误存别的章节）
  renderCanvas(key, section.payload);
  sectionSelect.value = key;
  document.getElementById('sectionMeta').textContent = section.updatedAt
    ? `最后更新：${formatTime(section.updatedAt)}${section.updatedBy ? ` · ${section.updatedBy}` : ''}`
    : '尚未更新过';
  state.dirty = false;
  note(contentNote, '', '');
}

async function saveSection() {
  let payload;
  if (isCanvasMode()) {
    payload = getDraft();
    if (!payload) {
      note(contentNote, '画布尚未载入内容，请稍后再试。', 'error');
      return;
    }
  } else {
    try {
      payload = JSON.parse(editor.value);
    } catch (err) {
      note(contentNote, `JSON 语法错误：${err.message}`, 'error');
      return;
    }
  }

  const btn = document.getElementById('saveContentBtn');
  btn.disabled = true;
  btn.textContent = '保存中...';

  try {
    await api.auth('PUT', `/content/${state.currentKey}`, {
      payload,
      title: state.sections.find((s) => s.key === state.currentKey)?.title ?? null,
      subtitle: state.sections.find((s) => s.key === state.currentKey)?.subtitle ?? null,
    });
    note(contentNote, '保存成功，前台页面已更新（刷新即可看到最新内容）。', 'success');
    state.dirty = false;
    await loadSections();
    selectSection(state.currentKey);
  } catch (err) {
    if (handleUnauthorized(err, `PUT /api/content/${state.currentKey}`)) return;
    const details = err.payload?.details?.length ? `：${err.payload.details.join('；')}` : '';
    note(contentNote, `${err.message}${details}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存修改';
  }
}

/* ============================ 咨询留言 ============================ */

const STATUS_LABEL = { new: '待处理', processing: '处理中', closed: '已关闭' };

async function loadInquiries() {
  const status = document.getElementById('inquiryStatus').value;
  const body = document.getElementById('inquiryBody');
  const noteNode = document.getElementById('inquiryNote');

  try {
    const res = await api.auth('GET', `/inquiries?limit=100${status ? `&status=${status}` : ''}`);
    if (!res?.success) throw new Error('留言接口返回异常。');

    clear(body);
    if (res.items.length === 0) {
      body.appendChild(el('tr', {}, [el('td', { colspan: '8', class: 'muted', text: '暂无留言。' })]));
      return;
    }

    for (const item of res.items) {
      const statusSelect = el('select.status-select', {
        on: {
          change: async (event) => {
            await updateInquiry(item.id, { status: event.target.value });
          },
        },
      }, Object.entries(STATUS_LABEL).map(([value, text]) =>
        el('option', { value, text, selected: value === item.status }),
      ));

      body.appendChild(
        el('tr', {}, [
          el('td', { text: formatTime(item.createdAt) }),
          el('td', { text: item.name }),
          el('td', { text: item.org || '—' }),
          el('td', { text: item.phone }),
          el('td', { text: item.email }),
          el('td.col-msg', { text: item.message }),
          el('td', {}, [statusSelect]),
          el('td', {}, [
            el('div.row-actions', {}, [
              el('button.btn.btn-ghost.btn-sm', {
                type: 'button',
                text: '删除',
                on: {
                  click: async () => {
                    if (!window.confirm(`确认删除 ${item.name} 的留言？该操作不可恢复。`)) return;
                    await deleteInquiry(item.id);
                  },
                },
              }),
            ]),
          ]),
        ]),
      );
    }
    note(noteNode, `共 ${res.total} 条留言。`, '');
  } catch (err) {
    if (handleUnauthorized(err, 'GET /api/inquiries')) return;
    note(noteNode, `载入留言失败：${err.message}`, 'error');
  }
}

async function updateInquiry(id, data) {
  try {
    await api.auth('PATCH', `/inquiries/${id}`, data);
    note(document.getElementById('inquiryNote'), '状态已更新。', 'success');
    await loadInquiries();
  } catch (err) {
    if (handleUnauthorized(err, `PATCH /api/inquiries/${id}`)) return;
    note(document.getElementById('inquiryNote'), `更新失败：${err.message}`, 'error');
  }
}

async function deleteInquiry(id) {
  try {
    await api.auth('DELETE', `/inquiries/${id}`);
    note(document.getElementById('inquiryNote'), '留言已删除。', 'success');
    await loadInquiries();
  } catch (err) {
    if (handleUnauthorized(err, `DELETE /api/inquiries/${id}`)) return;
    note(document.getElementById('inquiryNote'), `删除失败：${err.message}`, 'error');
  }
}

/**
 * CSV 导出：走 fetch 带令牌（接口受保护，不能直接用 location.href 跳转，
 * 否则请求不带 Authorization 头会被 401 拦截），再用 Blob 触发下载。
 */
async function exportCsv() {
  const status = document.getElementById('inquiryStatus').value;
  const noteNode = document.getElementById('inquiryNote');
  try {
    const res = await fetch(`/api/inquiries/export.csv${status ? `?status=${status}` : ''}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`导出失败（HTTP ${res.status}）`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: `inquiries-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    note(noteNode, '导出成功。', 'success');
  } catch (err) {
    note(noteNode, `导出失败：${err.message}`, 'error');
  }
}

/* ============================ 审计日志 ============================ */

async function loadAudit() {
  const action = document.getElementById('auditAction').value;
  const body = document.getElementById('auditBody');
  const noteNode = document.getElementById('auditNote');

  try {
    const res = await api.auth('GET', `/audit-logs?limit=100${action ? `&action=${action}` : ''}`);
    if (!res?.success) throw new Error('审计接口返回异常。');

    clear(body);
    if (res.items.length === 0) {
      body.appendChild(el('tr', {}, [el('td', { colspan: '6', class: 'muted', text: '暂无记录。' })]));
      return;
    }

    for (const item of res.items) {
      body.appendChild(
        el('tr', {}, [
          el('td', { text: formatTime(item.createdAt) }),
          el('td', { text: item.actorName || '—' }),
          el('td', { text: item.action }),
          el('td', { text: item.resourceId || '—' }),
          el('td', { text: item.ip || '—' }),
          el('td.col-msg', { text: item.details ? JSON.stringify(item.details) : '—' }),
        ]),
      );
    }
    note(noteNode, `共 ${res.total} 条记录。`, '');
  } catch (err) {
    if (handleUnauthorized(err, 'GET /api/audit-logs')) return;
    note(noteNode, `载入审计日志失败：${err.message}`, 'error');
  }
}

/* ============================ 修改密码 ============================ */

function initPasswordForm() {
  const form = document.getElementById('passwordForm');
  const noteNode = document.getElementById('passwordNote');
  const submitBtn = document.getElementById('passwordSubmit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      note(noteNode, '两次输入的新密码不一致。', 'error');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      note(noteNode, '新密码至少 8 位，且必须同时包含字母和数字。', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    try {
      await api.auth('POST', '/auth/change-password', { currentPassword, newPassword });
      note(noteNode, '密码已更新，请使用新密码重新登录。', 'success');
      form.reset();
      setTimeout(() => {
        clearToken();
        state.user = null;
        showLogin();
      }, 1200);
    } catch (err) {
      if (handleUnauthorized(err, 'POST /api/auth/change-password')) return;
      note(noteNode, `修改失败：${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '更新密码';
    }
  });
}

/* ============================ 初始化 ============================ */

/* ============================ 内容编辑模式（可视化 / JSON） ============================ */

/**
 * 切换编辑模式。
 * ⚠️ 顺序要点：先校验再切换。切回可视化时若 JSON 有语法错误，直接返回并保持 JSON 模式，
 * 避免用旧草稿覆盖运营正在编辑的文本框内容。
 */
function applyContentMode(mode) {
  const visual = mode === 'visual';

  if (visual) {
    try {
      renderCanvas(state.currentKey, JSON.parse(editor.value));
    } catch (err) {
      note(contentNote, `JSON 语法有误，无法切回可视化：${err.message}`, 'error');
      return;
    }
  } else {
    const draft = getDraft();
    if (draft) editor.value = JSON.stringify(draft, null, 2);
  }

  setCanvasMode(mode);
  document.getElementById('canvasWrap').hidden = !visual;
  document.getElementById('jsonHint').hidden = visual;
  editor.hidden = visual;
  document.getElementById('formatBtn').hidden = visual;
  document.getElementById('modeVisualBtn').classList.toggle('is-active', visual);
  document.getElementById('modeJsonBtn').classList.toggle('is-active', !visual);
}

function initContentMode() {
  document.getElementById('modeVisualBtn').addEventListener('click', () => applyContentMode('visual'));
  document.getElementById('modeJsonBtn').addEventListener('click', () => applyContentMode('json'));

  initCanvas({
    frame: document.getElementById('canvasFrame'),
    onEdit: () => {
      state.dirty = true;
      note(contentNote, '画布已修改，记得点「保存修改」。', '');
    },
    onStats: (stats) => {
      const meta = document.getElementById('canvasMeta');
      if (meta) meta.textContent = `识别到 ${stats.editable} 个可编辑字段 · ${stats.items} 个可增删列表项`;
      if (stats.editable === 0) {
        note(contentNote, '本章节未自动识别到可编辑字段，请切换到 JSON 模式编辑。', 'error');
      }
    },
  });
}

function initControls() {
  document.getElementById('adminTabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.admin-tab');
    if (!tab) return;
    switchTab(tab.dataset.tab);
  });

  sectionSelect.addEventListener('change', () => {
    if (state.dirty && !window.confirm('当前章节有未保存的修改，确认切换？')) {
      sectionSelect.value = state.currentKey;
      return;
    }
    selectSection(sectionSelect.value);
  });

  editor.addEventListener('input', () => {
    state.dirty = true;
  });

  document.getElementById('saveContentBtn').addEventListener('click', saveSection);

  document.getElementById('reloadContentBtn').addEventListener('click', async () => {
    await loadSections();
    selectSection(state.currentKey);
    note(contentNote, '已重新载入服务端内容。', 'success');
  });

  document.getElementById('formatBtn').addEventListener('click', () => {
    try {
      editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
      note(contentNote, '已格式化。', 'success');
    } catch (err) {
      note(contentNote, `JSON 语法错误：${err.message}`, 'error');
    }
  });

  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!window.confirm(`确认将「${state.currentKey}」恢复为种子内容？当前修改会被覆盖。`)) return;
    try {
      await api.auth('POST', '/content/reset', { key: state.currentKey });
      note(contentNote, '已恢复为种子内容。', 'success');
      await loadSections();
      selectSection(state.currentKey);
    } catch (err) {
      if (handleUnauthorized(err, 'POST /api/content/reset')) return;
      note(contentNote, `恢复失败：${err.message}`, 'error');
    }
  });

  document.getElementById('inquiryStatus').addEventListener('change', loadInquiries);
  document.getElementById('reloadInquiryBtn').addEventListener('click', loadInquiries);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

  document.getElementById('auditAction').addEventListener('change', loadAudit);
  document.getElementById('reloadAuditBtn').addEventListener('click', loadAudit);

  // 离开页面前提醒未保存内容
  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

async function bootstrap() {
  initLogin();
  initPasswordForm();
  initContentMode();
  initControls();

  if (!getToken()) {
    showLogin();
    return;
  }
  await enterAdmin();
}

bootstrap();
