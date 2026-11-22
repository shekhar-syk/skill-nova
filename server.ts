import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './backend/src/config/env.js';
import { isPostgres, resetLocalSqliteDb } from './backend/src/db/index.js';
import { initializeSchema } from './backend/src/db/schema.js';
import { runSeed } from './backend/src/db/seed.js';
import { createApiApp } from './backend/src/app.js';
import { attachLiveMentorWebSocket } from './backend/src/services/liveBridge.js';

async function bootstrap() {
  let seedResult;
  try {
    await initializeSchema();
    seedResult = await runSeed();
  } catch (err) {
    const sqliteErr = err as { code?: string; message?: string };
    const isSqliteMalformed =
      !config.isProduction &&
      !isPostgres &&
      (sqliteErr?.code === 'ERR_SQLITE_ERROR' || /malformed|corrupt/i.test(String(sqliteErr?.message || '')));
    if (!isSqliteMalformed) {
      throw err;
    }
    console.warn('[SKILLNOVA DB] Recovering malformed local SQLite database and re-seeding...');
    resetLocalSqliteDb();
    await initializeSchema();
    seedResult = await runSeed();
  }
  console.log('[SKILLNOVA DB]', seedResult.message || `Seeded ${seedResult.coursesCount} courses.`);

  const app = createApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const httpServer = http.createServer(app);
  attachLiveMentorWebSocket(httpServer);

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`SKILLNOVA Full-Stack Server listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start SKILLNOVA server:', err);
  process.exit(1);
});
