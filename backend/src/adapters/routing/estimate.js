import { computeFallbackMatrix } from '../../engines/routing.js';

export function fetchEstimateTable(points) {
  const { durations, distances } = computeFallbackMatrix(points);
  return {
    durations,
    distances,
    costSource: 'ESTIMATE',
  };
}

export function fetchEstimateRoute(orderedPoints) {
  // Straight line geometry in [lat, lng] format
  const coordinates = orderedPoints.map((p) => [p.lat, p.lng]);
  return {
    geometry: coordinates,
    legs: [],
    costSource: 'ESTIMATE',
  };
}
