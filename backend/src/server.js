import { app } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { User } from './models/User.js';
import { runSeed } from '../scripts/seed.js';
import bcrypt from 'bcryptjs';

async function ensureOperatorAccount() {
  const operatorEmail = (process.env.OPERATOR_EMAIL || 'civicclean.operator@gmail.com').toLowerCase().trim();
  const operatorPassword = 'password123';

  let operator = await User.findOne({ email: operatorEmail });
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(operatorPassword, salt);

  if (operator) {
    // Always reset the password hash so the fixed credentials work
    operator.passwordHash = passwordHash;
    operator.role = 'OPERATOR';
    await operator.save();
    console.log(`[Server] Operator account reset: ${operatorEmail}`);
  } else {
    await User.create({
      name: 'Municipal Officer',
      email: operatorEmail,
      passwordHash,
      role: 'OPERATOR',
    });
    console.log(`[Server] Operator account created: ${operatorEmail}`);
  }
}

async function startServer() {
  try {
    await connectDB();

    // Check if database needs initial seeding (development demo mode only)
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      if (ENV.NODE_ENV !== 'production') {
        console.log('[Server] Database is empty. Running initial demo seed for local development...');
        await runSeed();
      } else {
        console.log('[Server] Production mode: database is empty. Automatic seeding is disabled for live integrity.');
      }
    }

    // Ensure operator account exists and has correct credentials
    await ensureOperatorAccount();

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

