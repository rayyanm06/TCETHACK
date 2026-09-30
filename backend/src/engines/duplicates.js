/**
 * Pure Duplicate Detection Engine for CivicClean
 * Matches incoming reports against unresolved events within radius and time window.
 */

import { haversineDistance } from './geo.js';

export const DEFAULT_DUP_RADIUS_M = 100;
export const DEFAULT_DUP_WINDOW_DAYS = 7;

/**
 * Checks category compatibility between report and existing event.
 * E_WASTE must always match exact.
 * If loose matching enabled, MIXED or UNKNOWN matches other non-E_WASTE categories.
 * @param {string} catA
 * @param {string} catB
 * @param {boolean} [loose=true]
 * @returns {boolean}
 */
export function areCategoriesCompatible(catA, catB, loose = true) {
  if (!catA || !catB) return false;
  if (catA === catB) return true;

  // E_WASTE is never compatible with anything other than E_WASTE
  if (catA === 'E_WASTE' || catB === 'E_WASTE') {
    return false;
  }

  if (loose) {
    if (catA === 'MIXED' || catB === 'MIXED' || catA === 'UNKNOWN' || catB === 'UNKNOWN') {
      return true;
    }
  }

  return false;
}

/**
 * Finds candidate duplicate events for an incoming report coordinate & category.
 * @param {Object} params
 * @param {{lat: number, lng: number}} params.location Incoming report location
 * @param {string} params.category Incoming category
 * @param {Array<Object>} params.events List of active candidate events
 * @param {number} [params.radiusM=100]
 * @param {number} [params.windowDays=7]
 * @param {boolean} [params.looseCategory=true]
 * @param {Date|string|number} [params.now=new Date()]
 * @returns {Array<Object>} Ranked duplicate candidates (max 3)
 */
export function findDuplicateCandidates({
  location,
  category,
  events = [],
  radiusM = DEFAULT_DUP_RADIUS_M,
  windowDays = DEFAULT_DUP_WINDOW_DAYS,
  looseCategory = true,
  now = new Date(),
}) {
  if (!location || !category || !Array.isArray(events)) {
    return [];
  }

  const nowMs = new Date(now).getTime();
  const maxAgeMs = windowDays * 24 * 60 * 60 * 1000;
  const activeStatuses = new Set(['SUBMITTED', 'VERIFIED', 'SCHEDULED']);

  const candidates = [];

  for (const event of events) {
    // 1. Status must be unresolved
    if (!activeStatuses.has(event.status)) {
      continue;
    }

    // 2. Time window check
    const eventTimeMs = new Date(event.firstReportedAt || event.createdAt || now).getTime();
    const ageMs = Math.max(0, nowMs - eventTimeMs);
    if (ageMs > maxAgeMs) {
      continue;
    }

    // 3. Category compatibility check
    if (!areCategoriesCompatible(category, event.category, looseCategory)) {
      continue;
    }

    // 4. Distance check
    const eventLoc = event.location?.coordinates
      ? { lng: event.location.coordinates[0], lat: event.location.coordinates[1] }
      : event.location;

    if (!eventLoc || typeof eventLoc.lat !== 'number' || typeof eventLoc.lng !== 'number') {
      continue;
    }

    const distanceM = haversineDistance(location, eventLoc);
    if (distanceM <= radiusM) {
      candidates.push({
        id: event._id ? event._id.toString() : event.id,
        code: event.code,
        category: event.category,
        distanceM: Math.round(distanceM),
        ageHours: Math.round(ageMs / (1000 * 60 * 60)),
        supportCount: event.supportCount || 0,
        photoUrl: event.photoUrl || event.thumbnailUrl || (event.photos && event.photos[0]),
        status: event.status,
      });
    }
  }

  // Sort by closest distance first, top 3
  candidates.sort((a, b) => a.distanceM - b.distanceM);
  return candidates.slice(0, 3);
}
