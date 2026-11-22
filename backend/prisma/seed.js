import { initializeSchema } from '../src/db/schema.js';
import { runSeed } from '../src/db/seed.js';

async function main() {
  await initializeSchema();
  const result = await runSeed();
  console.log('[SKILLNOVA PRISMA SEED]', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
