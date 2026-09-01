# 架构设计文档

> 记录 v2.0 重构的目标架构、关键决策与决策理由。开发操作细节见 `DEVELOPMENT_GUIDE.md`。

---

## 1. 重构背景

### 1.1 v1.0 的问题

| 问题 | 表现 |
| --- | --- |
| 巨石文件 | `index.html` 826 行、`style.css` 2100 行、`script.js` 361 行，其中 CSS 含 3 段重复的 `Responsive` 补丁块 |
| 内容硬编码 | 改一句文案要在 826 行 HTML 里定位；改完还要重新部署 |
| 无模块系统 | 4 个独立 IIFE 拼凑，靠全局变量与 DOM 查询耦合 |
| 文档失实 | `docs/README.md` 描述 `banners/`、`images/`、`init_foodsafety_project.sh`，实际目录是 `assets/images/` |
| 表单无落点 | "联系我们"是纯前端演示，提交即丢弃 |

### 1.2 重构目标

1. **内容与呈现分离** —— 改文案不动代码
2. **结构可演进** —— 新增章节零改码（注册中心驱动）
3. **能力可扩展** —— 表单落库、后台可管理
4. **部署可复制** —— 一键部署脚本 + 反代 + 进程托管

---

## 2. 目标架构

```
┌──────────────────────────── 浏览器 ────────────────────────────┐
│  index.html（外壳）                                             │
│    └─ js/main.js                                                │
│         ├─ data/contentRepository.js  ← 内容读取（API→种子兜底）│
│         ├─ modules/registry.js        ← 章节注册中心            │
│         ├─ sections/*.js              ← 8 个纯函数渲染器        │
│         └─ core/{dom,api,router,reveal}.js                      │
│  admin.html → js/admin/app.js（登录 / 内容 / 留言 / 审计）      │
└───────────────────────────────┬───────────────────────────────┘
                                │ 同源 /api/*
┌───────────────────────────────▼───────────────────────────────┐
│  Caddy(:8080)  静态托管 dist/   +   反代 /api/*                │
└───────────────────────────────┬───────────────────────────────┘
                                │ 127.0.0.1:3000
┌───────────────────────────────▼───────────────────────────────┐
│  Express（systemd 托管）                                        │
│    限流 → CORS → JSON → 安全头 → routes                        │
│    routes: auth / content / inquiries / audit-logs / settings   │
│    中间件: authMiddleware（JWT + DB 回查 + 吊销检查）           │
│    lib: authService / contentStore / validation / auditLog      │
└───────────────────────────────┬───────────────────────────────┘
                                │ Prisma
                          ┌─────▼─────┐
                          │ PostgreSQL │
                          └───────────┘
```

---

## 3. 关键技术决策

### 3.1 为什么不用打包器

沿用参考系统（foodtestlab）的做法：前端为原生 ES Module，浏览器直载，`scripts/build-static.js` 只做文件拷贝到 `dist/`。

- 收益：零构建复杂度、零依赖漏洞面、改代码即生效（本地）、`dist/` 与源码一一对应便于排查
- 代价：HTTP 请求数较多 —— 本项目模块数量少（< 20 个），代价可忽略

### 3.2 为什么内容落库而不是落 MD / JSON 文件

- 要求"方案内容后台可配置" → 必须可写
- 落库后可做审计（谁在何时改了哪一章）、可做恢复（一键还原种子）
- 同时保留 `data/content.seed.json` 作为**静态兜底**：后端不可用时前端直接读它渲染，
  保证纯静态部署（GitHub Pages / 演示环境）依然可用

### 3.3 为什么降级链是「API → 种子」而不是「种子 → API」

`contentRepository.loadContent()` 默认先请求 API。理由：API 是后台编辑后的权威源，
种子只应在后端不可用时兜底。若反过来，后台改的内容会被静态种子"盖住"，产生"改了没生效"的困惑。

### 3.4 为什么用无状态 JWT + 吊销表，而不是服务端 Session

- 无状态 JWT 免去会话存储，单实例部署下足够
- 但"改密后立即生效"是硬需求，故引入 `RevokedToken` 表：
  - `jti` 精确吊销（单令牌，用于登出）
  - `user_all:<uuid>` + `revokedAt` 语义（按用户全量吊销，用于改密）
- 过期记录每 15 分钟清理，避免表无界增长

### 3.5 为什么单 schema，不做 schema-per-tenant

参考系统 foodtestlab 是 50+ 学校的多租户系统，采用 schema-per-tenant。
**本站是单站点宣传站**，只有一个"租户"，引入多租户隔离是过度设计。
若将来需要多校/多版本方案展示，再按 `schoolCode ?schema=` 模式扩展（模式已在参考系统验证过）。

### 3.6 为什么章渲染器是纯函数

```js
render(payload) → HTMLElement
```

