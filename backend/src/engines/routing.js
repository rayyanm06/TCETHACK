/**
 * Pure Route Optimization Engine for CivicClean
 * Implements capacity-constrained 0/1 knapsack selection and priority-weighted sequencing.
 */

import { haversineDistance } from './geo.js';

export const ALPHA_PRIORITY_EARLINESS = 0.15;
export const DEFAULT_SPEED_KMH = 22;
export const DEFAULT_DETOUR_FACTOR = 1.35;

/**
 * Computes an estimated duration matrix between coordinates using haversine and detour factors.
 * Used as immediate reliable fallback when external routing server is unreachable.
 * @param {Array<{lat: number, lng: number}>} points
 * @param {number} [speedKmh=22]
 * @param {number} [detour=1.35]
 * @returns {{durations: number[][], distances: number[][]}} Durations in seconds, distances in meters
 */
export function computeFallbackMatrix(
  points,
  speedKmh = DEFAULT_SPEED_KMH,
  detour = DEFAULT_DETOUR_FACTOR
) {
  const n = points.length;
  const durations = [];
  const distances = [];
  const speedMps = (speedKmh * 1000) / 3600;

  for (let i = 0; i < n; i++) {
    durations[i] = [];
    distances[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        durations[i][j] = 0;
        distances[i][j] = 0;
        continue;
      }
      const straightM = haversineDistance(points[i], points[j]);
      const roadM = Math.round(straightM * detour);
      const seconds = Math.round(roadM / speedMps);
      distances[i][j] = roadM;
      durations[i][j] = seconds;
    }
  }

  return { durations, distances };
}

/**
 * Solves 0/1 knapsack to maximise priority score within vehicle capacity.
 * Weights are discretised to 10kg increments for efficiency.
 * @param {Array<Object>} candidates
 * @param {number} capacityKg
 * @returns {{selected: Array<Object>, rejected: Array<Object>}}
 */
export function solveCapacityKnapsack(candidates, capacityKg) {
  const unit = 10;
  const maxW = Math.floor(capacityKg / unit);
  const n = candidates.length;

  if (n === 0 || maxW <= 0) {
    return { selected: [], rejected: [...candidates] };
  }

  // dp[i][w] = max priority score using first i items with weight w
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(maxW + 1).fill(0));
  const keep = Array.from({ length: n + 1 }, () => new Uint8Array(maxW + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = candidates[i - 1];
    const itemWeightUnits = Math.max(1, Math.ceil((item.estimatedWeightKg || item.weightKg || 0) / unit));
    const itemScore = Math.round(item.priority?.score || item.priorityScore || 10);

    for (let w = 0; w <= maxW; w++) {
      if (itemWeightUnits <= w && dp[i - 1][w - itemWeightUnits] + itemScore > dp[i - 1][w]) {
        dp[i][w] = dp[i - 1][w - itemWeightUnits] + itemScore;
        keep[i][w] = 1;
      } else {
        dp[i][w] = dp[i - 1][w];
        keep[i][w] = 0;
      }
    }
  }

  // Backtrack to find chosen items
  const selected = [];
  const selectedIds = new Set();
  let remainingW = maxW;
  for (let i = n; i >= 1; i--) {
    if (keep[i][remainingW] === 1) {
      const item = candidates[i - 1];
      selected.push(item);
      selectedIds.add((item._id || item.id).toString());
      const itemWeightUnits = Math.max(1, Math.ceil((item.estimatedWeightKg || item.weightKg || 0) / unit));
      remainingW -= itemWeightUnits;
    }
  }

  selected.reverse();
  const rejected = candidates.filter((c) => !selectedIds.has((c._id || c.id).toString()));

  return { selected, rejected };
}

/**
 * Optimises stop sequence on travel duration matrix using exhaustive permutation (n <= 8) or 2-opt.
 * Cost function: travelTimeSeconds + alpha * sum(arrivalTime_i * priorityWeight_i)
 * Node 0 is the starting point (depot or vehicle position).
 * Ends back at node 0 (depot).
 * @param {Array<Object>} stops
 * @param {number[][]} durationMatrix Matrix of durations in seconds (index 0 is depot)
 * @param {number} [alpha=0.15]
 * @returns {Array<number>} Optimal permutation of stop indices (1 to n)
 */
