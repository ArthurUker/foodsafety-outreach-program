/**
 * 画布编辑代理（运行在 admin-preview.html 的 iframe 内）。
 *
 * 职责：
 * 1. 用前台真实渲染函数（js/modules/registry.js）渲染章节 —— 画布即官网，所见即所得；
 * 2. 自动标注：渲染后把 DOM 文本与 payload 字段路径配对（data-edit="metrics[0].label"），
 *    8 个渲染器无需逐个埋点，以后新增章节也零成本；
 * 3. 内联编辑：给标注元素挂 contenteditable，改动经 postMessage 回传父窗口；
 * 4. 列表操作：数组项支持复制新增 / 删除 / 上下移动。
 *
 * ⚠️ 只做「内容」编辑，不提供拖拽版式的能力 —— 版式由 CSS 统一控制，
 *    交给运营拖拽会直接破坏设计一致性（这也是本方案与 Webflow 类画布的根本区别）。
 */

import { getSectionDef } from '../modules/registry.js';

const root = document.getElementById('previewRoot');

const EDIT_ATTR = 'data-edit';
const ITEM_ATTR = 'data-item';
const LIST_ATTR = 'data-list';

/* ============================ 与父窗口通信 ============================ */

function post(message) {
  parent.postMessage(message, window.location.origin);
}

/* ============================ 渲染 ============================ */

function render(key, payload) {
  root.replaceChildren();

  const def = getSectionDef(key);
  if (!def) {
    root.textContent = `未注册的章节：${key}`;
    return;
  }

  try {
    const node = def.render(payload || {});
    if (node) root.appendChild(node);
  } catch (err) {
    root.textContent = `章节渲染失败：${err?.message || err}`;
    return;
  }

  annotate(root, payload || {});

  // 回传标注统计：父窗口据此提示「本章节未识别到可编辑字段，请改用 JSON 模式」
  post({
    type: 'stats',
    editable: root.querySelectorAll(`[${EDIT_ATTR}]`).length,
    items: root.querySelectorAll(`[${ITEM_ATTR}]`).length,
  });
}

/* ============================ 自动标注 ============================ */

/** 收集 payload 里所有叶子标量（字符串/数字）及其路径 */
function collectLeaves(payload) {
  const out = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, path ? `${path}.${key}` : key);
      }
      return;
    }
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      out.push({ path, value: String(node) });
    }
  };
  walk(payload, '');
  return out.filter((leaf) => leaf.value.trim() !== '');
}

function markEditable(element, path) {
  element.setAttribute(EDIT_ATTR, path);
  element.setAttribute('spellcheck', 'false');
  // plaintext-only 可阻止粘贴带样式 HTML；不支持的浏览器退回普通 contenteditable
  element.setAttribute('contenteditable', 'plaintext-only');
  if (element.contentEditable !== 'plaintext-only') {
    element.setAttribute('contenteditable', 'true');
  }
}

function annotate(container, payload) {
  const pool = collectLeaves(payload);
  const used = new Set();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
  let element = walker.currentNode;

  while (element) {
    if (element.hasAttribute(EDIT_ATTR) === false) {
      for (const textNode of [...element.childNodes]) {
        if (textNode.nodeType !== Node.TEXT_NODE) continue;
        const text = textNode.textContent.trim();
        if (!text) continue;

        const hit = pool.find((leaf) => !used.has(leaf.path) && leaf.value.trim() === text);
        if (!hit) continue;
        used.add(hit.path);

        if (element.childNodes.length === 1) {
          // 元素只含这一段文本：直接让元素可编辑，保留原有块级样式
          markEditable(element, hit.path);
        } else {
          // 元素还含子元素（如标题里外嵌的高亮 span）：只包住目标文本节点，
          // 用无样式 span 承载，避免影响既有布局与嵌套结构
          const span = document.createElement('span');
          span.textContent = textNode.textContent;
          element.replaceChild(span, textNode);
          markEditable(span, hit.path);
        }
      }
    }
    element = walker.nextNode();
  }

  annotateLists(container);
}

/** 最深公共祖先 */
function commonAncestor(nodes) {
  let node = nodes[0];
  while (node && !nodes.every((item) => node.contains(item) || node === item)) {
    node = node.parentElement;
  }
  return node;
}

