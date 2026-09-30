import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { haversineDistance, isInsideBoundingBox, doesSegmentIntersectCircle } from '../src/engines/geo.js';
import { computePriority, PRIORITY_TIERS } from '../src/engines/priority.js';
import { findDuplicateCandidates, areCategoriesCompatible } from '../src/engines/duplicates.js';
import { deriveUserImpact, calculateSupportCredits } from '../src/engines/impact.js';
import { getGridCell, computeHotspotForecast } from '../src/engines/forecast.js';
import { solveCapacityKnapsack, planCollectionRoute, computeFallbackMatrix } from '../src/engines/routing.js';
import { getSegmentCongestionFactor } from '../src/engines/traffic.js';

describe('Geo Engine Tests', () => {
  test('Haversine distance returns reasonable distance between 2 points', () => {
    const c1 = { lat: 19.2071, lng: 72.876 };
    const c2 = { lat: 19.2075, lng: 72.876 };
    const dist = haversineDistance(c1, c2);
    assert.ok(dist > 40 && dist < 50, `Expected ~44m, got ${dist}`);
  });

  test('Bounding box check correctly tests points', () => {
    const bbox = [72.8, 19.2, 72.9, 19.3]; // [minLng, minLat, maxLng, maxLat]
    assert.equal(isInsideBoundingBox({ lat: 19.25, lng: 72.85 }, bbox), true);
    assert.equal(isInsideBoundingBox({ lat: 19.35, lng: 72.85 }, bbox), false);
  });

  test('Segment to circle intersection detection works', () => {
    const p1 = { lat: 19.2, lng: 72.8 };
    const p2 = { lat: 19.2, lng: 72.9 };
    const center = { lat: 19.2, lng: 72.85 };
    assert.equal(doesSegmentIntersectCircle(p1, p2, center, 100), true);

    const farCenter = { lat: 19.25, lng: 72.85 };
    assert.equal(doesSegmentIntersectCircle(p1, p2, farCenter, 100), false);
  });
});

describe('Priority Engine Tests', () => {
  test('Computes breakdown with severity, wait, community, and sensitive site', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    const firstReported = new Date('2026-09-27T12:00:00Z'); // 3 days waiting = 3/7 * 25 ~ 11 pts
    const result = computePriority({
      severity: 3, // 40 pts
      firstReportedAt: firstReported,
      supportCount: 2, // 8 pts
      sensitiveSite: 'SCHOOL', // 15 pts
      now,
    });

    assert.equal(result.score, 40 + 11 + 8 + 15); // 74
    assert.equal(result.tier, PRIORITY_TIERS.CRITICAL);
    assert.ok(result.sentence.includes('Critical'));
    assert.ok(result.sentence.includes('large pile (+40)'));
    assert.ok(result.sentence.includes('school (+15)'));
  });

  test('Community points are capped at 5 supporters', () => {
    const result = computePriority({
      severity: 1,
      supportCount: 10,
      sensitiveSite: 'NONE',
    });
    const commBreakdown = result.breakdown.find((b) => b.key === 'community');
    assert.equal(commBreakdown.points, 20); // 5 * 4
  });
});

describe('Duplicate Detection Engine Tests', () => {
  test('Detects nearby compatible report within radius', () => {
    const location = { lat: 19.2071, lng: 72.876 };
    const events = [
      {
        id: 'ev-1',
        code: 'WE-0006',
        category: 'ORGANIC',
        status: 'VERIFIED',
        location: { lat: 19.2074, lng: 72.876 }, // ~33m away
        firstReportedAt: new Date(),
        supportCount: 1,
      },
      {
        id: 'ev-2',
        code: 'WE-0007',
        category: 'ORGANIC',
        status: 'VERIFIED',
        location: { lat: 19.215, lng: 72.876 }, // ~800m away
        firstReportedAt: new Date(),
        supportCount: 0,
      },
    ];

    const candidates = findDuplicateCandidates({
      location,
      category: 'ORGANIC',
      events,
      radiusM: 100,
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].code, 'WE-0006');
    assert.ok(candidates[0].distanceM < 50);
  });

  test('E_WASTE category requires exact match', () => {
    assert.equal(areCategoriesCompatible('E_WASTE', 'MIXED', true), false);
    assert.equal(areCategoriesCompatible('E_WASTE', 'E_WASTE', true), true);
    assert.equal(areCategoriesCompatible('PLASTIC', 'MIXED', true), true);
  });
});

describe('Impact Engine Tests', () => {
  test('Derives balances and verifies outcome states correctly', () => {
    const transactions = [
      { complaintId: 'c1', type: 'UNIQUE_REPORT', credits: 10, status: 'VERIFIED' },
      { complaintId: 'c1', type: 'RESOLUTION_BONUS', credits: 5, status: 'VERIFIED' },
      { complaintId: 'c2', type: 'SUPPORTING_REPORT', credits: 3, status: 'VERIFIED' },
      { complaintId: 'c3', type: 'UNIQUE_REPORT', credits: 10, status: 'PENDING' },
      { complaintId: 'c4', type: 'UNIQUE_REPORT', credits: 10, status: 'REJECTED' },
    ];

    const summary = deriveUserImpact(transactions);
    assert.equal(summary.verifiedCredits, 18);
    assert.equal(summary.pendingCredits, 10);
    assert.equal(summary.uniqueIncidents, 1);
    assert.equal(summary.supportingContributions, 1);
    assert.equal(summary.resolvedIncidents, 1);
  });

  test('Support credits are capped after 3 supporters', () => {
    assert.equal(calculateSupportCredits(0).credits, 3);
    assert.equal(calculateSupportCredits(2).credits, 3);
    assert.equal(calculateSupportCredits(3).credits, 0);
  });
});

