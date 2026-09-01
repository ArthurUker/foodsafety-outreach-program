# 项目长期规范

> **本文件优先级最高。** 与任何其它文档或既有代码冲突时，以本文件为准。
> 修改本文件需在下一次提交信息中说明理由。

---

## 规则一：审计日志不得物理删除

- 审计记录（`AuditLog`）**只增不改不删**。API 层不得提供删除端点。
- 业务逻辑需要"作废"某条记录时，新增一条反向操作的审计记录，而不是删除原记录。
- 清理需求仅允许通过人工 DBA 操作 + 书面留痕完成，且必须先导出归档。

**理由**：审计日志是合规证据与事故追溯的唯一依据。提供删除端点等于给越权者开后门。

---

## 规则二：内容变更必须走后端校验

- 章节内容（`ContentSection.payload`）的写入**只能**经过 `backend/lib/contentStore.js` 的 `validateSectionPayload()`。
- 禁止在路由中直接 `prisma.contentSection.update({ data: { payload: req.body } })`。
- 新增章节字段类型时，同步更新校验规则（深度 ≤6 层、体积 ≤200KB、链接协议白名单、HEX 颜色）。

**理由**：内容是渲染的唯一数据源，一份非法 payload 会让整页白屏。校验必须收口在一处。

---

## 规则三：渲染层不得使用 innerHTML 渲染业务内容

- 章节渲染器（`js/sections/*.js`）一律通过 `js/core/dom.js` 的 `el()` 构建 DOM。
- 业务内容字符串通过 `textContent` 写入，**禁止** `innerHTML` / `insertAdjacentHTML` / 模板字符串拼 HTML。
- `el()` 的 `html` 属性仅用于本文件内部的静态模板，业务数据不得走该分支。

**理由**：后台编辑的内容是半可信输入。一次存储型 XSS 就能让所有访客中招。

---

## 规则四：新增章节必须两处同步

新增一个页面章节时，必须同时修改：

1. `js/modules/registry.js` —— 登记 `SECTION_ORDER` 与 `SECTION_REGISTRY`
2. `backend/lib/contentStore.js` —— 同步 `SECTION_KEYS` 白名单与（必要时的）专项形状校验

两处 key 必须**完全一致**，否则后台能编辑但保存会被服务端 400 拒绝。

---

## 规则五：安全配置不达标的进程必须拒绝启动

以下情况一律 `process.exit(1)`，不做"带病运行"降级：

- `JWT_SECRET` 缺失、命中弱密钥黑名单、长度 < 32
- `CORS_ORIGIN` 含通配符 `*`（本站 CORS 恒开 `credentials:true`）
- 生产环境 seed 缺少 `SEED_ADMIN_PASSWORD`

**理由**：默认密钥与通配符 CORS 一旦进入生产就是实质性漏洞，靠人工 review 拦不住。

---

## 规则六：数据库回查失败采用 fail-soft → fail-closed 折中

- 认证中间件回查 DB 异常时，连续失败 < 3 次：沿用 token 身份放行并告警。
- 连续失败 ≥ 3 次：返回 503。

**理由**：不做折中会导致数据库瞬时抖动触发全站登出（可用性事故），或完全放行导致权限失效（安全事故）。

---

## 规则七：前端改码必须重建 dist/

- 生产由 Caddy 直接 serve `dist/`，**不读源码**。
- 改完 `js/`、`css/`、`index.html`、`admin.html` 后必须执行 `node scripts/build-static.js`。
- `dist/` 已在 `.gitignore` 中，不入库；部署机拉代码不会带入。

**理由**：这是最高频的"改了但线上没变"事故来源。

---

## 规则八：部署前必须 commit + push

- `deploy/deploy.sh` 会执行 `git fetch` + `git reset --hard` + `git clean -fd`。
- 只存在于本地工作区（未提交/未推送）的修改**会被覆盖丢失**。

上线 checklist：源码改动 commit + push → `git status --short` 确认干净 → 部署 → 验证。

---

## 规则九：环境变量不入库

- `.env` 与 `.env.*` 已在 `.gitignore` 中（`.env.example` 除外）。
- 新增配置项时，同步更新 `.env.example` 与 `docs/DEVELOPMENT_GUIDE.md` 的环境变量清单。

---

## 规则十：单实例约束

以下状态存于**进程内存**，依赖单实例才正确：

1. 全局限流计数（`backend/middleware/validationMiddleware.js`）
2. 登录限流与提交限流计数（同上）

水平扩容前必须先将上述状态迁移到 Redis 等共享存储，否则限流形同虚设。
