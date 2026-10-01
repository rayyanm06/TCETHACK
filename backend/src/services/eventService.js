import crypto from 'crypto';
import { WasteEvent } from '../models/WasteEvent.js';
import { Report } from '../models/Report.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { ImpactTransaction } from '../models/ImpactTransaction.js';
import { UploadEvidence } from '../models/UploadEvidence.js';
import { Route } from '../models/Route.js';
import { computePriority } from '../engines/priority.js';
import { uploadImage } from '../adapters/storage/index.js';
import { signUploadToken, verifyUploadToken } from '../utils/token.js';
import { withTransaction } from '../utils/transaction.js';
import { CREDIT_VALUES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../engines/impact.js';
import { computeHotspotBlocks } from '../data/hotspotBlocks.js';
import { createCitizenNotification } from './notificationService.js';
import { compareCollectionEvidence } from '../adapters/vision/index.js';

function validateImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isWebp;
}

export async function getPublicEvents(query = {}) {
  const filter = {
    reportType: { $ne: 'HOUSEHOLD' },
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
  };

  const limit = Math.min(parseInt(query.limit, 10) || 10, 20);
  const events = await WasteEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const items = events.map((ev) => ({
    id: ev._id.toString(),
    code: ev.code,
    category: ev.category,
    status: ev.status,
    location: ev.location?.coordinates
      ? { lng: ev.location.coordinates[0], lat: ev.location.coordinates[1] }
      : ev.location,
    firstReportedAt: ev.firstReportedAt,
    supportCount: ev.reviewedSupportCount || ev.supportCount || 0,
    priority: {
      tier: ev.priority?.tier || 'Low',
    },
  }));

  return { items };
}

export async function getOperatorEvents(query = {}) {
  const filter = {};
  if (query.includeSeed !== 'true') {
    filter.isSeed = { $ne: true };
  }

  // Status filter
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  } else if (query.includeResolved !== 'true') {
    filter.status = { $ne: 'RESOLVED' };
  }

  // Category filter
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }

  // Queue filter (honest operational segregation)
  if (query.queue === 'e_waste') {
    filter.$or = [{ category: 'E_WASTE' }, { specialistQueue: 'E_WASTE' }];
  } else if (query.queue === 'household') {
    filter.reportType = 'HOUSEHOLD';
  } else if (query.queue === 'specialist') {
    filter.$or = [{ specialistFlag: true }, { specialistQueue: 'HAZARDOUS' }];
  } else if (query.queue === 'public_ordinary') {
    filter.reportType = { $ne: 'HOUSEHOLD' };
    filter.category = { $ne: 'E_WASTE' };
    filter.specialistFlag = { $ne: true };
    filter.specialistQueue = 'NONE';
  }

  const events = await WasteEvent.find(filter)
    .populate('primaryReportId')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  const items = events.map((ev) => {
    let priorityObj = ev.priority;
    if (ev.status === 'VERIFIED' || ev.status === 'SCHEDULED' || ev.status === 'REOPENED') {
      const computed = computePriority({
        severity: ev.severity,
        firstReportedAt: ev.firstReportedAt,
        supportCount: ev.supportCount,
        reviewedSupportCount: ev.reviewedSupportCount,
        sensitiveSite: ev.sensitiveSite,
        now,
      });
      priorityObj = { ...computed, computedAt: now };
    }

    const loc = ev.location?.coordinates
      ? { lng: ev.location.coordinates[0], lat: ev.location.coordinates[1] }
      : ev.location;

    return {
      id: ev._id.toString(),
      code: ev.code,
      location: loc,
      addressText: ev.addressText,
      category: ev.category,
      reportType: ev.reportType || 'PUBLIC',
      householdItems: ev.householdItems,
      householdQuantity: ev.householdQuantity,
      specialistFlag: Boolean(ev.specialistFlag),
      specialistQueue: ev.specialistQueue || 'NONE',
      status: ev.status,
      priority: priorityObj,
      severity: ev.severity,
      sensitiveSite: ev.sensitiveSite,
      estimatedWeightKg: ev.estimatedWeightKg,
      reportCount: (ev.supportCount || 0) + 1,
      supportCount: ev.supportCount || 0,
      reviewedSupportCount: ev.reviewedSupportCount || 0,
      thumbnailUrl: ev.primaryReportId?.imageUrl,
      firstReportedAt: ev.firstReportedAt,
      needsCategoryReview: ev.categoryConfirmedBy === 'CITIZEN',
      assignedRouteId: ev.assignedRouteId?.toString(),
      reopenedAt: ev.reopenedAt,
      reopenReason: ev.reopenReason,
    };
  });

  // Accurate real records ticker counts (strictly excluding seed data)
  const totalReports = await Report.countDocuments({ isSeed: { $ne: true } });
  const totalEvents = await WasteEvent.countDocuments({ status: { $ne: 'REJECTED' }, isSeed: { $ne: true } });
  const activeRoutes = await Route.find({ status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }, isSeed: { $ne: true } }).lean();
  let plannedStops = 0;
  for (const r of activeRoutes) {
    plannedStops += (r.stops || []).filter((s) => s.state === 'PENDING').length;
  }

  const pendingSpecialist = await WasteEvent.countDocuments({
    status: { $in: ['SUBMITTED', 'VERIFIED'] },
    isSeed: { $ne: true },
    $or: [
      { reportType: 'HOUSEHOLD' },
      { category: 'E_WASTE' },
      { specialistFlag: true },
      { specialistQueue: { $in: ['E_WASTE', 'HAZARDOUS', 'HOUSEHOLD_SPECIALIST'] } },
    ],
  });

  const allActiveForBlocks = await WasteEvent.find({
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
    reportType: { $ne: 'HOUSEHOLD' },
    isSeed: { $ne: true },
  }).lean();
  const blocks = computeHotspotBlocks(allActiveForBlocks);

  return {
    items,
    blocks,
    counts: {
      reports: totalReports,
      events: totalEvents,
      plannedStops,
      pendingSpecialist,
    },
  };
}

