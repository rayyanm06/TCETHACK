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
    serviceAreaDescription: 'Rectangular pilot service area: Kandivali East / Borivali East pilot zone (72.84°E to 72.91°E, 19.18°N to 19.24°N)',
    creditValues: THRESHOLDS.CREDIT_VALUES,
    features: {
      simulatedTraffic: true,
      forecast: 'BASELINE_SYNTHETIC',
      visionProvider: ENV.VISION_PROVIDER,
      storageDriver: ENV.STORAGE_DRIVER,
    },
  });
});

// GET /api/geocode/reverse
router.get('/geocode/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      error: { code: 'INVALID_COORDINATES', message: 'Valid lat and lng query params are required.' },
    });
  }

  // 1. Attempt OpenStreetMap Nominatim reverse geocode with 3.5s timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CivicClean-Pilot/1.0 (waste-management-pilot@civicclean.local)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const parts = [
        addr.road || addr.pedestrian || addr.street,
        addr.suburb || addr.neighbourhood || addr.residential || addr.quarter,
        addr.city || addr.town || addr.district || 'Mumbai',
        addr.postcode,
      ].filter(Boolean);

      const readableAddress =
        parts.length > 0
          ? parts.join(', ')
          : data.display_name?.split(',').slice(0, 3).join(', ') ||
            `Near (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      return res.status(200).json({
        ok: true,
        address: readableAddress,
        fullAddress: data.display_name,
        source: 'NOMINATIM',
        raw: addr,
      });
    }
  } catch (err) {
    // Graceful fallback if network is offline or Nominatim times out
  }

  // Fallback based on pilot boundaries
  let fallbackArea = 'Kandivali East / Borivali East, Mumbai';
  if (lat >= 19.20 && lat <= 19.22 && lng >= 72.86 && lng <= 72.89) {
    fallbackArea = 'Thakur Complex, Kandivali East, Mumbai';
  } else if (lat > 19.22) {
    fallbackArea = 'Borivali East, Mumbai';
  } else if (lat < 19.20) {
    fallbackArea = 'Akurli Road / Poisar, Kandivali East, Mumbai';
  }

  return res.status(200).json({
    ok: true,
    address: `${fallbackArea} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    source: 'PILOT_FALLBACK',
  });
});

export const configRoutes = router;

