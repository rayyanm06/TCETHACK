import { app } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { User } from './models/User.js';
import { runSeed } from '../scripts/seed.js';

async function startServer() {
  try {
    await connectDB();

    // Check if database needs initial seeding
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server] Database is empty. Running initial demo seed...');
      await runSeed();
    }

    app.listen(ENV.PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 CivicClean Backend Server running on port ${ENV.PORT}`);
      console.log(`📡 Health Check: http://localhost:${ENV.PORT}/api/health`);
      console.log(`⚙️  API Config:   http://localhost:${ENV.PORT}/api/config`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('[Server Error] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
