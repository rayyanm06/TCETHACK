/**
 * Pure Hotspot Analytics & Baseline Forecasting Engine for CivicClean
 * Aggregates unique historical incidents on a spatial grid and computes weighted multi-week forecasts.
 */

export const GRID_CELL_DEG = 0.005; // ~550m
export const FORECAST_WEIGHTS = [0.5, 0.3, 0.2]; // t, t-1, t-2
export const PREDICTION_THRESHOLD = 1.5;

/**
 * Returns cellId and cell center coordinates for given lat/lng.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [gridDeg=0.005]
 * @returns {{cellId: string, center: {lat: number, lng: number}}}
 */
export function getGridCell(lat, lng, gridDeg = GRID_CELL_DEG) {
  const latIdx = Math.floor(lat / gridDeg);
  const lngIdx = Math.floor(lng / gridDeg);
  const cellId = `${latIdx}:${lngIdx}`;
  const centerLat = (latIdx + 0.5) * gridDeg;
  const centerLng = (lngIdx + 0.5) * gridDeg;
  return {
    cellId,
    center: {
      lat: Math.round(centerLat * 100000) / 100000,
      lng: Math.round(centerLng * 100000) / 100000,
    },
  };
}

/**
 * Aggregates incidents into weekly cell counts.
 * @param {Array<Object>} incidents Array of {location: {lat, lng}, weekIndex: number}
 * @param {number} [gridDeg=GRID_CELL_DEG]
 * @returns {Map<string, Map<number, number>>} cellId -> (weekIndex -> count)
 */
export function aggregateGridCounts(incidents = [], gridDeg = GRID_CELL_DEG) {
  const cellWeeklyMap = new Map(); // cellId -> Map(weekIndex -> count)
  const cellCenters = new Map(); // cellId -> {lat, lng}

  for (const inc of incidents) {
    const lat = inc.location?.lat ?? inc.location?.coordinates?.[1];
    const lng = inc.location?.lng ?? inc.location?.coordinates?.[0];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const week = Number(inc.weekIndex) || 1;
    const { cellId, center } = getGridCell(lat, lng, gridDeg);
    if (!cellCenters.has(cellId)) {
      cellCenters.set(cellId, center);
    }

    if (!cellWeeklyMap.has(cellId)) {
      cellWeeklyMap.set(cellId, new Map());
    }
    const weekMap = cellWeeklyMap.get(cellId);
    weekMap.set(week, (weekMap.get(week) || 0) + 1);
  }

  return { cellWeeklyMap, cellCenters };
}

/**
 * Computes baseline forecast for next week and calculates evaluation error on held-out week.
 * @param {Array<Object>} incidents
 * @param {number} [totalHistoryWeeks=12]
 * @param {number} [heldOutWeek=12]
 * @returns {Object} Forecast results, weekly totals, and evaluation metrics
 */
export function computeHotspotForecast(
  incidents = [],
  totalHistoryWeeks = 12,
  heldOutWeek = 12
) {
  const { cellWeeklyMap, cellCenters } = aggregateGridCounts(incidents, GRID_CELL_DEG);

  // 1. Structure weekly counts for visualization
  const weeklyData = [];
  for (let w = 1; w <= totalHistoryWeeks; w++) {
    const cellsInWeek = [];
    let weekTotal = 0;
    for (const [cellId, weekMap] of cellWeeklyMap.entries()) {
      const count = weekMap.get(w) || 0;
      if (count > 0) {
        weekTotal += count;
        cellsInWeek.push({
          cellId,
          center: cellCenters.get(cellId),
          count,
        });
      }
    }
    weeklyData.push({
      weekIndex: w,
      totalUnique: weekTotal,
      cells: cellsInWeek,
    });
  }

  // 2. Compute forecast for week 13 using weeks 12, 11, 10
  const forecastCells = [];
  const [w1, w2, w3] = FORECAST_WEIGHTS;

  for (const [cellId, weekMap] of cellWeeklyMap.entries()) {
    const n12 = weekMap.get(totalHistoryWeeks) || 0;
    const n11 = weekMap.get(totalHistoryWeeks - 1) || 0;
    const n10 = weekMap.get(totalHistoryWeeks - 2) || 0;

    const expected = Math.round((w1 * n12 + w2 * n11 + w3 * n10) * 10) / 10;
    if (expected >= PREDICTION_THRESHOLD) {
      forecastCells.push({
        cellId,
        center: cellCenters.get(cellId),
        expected,
        lastWeeks: [n12, n11, n10],
      });
    }
  }

  // Sort descending by expected waste incidents
  forecastCells.sort((a, b) => b.expected - a.expected);

  // 3. Evaluation on held-out week 12 (using weeks 11, 10, 9 to predict week 12)
  let sumAbsDiffModel = 0;
  let sumAbsDiffLastWeek = 0;
  let sumAbsDiffMean = 0;
  let evaluatedCellsCount = 0;

  for (const [cellId, weekMap] of cellWeeklyMap.entries()) {
    const actual12 = weekMap.get(totalHistoryWeeks) || 0;
    const n11 = weekMap.get(totalHistoryWeeks - 1) || 0;
    const n10 = weekMap.get(totalHistoryWeeks - 2) || 0;
    const n9 = weekMap.get(totalHistoryWeeks - 3) || 0;

    // Only evaluate cells that had at least some activity in weeks 9-12
    if (actual12 === 0 && n11 === 0 && n10 === 0 && n9 === 0) continue;

    evaluatedCellsCount++;
    const pred12 = w1 * n11 + w2 * n10 + w3 * n9;
    sumAbsDiffModel += Math.abs(actual12 - pred12);

    // Naive baseline 1: predict previous week (week 11)
    sumAbsDiffLastWeek += Math.abs(actual12 - n11);

    // Naive baseline 2: mean of weeks 1-11
    let sum11 = 0;
    for (let i = 1; i < totalHistoryWeeks; i++) sum11 += weekMap.get(i) || 0;
    const mean11 = sum11 / (totalHistoryWeeks - 1);
    sumAbsDiffMean += Math.abs(actual12 - mean11);
  }

  const denom = Math.max(1, evaluatedCellsCount);
  const maeModel = Math.round((sumAbsDiffModel / denom) * 100) / 100;
  const maeLastWeek = Math.round((sumAbsDiffLastWeek / denom) * 100) / 100;
  const maeMean = Math.round((sumAbsDiffMean / denom) * 100) / 100;

  return {
    label: 'Weighted historical baseline',
    gridCellDeg: GRID_CELL_DEG,
    weeks: weeklyData,
    forecast: {
      weekIndex: totalHistoryWeeks + 1,
      method: 'Weighted recent activity: 0.5 × last week + 0.3 × previous week + 0.2 × third week',
      weights: FORECAST_WEIGHTS,
      cells: forecastCells,
    },
    evaluation: {
      heldOutWeek,
      maeModel,
      maeLastWeek,
      maeMean,
      note: `Held-out week ${heldOutWeek}: model MAE ${maeModel} vs naive last-week baseline ${maeLastWeek}.`,
    },
  };
}
