import express from 'express';
import { THRESHOLDS } from '../config/thresholds.js';
import { ENV } from '../config/env.js';

const router = express.Router();

router.get('/config', (req, res) => {
  res.json({
    thresholds: {
      DUP_RADIUS_M: THRESHOLDS.DUP_RADIUS_M,
      DUP_WINDOW_DAYS: THRESHOLDS.DUP_WINDOW_DAYS,
      DUP_LOOSE_CATEGORY: THRESHOLDS.DUP_LOOSE_CATEGORY,
      FALLBACK_SPEED_KMH: THRESHOLDS.FALLBACK_SPEED_KMH,
      FALLBACK_DETOUR: THRESHOLDS.FALLBACK_DETOUR,
    },
    depot: THRESHOLDS.DEPOT_COORDINATES,
    categories: THRESHOLDS.CATEGORIES,
    categoryLabels: THRESHOLDS.CATEGORY_LABELS,
    serviceAreaBbox: THRESHOLDS.SERVICE_AREA_BBOX,
    creditValues: THRESHOLDS.CREDIT_VALUES,
    features: {
      simulatedTraffic: true,
      forecast: 'BASELINE_SYNTHETIC',
      visionProvider: ENV.VISION_PROVIDER,
      storageDriver: ENV.STORAGE_DRIVER,
    },
  });
});

export const configRoutes = router;
