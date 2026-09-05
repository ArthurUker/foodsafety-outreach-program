#!/usr/bin/env bash
#
# 校园食安推广方案站 —— 一键部署脚本
#
# 用法：sudo bash deploy/deploy.sh deploy/deploy.conf
#
# 流程：校验 → 安装运行时 → 建用户与目录 → 拉代码 → 生成 .env → 数据库初始化
#      → 构建 dist/ → systemd 单元 → Caddy 站点 → 健康检查 → 输出初始账号
#
# ⚠️ 注意：本脚本会对代码目录执行 git reset --hard（拉取远端最新代码），
#        未 commit + push 的本地修改会被覆盖。部署前请确认工作区干净。
#
set -Eeuo pipefail

CONF_FILE="${1:-}"
if [[ -z "$CONF_FILE" || ! -f "$CONF_FILE" ]]; then
  echo "用法：sudo bash deploy/deploy.sh <适配文件>，例如 deploy/deploy.conf" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONF_FILE"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请以 root 运行：sudo bash deploy/deploy.sh $CONF_FILE" >&2
  exit 1
fi

log()  { echo -e "\n\033[1;34m[$(date +%H:%M:%S)] $*\033[0m"; }
warn() { echo -e "\033[1;33m[WARN] $*\033[0m"; }
die()  { echo -e "\033[1;31m[FATAL] $*\033[0m" >&2; exit 1; }

SYSTEM_NAME="${SYSTEM_NAME:-foodsafety-outreach}"
APP_NAME="${APP_NAME:-${SYSTEM_NAME}-api}"
# 数据盘（可选）：DATA_ROOT 非空且 conf 未显式指定 REPO_ROOT/LOG_DIR 时，二者默认落数据盘
DATA_ROOT="${DATA_ROOT:-}"
if [[ -n "$DATA_ROOT" ]]; then
  REPO_ROOT="${REPO_ROOT:-${DATA_ROOT}/${SYSTEM_NAME}}"
  LOG_DIR="${LOG_DIR:-${DATA_ROOT}/logs/${SYSTEM_NAME}}"
fi
REPO_ROOT="${REPO_ROOT:-/opt/${SYSTEM_NAME}}"
LOG_DIR="${LOG_DIR:-/var/log/${SYSTEM_NAME}}"
API_PORT="${API_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
NODE_VERSION="${NODE_VERSION:-20}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_DB_NAME="${PG_DB_NAME:-foodsafety_outreach}"
PG_USER="${PG_USER:-foodsafety}"
INSTALL_RUNTIME="${INSTALL_RUNTIME:-true}"
SEED_ON_FIRST_DEPLOY="${SEED_ON_FIRST_DEPLOY:-true}"
SEED_ADMIN_USERNAME="${SEED_ADMIN_USERNAME:-admin}"

# DOMAIN 填写守卫：必须是裸域名（Caddy 据此自动签发 HTTPS 证书）
if [[ -n "${DOMAIN:-}" ]]; then
  [[ "$DOMAIN" == *"://"* ]] && die "DOMAIN 只填裸域名（如 outreach.example.com），不要带 http(s):// 前缀"
  [[ "$DOMAIN" == "example.com" || "$DOMAIN" == *".example.com" ]] && die "DOMAIN 仍是示例占位符，请先在适配文件中改成真实子域名"
  [[ -n "${TLS_EMAIL:-}" ]] || warn "未填 TLS_EMAIL，Let's Encrypt 证书临期时收不到邮件提醒"
fi

# 数据盘守卫：配置了 DATA_ROOT 时校验其为独立挂载点，防止数据静默写回系统盘
if [[ -n "${DATA_ROOT:-}" ]]; then
  DATA_TARGET="$(findmnt -n -o TARGET -T "$DATA_ROOT" 2>/dev/null || echo '/')"
  [[ "$DATA_TARGET" == "/" ]] && die "DATA_ROOT=${DATA_ROOT} 仍属系统盘（/）。请先挂载数据盘到该路径，或将 DATA_ROOT 留空改用系统盘"
