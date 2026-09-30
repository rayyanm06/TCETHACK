import { DISPOSAL_SOURCES, handlingFor } from '../services/disposalService.js';
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
    disposalSources: DISPOSAL_SOURCES,
    disposalGuides: THRESHOLDS.CATEGORIES.map(category => ({category, ...handlingFor(category)})),
    categories: THRESHOLDS.CATEGORIES,
    categoryLabels: THRESHOLDS.CATEGORY_LABELS,
    serviceAreaBbox: THRESHOLDS.SERVICE_AREA_BBOX,
    creditValues: THRESHOLDS.CREDIT_VALUES,
    features: {
      demoMode: ENV.DEMO_MODE,
      simulatedTraffic: ENV.DEMO_MODE,
      forecast: 'REAL_HISTORY_ONLY',
      visionProvider: ENV.VISION_PROVIDER,
      storageDriver: ENV.STORAGE_DRIVER,
    },
  });
});

export const configRoutes = router;
