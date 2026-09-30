import { ENV } from '../../config/env.js';
import { fetchOsrmTable, fetchOsrmRoute } from './osrm.js';
import { fetchEstimateTable, fetchEstimateRoute } from './estimate.js';

export async function getDurationMatrix(points) {
  try {
    return await fetchOsrmTable(points);
  } catch (err) {
    if (!ENV.ALLOW_ROUTING_ESTIMATES) throw Object.assign(new Error('Road routing is unavailable. Retry shortly; no estimated route has been substituted.'), {status: 503, code: 'ROUTING_UNAVAILABLE'});
    console.warn('[Routing] OSRM table unavailable, using estimate fallback:', err.message);
    return fetchEstimateTable(points);
  }
}

export async function getRouteGeometry(orderedPoints) {
  try {
    return await fetchOsrmRoute(orderedPoints);
  } catch (err) {
    if (!ENV.ALLOW_ROUTING_ESTIMATES) throw Object.assign(new Error('Road routing is unavailable. Retry shortly; no estimated route has been substituted.'), {status: 503, code: 'ROUTING_UNAVAILABLE'});
    console.warn('[Routing] OSRM route unavailable, using straight-line geometry:', err.message);
    return fetchEstimateRoute(orderedPoints);
  }
}
