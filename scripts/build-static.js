/**
 * 静态构建：生成 dist/ 目录（纯文件拷贝，无打包器）。
 *
 * ⚠️ 本脚本仅在手动执行后才更新 dist/。生产由 Caddy 直接 serve dist/，
 * 改完源码必须重建，否则线上仍是旧版本（与 foodtestlab 的同款教训）。
 *
 * 用法：node scripts/build-static.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const filesToCopy = ['index.html', 'admin.html'];
const dirsToCopy = ['css', 'js', 'data'];

function ensureCleanDist() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
}

function copyFile(relPath) {
  const src = path.join(root, relPath);
  const dst = path.join(dist, relPath);
  if (!fs.existsSync(src)) throw new Error(`缺少必需文件：${relPath}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(relPath) {
  const src = path.join(root, relPath);
  const dst = path.join(dist, relPath);
  if (!fs.existsSync(src)) throw new Error(`缺少必需目录：${relPath}`);
  fs.cpSync(src, dst, { recursive: true });
}

function main() {
  ensureCleanDist();
  filesToCopy.forEach(copyFile);
  dirsToCopy.forEach(copyDir);
  console.log('✅ 构建完成：dist/ 已生成');
  console.log('   提示：生产部署前请确认 dist/ 内容与源码一致（改完源码必须重建）。');
}

main();
