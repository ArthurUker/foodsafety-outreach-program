/**
 * 方案总体框架：「1 + 3 + N」结构 + 三大体系 + 已验证能力映射表。
 */

import { el } from '../core/dom.js';

function framework(payload) {
  const fw = payload.framework;
  if (!fw) return null;

  return el('div.framework.reveal', {}, [
    el('div.framework-core', {}, [
      el('span.framework-core-tag', { text: '1 个物理底座' }),
      el('strong', { text: fw.core ?? '' }),
      fw.coreDesc ? el('p', { text: fw.coreDesc }) : null,
    ]),
    el('div.framework-rings.glass', {}, [
      el('span.framework-ring-label', { text: '3 大能力体系' }),
      el(
        'div.ring-list',
        {},
        (fw.rings || []).map((ring, i) =>
          el('span.ring-item.glass-panel', { style: { '--i': String(i) }, text: ring }),
        ),
      ),
      el('span.framework-ring-note', { text: '→ 向 N 类校园场景复制推广' }),
    ]),
  ]);
}

function pillarCard(pillar, index) {
  return el('article.pillar-card.glass.reveal', { class: `tone-${pillar.tone || 'primary'}`, style: { '--i': String(index) } }, [
    el('div.pillar-head', {}, [
      el('span.pillar-code', { text: pillar.code ?? '' }),
      el('h3', { text: pillar.title ?? '' }),
    ]),
    pillar.summary ? el('p.pillar-summary', { text: pillar.summary }) : null,
    el(
      'ul.pillar-list',
      {},
      (pillar.items || []).map((item) => el('li', {}, [
        el('span.tick', { attrs: { 'aria-hidden': 'true' }, text: '✓' }),
        el('span', { text: item }),
      ])),
    ),
  ]);
}

function mappingTable(mapping) {
  if (!mapping) return null;

  const statusTone = (status) => {
    if (status === '已上线') return 'tone-live';
    if (status === '建设中') return 'tone-building';
    return 'tone-planned';
  };

  return el('div.mapping.reveal', {}, [
    el('div.mapping-head', {}, [
      el('h3', { text: mapping.title ?? '' }),
      mapping.desc ? el('p', { text: mapping.desc }) : null,
    ]),
    el('div.table-wrap', {}, [
      el('table.data-table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: '推广能力项' }),
            el('th', { text: '能力来源' }),
            el('th', { text: '状态' }),
          ]),
        ]),
        el(
          'tbody',
          {},
          (mapping.rows || []).map((row) =>
            el('tr', {}, [
              el('td', { text: row.capability ?? '' }),
              el('td.muted', { text: row.source ?? '' }),
              el('td', {}, [el('span.status-badge', { class: statusTone(row.status), text: row.status ?? '' })]),
            ]),
          ),
        ),
      ]),
    ]),
  ]);
}

export function renderOverview(payload) {
  return el('section.section', { id: 'overview' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Overview' }),
        el('h2', { text: '方案总体框架' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      framework(payload),
      el('div.grid.grid-3', {}, (payload.pillars || []).map(pillarCard)),
      mappingTable(payload.mapping),
    ]),
  ]);
}