export function sequenceStops(stops, durationMatrix, alpha = ALPHA_PRIORITY_EARLINESS) {
  const n = stops.length;
  if (n <= 1) return stops.map((_, i) => i + 1);

  // Helper to evaluate a permutation of indices 1..n
  function evaluateCost(order) {
    let totalTravel = 0;
    let currentArrival = 0;
    let priorityPenalty = 0;

    let prevNode = 0; // depot
    for (let i = 0; i < order.length; i++) {
      const node = order[i];
      const legDuration = durationMatrix[prevNode][node];
      totalTravel += legDuration;
      currentArrival += legDuration;

      const stopObj = stops[node - 1];
      const pScore = stopObj.priority?.score || stopObj.priorityScore || 50;
      const pWeight = pScore / 100;
      priorityPenalty += currentArrival * pWeight;

      prevNode = node;
    }

    // Return to depot
    totalTravel += durationMatrix[prevNode][0];

    return totalTravel + alpha * priorityPenalty;
  }

  // If <= 8 stops, exhaustive permutation is exact and takes milliseconds (<= 40,320 permutations)
  if (n <= 8) {
    let bestOrder = null;
    let bestCost = Infinity;

    function permute(arr, l, r) {
      if (l === r) {
        const cost = evaluateCost(arr);
        if (cost < bestCost) {
          bestCost = cost;
          bestOrder = [...arr];
        }
        return;
      }
      for (let i = l; i <= r; i++) {
        [arr[l], arr[i]] = [arr[i], arr[l]];
        permute(arr, l + 1, r);
        [arr[l], arr[i]] = [arr[i], arr[l]];
      }
    }

    const indices = stops.map((_, i) => i + 1);
    permute(indices, 0, n - 1);
    return bestOrder || indices;
  }

  // Greedy Nearest-Neighbor followed by 2-opt for > 8 stops
  const unvisited = new Set(stops.map((_, i) => i + 1));
  const order = [];
  let curr = 0;
  while (unvisited.size > 0) {
    let nextNode = null;
    let minDist = Infinity;
    for (const cand of unvisited) {
      if (durationMatrix[curr][cand] < minDist) {
        minDist = durationMatrix[curr][cand];
        nextNode = cand;
      }
    }
    order.push(nextNode);
    unvisited.delete(nextNode);
    curr = nextNode;
  }

  // 2-opt local search improvement
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50) {
    improved = false;
    iterations++;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const newOrder = [...order];
        // Reverse subsegment between i and k
        let left = i;
        let right = k;
        while (left < right) {
          const temp = newOrder[left];
          newOrder[left] = newOrder[right];
          newOrder[right] = temp;
          left++;
          right--;
        }
        if (evaluateCost(newOrder) < evaluateCost(order)) {
          for (let idx = 0; idx < n; idx++) order[idx] = newOrder[idx];
          improved = true;
        }
      }
    }
  }

  return order;
}

/**
 * Plans a collection route given depot, vehicle, candidate events, and cost matrices.
 * @param {Object} params
 * @param {Object} params.depot {name, location: {lat, lng}}
 * @param {Object} params.vehicle {id, name, capacityKg, acceptedCategories, maxRouteMinutes}
 * @param {Array<Object>} params.events Candidate events
 * @param {number[][]} params.durationMatrix
 * @param {number[][]} params.distanceMatrix
 * @param {number[][]} [params.baseDurationMatrix]
 * @param {Array<string>} [params.excludeEventIds=[]]
 * @returns {Object} Route plan with stops, deferred items, totals, and baseline
 */