export async function getHotspotBlocksOverview() {
  const allActiveForBlocks = await WasteEvent.find({
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
    reportType: { $ne: 'HOUSEHOLD' },
    isSeed: { $ne: true },
  }).lean();
  return { blocks: computeHotspotBlocks(allActiveForBlocks) };
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
      state: r.state || 'ACTIVE',
      creditState: tx?.status || 'PENDING',
      credits: tx?.credits || 0,
      reportType: r.reportType || 'PUBLIC',
      householdItems: r.householdItems,
      householdQuantity: r.householdQuantity,
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

  // Priority reasoning based on reviewed support
  let priorityObj = event.priority;
  if (['SUBMITTED', 'VERIFIED', 'SCHEDULED', 'REOPENED'].includes(event.status)) {
    priorityObj = computePriority({
      severity: event.severity || 1,
      firstReportedAt: event.firstReportedAt,
      supportCount: event.supportCount,
      reviewedSupportCount: event.reviewedSupportCount,
      sensitiveSite: event.sensitiveSite,
    });
  }

  return {
    event: {
      ...event,
      id: event._id.toString(),
    },
    photos,
    linkedReports,
    timeline,
    priority: priorityObj,
    closure: event.status === 'RESOLVED'
      ? {
          photoUrl: event.completionEvidence?.completionPhotoUrl || event.closurePhotoUrl,
          note: event.completionEvidence?.operatorNote || event.closureNote,
          receivingFacilityName: event.completionEvidence?.receivingFacilityName,
          receiptReference: event.completionEvidence?.receiptReference,
          sourceUrl: event.completionEvidence?.sourceUrl,
          resolvedAt: event.resolvedAt,
        }
      : null,
  };
}

