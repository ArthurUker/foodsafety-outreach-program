# 校园食安卫士 · 推广方案站

> 面向校园食品安全治理的「检·教·治」一体化推广方案展示站（全栈版）。
>
> 本文档为系统级总览。长期开发规范见 [`docs/PROJECT_CONVENTIONS.md`](docs/PROJECT_CONVENTIONS.md)（优先级最高），
> 架构决策见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，开发细节见 [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)，
> 变更记录见 [`docs/CHANGELOG.md`](docs/CHANGELOG.md)。
>
> 最近一次代码审阅基线：**2026-09-08**。当前可正常构建和渲染，但仍有若干上线前应处理的安全、迁移与测试缺口，见第 10 节。

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
| 部署 | 手动拷贝文件 | `deploy/deploy.sh` 一键部署（Caddy 自动 HTTPS + systemd，支持整套落数据盘） |
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
| 后端运行时 | Node.js ≥20.19、Express 5（ESM） | 入口 `backend/server.js`，默认监听 `127.0.0.1`，端口经 `PORT` 配置 |
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
│   ├── dev-server.js           # 本地静态预览（零依赖）
│   └── smoke-render.mjs        # 章节渲染冒烟测试（npm run smoke）
├── deploy/
│   ├── deploy.sh               # 一键部署（通用脚本，内置环境自适应与预检）
│   ├── deploy.example.conf     # 部署适配文件样例（复制后按服务器实际修改）
│   └── deploy.tencent-cvm.conf # 腾讯云 CVM 生产适配（子域名 HTTPS + 整套落数据盘）
├── docs/                       # 项目文档
└── legacy/                     # v1.0 遗留文件（仅供参考，不参与运行）
```

---

## 4. 快速开始

### 4.1 纯静态预览（不启动后端）

```bash
npm run serve
# 打开 http://localhost:4173
```

此模式下前端自动回落到 `data/content.seed.json` 渲染。咨询信息**不会保存到浏览器，也不能提交到后台**，界面会明确提示稍后重试；正式收集姓名、手机、邮箱等个人信息时必须启用后端，并补充隐私告知、保存期限与删除机制。

### 4.2 完整本地开发

**前置**：已安装并启动 PostgreSQL，创建好数据库（如 `foodsafety_outreach`）。

```bash
# 1) 安装锁文件指定的依赖（根依赖用于 smoke，后端依赖用于 API）
npm ci
npm --prefix backend ci

# 2) 配置后端环境变量
cp .env.example backend/.env
# 编辑 backend/.env，至少填写：
# DATABASE_URL、JWT_SECRET、SEED_ADMIN_PASSWORD
openssl rand -base64 48     # 生成 JWT_SECRET
openssl rand -base64 18     # 生成首次管理员密码

# 3) 初始化数据库
npm run db:generate
npm run db:push
npm run seed                # 创建管理员并导入章节内容

# 4) 启动后端（同源托管静态资源）
npm run dev                 # http://localhost:3000
```

`SEED_ADMIN_PASSWORD` 为空时，种子脚本会跳过管理员创建；初始化后请立即登录并修改该密码。生产环境应使用 `npm ci`，避免安装结果偏离 lockfile。

后端默认 `SERVE_STATIC=true`，同源托管仓库根目录，无需另起静态服务器。
访问：前台 `http://localhost:3000/`，后台 `http://localhost:3000/admin.html`。

### 4.3 常用命令

```bash
npm run build          # 构建 dist/
npm run serve          # 本地静态预览
npm run smoke          # 章节渲染冒烟（改动渲染器后必跑，防白屏）
npm run db:push        # 同步表结构（仅开发/当前首次部署过渡使用）
npm run db:deploy      # 应用已提交的 Prisma migrations
npm --prefix backend run db:migrate # 生成并应用开发迁移
npm run seed           # 导入种子（管理员 + 内容）
npm run seed:content   # 仅重新导入章节内容
npm run dingtalk:test  # 发送钉钉机器人测试消息（会真实外发）
npm audit
npm --prefix backend audit
```

> 仓库已提交 Prisma 初始迁移。新版部署脚本会为旧版 `db push` 数据库登记一次基线，再执行 `migrate deploy` 和 schema drift 校验；迁移失败时不会自动回退到 `db push`。

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

基础路径 `/api`，生产由 Caddy 同域反代到只监听本机的 `127.0.0.1:3100`。受保护接口需 `Authorization: Bearer <JWT>`。

### 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health`、`/api/health` | 健康检查 |
| GET | `/ready`、`/api/ready` | 就绪检查（PostgreSQL + 内容初始化） |
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

