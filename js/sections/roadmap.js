/**
 * 推广路线与服务保障：四阶段路径 + 服务清单。
 */

import { el } from '../core/dom.js';

function phaseCard(phase, index) {
  const goals = (phase.goals || []).map((goal) =>
    el('li', {}, [el('span.tick', { attrs: { 'aria-hidden': 'true' }, text: '✓' }), el('span', { text: goal })]),
  );
  const deliverables = (phase.deliverables || []).map((item) => el('span.chip', { text: item }));

  return el('article.phase-card.reveal', { style: { '--i': String(index) } }, [
    el('div.phase-head', {}, [
      el('span.phase-no', { text: phase.no ?? '' }),
      el('div', {}, [
        el('h3', { text: phase.title ?? '' }),
        el('span.phase-period', { text: phase.period ?? '' }),
      ]),
    ]),
    goals.length > 0 ? el('ul.phase-goals', {}, goals) : null,
    deliverables.length > 0
      ? el('div.phase-deliverables', {}, [
          el('span.phase-deliverables-label', { text: '阶段交付物' }),
          el('div.chip-row', {}, deliverables),
        ])
      : null,
  ]);
}

export function renderRoadmap(payload) {
  const services = (payload.services || []).map((service, index) =>
    el('article.service-item.reveal', { style: { '--i': String(index) } }, [
      el('span.service-index', { text: String(index + 1).padStart(2, '0') }),
      el('div.service-body', {}, [el('h4', { text: service.title ?? '' }), el('p', { text: service.desc ?? '' })]),
    ]),
  );

  return el('section.section.section-muted', { id: 'roadmap' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Roadmap' }),
        el('h2', { text: '推广路线与服务保障' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      el('div.grid.grid-4', {}, (payload.phases || []).map(phaseCard)),
      services.length > 0
        ? el('div.service-block.reveal', {}, [
            el('h3.service-block-title', { text: '服务内容' }),
            el('div.service-list', {}, services),
          ])
        : null,
    ]),
  ]);
}