export async function reviewSupportingReport(eventId, reportId, data = {}, userId) {
  const { accept, decision, reason, note } = data;
  const isAccepted = accept === true || String(accept).toLowerCase() === 'true' || decision === 'ACCEPT';

  const event = await WasteEvent.findById(eventId);
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const report = await Report.findOne({ _id: reportId, complaintId: event._id, role: 'SUPPORTING' });
  if (!report) {
    const err = new Error('Supporting report not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const tx = await ImpactTransaction.findOne({ reportId: report._id, type: TRANSACTION_TYPES.SUPPORTING_REPORT });

  return await withTransaction(async (session) => {
    if (isAccepted) {
      report.state = 'ACTIVE';
      await report.save({ session });

      event.reviewedSupportCount = (event.reviewedSupportCount || 0) + 1;

      // Recompute priority with accepted support
      const priorityResult = computePriority({
        severity: event.severity || 1,
        firstReportedAt: event.firstReportedAt,
        supportCount: event.supportCount,
        reviewedSupportCount: event.reviewedSupportCount,
        sensitiveSite: event.sensitiveSite,
      });
      event.priority = { ...priorityResult, computedAt: new Date() };
      await event.save({ session });

      if (tx) {
        tx.status = TRANSACTION_STATUSES.VERIFIED;
        tx.verifiedAt = new Date();
        await tx.save({ session });
      }

      await StatusEvent.create(
        [
          {
            entityType: 'COMPLAINT',
            entityId: event._id,
            from: event.status,
            to: event.status,
            actorId: userId,
            actorRole: 'OPERATOR',
            note: `Supporting report accepted (+1 reviewed confirmation). New priority: ${priorityResult.score} pts.`,
          },
        ],
        { session }
      );
    } else {
      report.state = 'REJECTED';
      await report.save({ session });

      if (tx) {
        tx.status = TRANSACTION_STATUSES.REJECTED;
        tx.closedAt = new Date();
        await tx.save({ session });
      }

      await StatusEvent.create(
        [
          {
            entityType: 'COMPLAINT',
            entityId: event._id,
            from: event.status,
            to: event.status,
            actorId: userId,
            actorRole: 'OPERATOR',
            note: `Supporting report rejected: ${reason || 'Duplicate / unconfirmed angle'}.`,
          },
        ],
        { session }
      );
    }

    return {
      ok: true,
      reviewedSupportCount: event.reviewedSupportCount,
      reportState: report.state,
      priority: event.priority,
    };
  });
}

export async function updateOperatorEvent(eventId, data, userId) {
  const event = await WasteEvent.findById(eventId);
  if (!event) {
    const err = new Error('Waste event not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const impactSummary = { verified: 0, rejected: 0 };

  // 1. Rejection path
  if (data.reject) {
    return await withTransaction(async (session) => {
      const prevStatus = event.status;
      event.status = 'REJECTED';
      event.rejectReason = data.reject.reason || 'Not accepted by municipal inspection.';
      await event.save({ session });

      await StatusEvent.create(
        [
          {
            entityType: 'COMPLAINT',
            entityId: event._id,
            from: prevStatus,
            to: 'REJECTED',
            actorId: userId,
            actorRole: 'OPERATOR',
            note: event.rejectReason,
          },
        ],
        { session }
      );

      // Reject all pending transactions
      const pendingTx = await ImpactTransaction.find({
        complaintId: event._id,
        status: TRANSACTION_STATUSES.PENDING,
      }).session(session);

      for (const tx of pendingTx) {
        tx.status = TRANSACTION_STATUSES.REJECTED;
        tx.closedAt = new Date();
        await tx.save({ session });
        impactSummary.rejected++;
      }

      await Report.updateMany({ complaintId: event._id }, { state: 'REJECTED' }, { session });

      // Notify citizen reports of rejection with reason
      const rejectedReports = await Report.find({ complaintId: event._id }).session(session).lean();
      for (const rep of rejectedReports) {
        await createCitizenNotification({
          recipientUserId: rep.citizenId,
          reportId: rep._id,
          eventId: event._id,
          eventCode: event.code,
          type: 'REJECTED',
          title: `Report Not Accepted: ${event.code}`,
          message: `Your report was inspected by municipal operators: ${event.rejectReason || 'Inspection criteria not met.'}`,
          severity: 'NORMAL',
          dedupKey: `cit_rej_${event._id}_${rep._id}`,
        });
      }

      return { event, impactSummary };
    });
  }

  // 2. Edit fields
  if (data.category) {
    // If event is already scheduled, prevent silent category mismatch
    if (event.status === 'SCHEDULED' && data.category !== event.category) {
      const err = new Error('This event is already assigned to a collection trip. Unassign the route before altering category.');
      err.status = 409;
      err.code = 'ROUTE_CONFLICT';
      throw err;
    }
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
      reviewedSupportCount: event.reviewedSupportCount,
      sensitiveSite: event.sensitiveSite,
    });

    return await withTransaction(async (session) => {
      const prevStatus = event.status;
      event.status = 'VERIFIED';
      event.verifiedBy = userId;
      event.verifiedAt = new Date();
      event.priority = {
        ...priorityResult,
        computedAt: new Date(),
      };
      await event.save({ session });

      await StatusEvent.create(
        [
          {
            entityType: 'COMPLAINT',
            entityId: event._id,
            from: prevStatus,
            to: 'VERIFIED',
            actorId: userId,
            actorRole: 'OPERATOR',
            note: `Verified at ${priorityResult.tier} priority (${priorityResult.score} pts, ~${event.estimatedWeightKg} kg).`,
          },
        ],
        { session }
      );

      // Verify pending primary report transaction
      const pendingPrimary = await ImpactTransaction.find({
        complaintId: event._id,
        type: { $in: [TRANSACTION_TYPES.UNIQUE_REPORT, TRANSACTION_TYPES.CLASSIFICATION_CORRECTION] },
        status: TRANSACTION_STATUSES.PENDING,
      }).session(session);

      for (const tx of pendingPrimary) {
        if (tx.type === TRANSACTION_TYPES.CLASSIFICATION_CORRECTION) {
          const report = await Report.findById(tx.reportId).session(session);
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
        await tx.save({ session });
      }

      // Notify citizen reports of verification
      const verifiedReports = await Report.find({ complaintId: event._id }).session(session).lean();
      for (const rep of verifiedReports) {
        await createCitizenNotification({
          recipientUserId: rep.citizenId,
          reportId: rep._id,
          eventId: event._id,
          eventCode: event.code,
          type: 'VERIFIED',
          title: `Report Verified: ${event.code}`,
          message: `Your report was verified by municipal operators (~${event.estimatedWeightKg} kg ${event.category.toLowerCase()}) at ${priorityResult.tier} priority. Queued for collection dispatch.`,
          severity: 'NORMAL',
          dedupKey: `cit_verif_${event._id}_${rep._id}`,
        });
      }

      return { event, impactSummary };
    });
  } else {
    // If already verified, recompute priority
    if (['VERIFIED', 'SCHEDULED', 'REOPENED'].includes(event.status)) {
      const priorityResult = computePriority({
        severity: event.severity,
        firstReportedAt: event.firstReportedAt,
        supportCount: event.supportCount,
        reviewedSupportCount: event.reviewedSupportCount,
        sensitiveSite: event.sensitiveSite,
      });
      event.priority = {
        ...priorityResult,
        computedAt: new Date(),
      };
    }
    await event.save();
    return { event, impactSummary };
  }
}

export async function resolveOperatorEvent(eventId, data, userId) {
  const {
    to,
    note,
    closurePhoto,
    receivingFacilityName,
    receiptReference,
    sourceUrl,
  } = data;

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

  if (event.status === 'RESOLVED') {
    const err = new Error('This waste incident has already been resolved.');
    err.status = 409;
    err.code = 'ALREADY_RESOLVED';
    throw err;
  }

  if (event.status === 'SUBMITTED') {
    const err = new Error('Cannot resolve an unverified incident. Operational inspection/verification is required first.');
    err.status = 400;
    err.code = 'CANNOT_RESOLVE_UNVERIFIED';
    throw err;
  }

  // Validate photographic closure evidence
  if (!closurePhoto || !closurePhoto.uploadToken) {
    const err = new Error('Clearance photograph evidence is strictly required to resolve an incident.');
    err.status = 400;
    err.code = 'CLOSURE_PHOTO_REQUIRED';
    throw err;
  }

  const tokenPayload = verifyUploadToken(closurePhoto.uploadToken, userId);
  if (!tokenPayload) {
    const err = new Error('Invalid or expired closure photo upload token.');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const evidence = await UploadEvidence.findOne({
    publicId: tokenPayload.publicId,
    ownerId: userId,
  });

  if (!evidence) {
    const err = new Error('Closure photo evidence not found.');
    err.status = 400;
    err.code = 'EVIDENCE_NOT_FOUND';
    throw err;
  }

  if (evidence.used) {
    const err = new Error('Closure photo token has already been used.');
    err.status = 409;
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }

  // Check if specialist / e-waste / household handoff
  const isSpecialistOrHousehold =
    event.reportType === 'HOUSEHOLD' ||
    event.category === 'E_WASTE' ||
    event.specialistFlag ||
    (event.specialistQueue && event.specialistQueue !== 'NONE');

  if (isSpecialistOrHousehold) {
    if (!receivingFacilityName || !receivingFacilityName.trim()) {
      const err = new Error('Actual receiving facility or authorized recycler service name is required.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!receiptReference || !receiptReference.trim()) {
      const err = new Error('Receipt or acceptance reference number is required.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!sourceUrl || !sourceUrl.trim().startsWith('http')) {
      const err = new Error('Valid official directory source URL (e.g. MPCB/CPCB e-waste directory) is required to verify the facility.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  // Server-side AI review verification (never trust client input)
  let serverAiReview = null;
  const primaryReport = await Report.findById(event.primaryReportId).lean();
  if (primaryReport?.imageUrl && evidence?.imageUrl) {
    try {
      serverAiReview = await compareCollectionEvidence(
        primaryReport.imageUrl,
        'image/jpeg',
        evidence.imageUrl,
        evidence.mimeType || 'image/jpeg'
      );
    } catch (aiErr) {
      console.warn('[resolveOperatorEvent] AI review error:', aiErr.message);
      serverAiReview = {
        status: 'UNAVAILABLE',
        assessment: 'UNABLE_TO_ASSESS',
        confidence: null,
        shortReason: 'AI assessment service unavailable. Manual operator inspection verified.',
        provider: 'none',
      };
    }
  } else {
    serverAiReview = {
      status: 'UNAVAILABLE',
      assessment: 'UNABLE_TO_ASSESS',
      confidence: null,
      shortReason: 'Before photo unavailable for AI comparison. Manual operator inspection verified.',
      provider: 'none',
    };
  }

  return await withTransaction(async (session) => {
    const prevStatus = event.status;
    event.status = 'RESOLVED';
    event.resolvedAt = new Date();
    event.resolvedBy = userId;
    event.closureNote = note || '';
    event.closurePhotoUrl = evidence.imageUrl;
    event.closurePublicId = evidence.publicId;

    event.completionEvidence = {
      receivingFacilityName: receivingFacilityName ? receivingFacilityName.trim() : null,
      receiptReference: receiptReference ? receiptReference.trim() : null,
      sourceUrl: sourceUrl ? sourceUrl.trim() : null,
      completionPhotoUrl: evidence.imageUrl,
      completionPublicId: evidence.publicId,
      operatorNote: note || '',
      timestamp: new Date(),
    };

    await event.save({ session });

    // Mark evidence as consumed
    evidence.used = true;
    evidence.usedAt = new Date();
    evidence.usedForId = event._id;
    await evidence.save({ session });

    await StatusEvent.create(
      [
        {
          entityType: 'COMPLAINT',
          entityId: event._id,
          from: prevStatus,
          to: 'RESOLVED',
          actorId: userId,
          actorRole: 'OPERATOR',
          note: isSpecialistOrHousehold
            ? `Specialist handoff recorded to ${receivingFacilityName} (Ref: ${receiptReference}).`
            : note || 'Marked resolved with photographic clearance verification.',
        },
      ],
      { session }
    );

    // Update Route stop state if assigned
    let routeUpdate = null;
    if (event.assignedRouteId) {
      const route = await Route.findById(event.assignedRouteId).session(session);
      if (route) {
        const stop = route.stops.find((s) => s.eventId.toString() === event._id.toString());
        if (stop) {
          stop.state = 'DONE';
          stop.completedAt = new Date();
          stop.completedBy = userId;
          stop.completionPhotoUrl = evidence.imageUrl;
          stop.completionPublicId = evidence.publicId;
          stop.operatorNote = note || '';
          if (serverAiReview) {
            stop.aiReview = {
              assessment: serverAiReview.assessment,
              confidence: serverAiReview.confidence,
              shortReason: serverAiReview.shortReason,
              provider: serverAiReview.provider || 'gemini',
            };
          }
        }

        // Advance next pending stop to EN_ROUTE
        const nextStop = route.stops.find((s) => s.state === 'PENDING');
        if (nextStop) {
          nextStop.state = 'EN_ROUTE';
        }

        const remainingStops = route.stops.filter((s) => s.state !== 'DONE' && s.state !== 'SKIPPED');
        if (remainingStops.length === 0) {
          route.status = 'COMPLETED';
        } else if (route.status === 'ASSIGNED') {
          route.status = 'IN_PROGRESS';
        }
        await route.save({ session });
        routeUpdate = { id: route._id.toString(), status: route.status, remainingStops: remainingStops.length };
      }
    }

    // Award RESOLUTION_BONUS credits once to primary reporter
    const existingBonus = await ImpactTransaction.findOne({
      complaintId: event._id,
      type: TRANSACTION_TYPES.RESOLUTION_BONUS,
    }).session(session);

    if (!existingBonus) {
      const primaryReport = await Report.findById(event.primaryReportId).session(session);
      if (primaryReport) {
        await ImpactTransaction.create(
          [
            {
              citizenId: primaryReport.citizenId,
              complaintId: event._id,
              reportId: primaryReport._id,
              type: TRANSACTION_TYPES.RESOLUTION_BONUS,
              credits: CREDIT_VALUES.RESOLUTION_PRIMARY_BONUS,
              status: TRANSACTION_STATUSES.VERIFIED,
              reason: 'Waste cleared and resolved with verified completion evidence',
              verifiedAt: new Date(),
            },
          ],
          { session }
        );
      }

      // Bonus for verified supporting reports
      const supportingReports = await Report.find({
        complaintId: event._id,
        role: 'SUPPORTING',
      }).session(session);

      for (const sup of supportingReports) {
        const supTx = await ImpactTransaction.findOne({
          reportId: sup._id,
          status: TRANSACTION_STATUSES.VERIFIED,
          credits: { $gt: 0 },
        }).session(session);

        if (supTx) {
          await ImpactTransaction.create(
            [
              {
                citizenId: sup.citizenId,
                complaintId: event._id,
                reportId: sup._id,
                type: TRANSACTION_TYPES.RESOLUTION_BONUS,
                credits: CREDIT_VALUES.RESOLUTION_SUPPORTING_BONUS,
                status: TRANSACTION_STATUSES.VERIFIED,
                reason: 'Waste incident resolved — verified support contribution bonus',
                verifiedAt: new Date(),
              },
            ],
            { session }
          );
        }
      }
    }

    // Notify citizen reports of collection resolution
    const resolvedReports = await Report.find({ complaintId: event._id }).session(session).lean();
    for (const rep of resolvedReports) {
      await createCitizenNotification({
        recipientUserId: rep.citizenId,
        reportId: rep._id,
        eventId: event._id,
        eventCode: event.code,
        type: 'COLLECTED',
        title: `Collection Confirmed: ${event.code}`,
        message: `Waste clearance confirmed by operator inspection with photographic proof. Resolution impact credits credited!`,
        severity: 'NORMAL',
        dedupKey: `cit_res_${event._id}_${rep._id}`,
      });
    }

    return { event, route: routeUpdate, aiReview: serverAiReview };
  });
}

export async function uploadClosurePhoto(fileBuffer, mimeType, userId) {
  if (!fileBuffer || fileBuffer.length === 0) {
    const err = new Error('No image file provided.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (fileBuffer.length > 5 * 1024 * 1024) {
    const err = new Error('Image exceeds 5MB size limit.');
    err.status = 413;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  if (!validateImageBuffer(fileBuffer)) {
    const err = new Error('Corrupted or unsupported image file. Please upload a valid JPEG, PNG, or WebP photo.');
    err.status = 400;
    err.code = 'INVALID_IMAGE_FORMAT';
    throw err;
  }

  const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const storageResult = await uploadImage(fileBuffer, mimeType);

  await UploadEvidence.create({
    publicId: storageResult.imagePublicId,
    ownerId: userId,
    purpose: 'OPERATOR_CLOSURE',
    imageUrl: storageResult.imageUrl,
    imageHash,
    mimeType: mimeType || 'image/jpeg',
    sizeBytes: fileBuffer.length,
    used: false,
  });

  const uploadToken = signUploadToken(storageResult.imagePublicId, userId);
  return {
    imageUrl: storageResult.imageUrl,
    imagePublicId: storageResult.imagePublicId,
    uploadToken,
  };
}
