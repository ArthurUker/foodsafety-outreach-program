/**
 * 章节注册中心 —— 页面结构的单一事实来源。
 *
 * 新增章节只需：① 在 js/sections/ 写渲染器（纯函数，入参 payload，返回 HTMLElement）
 * ② 在本文件 SECTION_REGISTRY 登记。导航、渲染顺序、后台章节列表自动跟随，零改码。
 *
 * 注意：SECTION_ORDER 与后端 backend/lib/contentStore.js 的 SECTION_KEYS 必须保持一致。
 */

import { renderHero } from '../sections/hero.js';
import { renderBackground } from '../sections/background.js';
import { renderOverview } from '../sections/overview.js';
import { renderCapability } from '../sections/capability.js';
import { renderTechnology } from '../sections/technology.js';
import { renderPractice } from '../sections/practice.js';
import { renderRoadmap } from '../sections/roadmap.js';
import { renderContact } from '../sections/contact.js';

/** 页面渲染顺序（同时决定导航顺序） */
export const SECTION_ORDER = [
  'hero',
  'background',
  'overview',
  'capability',
  'technology',
  'practice',
  'roadmap',
  'contact',
];

/**
 * 章节注册表：key -> { key, navLabel, render, inNav }
 * inNav=false 的章节不出现在顶部导航（如首屏）。
 */
export const SECTION_REGISTRY = {
  hero: { key: 'hero', navLabel: '首页', render: renderHero, inNav: true },
  background: { key: 'background', navLabel: '建设背景', render: renderBackground, inNav: true },
  overview: { key: 'overview', navLabel: '方案总览', render: renderOverview, inNav: true },
  capability: { key: 'capability', navLabel: '核心能力', render: renderCapability, inNav: true },
  technology: { key: 'technology', navLabel: '技术架构', render: renderTechnology, inNav: true },
  practice: { key: 'practice', navLabel: '落地实证', render: renderPractice, inNav: true },
  roadmap: { key: 'roadmap', navLabel: '推广路线', render: renderRoadmap, inNav: true },
  contact: { key: 'contact', navLabel: '联系我们', render: renderContact, inNav: true },
};

/** 按顺序返回已注册章节定义 */
export function getAllSections() {
  return SECTION_ORDER.map((key) => SECTION_REGISTRY[key]).filter(Boolean);
}

/** 出现在导航中的章节 */
export function getNavSections() {
  return getAllSections().filter((section) => section.inNav !== false);
}

/** 按 key 取章节定义 */
export function getSectionDef(key) {
  return SECTION_REGISTRY[key] || null;
}

/** 校验 key 是否已注册 */
export function isValidSectionKey(key) {
  return Boolean(SECTION_REGISTRY[key]);
}
