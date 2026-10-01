/**
 * CivicClean Configurable Prototype Thresholds (§9.9)
 * All values have standard defaults and can be overridden via environment variables.
 */

export const THRESHOLDS = {
  DUP_RADIUS_M: Number(process.env.DUP_RADIUS_M) || 100,
  DUP_WINDOW_DAYS: Number(process.env.DUP_WINDOW_DAYS) || 7,
  DUP_LOOSE_CATEGORY: process.env.DUP_LOOSE_CATEGORY !== 'false',
  SERVICE_AREA_BBOX: [72.75, 18.85, 73.05, 19.35], // [minLng, minLat, maxLng, maxLat] covering Greater Mumbai
  DEPOT_COORDINATES: {
    lat: 19.2071,
    lng: 72.8760,
    name: 'North Municipal Central Depot',
  },
  CATEGORIES: [
    'ORGANIC',
    'PLASTIC',
    'PAPER',
    'GLASS',
    'METAL',
    'E_WASTE',
    'MIXED',
    'UNKNOWN',
  ],
  CATEGORY_LABELS: {
    ORGANIC: 'Organic',
    PLASTIC: 'Plastic',
    PAPER: 'Paper',
    GLASS: 'Glass',
    METAL: 'Metal',
    E_WASTE: 'E-waste',
    MIXED: 'Mixed',
    UNKNOWN: 'Unknown',
  },
  CREDIT_VALUES: {
    UNIQUE_REPORT: 10,
    SUPPORTING_REPORT: 3,
    SUPPORT_CREDIT_CAP: 3,
    CLASSIFICATION_CORRECTION: 4,
    RESOLUTION_PRIMARY_BONUS: 5,
    RESOLUTION_SUPPORTING_BONUS: 2,
  },
  GRID_CELL_DEG: 0.005, // ~550m
  FORECAST_WEIGHTS: [0.5, 0.3, 0.2],
  FALLBACK_SPEED_KMH: 22,
  FALLBACK_DETOUR: 1.35,
};
