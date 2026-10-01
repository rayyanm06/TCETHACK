import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { WasteEvent } from '../src/models/WasteEvent.js';
import { Report } from '../src/models/Report.js';
import { Route } from '../src/models/Route.js';
import { Notification } from '../src/models/Notification.js';
import { ImpactTransaction } from '../src/models/ImpactTransaction.js';
import { UploadEvidence } from '../src/models/UploadEvidence.js';
import { signToken, signUploadToken } from '../src/utils/token.js';

let server;
let API_BASE;
let operatorToken;
let citizenToken;
let otherCitizenToken;
let operatorUser;
let citizenUser;
let otherCitizenUser;
let testVehicle;

function createMinimalJpeg() {
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

describe('CivicClean Connected Operational Flow & Real Persistence Suite', { concurrency: 1 }, () => {
  before(async () => {
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        API_BASE = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Clean up test collections
    await User.deleteMany({ email: { $in: ['test.op@civicclean.internal', 'test.citizen@civicclean.internal', 'other.citizen@civicclean.internal'] } });
    await Vehicle.deleteMany({ registration: 'MH-02-TEST-99' });

    operatorUser = await User.create({
      email: 'test.op@civicclean.internal',
      name: 'Operations Dispatcher',
      passwordHash: 'dummy',
      role: 'OPERATOR',
    });
    operatorToken = signToken(operatorUser);

    citizenUser = await User.create({
      email: 'test.citizen@civicclean.internal',
      name: 'Asha Citizen',
      passwordHash: 'dummy',
      role: 'CITIZEN',
    });
    citizenToken = signToken(citizenUser);

    otherCitizenUser = await User.create({
      email: 'other.citizen@civicclean.internal',
      name: 'Sneha Neighbor',
      passwordHash: 'dummy',
      role: 'CITIZEN',
    });
    otherCitizenToken = signToken(otherCitizenUser);

    testVehicle = await Vehicle.create({
      registration: 'MH-02-TEST-99',
      name: 'Municipal Compactor Test-99',
      capacityKg: 1500,
      acceptedCategories: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED'],
      depot: {
        name: 'North Central Depot',
        location: {
          type: 'Point',
          coordinates: [72.876, 19.2071],
        },
      },
      isActive: true,
    });
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
    if (createdEventId) await WasteEvent.deleteMany({ _id: createdEventId });
    if (createdReportId) await Report.deleteMany({ _id: createdReportId });
    if (plannedRouteId) await Route.deleteMany({ _id: plannedRouteId });
    if (createdEventId) await Notification.deleteMany({ eventId: createdEventId });
    await User.deleteMany({ _id: { $in: [operatorUser?._id, citizenUser?._id, otherCitizenUser?._id] } });
    await Vehicle.deleteMany({ _id: testVehicle?._id });
    await disconnectDB();
  });

  let createdReportId;
  let createdEventId;
  let createdEventCode;
  let plannedRouteId;

  test('1. Citizen submits real waste report → operator receives the exact same persisted event', async () => {
    // 1a. Upload photo via /classify
    const formData = new FormData();
    const blob = new Blob([createMinimalJpeg()], { type: 'image/jpeg' });
    formData.append('image', blob, 'incident.jpg');

    const uploadRes = await fetch(`${API_BASE}/classify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: formData,
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.uploadToken);

    // 1b. Submit report
    const reportPayload = {
      uploadToken: uploadData.uploadToken,
      location: { lat: 19.215, lng: 72.865 },
      addressText: 'Linking Road Corner, Sector 4',
      citizenCategory: 'PLASTIC',
      description: 'Accumulation of plastic crates and bags',
      reportType: 'PUBLIC',
      duplicateDecision: 'SEPARATE',
      requestId: `req-flow-${Date.now()}`,
    };

    const submitRes = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportPayload),
    });
    assert.equal(submitRes.status, 201);
    const submitData = await submitRes.json();
    assert.ok(submitData.report.id || submitData.report._id);
    assert.ok(submitData.complaint.id || submitData.complaint._id);

    createdReportId = (submitData.report.id || submitData.report._id).toString();
    createdEventId = (submitData.complaint.id || submitData.complaint._id).toString();
    createdEventCode = submitData.complaint.code;

    // 1c. Operator queries event queue and sees the same event
    const opQueueRes = await fetch(`${API_BASE}/complaints?status=SUBMITTED`, {
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert.equal(opQueueRes.status, 200);
    const opQueue = await opQueueRes.json();
    const found = opQueue.items.find((i) => i.id === createdEventId);
    assert.ok(found, 'Submitted citizen report must appear in operator queue');
    assert.equal(found.code, createdEventCode);
  });

  test('2. Operator verifies event → persistent notification is generated for report owner', async () => {
    const verifyRes = await fetch(`${API_BASE}/complaints/${createdEventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verify: true,
        severity: 2,
        estimatedWeightKg: 180,
      }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.event.status, 'VERIFIED');

    // Citizen fetches notifications
    const citNotifRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(citNotifRes.status, 200);
    const citNotif = await citNotifRes.json();
    const verifiedAlert = citNotif.items.find((n) => n.eventId === createdEventId && n.type === 'VERIFIED');
    assert.ok(verifiedAlert, 'Citizen must receive persistent notification when operator verifies report');
    assert.match(verifiedAlert.title, new RegExp(createdEventCode));
  });

  test('3. Operator plans and assigns route → includes actual eligible stop; citizen gets scheduled notification', async () => {
    // Preview route
    const previewRes = await fetch(`${API_BASE}/routes/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vehicleId: testVehicle._id.toString() }),
    });
    assert.equal(previewRes.status, 200);
    const previewData = await previewRes.json();
    assert.ok(previewData.route.id);
    plannedRouteId = previewData.route.id;

    // Verify stop is present in preview
    const stopFound = previewData.route.stops.find((s) => s.eventId.toString() === createdEventId);
    assert.ok(stopFound, 'Route preview must include eligible verified stop');

    // Assign route
    const assignRes = await fetch(`${API_BASE}/routes/${plannedRouteId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert.equal(assignRes.status, 200);

    // Verify citizen receives ASSIGNED notification
    const citNotifRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(citNotifRes.status, 200);
    const citNotif = await citNotifRes.json();
    const assignedAlert = citNotif.items.find((n) => n.eventId === createdEventId && n.type === 'ASSIGNED');
    assert.ok(assignedAlert, 'Citizen must receive persistent notification on route dispatch assignment');
  });

  test('4. Live device GPS telemetry updates vehicle position, heading, and accuracy', async () => {
    const telemetryPayload = {
      lat: 19.2148,
      lng: 72.8652,
      accuracyM: 8.5,
      heading: 142,
      speedMs: 4.2,
      timestamp: new Date().toISOString(),
      deviceId: 'crew-phone-01',
    };

    const telemRes = await fetch(`${API_BASE}/routes/${plannedRouteId}/telemetry`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telemetryPayload),
    });
    assert.equal(telemRes.status, 200);
    const telemData = await telemRes.json();
    assert.equal(telemData.liveTracking.lat, 19.2148);
    assert.equal(telemData.liveTracking.accuracyM, 8.5);
    assert.equal(telemData.liveTracking.heading, 142);
    assert.ok(telemData.activeStop.isNear, 'Vehicle within proximity of target stop');
  });

  test('5. Record Stop Arrival (GPS Proximity or Manual with reason) → stop transitions to ARRIVED; citizen notified', async () => {
    const arriveRes = await fetch(`${API_BASE}/routes/${plannedRouteId}/stops/${createdEventId}/arrive`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arrivalType: 'GPS_PROXIMITY',
        lat: 19.2149,
        lng: 72.8651,
        accuracyM: 6.0,
      }),
    });
    assert.equal(arriveRes.status, 200);
    const arriveData = await arriveRes.json();
    assert.equal(arriveData.stop.state, 'ARRIVED');
    assert.equal(arriveData.stop.arrivalType, 'GPS_PROXIMITY');

    // Citizen receives ARRIVED notification
    const citNotifRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const citNotif = await citNotifRes.json();
    const arriveAlert = citNotif.items.find((n) => n.eventId === createdEventId && n.type === 'ARRIVED');
    assert.ok(arriveAlert, 'Citizen must receive notification when crew arrives on site');
  });

  test('6. Confirm Collection with clearance photo → stop transitions to DONE, incident resolved, impact bonus awarded', async () => {
    // Upload clearance proof photo
    const uploadForm = new FormData();
    const blob = new Blob([createMinimalJpeg()], { type: 'image/jpeg' });
    uploadForm.append('image', blob, 'clearance.jpg');

    const uploadRes = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: uploadForm,
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.uploadToken);

    // Confirm collection
    const confirmRes = await fetch(`${API_BASE}/routes/${plannedRouteId}/stops/${createdEventId}/confirm-collection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        closurePhoto: { uploadToken: uploadData.uploadToken },
        note: 'Site fully cleared, swept, and verified.',
        aiReview: {
          assessment: 'APPEARS_CLEARED',
          confidence: 0.92,
          shortReason: 'Ground area is completely clear of plastic waste.',
          provider: 'gemini',
        },
      }),
    });
    assert.equal(confirmRes.status, 200);
    const confirmData = await confirmRes.json();
    assert.equal(confirmData.stop.state, 'DONE');
    assert.equal(confirmData.event.status, 'RESOLVED');

    // Verify impact bonus awarded
    const tx = await ImpactTransaction.findOne({
      complaintId: createdEventId,
      citizenId: citizenUser._id,
      type: 'RESOLUTION_BONUS',
      status: 'VERIFIED',
    });
    assert.ok(tx, 'Primary reporter must be credited with RESOLUTION_BONUS');

    // Citizen receives COLLECTED notification
    const citNotifRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const citNotif = await citNotifRes.json();
    const colAlert = citNotif.items.find((n) => n.eventId === createdEventId && n.type === 'COLLECTED');
    assert.ok(colAlert, 'Citizen must receive verified collection notification with impact credit info');

    // Citizen checks report details and sees resolved status with photo proof
    const repRes = await fetch(`${API_BASE}/reports/${createdReportId}`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(repRes.status, 200);
    const repDetails = await repRes.json();
    assert.equal(repDetails.complaint.status, 'RESOLVED');
    assert.ok(repDetails.closure.photoUrl);
  });

  test('7. Another citizen cannot access private report details (privacy protection)', async () => {
    const unauthRes = await fetch(`${API_BASE}/reports/${createdReportId}`, {
      headers: { Authorization: `Bearer ${otherCitizenToken}` },
    });
    assert.equal(unauthRes.status, 404);
  });

  test('8. Refresh preserves completed stop progress and prevents duplicate resolution', async () => {
    // Fetch route by ID
    const routeRes = await fetch(`${API_BASE}/routes/${plannedRouteId}`, {
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert.equal(routeRes.status, 200);
    const routeData = await routeRes.json();
    const stop = routeData.route.stops.find((s) => s.eventId.toString() === createdEventId);
    assert.equal(stop.state, 'DONE', 'Stop progress must persist across refresh');

    // Attempting repeat collection on already completed stop returns 409
    const dupRes = await fetch(`${API_BASE}/routes/${plannedRouteId}/stops/${createdEventId}/confirm-collection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        closurePhoto: { uploadToken: 'fake' },
        note: 'duplicate',
      }),
    });
    assert.equal(dupRes.status, 409);
  });
});
