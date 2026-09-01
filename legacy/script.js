const header = document.querySelector('.header');
const navMenu = document.getElementById('navMenu');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('main section[id]');
const reveals = document.querySelectorAll('.reveal');
const backToTop = document.getElementById('backToTop');
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

/* 1. 移动端菜单切换 */
menuToggle.addEventListener('click', () => {
  navMenu.classList.toggle('open');
});

/* 点击导航后关闭移动端菜单 */
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
  });
});

/* 2. 滚动时导航高亮 + 顶部阴影 */
function updateActiveNav() {
  const scrollY = window.pageYOffset;

  if (scrollY > 20) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    const sectionHeight = section.offsetHeight;
    const sectionId = section.getAttribute('id');

    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
      navLinks.forEach(link => link.classList.remove('active'));
      const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
      if (activeLink) {
        activeLink.classList.add('active');
      }
    }
  });

  if (scrollY > 400) {
    backToTop.classList.add('show');
  } else {
    backToTop.classList.remove('show');
  }
}

window.addEventListener('scroll', updateActiveNav);
window.addEventListener('load', updateActiveNav);

/* 3. 滚动渐显 */
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  },
  {
    threshold: 0.16
  }
);

reveals.forEach(item => observer.observe(item));

/* 4. 返回顶部 */
backToTop.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

/* 5. 表单校验 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

contactForm.addEventListener('submit', event => {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!name) {
    formMessage.textContent = '请输入姓名。';
    formMessage.style.color = '#ef4444';
    return;
  }

  if (!phone) {
    formMessage.textContent = '请输入联系电话。';
    formMessage.style.color = '#ef4444';
    return;
  }

  if (!isValidPhone(phone)) {
    formMessage.textContent = '请输入有效的中国大陆手机号。';
    formMessage.style.color = '#ef4444';
    return;
  }

  if (!email) {
    formMessage.textContent = '请输入电子邮箱。';
    formMessage.style.color = '#ef4444';
    return;
  }

  if (!isValidEmail(email)) {
    formMessage.textContent = '请输入有效的邮箱地址。';
    formMessage.style.color = '#ef4444';
    return;
  }

  if (!message || message.length < 10) {
    formMessage.textContent = '咨询内容不少于 10 个字。';
    formMessage.style.color = '#ef4444';
    return;
  }

  formMessage.textContent = '提交成功。当前为前端演示版本，后续可接入后端接口或邮件服务。';
  formMessage.style.color = '#16a34a';

  contactForm.reset();
});

/* 6. 点击空白区域关闭移动菜单 */
document.addEventListener('click', event => {
  const isClickInsideMenu = navMenu.contains(event.target);
  const isClickToggle = menuToggle.contains(event.target);

  if (!isClickInsideMenu && !isClickToggle) {
    navMenu.classList.remove('open');
  }
});
/* =========================
   Solution Slider
========================= */
(function () {
  const slider = document.getElementById("solutionSlider");
  const prevBtn = document.getElementById("solutionPrev");
  const nextBtn = document.getElementById("solutionNext");
  const slides = document.querySelectorAll(".solution-slide");
  const dots = document.querySelectorAll("#solutionDots .dot");

  if (!slider || !prevBtn || !nextBtn || !slides.length || !dots.length) return;

  let currentIndex = 0;
  let autoPlay = null;
  const interval = 4000;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });

    currentIndex = index;
  }

  function nextSlide() {
    const nextIndex = (currentIndex + 1) % slides.length;
    showSlide(nextIndex);
  }

  function prevSlide() {
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    showSlide(prevIndex);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlay = setInterval(nextSlide, interval);
  }

  function stopAutoPlay() {
    if (autoPlay) {
      clearInterval(autoPlay);
      autoPlay = null;
    }
  }

  prevBtn.addEventListener("click", () => {
    prevSlide();
    startAutoPlay();
  });

  nextBtn.addEventListener("click", () => {
    nextSlide();
    startAutoPlay();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      startAutoPlay();
    });
  });

  slider.addEventListener("mouseenter", stopAutoPlay);
  slider.addEventListener("mouseleave", startAutoPlay);

  showSlide(0);
  startAutoPlay();
})();
// ===== 图片放大弹窗 =====
(function () {
  const modal      = document.getElementById('imgModal');
  const overlay    = document.getElementById('imgModalOverlay');
  const closeBtn   = document.getElementById('imgModalClose');
  const modalImg   = document.getElementById('imgModalImg');
  const modalCap   = document.getElementById('imgModalCaption');

  // 打开弹窗
  function openModal(src, alt) {
    modalImg.src = src;
    modalImg.alt = alt;
    modalCap.textContent = alt;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
  }

  // 关闭弹窗
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    // 延迟清空，避免关闭动画中闪烁
    setTimeout(() => { modalImg.src = ''; }, 300);
  }

  // 给方案介绍区域的所有轮播图片绑定点击事件
  // 使用事件委托，兼容动态渲染
  const slider = document.getElementById('solutionSlider');
  if (slider) {
    slider.addEventListener('click', function (e) {
      const img = e.target.closest('.slide-image img');
      if (img) {
        openModal(img.src, img.alt);
      }
    });
  }

  // 关闭方式：点击遮罩
  overlay.addEventListener('click', closeModal);

  // 关闭方式：点击关闭按钮
  closeBtn.addEventListener('click', closeModal);

  // 关闭方式：按 ESC 键
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();
/* =========================
   技术架构 V2 轮播逻辑
========================= */
(function () {
  const techSection = document.querySelector('#technology');
  if (!techSection) return;

  const steps = techSection.querySelectorAll('.tech-step');
  const slides = techSection.querySelectorAll('.tech-v2-slide');
  const prevBtn = techSection.querySelector('#techPrev');
  const nextBtn = techSection.querySelector('#techNext');
  const progressText = techSection.querySelector('#techProgressText');

  if (!steps.length || !slides.length) return;

  let currentIndex = 0;
  let techTimer = null;
  const autoDelay = 5500;

  function updateTechSlider(index) {
    currentIndex = index;

    steps.forEach((step, i) => {
      step.classList.toggle('active', i === currentIndex);
    });

    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === currentIndex);
    });

    if (progressText) {
      const current = String(currentIndex + 1).padStart(2, '0');
      const total = String(slides.length).padStart(2, '0');
      progressText.textContent = `${current} / ${total}`;
    }
  }

  function nextTechSlide() {
    const nextIndex = (currentIndex + 1) % slides.length;
    updateTechSlider(nextIndex);
  }

  function prevTechSlide() {
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateTechSlider(prevIndex);
  }

  function startTechAutoPlay() {
    stopTechAutoPlay();
    techTimer = setInterval(nextTechSlide, autoDelay);
  }

  function stopTechAutoPlay() {
    if (techTimer) {
      clearInterval(techTimer);
      techTimer = null;
    }
  }

  function resetTechAutoPlay() {
    startTechAutoPlay();
  }

  steps.forEach((step, index) => {
    step.addEventListener('click', () => {
      updateTechSlider(index);
      resetTechAutoPlay();
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevTechSlide();
      resetTechAutoPlay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextTechSlide();
      resetTechAutoPlay();
    });
  }

  techSection.addEventListener('mouseenter', stopTechAutoPlay);
  techSection.addEventListener('mouseleave', startTechAutoPlay);

  updateTechSlider(0);
  startTechAutoPlay();
})();