### 7.1 通用流程（任意服务器）

```bash
cp deploy/deploy.example.conf deploy/deploy.conf
# 按实际服务器参数修改 deploy/deploy.conf（系统名 / 端口 / 域名 / 数据库 / 数据盘）
sudo bash deploy/deploy.sh deploy/deploy.conf
```

脚本为「通用流程 + 适配文件」解耦设计，内置环境自适应与 fail-fast 预检：

- Node / PostgreSQL / Caddy **缺啥装啥、已装则复用**（支持 Ubuntu 22.04 全新环境）
- **域名模式**（`DOMAIN` 非空）：Caddy 自动申请 Let's Encrypt 证书，`CORS_ORIGIN` 自动生成 `https://<DOMAIN>`
- **数据盘模式**（`DATA_ROOT` 非空）：代码、日志、独立 PG 表空间全部落数据盘；`findmnt` 校验挂载，自动写入 AppArmor 放行规则
- **部署前预检**：API/前端端口占用、域名与既有站点冲突、数据盘挂载状态，重复部署自动识别放行自身

Express 默认只监听 `127.0.0.1`，API 端口不直接暴露公网；主机防火墙与云安全组仍应作为第二道边界，只开放 80/443 和必要的运维端口。

### 7.2 生产实例（腾讯云 CVM · 111.231.166.161）

```bash
git clone git@github.com:ArthurUker/foodsafety-outreach-program.git /tmp/fsop-deploy
cd /tmp/fsop-deploy
sudo bash deploy/deploy.sh deploy/deploy.tencent-cvm.conf
```

适配要点（详见 `deploy/deploy.tencent-cvm.conf` 内注释）：

| 项 | 值 |
| --- | --- |
| 域名 | `foodsafety.digifluidic.com`（DNS A 记录 → 111.231.166.161，Caddy 自动 HTTPS） |
| 整套落盘 | `/mnt/datadisk0/foodsafety-outreach`（代码 + dist）、`/mnt/datadisk0/logs/foodsafety-outreach`（日志）、`/mnt/datadisk0/pg/foodsafety-outreach`（独立表空间），**系统盘零增量** |
| 后端端口 | `127.0.0.1:3100`（仅本机监听，由 Caddy 反代） |
| 数据库 | 独立库 `foodsafety_outreach` + 角色 `foodsafety`，复用同机已有 PostgreSQL 14 实例，不影响其它业务 |
| 初始管理员 | `admin`，密码在**首次部署**结束时输出一次，登录后台后立即修改 |

部署后拓扑：

```text
浏览器 → Caddy(:80/:443, 自动 HTTPS) ─┬─ 静态托管 dist/
                                      └─ 反代 /api/* → Express(127.0.0.1:3100) → PostgreSQL 14（表空间在数据盘）
```

### 7.3 运维命令

```bash
systemctl status foodsafety-outreach-api       # 后端状态
journalctl -u foodsafety-outreach-api -n 50    # 近期日志
ls /mnt/datadisk0/logs/foodsafety-outreach     # 落盘日志（app.out.log / app.err.log）
systemctl reload caddy                         # 重载反代配置
curl http://127.0.0.1:3100/health              # 存活检查
curl http://127.0.0.1:3100/ready               # 就绪检查（部署验证使用）
```

⚠️ **改完源码必须同步到线上**（生产 Caddy 只 serve `dist/`，不读源码），在服务器仓库目录（`/mnt/datadisk0/foodsafety-outreach`）执行：

