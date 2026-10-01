import { Route } from '../models/Route.js';
import { Vehicle } from '../models/Vehicle.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { Report } from '../models/Report.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { planCollectionRoute, sequenceStops } from '../engines/routing.js';
import { applyCongestionToMatrix } from '../engines/traffic.js';
import { getDurationMatrix, getRouteGeometry } from '../adapters/routing/index.js';
import { withTransaction } from '../utils/transaction.js';
import { haversineDistance } from '../engines/geo.js';
import { createCitizenNotification } from './notificationService.js';
import { resolveOperatorEvent } from './eventService.js';
import { compareCollectionEvidence } from '../adapters/vision/index.js';

export async function previewRoute(
  {
    vehicleId,
    vehicleConfig,
    excludeEventIds = [],
    congestionZones = [],
  } = {},
  userId
) {
  let vehicle;
  if (vehicleId) {
    vehicle = await Vehicle.findById(vehicleId);
  } else if (vehicleConfig && vehicleConfig.name) {
    // Custom configured vehicle from operator input
    vehicle = {
      _id: null,
      name: vehicleConfig.name,
      registration: vehicleConfig.registration || 'MH-02-PILOT-01',
      capacityKg: Number(vehicleConfig.capacityKg) || 1000,
      acceptedCategories: vehicleConfig.acceptedCategories || [
        'ORGANIC',
        'PLASTIC',
        'PAPER',
        'GLASS',
        'METAL',
        'MIXED',
      ],
      maxRouteMinutes: Number(vehicleConfig.maxRouteMinutes) || 180,
      depot: vehicleConfig.depot || {
        name: 'North Municipal Central Depot',
        location: {
          type: 'Point',
          coordinates: [72.876, 19.2071],
        },
      },
    };
  } else {
    vehicle = await Vehicle.findOne({ isActive: true });
  }

  if (!vehicle) {
    const err = new Error('No active collection vehicle configured.');
    err.status = 404;
    err.code = 'VEHICLE_NOT_FOUND';
    throw err;
  }

  const depotLoc = {
    lat: vehicle.depot.location.coordinates[1],
    lng: vehicle.depot.location.coordinates[0],
  };

  // Find candidate events:
  // Strict operational rule: include ONLY verified, unassigned ordinary public incidents.
  // Exclude household, electronic, unknown, and flagged specialist requests.
  const candidateEvents = await WasteEvent.find({
    status: 'VERIFIED',
    reportType: { $ne: 'HOUSEHOLD' },
    category: { $ne: 'E_WASTE' },
    specialistFlag: { $ne: true },
    specialistQueue: 'NONE',
    isSeed: { $ne: true },
    $or: [{ assignedRouteId: null }, { assignedRouteId: { $exists: false } }],
  }).lean();

  if (candidateEvents.length === 0) {
    const err = new Error('No eligible verified public incidents available for municipal truck routing.');
    err.status = 409;
    err.code = 'NO_ELIGIBLE_EVENTS';
    throw err;
  }

  // Format event locations and keep 1-indexed original position
  const formattedEvents = candidateEvents.map((ev, idx) => ({
    ...ev,
    id: ev._id.toString(),
    matrixIndex: idx + 1,
    location: {
      lat: ev.location.coordinates[1],
      lng: ev.location.coordinates[0],
    },
  }));

  // Build matrix points: index 0 is depot, 1..N are events
  const points = [depotLoc, ...formattedEvents.map((e) => e.location)];

  // Fetch base duration and distance matrices from routing adapter (OSRM with reliable fallback)
  const baseMatrixResult = await getDurationMatrix(points);
  const baseDurationMatrix = baseMatrixResult.durations;
  const distanceMatrix = baseMatrixResult.distances;

  // Apply simulated congestion scenario if zones provided
  let durationMatrix = baseDurationMatrix;
  const hasCongestion = congestionZones && congestionZones.length > 0;
  if (hasCongestion) {
    durationMatrix = applyCongestionToMatrix(baseDurationMatrix, points, congestionZones);
  }

  const plan = planCollectionRoute({
    depot: { name: vehicle.depot.name, location: depotLoc },
    vehicle: {
      id: vehicle._id ? vehicle._id.toString() : 'custom-vehicle',
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

  // Build ordered waypoint list for Leaflet route geometry
  const orderedPoints = [depotLoc];
  for (const stop of plan.stops) {
    const ev = formattedEvents.find((e) => e.id === stop.eventId);
    if (ev) orderedPoints.push(ev.location);
  }
  orderedPoints.push(depotLoc);

  const geomResult = await getRouteGeometry(orderedPoints);

  // If vehicle was temporary config, associate with default active vehicle ID for persistence
  let vehicleDbId = vehicle._id;
  if (!vehicleDbId) {
    const activeDbVeh = await Vehicle.findOne({ isActive: true });
    vehicleDbId = activeDbVeh?._id;
  }

  // Save as DRAFT route
  const route = await Route.create({
    vehicleId: vehicleDbId,
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
        id: vehicleDbId ? vehicleDbId.toString() : 'vehicle-01',
        name: vehicle.name,
        capacityKg: vehicle.capacityKg,
        acceptedCategories: vehicle.acceptedCategories,
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

export async function assignRoute(routeId, userId) {
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (route.status !== 'DRAFT') {
    const err = new Error('Route is already assigned, active, or completed.');
    err.status = 409;
    err.code = 'ALREADY_ASSIGNED';
    throw err;
  }

  const stopEventIds = route.stops.map((s) => s.eventId);

  // REVALIDATION: Check that none of the events became stale, resolved, or double-assigned
  const currentEvents = await WasteEvent.find({ _id: { $in: stopEventIds } });

  if (currentEvents.length !== stopEventIds.length) {
    const err = new Error('Route preview is stale: one or more candidate stops no longer exist.');
    err.status = 409;
    err.code = 'PREVIEW_STALE';
    throw err;
  }

  for (const ev of currentEvents) {
    if (ev.status !== 'VERIFIED') {
      const err = new Error(`Route preview is stale: stop ${ev.code} status changed to ${ev.status}. Please refresh route plan.`);
      err.status = 409;
      err.code = 'PREVIEW_STALE';
      throw err;
    }
    if (ev.assignedRouteId && ev.assignedRouteId.toString() !== route._id.toString()) {
      const err = new Error(`Stop ${ev.code} was already assigned to another collection route.`);
      err.status = 409;
      err.code = 'DOUBLE_ASSIGNMENT_PREVENTED';
      throw err;
    }
  }

  return await withTransaction(async (session) => {
    route.status = 'ASSIGNED';
    await route.save({ session });

    await StatusEvent.create(
      [
        {
          entityType: 'ROUTE',
          entityId: route._id,
          from: 'DRAFT',
          to: 'ASSIGNED',
          actorId: userId,
          actorRole: 'OPERATOR',
          note: `Route plan assigned with ${route.stops.length} stops (${route.totals.plannedLoadKg} kg). Dispatch queued.`,
        },
      ],
      { session }
    );

    // Set included events to SCHEDULED and bind assignedRouteId
    await WasteEvent.updateMany(
      { _id: { $in: stopEventIds } },
      { status: 'SCHEDULED', assignedRouteId: route._id },
      { session }
    );

    for (const evId of stopEventIds) {
      await StatusEvent.create(
        [
          {
            entityType: 'COMPLAINT',
            entityId: evId,
            from: 'VERIFIED',
            to: 'SCHEDULED',
            actorId: userId,
            actorRole: 'OPERATOR',
            note: 'Scheduled for municipal collection trip.',
          },
        ],
        { session }
      );
    }

    // Notify linked citizen report owners
    const linkedReports = await Report.find({ complaintId: { $in: stopEventIds } }).session(session).lean();
    for (const rep of linkedReports) {
      const evObj = currentEvents.find((e) => e._id.toString() === rep.complaintId.toString());
      await createCitizenNotification({
        recipientUserId: rep.citizenId,
        reportId: rep._id,
        eventId: rep.complaintId,
        eventCode: evObj?.code || 'Incident',
        type: 'ASSIGNED',
        title: `Collection Scheduled: ${evObj?.code || 'Incident'}`,
        message: `Your report has been assigned to municipal collection vehicle for pickup dispatch.`,
        severity: 'NORMAL',
        dedupKey: `cit_assign_${route._id}_${rep.complaintId}_${rep._id}`,
      });
    }

    const updatedEvents = await WasteEvent.find({ _id: { $in: stopEventIds } })
      .session(session)
      .lean();

    return {
      route,
      events: updatedEvents.map((e) => ({ id: e._id.toString(), status: e.status })),
    };
  });
}

export async function replanRoute(routeId, { congestionZones = [], reason = 'Simulated congestion' }, userId) {
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (route.status !== 'ASSIGNED' && route.status !== 'IN_PROGRESS') {
    const err = new Error('Only active assigned routes can be replanned.');
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

  if (formattedPending.length === 0) {
    return { route, delta: { durationBeforeMin, durationAfterMin: durationBeforeMin, reordered: [] } };
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
    const legDist = distMatrix[prevIdx]?.[matrixIdx] || 0;
    const legDur = congestedMatrix[prevIdx]?.[matrixIdx] || 0;

    cumDistanceM += legDist;
    cumDurationSec += legDur;

    updatedStops.push({
      eventId: eventObj._id,
      seq: seqCounter++,
      weightKg: eventObj.estimatedWeightKg || 0,
      priorityScore: eventObj.priority?.score || 50,
      legDistanceM: legDist,
      legDurationMin: Math.round((legDur / 60) * 10) / 10,
      legBaseDurationMin: Math.round(((baseMatrix[prevIdx]?.[matrixIdx] || legDur) / 60) * 10) / 10,
      arrivalOffsetMin: Math.round((cumDurationSec / 60) * 10) / 10,
      state: 'PENDING',
    });

    prevIdx = matrixIdx;
  }

  // Return to depot from last pending stop
  cumDistanceM += distMatrix[prevIdx]?.[0] || 0;
  cumDurationSec += congestedMatrix[prevIdx]?.[0] || 0;

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

  route.previousGeometry = route.geometry;
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
    note: `Route replanned due to congestion scenario: ${durationBeforeMin} min → ${route.totals.durationMin} min.`,
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
  const routes = await Route.find({ status: { $in: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'] }, isSeed: { $ne: true } })
    .populate('vehicleId')
    .sort({ updatedAt: -1 })
    .lean();
  return { items: routes };
}

export async function getRouteById(routeId) {
  const route = await Route.findById(routeId).populate('vehicleId').lean();
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return { route };
}

export async function getVehicles() {
  const vehicles = await Vehicle.find({ isActive: true }).lean();
  return { items: vehicles };
}

/**
 * Persists timestamped GPS telemetry from an authenticated collection device session
 */
export async function recordTelemetry(routeId, telemetryData, userId) {
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { lat, lng, accuracyM = 10, heading = 0, speedMs = 0, timestamp, deviceId } = telemetryData;
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    const err = new Error('Invalid GPS coordinates provided.');
    err.status = 400;
    err.code = 'INVALID_COORDINATES';
    throw err;
  }

  route.liveTracking = {
    lat,
    lng,
    accuracyM: Math.round(accuracyM * 10) / 10,
    heading: Math.round(heading),
    speedMs: Math.round(speedMs * 10) / 10,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    isLive: true,
    updatedBy: userId,
    deviceId: deviceId || 'browser-collector',
  };

  // Check proximity to active stop
  const activeStop = route.stops.find(
    (s) => s.state === 'PENDING' || s.state === 'EN_ROUTE' || s.state === 'ARRIVED'
  );
  let activeStopInfo = null;

  if (activeStop) {
    const ev = await WasteEvent.findById(activeStop.eventId).lean();
    if (ev && ev.location?.coordinates) {
      const stopCoord = { lat: ev.location.coordinates[1], lng: ev.location.coordinates[0] };
      const distM = haversineDistance({ lat, lng }, stopCoord);
      const isNear = distM <= Math.max(50, accuracyM + 25);
      activeStopInfo = {
        eventId: activeStop.eventId.toString(),
        seq: activeStop.seq,
        distanceM: Math.round(distM),
        isNear,
        addressText: ev.addressText,
      };
    }
  }

  await route.save();

  return {
    ok: true,
    liveTracking: route.liveTracking,
    activeStop: activeStopInfo,
  };
}

/**
 * Transitions stop state to ARRIVED using GPS proximity or authorized manual override
 */
export async function recordStopArrival(
  routeId,
  eventId,
  { arrivalType = 'GPS_PROXIMITY', arrivalReason = '', lat, lng, accuracyM },
  userId
) {
  const route = await Route.findById(routeId);
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (route.status === 'DRAFT') {
    const err = new Error('Route must be assigned before recording stop arrivals.');
    err.status = 409;
    err.code = 'ROUTE_NOT_ASSIGNED';
    throw err;
  }

  const stop = route.stops.find((s) => s.eventId.toString() === eventId.toString());
  if (!stop) {
    const err = new Error('Stop not found in this route.');
    err.status = 404;
    err.code = 'STOP_NOT_FOUND';
    throw err;
  }

  if (stop.state === 'DONE') {
    const err = new Error('This stop collection has already been completed.');
    err.status = 409;
    err.code = 'STOP_ALREADY_DONE';
    throw err;
  }

  if (arrivalType === 'MANUAL_OVERRIDE' && (!arrivalReason || !arrivalReason.trim())) {
    const err = new Error(
      'A recorded reason is strictly required for manual arrival confirmation when GPS is unavailable.'
    );
    err.status = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  // Update stop state
  stop.state = 'ARRIVED';
  stop.arrivedAt = new Date();
  stop.arrivalType = arrivalType;
  stop.arrivalReason = arrivalReason.trim() || 'GPS proximity detected at collection coordinates.';

  if (route.status === 'ASSIGNED') {
    route.status = 'IN_PROGRESS';
  }

  // Update live tracking if lat/lng provided
  if (typeof lat === 'number' && typeof lng === 'number') {
    route.liveTracking = {
      lat,
      lng,
      accuracyM: Number(accuracyM) || 10,
      heading: route.liveTracking?.heading || 0,
      speedMs: 0,
      timestamp: new Date(),
      isLive: true,
      updatedBy: userId,
      deviceId: route.liveTracking?.deviceId || 'browser-collector',
    };
  }

  await route.save();

  // Create StatusEvent
  await StatusEvent.create({
    entityType: 'COMPLAINT',
    entityId: eventId,
    from: 'SCHEDULED',
    to: 'SCHEDULED',
    actorId: userId,
    actorRole: 'OPERATOR',
    note: `Collection crew arrived at stop (${
      arrivalType === 'MANUAL_OVERRIDE'
        ? `Manual confirmation: ${stop.arrivalReason}`
        : 'GPS proximity confirmation'
    }).`,
  });

  // Notify linked citizen reports
  const event = await WasteEvent.findById(eventId).lean();
  if (event) {
    const reports = await Report.find({ complaintId: event._id }).lean();
    for (const rep of reports) {
      await createCitizenNotification({
        recipientUserId: rep.citizenId,
        reportId: rep._id,
        eventId: event._id,
        eventCode: event.code,
        type: 'ARRIVED',
        title: `Collection Crew Arrived: ${event.code}`,
        message: `Municipal collection crew is now on-site in ${
          event.addressText || 'your sector'
        }. Physical collection in progress.`,
        severity: 'NORMAL',
        dedupKey: `cit_arr_${route._id}_${event._id}_${rep._id}`,
      });
    }
  }

  return {
    ok: true,
    route,
    stop,
  };
}

/**
 * Confirms collection at stop with after-photo, runs AI vision check, updates impact credits & advances route
 */
export async function confirmStopCollection(routeId, eventId, data, userId) {
  const route = await Route.findById(routeId).lean();
  if (!route) {
    const err = new Error('Route not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const stopIndex = route.stops.findIndex((s) => s.eventId.toString() === eventId.toString());
  if (stopIndex === -1) {
    const err = new Error('Stop not found in this route.');
    err.status = 404;
    err.code = 'STOP_NOT_FOUND';
    throw err;
  }

  const stop = route.stops[stopIndex];
  if (stop.state === 'DONE') {
    const err = new Error('This stop collection has already been confirmed.');
    err.status = 409;
    err.code = 'ALREADY_COMPLETED';
    throw err;
  }

  // Never trust client-supplied data.aiReview - sanitize incoming payload
  const { aiReview: _ignoredClientReview, ...sanitizedData } = data || {};

  // Call the core event resolution service to verify photo evidence, award impact credits,
  // compute server-side AI assessment, and atomically update route stop in transaction
  const resolveResult = await resolveOperatorEvent(eventId, { ...sanitizedData, to: 'RESOLVED' }, userId);

  // Re-fetch the freshly updated route persisted inside the transaction
  const updatedRoute = await Route.findById(routeId).lean();
  const updatedStop = updatedRoute?.stops?.find((s) => s.eventId.toString() === eventId.toString()) || null;

  return {
    ok: true,
    route: updatedRoute,
    stop: updatedStop,
    event: resolveResult.event,
  };
}

/**
 * Uses configured vision provider to review before vs after collection photos
 */
export async function reviewStopEvidence(eventId, fileBuffer, mimeType = 'image/jpeg') {
  const event = await WasteEvent.findById(eventId).lean();
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const primaryReport = await Report.findById(event.primaryReportId).lean();
  if (!primaryReport || !primaryReport.imageUrl) {
    return {
      status: 'UNAVAILABLE',
      assessment: 'UNABLE_TO_ASSESS',
      confidence: null,
      shortReason: 'No original report photograph available for comparison.',
      provider: 'none',
    };
  }

  return await compareCollectionEvidence(
    primaryReport.imageUrl,
    'image/jpeg',
    fileBuffer,
    mimeType
  );
}
