import http from 'http';
import { config } from './config/env.js';
import { initializeSchema } from './db/schema.js';
import { runSeed } from './db/seed.js';
import { createApiApp } from './app.js';
import { attachLiveMentorWebSocket } from './services/liveBridge.js';

async function startStandaloneServer() {
  await initializeSchema();
  const seedResult = await runSeed();
  console.log('[SKILLNOVA DB]', seedResult.message || `Seeded ${seedResult.coursesCount} courses.`);

  const app = createApiApp();
  const httpServer = http.createServer(app);
  attachLiveMentorWebSocket(httpServer);

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`SKILLNOVA Backend API running on port ${config.port}`);
  });
}

startStandaloneServer().catch((err) => {
  console.error('Failed to start SKILLNOVA backend:', err);
  process.exit(1);
});
