import crypto from 'crypto';
import { Report } from '../models/Report.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { StatusEvent } from '../models/StatusEvent.js';
import { ImpactTransaction } from '../models/ImpactTransaction.js';
import { UploadEvidence } from '../models/UploadEvidence.js';
import { uploadImage } from '../adapters/storage/index.js';
import { classifyImage } from '../adapters/vision/index.js';
import { signUploadToken, verifyUploadToken } from '../utils/token.js';
import { withTransaction } from '../utils/transaction.js';
import { findDuplicateCandidates } from '../engines/duplicates.js';
import { computePriority } from '../engines/priority.js';
import { calculateSupportCredits, CREDIT_VALUES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../engines/impact.js';
import { isInsideBoundingBox, haversineDistance } from '../engines/geo.js';
import { THRESHOLDS } from '../config/thresholds.js';

/**
 * Validates file buffer content to verify it is an actual JPEG, PNG, or WebP image.
 */
function validateImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // WebP: RIFF ... WEBP
  const isWebp =
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isWebp;
}

export async function classifyUploadedPhoto(fileBuffer, mimeType, userId) {
  if (!fileBuffer || fileBuffer.length === 0) {
    const err = new Error('No image provided.');
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

  // Validate actual image content
  if (!validateImageBuffer(fileBuffer)) {
    const err = new Error('Corrupted or unsupported image file. Please upload a valid JPEG, PNG, or WebP photo.');
    err.status = 400;
    err.code = 'INVALID_IMAGE_FORMAT';
    throw err;
  }

  // Calculate SHA-256 hash of image
  const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Upload to storage & classify via vision model in parallel
  const [storageResult, aiResult] = await Promise.all([
    uploadImage(fileBuffer, mimeType),
    classifyImage(fileBuffer, mimeType),
  ]);

  // Persist upload evidence record to bind evidence to owner and prevent forged URLs or token reuse
  const evidence = await UploadEvidence.create({
    publicId: storageResult.imagePublicId,
    ownerId: userId,
    purpose: 'CITIZEN_REPORT',
    imageUrl: storageResult.imageUrl,
    imageHash,
    mimeType: mimeType || 'image/jpeg',
    sizeBytes: fileBuffer.length,
    aiResult,
    used: false,
  });

  const uploadToken = signUploadToken(storageResult.imagePublicId, userId);

  return {
    imageUrl: storageResult.imageUrl,
    imagePublicId: storageResult.imagePublicId,
    uploadToken,
    imageHash,
    ai: aiResult,
  };
}

export async function findNearbyCandidates(lat, lng, category) {
  const coord = { lat: Number(lat), lng: Number(lng) };
  if (isNaN(coord.lat) || isNaN(coord.lng)) {
    const err = new Error('Invalid coordinates.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Exclude private household requests from nearby public searches
  const activeEvents = await WasteEvent.find({
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
    reportType: { $ne: 'HOUSEHOLD' },
  }).lean();

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

export async function createPrimaryReport(data, userId) {
  const {
    requestId,
    uploadToken,
    location,
    locationSource,
    locationAccuracyM,
    addressText,
    citizenCategory,
    description,
    duplicateDecision = 'NONE_FOUND',
    reportType = 'PUBLIC',
    householdItems,
    householdQuantity,
    specialistFlag = false,
  } = data;

  // 1. Idempotency check with stable requestId
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
        isRetry: true,
      };
    }
  }

  // 2. Validate upload token and verify bound evidence record
  const tokenPayload = verifyUploadToken(uploadToken, userId);
  if (!tokenPayload) {
    const err = new Error('Invalid or expired upload token. Please upload the photo again.');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const evidence = await UploadEvidence.findOne({
    publicId: tokenPayload.publicId,
    ownerId: userId,
  });

  if (!evidence) {
    const err = new Error('Uploaded photo evidence not found for this account.');
    err.status = 400;
    err.code = 'EVIDENCE_NOT_FOUND';
    throw err;
  }

  if (evidence.used) {
    const err = new Error('This upload token has already been used for a submission.');
    err.status = 409;
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }

  // Use verified server metadata from evidence record
  const imageUrl = evidence.imageUrl;
  const imagePublicId = evidence.publicId;
  const imageHash = evidence.imageHash;
  const verifiedAi = evidence.aiResult;

  // 3. Verify coordinates inside rectangular service area
  const coord = { lat: Number(location?.lat), lng: Number(location?.lng) };
  if (!isInsideBoundingBox(coord, THRESHOLDS.SERVICE_AREA_BBOX)) {
    const err = new Error('This location is outside the municipal service area (Greater Mumbai).');
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

  // 5. For public reports, check duplicate candidates unless citizen chose SEPARATE
  const isHousehold = reportType === 'HOUSEHOLD';
  if (!isHousehold && duplicateDecision !== 'SEPARATE') {
    const { candidates } = await findNearbyCandidates(coord.lat, coord.lng, citizenCategory);
    if (candidates.length > 0) {
      const err = new Error('Possible duplicate reports detected in this vicinity.');
      err.status = 409;
      err.code = 'DUPLICATE_DECISION_REQUIRED';
      err.fields = { candidates };
      throw err;
    }
  }

  // Validate household fields
  if (isHousehold) {
    if (!householdItems || !householdItems.trim()) {
      const err = new Error('Please describe the household items needing disposal (e.g. 4 old phones, microwave).');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  // Determine specialist queue
  let specialistQueue = 'NONE';
  if (citizenCategory === 'E_WASTE') {
    specialistQueue = 'E_WASTE';
  } else if (specialistFlag) {
    specialistQueue = 'HAZARDOUS';
  } else if (isHousehold) {
    specialistQueue = 'HOUSEHOLD_SPECIALIST';
  }

  const categoryCorrected =
    verifiedAi?.status === 'OK' &&
    verifiedAi?.category &&
    verifiedAi?.category !== citizenCategory;

  return await withTransaction(async (session) => {
    // 6. Generate next sequential event code (WE-XXXX)
    const count = await WasteEvent.countDocuments();
    const code = `WE-${String(count + 1).padStart(4, '0')}`;

    // 7. Create WasteEvent
    const [event] = await WasteEvent.create(
      [
        {
          code,
          location: {
            type: 'Point',
            coordinates: [coord.lng, coord.lat],
          },
          addressText: addressText || `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
          category: citizenCategory,
          aiSuggestedCategory: verifiedAi?.category || 'UNKNOWN',
          categoryConfirmedBy: 'CITIZEN',
          reportType: isHousehold ? 'HOUSEHOLD' : 'PUBLIC',
          householdItems: isHousehold ? householdItems.trim() : undefined,
          householdQuantity: isHousehold ? Number(householdQuantity) || 1 : undefined,
          specialistFlag: Boolean(specialistFlag),
          specialistQueue,
          status: 'SUBMITTED',
          supportCount: 0,
          reviewedSupportCount: 0,
          firstReportedAt: new Date(),
          lastReportedAt: new Date(),
        },
      ],
      { session }
    );

    // 8. Create Report
    const [report] = await Report.create(
      [
        {
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
          aiSuggestedCategory: verifiedAi?.category,
          aiShortReason: verifiedAi?.shortReason,
          aiStatus: verifiedAi?.status || 'OK',
          aiProvider: verifiedAi?.provider,
          citizenCategory,
          categoryCorrected,
          description,
          reportType: isHousehold ? 'HOUSEHOLD' : 'PUBLIC',
          householdItems: isHousehold ? householdItems.trim() : undefined,
          householdQuantity: isHousehold ? Number(householdQuantity) || 1 : undefined,
          specialistFlag: Boolean(specialistFlag),
          duplicateDecision,
          requestId: requestId || crypto.randomUUID(),
        },
      ],
      { session }
    );

    event.primaryReportId = report._id;
    await event.save({ session });

    // Mark evidence as consumed
    evidence.used = true;
    evidence.usedAt = new Date();
    evidence.usedForId = event._id;
    await evidence.save({ session });

    // 9. Create StatusEvent
    await StatusEvent.create(
      [
        {
          entityType: 'COMPLAINT',
          entityId: event._id,
          from: null,
          to: 'SUBMITTED',
          actorId: userId,
          actorRole: 'CITIZEN',
          note: isHousehold
            ? `Household disposal request submitted (${householdQuantity || 1}x ${householdItems}).`
            : 'Initial public waste incident submitted.',
        },
      ],
      { session }
    );

    // 10. Create PENDING Impact Transactions
    const impactTransactions = [];
    const [primaryTx] = await ImpactTransaction.create(
      [
        {
          citizenId: userId,
          complaintId: event._id,
          reportId: report._id,
          type: TRANSACTION_TYPES.UNIQUE_REPORT,
          credits: CREDIT_VALUES.UNIQUE_REPORT,
          status: TRANSACTION_STATUSES.PENDING,
          reason: isHousehold ? 'Household private disposal request registered' : 'Identified unique waste incident',
        },
      ],
      { session }
    );
    impactTransactions.push(primaryTx);

    if (categoryCorrected) {
      const [correctionTx] = await ImpactTransaction.create(
        [
          {
            citizenId: userId,
            complaintId: event._id,
            reportId: report._id,
            type: TRANSACTION_TYPES.CLASSIFICATION_CORRECTION,
            credits: CREDIT_VALUES.CLASSIFICATION_CORRECTION,
            status: TRANSACTION_STATUSES.PENDING,
            reason: 'Citizen correction of AI waste classification',
          },
        ],
        { session }
      );
      impactTransactions.push(correctionTx);
    }

    return {
      report,
      complaint: {
        id: event._id.toString(),
        code: event.code,
        status: event.status,
        supportCount: event.supportCount,
        reportType: event.reportType,
        specialistQueue: event.specialistQueue,
        nextStepNote: isHousehold
          ? 'Your household disposal request is pending operator coordination with authorized take-back services. Pickup is not automatically booked.'
          : 'Your public report is in the operator inspection queue.',
      },
      role: 'PRIMARY',
      impact: impactTransactions,
    };
  });
}

export async function supportExistingEvent(complaintId, data, userId) {
  const {
    uploadToken,
    location,
    locationSource,
    locationAccuracyM,
    addressText,
    citizenCategory,
    description,
  } = data;

  // 1. Verify upload token and evidence
  const tokenPayload = verifyUploadToken(uploadToken, userId);
  if (!tokenPayload) {
    const err = new Error('Invalid or expired upload token.');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const evidence = await UploadEvidence.findOne({
    publicId: tokenPayload.publicId,
    ownerId: userId,
  });

  if (!evidence) {
    const err = new Error('Uploaded photo evidence not found.');
    err.status = 400;
    err.code = 'EVIDENCE_NOT_FOUND';
    throw err;
  }

  if (evidence.used) {
    const err = new Error('This upload token has already been used.');
    err.status = 409;
    err.code = 'TOKEN_ALREADY_USED';
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

  if (event.reportType === 'HOUSEHOLD') {
    const err = new Error('Cannot support a private household disposal request.');
    err.status = 400;
    err.code = 'HOUSEHOLD_PRIVATE';
    throw err;
  }

  if (event.status === 'RESOLVED' || event.status === 'REJECTED') {
    const err = new Error('This waste incident has already been closed.');
    err.status = 409;
    err.code = 'EVENT_CLOSED';
    throw err;
  }

  // 3. Check if user already contributed
  const existingReport = await Report.findOne({ citizenId: userId, complaintId });
  if (existingReport) {
    const err = new Error('You have already contributed to this waste incident.');
    err.status = 409;
    err.code = 'ALREADY_CONTRIBUTED';
    throw err;
  }

  // 4. Verify distance from event <= radius
  const coord = { lat: Number(location?.lat), lng: Number(location?.lng) };
  const eventCoord = { lat: event.location.coordinates[1], lng: event.location.coordinates[0] };
  const distanceM = haversineDistance(coord, eventCoord);
  if (distanceM > THRESHOLDS.DUP_RADIUS_M * 1.5) {
    const err = new Error(`Supporting report location is too far from existing incident (${Math.round(distanceM)}m).`);
    err.status = 400;
    err.code = 'TOO_FAR';
    throw err;
  }

  // 5. Check duplicate image hash
  const dupImage = await Report.findOne({ citizenId: userId, imageHash: evidence.imageHash });
  if (dupImage) {
    const err = new Error('You have already submitted this photograph.');
    err.status = 409;
    err.code = 'DUPLICATE_IMAGE';
    throw err;
  }

  return await withTransaction(async (session) => {
    // 6. Create Supporting Report
    const [report] = await Report.create(
      [
        {
          citizenId: userId,
          complaintId: event._id,
          role: 'SUPPORTING',
          imageUrl: evidence.imageUrl,
          imagePublicId: evidence.publicId,
          imageHash: evidence.imageHash,
          location: {
            type: 'Point',
            coordinates: [coord.lng, coord.lat],
          },
          locationSource: locationSource || 'MAP_PIN',
          locationAccuracyM,
          addressText: addressText || event.addressText,
          aiSuggestedCategory: evidence.aiResult?.category,
          aiShortReason: evidence.aiResult?.shortReason,
          aiStatus: evidence.aiResult?.status || 'OK',
          aiProvider: evidence.aiResult?.provider,
          citizenCategory: citizenCategory || event.category,
          categoryCorrected: false,
          description,
          duplicateDecision: 'SUPPORT',
          state: 'ACTIVE',
          requestId: crypto.randomUUID(),
        },
      ],
      { session }
    );

    // Consume evidence
    evidence.used = true;
    evidence.usedAt = new Date();
    evidence.usedForId = event._id;
    await evidence.save({ session });

    // 7. Update event support count
    // Note: unreviewed support submissions start as pending and do NOT inflate priority until operator accepts
    event.supportCount += 1;
    event.lastReportedAt = new Date();
    await event.save({ session });

    // 8. Create Impact Transaction (PENDING until operator confirms supporting evidence)
    const { credits, reason } = calculateSupportCredits(event.supportCount - 1);
    const [tx] = await ImpactTransaction.create(
      [
        {
          citizenId: userId,
          complaintId: event._id,
          reportId: report._id,
          type: TRANSACTION_TYPES.SUPPORTING_REPORT,
          credits,
          status: TRANSACTION_STATUSES.PENDING,
          reason,
          verifiedAt: null,
        },
      ],
      { session }
    );

    await StatusEvent.create(
      [
        {
          entityType: 'COMPLAINT',
          entityId: event._id,
          from: event.status,
          to: event.status,
          actorId: userId,
          actorRole: 'CITIZEN',
          note: 'Supporting evidence submitted by neighbor.',
        },
      ],
      { session }
    );

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
  });
}

export async function reopenResolvedReport(reportId, { reason }, userId) {
  const report = await Report.findOne({ _id: reportId, citizenId: userId });
  if (!report) {
    const err = new Error('Report not found or not owned by your account.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const event = await WasteEvent.findById(report.complaintId);
  if (!event) {
    const err = new Error('Associated incident not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (event.status !== 'RESOLVED') {
    const err = new Error('Only resolved incidents can be reopened.');
    err.status = 409;
    err.code = 'INVALID_STATUS';
    throw err;
  }

  return await withTransaction(async (session) => {
    const prevStatus = event.status;
    event.status = 'REOPENED';
    event.reopenedAt = new Date();
    event.reopenedBy = userId;
    event.reopenReason = reason || 'Citizen reported waste is still present on site.';
    await event.save({ session });

    await StatusEvent.create(
      [
        {
          entityType: 'COMPLAINT',
          entityId: event._id,
          from: prevStatus,
          to: 'REOPENED',
          actorId: userId,
          actorRole: 'CITIZEN',
          note: `Incident reopened by citizen: ${event.reopenReason}`,
        },
      ],
      { session }
    );

    // Revoke all RESOLUTION_BONUS credits associated with this incident
    await ImpactTransaction.updateMany(
      {
        complaintId: event._id,
        type: TRANSACTION_TYPES.RESOLUTION_BONUS,
        status: TRANSACTION_STATUSES.VERIFIED,
      },
      {
        status: TRANSACTION_STATUSES.REVOKED,
        reason: 'Closure disputed by citizen — resolution credits revoked',
      },
      { session }
    );

    return {
      ok: true,
      complaintId: event._id.toString(),
      status: event.status,
      reopenReason: event.reopenReason,
    };
  });
}

export async function getCitizenReports(userId, statusFilter = 'all') {
  const query = { citizenId: userId };
  const reports = await Report.find(query).sort({ createdAt: -1 }).populate('complaintId').lean();

  const filtered = reports.filter((r) => {
    if (!r.complaintId) return false;
    if (statusFilter === 'active') {
      return ['SUBMITTED', 'VERIFIED', 'SCHEDULED', 'REOPENED'].includes(r.complaintId.status);
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
      reportType: r.reportType || 'PUBLIC',
      householdItems: r.householdItems,
      householdQuantity: r.householdQuantity,
      addressText: r.addressText || r.complaintId.addressText,
      createdAt: r.createdAt,
      complaint: {
        id: r.complaintId._id.toString(),
        code: r.complaintId.code,
        status: r.complaintId.status,
        supportCount: r.complaintId.supportCount,
        specialistQueue: r.complaintId.specialistQueue,
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
    timeline,
    closure: complaint.status === 'RESOLVED'
      ? {
          photoUrl: complaint.completionEvidence?.completionPhotoUrl || complaint.closurePhotoUrl,
          note: complaint.completionEvidence?.operatorNote || complaint.closureNote,
          receivingFacilityName: complaint.completionEvidence?.receivingFacilityName,
          receiptReference: complaint.completionEvidence?.receiptReference,
          sourceUrl: complaint.completionEvidence?.sourceUrl,
          resolvedAt: complaint.resolvedAt,
        }
      : null,
    impact,
  };
}
