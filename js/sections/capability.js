/**
 * 核心能力矩阵：按「检测 / 宣教 / 治理」三条主线分组，逐项标注建设状态。
 */

import { el } from '../core/dom.js';

const STATUS_TONE = {
  已上线: 'tone-live',
  建设中: 'tone-building',
  规划中: 'tone-planned',
};

function capabilityItem(item) {
  return el('li.capability-item.glass-panel', {}, [
    el('div.capability-item-head', {}, [
      el('h4', { text: item.name ?? '' }),
      el('span.status-badge', { class: STATUS_TONE[item.status] || 'tone-planned', text: item.status ?? '' }),
    ]),
    item.desc ? el('p', { text: item.desc }) : null,
  ]);
}

function capabilityGroup(group, index) {
  return el('article.capability-group.glass.reveal', { style: { '--i': String(index) } }, [
    el('header.capability-group-head', {}, [
      el('h3', { text: group.title ?? '' }),
      group.summary ? el('p', { text: group.summary }) : null,
    ]),
    el('ul.capability-list', {}, (group.items || []).map(capabilityItem)),
  ]);
}

export function renderCapability(payload) {
  return el('section.section.section-muted', { id: 'capability' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Capability' }),
        el('h2', { text: '核心能力矩阵' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      (payload.legend || []).length > 0
        ? el(
            'div.status-legend.reveal',
            {},
            payload.legend.map((item) =>
              el('span.legend-item', {}, [
                el('span.status-badge', { class: STATUS_TONE[item.status] || 'tone-planned', text: item.status ?? '' }),
                el('span.legend-desc', { text: item.desc ?? '' }),
              ]),
            ),
          )
        : null,
      el('div.grid.grid-3', {}, (payload.groups || []).map(capabilityGroup)),
    ]),
  ]);
}
