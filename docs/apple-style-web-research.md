# Apple 网页设计规范研究报告

> 研究方法：GitHub 多角度搜索（18 组关键词，覆盖复刻类 / 设计系统类 / 组件库类 / 动效类 / 中文站类），
> 约 90 条原始结果中筛出 **50 个有效条目**，并深读 4 份规范性文档原文。
> 目的：提炼 Apple 网页设计规范的可执行参数，并给出本站的差距清单。
> 研究日期：2026-09-06

---

## 一、核心规范文档（可直接抄作业，按价值排序）

| # | 资源 | 类型 | 价值 |
|---|------|------|------|
| 1 | [iFurySt/DESIGN.md · apple](https://github.com/iFurySt/DESIGN.md/tree/main/design-md/apple) | DESIGN.md 规范 | **最完整**：颜色/字号层级表/间距/圆角/组件/Do-Don't 全量参数 |
| 2 | [designmd.cc/benchmarks/apple](https://designmd.cc/benchmarks/apple) | 生产 CSS 实测 | 从 apple.com 线上 DOM/CSSOM 提取的真实数值（2026-05 测量） |
| 3 | [chaos-xxl/apple-design-skill](https://github.com/chaos-xxl/apple-design-skill) | AI 设计 Skill | **含中文站专属规则**（CJK 字重/字间距），typography.md + design-tokens.md |
| 4 | [axiaoge2/Apple-Hig-Designer](https://github.com/axiaoge2/Apple-Hig-Designer/blob/main/SKILL.md) | HIG 前端 Skill | iOS 字号阶梯全表、明暗双模式色板、8pt 网格、动效曲线 |
| 5 | [design-spec.vercel.app](https://design-spec.vercel.app/) | 规范聚合站 | 74+ 品牌的开源 DESIGN.md（Apple/Stripe/Linear/Vercel…） |
| 6 | [fchangjun/awesome-design-md-cn · apple](https://fchangjun.github.io/awesome-design-md-cn/designs/apple/index.html) | 中文场景版 | Apple 规范的中文产品场景适配版 |
| 7 | [raintree-technology/apple-hig-skills](https://github.com/raintree-technology/apple-hig-skills) | 14 个 HIG skills | 平台/基础/组件/模式全覆盖 |
| 8 | [cmurphy1140/apple-design-system](https://github.com/cmurphy1140/apple-design-system) | Token 设计系统 | 遵循 HIG 的 token 化 UI 系统 |
| 9 | [designmd.run/design/apple.com](https://www.designmd.run/design/apple.com) | 规范页 | 8 色 + headline/body 字阶的结构化展示 |
| 10 | [drugnotes/apple-hig-ios-skill](https://github.com/drugnotes/apple-hig-ios-skill) | HIG 速查 | 布局/字体/颜色/材质速查 |

---

## 二、复刻类仓库（读源码学实现，按技术栈分类）

### 纯 HTML/CSS（最适合对照布局思路）
| # | 仓库 | 说明 |
|---|------|------|
| 11 | [iamreiyn/apple-website-clone](https://github.com/iamreiyn/apple-website-clone) | 最新版 Apple 官网复刻，纯 HTML/CSS |
| 12 | [Shruti627/Apple-clone](https://github.com/Shruti627/Apple-clone) | 前端纯静态复刻 |
| 13 | [jiteshsatija/Apple-homepage-Clone](https://github.com/jiteshsatija/Apple-homepage-Clone) | 首页结构复刻 |
| 14 | [YLDJack/AppleCSS](https://github.com/YLDJack/AppleCSS) | **中文**仿 apple.com.cn 纯 CSS，含配色方案分析文档 |
| 15 | [ulkumezgiakbas/appleish](https://github.com/ulkumezgiakbas/appleish) | 极简 Apple 风 landing（vanilla + Flask） |
| 16 | [0prii0/Apple-Landing-Page](https://github.com/0prii0/Apple-Landing-Page) | HTML5/CSS3 landing |
| 17 | [KrAzad0/apple-style-portfolio](https://github.com/KrAzad0/apple-style-portfolio) | Apple 极简风格作品集 |
| 18 | [ANDYTAN66/apple-clone2](https://github.com/ANDYTAN66/apple-clone2) | 复刻练习 |

### Tailwind / React 工程（学响应式与组件组织）
| # | 仓库 | 说明 |
|---|------|------|
| 19 | [ChamathDilshanC/Apple-Web-Clone](https://github.com/ChamathDilshanC/Apple-Web-Clone) | React + Vite + Tailwind，pixel-perfect 组件 |
| 20 | [tcintern-020/Apple-Clone](https://github.com/tcintern-020/Apple-Clone) | 响应式首页布局复刻 |
| 21 | [Rupa-themeteor/apple-clone](https://github.com/Rupa-themeteor/apple-clone) | HTML + Tailwind + JS |
| 22 | [AtulSahu778/apple-clone](https://github.com/AtulSahu778/apple-clone) | React + Vite + Tailwind + Three.js + GSAP |
| 23 | [RamonvCS/AppleWeb_Page_Clone](https://github.com/RamonvCS/AppleWeb_Page_Clone) | Tailwind 响应式实践 |
| 24 | [larry-xue/apple-style-portfolio](https://github.com/larry-xue/apple-style-portfolio) | **Astro + Tailwind + GSAP + Three.js**，附[设计讲解博客](https://larryxue.dev/blog/posts/apple-style-portfolio/)（中英双语） |
| 25 | [Apple-Inspired Portfolio @ Astro Themes](https://astro.build/themes/details/apple-inspired-portfolio/) | Astro 主题市场收录 |
| 26 | [rhythm1950/Apple-Landing-Page](https://github.com/rhythm1950/Apple-Landing-Page) | React + Bootstrap |
| 27 | [Progate Bootcamp 团队复刻](https://github.com/topics/apple-clone) | 3 天团队项目（topics 页含大量同类） |

### 3D 产品页 / 滚动动效类（学高级动效）
| # | 仓库 | 说明 |
|---|------|------|
| 28 | [aarxnmendez/macbookpro-3d-landing](https://github.com/aarxnmendez/macbookpro-3d-landing) | MacBook Pro M4 页复刻，GSAP + Three.js |
| 29 | [bhanu2006-24/Macbook_Landing](https://github.com/bhanu2006-24/Macbook_Landing) | 交互式 3D 笔记本 + 滚动动画 |
| 30 | [delafuentej/r3f_landing-page-macbook](https://github.com/delafuentej/r3f_landing-page-macbook) | React-Three-Fiber 实现（JavaScript Mastery 教程系） |
| 31 | [vanshgoel2004/Macbook-app](https://github.com/vanshgoel2004/Macbook-app) | 滚动驱动 3D 查看器 |
| 32 | [Itssanthoshhere/Macbook-Landing-Page](https://github.com/Itssanthoshhere/Macbook-Landing-Page) | React + GSAP + Three.js 高完成度 |
| 33 | [mananmmaisheri/MacBook-Landing-Page-](https://github.com/mananmmaisheri/MacBook-Landing-Page-) | GSAP 电影感滚动 |
| 34 | [Dhruwang/AppleWatchAnimation](https://github.com/Dhruwang/AppleWatchAnimation) | Apple Watch Ultra 页动画 |
| 35 | [platformsbuilder/apple-watch-landing-2026](https://github.com/platformsbuilder/apple-watch-landing-2026) | vanilla HTML/CSS/JS 落地页 |
| 36 | [anushkachauhxn/airpods-pro-website](https://github.com/topics/airpodspro) | AirPods Pro 页复刻，GSAP + ScrollMagic |
| 37 | [AirPods 滚动视频技术解析（CSDN）](https://blog.csdn.net/LuckyWinty/article/details/132033446) | `requestAnimationFrame` 驱动 `video.currentTime` 的原理解析 |

### 栅格 / 展示组件类
| # | 资源 | 说明 |
|---|------|------|
| 38 | [NxProxyStudios/apple-bento-grid](https://github.com/NxProxyStudios/apple-bento-grid) | Apple 发布会式 bento 栅格卡 |
| 39 | [hubeiqiao/apple-bento-grid](https://github.com/hubeiqiao/apple-bento-grid) | 同类 AI agent skill |
| 40 | [CSSLabz · Bento Grids](https://www.csslabz.com/ui-library/bento-grids) | 生产级 CSS/Tailwind bento 代码 |
| 41 | [CodeFronts · Bento Layouts](https://codefronts.com/layouts/css-bento-grid-layouts/) | 6 套 keynote 式响应式布局 |
| 42 | [Flocci · Keynote Bento Template](https://bento.flocci.in/templates/keynote) | 12 列画布上的 10 宫格 keynote 模板 |

### 设计评论 / 历史演变（理解"为什么"）
| # | 资源 | 说明 |
|---|------|------|
| 43 | [Webflow · Apple Homepage History](https://webflow.com/blog/apple-homepage-history) | Apple 首页 20 年演变分析 |
| 44 | [10.5K★ Apple 风格 Skill（Emil Kowalski 系）报道](https://www.toutiao.com/article/7663040728657920558/) | 蒸馏 Apple 设计细节（含动画）的开源 Skill |
| 45 | [Swyrer/presentation-chef](https://github.com/Swyrer/presentation-chef) | Keynote 风 HTML 演示生成器 |
| 46 | [CSSDevices](https://cssdevices.com/) | 纯 CSS Apple 设备库（产品展示位参考） |
| 47 | [apple-design：WWDC 设计精华 Skill（腾讯云报道）](https://cloud.tencent.com/developer/article/2708672) | WWDC 设计语言提炼 |
| 48 | [CSDN · 苹果风格网页模板 HTML 源码](https://blog.csdn.net/weixin_31591833/article/details/151351666) | 快速起步模板 |
| 49 | [CSDN · Apple 中国官网全量静态复刻复盘](https://blog.csdn.net/2603_95532426/article/details/160522747) | 无框架复刻的工程复盘 |
| 50 | [JackYu · 仿 Apple 官网 CSS 样式实现](https://yldjack.github.io/%E4%BB%BFApple%E5%AE%98%E7%BD%91CSS%E6%A0%B7%E5%BC%8F%E5%AE%9E%E7%8E%B0.html) | 中文博客，逐段分析实现 |

---

## 三、Apple 网页设计规范提炼（综合 4 份规范原文）

### 3.1 布局与栅格

| 规则 | 数值/做法 |
|------|-----------|
| 内容容器 | **980–1068px 封顶**（密集内容 980，营销版式 1068）；1441px+ 宽屏「增加留白，栅格保持 max-width」 |
| 区块节奏 | **以背景色交替划分区块**（黑 → #f5f5f7 → 白），"电影场景间的停顿"；每个区块接近整屏高度 |
| 栅格间距 | 固定 **24px** |
| 分区方式 | 靠底色对比与留白，**无可见网格线、无边框** |
| 文本对齐 | **正文永不居中**（仅标题可居中/居左） |
| 宽屏策略 | 内容列不加宽，只增加四周留白 |

### 3.2 字号层级（Apple 生产实测）

| 角色 | 字号 | 字重 | 行高 | 字距 |
|------|------|------|------|------|
| Display Hero | 56px | 600 | **1.07** | -0.28px |
| 区块标题 | 40px | 600 | 1.10 | normal |
| 产品块标题 | 28px | 400 | 1.14 | +0.196px |
| 卡片标题 | 21px | 700 / 400 | 1.19 | +0.231px |
| **正文** | **17px** | 400 | **1.47** | -0.374px |
| 次要描述 | 14px | 400 | 1.43 | -0.224px |
| 脚注（下限） | 12px | 400 | 1.33 | -0.12px |

规则：**所有字号施加负字距**；字重范围 300–700（禁用 800/900，英文语境）；标题行高 1.07–1.14，正文 1.47。

### 3.3 中文站专属规则（chaos-xxl skill 标注 CRITICAL）

| 项 | 英文 | **中文（zh-CN）** |
|----|------|------------------|
| h1 字重 | 600–700 | **900**（PingFang 无 900 时浏览器取最重可用档） |
| h2 字重 | 600 | **800** |
| h3 字重 | 700 | **700** |
| 标题字间距 | -0.015em | **+0.04em**（放宽提升 CJK 可读性） |
| 标题行高 | 1.05–1.15 | 1.05–1.15（同） |
| 正文字重 | 400–500 | 400–500（不分语言） |

> 原因：CJK 字体在 600–700 字重视觉上明显偏细，Apple 中文官网用加重字重补偿。

### 3.4 颜色

| 用途 | 色值 |
|------|------|
| 页面底 | **#f5f5f7**（微蓝灰调浅灰）与白色交替 |
| 深色区块 / Hero | **#000000** 纯黑 |
| 主文字 | **#1d1d1f**（近黑） |
| 次要文字 | rgba(0,0,0,0.8)；三级 rgba(0,0,0,0.48) |
| **唯一强调色** | Apple Blue **#0071e3**（仅用于可交互元素）；链接 #0066cc / 深底 #2997ff |
| 禁止 | 第二强调色、背景纹理/图案/渐变（**纯色 only**） |

### 3.5 卡片与组件

| 规则 | 数值/做法 |
|------|-----------|
| 卡片背景 | #f5f5f7（浅）或 #272729–#2a2a2d（深） |
| **边框** | **无**（几乎不使用可见边框，靠底色对比分层） |
| 卡片阴影 | 全站唯一：`rgba(0,0,0,0.22) 3px 5px 30px 0px`（柔和宽模糊）；其余无阴影 |
| **hover** | 卡片**无 hover 态**，静态呈现，仅内部链接可交互 |
| 圆角 | 5px（小）/ 8px（按钮·产品卡）/ 11px（搜索）/ 12px（面板）/**矩形 ≤12px**；980px 仅限药丸链接 |
| 按钮 | padding **8px 15px**、圆角 8px、主色 #0071e3、文字 17px/400、无阴影；focus = 2px #0071e3 外框 |
| 导航 | 半透明玻璃 `rgba(0,0,0,0.8)` + `saturate(180%) blur(20px)`、高 44–48px、**不可做成不透明** |
| 触控目标 | ≥44×44px |
| 产品图 | 纯色底上呈现，任何断点不裁剪只缩放 |

### 3.6 动效

- 无系统级动效规范；仅有的动效：媒体控件 `scale(0.9)` 按压、按钮 hover 背景变亮、链接 hover 下划线
- **整体动效极度克制**——Apple 风格的"高级感"主要来自排版与留白，而非动画
- HIG skill 给出的通用曲线（iOS 语境）：`cubic-bezier(0.25,0.1,0.25,1)`、时长 100–500ms、按压 `scale(0.97)`

---

## 四、本站差距分析（对照规范逐项）

| 项 | Apple 规范 | 本站现状 | 差距 |
|----|-----------|---------|------|
| 容器 | 980–1068px | 92vw ≤1760px（已按用户要求加宽） | ✔ 已按用户偏好调整（Apple 文章页用 980-1068，Store 页用宽幅，两种模式并存） |
| 背景 | 纯色交替（黑/灰/白） | #f5f5f7 单一平底 | ⚠️ 可引入白/灰交替增强区块节奏 |
| 卡片 | **无边框**，#f5f5f7 底或白底对比 | 白卡 + 1px 边框 rgba(0,0,0,0.08) | ⚠️ 建议去边框 |
| 卡片 hover | **无 hover 态** | translateY(-2px) 浮起 | ⚠️ 建议移除浮起（保留内部链接交互） |
| 圆角 | 矩形 ≤12px | 卡片 18px | ⚠️ 建议 12px |
| h1 字重（中文） | 900 | 700 | ⚠️ 建议 800–900 |
| h2 字重（中文） | 800 | 700 | ⚠️ 建议 700–800 |
| 中文标题字距 | **+0.04em** | -0.01em（负字距，对中文是错的） | ⚠️ 建议改 0~+0.04em |
| 正文字号 | 17px/1.47 | 16px/1.7 | ✔ 接近（中文行高略放宽数值合理） |
| 区块留白 | 128px | clamp 至 128px | ✔ 已对齐 |
| 栅格间距 | 24px 固定 | 1.5rem 固定 | ✔ 已对齐 |
| 按钮 | 8px 15px、8px 圆角、#0071e3 | 胶囊、品牌 teal | ✔ 形态符合现代 Apple 商店页；品牌色保留 |
| 唯一强调色 | 蓝色只给交互 | teal 品牌色贯穿 | ✔ 品牌决策（保留 teal，不引入蓝） |

---

## 五、建议落地清单（按影响排序，待用户确认后实施）

1. **中文标题字重与字距**：h1 → font-weight 800；h2 → 700–800；中文标题 letter-spacing → 0 ~ +0.04em（当前负字距对 CJK 是反模式）
2. **卡片去边框**：白卡靠与 #f5f5f7 底的对比分层（Apple 无边框）
3. **卡片圆角 18 → 12px**（规范上限）
4. **移除卡片 hover 浮起**（Apple 卡片静态）
5. **区块背景交替**（白 ↔ #f5f5f7）形成节奏——需逐章节指定
6. 品牌色决策：保留 teal（品牌延续）或换 Apple Blue #0071e3（完全 Apple 化）——建议保留 teal

---

## 六、快速上手路径

- 只想抄参数：直接读 [iFurySt/DESIGN.md apple](https://github.com/iFurySt/DESIGN.md/tree/main/design-md/apple) 第 2、5 节
- 想看完整实现：[ChamathDilshanC/Apple-Web-Clone](https://github.com/ChamathDilshanC/Apple-Web-Clone)（React 工程）或 [iamreiyn/apple-website-clone](https://github.com/iamreiyn/apple-website-clone)（纯静态）
- 想要中文站规则：[chaos-xxl/apple-design-skill](https://github.com/chaos-xxl/apple-design-skill) 的 typography.md（CJK 字重/字距 CRITICAL 段）
- 想学产品页动效：[JavaScript Mastery 系 MacBook 教程](https://github.com/delafuentej/r3f_landing-page-macbook)（React-Three-Fiber + GSAP）
