# 校园食安卫士 · 推广方案站

> 面向校园食品安全治理的「检·教·治」一体化推广方案展示站（全栈版）。
>
> 本文档为系统级总览。长期开发规范见 [`docs/PROJECT_CONVENTIONS.md`](docs/PROJECT_CONVENTIONS.md)（优先级最高），
> 架构决策见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，开发细节见 [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)，
> 变更记录见 [`docs/CHANGELOG.md`](docs/CHANGELOG.md)。

---

## 1. 项目定位

本站用于展示校园食品安全推广方案，服务于**路演、展示、汇报与持续更新**四类场景。

与 v1.0 的纯静态展示页不同，v2.0 是一次**从巨石文件到分层架构**的重构：

| 维度 | v1.0（旧） | v2.0（当前） |
| --- | --- | --- |
| 形态 | 单文件静态页（`index.html` + `style.css` + `script.js`） | Express + PostgreSQL 全栈应用 |
| 内容 | 文案硬编码在 HTML 中 | 内容落库，后台可编辑，改文案无需改码 |
| 前端 | 全局脚本、多段补丁式 IIFE | 原生 ES Module 分层，章节注册中心数据驱动渲染 |
| 表单 | 纯前端演示，不落库 | 提交落库，后台可处理、可导出 |
| 部署 | 手动拷贝文件 | `deploy/deploy.sh` 一键部署（Caddy + systemd） |
| 安全 | 无 | JWT + 令牌吊销、限流、锁定、审计日志、输入净化 |

### 方案叙事主线

重构后的信息架构围绕一条主线展开：

> **"把一次成功的校园食安实践，推广成一片区域的治理能力"**

| # | 章节 | 回答的问题 |
| --- | --- | --- |
| 1 | 首屏 Hero | 这是什么方案，核心价值是什么 |
| 2 | 建设背景 | 为什么需要（政策要求 vs 现实差距） |
| 3 | 方案总览 | 方案长什么样（1+3+N 框架 + 能力映射） |
| 4 | 核心能力 | 具体有什么能力，建设到什么程度 |
| 5 | 技术架构 | 能力靠什么技术实现（五层架构） |
| 6 | 落地实证 | 凭什么相信（真实数据 + 实施阶段） |
| 7 | 推广路线 | 怎么复制推广，分几步 |
| 8 | 联系我们 | 如何接洽 |

其中**第 3 章的「已验证能力 → 推广方案映射表」**是全站说服力的核心：公开标注每项能力是"已上线 / 建设中 / 规划中"，
明确区分**已在试点校运行的系统能力**与**方案新增建设内容**。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 后端运行时 | Node.js 20、Express 4（ESM） | 入口 `backend/server.js`，仅监听 `127.0.0.1` |
| ORM / 数据库 | Prisma 5 + PostgreSQL | `backend/prisma/schema.prisma` |
| 认证 | jsonwebtoken 9 + bcryptjs 2 | 无状态 JWT + 令牌吊销表，bcrypt 存储 |
| 前端 | 原生 ES Module（无打包器） | 浏览器直载，`js/**` 分层 |
| 样式 | 原生 CSS + 设计令牌 + 玻璃化 | `css/tokens.css` 为唯一变量来源，`css/glass.css` 为玻璃材质层 |
| 构建 | `scripts/build-static.js` | 纯拷贝生成 `dist/`（无转译、无打包） |
| 反向代理 | Caddy 2 | 静态托管 `dist/` + 同域反代 `/api/*` |
| 进程管理 | systemd | 崩溃自动重启、内存上限 |

开发/测试/生产**统一使用 PostgreSQL**（本地不再使用 SQLite，避免行为差异）。

---

## 3. 目录结构

