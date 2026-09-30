import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getHotspotAnalytics } from '../services/analyticsService.js';

const router = express.Router();

router.get('/analytics/hotspots', authenticate, requireRole(['OPERATOR']), async (req, res, next) => {
  try {
    const result = await getHotspotAnalytics(req.query.weeks);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const analyticsRoutes = router;
