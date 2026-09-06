/**
 * 画布编辑器控制器（运行在 admin.html 主页面）。
 *
 * 与 iframe 内的 preview-agent.js 配合：
 * - 下发 {type:'render'} 让画布渲染当前章节草稿；
 * - 接收 {type:'edit'|'array'} 把改动写回本地 payload 副本；
 * - 保存时由 app.js 取走 getDraft() 提交给后端。
 *
 * 内存草稿与服务端数据严格分离：未点保存前线上内容不受影响。
 */

const state = {
  frame: null,
  ready: false,
  pending: null,
  mode: 'visual', // visual | json
  key: null,
  draft: null,
  dirty: false,
  onEdit: null,
  onStats: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function post(message) {
  if (state.ready && state.frame?.contentWindow) {
    state.frame.contentWindow.postMessage(message, window.location.origin);
    return;
  }
  // iframe 尚未就绪：缓存最后一条渲染指令，ready 后补发
  if (message.type === 'render') state.pending = message;
}

/* ============================ 路径工具 ============================ */

/** 'metrics[0].label' → ['metrics', 0, 'label'] */
export function parsePath(path) {
  return String(path)
    .split('.')
    .flatMap((part) => {
      const match = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
      if (!match) return [part];
      const indexes = [...match[2].matchAll(/\[(\d+)\]/g)].map((item) => Number(item[1]));
      return [match[1], ...indexes].filter((item) => item !== '');
    });
}

function getParentContainer(payload, path) {
  const keys = parsePath(path);
  const index = keys[keys.length - 1];
  if (typeof index !== 'number') return null;

  let container = payload;
  for (let i = 0; i < keys.length - 1; i += 1) {
    container = container?.[keys[i]];
  }
  if (!Array.isArray(container)) return null;
  return { container, index };
}

function setByPath(payload, path, value) {
  const keys = parsePath(path);
  if (keys.length === 0) return;

  let current = payload;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = keys[i + 1];
    if (current[key] === null || typeof current[key] !== 'object') {
      current[key] = typeof next === 'number' ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/** 复制结构、清空文本：新增数组项时给运营一个可直接填写的模板 */
function blankClone(value) {
  if (Array.isArray(value)) return value.map(blankClone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankClone(item)]));
  }
  if (typeof value === 'string') return '';
  return value;
}

function applyArrayOp(op, path) {
  const found = getParentContainer(state.draft, path);
  if (!found) return;
  const { container, index } = found;

  if (op === 'add') {
    container.splice(index + 1, 0, blankClone(container[index]));
    return;
  }
  if (op === 'remove') {
    if (container.length > 1) container.splice(index, 1);
    return;
  }
  if (op === 'up' && index > 0) {
    [container[index - 1], container[index]] = [container[index], container[index - 1]];
    return;
  }
  if (op === 'down' && index < container.length - 1) {
    [container[index + 1], container[index]] = [container[index], container[index + 1]];
  }
}

/* ============================ 对外接口 ============================ */

export function initCanvas({ frame, onEdit, onStats }) {
  state.frame = frame;
  state.onEdit = onEdit;
  state.onStats = onStats;

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ready') {
      state.ready = true;
      if (state.pending) {
        frame.contentWindow.postMessage(state.pending, window.location.origin);
        state.pending = null;
      }
      return;
    }

    if (message.type === 'stats') {
      state.onStats?.(message);
      return;
    }

    if (message.type === 'edit') {
      if (!state.draft) return;
      setByPath(state.draft, message.path, message.value);
      state.dirty = true;
      state.onEdit?.();
      return;
    }

    if (message.type === 'array') {
      if (!state.draft) return;
      applyArrayOp(message.op, message.path);
      state.dirty = true;
      state.onEdit?.();
      renderCurrent();
    }
  });
}

function renderCurrent() {
  if (!state.key || !state.draft) return;
  post({ type: 'render', key: state.key, payload: state.draft });
}

/** 载入（或重新载入）某个章节的草稿 */
export function renderCanvas(key, payload) {
  state.key = key;
  state.draft = clone(payload);
  state.dirty = false;
  renderCurrent();
}

export function getDraft() {
  return state.draft;
}

export function isCanvasMode() {
  return state.mode === 'visual';
}

export function isCanvasDirty() {
  return state.dirty;
}

export function setCanvasMode(mode) {
  state.mode = mode === 'json' ? 'json' : 'visual';
}
