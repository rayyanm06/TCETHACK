import { z } from 'zod';
import { computePriority } from '../engines/priority.js';
import { atomic } from '../utils/atomic.js';
import { fail } from '../utils/validation.js';
import { ENV } from '../config/env.js';
import { Route } from '../models/Route.js';
import { Vehicle } from '../models/Vehicle.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { planCollectionRoute, sequenceStops } from '../engines/routing.js';
import { applyCongestionToMatrix } from '../engines/traffic.js';
import { getDurationMatrix, getRouteGeometry } from '../adapters/routing/index.js';

export async function previewRoute(input, userId) {
  const { vehicleId, excludeEventIds, congestionZones } = z
    .object({
      vehicleId: z
        .string()
        .regex(/^[a-f0-9]{24}$/i)
        .optional(),
      excludeEventIds: z
        .array(z.string().regex(/^[a-f0-9]{24}$/i))
        .max(40)
        .default([]),
      congestionZones: z.array(z.any()).max(10).default([]),
    })
    .parse(input);
  if (congestionZones.length && !ENV.DEMO_MODE)
    fail(
      'Simulated traffic is disabled. Road routing uses standard travel estimates.',
      'SIMULATION_DISABLED',
    );
  let vehicle;
  if (vehicleId) {
    vehicle = await Vehicle.findById(vehicleId);
  } else {
    vehicle = await Vehicle.findOne({ isActive: true });
  }

  if (!vehicle || !vehicle.isActive) {
    const err = new Error('No active collection vehicle found.');
    err.status = 404;
    err.code = 'VEHICLE_NOT_FOUND';
    throw err;
  }

  const depotLoc = {
    lat: vehicle.depot.location.coordinates[1],
    lng: vehicle.depot.location.coordinates[0],
  };

  // Find candidate events: VERIFIED and not currently assigned to another active route
  const candidateEvents = await WasteEvent.find({
    status: 'VERIFIED',
    category: { $nin: ['E_WASTE', 'UNKNOWN'] },
    requiresSpecialHandling: { $ne: true },
    reportContext: { $ne: 'HOUSEHOLD' },
    $or: [{ assignedRouteId: null }, { assignedRouteId: { $exists: false } }],
  }).lean();

  if (candidateEvents.length === 0) {
    const err = new Error('No verified events waiting for collection.');
    err.status = 409;
    err.code = 'NO_ELIGIBLE_EVENTS';
    throw err;
  }

  if (candidateEvents.length > 40)
    fail(
      'Maximum 40 waiting stops per planning area. Narrow the configured area.',
      'TOO_MANY_STOPS',
    );
  // Format event locations
  const formattedEvents = candidateEvents.map((ev) => ({
    ...ev,
    priority: computePriority({
      severity: ev.severity,
      firstReportedAt: ev.firstReportedAt,
      supportCount: ev.verifiedSupportCount || 0,
      sensitiveSite: ev.sensitiveSite,
    }),
    id: ev._id.toString(),
    location: {
      lat: ev.location.coordinates[1],
      lng: ev.location.coordinates[0],
    },
  }));

  if (formattedEvents.length > 40)
    fail('Plan one service area at a time (maximum 40 waiting stops).', 'TOO_MANY_STOPS');
  // Build matrix points: index 0 is depot, 1..N are events
  const points = [depotLoc, ...formattedEvents.map((e) => e.location)];

  // Fetch base duration and distance matrices from routing adapter (OSRM with fallback)
  const baseMatrixResult = await getDurationMatrix(points);
  const baseDurationMatrix = baseMatrixResult.durations;
  const distanceMatrix = baseMatrixResult.distances;

  // Apply simulated congestion if zones provided
  let durationMatrix = baseDurationMatrix;
  const hasCongestion = congestionZones && congestionZones.length > 0;
  if (hasCongestion) {
    durationMatrix = applyCongestionToMatrix(baseDurationMatrix, points, congestionZones);
  }

  if (formattedEvents.length > 40)
    fail('Plan one service area at a time (maximum 40 waiting stops).', 'TOO_MANY_STOPS');
  const plan = planCollectionRoute({
    depot: { name: vehicle.depot.name, location: depotLoc },
    vehicle: {
      id: vehicle._id.toString(),
      name: vehicle.name,
      capacityKg: vehicle.capacityKg,
      acceptedCategories: vehicle.acceptedCategories,
      maxRouteMinutes: vehicle.maxRouteMinutes,
    },
    events: formattedEvents,
    durationMatrix,
    distanceMatrix,
    baseDurationMatrix,
    excludeEventIds,
  });

  if (!plan.stops.length)
    fail(
      'No compatible stops fit this vehicle. Check categories and capacity.',
      'NO_ELIGIBLE_STOPS',
      409,
    );
  // Build ordered waypoint list for Leaflet route geometry
  const orderedPoints = [depotLoc];
  for (const stop of plan.stops) {
    const ev = formattedEvents.find((e) => e.id === stop.eventId);
    if (ev) orderedPoints.push(ev.location);
  }
  orderedPoints.push(depotLoc);

  const geomResult = await getRouteGeometry(orderedPoints);

  // Save as DRAFT route
  const route = await Route.create({
    vehicleId: vehicle._id,
    depot: vehicle.depot,
    status: 'DRAFT',
    planVersion: 1,
    stops: plan.stops,
    deferred: plan.deferred,
    totals: plan.totals,
    geometry: geomResult.geometry,
    congestionZones: congestionZones || [],
    trafficMode: hasCongestion ? 'SIMULATED' : 'NONE',
    costSource: baseMatrixResult.costSource,
    createdBy: userId,
  });

  return {
    route: {
      id: route._id.toString(),
      vehicle: {
        id: vehicle._id.toString(),
        name: vehicle.name,
        capacityKg: vehicle.capacityKg,
      },
      depot: route.depot,
      status: route.status,
      planVersion: route.planVersion,
      stops: route.stops,
      deferred: route.deferred,
      totals: route.totals,
      geometry: route.geometry,
      congestionZones: route.congestionZones,
      trafficMode: route.trafficMode,
      costSource: route.costSource,
    },
    baseline: plan.baseline,
  };
}

