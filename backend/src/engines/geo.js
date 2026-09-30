/**
 * Pure Geo Engine for CivicClean
 * Handles coordinate distance calculations, bounding boxes, and spatial intersections.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Great Circle Haversine distance between two coordinates in meters.
 * @param {{lat: number, lng: number}} c1
 * @param {{lat: number, lng: number}} c2
 * @returns {number} Distance in meters
 */
export function haversineDistance(c1, c2) {
  if (!c1 || !c2 || typeof c1.lat !== 'number' || typeof c2.lat !== 'number') {
    return Infinity;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(c2.lat - c1.lat);
  const dLng = toRad(c2.lng - c1.lng);
  const lat1 = toRad(c1.lat);
  const lat2 = toRad(c2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Checks if coordinate is inside a bounding box.
 * @param {{lat: number, lng: number}} coord
 * @param {[number, number, number, number]} bbox [minLng, minLat, maxLng, maxLat]
 * @returns {boolean}
 */
export function isInsideBoundingBox(coord, bbox) {
  if (!coord || !bbox || bbox.length !== 4) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    coord.lng >= minLng &&
    coord.lng <= maxLng &&
    coord.lat >= minLat &&
    coord.lat <= maxLat
  );
}

/**
 * Checks if point is inside a circle of given radius in meters.
 * @param {{lat: number, lng: number}} point
 * @param {{lat: number, lng: number}} center
 * @param {number} radiusM
 * @returns {boolean}
 */
export function isPointInCircle(point, center, radiusM) {
  return haversineDistance(point, center) <= radiusM;
}

/**
 * Checks if a straight segment between p1 and p2 intersects or comes within radiusM of center.
 * Used for simulated congestion matrix cost calculations.
 * @param {{lat: number, lng: number}} p1
 * @param {{lat: number, lng: number}} p2
 * @param {{lat: number, lng: number}} center
 * @param {number} radiusM
 * @returns {boolean}
 */
export function doesSegmentIntersectCircle(p1, p2, center, radiusM) {
  // If either endpoint is inside the circle, it intersects
  if (isPointInCircle(p1, center, radiusM) || isPointInCircle(p2, center, radiusM)) {
    return true;
  }

  // Quick bounding box check around p1 and p2
  const minLat = Math.min(p1.lat, p2.lat) - 0.02;
  const maxLat = Math.max(p1.lat, p2.lat) + 0.02;
  const minLng = Math.min(p1.lng, p2.lng) - 0.02;
  const maxLng = Math.max(p1.lng, p2.lng) + 0.02;
  if (
    center.lat < minLat ||
    center.lat > maxLat ||
    center.lng < minLng ||
    center.lng > maxLng
  ) {
    return false;
  }

  // Sample points along the segment to detect intersection with radius
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sampled = {
      lat: p1.lat + t * (p2.lat - p1.lat),
      lng: p1.lng + t * (p2.lng - p1.lng),
    };
    if (isPointInCircle(sampled, center, radiusM)) {
      return true;
    }
  }

  return false;
}
