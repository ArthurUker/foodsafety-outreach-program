/**
 * 站内导航：滚动高亮、平滑滚动、移动端菜单、返回顶部。
 * 纯锚点导航（无 History API 路由），静态部署与 Caddy 托管均可用。
 */

const SCROLL_OFFSET = 84; // 顶部固定导航高度 + 余量

export function initRouter({ navSelector = '[data-nav]', sectionsSelector = 'main section[id]' } = {}) {
  const header = document.querySelector('.site-header');
  const nav = document.querySelector(navSelector);
  const menuToggle = document.getElementById('menuToggle');
  const backToTop = document.getElementById('backToTop');
  const links = () => Array.from(document.querySelectorAll('.nav-link'));
  const sections = () => Array.from(document.querySelectorAll(sectionsSelector));

  /* 移动端菜单 */
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuToggle.classList.toggle('is-active', open);
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* 点击导航后关闭移动菜单 + 平滑滚动（考虑固定导航偏移） */
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.nav-link, .js-scroll');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#') || href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });

    if (nav) {
      nav.classList.remove('is-open');
      menuToggle?.classList.remove('is-active');
      menuToggle?.setAttribute('aria-expanded', 'false');
    }
    history.replaceState(null, '', href);
  });

  /* 点击空白处关闭移动菜单 */
  document.addEventListener('click', (event) => {
    if (!nav?.classList.contains('is-open')) return;
    if (nav.contains(event.target) || menuToggle?.contains(event.target)) return;
    nav.classList.remove('is-open');
    menuToggle?.classList.remove('is-active');
  });

  /* 滚动：导航阴影 / 高亮 / 返回顶部 */
  let ticking = false;
  function update() {
    const scrollY = window.pageYOffset;

    header?.classList.toggle('is-scrolled', scrollY > 16);
    backToTop?.classList.toggle('is-visible', scrollY > 520);

    const list = sections();
    let activeId = list[0]?.id;
    for (const section of list) {
      const top = section.offsetTop - SCROLL_OFFSET - 40;
      if (scrollY >= top) activeId = section.id;
    }
    links().forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${activeId}`);
    });

    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true },
  );
  window.addEventListener('resize', update);
  window.addEventListener('load', update);

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
}