export function planCollectionRoute({
  depot,
  vehicle,
  events = [],
  durationMatrix,
  distanceMatrix,
  baseDurationMatrix,
  excludeEventIds = [],
}) {
  const capacityKg = vehicle.capacityKg || 1000;
  const acceptedCategories = new Set(
    vehicle.acceptedCategories || ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED']
  );
  const excludedSet = new Set(excludeEventIds.map(String));

  const eligible = [];
  const deferred = [];

  // Step 1: Eligibility filtering
  for (const ev of events) {
    const evId = (ev._id || ev.id).toString();

    if (excludedSet.has(evId)) {
      deferred.push({
        eventId: evId,
        reason: 'EXCLUDED',
        detail: 'Manually excluded by operator from this collection trip',
      });
      continue;
    }

    if (!acceptedCategories.has(ev.category)) {
      deferred.push({
        eventId: evId,
        reason: 'INCOMPATIBLE',
        detail: `${ev.category} requires special vehicle handling`,
      });
      continue;
    }

    const weight = Number(ev.estimatedWeightKg);
    if (!weight || weight <= 0) {
      deferred.push({
        eventId: evId,
        reason: 'NO_WEIGHT',
        detail: 'Operator estimated weight not set — verify event first',
      });
      continue;
    }

    eligible.push(ev);
  }

  // Step 2: Capacity Knapsack
  const { selected, rejected } = solveCapacityKnapsack(eligible, capacityKg);

  let plannedLoadKg = 0;
  for (const s of selected) {
    plannedLoadKg += Number(s.estimatedWeightKg) || 0;
  }
  const remainingCapacityKg = Math.max(0, capacityKg - plannedLoadKg);

  for (const r of rejected) {
    const weight = Number(r.estimatedWeightKg) || 0;
    deferred.push({
      eventId: (r._id || r.id).toString(),
      reason: 'CAPACITY',
      detail: `${weight} kg does not fit remaining ${remainingCapacityKg} kg vehicle capacity`,
    });
  }

  if (selected.length === 0) {
    return {
      stops: [],
      deferred,
      totals: {
        plannedLoadKg: 0,
        capacityKg,
        remainingCapacityKg: capacityKg,
        distanceM: 0,
        durationMin: 0,
        baseDurationMin: 0,
        priorityServed: '0 of ' + events.length,
      },
      baseline: { naiveDurationMin: 0, naiveDistanceM: 0, method: 'FIFO' },
    };
  }

  // Map selected nodes to matrix indices
  // Index 0 in matrix is depot. Selected items are at indices 1 .. selected.length
  // (Assuming durationMatrix was built over [depot, ...selected])
  const orderedIndices = sequenceStops(selected, durationMatrix);

  // Construct stops array
  const stops = [];
  let cumDistanceM = 0;
  let cumDurationSec = 0;
  let cumBaseDurationSec = 0;
  let prevMatrixIdx = 0;

  for (let i = 0; i < orderedIndices.length; i++) {
    const matrixIdx = orderedIndices[i];
    const eventObj = selected[matrixIdx - 1];
    const evId = (eventObj._id || eventObj.id).toString();

    const legDistanceM = distanceMatrix[prevMatrixIdx][matrixIdx] || 0;
    const legDurationSec = durationMatrix[prevMatrixIdx][matrixIdx] || 0;
    const legBaseDurationSec =
      baseDurationMatrix && baseDurationMatrix[prevMatrixIdx]
        ? baseDurationMatrix[prevMatrixIdx][matrixIdx] || legDurationSec
        : legDurationSec;

    cumDistanceM += legDistanceM;
    cumDurationSec += legDurationSec;
    cumBaseDurationSec += legBaseDurationSec;

    stops.push({
      eventId: evId,
      seq: i + 1,
      weightKg: Number(eventObj.estimatedWeightKg) || 0,
      priorityScore: eventObj.priority?.score || 50,
      legDistanceM,
      legDurationMin: Math.round((legDurationSec / 60) * 10) / 10,
      legBaseDurationMin: Math.round((legBaseDurationSec / 60) * 10) / 10,
      arrivalOffsetMin: Math.round((cumDurationSec / 60) * 10) / 10,
      state: 'PENDING',
    });

    prevMatrixIdx = matrixIdx;
  }

  // Final leg return to depot
  const returnDist = distanceMatrix[prevMatrixIdx][0] || 0;
  const returnDur = durationMatrix[prevMatrixIdx][0] || 0;
  const returnBaseDur =
    baseDurationMatrix && baseDurationMatrix[prevMatrixIdx]
      ? baseDurationMatrix[prevMatrixIdx][0] || returnDur
      : returnDur;

  cumDistanceM += returnDist;
  cumDurationSec += returnDur;
  cumBaseDurationSec += returnBaseDur;

  // Step 4: Baseline comparison (FIFO order of the same stops)
  // Sort selected by firstReportedAt ascending
  const fifoIndices = selected
    .map((s, idx) => ({ idx: idx + 1, time: new Date(s.firstReportedAt || 0).getTime() }))
    .sort((a, b) => a.time - b.time)
    .map((o) => o.idx);

  let fifoDistanceM = 0;
  let fifoDurationSec = 0;
  let fifoPrev = 0;
  for (const idx of fifoIndices) {
    fifoDistanceM += distanceMatrix[fifoPrev][idx] || 0;
    fifoDurationSec += durationMatrix[fifoPrev][idx] || 0;
    fifoPrev = idx;
  }
  fifoDistanceM += distanceMatrix[fifoPrev][0] || 0;
  fifoDurationSec += durationMatrix[fifoPrev][0] || 0;

  const totals = {
    plannedLoadKg,
    capacityKg,
    remainingCapacityKg,
    distanceM: Math.round(cumDistanceM),
    durationMin: Math.round((cumDurationSec / 60) * 10) / 10,
    baseDurationMin: Math.round((cumBaseDurationSec / 60) * 10) / 10,
    priorityServed: `${selected.length} of ${events.length} events`,
  };

  const baseline = {
    naiveDurationMin: Math.round((fifoDurationSec / 60) * 10) / 10,
    naiveDistanceM: Math.round(fifoDistanceM),
    method: 'FIFO order of the same selected stops',
  };

  return {
    stops,
    deferred,
    totals,
    baseline,
  };
}
