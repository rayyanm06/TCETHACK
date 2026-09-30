import { app } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { runSeed } from '../scripts/seed.js';

let isReady = false;

export default async function handler(req, res) {
  if (!isReady) {
    try {
      const conn = await connectDB();
      if (conn) {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          await runSeed();
        }
      }
      isReady = true;
    } catch (err) {
      console.error('[Vercel Handler DB Error]', err);
    }
  }

  return app(req, res);
}