```bash
git pull && node scripts/build-static.js      # 前端：重建 dist/ 即时生效
systemctl restart foodsafety-outreach-api     # 后端：重启服务
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
- **登录保护**：统一失败文案 + 假 bcrypt 比较拉平时序（防用户名枚举与侧信道）；同一 IP + 用户名 5 次失败/15 分钟临时锁定，避免单一来源锁死全局账号。
- **令牌吊销**：改密与全量吊销在同一事务中完成，单令牌吊销失败会使接口失败，不再伪装成功；全量吊销记录不会过期后让旧 JWT 复活。
- **输入安全**：XSS / SQL 注入特征检测、原型链污染键剔除、JSON 深度与体积上限、链接协议白名单、CSV 公式注入防护。
- **审计留痕**：登录、内容变更、留言处理、改密等由服务端强制写入，不信任客户端上报。
- **单实例假设**：限流计数存进程内存，水平扩容前须迁移到 Redis（与参考系统同款约束）。
- **健康检查边界**：`/health` 只检查进程存活，`/ready` 检查 PostgreSQL 和站点内容初始化；钉钉通知仍是非阻断旁路。

详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 第 6 节。

---

## 10. 代码审阅结论与升级路线

### 10.1 本次验证结果（2026-09-08）

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npm run smoke` | 通过 | 12 项通过、0 项失败；覆盖 8 个章节、基础 XSS、隐私迁移、玻璃结构和空 payload |
| `npm run build` | 通过 | `dist/` 成功生成，HTML 内联滤镜与必需 CSS 校验通过 |
| JS / Shell / JSON 语法 | 通过 | 全部 JS 执行 `node --check`、部署脚本执行 `bash -n`、核心 JSON 可解析 |
| 根依赖 `npm audit` | 通过 | 0 个已知漏洞 |
| 后端依赖 `npm audit` | 通过 | Express 5 升级后为 0 个已知漏洞 |
| `npm test` | 通过 | 12 项前端冒烟 + 10 项后端安全/异常链测试 |
| `npm run lint` | 通过 | ESLint 已配置并覆盖 `backend/`、`js/`、`scripts/` |
| 本地 PostgreSQL 实库演练 | 通过 | 空库迁移、旧 `db push` 库补基线、drift 检查、seed、`/ready`、强制改密和旧令牌失效均通过 |
| GitHub Actions | 已配置 | CI 执行安装、Lint、构建、测试和两级依赖审计 |

### 10.2 已完成修复

| 原问题 | 修复结果 |
| --- | --- |
| API 监听所有网卡、直接读取 `X-Forwarded-For` | 默认 `HOST=127.0.0.1`，真实 IP 统一使用 Express 的可信代理解析；生产误设 `SERVE_STATIC=true` 会拒绝启动 |
| Express 4 / `qs` 中危漏洞及 async 错误链 | 升级到 Express 5.2.1，bcryptjs / dotenv 同步升级；async rejection 由统一错误处理器接管，bcrypt 比较改为异步避免阻塞事件循环，依赖审计清零 |
| Prisma 无迁移历史、生产回退 `db push` | 增加初始 migration；部署脚本兼容旧库基线、强制 `migrate deploy` 与 drift 检查，失败不再回退 |
| 改密/登出吊销失败仍返回成功 | 吊销错误向上传播；密码更新和全量吊销进入同一事务；全量吊销标记不会过期后使旧 JWT 复活；首次改密限制由服务端强制执行 |
| 健康检查不能发现数据库故障 | 保留 `/health` 存活检查，新增 `/ready` 检查 PostgreSQL 与内容初始化，部署验证改用 `/ready` |
| 静态模式和审计日志保存个人信息 | 前端不再把咨询内容写入 `localStorage`，并清理旧版遗留键；新审计不再记录姓名/手机。历史审计按“不得修改/删除”规范保留，需由业务方确定合规归档策略 |
| editor 看得到 owner 操作 | 后台按角色隐藏恢复、删除、导出和审计入口，后端权限校验继续保留 |
| 非法 URL hash 可破坏页面初始化 | 改为安全解码后按 ID 查找，非法编码直接忽略 |
| 缺少质量门禁 | 增加 ESLint、10 项后端测试、统一 `npm run check` 和 GitHub Actions CI |

### 10.3 仍需在部署环境完成

| 优先级 | 事项 | 说明 |
| --- | --- | --- |
| P0 · 部署前 | 备份并演练旧库迁移基线 | 本地没有生产 PostgreSQL 数据，无法替代真实备份和预发布演练。首次使用新版部署脚本前先 `pg_dump`，在副本上验证 baseline、`migrate deploy` 和 `/ready`。 |
| P1 · 隐私 | 确定个人信息保留政策 | 代码已停止浏览器持久化和审计 PII，但数据库中的咨询记录仍需要业务方确定告知文本、保存期限、删除/匿名化流程和访问责任人。 |
| P1 · 扩容 | 将限流迁移到共享存储 | 当前限流仍在进程内存中，只支持单实例。接入 Redis 等共享存储后才能水平扩容。 |
| P2 · 升级 | Prisma 5 单独升级 | ESLint 已升级到 10；Prisma 7 仍涉及配置方式和数据库适配器变化，应在数据库集成测试补齐后单独升级。 |
| P2 · 测试 | 增加真实 PostgreSQL 与浏览器 E2E | 当前后端测试使用隔离 mock，尚未覆盖真实事务、迁移、Caddy 反代和完整后台操作流程。 |

本地与 CI 的统一验证入口：

```bash
npm ci
npm --prefix backend ci
npm run check
npm audit
npm --prefix backend audit
```

---

## 11. License

本项目用于学术交流、方案汇报与项目展示。正式对外发布前请补充真实业务资料、版权资源说明与隐私政策。
