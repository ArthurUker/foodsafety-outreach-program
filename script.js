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
