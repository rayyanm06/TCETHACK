import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { WasteEvent } from '../src/models/WasteEvent.js';
import { Report } from '../src/models/Report.js';
import { ImpactTransaction } from '../src/models/ImpactTransaction.js';
import { UploadEvidence } from '../src/models/UploadEvidence.js';
import { signToken, signUploadToken } from '../src/utils/token.js';

let server;
let API_BASE;
let operatorToken;
let citizenAToken;
let citizenBToken;
let citizenAUser;
let citizenBUser;
let operatorUser;

// Helper to create a valid minimal 1x1 JPEG buffer
function createValidJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9,
  ]);
}

describe('CivicClean End-to-End Workflow & Security Regression Suite', { concurrency: 1 }, () => {
  before(async () => {
    await connectDB();

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        API_BASE = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Clean up any stale test accounts and collections
    await User.deleteMany({ email: { $in: ['officer@pilot.test', 'asha@pilot.test', 'bikram@pilot.test'] } });
    await Vehicle.deleteMany({ registration: 'MH-02-PILOT-01' });
    await WasteEvent.deleteMany({});
    await Report.deleteMany({});
    await ImpactTransaction.deleteMany({});
    await UploadEvidence.deleteMany({});

    // Create test operator
    operatorUser = await User.create({
      name: 'Test Municipal Officer',
      email: 'officer@pilot.test',
      passwordHash: 'dummy',
      role: 'OPERATOR',
    });
    operatorToken = signToken(operatorUser);

    // Create default vehicle for routing
    await Vehicle.create({
      name: 'North Compactor MH-02-PILOT-01',
      registration: 'MH-02-PILOT-01',
      capacityKg: 1200,
      maxRouteMinutes: 180,
      isActive: true,
      depot: {
        name: 'North Municipal Central Depot',
        location: {
          type: 'Point',
          coordinates: [72.876, 19.2071],
        },
      },
      acceptedCategories: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED'],
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('1. Public registration rejects operator elevation and sets role to CITIZEN', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Asha Citizen',
        email: 'asha@pilot.test',
        password: 'securePassword123',
        role: 'OPERATOR', // attempt privilege escalation
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user.role, 'CITIZEN', 'Role must be strictly CITIZEN');
    assert.ok(data.token);
    citizenAToken = data.token;
    citizenAUser = data.user;

    // Register second citizen
    const resB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bikram Neighbor',
        email: 'bikram@pilot.test',
        password: 'securePassword123',
      }),
    });
    const dataB = await resB.json();
    citizenBToken = dataB.token;
    citizenBUser = dataB.user;
  });

  test('2. Citizen is blocked with 403 Forbidden from operator endpoints', async () => {
    // 2a. Event management
    const res1 = await fetch(`${API_BASE}/complaints/dummy-id`, {
      headers: { Authorization: `Bearer ${citizenAToken}` },
    });
    assert.equal(res1.status, 403, 'Citizen must get 403 accessing operator event details');

    // 2b. Route planning preview
    const res2 = await fetch(`${API_BASE}/routes/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(res2.status, 403, 'Citizen must get 403 calling route preview');

    // 2c. Impact leaderboard
    const res3 = await fetch(`${API_BASE}/impact/leaderboard`, {
      headers: { Authorization: `Bearer ${citizenAToken}` },
    });
    assert.equal(res3.status, 403, 'Citizen must get 403 calling operator leaderboard');
  });

  test('3. Photo upload rejects corrupt/non-image buffer with 400', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const fakeTextFile = Buffer.from('NOT AN IMAGE FILE - JUST TEXT');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fake.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeTextFile,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${API_BASE}/classify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error?.code, 'INVALID_IMAGE_FORMAT');
  });

  test('4. Photo upload with valid JPEG succeeds and returns upload token', async () => {
    const boundary = '----WebKitFormBoundaryTest456';
    const jpegBuffer = createValidJpegBuffer();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      jpegBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${API_BASE}/classify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.uploadToken, 'Upload token must be returned');
    assert.ok(data.imageUrl, 'Image URL must be returned');
    assert.ok(data.ai, 'AI result must be present or fallback');
  });

  let citizenAFirstReport;
  let citizenAUploadToken;
  let citizenAPublicId;

  test('5. Citizen creates primary report; submission retries with same requestId are idempotent', async () => {
    // Generate valid upload evidence for Citizen A
    citizenAPublicId = 'test_pub_id_' + Date.now();
    await UploadEvidence.create({
      publicId: citizenAPublicId,
      ownerId: citizenAUser.id,
      purpose: 'CITIZEN_REPORT',
      imageUrl: '/uploads/test.jpg',
      imageHash: 'hash_sha256_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });

    citizenAUploadToken = signUploadToken(citizenAPublicId, citizenAUser.id);
    const stableRequestId = 'req_id_' + Date.now();

    const payload = {
      reportType: 'PUBLIC',
      uploadToken: citizenAUploadToken,
      citizenCategory: 'PLASTIC',
      location: { lat: 19.2085, lng: 72.875 },
      addressText: 'Near Thakur Complex Gate 2, Kandivali East',
      description: 'Overflowing plastic waste on footpath',
      requestId: stableRequestId,
    };

    // First submission
    const res1 = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res1.status !== 201) {
      console.error('Test 5 Failed res1:', res1.status, await res1.text());
    }
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    const reportId = data1.report?._id || data1.report?.id;
    assert.ok(reportId, 'Report ID must exist');
    assert.ok(data1.complaint?.id, 'Complaint ID must exist');
    assert.equal(data1.role, 'PRIMARY');
    citizenAFirstReport = { ...data1, reportId };

    // Retry submission with exact same requestId (network bounce simulation)
    const res2 = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res2.status, 200, 'Idempotent retry returns 200');
    const data2 = await res2.json();
    assert.equal(data2.report?._id || data2.report?.id, reportId, 'Idempotent response returns exact same report ID');

    // Confirm duplicate impact credit was not created
    const txCount = await ImpactTransaction.countDocuments({
      citizenId: citizenAUser.id,
      reportId: reportId,
    });
    assert.equal(txCount, 1, 'Only one impact credit ledger entry created');
  });

  test('6. Another citizen cannot access private report details (404)', async () => {
    const res = await fetch(`${API_BASE}/reports/${citizenAFirstReport.reportId}`, {
      headers: { Authorization: `Bearer ${citizenBToken}` },
    });
    assert.equal(res.status, 404, 'Accessing another citizen report must return 404');
  });

  let householdReportData;
  test('7. Citizen submits private household disposal (4 old phones) — coordinates are shielded from public endpoints', async () => {
    const housePubId = 'house_pub_' + Date.now();
    await UploadEvidence.create({
      publicId: housePubId,
      ownerId: citizenAUser.id,
      purpose: 'CITIZEN_REPORT',
      imageUrl: '/uploads/house_phones.jpg',
      imageHash: 'hash_house_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });
    const houseToken = signUploadToken(housePubId, citizenAUser.id);

    const houseLat = 19.2091;
    const houseLng = 72.8775;

    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reportType: 'HOUSEHOLD',
        uploadToken: houseToken,
        citizenCategory: 'E_WASTE',
        householdItems: '4 old smartphones and broken tablet',
        householdQuantity: '4 phones, 1 tablet',
        location: { lat: houseLat, lng: houseLng },
        addressText: 'Flat 402, Gokul Towers, Kandivali East',
        description: 'Electronic waste needing authorized disposal',
      }),
    });

    assert.equal(res.status, 201);
    householdReportData = await res.json();
    assert.equal(householdReportData.report.reportType, 'HOUSEHOLD');
    assert.equal(householdReportData.complaint.specialistQueue, 'E_WASTE');

    // Verify 1: Household coordinates NEVER appear in public incidents listing
    const publicListRes = await fetch(`${API_BASE}/complaints`, {
      headers: { Authorization: `Bearer ${citizenBToken}` },
    });
    const publicListData = await publicListRes.json();
    const foundInPublic = publicListData.items.some((item) => item.id === householdReportData.complaint.id);
    assert.equal(foundInPublic, false, 'Household incident must NOT appear in public complaint list');

    // Verify 2: Household coordinates NEVER appear in nearby duplicate search
    const nearbyRes = await fetch(`${API_BASE}/complaints/nearby?lat=${houseLat}&lng=${houseLng}&category=E_WASTE`, {
      headers: { Authorization: `Bearer ${citizenBToken}` },
    });
    const nearbyData = await nearbyRes.json();
    const foundInNearby = nearbyData.candidates.some((c) => c.complaintId === householdReportData.complaint.id);
    assert.equal(foundInNearby, false, 'Household incident must NOT appear in nearby duplicate search');
  });

  test('8. Duplicate candidate detection and neighbor support creates single incident with PENDING impact (does not inflate priority)', async () => {
    // Citizen B searches nearby
    const eventLat = 19.2085;
    const eventLng = 72.875;
    const nearbyRes = await fetch(`${API_BASE}/complaints/nearby?lat=${eventLat}&lng=${eventLng}&category=PLASTIC`, {
      headers: { Authorization: `Bearer ${citizenBToken}` },
    });
    const nearbyData = await nearbyRes.json();
    assert.ok(nearbyData.candidates?.length > 0, 'Must find Citizen A original report');
    const matchedComplaintId = citizenAFirstReport.complaint.id;

    // Check complaint priority before support
    const eventBefore = await WasteEvent.findById(matchedComplaintId);
    const initialPriorityScore = eventBefore.priority.score;

    // Citizen B submits supporting photo
    const bPubId = 'b_pub_' + Date.now();
    await UploadEvidence.create({
      publicId: bPubId,
      ownerId: citizenBUser.id,
      purpose: 'CITIZEN_REPORT',
      imageUrl: '/uploads/b_photo.jpg',
      imageHash: 'hash_b_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });
    const bUploadToken = signUploadToken(bPubId, citizenBUser.id);

    const supportRes = await fetch(`${API_BASE}/complaints/${matchedComplaintId}/support`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenBToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: bUploadToken,
        location: { lat: 19.2086, lng: 72.8751 },
        citizenCategory: 'PLASTIC',
        description: 'Confirming this pile has grown bigger',
      }),
    });

    assert.equal(supportRes.status, 201);
    const supportData = await supportRes.json();
    assert.equal(supportData.role, 'SUPPORTING');

    // Impact transaction for unreviewed support MUST be PENDING
    assert.equal(supportData.impact[0].status, 'PENDING');

    // Confirm that unreviewed support has NOT increased reviewedSupportCount or manipulated priority
    const eventAfter = await WasteEvent.findById(matchedComplaintId);
    assert.equal(eventAfter.supportCount, 1, 'Total raw support count is 1');
    assert.equal(eventAfter.reviewedSupportCount, 0, 'Reviewed support count remains 0 until operator accepts');
    assert.equal(eventAfter.priority.score, initialPriorityScore, 'Priority score must NOT be inflated by pending support');
  });

  test('9. Operator reviews supporting evidence: accepting increases reviewedSupportCount and verified credits', async () => {
    const matchedComplaintId = citizenAFirstReport.complaint.id;
    const bReport = await Report.findOne({ citizenId: citizenBUser.id, complaintId: matchedComplaintId });

    const reviewRes = await fetch(`${API_BASE}/complaints/${matchedComplaintId}/support/${bReport._id}/review`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'ACCEPT', note: 'Clear supporting photo from different angle.' }),
    });

    assert.equal(reviewRes.status, 200);
    const reviewData = await reviewRes.json();
    assert.equal(reviewData.reviewedSupportCount, 1);
    const commBreakdown = reviewData.priority?.breakdown?.find((b) => b.key === 'community');
    assert.equal(commBreakdown?.points, 4, 'Community points awarded after operator review');

    // Check impact transaction transitioned from PENDING to VERIFIED
    const bTx = await ImpactTransaction.findOne({ reportId: bReport._id });
    assert.equal(bTx.status, 'VERIFIED');
  });

  test('10. Route planning excludes household and e-waste; sub-matrices remain correctly aligned', async () => {
    // First, verify Citizen A incident so it becomes eligible for routing
    const matchedComplaintId = citizenAFirstReport.complaint.id;
    await fetch(`${API_BASE}/complaints/${matchedComplaintId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ severity: 2, estimatedWeightKg: 50, verify: true }),
    });

    // Preview collection route
    const routeRes = await fetch(`${API_BASE}/routes/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    assert.equal(routeRes.status, 200);
    const routeData = await routeRes.json();
    assert.ok(routeData.route?.stops?.length > 0);

    // Ensure household incident is NEVER included in truck route
    const stopsContainHousehold = routeData.route.stops.some(
      (s) => s.eventId === householdReportData.complaint.id
    );
    assert.equal(stopsContainHousehold, false, 'Household disposal request MUST be excluded from ordinary collection route');

    // Ensure ordinary public incident IS included
    const stopsContainPublic = routeData.route.stops.some(
      (s) => s.eventId === matchedComplaintId
    );
    assert.equal(stopsContainPublic, true, 'Verified public plastic incident must be planned in route');
  });

  test('11. Stale / double route assignment is rejected', async () => {
    const matchedComplaintId = citizenAFirstReport.complaint.id;

    // Simulate route preview
    const routeRes = await fetch(`${API_BASE}/routes/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const routeData = await routeRes.json();
    const routeId = routeData.route.id;

    // Simulate concurrent event status change before assignment (making preview stale)
    await WasteEvent.findByIdAndUpdate(matchedComplaintId, { status: 'RESOLVED' });

    const assignRes = await fetch(`${API_BASE}/routes/${routeId}/assign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
    });

    assert.equal(assignRes.status, 409);
    const assignData = await assignRes.json();
    assert.equal(assignData.error?.code, 'PREVIEW_STALE');

    // Reset status back to VERIFIED for remaining tests
    await WasteEvent.findByIdAndUpdate(matchedComplaintId, { status: 'VERIFIED' });
  });

  test('12. Specialist/Household resolution requires receiving facility, receipt ref, official URL, and completion photo', async () => {
    const houseEventId = householdReportData.complaint.id;

    // Transition household event from SUBMITTED to VERIFIED first
    await fetch(`${API_BASE}/complaints/${houseEventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ severity: 1, estimatedWeightKg: 10, verify: true }),
    });

    const opPubId1 = 'op_pub_close1_' + Date.now();
    await UploadEvidence.create({
      publicId: opPubId1,
      ownerId: operatorUser._id,
      purpose: 'OPERATOR_CLOSURE',
      imageUrl: '/uploads/sample_clearance.jpg',
      imageHash: 'hash_op1_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });
    const opClosureToken1 = signUploadToken(opPubId1, operatorUser._id);

    // 12a. Attempt resolution without completion evidence fields (facility, receipt, url)
    const failRes = await fetch(`${API_BASE}/complaints/${houseEventId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'RESOLVED',
        closurePhoto: { uploadToken: opClosureToken1 },
        note: 'Picked up without details',
      }),
    });

    assert.equal(failRes.status, 400);
    const failData = await failRes.json();
    assert.equal(failData.error?.code, 'VALIDATION_ERROR');

    // 12b. Supply full honest completion evidence
    const successRes = await fetch(`${API_BASE}/complaints/${houseEventId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'RESOLVED',
        closurePhoto: { uploadToken: opClosureToken1 },
        receivingFacilityName: 'Eco-Recycle E-Waste Handlers (CPCB Reg: 27/MPCB/RO(HQ)/E-WASTE/2023)',
        receiptReference: 'ECO-2026-MUM-8841',
        sourceUrl: 'https://cpcb.nic.in/e-waste-recyclers-maharashtra',
        note: 'Handed over 4 phones and 1 tablet to authorized MPCB certified collector.',
      }),
    });

    assert.equal(successRes.status, 200);
    const successData = await successRes.json();
    assert.equal(successData.event?.status, 'RESOLVED');
    assert.ok(successData.event?.completionEvidence?.receivingFacilityName);
  });

  test('13. Repeat closure on already resolved incident returns 409 or prevents duplicate resolution credits', async () => {
    const houseEventId = householdReportData.complaint.id;

    const opPubIdRepeat = 'op_pub_repeat_' + Date.now();
    await UploadEvidence.create({
      publicId: opPubIdRepeat,
      ownerId: operatorUser._id,
      purpose: 'OPERATOR_CLOSURE',
      imageUrl: '/uploads/sample_clearance.jpg',
      imageHash: 'hash_op_rep_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });
    const opClosureTokenRepeat = signUploadToken(opPubIdRepeat, operatorUser._id);

    const repeatRes = await fetch(`${API_BASE}/complaints/${houseEventId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'RESOLVED',
        closurePhoto: { uploadToken: opClosureTokenRepeat },
        receivingFacilityName: 'Eco-Recycle E-Waste Handlers',
        receiptReference: 'ECO-2026-MUM-8841',
        sourceUrl: 'https://cpcb.nic.in/e-waste-recyclers-maharashtra',
        note: 'Trying to resolve again',
      }),
    });

    assert.equal(repeatRes.status, 409, 'Cannot re-resolve an already resolved incident');
  });

  test('14. Citizen reopening disputed incident changes status to REOPENED and revokes RESOLUTION_BONUS credits', async () => {
    // First, verify Citizen A public plastic report
    const matchedComplaintId = citizenAFirstReport.complaint.id;
    await fetch(`${API_BASE}/complaints/${matchedComplaintId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ severity: 2, estimatedWeightKg: 50, verify: true }),
    });

    const opPubId3 = 'op_pub_close3_' + Date.now();
    await UploadEvidence.create({
      publicId: opPubId3,
      ownerId: operatorUser._id,
      purpose: 'OPERATOR_CLOSURE',
      imageUrl: '/uploads/clean_street.jpg',
      imageHash: 'hash_op3_' + Date.now(),
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      used: false,
    });
    const opClosureToken3 = signUploadToken(opPubId3, operatorUser._id);

    const resolveRes = await fetch(`${API_BASE}/complaints/${matchedComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'RESOLVED',
        closurePhoto: { uploadToken: opClosureToken3 },
        note: 'Footpath cleared by beat crew.',
      }),
    });
    assert.equal(resolveRes.status, 200);

    // Check that resolution bonus was awarded
    const bonusTx = await ImpactTransaction.findOne({
      complaintId: matchedComplaintId,
      type: 'RESOLUTION_BONUS',
    });
    assert.ok(bonusTx, 'Resolution bonus should exist');
    assert.equal(bonusTx.status, 'VERIFIED');

    // Citizen A disputes closure and reopens report
    const reopenRes = await fetch(`${API_BASE}/reports/${citizenAFirstReport.reportId}/reopen`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Plastic waste was only pushed behind the tree, not collected.',
      }),
    });

    assert.equal(reopenRes.status, 200);
    const reopenData = await reopenRes.json();
    assert.equal(reopenData.status, 'REOPENED');

    // Confirm that the WasteEvent is now REOPENED
    const eventAfter = await WasteEvent.findById(matchedComplaintId);
    assert.equal(eventAfter.status, 'REOPENED');
    assert.ok(eventAfter.reopenedAt);

    // Confirm that RESOLUTION_BONUS credits were REVOKED
    const bonusTxAfter = await ImpactTransaction.findOne({
      complaintId: matchedComplaintId,
      type: 'RESOLUTION_BONUS',
    });
    assert.equal(bonusTxAfter.status, 'REVOKED', 'Resolution credits must be revoked upon reopening');
  });
});