/** 由已标注的文本路径反推数组项根元素与列表容器 */
function annotateLists(container) {
  const groups = new Map();

  for (const node of container.querySelectorAll(`[${EDIT_ATTR}]`)) {
    const match = node.getAttribute(EDIT_ATTR).match(/^(.*?\[\d+\])(?:\.|$)/);
    if (!match) continue;
    const itemPath = match[1];
    if (!groups.has(itemPath)) groups.set(itemPath, []);
    groups.get(itemPath).push(node);
  }

  const byArray = new Map();

  for (const [itemPath, nodes] of groups) {
    const itemRoot = commonAncestor(nodes);
    if (!itemRoot || itemRoot === container) continue;
    itemRoot.setAttribute(ITEM_ATTR, itemPath);

    const arrayPath = itemPath.replace(/\[\d+\]$/, '');
    if (!byArray.has(arrayPath)) byArray.set(arrayPath, []);
    byArray.get(arrayPath).push(itemRoot);
  }

  for (const [arrayPath, itemRoots] of byArray) {
    const parent = itemRoots[0]?.parentElement;
    if (!parent || itemRoots.length < 1) continue;
    if (itemRoots.every((item) => item.parentElement === parent)) {
      parent.setAttribute(LIST_ATTR, arrayPath);
    }
  }
}

/* ============================ 内联编辑 ============================ */

let editTimer = null;

function scheduleEdit(path, value) {
  clearTimeout(editTimer);
  editTimer = setTimeout(() => post({ type: 'edit', path, value }), 250);
}

root.addEventListener('input', (event) => {
  const target = event.target;
  const path = target?.getAttribute?.(EDIT_ATTR);
  if (!path) return;
  scheduleEdit(path, target.textContent);
});

// 回车即提交并退出编辑：避免把换行写进数据，也避免撑出多余元素
root.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!event.target?.getAttribute?.(EDIT_ATTR)) return;
  event.preventDefault();
  event.target.blur();
});

// 链接与按钮在预览里不跳转
root.addEventListener(
  'click',
  (event) => {
    const anchor = event.target?.closest?.('a,button');
    if (anchor) event.preventDefault();
  },
  true,
);

/* ============================ 列表项工具条 ============================ */

let toolbar = null;
let hovered = null;

function buildToolbar() {
  const bar = document.createElement('div');
  bar.className = 'canvas-item-tools';
  bar.hidden = true;

  const buttons = [
    { op: 'add', label: '＋', title: '在后面插入一项' },
    { op: 'up', label: '↑', title: '上移' },
    { op: 'down', label: '↓', title: '下移' },
    { op: 'remove', label: '✕', title: '删除该项' },
  ];

  for (const spec of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `canvas-tool ${spec.op === 'remove' ? 'is-danger' : ''}`;
    button.textContent = spec.label;
    button.title = spec.title;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const path = bar.dataset.path;
      if (path) post({ type: 'array', op: spec.op, path });
    });
    bar.appendChild(button);
  }

  document.body.appendChild(bar);
  return bar;
}

function positionToolbar(element) {
  const rect = element.getBoundingClientRect();
  const bar = toolbar;
  bar.dataset.path = element.getAttribute(ITEM_ATTR);
  bar.hidden = false;
  const top = Math.max(8, rect.top + window.scrollY - bar.offsetHeight - 6);
  bar.style.top = `${top}px`;
  bar.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
}

document.addEventListener('mousemove', (event) => {
  if (!toolbar) toolbar = buildToolbar();
  const item = event.target?.closest?.(`[${ITEM_ATTR}]`);
  if (item === hovered) return;

  if (hovered) hovered.classList.remove('is-editing-target');
  hovered = item || null;

  if (hovered) {
    hovered.classList.add('is-editing-target');
    positionToolbar(hovered);
  } else if (toolbar) {
    toolbar.hidden = true;
  }
});

/* ============================ 消息入口 ============================ */

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'render') {
    if (toolbar) toolbar.hidden = true;
    if (hovered) hovered.classList.remove('is-editing-target');
    hovered = null;
    render(message.key, message.payload);
  }
});

post({ type: 'ready' });
