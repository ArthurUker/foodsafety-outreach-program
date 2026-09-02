# 开发指南

> 面向日常开发的实操手册。架构决策见 `ARCHITECTURE.md`，硬约束见 `PROJECT_CONVENTIONS.md`。

---

## 1. 本地环境

**依赖**：Node.js ≥ 18（推荐 20）、PostgreSQL ≥ 12、npm。

```bash
# 1) 建库
createdb foodsafety_outreach

# 2) 配置环境变量
cp .env.example backend/.env
# 填写 DATABASE_URL；生成 JWT_SECRET：
openssl rand -base64 48

# 3) 安装依赖
npm --prefix backend install

# 4) 初始化表结构与数据
npm run db:generate
npm run db:push
npm run seed

# 5) 启动
npm run dev          # 后端 :3000，同源托管静态资源
```

访问：

- 前台 `http://localhost:3000/`
- 后台 `http://localhost:3000/admin.html`

---

## 2. 环境变量清单

配置文件：`backend/.env`

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 环境标识；`development` 时错误响应回传堆栈 |
| `PORT` | `3000` | 后端监听端口 |
| `SERVE_STATIC` | `true` | 本地开发由 Express 托管静态资源；生产必须为 `false`（由 Caddy 托管 `dist/`） |
| `DATABASE_URL` | — | PostgreSQL 连接串 |
| `JWT_SECRET` | — | **必填**，≥32 位强随机；命中弱密钥黑名单拒绝启动 |
| `JWT_EXPIRE` | `8h` | 后台访问令牌有效期 |
| `CORS_ORIGIN` | 本地来源 | 逗号分隔的显式来源白名单，**禁止通配符** |
| `CORS_HOSTNAMES` | — | 可选，按 hostname 或 hostname:port 放行 |
| `SEED_ADMIN_USERNAME` | `admin` | 首次 seed 的管理员账号 |
| `SEED_ADMIN_PASSWORD` | — | 首次 seed 的密码（≥8 位含字母数字）；缺失则跳过建号 |
| `SEED_ADMIN_DISPLAY_NAME` | `平台管理员` | 显示名 |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` | 全局限流（每窗口每 IP） |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 限流窗口 |
| `LOGIN_RATE_LIMIT_MAX` | `10` | 登录限流（每 15 分钟每 IP+用户名） |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | 登录限流窗口 |
| `LOGIN_FAIL_LOCK_THRESHOLD` | `5` | 登录失败锁定阈值 |
| `LOGIN_FAIL_LOCK_WINDOW_MS` | `900000` | 锁定统计窗口 |
| `BODY_LIMIT` | `2mb` | JSON 请求体上限 |
| `AUTO_SEED_CONTENT` | `true` | seed 时是否导入章节内容 |
| `DOMAIN` | — | 配置后下发 HSTS 头 |

---

## 3. 如何新增一个章节

以新增「合作案例」章节为例：

### 步骤 1：写渲染器

`js/sections/cases.js`：

```js
import { el } from '../core/dom.js';

export function renderCases(payload) {
  return el('section.section', { id: 'cases' }, [
    el('div.container', {}, [
      el('div.section-heading.reveal', {}, [
        el('span.section-tag', { text: 'Cases' }),
        el('h2', { text: '合作案例' }),
        payload.intro ? el('p', { text: payload.intro }) : null,
      ]),
      // ... 用 el() 构建，禁止 innerHTML
    ]),
  ]);
}
```

### 步骤 2：注册（两处必须同步）

`js/modules/registry.js`：

```js
import { renderCases } from '../sections/cases.js';

export const SECTION_ORDER = [..., 'cases'];

export const SECTION_REGISTRY = {
  ...,
  cases: { key: 'cases', navLabel: '合作案例', render: renderCases, inNav: true },
};
```

`backend/lib/contentStore.js`：

```js
export const SECTION_KEYS = [..., 'cases'];

