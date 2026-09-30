import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getCitizenImpactSummary, getOperatorImpactOverview } from '../services/impactService.js';

const router = express.Router();

// GET /api/impact/me (Citizen ledger and "What changed" feed)
router.get('/impact/me', authenticate, requireRole(['CITIZEN']), async (req, res, next) => {
  try {
    const result = await getCitizenImpactSummary(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/impact/leaderboard (OPERATOR ONLY - 403 for citizens)
router.get('/impact/leaderboard', authenticate, requireRole(['OPERATOR']), async (req, res, next) => {
  try {
    const result = await getOperatorImpactOverview();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const impactRoutes = router;
