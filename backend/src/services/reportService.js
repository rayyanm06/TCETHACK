import crypto from 'crypto';
import { atomic } from '../utils/atomic.js';
import { reportSchema, coordinatesSchema, fail } from '../utils/validation.js';
import { storeEvidence, readEvidence } from './uploadEvidence.js';
import { areCategoriesCompatible } from '../engines/duplicates.js';
import { handlingFor } from './disposalService.js';
import { Report } from '../models/Report.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { ImpactTransaction } from '../models/ImpactTransaction.js';
import { uploadImage } from '../adapters/storage/index.js';
import { classifyImage } from '../adapters/vision/index.js';
import { signUploadToken, verifyUploadToken } from '../utils/token.js';
import { findDuplicateCandidates } from '../engines/duplicates.js';
import { computePriority } from '../engines/priority.js';
import { calculateSupportCredits, CREDIT_VALUES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../engines/impact.js';
import { isInsideBoundingBox, haversineDistance } from '../engines/geo.js';
import { THRESHOLDS } from '../config/thresholds.js';

export async function classifyUploadedPhoto(buffer, mime, userId) { return storeEvidence(buffer, mime, userId, 'REPORT'); }

export async function findNearbyCandidates(lat, lng, category) {
  const coord = coordinatesSchema.parse({ lat: Number(lat), lng: Number(lng) });
  if (isNaN(coord.lat) || isNaN(coord.lng)) {
    const err = new Error('Invalid coordinates.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const activeEvents = await WasteEvent.find({
    location: {$geoWithin: {$centerSphere:[[coord.lng,coord.lat],THRESHOLDS.DUP_RADIUS_M/6371000]}},
    firstReportedAt: {$gte:new Date(Date.now()-THRESHOLDS.DUP_WINDOW_DAYS*86400000)},
    reportContext: {$ne: 'HOUSEHOLD'},
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
  }).populate('primaryReportId', 'imageUrl').lean();

  for (const event of activeEvents) event.photoUrl = event.primaryReportId?.imageUrl;
  const candidates = findDuplicateCandidates({
    location: coord,
    category,
    events: activeEvents,
    radiusM: THRESHOLDS.DUP_RADIUS_M,
    windowDays: THRESHOLDS.DUP_WINDOW_DAYS,
    looseCategory: THRESHOLDS.DUP_LOOSE_CATEGORY,
  });

  return {
    candidates,
    radiusM: THRESHOLDS.DUP_RADIUS_M,
  };
}

export function createPrimaryReport(data, userId) { return atomic(() => createPrimaryReportAtomic(data, userId)); }
async function createPrimaryReportAtomic(data, userId) {
  data = reportSchema.parse(data);
  const prior = await Report.findOne({citizenId:userId,requestId:data.requestId});
  if (prior) return {report:prior,complaint:await WasteEvent.findById(prior.complaintId),role:prior.role,impact:await ImpactTransaction.find({reportId:prior._id})};
  const evidence = await readEvidence(data.uploadToken, userId, 'REPORT', data.requestId);
  data = {...data, ...evidence};
  if (data.reportContext === 'HOUSEHOLD' && (!data.itemDescription || !data.itemCount)) fail('Describe the items and quantity for household disposal.');
  const {
    requestId,
    uploadToken,
    imageUrl,
    imagePublicId,
    imageHash,
    location,
    locationSource,
    locationAccuracyM,
    addressText,
    ai,
    citizenCategory,
    description,
    duplicateDecision = 'NONE_FOUND',
  } = data;

  // 1. Idempotency check
  if (requestId) {
    const existingReport = await Report.findOne({ citizenId: userId, requestId });
    if (existingReport) {
      const complaint = await WasteEvent.findById(existingReport.complaintId);
      const impact = await ImpactTransaction.find({ reportId: existingReport._id });
      return {
        report: existingReport,
        complaint,
        role: 'PRIMARY',
        impact,
      };
    }
  }

  // 2. Validate upload token
  if (!verifyUploadToken(uploadToken, userId)) {
    const err = new Error('Invalid or expired upload token.');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  // 3. Verify coordinates inside service area
  const coord = coordinatesSchema.parse({lat: location?.lat, lng: location?.lng});
  if (!isInsideBoundingBox(coord, THRESHOLDS.SERVICE_AREA_BBOX)) {
    const err = new Error('This location is outside the current service area.');
    err.status = 400;
    err.code = 'OUTSIDE_SERVICE_AREA';
    throw err;
  }

  // 4. Check for duplicate image submission by this citizen
  const dupImage = await Report.findOne({ citizenId: userId, imageHash });
  if (dupImage) {
    const err = new Error('You have already submitted this photograph.');
    err.status = 409;
    err.code = 'DUPLICATE_IMAGE';
    throw err;
  }

  // 5. Check duplicate candidates unless citizen explicitly chose SEPARATE
  if (data.reportContext !== 'HOUSEHOLD' && duplicateDecision !== 'SEPARATE') {
    const { candidates } = await findNearbyCandidates(coord.lat, coord.lng, citizenCategory);
    if (candidates.length > 0) {
      const err = new Error('Possible duplicate reports detected in this vicinity.');
      err.status = 409;
      err.code = 'DUPLICATE_DECISION_REQUIRED';
      err.fields = { candidates };
      throw err;
    }
  }

  // 6. Generate next sequential event code (WE-XXXX)
  const code = `WE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const categoryCorrected =
    ai?.status === 'OK' &&
    ai?.category &&
    ai?.category !== citizenCategory;

  // 7. Create WasteEvent
  const event = await WasteEvent.create({
    code,
    reportContext: data.reportContext,
    itemDescription: data.itemDescription,
    itemCount: data.itemCount,
    requiresSpecialHandling: data.requiresSpecialHandling,
    location: {
      type: 'Point',
      coordinates: [coord.lng, coord.lat],
    },
    addressText: addressText || `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
    category: citizenCategory,
    aiSuggestedCategory: ai?.category || 'UNKNOWN',
    categoryConfirmedBy: 'CITIZEN',
    status: 'SUBMITTED',
    supportCount: 0,
    firstReportedAt: new Date(),
    lastReportedAt: new Date(),
  });

  // 8. Create Report
  const report = await Report.create({
    citizenId: userId,
    complaintId: event._id,
    role: 'PRIMARY',
    imageUrl,
    imagePublicId,
    imageHash,
    location: {
      type: 'Point',
      coordinates: [coord.lng, coord.lat],
    },
    locationSource: locationSource || 'MAP_PIN',
    locationAccuracyM,
    addressText: event.addressText,
    aiSuggestedCategory: ai?.category,
    aiShortReason: ai?.shortReason,
    aiStatus: ai?.status || 'UNAVAILABLE',
    aiProvider: ai?.provider,
    citizenCategory,
    categoryCorrected,
    description,
    duplicateDecision,
    requestId: requestId || crypto.randomUUID(),
  });

  event.primaryReportId = report._id;
  await event.save();

  // 9. Create StatusEvent
  await StatusEvent.create({
    entityType: 'COMPLAINT',
    entityId: event._id,
    from: null,
    to: 'SUBMITTED',
    actorId: userId,
    actorRole: 'CITIZEN',
    note: 'Initial report submitted by citizen.',
  });

  // 10. Create PENDING Impact Transactions
  const impactTransactions = [];
  const primaryTx = await ImpactTransaction.create({
    citizenId: userId,
    complaintId: event._id,
    reportId: report._id,
    type: TRANSACTION_TYPES.UNIQUE_REPORT,
    credits: CREDIT_VALUES.UNIQUE_REPORT,
    status: TRANSACTION_STATUSES.PENDING,
    reason: 'Identified unique waste incident',
  });
  impactTransactions.push(primaryTx);

  if (categoryCorrected) {
    const correctionTx = await ImpactTransaction.create({
      citizenId: userId,
      complaintId: event._id,
      reportId: report._id,
      type: TRANSACTION_TYPES.CLASSIFICATION_CORRECTION,
      credits: CREDIT_VALUES.CLASSIFICATION_CORRECTION,
      status: TRANSACTION_STATUSES.PENDING,
      reason: 'Citizen correction of AI waste classification',
    });
    impactTransactions.push(correctionTx);
  }

  return {
    report,
    complaint: {
      id: event._id.toString(),
      code: event.code,
      status: event.status,
      supportCount: event.supportCount,
    },
    role: 'PRIMARY',
    impact: impactTransactions,
  };
}

