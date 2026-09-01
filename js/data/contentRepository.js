/**
 * 内容仓库：章节内容的唯一读取入口。
 *
 * 读取策略（降级链）：
 *   ① 后端 /api/content（后台编辑后的权威源）
 *   ② 本地 data/content.seed.json（无后端 / 后端异常时的静态兜底，保证纯静态部署可用）
 *
 * 前端渲染完全由 payload 驱动，改文案不需要改代码也不需要重建 dist/。
 */

import { api } from '../core/api.js';

const FALLBACK_URL = './data/content.seed.json';

let cache = null;

async function loadFromSeed() {
  const res = await fetch(FALLBACK_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`种子内容加载失败（HTTP ${res.status}）`);
  const json = await res.json();
  const sections = Object.entries(json.sections || {}).map(([key, entry]) => ({
    key,
    title: entry.title ?? null,
    subtitle: entry.subtitle ?? null,
    payload: entry.payload,
    updatedAt: null,
    updatedBy: null,
  }));
  return { sections, settings: json.settings || {}, source: 'seed' };
}

async function loadFromApi() {
  const data = await api.get('/content');
  if (!data?.success || !Array.isArray(data.sections)) {
    throw new Error('接口返回的内容格式不正确。');
  }
  // 章节排序交给前端 registry 的 SECTION_ORDER，避免后端 sortOrder 与页面顺序耦合
  return { sections: data.sections, settings: null, source: 'api' };
}

/**
 * 加载全部内容。
 * @param {{ prefer?: 'api'|'seed', force?: boolean }} [options]
 */
export async function loadContent({ prefer = 'api', force = false } = {}) {
  if (cache && !force) return cache;

  const attempts = prefer === 'seed' ? [loadFromSeed, loadFromApi] : [loadFromApi, loadFromSeed];
  let lastError = null;

  for (const attempt of attempts) {
    try {
      cache = await attempt();
      return cache;
    } catch (err) {
      lastError = err;
      console.warn('[content] 内容源不可用，尝试下一个：', err.message);
    }
  }
  throw lastError || new Error('无可用内容源。');
}

/** 从已加载内容中按 key 取章节 */
export function pickSection(content, key) {
  return content.sections.find((s) => s.key === key) || null;
}

/** 站点配置（API 源返回 settings 为 null 时回落到 seed） */
export async function loadSettings() {
  try {
    const data = await api.get('/settings');
    if (data?.success && data.settings) return data.settings;
  } catch {
    /* 忽略，走回落 */
  }
  const content = await loadContent({ prefer: 'seed' }).catch(() => null);
  return content?.settings || {};
}
