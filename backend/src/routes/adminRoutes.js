import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { runSeed } from '../../scripts/seed.js';
import { ENV } from '../config/env.js';

const router = express.Router();

router.post('/admin/reset-demo', authenticate, requireRole(['OPERATOR']), async (req, res, next) => {
  try {
    if (!ENV.ALLOW_DEMO_RESET && ENV.NODE_ENV === 'production') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Demo reset disabled in production mode.' },
      });
    }

    const counts = await runSeed(true);
    res.status(200).json({
      ok: true,
      message: 'Demo dataset reset successfully.',
      counts,
    });
  } catch (err) {
    next(err);
  }
});

export const adminRoutes = router;