fi

# 重复部署识别：本系统的 Caddy 站点片段已存在 = 之前部署过，端口冲突判断需放行自身
IS_REDEPLOY=false
[[ -f "/etc/caddy/sites/${SYSTEM_NAME}.caddy" ]] && IS_REDEPLOY=true

# 端口冲突预检（fail-fast，避免部署到一半才发现端口被占）
[[ "$API_PORT" =~ ^[0-9]+$ ]] || die "API_PORT 必须是数字"
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "(:|\])${API_PORT}$"; then
  if [[ "$IS_REDEPLOY" == "true" ]]; then
    warn "API 端口 ${API_PORT} 已被监听（应为既有部署的 ${APP_NAME}），继续重复部署"
  else
    die "后端端口 ${API_PORT} 已被其它进程占用，请在适配文件中更换 API_PORT（排查：ss -ltnp | grep :${API_PORT}）"
  fi
fi
if [[ -z "${DOMAIN:-}" ]]; then
  [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || die "FRONTEND_PORT 必须是数字"
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "(:|\])${FRONTEND_PORT}$"; then
    if [[ "$IS_REDEPLOY" == "true" ]]; then
      warn "前端端口 ${FRONTEND_PORT} 已被监听（应为既有部署的 Caddy 站点），继续重复部署"
    else
      die "前端端口 ${FRONTEND_PORT} 已被其它站点占用，请在适配文件中更换 FRONTEND_PORT（排查：ss -ltnp | grep :${FRONTEND_PORT}）"
    fi
  fi
fi

# 域名模式：80/443 必须空闲或由 Caddy 监听（ACME 签证书与 HTTP→HTTPS 跳转都需要 80；
# 若被 Nginx 等其它 Web 服务器占用，Caddy 无法绑定，站点与证书都会失败）
if [[ -n "${DOMAIN:-}" ]]; then
  occupied80443="$(ss -ltn 2>/dev/null | awk '{print $4}' | grep -E '(:|\])(80|443)$' || true)"
  if [[ -n "$occupied80443" ]]; then
    procs="$(ss -ltnp 2>/dev/null | grep -E '(:|\])(80|443) ' | grep -oE '\("[^"]+"' | sort -u | tr -d '("' | tr '\n' ' ' || true)"
    if [[ "${procs}" != *caddy* ]]; then
      die "域名模式需要 80/443 端口，但已被其它进程监听（${procs:-未知进程}）。" \
        "若为 Nginx 承载的其它站点，建议改用该 Nginx 托管本站；若确认弃用，停止该服务后重跑。排查：ss -ltnp | grep -E ':(80|443) '"
    fi
  fi
fi

# 域名冲突预检：同机其它 Caddy 站点片段已占用该域名时中止（Caddy 加载会直接报错）
if [[ -n "${DOMAIN:-}" && -d /etc/caddy/sites ]] && grep -rqs -- "$DOMAIN" /etc/caddy/sites/*.caddy; then
  die "域名 ${DOMAIN} 已存在于 /etc/caddy/sites/ 下的站点片段，请确认或更换域名"
fi

# =========================================================
# 1. 安装运行时
# =========================================================
log "步骤 1/9：安装运行时"
if [[ "$INSTALL_RUNTIME" == "true" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl git ca-certificates gnupg postgresql postgresql-contrib debian-keyring debian-archive-keyring apt-transport-https

  # Caddy
  if ! command -v caddy >/dev/null 2>&1; then
    install -d -m 0755 /etc/apt/keyrings
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    chmod 0644 /etc/apt/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi

  # Node.js（若不存在或主版本不符，直接装官方二进制）
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1)" != "v${NODE_VERSION}" ]]; then
    ARCH="$(dpkg --print-architecture)"
    case "$ARCH" in
      amd64) NODE_ARCH="x64" ;;
      arm64) NODE_ARCH="arm64" ;;
      *) die "不支持的架构：$ARCH" ;;
    esac
    NODE_TARBALL="node-v${NODE_VERSION}.11.0-linux-${NODE_ARCH}.tar.xz"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}.11.0/${NODE_TARBALL}" -o "/tmp/${NODE_TARBALL}"
    rm -rf /usr/local/node
    mkdir -p /usr/local/node
    tar -xJf "/tmp/${NODE_TARBALL}" -C /usr/local/node --strip-components=1
    ln -sf /usr/local/node/bin/node /usr/local/bin/node
    ln -sf /usr/local/node/bin/npm /usr/local/bin/npm
    ln -sf /usr/local/node/bin/npx /usr/local/bin/npx
  fi
  node -v && npm -v
fi

# =========================================================
# 2. 系统用户与目录
# =========================================================
log "步骤 2/9：创建系统用户与目录"
if ! id -u "$SYSTEM_NAME" >/dev/null 2>&1; then
  useradd --system --shell /usr/sbin/nologin --home-dir "$REPO_ROOT" "$SYSTEM_NAME"
fi
mkdir -p "$REPO_ROOT" "$LOG_DIR"
chown -R "$SYSTEM_NAME":"$SYSTEM_NAME" "$REPO_ROOT" "$LOG_DIR"

# =========================================================
# 3. 获取代码
# =========================================================
log "步骤 3/9：获取代码"
if [[ ! -d "$REPO_ROOT/.git" ]]; then
  rm -rf "$REPO_ROOT"
  git clone --depth 1 --branch "$DEPLOY_BRANCH" "$REPO_URL" "$REPO_ROOT"
else
  cd "$REPO_ROOT"
  git fetch origin "$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
  # 仅清理未跟踪文件，保留 .env（部署生成，不入库）
  git clean -fd -e .env
fi
chown -R "$SYSTEM_NAME":"$SYSTEM_NAME" "$REPO_ROOT"

# =========================================================
# 4. 数据库初始化
# =========================================================
log "步骤 4/9：初始化 PostgreSQL"
systemctl enable --now postgresql

if [[ -z "${PG_PASSWORD:-}" ]]; then
  PG_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)"
  warn "已为数据库用户 $PG_USER 自动生成密码"
fi

su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'\"" | grep -q 1 \
  || su - postgres -c "psql -c \"CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}';\""

# 数据盘模式：本站数据库通过独立表空间整体落数据盘（主集群与其余数据库不受影响）
TS_FLAG=""
if [[ -n "${DATA_ROOT:-}" ]]; then
  PG_TS_DIR="${DATA_ROOT}/pg/${SYSTEM_NAME}"
  PG_TS_NAME="ts_${SYSTEM_NAME//-/_}"
  mkdir -p "$PG_TS_DIR"
  chown postgres:postgres "$PG_TS_DIR"
  chmod 700 "$PG_TS_DIR"
  # Ubuntu 的 AppArmor 默认限制 postgres 只写已知路径，放行数据盘表空间目录
  PG_AA_LOCAL="/etc/apparmor.d/local/usr.lib.postgresql.postgres"
  if [[ -d /etc/apparmor.d/local ]]; then
    if ! grep -qs "permit DATA_ROOT tablespace ${PG_TS_DIR}" "$PG_AA_LOCAL" 2>/dev/null; then
      { echo "# permit DATA_ROOT tablespace ${PG_TS_DIR}"
        echo "${PG_TS_DIR}/ r,"
        echo "${PG_TS_DIR}/** rwk,"
      } >> "$PG_AA_LOCAL"
      systemctl reload apparmor 2>/dev/null || true
    fi
  fi
  if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_tablespace WHERE spcname='${PG_TS_NAME}'\"" | grep -q 1; then
    if ! su - postgres -c "psql -c \"CREATE TABLESPACE ${PG_TS_NAME} OWNER postgres LOCATION '${PG_TS_DIR}';\"" 2>/tmp/fsop_ts_err.log; then
      # 兜底：postgres AppArmor profile 处于 enforce 时会拦截非常规表空间路径，自动降级 complain 重试一次
      if command -v aa-complain >/dev/null 2>&1 \
        && aa-complain /etc/apparmor.d/usr.lib.postgresql.postgres 2>/dev/null \
        && su - postgres -c "psql -c \"CREATE TABLESPACE ${PG_TS_NAME} OWNER postgres LOCATION '${PG_TS_DIR}';\""; then
        warn "postgres AppArmor profile 已临时置为 complain 以创建表空间（${PG_TS_DIR} 放行规则已写入 local，可执行 aa-enforce /etc/apparmor.d/usr.lib.postgresql.postgres 恢复 enforce）"
      else
        die "创建表空间 ${PG_TS_NAME}（${PG_TS_DIR}）失败：$(cat /tmp/fsop_ts_err.log 2>/dev/null || true)。多为 AppArmor 拦截或目录权限问题，排查：journalctl -u postgresql -n 30；或安装 apparmor-utils 后重跑（apt-get install -y apparmor-utils）"
      fi
    fi
    rm -f /tmp/fsop_ts_err.log
  fi
  TS_FLAG="-D ${PG_TS_NAME}"
  log "本站数据库表空间：${PG_TS_NAME} → ${PG_TS_DIR}（数据盘）"
fi

su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${PG_DB_NAME}'\"" | grep -q 1 \
  || su - postgres -c "createdb -O ${PG_USER} ${TS_FLAG} ${PG_DB_NAME}"

export DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB_NAME}?schema=public"

# =========================================================
# 5. 生成 backend/.env
# =========================================================
log "步骤 5/9：生成 backend/.env"
ENV_FILE="$REPO_ROOT/backend/.env"
FIRST_DEPLOY="false"
[[ -f "$ENV_FILE" ]] || FIRST_DEPLOY="true"

if [[ "$FIRST_DEPLOY" == "true" ]]; then
  JWT_SECRET_VALUE="$(openssl rand -base64 48 | tr -d '\n')"
  [[ -n "${SEED_ADMIN_PASSWORD:-}" ]] || SEED_ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 14)"

  if [[ -z "${CORS_ORIGIN:-}" ]]; then
    if [[ -n "${DOMAIN:-}" ]]; then
      CORS_ORIGIN="https://${DOMAIN}"
    else
      PUBLIC_IP="$(curl -s --max-time 5 ifconfig.me || true)"
      CORS_ORIGIN="http://${PUBLIC_IP}:${FRONTEND_PORT}"
      [[ -n "$PUBLIC_IP" ]] || warn "未能获取公网 IP，请手动修正 CORS_ORIGIN"
    fi
  fi

  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${API_PORT}
SERVE_STATIC=false
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET_VALUE}
JWT_EXPIRE=8h
CORS_ORIGIN=${CORS_ORIGIN}
SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME}
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}
SEED_ADMIN_DISPLAY_NAME=${SEED_ADMIN_DISPLAY_NAME:-平台管理员}
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000
BODY_LIMIT=2mb
AUTO_SEED_CONTENT=true
# 钉钉群机器人通知（可选）：部署后在 backend/.env 填入 Webhook，再 systemctl restart ${APP_NAME} 生效
DINGTALK_WEBHOOK=${DINGTALK_WEBHOOK:-}
DINGTALK_SECRET=${DINGTALK_SECRET:-}
EOF
  chmod 600 "$ENV_FILE"
  chown "$SYSTEM_NAME":"$SYSTEM_NAME" "$ENV_FILE"
else
  # 保留既有密钥与账号口令，仅补齐新增配置项
  grep -q '^JWT_EXPIRE=' "$ENV_FILE" || echo 'JWT_EXPIRE=8h' >> "$ENV_FILE"
  grep -q '^BODY_LIMIT=' "$ENV_FILE" || echo 'BODY_LIMIT=2mb' >> "$ENV_FILE"
  grep -q '^AUTO_SEED_CONTENT=' "$ENV_FILE" || echo 'AUTO_SEED_CONTENT=true' >> "$ENV_FILE"
  grep -q '^DINGTALK_WEBHOOK=' "$ENV_FILE" || echo 'DINGTALK_WEBHOOK=' >> "$ENV_FILE"
  grep -q '^DINGTALK_SECRET=' "$ENV_FILE" || echo 'DINGTALK_SECRET=' >> "$ENV_FILE"
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=${DATABASE_URL}#" "$ENV_FILE"
  CORS_ORIGIN="$(grep '^CORS_ORIGIN=' "$ENV_FILE" | cut -d= -f2- || true)"
fi

# =========================================================
# 6. 安装依赖与数据库迁移
# =========================================================
log "步骤 6/9：安装依赖并同步数据库结构"
cd "$REPO_ROOT/backend"
sudo -u "$SYSTEM_NAME" npm ci --omit=dev || sudo -u "$SYSTEM_NAME" npm install --omit=dev
sudo -u "$SYSTEM_NAME" npx prisma generate

# 注意：仓库无 prisma/migrations 时 migrate deploy 会"空成功"（No migration found 且退出码 0），
# 不能据此判定表已就绪 —— 必须检测该情形并回退到 db push（2026-09-05 线上事故根因）。
MIGRATE_OUTPUT="$(sudo -u "$SYSTEM_NAME" npx prisma migrate deploy 2>&1)" || true
if echo "$MIGRATE_OUTPUT" | grep -q "No migration found"; then
  log "仓库未包含 migrations 目录，使用 prisma db push 同步表结构"
  sudo -u "$SYSTEM_NAME" npx prisma db push --skip-generate \
    || die "prisma db push 失败，请检查 DATABASE_URL 与数据库连接"
  echo "✅ 数据库结构已同步（db push）"
elif echo "$MIGRATE_OUTPUT" | grep -qiE "error|failed"; then
  warn "$MIGRATE_OUTPUT"
  warn "migrate deploy 失败，回退到 prisma db push（首次部署常见）"
  sudo -u "$SYSTEM_NAME" npx prisma db push --skip-generate \
    || die "prisma db push 失败，请检查 DATABASE_URL 与数据库连接"
else
  echo "$MIGRATE_OUTPUT" | tail -3
  echo "✅ 迁移已应用"
fi

if [[ "$FIRST_DEPLOY" == "true" && "$SEED_ON_FIRST_DEPLOY" == "true" ]]; then
  log "首次部署：执行 seed（建管理员 + 导入章节内容）"
  sudo -u "$SYSTEM_NAME" env "$(grep -v '^#' "$ENV_FILE" | xargs)" node prisma/seed.js || warn "seed 执行失败，可稍后手动执行"
fi

# =========================================================
# 7. 构建前端 dist/
# =========================================================
log "步骤 7/9：构建前端静态资源到 dist/"
cd "$REPO_ROOT"
sudo -u "$SYSTEM_NAME" node scripts/build-static.js
# 放行 caddy 用户读取静态资源（数据盘挂载的权限策略可能与 /opt 默认不同）
chmod -R a+rX "$REPO_ROOT/dist"

# =========================================================
# 8. systemd 单元
# =========================================================
log "步骤 8/9：写入 systemd 单元"
MEM_TOTAL_MB="$(free -m | awk '/^Mem:/{print $2}')"
if   [[ "$MEM_TOTAL_MB" -le 1024 ]]; then MEM_MAX="384M"
elif [[ "$MEM_TOTAL_MB" -le 2048 ]]; then MEM_MAX="512M"
elif [[ "$MEM_TOTAL_MB" -le 4096 ]]; then MEM_MAX="768M"
else MEM_MAX="1024M"; fi

cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=${SYSTEM_NAME} API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SYSTEM_NAME}
WorkingDirectory=${REPO_ROOT}/backend
EnvironmentFile=${REPO_ROOT}/backend/.env
ExecStart=/usr/local/bin/node server.js
Restart=on-failure
RestartSec=5
MemoryMax=${MEM_MAX}
StandardOutput=append:${LOG_DIR}/app.out.log
StandardError=append:${LOG_DIR}/app.err.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${APP_NAME}.service"

# =========================================================
# 9. Caddy 站点
# =========================================================
log "步骤 9/9：写入 Caddy 站点配置"
mkdir -p /etc/caddy/sites
grep -q 'import /etc/caddy/sites/\*.caddy' /etc/caddy/Caddyfile 2>/dev/null \
  || echo 'import /etc/caddy/sites/*.caddy' >> /etc/caddy/Caddyfile

SITE_ADDR=":${FRONTEND_PORT}"
[[ -n "${DOMAIN:-}" ]] && SITE_ADDR="${DOMAIN}"
TLS_LINE=""
[[ -n "${DOMAIN:-}" && -n "${TLS_EMAIL:-}" ]] && TLS_LINE="    tls ${TLS_EMAIL}"

cat > "/etc/caddy/sites/${SYSTEM_NAME}.caddy" <<EOF
${SITE_ADDR} {${TLS_LINE}
    encode gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        -Server
        X-Frame-Options "SAMEORIGIN"
    }

    # /api/* 必须优先反代，否则会被 try_files 吞成 SPA HTML
    handle /api/* {
        request_body { max_size 2MB }
        reverse_proxy 127.0.0.1:${API_PORT}
    }

    handle /health {
        reverse_proxy 127.0.0.1:${API_PORT}
    }

    handle {
        root * ${REPO_ROOT}/dist
        try_files {path} /index.html
        file_server
    }
}
EOF

caddy fmt --overwrite "/etc/caddy/sites/${SYSTEM_NAME}.caddy" || true
systemctl reload caddy || systemctl restart caddy

# =========================================================
# 健康检查与结果输出
# =========================================================
log "健康检查"
sleep 3
if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
  echo "✅ 后端健康检查通过（127.0.0.1:${API_PORT}/health）"
else
  warn "后端健康检查未通过，请查看：journalctl -u ${APP_NAME} -n 50"
fi
if [[ -n "${DOMAIN:-}" ]]; then
  # 域名模式：Caddy 监听 80/443，本地用 Host 头探测（HTTP→HTTPS 308 属预期）
  if curl -fsS -o /dev/null -H "Host: ${DOMAIN}" "http://127.0.0.1:80/" 2>/dev/null; then
    echo "✅ Caddy 前端可访问（https://${DOMAIN}）"
  else
    warn "Caddy 前端未通过检查，请查看：journalctl -u caddy -n 50"
  fi
else
  if curl -fsS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null; then
    echo "✅ Caddy 前端可访问（:${FRONTEND_PORT}）"
  else
    warn "Caddy 前端未通过检查，请查看：journalctl -u caddy -n 50"
  fi
fi

echo -e "\n================ 部署完成 ================"
if [[ -n "${DOMAIN:-}" ]]; then
  SITE_URL="https://${DOMAIN}"
else
  SITE_URL="http://<服务器公网IP>:${FRONTEND_PORT}"
fi
echo "站点地址：${SITE_URL}"
echo "管理后台：${SITE_URL}/admin.html"
echo "服务管理：systemctl status ${APP_NAME}"
if [[ "$FIRST_DEPLOY" == "true" ]]; then
  echo "初始管理员：${SEED_ADMIN_USERNAME}"
  echo "初始密码：${SEED_ADMIN_PASSWORD:-（沿用既有 .env）}"
  echo -e "\033[1;33m请立即登录后台修改密码，并妥善保存以上凭据。\033[0m"
fi
echo "=========================================="
