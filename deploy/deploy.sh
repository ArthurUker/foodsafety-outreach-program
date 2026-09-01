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

su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${PG_DB_NAME}'\"" | grep -q 1 \
  || su - postgres -c "createdb -O ${PG_USER} ${PG_DB_NAME}"

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
    PUBLIC_IP="$(curl -s --max-time 5 ifconfig.me || true)"
    CORS_ORIGIN="http://${PUBLIC_IP}:${FRONTEND_PORT}"
    [[ -n "$PUBLIC_IP" ]] || warn "未能获取公网 IP，请手动修正 CORS_ORIGIN"
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
EOF
  chmod 600 "$ENV_FILE"
  chown "$SYSTEM_NAME":"$SYSTEM_NAME" "$ENV_FILE"
else
  # 保留既有密钥与账号口令，仅补齐新增配置项
  grep -q '^JWT_EXPIRE=' "$ENV_FILE" || echo 'JWT_EXPIRE=8h' >> "$ENV_FILE"
  grep -q '^BODY_LIMIT=' "$ENV_FILE" || echo 'BODY_LIMIT=2mb' >> "$ENV_FILE"
  grep -q '^AUTO_SEED_CONTENT=' "$ENV_FILE" || echo 'AUTO_SEED_CONTENT=true' >> "$ENV_FILE"
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

if sudo -u "$SYSTEM_NAME" npx prisma migrate deploy; then
  echo "✅ 迁移已应用"
else
  warn "migrate deploy 失败，回退到 prisma db push（首次部署常见）"
  sudo -u "$SYSTEM_NAME" npx prisma db push --skip-generate
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
if curl -fsS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null; then
  echo "✅ Caddy 前端可访问（:${FRONTEND_PORT}）"
else
  warn "Caddy 前端未通过检查，请查看：journalctl -u caddy -n 50"
fi

echo -e "\n================ 部署完成 ================"
echo "站点地址：http://${DOMAIN:-<服务器公网IP>}${DOMAIN:+$([ -n "$DOMAIN" ] && echo '' || echo ":${FRONTEND_PORT}")}"
echo "管理后台：http://${DOMAIN:-<服务器公网IP>}${DOMAIN:+$([ -n "$DOMAIN" ] && echo '' || echo ":${FRONTEND_PORT}")}/admin.html"
echo "服务管理：systemctl status ${APP_NAME}"
if [[ "$FIRST_DEPLOY" == "true" ]]; then
  echo "初始管理员：${SEED_ADMIN_USERNAME}"
  echo "初始密码：${SEED_ADMIN_PASSWORD:-（沿用既有 .env）}"
  echo -e "\033[1;33m请立即登录后台修改密码，并妥善保存以上凭据。\033[0m"
fi
echo "=========================================="
