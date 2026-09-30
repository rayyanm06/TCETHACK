import { z } from 'zod';
import { atomic } from '../utils/atomic.js';
import { fail } from '../utils/validation.js';
import { storeEvidence, readEvidence } from './uploadEvidence.js';
import { requiresHandoff, handlingFor } from './disposalService.js';
import { THRESHOLDS } from '../config/thresholds.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { Report } from '../models/Report.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { ImpactTransaction } from '../models/ImpactTransaction.js';
import { Route } from '../models/Route.js';
import { computePriority } from '../engines/priority.js';
import { uploadImage } from '../adapters/storage/index.js';
import { signUploadToken, verifyUploadToken } from '../utils/token.js';
import { CREDIT_VALUES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../engines/impact.js';

export async function getOperatorEvents(query = {}) {
  const filter = {};
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  } else if (query.includeResolved !== 'true') {
    filter.status = { $ne: 'RESOLVED' };
  }

  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }

  const events = await WasteEvent.find(filter)
    .populate('primaryReportId')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  const items = events.map((ev) => {
    let priorityObj = ev.priority;
    if (ev.status === 'VERIFIED' || ev.status === 'SCHEDULED') {
      const computed = computePriority({
        severity: ev.severity,
        firstReportedAt: ev.firstReportedAt,
        supportCount: ev.supportCount,
        sensitiveSite: ev.sensitiveSite,
        now,
      });
      priorityObj = { ...computed, computedAt: now };
    }

    const loc = ev.location?.coordinates
      ? { lng: ev.location.coordinates[0], lat: ev.location.coordinates[1] }
      : ev.location;

    return {
      reportContext: ev.reportContext,
      requiresSpecialHandling: ev.requiresSpecialHandling,
      handling: handlingFor(ev.category, ev.requiresSpecialHandling, ev.reportContext),
      id: ev._id.toString(),
      code: ev.code,
      location: loc,
      addressText: ev.addressText,
      category: ev.category,
      status: ev.status,
      priority: priorityObj,
      severity: ev.severity,
      sensitiveSite: ev.sensitiveSite,
      estimatedWeightKg: ev.estimatedWeightKg,
      reportCount: (ev.supportCount || 0) + 1,
      supportCount: ev.supportCount || 0,
      thumbnailUrl: ev.primaryReportId?.imageUrl,
      firstReportedAt: ev.firstReportedAt,
      needsCategoryReview: ev.categoryConfirmedBy === 'CITIZEN',
      assignedRouteId: ev.assignedRouteId?.toString(),
    };
  });

  // Calculate ticker counts
  const totalReports = await Report.countDocuments();
  const totalEvents = await WasteEvent.countDocuments({ status: { $ne: 'REJECTED' } });
  const activeRoutes = await Route.find({ status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).populate('vehicleId').lean();
  let plannedStops = 0;
  for (const r of activeRoutes.filter(r => r.vehicleId)) {
    plannedStops += (r.stops || []).filter((s) => s.state === 'PENDING').length;
  }

  return {
    items,
    counts: {
      reports: totalReports,
      events: totalEvents,
      plannedStops,
    },
  };
}

export async function getOperatorEventById(eventId) {
  const event = await WasteEvent.findById(eventId).lean();
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const reports = await Report.find({ complaintId: event._id })
    .populate('citizenId', 'name')
    .sort({ createdAt: 1 })
    .lean();

  const transactions = await ImpactTransaction.find({ complaintId: event._id }).lean();
  const txByReport = new Map();
  for (const tx of transactions) {
    txByReport.set(tx.reportId?.toString(), tx);
  }

  const linkedReports = reports.map((r) => {
    // Format name as First Name + Initial (e.g. "Asha K.")
    const fullName = r.citizenId?.name || 'Anonymous Citizen';
    const parts = fullName.trim().split(' ');
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

    const tx = txByReport.get(r._id.toString());
    return {
      id: r._id.toString(),
      role: r.role,
      citizenDisplayName: displayName,
      createdAt: r.createdAt,
      imageUrl: r.imageUrl,
      category: r.citizenCategory,
      creditState: tx?.status || 'PENDING',
      credits: tx?.credits || 0,
    };
  });

  const photos = reports.map((r) => ({
    url: r.imageUrl,
    role: r.role,
    caption: `${r.role === 'PRIMARY' ? 'Primary' : 'Supporting'} · by ${linkedReports.find((lr) => lr.id === r._id.toString())?.citizenDisplayName}`,
  }));

  const timeline = await StatusEvent.find({ entityId: event._id })
    .sort({ createdAt: 1 })
    .lean();

  // Priority reasoning
  let priorityObj = event.priority;
  if (event.status === 'VERIFIED' || event.status === 'SCHEDULED' || event.status === 'SUBMITTED') {
    priorityObj = computePriority({
      severity: event.severity || 1,
      firstReportedAt: event.firstReportedAt,
      supportCount: event.supportCount,
      sensitiveSite: event.sensitiveSite,
    });
  }

  return {
    event: {
      ...event,
      id: event._id.toString(),
    },
    handling: handlingFor(event.category, event.requiresSpecialHandling, event.reportContext),
    requiresHandoff: requiresHandoff(event),
    photos,
    linkedReports,
    timeline,
    priority: priorityObj,
    closure: event.status === 'RESOLVED'
      ? {
          photoUrl: event.closurePhotoUrl,
          note: event.closureNote,
          resolvedAt: event.resolvedAt,
        }
      : null,
  };
}

