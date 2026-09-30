import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { WasteEvent } from '../src/models/WasteEvent.js';
import { Report } from '../src/models/Report.js';
import { StatusEvent } from '../src/models/StatusEvent.js';
import { ImpactTransaction } from '../src/models/ImpactTransaction.js';
import { HistoryIncident } from '../src/models/HistoryIncident.js';
import { Route } from '../src/models/Route.js';
import { computePriority } from '../src/engines/priority.js';
import { generateSyntheticHistory } from '../seed/history.generator.js';
import {
  DEPOT_COORDS,
  SEED_USERS,
  SEED_VEHICLE,
  SEED_ACTIVE_EVENTS,
  SEED_RESOLVED_EVENTS,
  SEED_PHOTOS,
} from '../seed/demo.data.js';

export async function runSeed(isReset = false) {
  console.log('[Seed] Starting database seeding process...');
  await connectDB();

  // Clear existing collections if reset or clean seed
  console.log('[Seed] Clearing existing CivicClean collections...');
  await Promise.all([
    User.deleteMany({}),
    Vehicle.deleteMany({}),
    WasteEvent.deleteMany({}),
    Report.deleteMany({}),
    StatusEvent.deleteMany({}),
    ImpactTransaction.deleteMany({}),
    HistoryIncident.deleteMany({}),
    Route.deleteMany({}),
  ]);

  // 1. Seed Users
  console.log('[Seed] Creating demo users...');
  const usersByEmail = new Map();
  for (const u of SEED_USERS) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);
    const user = await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      neighbourhoodLabel: u.neighbourhoodLabel,
      isSeed: true,
    });
    usersByEmail.set(u.email, user);
  }

  const operator = usersByEmail.get('operator@civicclean.demo');
  const asha = usersByEmail.get('asha@civicclean.demo');
  const ravi = usersByEmail.get('ravi@civicclean.demo');
  const vikram = usersByEmail.get('vikram@civicclean.demo');

  // 2. Seed Vehicle
  console.log('[Seed] Creating municipal vehicle and central depot...');
  await Vehicle.create(SEED_VEHICLE);

  // 3. Seed Active Events (WE-0001 to WE-0010)
  console.log('[Seed] Creating 10 active waste events...');
  const now = new Date();

  for (const evData of SEED_ACTIVE_EVENTS) {
    const firstReportedAt = new Date(now.getTime() - evData.daysAgo * 24 * 3600 * 1000);
    const primaryReporter = evData.code === 'WE-0001' ? asha : vikram;

    // Compute priority if verified
    let priorityObj = { score: 0, tier: 'Low', breakdown: [], sentence: '' };
    if (evData.status === 'VERIFIED') {
      const p = computePriority({
        severity: evData.severity,
        firstReportedAt,
        supportCount: evData.supporters,
        sensitiveSite: evData.sensitiveSite,
        now,
      });
      priorityObj = { ...p, computedAt: now };
    }

    const event = await WasteEvent.create({
      code: evData.code,
      location: {
        type: 'Point',
        coordinates: [evData.loc.lng, evData.loc.lat],
      },
      addressText: evData.addressText,
      category: evData.category,
      aiSuggestedCategory: evData.category,
      categoryConfirmedBy: 'OPERATOR',
      status: evData.status,
      severity: evData.severity,
      sensitiveSite: evData.sensitiveSite,
      estimatedWeightKg: evData.estimatedWeightKg,
      supportCount: evData.supporters,
      firstReportedAt,
      lastReportedAt: now,
      verifiedBy: evData.status === 'VERIFIED' ? operator._id : null,
      verifiedAt: evData.status === 'VERIFIED' ? firstReportedAt : null,
      priority: priorityObj,
      isSeed: true,
    });

    // Primary Report
    const primaryReport = await Report.create({
      citizenId: primaryReporter._id,
      complaintId: event._id,
      role: 'PRIMARY',
      imageUrl: evData.primaryPhoto,
      imagePublicId: `seed_${evData.code}_primary`,
      imageHash: crypto.createHash('sha256').update(`seed_${evData.code}_primary`).digest('hex'),
      location: event.location,
      locationSource: 'MAP_PIN',
      addressText: event.addressText,
      aiSuggestedCategory: evData.category,
      aiShortReason: `Visible pile of roadside ${evData.category.toLowerCase()} waste`,
      aiStatus: 'OK',
      citizenCategory: evData.category,
      categoryCorrected: false,
      duplicateDecision: 'NONE_FOUND',
      requestId: crypto.randomUUID(),
      isSeed: true,
    });

    event.primaryReportId = primaryReport._id;
    await event.save();

    // Primary StatusEvent
    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: null,
      to: 'SUBMITTED',
      actorId: primaryReporter._id,
      actorRole: 'CITIZEN',
      note: 'Initial citizen report submitted.',
      createdAt: firstReportedAt,
    });

    if (evData.status === 'VERIFIED') {
      await StatusEvent.create({
        entityType: 'COMPLAINT',
        entityId: event._id,
        from: 'SUBMITTED',
        to: 'VERIFIED',
        actorId: operator._id,
        actorRole: 'OPERATOR',
        note: `Verified at ${priorityObj.tier} tier (${priorityObj.score} pts).`,
        createdAt: firstReportedAt,
      });

      // Primary Report Impact Transaction
      await ImpactTransaction.create({
        citizenId: primaryReporter._id,
        complaintId: event._id,
        reportId: primaryReport._id,
        type: 'UNIQUE_REPORT',
        credits: 10,
        status: 'VERIFIED',
        reason: 'Identified unique waste incident',
        verifiedAt: firstReportedAt,
        createdAt: firstReportedAt,
        isSeed: true,
      });
    } else {
      // SUBMITTED event (WE-0010) gets PENDING impact transaction
      await ImpactTransaction.create({
        citizenId: primaryReporter._id,
        complaintId: event._id,
        reportId: primaryReport._id,
        type: 'UNIQUE_REPORT',
        credits: 10,
        status: 'PENDING',
        reason: 'Identified unique waste incident (pending verification)',
        createdAt: firstReportedAt,
        isSeed: true,
      });
    }

    // Add supporting reports if specified
    if (evData.code === 'WE-0001') {
      // 2 supporters (Vikram and Ravi)
      const supUsers = [vikram, ravi];
      for (let sIdx = 0; sIdx < supUsers.length; sIdx++) {
        const sUser = supUsers[sIdx];
        const sReport = await Report.create({
          citizenId: sUser._id,
          complaintId: event._id,
          role: 'SUPPORTING',
          imageUrl: SEED_PHOTOS.organic2,
          imagePublicId: `seed_WE-0001_sup_${sIdx}`,
          imageHash: crypto.createHash('sha256').update(`seed_WE-0001_sup_${sIdx}`).digest('hex'),
          location: event.location,
          locationSource: 'MAP_PIN',
          addressText: event.addressText,
          aiSuggestedCategory: 'ORGANIC',
          aiStatus: 'OK',
          citizenCategory: 'ORGANIC',
          duplicateDecision: 'SUPPORT',
          requestId: crypto.randomUUID(),
          isSeed: true,
        });

        await ImpactTransaction.create({
          citizenId: sUser._id,
          complaintId: event._id,
          reportId: sReport._id,
          type: 'SUPPORTING_REPORT',
          credits: 3,
          status: 'VERIFIED',
          reason: 'Confirmed existing report with additional photographic evidence',
          verifiedAt: firstReportedAt,
          createdAt: firstReportedAt,
          isSeed: true,
        });
      }
    } else if (evData.code === 'WE-0003') {
      // Asha supports WE-0003!
      const ashaReport = await Report.create({
        citizenId: asha._id,
        complaintId: event._id,
        role: 'SUPPORTING',
        imageUrl: SEED_PHOTOS.mixed1,
        imagePublicId: 'seed_WE-0003_asha_sup',
        imageHash: crypto.createHash('sha256').update('seed_WE-0003_asha_sup').digest('hex'),
        location: event.location,
        locationSource: 'MAP_PIN',
        addressText: event.addressText,
        aiSuggestedCategory: 'MIXED',
        aiStatus: 'OK',
        citizenCategory: 'MIXED',
        duplicateDecision: 'SUPPORT',
        requestId: crypto.randomUUID(),
        isSeed: true,
      });

      await ImpactTransaction.create({
        citizenId: asha._id,
        complaintId: event._id,
        reportId: ashaReport._id,
        type: 'SUPPORTING_REPORT',
        credits: 3,
        status: 'VERIFIED',
        reason: 'Confirmed existing report with additional photographic evidence',
        verifiedAt: firstReportedAt,
        createdAt: firstReportedAt,
        isSeed: true,
      });
    }
  }

  // 4. Seed Resolved Events (WE-0011, WE-0012, WE-0013) with Asha as primary reporter
  console.log('[Seed] Creating 3 resolved events with full closure evidence...');
  for (const resData of SEED_RESOLVED_EVENTS) {
    const reportedAt = new Date(now.getTime() - resData.daysAgo * 24 * 3600 * 1000);
    const resolvedAt = new Date(reportedAt.getTime() + 18 * 3600 * 1000); // 18 hrs later

    const p = computePriority({
      severity: resData.severity,
      firstReportedAt: reportedAt,
      supportCount: 0,
      sensitiveSite: 'NONE',
      now: resolvedAt,
    });

    const event = await WasteEvent.create({
      code: resData.code,
      location: {
        type: 'Point',
        coordinates: [resData.loc.lng, resData.loc.lat],
      },
      addressText: resData.addressText,
      category: resData.category,
      aiSuggestedCategory: resData.citizenCorrectedCategory ? 'PLASTIC' : resData.category,
      categoryConfirmedBy: 'OPERATOR',
      status: 'RESOLVED',
      severity: resData.severity,
      estimatedWeightKg: resData.estimatedWeightKg,
      supportCount: 0,
      firstReportedAt: reportedAt,
      lastReportedAt: reportedAt,
      verifiedBy: operator._id,
      verifiedAt: reportedAt,
      resolvedBy: operator._id,
      resolvedAt,
      closurePhotoUrl: resData.closurePhoto,
      closurePublicId: `seed_${resData.code}_closure`,
      closureNote: resData.closureNote,
      priority: { ...p, computedAt: resolvedAt },
      isSeed: true,
    });

    const report = await Report.create({
      citizenId: asha._id,
      complaintId: event._id,
      role: 'PRIMARY',
      imageUrl: resData.primaryPhoto,
      imagePublicId: `seed_${resData.code}_primary`,
      imageHash: crypto.createHash('sha256').update(`seed_${resData.code}_primary`).digest('hex'),
      location: event.location,
      locationSource: 'MAP_PIN',
      addressText: event.addressText,
      aiSuggestedCategory: resData.citizenCorrectedCategory ? 'PLASTIC' : resData.category,
      aiStatus: 'OK',
      citizenCategory: resData.category,
      categoryCorrected: !!resData.citizenCorrectedCategory,
      duplicateDecision: 'NONE_FOUND',
      requestId: crypto.randomUUID(),
      isSeed: true,
    });

    event.primaryReportId = report._id;
    await event.save();

    // Timeline StatusEvents
    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: null,
      to: 'SUBMITTED',
      actorId: asha._id,
      actorRole: 'CITIZEN',
      createdAt: reportedAt,
    });

    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: 'SUBMITTED',
      to: 'VERIFIED',
      actorId: operator._id,
      actorRole: 'OPERATOR',
      createdAt: reportedAt,
    });

    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: 'VERIFIED',
      to: 'SCHEDULED',
      actorId: operator._id,
      actorRole: 'OPERATOR',
      createdAt: new Date(reportedAt.getTime() + 12 * 3600 * 1000),
    });

    await StatusEvent.create({
      entityType: 'COMPLAINT',
      entityId: event._id,
      from: 'SCHEDULED',
      to: 'RESOLVED',
      actorId: operator._id,
      actorRole: 'OPERATOR',
      note: resData.closureNote,
      createdAt: resolvedAt,
    });

    // Impact Transactions for Asha
    // 1. UNIQUE_REPORT (10)
    await ImpactTransaction.create({
      citizenId: asha._id,
      complaintId: event._id,
      reportId: report._id,
      type: 'UNIQUE_REPORT',
      credits: 10,
      status: 'VERIFIED',
      reason: 'Identified unique waste incident',
      verifiedAt: reportedAt,
      createdAt: reportedAt,
      isSeed: true,
    });

    // 2. RESOLUTION_BONUS (5)
    await ImpactTransaction.create({
      citizenId: asha._id,
      complaintId: event._id,
      reportId: report._id,
      type: 'RESOLUTION_BONUS',
      credits: 5,
      status: 'VERIFIED',
      reason: 'Waste cleared and resolved by municipal collection team',
      verifiedAt: resolvedAt,
      createdAt: resolvedAt,
      isSeed: true,
    });

    // 3. Optional CLASSIFICATION_CORRECTION (4) for WE-0013
    if (resData.citizenCorrectedCategory) {
      await ImpactTransaction.create({
        citizenId: asha._id,
        complaintId: event._id,
        reportId: report._id,
        type: 'CLASSIFICATION_CORRECTION',
        credits: 4,
        status: 'VERIFIED',
        reason: 'Citizen correction of AI waste classification confirmed by operator',
        verifiedAt: reportedAt,
        createdAt: reportedAt,
        isSeed: true,
      });
    }
  }

  // 5. Seed Synthetic Historical Dataset (~120 incidents over 12 weeks)
  console.log('[Seed] Generating ~120 historical incidents across 12 weeks for hotspot analytics...');
  const syntheticHistory = generateSyntheticHistory(DEPOT_COORDS);
  await HistoryIncident.insertMany(syntheticHistory);

  // Summary counts verification
  const totalUsers = await User.countDocuments();
  const totalVehicles = await Vehicle.countDocuments();
  const totalEvents = await WasteEvent.countDocuments();
  const totalReports = await Report.countDocuments();
  const totalTx = await ImpactTransaction.countDocuments();
  const totalHistory = await HistoryIncident.countDocuments();

  console.log('--------------------------------------------------');
  console.log('✅ CivicClean Seed Completed Successfully!');
  console.log(`- Users: ${totalUsers} (operator@civicclean.demo, asha@civicclean.demo, ravi@civicclean.demo)`);
  console.log(`- Vehicles: ${totalVehicles} (Truck A at ${DEPOT_COORDS.name})`);
  console.log(`- Waste Events: ${totalEvents} (10 Active [WE-0001..WE-0010] + 3 Resolved [WE-0011..WE-0013])`);
  console.log(`- Reports: ${totalReports}`);
  console.log(`- Impact Transactions: ${totalTx}`);
  console.log(`- Historical Incidents: ${totalHistory} across 12 weeks`);
  console.log('--------------------------------------------------');

  return {
    users: totalUsers,
    vehicles: totalVehicles,
    events: totalEvents,
    reports: totalReports,
    transactions: totalTx,
    history: totalHistory,
  };
}

// If executed directly via node scripts/seed.js
if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
