import { app } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
export default async function handler(req, res) {
  try { await connectDB(); }
  catch { return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again later.' } }); }
  return app(req, res);
}
