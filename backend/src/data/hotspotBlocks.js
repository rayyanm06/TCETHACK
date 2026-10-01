/**
 * Municipal Operational Hotspot Blocks Configuration & Calculator
 * Defines realistic, localized municipal ward sectors/blocks across Kanjurmarg,
 * Mira Road / Bhayandar, Kalyan, and Central Suburbs.
 */

export const MUNICIPAL_HOTSPOT_BLOCKS = [
  // --- KANJURMARG CLUSTER ---
  {
    id: 'block_kanj_east',
    code: 'KANJ-E1',
    name: 'Kanjurmarg East Industrial Block',
    area: 'Kanjurmarg',
    description: 'Station East & Crompton Greaves commercial manufacturing corridor.',
    center: { lat: 19.1325, lng: 72.9360 },
    polygon: [
      [19.1350, 72.9330],
      [19.1350, 72.9400],
      [19.1300, 72.9400],
      [19.1300, 72.9330],
    ],
  },
  {
    id: 'block_kanj_west',
    code: 'KANJ-W1',
    name: 'Kanjurmarg West LBS Corridor',
    area: 'Kanjurmarg',
    description: 'High-density commercial corridor and residential access lanes along LBS Marg.',
    center: { lat: 19.1275, lng: 72.9265 },
    polygon: [
      [19.1300, 72.9235],
      [19.1300, 72.9298],
      [19.1248, 72.9298],
      [19.1248, 72.9235],
    ],
  },
  {
    id: 'block_kanj_jvlr',
    code: 'KANJ-JV1',
    name: 'Kanjurmarg JVLR Junction Sector',
    area: 'Kanjurmarg',
    description: 'Jogeshwari-Vikhroli Link Road interchange & transit underpass sector.',
    center: { lat: 19.1370, lng: 72.9315 },
    polygon: [
      [19.1395, 72.9285],
      [19.1395, 72.9350],
      [19.1345, 72.9350],
      [19.1345, 72.9285],
    ],
  },

  // --- MIRA ROAD / BHAYANDAR CLUSTER ---
  {
    id: 'block_mira_shanti',
    code: 'MB-SHAN1',
    name: 'Mira Road Shanti Nagar Sector',
    area: 'Mira Road / Bhayandar',
    description: 'Sector 4 market hub, residential complexes, and station road approach.',
    center: { lat: 19.2840, lng: 72.8580 },
    polygon: [
      [19.2870, 72.8545],
      [19.2870, 72.8620],
      [19.2810, 72.8620],
      [19.2810, 72.8545],
    ],
  },
  {
    id: 'block_mira_bev',
    code: 'MB-BEV1',
    name: 'Mira Road Beverly Park Block',
    area: 'Mira Road / Bhayandar',
    description: 'High-rise residential and commercial shopping arcade zone.',
    center: { lat: 19.2890, lng: 72.8690 },
    polygon: [
      [19.2920, 72.8655],
      [19.2920, 72.8730],
      [19.2860, 72.8730],
      [19.2860, 72.8655],
    ],
  },
  {
    id: 'block_bhy_east',
    code: 'MB-BHY-E',
    name: 'Bhayandar East Market Block',
    area: 'Mira Road / Bhayandar',
    description: 'Navghar Road wholesale vegetable market & railway crossing perimeter.',
    center: { lat: 19.2990, lng: 72.8590 },
    polygon: [
      [19.3020, 72.8555],
      [19.3020, 72.8630],
      [19.2960, 72.8630],
      [19.2960, 72.8555],
    ],
  },
  {
    id: 'block_bhy_west',
    code: 'MB-BHY-W',
    name: 'Bhayandar West 60-Ft Road Corridor',
    area: 'Mira Road / Bhayandar',
    description: 'Maxus mall avenue, flyover ramp base, and commercial eateries strip.',
    center: { lat: 19.3040, lng: 72.8465 },
    polygon: [
      [19.3070, 72.8430],
      [19.3070, 72.8505],
      [19.3010, 72.8505],
      [19.3010, 72.8430],
    ],
  },

  // --- KALYAN CLUSTER ---
  {
    id: 'block_klyn_stn',
    code: 'KLYN-W1',
    name: 'Kalyan West Station Hub',
    area: 'Kalyan',
    description: 'Shivaji Chowk, bus depot terminus, and high-footfall passenger transit area.',
    center: { lat: 19.2435, lng: 73.1290 },
    polygon: [
      [19.2470, 73.1255],
      [19.2470, 73.1330],
      [19.2400, 73.1330],
      [19.2400, 73.1255],
    ],
  },
  {
    id: 'block_klyn_kate',
    code: 'KLYN-E1',
    name: 'Kalyan East Katemanivali Block',
    area: 'Kalyan',
    description: 'Dense residential neighborhood, school zones, and community waste bins.',
    center: { lat: 19.2315, lng: 73.1385 },
    polygon: [
      [19.2350, 73.1350],
      [19.2350, 73.1425],
      [19.2280, 73.1425],
      [19.2280, 73.1350],
    ],
  },
  {
    id: 'block_klyn_mandi',
    code: 'KLYN-MANDI',
    name: 'Kalyan APMC Mandi Sector',
    area: 'Kalyan',
    description: 'Wholesale agricultural produce market with high organic generation rates.',
    center: { lat: 19.2380, lng: 73.1450 },
    polygon: [
      [19.2415, 73.1415],
      [19.2415, 73.1490],
      [19.2345, 73.1490],
      [19.2345, 73.1415],
    ],
  },
  {
    id: 'block_klyn_khad',
    code: 'KLYN-KHAD',
    name: 'Kalyan West Khadakpada Avenue',
    area: 'Kalyan',
    description: 'Civic center boulevard, educational institutions, and restaurant cluster.',
    center: { lat: 19.2560, lng: 73.1360 },
    polygon: [
      [19.2595, 73.1325],
      [19.2595, 73.1400],
      [19.2525, 73.1400],
      [19.2525, 73.1325],
    ],
  },

  // --- CENTRAL SUBURBS CLUSTER ---
  {
    id: 'block_centr_mkt',
    code: 'CENTR-MKT',
    name: 'North Central Market Sector',
    area: 'Central Suburbs',
    description: 'Municipal subzi mandi perimeter and primary collection zone.',
    center: { lat: 19.2105, lng: 72.8795 },
    polygon: [
      [19.2140, 72.8760],
      [19.2140, 72.8835],
      [19.2070, 72.8835],
      [19.2070, 72.8760],
    ],
  },
  {
    id: 'block_centr_stn',
    code: 'CENTR-STN',
    name: 'Station Enclave Corridor',
    area: 'Central Suburbs',
    description: 'Railway approach and transit terminus collector road.',
    center: { lat: 19.2045, lng: 72.8735 },
    polygon: [
      [19.2080, 72.8700],
      [19.2080, 72.8775],
      [19.2010, 72.8775],
      [19.2010, 72.8700],
    ],
  },
];

