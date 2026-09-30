/**
 * Pure Traffic & Congestion Replanning Engine for CivicClean
 * Applies simulated congestion factors and replans remaining active route stops while locking completed stops.
 */

import { doesSegmentIntersectCircle } from './geo.js';

/**
 * Calculates congestion multiplier for a segment between two points against active congestion zones.
 * If multiple zones intersect, uses the maximum factor.
 * @param {{lat: number, lng: number}} p1
 * @param {{lat: number, lng: number}} p2
 * @param {Array<Object>} [zones=[]]
 * @returns {number} Multiplier (>= 1.0)
 */
export function getSegmentCongestionFactor(p1, p2, zones = []) {
  if (!zones || zones.length === 0 || !p1 || !p2) {
    return 1.0;
  }

  let maxFactor = 1.0;
  for (const zone of zones) {
    const factor = Number(zone.factor) || 1.0;
    if (factor <= 1.0) continue;

    const center = zone.center;
    const radiusM = Number(zone.radiusM) || 500;

    if (doesSegmentIntersectCircle(p1, p2, center, radiusM)) {
      if (factor > maxFactor) {
        maxFactor = factor;
      }
    }
  }

  return maxFactor;
}

/**
 * Applies congestion multipliers to a base duration matrix.
 * @param {number[][]} baseMatrix
 * @param {Array<{lat: number, lng: number}>} points
 * @param {Array<Object>} [zones=[]]
 * @returns {number[][]} Adjusted duration matrix
 */
export function applyCongestionToMatrix(baseMatrix, points, zones = []) {
  const n = baseMatrix.length;
  const congested = [];

  for (let i = 0; i < n; i++) {
    congested[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        congested[i][j] = 0;
        continue;
      }
      const factor = getSegmentCongestionFactor(points[i], points[j], zones);
      congested[i][j] = Math.round(baseMatrix[i][j] * factor * 10) / 10;
    }
  }

  return congested;
}