export function assignRoute(routeId, userId) {
  return atomic(() => assignRouteAtomic(routeId, userId));
}
async function assignRouteAtomic(routeId, userId) {
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (route.status !== 'DRAFT') {
    const err = new Error('Route is already assigned or completed.');
    err.status = 409;
    err.code = 'ALREADY_ASSIGNED';
    throw err;
  }

  const vehicle = await Vehicle.findById(route.vehicleId);
  if (!vehicle || !vehicle.isActive) fail('Vehicle is unavailable.', 'VEHICLE_UNAVAILABLE', 409);
  if (await Route.exists({ vehicleId: vehicle._id, status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }))
    fail('This vehicle already has an active route.', 'VEHICLE_BUSY', 409);
  const currentEvents = await WasteEvent.find({ _id: { $in: route.stops.map((s) => s.eventId) } });
  if (
    !route.stops.length ||
    currentEvents.length !== route.stops.length ||
    currentEvents.some(
      (e) =>
        e.status !== 'VERIFIED' ||
        e.assignedRouteId ||
        ['E_WASTE', 'UNKNOWN'].includes(e.category) ||
        e.requiresSpecialHandling ||
        e.reportContext === 'HOUSEHOLD' ||
        !vehicle.acceptedCategories.includes(e.category) ||
        e.estimatedWeightKg !==
          route.stops.find((s) => String(s.eventId) === String(e._id)).weightKg,
    )
  )
    fail('A stop changed after preview. Generate a fresh plan.', 'STALE_ROUTE', 409);
  if (route.totals.durationMin > vehicle.maxRouteMinutes)
    fail('Driving budget changed. Generate a fresh plan.', 'STALE_ROUTE', 409);
  if (currentEvents.reduce((sum, e) => sum + e.estimatedWeightKg, 0) > vehicle.capacityKg)
    fail('Vehicle capacity changed. Generate a fresh plan.', 'STALE_ROUTE', 409);
  // A write to the vehicle makes concurrent assignment attempts conflict transactionally.
  vehicle.set('updatedAt', new Date());
  await vehicle.save();
  route.status = 'ASSIGNED';
  await route.save();

  await StatusEvent.create({
    entityType: 'ROUTE',
    entityId: route._id,
    from: 'DRAFT',
    to: 'ASSIGNED',
    actorId: userId,
    actorRole: 'OPERATOR',
    note: `Route assigned with ${route.stops.length} stops (${route.totals.plannedLoadKg} kg).`,
  });

  // Set included events to SCHEDULED and set assignedRouteId
  const stopEventIds = route.stops.map((s) => s.eventId);
  await WasteEvent.updateMany(
    { _id: { $in: stopEventIds } },
    { status: 'SCHEDULED', assignedRouteId: route._id },
  );

  for (const evId of stopEventIds) {
    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: evId,
      from: 'VERIFIED',
      to: 'SCHEDULED',
      actorId: userId,
      actorRole: 'OPERATOR',
      note: 'Scheduled for municipal collection.',
    });
  }

  const updatedEvents = await WasteEvent.find({ _id: { $in: stopEventIds } }).lean();
  return {
    route: (await getRouteById(route._id)).route,
    events: updatedEvents.map((e) => ({ id: e._id.toString(), status: e.status })),
  };
}