// 如需专项形状校验，在 validateSectionPayload 中补充：
if (key === 'cases') requireArray('items');
```

### 步骤 3：补种子内容

在 `data/content.seed.json` 的 `sections` 中加入 `cases` 节点，然后：

```bash
npm run seed:content
```

### 步骤 4：补样式

在 `css/sections.css` 中追加 `.cases-*` 相关规则（若复用了通用组件类如 `.card`、`.grid-3`，可能无需新增样式）。

> ⚠️ 两处 key 不同步的症状：后台能选到章节但保存报 400「未知的章节 key」。

---

## 4. 如何修改章节内容

两种方式，推荐第一种：

1. **后台编辑**：登录 `admin.html` → 章节内容 → 选章节 → 改 JSON → 保存
2. **改种子文件**：编辑 `data/content.seed.json` → `npm run seed:content`

区别：方式 1 改的是数据库（立即影响线上），方式 2 改的是仓库（需要执行导入才生效，且会被下次部署的 seed 覆盖？——不会，seed 仅在首次部署执行；重跑 `seed:content` 才会覆盖）。

---

## 5. 前后端联调

- 前端 `js/core/api.js` 的 base 默认是 `/api`（同源）。跨域调试时可设：

  ```html
  <script>window.__API_BASE_URL = 'http://localhost:3000/api';</script>
  ```

- 后端已设 `app.set('trust proxy', 1)`，反代后能拿到真实客户端 IP（限流与审计依赖）。

---

## 6. 常见问题排查

| 现象 | 排查方向 |
| --- | --- |
| 启动即退出，报 `JWT_SECRET` | 未配置或命中弱密钥黑名单；`openssl rand -base64 48` 重新生成 |
| 启动即退出，报 CORS 通配符 | `CORS_ORIGIN` 含 `*`，改为显式白名单 |
| 前台全是「内容加载失败」 | 后端未启动，且 `data/content.seed.json` 也读取失败；检查 `dist/` 是否包含 `data/` |
| 后台保存内容报 400 | 查看响应 `details` 字段，通常是 JSON 深度超限、体积超限或链接非法 |
| 后台一直跳回登录 | 令牌过期或被吊销；检查系统时间是否漂移 |
| 登录 423 | 该账号 15 分钟内失败 ≥5 次，等窗口过期或改密解除 |
| 改了前端代码线上没变 | 未重建 `dist/`：`node scripts/build-static.js` |
| 部署后修改被覆盖 | 未 commit + push，被 `git reset --hard` 还原 |

---

## 7.1 玻璃化样式开发须知

改动视觉时请遵守（详见 `PROJECT_CONVENTIONS.md` 规则十一～十三）：

1. **不要给 `.glass` 容器再设 `background`** —— 会覆盖掉半透明材质。
   需要区分层次请改用 `.glass-panel`。
2. **不要嵌套玻璃** —— `.glass .glass` 会让 `backdrop-filter` 相乘，两层即糊。
   `npm run smoke` 会检查并失败。
3. **新增页面必须内联 `#lg-refraction` SVG 滤镜**，且 `glass.css` 要在 `base.css` 之后加载
   （它需要把 `--page-bg` 覆盖为 `transparent`）。
4. **深色区块用 `--glass-dark-veil` 而不是 `--glass-dark-bg`** —— 后者仅 42% 不透明，
   直接铺在亮色极光上会泛白，导致浅色文字看不清。

调主题色改 `css/tokens.css` 即可：极光四角 `--aurora-1..4`、玻璃底色 `--glass-bg`、
模糊强度 `--glass-blur`。

---

## 7.2 渲染冒烟测试

改动 `js/sections/*.js` 或 `js/core/dom.js` 后**必须**执行：

```bash
npm run smoke
```

校验内容：8 个章节能否渲染出节点、根元素 id 是否正确、产出是否含 `<script>`、
恶意 payload 是否只作为纯文本呈现、空 payload 是否抛异常。全部通过才能提交。

---

## 8. 数据库操作

```bash
npm run db:push        # 开发：同步表结构（无迁移文件）
npm run db:migrate     # 开发：生成迁移文件并应用
npm run db:deploy      # 生产：应用已有迁移
npm run db:studio      # 可视化查看数据
npm run seed           # 管理员 + 内容导入（幂等）
npm run seed:content   # 仅重新导入章节内容
```

手工：

```bash
pg_dump foodsafety_outreach > backup_$(date +%F).sql
psql -d foodsafety_outreach < backup_YYYY-MM-DD.sql
```

---

## 9. 构建与部署

```bash
node scripts/build-static.js    # 生成 dist/
node scripts/dev-server.js 4173 # 本地静态预览
sudo bash deploy/deploy.sh deploy/deploy.conf
```

部署详情见 `README.md` 第 7 节与 `deploy/deploy.example.conf`。
