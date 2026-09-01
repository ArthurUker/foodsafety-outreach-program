/**
 * 极简 DOM 构建工具。
 *
 * 安全约定：字符串子节点一律通过 textContent 写入（不用 innerHTML），
 * 从源头杜绝存储型 XSS —— 后台编辑的内容即使被注入脚本也只会当作文本显示。
 */

/**
 * 创建元素。
 * @param {string} tag 选择器串，支持 'div#myId.card.card-lg' 形式（tag + id + 多个 class）
 * @param {object} [props] { class, id, text, attrs, dataset, style, on }
 * @param {Node|string|Array<Node|string>|null} [children]
 */
export function el(tag, props = {}, children = null) {
  const [rawTag, ...classNames] = String(tag).split('.');
  // 支持 id 简写：'input#inqName' → 标签 input + id inqName
  const [tagName, idFromSelector] = rawTag.split('#');
  const node = document.createElement(tagName || 'div');

  if (idFromSelector) node.id = idFromSelector;
  if (classNames.length > 0) node.classList.add(...classNames);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    switch (key) {
      case 'class':
        node.classList.add(...String(value).split(/\s+/).filter(Boolean));
        break;
      case 'text':
        node.textContent = String(value);
        break;
      case 'html':
        // 仅用于受控的静态模板（本文件内部使用），业务内容禁止走此分支
        node.innerHTML = String(value);
        break;
      case 'dataset':
        Object.assign(node.dataset, value);
        break;
      case 'style':
        Object.assign(node.style, value);
        break;
      case 'on':
        for (const [evt, handler] of Object.entries(value)) node.addEventListener(evt, handler);
        break;
      case 'attrs':
        for (const [name, val] of Object.entries(value)) {
          if (val === false || val === null || val === undefined) continue;
          node.setAttribute(name, val === true ? '' : String(val));
        }
        break;
      default:
        node.setAttribute(key, String(value));
    }
  }

  append(node, children);
  return node;
}

/** 追加子节点：字符串按文本处理（不解析 HTML） */
export function append(parent, children) {
  if (children === null || children === undefined || children === false) return parent;
  if (Array.isArray(children)) {
    children.forEach((child) => append(parent, child));
    return parent;
  }
  parent.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return parent;
}

/** 清空容器 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** 文档片段 */
export function frag(children = null) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/** 安全：把可能含 HTML 的字符串按纯文本写入 */
export function setText(node, value) {
  node.textContent = value === null || value === undefined ? '' : String(value);
  return node;
}

/**
 * 转义后再用于 innerHTML 场景（本项目渲染默认走 textContent，
 * 此函数供第三方组件或必须拼字符串的场合使用）。
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