export async function replanRoute(
  routeId,
  { congestionZones = [], reason = 'Replanned remaining stops' },
  userId,
) {
  if (!ENV.DEMO_MODE)
    fail(
      'Replanning is disabled pending live dispatch integration. Complete the assigned route.',
      'REPLAN_UNAVAILABLE',
      409,
    );
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (route.status !== 'ASSIGNED' && route.status !== 'IN_PROGRESS') {
    const err = new Error('Only active routes can be replanned.');
    err.status = 409;
    err.code = 'ROUTE_NOT_ACTIVE';
    throw err;
  }

  const vehicle = await Vehicle.findById(route.vehicleId);
  const depotLoc = {
    lat: route.depot.location.coordinates[1],
    lng: route.depot.location.coordinates[0],
  };

  // 1. Separate completed stops vs pending stops
  const completedStops = route.stops.filter((s) => s.state === 'DONE');
  const pendingStops = route.stops.filter((s) => s.state === 'PENDING');

  const durationBeforeMin = route.totals.durationMin;

  // Determine starting point for remaining route
  let startLocation = depotLoc;
  if (completedStops.length > 0) {
    const lastDoneStop = completedStops[completedStops.length - 1];
    const lastDoneEvent = await WasteEvent.findById(lastDoneStop.eventId).lean();
    if (lastDoneEvent) {
      startLocation = {
        lat: lastDoneEvent.location.coordinates[1],
        lng: lastDoneEvent.location.coordinates[0],
      };
    }
  }

  // Fetch pending events
  const pendingEventIds = pendingStops.map((s) => s.eventId);
  const pendingEvents = await WasteEvent.find({ _id: { $in: pendingEventIds } }).lean();

  const formattedPending = pendingEvents.map((ev) => ({
    ...ev,
    id: ev._id.toString(),
    location: {
      lat: ev.location.coordinates[1],
      lng: ev.location.coordinates[0],
    },
  }));

  // Remaining capacity
  const doneWeight = completedStops.reduce((sum, s) => sum + s.weightKg, 0);
  const remainingCapacity = Math.max(0, vehicle.capacityKg - doneWeight);

  // If no pending stops, nothing to replan
  if (formattedPending.length === 0) {
    return {
      route,
      delta: { durationBeforeMin, durationAfterMin: durationBeforeMin, reordered: [] },
    };
  }

  // Build matrix from startLocation through pending events
  const matrixPoints = [startLocation, ...formattedPending.map((p) => p.location)];
  const matrixResult = await getDurationMatrix(matrixPoints);
  const baseMatrix = matrixResult.durations;
  const distMatrix = matrixResult.distances;

  const congestedMatrix = applyCongestionToMatrix(baseMatrix, matrixPoints, congestionZones);

  // Resequence pending stops
  const resequencedIndices = sequenceStops(formattedPending, congestedMatrix);

  // Build updated stops array: completed stops first, then reordered pending stops
  const updatedStops = [...completedStops];
  let seqCounter = completedStops.length + 1;
  let cumDistanceM = completedStops.reduce((sum, s) => sum + s.legDistanceM, 0);
  let cumDurationSec = completedStops.reduce((sum, s) => sum + s.legDurationMin * 60, 0);

  let prevIdx = 0;
  for (const matrixIdx of resequencedIndices) {
    const eventObj = formattedPending[matrixIdx - 1];
    const legDist = distMatrix[prevIdx][matrixIdx] || 0;
    const legDur = congestedMatrix[prevIdx][matrixIdx] || 0;

    cumDistanceM += legDist;
    cumDurationSec += legDur;

    updatedStops.push({
      eventId: eventObj._id,
      seq: seqCounter++,
      weightKg: eventObj.estimatedWeightKg || 0,
      priorityScore: eventObj.priority?.score || 50,
      legDistanceM: legDist,
      legDurationMin: Math.round((legDur / 60) * 10) / 10,
      legBaseDurationMin: Math.round(((baseMatrix[prevIdx][matrixIdx] || legDur) / 60) * 10) / 10,
      arrivalOffsetMin: Math.round((cumDurationSec / 60) * 10) / 10,
      state: 'PENDING',
    });

    prevIdx = matrixIdx;
  }

  // Return to depot from last pending stop
  cumDistanceM += distMatrix[prevIdx][0] || 0;
  cumDurationSec += congestedMatrix[prevIdx][0] || 0;

  // Build updated geometry
  const allOrderedPoints = [depotLoc];
  for (const s of updatedStops) {
    const ev = await WasteEvent.findById(s.eventId).lean();
    if (ev) {
      allOrderedPoints.push({
        lat: ev.location.coordinates[1],
        lng: ev.location.coordinates[0],
      });
    }
  }
  allOrderedPoints.push(depotLoc);

  const newGeomResult = await getRouteGeometry(allOrderedPoints);

  // Store history and update route
  const prevGeom = route.geometry;
  route.previousGeometry = prevGeom;
  route.geometry = newGeomResult.geometry;
  route.planHistory.push({
    version: route.planVersion,
    at: new Date(),
    reason,
    durationMin: route.totals.durationMin,
    stopOrder: route.stops.map((s) => s.eventId.toString()),
  });

  route.planVersion += 1;
  route.stops = updatedStops;
  route.congestionZones = congestionZones;
  route.trafficMode = congestionZones.length > 0 ? 'SIMULATED' : 'NONE';
  route.totals.durationMin = Math.round((cumDurationSec / 60) * 10) / 10;
  route.totals.distanceM = Math.round(cumDistanceM);

  await route.save();

  await StatusEvent.create({
    entityType: 'ROUTE',
    entityId: route._id,
    from: `v${route.planVersion - 1}`,
    to: `v${route.planVersion}`,
    actorId: userId,
    actorRole: 'OPERATOR',
    note: `Route replanned due to congestion: ${durationBeforeMin} min → ${route.totals.durationMin} min.`,
  });

  return {
    route,
    delta: {
      durationBeforeMin,
      durationAfterMin: route.totals.durationMin,
      reordered: resequencedIndices.map((idx) => formattedPending[idx - 1].id),
      newlyDeferred: [],
    },
  };
}

export async function getActiveRoutes() {
  const routes = await Route.find({ status: { $in: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'] } })
    .populate('vehicleId')
    .sort({ updatedAt: -1 })
    .lean();
  return {
    items: routes
      .filter((r) => r.vehicleId)
      .map((r) => ({
        ...r,
        id: String(r._id),
        vehicle: {
          id: String(r.vehicleId._id),
          name: r.vehicleId.name,
          capacityKg: r.vehicleId.capacityKg,
        },
      })),
  };
}

export async function getRouteById(routeId) {
  const route = await Route.findById(routeId).populate('vehicleId').lean();
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    route: {
      ...route,
      id: String(route._id),
      vehicle: route.vehicleId
        ? {
            id: String(route.vehicleId._id),
            name: route.vehicleId.name,
            capacityKg: route.vehicleId.capacityKg,
          }
        : null,
    },
  };
}

export async function getVehicles() {
  const vehicles = await Vehicle.find({ isActive: true }).lean();
  return { items: vehicles };
}