/**
 * Check if a point [lat, lng] is inside a polygon using ray casting
 */
function isPointInPolygon(point, vs) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes active metrics for each hotspot block from the live/seeded waste events.
 * Transparently aggregates all reports:
 * - Predefined blocks with 0 events are shown neutrally ('CLEAR', 'None')
 * - Any reports outside hardcoded blocks are dynamically aggregated into an 'Other Locations' block,
 *   ensuring no valid report is ever omitted or hidden from operator lenses.
 */
export function computeHotspotBlocks(events = []) {
  const priorityWeight = {
    Critical: 4,
    High: 3,
    Normal: 2,
    Low: 1,
  };

  const matchedEventIds = new Set();

  const predefinedBlocks = MUNICIPAL_HOTSPOT_BLOCKS.map((block) => {
    // Filter events inside this block's polygon boundary
    const blockEvents = events.filter((ev) => {
      const lat = ev.location?.lat ?? ev.location?.coordinates?.[1] ?? ev.loc?.lat;
      const lng = ev.location?.lng ?? ev.location?.coordinates?.[0] ?? ev.loc?.lng;
      if (lat === undefined || lng === undefined) return false;
      const isInside = isPointInPolygon([lat, lng], block.polygon);
      if (isInside) {
        matchedEventIds.add((ev._id ? ev._id.toString() : ev.id).toString());
      }
      return isInside;
    });

    const eventCount = blockEvents.length;
    let highestPriority = eventCount > 0 ? 'Low' : 'None';
    let highestPriorityVal = eventCount > 0 ? 1 : 0;
    let totalWeightKg = 0;
    let criticalCount = 0;
    let scheduledCount = 0;

    for (const ev of blockEvents) {
      const tier = ev.priority?.tier || 'Low';
      const val = priorityWeight[tier] || 1;
      if (val > highestPriorityVal) {
        highestPriorityVal = val;
        highestPriority = tier;
      }
      if (tier === 'Critical' || tier === 'High') {
        criticalCount++;
      }
      if (ev.status === 'SCHEDULED' || ev.status === 'RESOLVED') {
        scheduledCount++;
      }
      totalWeightKg += Number(ev.estimatedWeightKg || 0);
    }

    let status = 'CLEAR';
    if (eventCount > 0) {
      if (criticalCount > 0 && highestPriority === 'Critical') {
        status = 'CRITICAL_TRIAGE';
      } else if (highestPriority === 'High') {
        status = 'ACTIVE_MONITORING';
      } else if (scheduledCount === eventCount) {
        status = 'SCHEDULED_FOR_PICKUP';
      } else {
        status = 'NORMAL';
      }
    }

    return {
      ...block,
      eventCount,
      priorityTier: highestPriority,
      estimatedLoadKg: Math.round(totalWeightKg),
      criticalCount,
      status,
      eventIds: blockEvents.map((e) => (e._id ? e._id.toString() : e.id).toString()),
    };
  });

  // Collect any events outside all predefined polygons into "Other Locations"
  const unzonedEvents = events.filter(
    (ev) => !matchedEventIds.has((ev._id ? ev._id.toString() : ev.id).toString())
  );

  let otherBlock = null;
  if (unzonedEvents.length > 0) {
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    let totalWeightKg = 0;
    let highestPriority = 'Low';
    let highestPriorityVal = 1;
    let criticalCount = 0;
    let scheduledCount = 0;

    for (const ev of unzonedEvents) {
      const lat = ev.location?.lat ?? ev.location?.coordinates?.[1] ?? ev.loc?.lat;
      const lng = ev.location?.lng ?? ev.location?.coordinates?.[0] ?? ev.loc?.lng;
      if (lat !== undefined && lng !== undefined) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
      const tier = ev.priority?.tier || 'Low';
      const val = priorityWeight[tier] || 1;
      if (val > highestPriorityVal) {
        highestPriorityVal = val;
        highestPriority = tier;
      }
      if (tier === 'Critical' || tier === 'High') {
        criticalCount++;
      }
      if (ev.status === 'SCHEDULED' || ev.status === 'RESOLVED') {
        scheduledCount++;
      }
      totalWeightKg += Number(ev.estimatedWeightKg || 0);
    }

    const pad = 0.006;
    otherBlock = {
      id: 'block_other_locations',
      code: 'OTHER',
      name: 'Other Locations / Active Reports',
      area: 'Greater Mumbai',
      description: 'Verified municipal incidents situated outside predefined ward monitoring polygons.',
      center: {
        lat: isFinite(minLat) ? (minLat + maxLat) / 2 : 19.2071,
        lng: isFinite(minLng) ? (minLng + maxLng) / 2 : 72.876,
      },
      polygon: isFinite(minLat)
        ? [
            [maxLat + pad, minLng - pad],
            [maxLat + pad, maxLng + pad],
            [minLat - pad, maxLng + pad],
            [minLat - pad, minLng - pad],
          ]
        : [
            [19.212, 72.871],
            [19.212, 72.881],
            [19.202, 72.881],
            [19.202, 72.871],
          ],
      eventCount: unzonedEvents.length,
      priorityTier: highestPriority,
      estimatedLoadKg: Math.round(totalWeightKg),
      criticalCount,
      status: criticalCount > 0 ? 'CRITICAL_TRIAGE' : 'ACTIVE_MONITORING',
      eventIds: unzonedEvents.map((e) => (e._id ? e._id.toString() : e.id).toString()),
    };
  } else {
    otherBlock = {
      id: 'block_other_locations',
      code: 'OTHER',
      name: 'Other Locations',
      area: 'Greater Mumbai',
      description: 'Zero verified reports outside predefined ward monitoring polygons.',
      center: { lat: 19.2071, lng: 72.876 },
      polygon: [
        [19.212, 72.871],
        [19.212, 72.881],
        [19.202, 72.881],
        [19.202, 72.871],
      ],
      eventCount: 0,
      priorityTier: 'None',
      estimatedLoadKg: 0,
      criticalCount: 0,
      status: 'CLEAR',
      eventIds: [],
    };
  }

  return [...predefinedBlocks, otherBlock];
}
