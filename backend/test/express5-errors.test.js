import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createContentRoutes } from '../routes/contentRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

test('Express 5 将 async 路由拒绝交给统一错误处理器', async () => {
  const prisma = {
    contentSection: {
      findUnique: async () => {
        throw new Error('database unavailable');
      },
    },
  };
  const passthrough = (_req, _res, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api/content', createContentRoutes({
    prisma,
    authenticateUser: passthrough,
    authorizeRoles: () => passthrough,
  }));
  app.use(errorHandler);

  const originalConsoleError = console.error;
  let response;
  try {
    console.error = () => {};
    response = await request(app).get('/api/content/hero');
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 500);
  assert.equal(response.body.error, '服务器内部错误，请稍后重试。');
});