```text
foodsafety-outreach-program/
├── index.html                  # 前台入口（外壳，章节由 JS 渲染）
├── admin.html                  # 内容管理后台入口
├── package.json                # 根依赖与脚本
├── data/
│   └── content.seed.json       # ★ 章节内容种子（静态兜底 + 首次导入源）
├── backend/
│   ├── server.js               # 后端入口：启动守卫、中间件、路由挂载
│   ├── prisma/
│   │   ├── schema.prisma       # 数据模型
│   │   ├── seed.js             # 管理员 + 内容导入
│   │   └── seed-content.js     # 仅导入内容
│   ├── lib/                    # 核心库：authService / contentStore / validation /
│   │                           #   securityGuards / auditLog
│   ├── middleware/             # authMiddleware / validationMiddleware / errorHandler
│   └── routes/                 # auth / content / inquiries / audit-logs / settings
├── js/
│   ├── main.js                 # 前台引导入口
│   ├── core/                   # dom / api / router / reveal（与业务无关）
│   ├── data/contentRepository.js  # ★ 内容读取（API 优先，种子兜底）
│   ├── modules/
│   │   ├── registry.js         # ★ 章节注册中心（单一事实来源）
│   │   └── inquiryForm.js      # 咨询表单交互
│   ├── sections/               # 8 个章节渲染器（纯函数：payload → HTMLElement）
│   └── admin/app.js            # 后台控制台
├── css/                        # tokens / glass / base / layout / components / sections / admin
├── scripts/
│   ├── build-static.js         # 构建 dist/
│   └── dev-server.js           # 本地静态预览（零依赖）
├── deploy/
│   ├── deploy.sh               # 一键部署
│   └── deploy.example.conf     # 部署适配文件样例
├── docs/                       # 项目文档
└── legacy/                     # v1.0 遗留文件（仅供参考，不参与运行）
```

---

## 4. 快速开始

### 4.1 纯静态预览（不启动后端）

```bash
node scripts/dev-server.js 4173
# 打开 http://localhost:4173
```

此模式下前端自动回落到 `data/content.seed.json` 渲染，咨询提交会暂存在浏览器本地（不丢数据）。

### 4.2 完整本地开发

**前置**：已安装并启动 PostgreSQL，创建好数据库（如 `foodsafety_outreach`）。

```bash
# 1) 配置后端环境变量
cp .env.example backend/.env
# 编辑 backend/.env：填写 DATABASE_URL、生成 JWT_SECRET
openssl rand -base64 48     # 用于 JWT_SECRET

# 2) 安装依赖与初始化数据库
npm --prefix backend install
npm run db:generate
npm run db:push
npm run seed                # 建管理员 + 导入章节内容

# 3) 启动后端（同源托管静态资源）
npm run dev                 # http://localhost:3000
```

后端默认 `SERVE_STATIC=true`，同源托管仓库根目录，无需另起静态服务器。
访问：前台 `http://localhost:3000/`，后台 `http://localhost:3000/admin.html`。

### 4.3 常用命令

```bash
npm run build          # 构建 dist/
npm run serve          # 本地静态预览
npm run smoke          # 章节渲染冒烟（改动渲染器后必跑，防白屏）
npm run db:push        # 同步表结构（开发）
npm run db:deploy      # 应用迁移（生产）
npm run seed           # 导入种子（管理员 + 内容）
npm run seed:content   # 仅重新导入章节内容
```

---

## 5. 数据模型

| 模型 | 用途 | 关键字段 |
| --- | --- | --- |
| `AdminUser` | 后台管理员 | `username`(UK)、`passwordHash`、`role`(owner/editor)、`status`、`mustChangePassword` |
| `ContentSection` | 章节内容 | `key`(UK)、`title`、`subtitle`、`payload`(Json)、`sortOrder` |
| `Inquiry` | 咨询留言 | `name` / `phone` / `email` / `org` / `message`、`status`(new/processing/closed) |
| `AuditLog` | 审计日志 | `actorId`、`action`、`resourceType/Id`、`details`(Json)、`ip` |
| `RevokedToken` | 令牌吊销 | `jti`(UK)、`userId`、`expiresAt` |
| `SiteSetting` | 站点配置 | `key`(UK)、`value`(Json) |

> 审计日志**不得物理删除**（见 `docs/PROJECT_CONVENTIONS.md` 规则一），API 层未提供删除端点。

---

## 6. API 概览

基础路径 `/api`，生产由 Caddy 同域反代到 `127.0.0.1:3000`。受保护接口需 `Authorization: Bearer <JWT>`。

### 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health`、`/api/health` | 健康检查 |
| GET | `/api/content` | 全部章节内容 |
| GET | `/api/content/:key` | 单个章节内容 |
| GET | `/api/content/meta` | 章节 key 白名单 |
| GET | `/api/settings` | 站点配置（SEO / 联系信息 / 页脚） |
| POST | `/api/inquiries` | 提交咨询（限流 3 条/10 分钟/IP） |
| POST | `/api/auth/login` | 后台登录（限流 + 失败锁定） |

