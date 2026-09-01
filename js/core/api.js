/**
 * HTTP 客户端：统一 base、超时、错误归一与 401 处理。
 * 静态部署（无后端）时请求失败会抛出异常，由调用方回落到种子数据。
 */

const DEFAULT_TIMEOUT = 10_000;

function resolveBase() {
  if (window.__API_BASE_URL !== undefined) return window.__API_BASE_URL;
  return '/api';
}

async function request(method, path, { body, headers = {}, timeout = DEFAULT_TIMEOUT, raw = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const options = {
    method,
    headers: { ...headers },
    signal: controller.signal,
    credentials: 'same-origin',
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  try {
    const url = `${resolveBase()}${path}`;
    const res = await fetch(url, options);
    clearTimeout(timer);

    if (res.status === 204) return { success: true, data: null };

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = raw ? text : { error: '响应不是合法 JSON。' };
    }

    if (!res.ok) {
      const error = new Error(data?.error || `请求失败（HTTP ${res.status}）`);
      error.status = res.status;
      error.payload = data;
      throw error;
    }
    return data ?? { success: true };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const e = new Error('请求超时，请检查网络后重试。');
      e.status = 0;
      throw e;
    }
    throw err;
  }
}

/** 读取鉴权令牌（后台使用；前台公开接口无需携带） */
export function getToken() {
  try {
    return sessionStorage.getItem('cfsg_admin_token') || localStorage.getItem('cfsg_admin_token') || '';
  } catch {
    return '';
  }
}

export function setToken(token, remember = false) {
  try {
    sessionStorage.setItem('cfsg_admin_token', token);
    if (remember) localStorage.setItem('cfsg_admin_token', token);
    else localStorage.removeItem('cfsg_admin_token');
  } catch {
    /* 隐私模式下忽略 */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem('cfsg_admin_token');
    localStorage.removeItem('cfsg_admin_token');
  } catch {
    /* 忽略 */
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
  /** 携带令牌的请求 */
  auth: (method, path, body, opts) =>
    request(method, path, { ...opts, body, headers: { Authorization: `Bearer ${getToken()}` } }),
};

export default api;
