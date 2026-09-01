/**
 * 滚动渐显：基于 IntersectionObserver，元素进入视口时加 .is-visible。
 * 尊重 prefers-reduced-motion：用户关闭动效时直接全部显示。
 */

const REVEAL_SELECTOR = '.reveal';
let observer = null;

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initReveal(root = document) {
  const targets = root.querySelectorAll(REVEAL_SELECTOR);

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // 一次性动画，避免反复触发
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );

  targets.forEach((node) => observer.observe(node));
}

/** 内容动态渲染后调用，接管新出现的 .reveal 元素 */
export function observeReveals(root = document) {
  if (prefersReducedMotion() || !observer) {
    root.querySelectorAll(REVEAL_SELECTOR).forEach((n) => n.classList.add('is-visible'));
    return;
  }
  root.querySelectorAll(`${REVEAL_SELECTOR}:not(.is-visible)`).forEach((n) => observer.observe(n));
}
