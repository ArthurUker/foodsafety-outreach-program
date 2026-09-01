/**
 * 技术架构五层：步骤导航 + 内容幻灯片。
 *
 * 交互：点击步骤 / 上一下一层 / 自动轮播（鼠标悬停暂停，离开恢复）。
 * 尊重 prefers-reduced-motion：关闭动效时不自动轮播。
 */

import { el } from '../core/dom.js';

const AUTO_DELAY = 6000;

function layerSlide(layer, index) {
  const tags = (layer.tags || []).map((tag) => el('span.tag', { text: tag }));
  const points = (layer.points || []).map((point) =>
    el('div.tech-point', {}, [el('strong', { text: point.title ?? '' }), el('p', { text: point.desc ?? '' })]),
  );
  const list = (layer.tags || []).length > 0 && (layer.points || []).length === 0 ? tags : null;

  return el('article.tech-slide', { class: index === 0 ? 'is-active' : '', dataset: { index: String(index) } }, [
    el('div.tech-slide-text', {}, [
      el('span.tech-kicker', { text: `${layer.no ?? ''} · ${layer.en ?? ''}` }),
      el('h3', { text: layer.title ?? '' }),
      layer.desc ? el('p.tech-desc', { text: layer.desc }) : null,
      list ? el('div.tag-row', {}, list) : null,
      points.length > 0 ? el('div.tech-points', {}, points) : null,
      layer.case
        ? el('div.tech-case', {}, [
            el('h4', { text: layer.case.title ?? '' }),
            (layer.case.metrics || []).length > 0
              ? el('div.tech-metrics', {}, layer.case.metrics.map((m) => el('span', { text: m })))
              : null,
            layer.case.desc ? el('p', { text: layer.case.desc }) : null,
          ])
        : null,
    ]),
    el('div.tech-slide-visual', { attrs: { 'aria-hidden': 'true' } }, [
      el('div.tech-orb', {}, [
        el('span.tech-orb-no', { text: layer.no ?? '' }),
        el('span.tech-orb-en', { text: layer.en ?? '' }),
      ]),
      tags.length > 0 && !list ? el('div.tech-orb-tags', {}, tags) : null,
    ]),
  ]);
}

export function renderTechnology(payload) {
  const layers = payload.layers || [];
  if (layers.length === 0) return null;

  const steps = layers.map((layer, index) =>
    el('button.tech-step', {
      class: index === 0 ? 'is-active' : '',
      type: 'button',
      dataset: { index: String(index) },
      attrs: { 'aria-label': `查看第 ${index + 1} 层：${layer.title ?? ''}` },
    }, [
      el('span.tech-step-no', { text: layer.no ?? '' }),
      el('span.tech-step-en', { text: layer.en ?? '' }),
      el('span.tech-step-cn', { text: layer.title ?? '' }),
    ]),
  );

  // 步骤之间插入连接线
  const nav = el('nav.tech-nav', { attrs: { 'aria-label': '技术架构层级' } }, []);
  steps.forEach((step, index) => {
    nav.appendChild(step);
    if (index < steps.length - 1) {
      nav.appendChild(el('span.tech-step-line', { attrs: { 'aria-hidden': 'true' } }));
    }
  });

  const slides = layers.map(layerSlide);
  const progressText = el('span', { text: `01 / ${String(layers.length).padStart(2, '0')}` });
  const prevBtn = el('button.tech-btn', { type: 'button', attrs: { 'aria-label': '上一层' }, text: '‹' });
  const nextBtn = el('button.tech-btn', { type: 'button', attrs: { 'aria-label': '下一层' }, text: '›' });

  const section = el('section.section.section-dark', { id: 'technology' }, [
    el('div.container', {}, [
      el('div.section-heading.is-light.reveal', {}, [
        el('span.section-tag', { text: 'Technology' }),
        el('h2', { text: '技术架构与系统能力设计' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      el('div.tech-block.reveal', {}, [
        nav,
        el('div.tech-panel', {}, [
          el('div.tech-controls', {}, [prevBtn, el('div.tech-progress', {}, [progressText]), nextBtn]),
          el('div.tech-slides', {}, slides),
        ]),
      ]),
    ]),
  ]);

  // ---- 交互 ----
  let current = 0;
  let timer = null;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function update(index) {
    current = (index + layers.length) % layers.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
    nav.querySelectorAll('.tech-step').forEach((step, i) => {
      const active = i === current;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-current', active ? 'step' : 'false');
    });
    progressText.textContent = `${String(current + 1).padStart(2, '0')} / ${String(layers.length).padStart(2, '0')}`;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function start() {
    stop();
    if (reduceMotion) return;
    timer = setInterval(() => update(current + 1), AUTO_DELAY);
  }

  prevBtn.addEventListener('click', () => {
    update(current - 1);
    start();
  });
  nextBtn.addEventListener('click', () => {
    update(current + 1);
    start();
  });
  nav.querySelectorAll('.tech-step').forEach((step, index) => {
    step.addEventListener('click', () => {
      update(index);
      start();
    });
  });

  section.addEventListener('mouseenter', stop);
  section.addEventListener('mouseleave', start);
  section.addEventListener('focusin', stop);

  update(0);
  start();

  return section;
}
