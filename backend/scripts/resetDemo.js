import { runSeed } from './seed.js';
import { disconnectDB } from '../src/config/db.js';
import { ENV } from '../src/config/env.js';

if (!ENV.ALLOW_DEMO_RESET && ENV.NODE_ENV === 'production') {
  console.error('[Reset Error] Demo reset is disabled in production.');
  process.exit(1);
}

runSeed(true)
  .then(async () => {
    await disconnectDB();
    console.log('[Reset] Demo data successfully reset to clean starting baseline.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Reset Error]', err);
    process.exit(1);
  });
