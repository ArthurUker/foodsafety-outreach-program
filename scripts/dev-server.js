/**
 * 本地静态开发服务器（零依赖）。
 *
 * 用途：不启动后端时预览纯静态页面（前端会自动回落到 data/content.seed.json）。
 * 需要后端 API 时请启动 backend（npm run dev，SERVE_STATIC=true 同源托管）。
 *
 * 用法：node scripts/dev-server.js [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);

  // 路径穿越防护：解析后必须仍在根目录内
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`🌐 本地静态服务已启动：http://localhost:${port}`);
  console.log('   首页：http://localhost:' + port + '/index.html');
  console.log('   后台：http://localhost:' + port + '/admin.html（需后端 API）');
});