export function updateOperatorEvent(eventId, data, userId) { return atomic(() => updateAtomic(eventId, data, userId)); }
async function updateAtomic(eventId, data, userId) {
  data = z.object({ category: z.enum(THRESHOLDS.CATEGORIES).optional(), severity: z.number().int().min(1).max(3).optional(), estimatedWeightKg: z.number().finite().positive().max(10000).optional(), sensitiveSite: z.enum(['NONE','SCHOOL','HOSPITAL','MARKET','DRAIN']).optional(), verify: z.boolean().optional(), reject: z.object({reason: z.string().trim().min(5).max(500)}).optional(), requiresSpecialHandling: z.boolean().optional() }).strict().parse(data);
  const event = await WasteEvent.findById(eventId);
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!['SUBMITTED','VERIFIED'].includes(event.status)) fail('This event cannot be edited in its current state.', 'INVALID_TRANSITION', 409);
  if (data.verify && event.status !== 'SUBMITTED') fail('Event was already verified.', 'INVALID_TRANSITION', 409);
  if (data.verify && data.reject) fail('Choose either verify or reject.');
  const previousStatus = event.status;
  const impactSummary = { verified: 0, rejected: 0 };
  if (data.requiresSpecialHandling !== undefined) event.requiresSpecialHandling = data.requiresSpecialHandling;

  // 1. Rejection path
  if (data.reject) {
    event.status = 'REJECTED';
    event.rejectReason = data.reject.reason || 'Not accepted by municipal inspection.';
    await event.save();

    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: previousStatus,
      to: 'REJECTED',
      actorId: userId,
      actorRole: 'OPERATOR',
      note: event.rejectReason,
    });

    // Reject all pending transactions
    const pendingTx = await ImpactTransaction.find({
      complaintId: event._id,
      status: {$in: [TRANSACTION_STATUSES.PENDING, TRANSACTION_STATUSES.VERIFIED]},
    });
    for (const tx of pendingTx) {
      tx.status = TRANSACTION_STATUSES.REJECTED;
      tx.closedAt = new Date();
      await tx.save();
      impactSummary.rejected++;
    }

    // Set reports to REJECTED state
    await Report.updateMany({ complaintId: event._id }, { state: 'REJECTED' });

    return { event, impactSummary };
  }

  // 2. Edit fields
  if (data.category) {
    event.category = data.category;
    event.categoryConfirmedBy = 'OPERATOR';
  }
  if (data.severity) {
    event.severity = Number(data.severity);
  }
  if (data.estimatedWeightKg !== undefined) {
    event.estimatedWeightKg = Number(data.estimatedWeightKg);
  }
  if (data.sensitiveSite) {
    event.sensitiveSite = data.sensitiveSite;
  }

  // 3. Verification action
  if (data.verify === true) {
    if (event.category === 'UNKNOWN' && !event.requiresSpecialHandling) fail('Choose a category or send for specialist review.');
    if (!event.severity) {
      const err = new Error('Severity level (S1, S2, or S3) is required to verify an event.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!event.estimatedWeightKg || event.estimatedWeightKg <= 0) {
      const err = new Error('Estimated weight in kilograms is required to verify an event.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const priorityResult = computePriority({
      severity: event.severity,
      firstReportedAt: event.firstReportedAt,
      supportCount: event.supportCount,
      sensitiveSite: event.sensitiveSite,
    });

    event.status = 'VERIFIED';
    event.verifiedBy = userId;
    event.verifiedAt = new Date();
    event.priority = {
      ...priorityResult,
      computedAt: new Date(),
    };

    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: 'SUBMITTED',
      to: 'VERIFIED',
      actorId: userId,
      actorRole: 'OPERATOR',
      note: `Verified at ${priorityResult.tier} priority (${priorityResult.score} pts).`,
    });

    // Flip PENDING transactions to VERIFIED
    const pendingTx = await ImpactTransaction.find({
      complaintId: event._id,
      status: TRANSACTION_STATUSES.PENDING,
    });

    for (const tx of pendingTx) {
      if (tx.type === TRANSACTION_TYPES.CLASSIFICATION_CORRECTION) {
        // If operator final category equals the citizen's corrected category -> VERIFIED
        const report = await Report.findById(tx.reportId);
        if (report && report.citizenCategory === event.category) {
          tx.status = TRANSACTION_STATUSES.VERIFIED;
          tx.verifiedAt = new Date();
          impactSummary.verified++;
        } else {
          tx.status = TRANSACTION_STATUSES.REJECTED;
          tx.closedAt = new Date();
          impactSummary.rejected++;
        }
      } else {
        tx.status = TRANSACTION_STATUSES.VERIFIED;
        tx.verifiedAt = new Date();
        impactSummary.verified++;
      }
      await tx.save();
    }
  } else {
    // If already verified, recompute priority
    if (event.status === 'VERIFIED' || event.status === 'SCHEDULED') {
      const priorityResult = computePriority({
        severity: event.severity,
        firstReportedAt: event.firstReportedAt,
        supportCount: event.supportCount,
        sensitiveSite: event.sensitiveSite,
      });
      event.priority = {
        ...priorityResult,
        computedAt: new Date(),
      };
    }
  }

  await event.save();
  return { event, impactSummary };
}