- 无副作用、易测试、易替换
- 章节之间不互相依赖，任一章渲染失败不影响其它章（`main.js` 单章容错）
- 新增章节 = 写一个纯函数 + 注册，无需改动渲染管线

---

## 4. 数据流

### 4.1 前台渲染

```
loadContent()
  ├─ 尝试 GET /api/content        ── 成功 → source='api'
  └─ 失败 → fetch data/content.seed.json ── 成功 → source='seed'
        ↓
getAllSections() 按 SECTION_ORDER 遍历
        ↓
section.render(payload) → appendChild 到 #app
        ↓
renderNav() + initRouter() + initReveal() + initInquiryForm()
```

### 4.2 内容编辑

```
后台 textarea（JSON）
  → 前端 JSON.parse 语法预检
  → PUT /api/content/:key（带 JWT）
  → 服务端 validateSectionPayload() 结构与安全校验
  → 落库 + writeAuditLog('content_update')
  → 前台下次加载即生效（内容接口 no-cache）
```

### 4.3 咨询提交

```
表单前端校验（姓名/手机号/邮箱/内容长度）
  → POST /api/inquiries（限流 3 条/10 分钟/IP）
  → 服务端净化 + 落库 + 审计
  → 后端不可用时：写入 localStorage 队列并提示（不丢数据）
```

---

## 5. 内容模型约定

章节 `payload` 的字段约定（后端按章节做专项形状校验）：

| 章节 | 必需字段 | 说明 |
| --- | --- | --- |
| `hero` | `title`、`metrics[]` | 首屏标题与核心指标 |
| `background` | `points[]` | 痛点卡片 |
| `overview` | `pillars[]` | 三大体系 + `framework` + `mapping` |
| `capability` | `groups[]` | 能力分组（含每项 `status`） |
| `technology` | `layers[]` | 五层架构 |
| `practice` | `metrics[]`、`highlights[]` | 实证数据与成效 |
| `roadmap` | `phases[]` | 推广阶段 |
| `contact` | `channels{}` | 联系渠道 |

通用约束：嵌套 ≤6 层、单字段 ≤200KB、字符串 ≤4000 字符、
`image/imageUrl/href/url` 结尾字段必须是 http(s) 或站内相对路径、`color/accent` 必须是 HEX。

---

## 6. 安全设计

### 6.1 启动期守卫（fail-closed）

| 检查 | 不满足时 |
| --- | --- |
| `JWT_SECRET` 存在且强度足够 | `process.exit(1)` |
| `CORS_ORIGIN` 不含通配符 | `process.exit(1)` |
| seed 时 `SEED_ADMIN_PASSWORD` 存在 | 跳过建号并告警 |

### 6.2 认证

- bcrypt（10 轮）存储；密码强度 ≥8 位且含字母与数字
- 登录失败统一文案；用户不存在时执行一次假 bcrypt 比较拉平响应时序
- 生产 5 次失败 / 15 分钟 → 423 临时锁定（计数查询失败 fail-open，不误伤）
- DB 回查为权威角色源；连续回查失败 ≥3 次才 503

### 6.3 输入

- `requestSafetyGuard`：XSS / SQL 注入特征检测（当前在需要时挂载）
- `sanitizeObjectKeys`：递归剔除 `__proto__` / `constructor` / `prototype`，深度上限 10
- 文本净化：去控制字符、压缩空白、裁剪长度
- CSV 导出：`= + - @` 开头前置单引号（防公式注入）

### 6.4 输出

- 安全响应头：`nosniff`、`X-Frame-Options`（API 为 DENY）、`Referrer-Policy`、API 路径 `CSP: default-src 'none'`
- 生产配置 `DOMAIN` 时下发 HSTS
- 前端渲染全程 `textContent`，无 innerHTML

### 6.5 审计

服务端强制写入 `AuditLog` 的动作：`login_success` / `login_failed` / `logout` /
`change_password` / `content_update` / `content_reset` / `setting_update` /
`inquiry_create` / `inquiry_update` / `inquiry_delete` / `inquiry_export`。

---

## 7. 已知约束与待办

### 7.1 约束

- **单实例部署**：限流计数存内存，扩容前须迁移 Redis（见 `PROJECT_CONVENTIONS.md` 规则十）
- **内容编辑为 JSON 编辑**：当前后台是 JSON textarea，对非技术同事不友好。
  若要改成表单化编辑，需要在 registry 中补一份字段 schema（后续可演进方向）
- 无图片上传能力：内容中的图片需通过外链或手动放置

### 7.2 待办

- [ ] 章节内容的表单化编辑（基于 payload schema 自动生成表单）
- [ ] 前台内容的多版本草稿 / 预览机制
- [ ] 单元测试（Jest）与 E2E（Cypress）骨架
- [ ] 图片资源管理（上传 + CDN）
- [ ] 访问统计与来源分析
