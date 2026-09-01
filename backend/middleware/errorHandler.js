/**
 * 统一错误处理。
 * 生产环境不回传堆栈与内部消息，避免信息泄露。
 */

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  // 请求体过大（express.json limit）
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大。' });
  }
  // JSON 解析失败
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: '请求体不是合法 JSON。' });
  }

  console.error('❌ Unhandled error:', err);
  res.status(err?.status || 500).json({
    error: isDev ? err.message : '服务器内部错误，请稍后重试。',
    ...(isDev && err?.stack ? { stack: err.stack } : {}),
  });
}
