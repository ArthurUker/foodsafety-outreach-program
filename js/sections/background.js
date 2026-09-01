/**
 * 建设背景与现实差距：痛点卡片 + 关键数字。
 */

import { el } from '../core/dom.js';

export function renderBackground(payload) {
  const points = (payload.points || []).map((point, index) =>
    el('article.card.card-problem.reveal', { style: { '--i': String(index % 4) } }, [
      el('div.card-no', { text: point.no ?? String(index + 1).padStart(2, '0') }),
      el('h3', { text: point.title ?? '' }),
      el('p', { text: point.desc ?? '' }),
    ]),
  );

  const stats = (payload.stats || []).map((stat) =>
    el('div.stat-item', {}, [
      el('strong', { text: stat.value ?? '' }),
      el('span', { text: stat.label ?? '' }),
    ]),
  );

  return el('section.section.section-muted', { id: 'background' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Background' }),
        el('h2', { text: '建设背景与现实差距' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      el('div.grid.grid-4', {}, points),
      stats.length > 0 ? el('div.stat-strip.reveal', {}, stats) : null,
    ]),
  ]);
}
