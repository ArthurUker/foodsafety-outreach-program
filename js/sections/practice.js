/**
 * 落地实证：核心指标 + 成效要点 + 实施阶段时间轴。
 */

import { el } from '../core/dom.js';

export function renderPractice(payload) {
  const metrics = (payload.metrics || []).map((metric, index) =>
    el('div.practice-metric.reveal', { style: { '--i': String(index) } }, [
      el('div.practice-metric-value', {}, [
        el('strong', { text: metric.value ?? '' }),
        metric.unit ? el('span', { text: metric.unit }) : null,
      ]),
      el('div.practice-metric-label', { text: metric.label ?? '' }),
      metric.hint ? el('div.practice-metric-hint', { text: metric.hint }) : null,
    ]),
  );

  const highlights = (payload.highlights || []).map((item, index) =>
    el('article.highlight-card.reveal', { style: { '--i': String(index % 4) } }, [
      el('h4', { text: item.title ?? '' }),
      el('p', { text: item.desc ?? '' }),
    ]),
  );

  const timeline = (payload.timeline || []).map((item) =>
    el('li.timeline-item', {}, [
      el('div.timeline-dot', { attrs: { 'aria-hidden': 'true' } }),
      el('div.timeline-body', {}, [
        el('span.timeline-date', { text: item.date ?? '' }),
        el('h4', { text: item.title ?? '' }),
        el('p', { text: item.desc ?? '' }),
      ]),
    ]),
  );

  return el('section.section', { id: 'practice' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Verified' }),
        el('h2', { text: '落地实证' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      metrics.length > 0 ? el('div.practice-metrics', {}, metrics) : null,
      highlights.length > 0 ? el('div.grid.grid-4', {}, highlights) : null,
      timeline.length > 0 ? el('ol.timeline.reveal', {}, timeline) : null,
    ]),
  ]);
}
