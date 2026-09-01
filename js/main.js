/**
 * 应用引导入口。
 *
 * 流程：加载内容 → 渲染章节 → 生成导航 → 应用站点配置 → 挂载交互。
 * 任一章节渲染失败不影响其它章节（单章容错），全部失败才显示错误页。
 */

import { el, clear } from './core/dom.js';
import { loadContent, loadSettings } from './data/contentRepository.js';
import { getAllSections, getNavSections } from './modules/registry.js';
import { initRouter } from './core/router.js';
import { initReveal } from './core/reveal.js';
import { initInquiryForm } from './modules/inquiryForm.js';

function renderNav() {
  const nav = document.getElementById('navMenu');
  if (!nav) return;
  const links = getNavSections().map((section, index) =>
    el('a.nav-link', {
      class: index === 0 ? 'is-active' : '',
      href: `#${section.key}`,
      text: section.navLabel,
    }),
  );
  clear(nav);
  links.forEach((link) => nav.appendChild(link));
}

function renderSections(app, content) {
  let failed = 0;

  for (const section of getAllSections()) {
    const data = content.sections.find((s) => s.key === section.key);
    if (!data) {
      failed += 1;
      continue;
    }
    try {
      const node = section.render(data.payload || {});
      if (node) app.appendChild(node);
    } catch (err) {
      failed += 1;
      console.error(`[render] 章节 ${section.key} 渲染失败：`, err);
    }
  }

  return failed;
}

function applySettings(settings) {
  const seo = settings?.seo;
  if (seo?.title) document.title = seo.title;

  const setMeta = (selector, attr, key, value) => {
    if (!value) return;
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', 'description', seo?.description);
  setMeta('meta[name="keywords"]', 'content', 'keywords', seo?.keywords);

  const site = settings?.site;
  if (site) {
    if (site.name) {
      document.querySelectorAll('[data-site-name]').forEach((n) => {
        n.textContent = site.name;
      });
    }
    if (site.slogan) {
      document.querySelectorAll('[data-site-slogan]').forEach((n) => {
        n.textContent = site.slogan;
      });
    }
    if (site.themeColor) {
      document.documentElement.style.setProperty('--brand', site.themeColor);
    }
  }

  const footer = settings?.footer;
  if (footer?.copyright) {
    document.querySelectorAll('[data-footer-copyright]').forEach((n) => {
      n.textContent = footer.copyright;
    });
  }
  if (footer?.note) {
    document.querySelectorAll('[data-footer-note]').forEach((n) => {
      n.textContent = footer.note;
    });
  }
}

function renderError(app, message) {
  clear(app);
  app.appendChild(
    el('section.section', {}, [
      el('div.container', {}, [
        el('div.empty-state', {}, [
          el('h2', { text: '内容加载失败' }),
          el('p', { text: message }),
          el('button.btn.btn-primary', {
            type: 'button',
            text: '重新加载',
            on: { click: () => window.location.reload() },
          }),
        ]),
      ]),
    ]),
  );
}

async function bootstrap() {
  const app = document.getElementById('app');
  const loader = document.getElementById('appLoader');

  try {
    const content = await loadContent();
    renderSections(app, content);

    renderNav();
    applySettings(await loadSettings().catch(() => ({})));

    initRouter();
    initReveal();
    initInquiryForm();

    loader?.remove();
    document.body.classList.add('is-ready');

    // 支持 #anchor 直达深链（渲染完成后再定位）
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth' }));
    }
  } catch (err) {
    console.error('[bootstrap]', err);
    loader?.remove();
    renderError(app, `${err.message}。请检查后端服务或 data/content.seed.json 是否可用。`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
