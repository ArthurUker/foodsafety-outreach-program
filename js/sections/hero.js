/**
 * 首屏：项目定位 + 核心指标 + 治理驾驶舱示意面板。
 */

import { el } from '../core/dom.js';

function metricCard(metric, index) {
  return el('div.metric-card.reveal', { style: { '--i': String(index) } }, [
    el('div.metric-value', {}, [
      el('span.metric-number', { text: metric.value ?? '' }),
      metric.unit ? el('span.metric-unit', { text: metric.unit }) : null,
    ]),
    el('div.metric-label', { text: metric.label ?? '' }),
    metric.hint ? el('div.metric-hint', { text: metric.hint }) : null,
  ]);
}

function panelCard(card) {
  return el('div.panel-card', {}, [
    el('span.panel-tag', { class: card.tone ? `tone-${card.tone}` : '', text: card.tag ?? '' }),
    el('strong.panel-value', { text: card.value ?? '' }),
    el('small.panel-label', { text: card.label ?? '' }),
  ]);
}

function dashboardPanel(panel) {
  if (!panel) return null;
  return el('div.hero-panel.reveal', { style: { '--i': '2' } }, [
    el('div.panel-head', {}, [
      el('h3', { text: panel.title ?? '' }),
      el('p', { text: panel.subtitle ?? '' }),
    ]),
    el('div.panel-grid', {}, (panel.cards || []).map(panelCard)),
    panel.progress
      ? el('div.panel-progress', {}, [
          el('div.panel-progress-head', {}, [
            el('span', { text: panel.progress.label ?? '' }),
            el('strong', { text: `${panel.progress.value ?? 0}%` }),
          ]),
          el('div.progress-track', {}, [
            el('span.progress-fill', { style: { width: `${Math.min(Math.max(Number(panel.progress.value) || 0, 0), 100)}%` } }),
          ]),
        ])
      : null,
  ]);
}

export function renderHero(payload) {
  const actions = (payload.actions || []).map((action) =>
    el('a.btn', {
      class: action.variant === 'primary' ? 'btn-primary' : 'btn-ghost',
      href: action.href || '#',
      text: action.label ?? '',
    }),
  );

  return el('section.section-hero', { id: 'hero', attrs: { 'aria-label': '方案首页' } }, [
    el('div.container.hero-grid', {}, [
      el('div.hero-content', {}, [
        payload.badge ? el('div.hero-badge.reveal', { text: payload.badge }) : null,
        el('h1.hero-title.reveal', { style: { '--i': '1' } }, [
          document.createTextNode(payload.title ?? ''),
          payload.titleHighlight ? el('span.hero-highlight', { text: payload.titleHighlight }) : null,
        ]),
        payload.description ? el('p.hero-desc.reveal', { style: { '--i': '2' }, text: payload.description }) : null,
        actions.length > 0 ? el('div.hero-actions.reveal', { style: { '--i': '3' } }, actions) : null,
        (payload.metrics || []).length > 0
          ? el('div.hero-metrics', {}, payload.metrics.map(metricCard))
          : null,
      ]),
      dashboardPanel(payload.panel),
    ]),
  ]);
}
