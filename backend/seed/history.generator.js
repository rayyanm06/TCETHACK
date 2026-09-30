/**
 * Deterministic Synthetic History Generator for CivicClean
 * Generates ~120 historical incidents across 12 weeks clustered around key municipal zones.
 */

import { getGridCell, GRID_CELL_DEG } from '../src/engines/forecast.js';

// Simple deterministic PRNG (Linear Congruential Generator)
function createRng(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateSyntheticHistory(depot = { lat: 19.2071, lng: 72.8760 }) {
  const rng = createRng(1024);

  // 4 Hotspot cluster centers near the venue/depot
  const clusters = [
    { name: 'Market Zone A', lat: depot.lat + 0.006, lng: depot.lng + 0.005, weight: 0.35 },
    { name: 'Station Road B', lat: depot.lat - 0.007, lng: depot.lng - 0.004, weight: 0.30 },
    { name: 'Industrial Strip C', lat: depot.lat + 0.002, lng: depot.lng - 0.008, weight: 0.20 },
    { name: 'Residential Colony D', lat: depot.lat - 0.005, lng: depot.lng + 0.007, weight: 0.15 },
  ];

  const categories = ['ORGANIC', 'PLASTIC', 'MIXED', 'PAPER', 'METAL'];
  const incidents = [];

  const baseDate = new Date('2026-06-01T00:00:00Z');

  for (let week = 1; week <= 12; week++) {
    // Weekly incident count ~ 9 - 13 incidents per week
    const weekCount = 9 + Math.floor(rng() * 4);

    for (let i = 0; i < weekCount; i++) {
      // Pick cluster based on weights
      const roll = rng();
      let chosenCluster = clusters[0];
      let cum = 0;
      for (const cl of clusters) {
        cum += cl.weight;
        if (roll <= cum) {
          chosenCluster = cl;
          break;
        }
      }

      // Add small gaussian-like jitter (within ~200m)
      const latOffset = (rng() - 0.5) * 0.0035;
      const lngOffset = (rng() - 0.5) * 0.0035;
      const lat = chosenCluster.lat + latOffset;
      const lng = chosenCluster.lng + lngOffset;

      const { cellId } = getGridCell(lat, lng, GRID_CELL_DEG);
      const cat = categories[Math.floor(rng() * categories.length)];

      const dayOffset = Math.floor(rng() * 7);
      const incidentDate = new Date(baseDate.getTime() + ((week - 1) * 7 + dayOffset) * 24 * 3600 * 1000);

      incidents.push({
        date: incidentDate,
        weekIndex: week,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        cellId,
        category: cat,
        source: 'SYNTHETIC',
        isSeed: true,
      });
    }
  }

  return incidents;
}
