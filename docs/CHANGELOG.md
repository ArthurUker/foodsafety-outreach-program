# 变更日志

本项目所有重要变更记录于此。格式参考 Keep a Changelog。

---

## [2.0.0] - 2026-09-01

方案站全栈化重构。参考 `Tianjiabing_foodtestlab` 的成熟架构模式（分层目录、注册中心驱动、构建脚本、
fail-closed 安全守卫、Caddy + systemd 部署），针对本项目场景做了简化（单站点，不做 schema-per-tenant）。

### 新增

**后端**

- Express 4（ESM）后端：启动守卫、限流、CORS 白名单、安全响应头、统一错误处理
- Prisma + PostgreSQL 数据模型：`AdminUser` / `ContentSection` / `Inquiry` / `AuditLog` / `RevokedToken` / `SiteSetting`
- 章节内容 API（公开读、鉴权写、一键恢复种子），内容写入经服务端结构与安全校验
- 咨询留言 API：提交（限流）、列表、状态变更、删除、CSV 导出（带公式注入防护）
- 认证体系：无状态 JWT + 吊销表（jti 精确吊销 + user_all 全量吊销）、bcrypt 存储、
  登录失败锁定、统一失败文案与时序拉平
- 审计日志：服务端强制写入关键动作，仅查询无删除端点
- 种子脚本：`seed.js`（管理员 + 内容）、`seed-content.js`（仅内容）

**前端**

- 原生 ES Module 分层：`core`（dom/api/router/reveal）、`data`（contentRepository）、
  `modules`（registry/inquiryForm）、`sections`（8 个纯函数渲染器）、`admin`
- 章节注册中心 `js/modules/registry.js`：新增章节零改码（导航、渲染顺序自动跟随）
- 内容降级链：`/api/content` → `data/content.seed.json`，保证纯静态部署可用
- 内容管理后台 `admin.html`：章节 JSON 编辑、咨询留言处理、审计日志、账号安全（改密）
- 咨询表单：前端校验 + 提交落库 + 后端不可用时 localStorage 队列兜底

**样式**

- 设计令牌体系 `css/tokens.css`（品牌色、间距、圆角、阴影、动效集中管理）
- 分模块化样式：`base` / `layout` / `components` / `sections` / `admin`
- 视觉重做为卡片化 + 仪表盘化：驾驶舱面板、能力矩阵、五层架构轮播、时间轴、阶段卡

**工程**

- `scripts/build-static.js`：生成 `dist/`（纯拷贝，无打包器）
- `scripts/dev-server.js`：零依赖本地静态预览
- `scripts/smoke-render.mjs` + `npm run smoke`：章节渲染冒烟测试（jsdom），
  校验 8 个章节渲染、XSS 纯文本化、空 payload 容错
- `deploy/deploy.sh` + `deploy/deploy.example.conf`：一键部署（Caddy + systemd + PostgreSQL）
- 文档：`README.md`、`docs/ARCHITECTURE.md`、`docs/PROJECT_CONVENTIONS.md`、`docs/DEVELOPMENT_GUIDE.md`

### 变更

- **信息架构重构**：由「痛点/方案/技术架构/场景/服务/联系」调整为
  「首屏 / 建设背景 / 方案总览（1+3+N 框架 + 能力映射表）/ 核心能力矩阵 /
  技术架构五层 / 落地实证 / 推广路线 / 联系我们」
- **叙事主线调整**：以「把一次成功的校园食安实践，推广成一片区域的治理能力」为主线，
  新增「已验证能力 → 推广方案映射表」，公开标注每项能力的建设状态
- 数据库统一 PostgreSQL（不再使用 SQLite，避免本地与生产行为差异）

### 移除

- `style.css`（2100 行巨石样式，含 3 段重复的 Responsive 补丁块）→ 归档至 `legacy/`
- `script.js`（4 个独立 IIFE 拼凑）→ 归档至 `legacy/`
- `assets/images/*.svg`（新设计改用内联 SVG 与渐变，不再引用）→ 归档至 `legacy/`
- 旧 `docs/README.md`（目录描述与实际不符）→ 归档至 `docs/archive/OLD_README.md`

---

## [1.0.0] - 2026-09-01（归档）

单文件静态展示页：`index.html` + `style.css` + `script.js`。
功能：单页展示、滚动渐显、导航高亮、移动端菜单、方案轮播、技术架构轮播、图片放大弹窗、联系表单前端校验。
相关文件已归档至 `legacy/`，仅供对照，不参与运行。