describe('Routing Engine Tests', () => {
  test('Knapsack excludes over-capacity items and maximises priority', () => {
    const candidates = [
      { id: '1', estimatedWeightKg: 200, priority: { score: 70 } },
      { id: '2', estimatedWeightKg: 800, priority: { score: 90 } },
      { id: '3', estimatedWeightKg: 900, priority: { score: 60 } },
    ];
    const { selected, rejected } = solveCapacityKnapsack(candidates, 1000);
    assert.equal(selected.length, 2);
    assert.equal(selected[0].id, '1');
    assert.equal(selected[1].id, '2');
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].id, '3');
  });

  test('Collection route plan generates stops and explicit deferred reasons', () => {
    const depot = { name: 'Depot Central', location: { lat: 19.2071, lng: 72.876 } };
    const vehicle = {
      id: 'v1',
      name: 'Truck A',
      capacityKg: 1000,
      acceptedCategories: ['ORGANIC', 'PLASTIC'],
    };

    const events = [
      {
        id: 'ev-1',
        category: 'ORGANIC',
        estimatedWeightKg: 200,
        priority: { score: 70 },
        location: { lat: 19.208, lng: 72.877 },
      },
      {
        id: 'ev-2',
        category: 'E_WASTE',
        estimatedWeightKg: 50,
        priority: { score: 40 },
        location: { lat: 19.209, lng: 72.878 },
      },
      {
        id: 'ev-3',
        category: 'ORGANIC',
        estimatedWeightKg: 950,
        priority: { score: 50 },
        location: { lat: 19.21, lng: 72.879 },
      },
    ];

    const points = [depot.location, ...events.map(e=>e.location)];
    const { durations, distances } = computeFallbackMatrix(points);

    const plan = planCollectionRoute({
      depot,
      vehicle,
      events,
      durationMatrix: durations,
      distanceMatrix: distances,
    });

    assert.equal(plan.stops.length, 1);
    assert.equal(plan.stops[0].eventId, 'ev-1');
    assert.equal(plan.deferred.length, 2);

    const incomp = plan.deferred.find((d) => d.reason === 'INCOMPATIBLE');
    assert.ok(incomp);
    assert.equal(incomp.eventId, 'ev-2');

    const cap = plan.deferred.find((d) => d.reason === 'CAPACITY');
    assert.ok(cap);
    assert.equal(cap.eventId, 'ev-3');
  });
});

describe('Traffic Engine Tests', () => {
  test('Zone multipliers apply to intersecting segments', () => {
    const p1 = { lat: 19.2071, lng: 72.876 };
    const p2 = { lat: 19.2071, lng: 72.89 };
    const zones = [
      {
        id: 'z1',
        center: { lat: 19.2071, lng: 72.883 },
        radiusM: 500,
        factor: 2.0,
      },
    ];

    const factor = getSegmentCongestionFactor(p1, p2, zones);
    assert.equal(factor, 2.0);
  });
});


test('Route distances use original event indices after an earlier event is excluded', () => {
  const events=[{id:'excluded',category:'E_WASTE',estimatedWeightKg:1,priority:{score:1}},{id:'selected',category:'PAPER',estimatedWeightKg:2,priority:{score:50}}];
  const plan=planCollectionRoute({vehicle:{capacityKg:10,acceptedCategories:['PAPER'],maxRouteMinutes:10},events,durationMatrix:[[0,10,100],[10,0,30],[120,30,0]],distanceMatrix:[[0,100,1000],[100,0,300],[1200,300,0]]});
  assert.equal(plan.stops[0].eventId,'selected');assert.equal(plan.totals.distanceM,2200);assert.equal(plan.totals.durationMin,3.7);
});
test('Route respects driving-time budget and returns TIME deferrals',()=>{
  const plan=planCollectionRoute({vehicle:{capacityKg:10,acceptedCategories:['PAPER'],maxRouteMinutes:1},events:[{id:'far',category:'PAPER',estimatedWeightKg:1,priority:{score:50}}],durationMatrix:[[0,90],[90,0]],distanceMatrix:[[0,1000],[1000,0]]});
  assert.equal(plan.stops.length,0);assert.equal(plan.deferred[0].reason,'TIME');
});
test('Forecast uses the requested history length rather than hardcoded weeks',()=>{
  const data=[1,2,3,4].flatMap(weekIndex=>Array.from({length:weekIndex},()=>({weekIndex,location:{lat:19.2,lng:72.8}})));
  const result=computeHotspotForecast(data,4,4);assert.equal(result.forecast.cells[0].expected,3.3);assert.equal(result.forecast.weekIndex,5);
});