### 登录后接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/auth/me` | 登录 | 当前用户（角色以 DB 为准） |
| POST | `/api/auth/logout` | 登录 | 登出并吊销当前令牌 |
| POST | `/api/auth/change-password` | 登录 | 改密（成功后吊销全部会话） |
| PUT | `/api/content/:key` | owner/editor | 更新章节内容（服务端校验） |
| POST | `/api/content/reset` | owner | 恢复章节为种子内容 |
| GET | `/api/inquiries` | 登录 | 留言列表（筛选 + 分页） |
| PATCH | `/api/inquiries/:id` | owner/editor | 更新状态 / 备注 |
| DELETE | `/api/inquiries/:id` | owner | 删除留言 |
| GET | `/api/inquiries/export.csv` | owner | CSV 导出（含公式注入防护） |
| GET | `/api/audit-logs` | owner | 审计日志（筛选 + 分页） |
| GET | `/api/audit-logs/stats/summary` | owner | 审计统计 |
| PUT | `/api/settings/:key` | owner/editor | 更新站点配置 |

---

## 7. 部署

```bash
# 前置：安全组放行 TCP 22 与 FRONTEND_PORT（启用 HTTPS 时再放 443）
cp deploy/deploy.example.conf deploy/deploy.conf
# 按实际服务器参数修改 deploy/deploy.conf
sudo bash deploy/deploy.sh deploy/deploy.conf
```

部署后拓扑：

```
浏览器 → Caddy(:8080) ─┬─ 静态托管 dist/
                       └─ 反代 /api/* → Express(127.0.0.1:3000) → PostgreSQL
```

运维命令：

```bash
systemctl status foodsafety-outreach-api      # 后端状态
journalctl -u foodsafety-outreach-api -f      # 实时日志
systemctl reload caddy                        # 重载反代配置
curl http://127.0.0.1:3000/health             # 健康检查
```

⚠️ **改完前端源码必须重建 `dist/`**（生产 Caddy 只 serve `dist/`，不读源码）：

```bash
node scripts/build-static.js
```

---

## 8. 视觉体系：玻璃化（Glassmorphism）

视觉参考 `Tianjiabing_foodtestlab`，采用五层玻璃结构，实现集中在 `css/glass.css`：

| 层 | 载体 | 作用 |
| --- | --- | --- |
| ① 壁纸层 | `body::before` | 多色极光，是玻璃「折射的对象」——没有它，毛玻璃等于磨砂塑料 |
| ② 外层玻璃 | `.glass` / `.glass-dark` | 半透明底 + `backdrop-filter` + 顶部弧形高光 |
| ③ 内层面板 | `.glass-panel` | 只做半透明，**不加滤镜**（滤镜相乘会糊） |
| ④ 可读性层 | `.glass-table`、表单控件 | 玻璃背景会吃掉细线，表格与输入框需单独提对比度 |
| ⑤ 降级层 | 四重媒体查询 | 减弱透明 / 增强对比 / 减弱动效 / 不支持滤镜 |

折射效果来自 HTML 内联的 SVG 滤镜 `#lg-refraction`（`feTurbulence` + `feDisplacementMap`），
每个页面都需内联，缺失会导致 `backdrop-filter` 整条失效（构建脚本已校验）。

三条硬约束详见 `docs/PROJECT_CONVENTIONS.md` 规则十一～十三：
**玻璃不得嵌套**、**新增页面必须内联滤镜**、**深色区块须用遮罩层**。

---

## 9. 安全设计摘要

- **启动守卫**：`JWT_SECRET` 缺失/弱密钥、`CORS_ORIGIN` 含通配符 → 进程拒绝启动。
- **登录保护**：统一失败文案 + 假 bcrypt 比较拉平时序（防用户名枚举与侧信道）；生产 5 次失败/15 分钟临时锁定。
- **令牌吊销**：改密 / 登出即时吊销，降权不等 JWT 自然过期；过期吊销记录每 15 分钟清理。
- **输入安全**：XSS / SQL 注入特征检测、原型链污染键剔除、JSON 深度与体积上限、链接协议白名单、CSV 公式注入防护。
- **审计留痕**：登录、内容变更、留言处理、改密等由服务端强制写入，不信任客户端上报。
- **单实例假设**：限流计数存进程内存，水平扩容前须迁移到 Redis（与参考系统同款约束）。

详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 第 6 节。

---

## 10. License

本项目用于学术交流、方案汇报与项目展示。正式对外发布前请补充真实业务资料、版权资源说明与隐私政策。
