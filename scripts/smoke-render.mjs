/**
 * 章节渲染冒烟测试（零框架，仅依赖 jsdom）。
 *
 * 用途：在改动 js/sections/*.js 或 js/core/dom.js 后快速确认「不会白屏」。
 * 校验项：
 *   1. 每个注册章节的种子 payload 能渲染出 HTMLElement，且根元素 id 正确
 *   2. 产出中不含 <script> 标签（渲染层必须全程 textContent）
 *   3. 恶意 payload 只作为纯文本呈现，不生成可执行 DOM 节点
 *   4. 空 payload 下渲染器不抛异常（无数据时跳过或渲染空壳）
 *
 * 用法：npm run smoke
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const registryUrl = pathToFileURL(path.join(ROOT, 'js/modules/registry.js')).href;
const { SECTION_ORDER, SECTION_REGISTRY } = await import(registryUrl);

const seedPath = path.join(ROOT, 'data/content.seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

let pass = 0;
let fail = 0;

const report = (ok, message) => {
  console.log(`${ok ? '✅' : '❌'} ${message}`);
  ok ? (pass += 1) : (fail += 1);
};

console.log('— 章节渲染 —');
for (const key of SECTION_ORDER) {
  const def = SECTION_REGISTRY[key];
  const entry = seed.sections[key];

  if (!def) {
    report(false, `${key}: 未登记在 SECTION_REGISTRY`);
    continue;
  }
  if (!entry) {
    report(false, `${key}: 种子内容缺失`);
    continue;
  }

  try {
    const node = def.render(entry.payload);
    if (node === null) {
      report(false, `${key}: 渲染器返回 null（种子内容非空时应产出节点）`);
      continue;
    }
    if (!(node instanceof dom.window.HTMLElement)) throw new Error('返回值不是 HTMLElement');
    if (node.id !== key) throw new Error(`根元素 id 应为 ${key}，实际为 ${node.id || '(空)'}`);
    if (/<script/i.test(node.outerHTML)) throw new Error('产出中出现了 <script> 标签');

    const textLen = node.textContent.trim().length;
    if (textLen < 20) throw new Error(`产出文本过少（${textLen} 字符），疑似渲染为空`);
    report(true, `${key.padEnd(12)} 文本 ${String(textLen).padStart(4)} 字符 · 子节点 ${node.querySelectorAll('*').length}`);
  } catch (err) {
    report(false, `${key}: ${err.message}`);
  }
}

console.log('\n— 安全 —');
try {
  const evil = JSON.parse(JSON.stringify(seed.sections.hero.payload));
  evil.title = '<img src=x onerror=alert(1)>';
  evil.metrics[0].label = '<script>alert(2)</script>';
  const node = SECTION_REGISTRY.hero.render(evil);
  if (node.querySelector('img, script')) throw new Error('恶意 payload 生成了真实 DOM 节点');
  if (!node.textContent.includes('<script>')) throw new Error('恶意文本未作为纯文本保留');
  report(true, 'XSS 注入：恶意内容按纯文本渲染，未生成可执行节点');
} catch (err) {
  report(false, `XSS 注入：${err.message}`);
}

console.log('\n— 容错 —');
try {
  for (const key of SECTION_ORDER) {
    const node = SECTION_REGISTRY[key].render({});
    if (node === null) continue; // 无数据时不渲染该章节，属设计行为
    if (!(node instanceof dom.window.HTMLElement)) throw new Error(`${key} 空 payload 未返回元素`);
  }
  report(true, '空 payload：所有渲染器均正常返回或按设计跳过');
} catch (err) {
  report(false, `空 payload：${err.message}`);
}

console.log(`\n结果：通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