export function resolveOperatorEvent(eventId, data, userId) { return atomic(() => resolveAtomic(eventId, data, userId)); }
async function resolveAtomic(eventId, data, userId) {
  const { to, note, closurePhoto, handoff } = z.object({
    to: z.literal('RESOLVED'), note: z.string().trim().min(10).max(1000),
    closurePhoto: z.object({uploadToken: z.string().min(10)}).passthrough(),
    handoff: z.object({facilityName: z.string().trim().min(3).max(150), reference: z.string().trim().min(3).max(150), sourceUrl: z.string().url().max(500).refine(v => v.startsWith('https://'))}).optional(),
  }).parse(data);

  if (to !== 'RESOLVED') {
    const err = new Error('Invalid status transition.');
    err.status = 409;
    err.code = 'INVALID_TRANSITION';
    throw err;
  }

  const event = await WasteEvent.findById(eventId);
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const specialist = requiresHandoff(event);
  if (event.status !== 'SCHEDULED' && !(event.status === 'VERIFIED' && specialist)) fail('Verify and assign collection before resolving this event.', 'INVALID_TRANSITION', 409);
  if (specialist && !handoff) fail('Record the receiving service, receipt/reference, and source URL before closing this request.', 'HANDOFF_REQUIRED');
  const evidence = await readEvidence(closurePhoto.uploadToken, userId, 'CLOSURE', String(eventId));
  if (specialist) event.handoff = {...handoff, confirmedAt: new Date(), confirmedBy: userId};
  const prevStatus = event.status;
  event.status = 'RESOLVED';
  event.resolvedAt = new Date();
  event.resolvedBy = userId;
  event.closureNote = note || '';

  if (closurePhoto) {
    event.closurePhotoUrl = evidence.imageUrl;
    event.closurePublicId = evidence.imagePublicId;
  }

  await event.save();

  await StatusEvent.create({
    entityType: 'COMPLAINT',
    entityId: event._id,
    from: prevStatus,
    to: 'RESOLVED',
    actorId: userId,
    actorRole: 'OPERATOR',
    note: note || 'Marked resolved with photographic clearance verification.',
  });

  // Update Route stop state if assigned to active route
  let routeUpdate = null;
  if (event.assignedRouteId) {
    const route = await Route.findById(event.assignedRouteId);
    if (route) {
      const stop = route.stops.find((s) => s.eventId.toString() === event._id.toString());
      if (stop) {
        stop.state = 'DONE';
        stop.completedAt = new Date();
      }

      const pendingCount = route.stops.filter((s) => s.state === 'PENDING').length;
      if (pendingCount === 0) {
        route.status = 'COMPLETED';
      } else if (route.status === 'ASSIGNED') {
        route.status = 'IN_PROGRESS';
      }
      await route.save();
      routeUpdate = { id: route._id.toString(), status: route.status, remainingStops: pendingCount };
    }
  }

  // Create RESOLUTION_BONUS transactions for primary reporter & supporters
  const primaryReport = await Report.findById(event.primaryReportId);
  if (primaryReport) {
    await ImpactTransaction.create({
      citizenId: primaryReport.citizenId,
      complaintId: event._id,
      reportId: primaryReport._id,
      type: TRANSACTION_TYPES.RESOLUTION_BONUS,
      credits: CREDIT_VALUES.RESOLUTION_PRIMARY_BONUS,
      status: TRANSACTION_STATUSES.VERIFIED,
      reason: specialist ? 'Receiving service handoff recorded by operator' : 'Clearance evidence recorded by operator',
      verifiedAt: new Date(),
    });
  }

  // Bonus for verified supporting reports
  const supportingReports = await Report.find({
    complaintId: event._id,
    role: 'SUPPORTING',
  });
  for (const sup of supportingReports) {
    const supTx = await ImpactTransaction.findOne({
      reportId: sup._id,
      status: TRANSACTION_STATUSES.VERIFIED,
      credits: { $gt: 0 },
    });
    if (supTx) {
      await ImpactTransaction.create({
        citizenId: sup.citizenId,
        complaintId: event._id,
        reportId: sup._id,
        type: TRANSACTION_TYPES.RESOLUTION_BONUS,
        credits: CREDIT_VALUES.RESOLUTION_SUPPORTING_BONUS,
        status: TRANSACTION_STATUSES.VERIFIED,
        reason: 'Waste incident resolved — thank you for confirming and supporting',
        verifiedAt: new Date(),
      });
    }
  }

  return { event, route: routeUpdate };
}

export async function uploadClosurePhoto(fileBuffer, mimeType, userId) {
  return storeEvidence(fileBuffer, mimeType, userId, 'CLOSURE');
}