export function supportExistingEvent(complaintId, data, userId) { return atomic(() => supportAtomic(complaintId, data, userId)); }
async function supportAtomic(complaintId, data, userId) {
  data = reportSchema.parse(data);
  const prior = await Report.findOne({citizenId:userId,requestId:data.requestId});
  if (prior) {
    if(String(prior.complaintId)!==String(complaintId)) fail('This request ID was already used for another report.','IDEMPOTENCY_CONFLICT',409);
    return {report:prior,complaint:await WasteEvent.findById(prior.complaintId),role:prior.role,impact:await ImpactTransaction.find({reportId:prior._id})};
  }
  data = {...data, ...await readEvidence(data.uploadToken, userId, 'REPORT', data.requestId)};
  const {
    uploadToken,
    imageUrl,
    imagePublicId,
    imageHash,
    location,
    locationSource,
    locationAccuracyM,
    addressText,
    ai,
    citizenCategory,
    description,
  } = data;

  // 1. Verify upload token
  if (!verifyUploadToken(uploadToken, userId)) {
    const err = new Error('Invalid or expired upload token.');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  // 2. Fetch complaint
  const event = await WasteEvent.findById(complaintId);
  if (!event) {
    const err = new Error('Incident not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!['SUBMITTED', 'VERIFIED', 'SCHEDULED'].includes(event.status)) {
    const err = new Error('This waste incident has already been closed.');
    err.status = 409;
    err.code = 'EVENT_CLOSED';
    throw err;
  }

  if (event.reportContext === 'HOUSEHOLD' || data.reportContext === 'HOUSEHOLD') fail('Household requests cannot be supported publicly.', 'PRIVATE_REQUEST', 403);
  if(data.requiresSpecialHandling && event.status === 'SCHEDULED') fail('This new hazard needs a separate specialist report. Choose Different waste to alert the operator.', 'HAZARD_REVIEW_REQUIRED',409);
  if (!areCategoriesCompatible(citizenCategory, event.category)) fail('The categories do not describe the same incident.');
  // 3. Check if user already contributed
  const existingReport = await Report.findOne({ citizenId: userId, complaintId });
  if (existingReport) {
    const err = new Error('You have already contributed to this waste incident.');
    err.status = 409;
    err.code = 'ALREADY_CONTRIBUTED';
    throw err;
  }

  // 4. Verify distance from event <= radius
  const coord = coordinatesSchema.parse({lat: location?.lat, lng: location?.lng});
  const eventCoord = { lat: event.location.coordinates[1], lng: event.location.coordinates[0] };
  const distanceM = haversineDistance(coord, eventCoord);
  if (distanceM > THRESHOLDS.DUP_RADIUS_M) {
    const err = new Error(`Supporting report location is too far from existing event (${Math.round(distanceM)}m).`);
    err.status = 400;
    err.code = 'TOO_FAR';
    throw err;
  }

  // 5. Check duplicate image hash
  const dupImage = await Report.findOne({ citizenId: userId, imageHash });
  if (dupImage) {
    const err = new Error('You have already submitted this photograph.');
    err.status = 409;
    err.code = 'DUPLICATE_IMAGE';
    throw err;
  }

  // 6. Create Supporting Report
  const report = await Report.create({
    citizenId: userId,
    complaintId: event._id,
    role: 'SUPPORTING',
    imageUrl,
    imagePublicId,
    imageHash,
    location: {
      type: 'Point',
      coordinates: [coord.lng, coord.lat],
    },
    locationSource: locationSource || 'MAP_PIN',
    locationAccuracyM,
    addressText: addressText || event.addressText,
    aiSuggestedCategory: ai?.category,
    aiShortReason: ai?.shortReason,
    aiStatus: ai?.status || 'UNAVAILABLE',
    aiProvider: ai?.provider,
    citizenCategory: citizenCategory || event.category,
    categoryCorrected: false,
    description,
    duplicateDecision: 'SUPPORT',
    requestId: data.requestId,
  });

  // 7. Update event support count
  event.supportCount += 1;
  if(data.requiresSpecialHandling) event.requiresSpecialHandling = true;
  event.lastReportedAt = new Date();

  // If already verified or scheduled, recompute priority
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
  await event.save();

  // 8. Create Impact Transaction
  // If event is already VERIFIED, supporting report is verified immediately!
  const isDirectlyVerified = false;
  const { credits, reason } = calculateSupportCredits(event.supportCount - 1);

  const tx = await ImpactTransaction.create({
    citizenId: userId,
    complaintId: event._id,
    reportId: report._id,
    type: TRANSACTION_TYPES.SUPPORTING_REPORT,
    credits,
    status: isDirectlyVerified ? TRANSACTION_STATUSES.VERIFIED : TRANSACTION_STATUSES.PENDING,
    reason,
    verifiedAt: isDirectlyVerified ? new Date() : null,
  });

  return {
    report,
    complaint: {
      id: event._id.toString(),
      code: event.code,
      status: event.status,
      supportCount: event.supportCount,
    },
    role: 'SUPPORTING',
    impact: [tx],
  };
}

export async function getCitizenReports(userId, statusFilter = 'all') {
  const query = { citizenId: userId };
  const reports = await Report.find(query).sort({ createdAt: -1 }).populate('complaintId').lean();

  const filtered = reports.filter((r) => {
    if (!r.complaintId) return false;
    if (statusFilter === 'active') {
      return ['SUBMITTED', 'VERIFIED', 'SCHEDULED'].includes(r.complaintId.status);
    }
    if (statusFilter === 'resolved') {
      return r.complaintId.status === 'RESOLVED';
    }
    return true;
  });

  const reportIds = filtered.map((r) => r._id);
  const transactions = await ImpactTransaction.find({ reportId: { $in: reportIds } }).lean();
  const txByReport = new Map();
  for (const tx of transactions) {
    txByReport.set(tx.reportId.toString(), tx);
  }

  const items = filtered.map((r) => {
    const tx = txByReport.get(r._id.toString());
    return {
      id: r._id.toString(),
      role: r.role,
      imageUrl: r.imageUrl,
      category: r.citizenCategory,
      addressText: r.addressText || r.complaintId.addressText,
      createdAt: r.createdAt,
      complaint: {
        id: r.complaintId._id.toString(),
        code: r.complaintId.code,
        status: r.complaintId.status,
        supportCount: r.complaintId.supportCount,
        updatedAt: r.complaintId.updatedAt,
      },
      impact: {
        credits: tx?.credits || 0,
        state: tx?.status || 'PENDING',
      },
    };
  });

  return { items };
}

export async function getReportDetails(reportId, userId) {
  const report = await Report.findOne({ _id: reportId, citizenId: userId }).lean();
  if (!report) {
    const err = new Error('Report not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const complaint = await WasteEvent.findById(report.complaintId).lean();
  const timeline = await StatusEvent.find({ entityId: report.complaintId })
    .sort({ createdAt: 1 })
    .lean();
  const impact = await ImpactTransaction.find({ reportId: report._id }).lean();

  return {
    report,
    complaint,
    handling: handlingFor(complaint.category, complaint.requiresSpecialHandling, complaint.reportContext),
    timeline,
    closure: complaint.status === 'RESOLVED'
      ? {
          photoUrl: complaint.closurePhotoUrl,
          note: complaint.closureNote,
          resolvedAt: complaint.resolvedAt,
        }
      : null,
    impact,
  };
}
