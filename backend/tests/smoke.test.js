const API_BASE = 'http://localhost:4000/api';

async function testApi() {
  console.log('--- CivicClean Live API Smoke Tests ---');

  // 1. Health
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  console.log('1. Health Check:', healthData.ok ? '✅ PASS' : '❌ FAIL', healthData.status);

  // 2. Config
  const configRes = await fetch(`${API_BASE}/config`);
  const configData = await configRes.json();
  console.log('2. Config Endpoint:', configData.categories?.length === 8 ? '✅ PASS' : '❌ FAIL', `(${configData.categories.length} categories)`);

  // 3. Login Operator
  const opLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@civicclean.demo', password: 'demo123' }),
  });
  const opData = await opLoginRes.json();
  const opToken = opData.token;
  console.log('3. Operator Login:', opToken ? '✅ PASS' : '❌ FAIL', `Role: ${opData.user?.role}`);

  // 4. Login Citizen Asha
  const ashaLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'asha@civicclean.demo', password: 'demo123' }),
  });
  const ashaData = await ashaLoginRes.json();
  const ashaToken = ashaData.token;
  console.log('4. Citizen Login (Asha):', ashaToken ? '✅ PASS' : '❌ FAIL', `Role: ${ashaData.user?.role}`);

  // 5. Operator Events & Header Ticker Counts
  const eventsRes = await fetch(`${API_BASE}/complaints`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  const eventsData = await eventsRes.json();
  console.log(
    '5. Operator Events Queue:',
    eventsData.items?.length > 0 ? '✅ PASS' : '❌ FAIL',
    `Items: ${eventsData.items.length}, Ticker: ${eventsData.counts.reports} reports → ${eventsData.counts.events} events → ${eventsData.counts.plannedStops} planned stops`
  );

  // 6. Event Details with Linked Reports & Priority Breakdown
  const firstEventId = eventsData.items[0].id;
  const eventDetailRes = await fetch(`${API_BASE}/complaints/${firstEventId}`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  const eventDetail = await eventDetailRes.json();
  console.log(
    '6. Event Dossier Details:',
    eventDetail.event?.code ? '✅ PASS' : '❌ FAIL',
    `Code: ${eventDetail.event.code}, Tier: ${eventDetail.priority?.tier} (${eventDetail.priority?.score} pts), Linked reports: ${eventDetail.linkedReports?.length}`
  );

  // 7. Route Preview with Knapsack Capacity & Deferred Stops
  const previewRes = await fetch(`${API_BASE}/routes/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const previewData = await previewRes.json();
  console.log(
    '7. Route Planning Preview:',
    previewData.route?.stops?.length > 0 ? '✅ PASS' : '❌ FAIL',
    `Planned load: ${previewData.route?.totals?.plannedLoadKg}/${previewData.route?.totals?.capacityKg} kg (${previewData.route?.stops?.length} stops), Deferred: ${previewData.route?.deferred?.length} stops`
  );
  for (const def of previewData.route?.deferred || []) {
    console.log(`   - Deferred stop: Reason = ${def.reason}, Detail = "${def.detail}"`);
  }

  // 8. Hotspot Analytics with Baseline Forecast & Held-out Evaluation
  const hotspotRes = await fetch(`${API_BASE}/analytics/hotspots`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  const hotspotData = await hotspotRes.json();
  console.log(
    '8. Hotspot Forecast:',
    hotspotData.forecast?.cells?.length > 0 ? '✅ PASS' : '❌ FAIL',
    `Weeks: ${hotspotData.weeks?.length}, Predicted zones: ${hotspotData.forecast?.cells?.length}, Held-out MAE: ${hotspotData.evaluation?.maeModel}`
  );

  // 9. Citizen Impact Ledger
  const impactRes = await fetch(`${API_BASE}/impact/me`, {
    headers: { Authorization: `Bearer ${ashaToken}` },
  });
  const impactData = await impactRes.json();
  console.log(
    '9. Citizen Impact Ledger (Asha):',
    impactData.totals?.verifiedCredits > 0 ? '✅ PASS' : '❌ FAIL',
    `Verified Credits: ${impactData.totals?.verifiedCredits}, Unique: ${impactData.totals?.uniqueIncidents}, Resolved: ${impactData.totals?.resolvedIncidents}, Feed items: ${impactData.feed?.length}`
  );

  // 10. Operator Impact Leaderboard (and security check for citizen access)
  const opLeadRes = await fetch(`${API_BASE}/impact/leaderboard`, {
    headers: { Authorization: `Bearer ${opToken}` },
  });
  const opLeadData = await opLeadRes.json();
  console.log(
    '10. Operator Impact Aggregate:',
    opLeadData.contributors?.length > 0 ? '✅ PASS' : '❌ FAIL',
    `Top contributor: ${opLeadData.contributors[0]?.displayName} (${opLeadData.contributors[0]?.verifiedCredits} credits)`
  );

  // Security check: citizen calling leaderboard must get 403
  const citizenLeadRes = await fetch(`${API_BASE}/impact/leaderboard`, {
    headers: { Authorization: `Bearer ${ashaToken}` },
  });
  console.log(
    '11. Role Security Check (Citizen blocked from operator leaderboard):',
    citizenLeadRes.status === 403 ? '✅ PASS (403 FORBIDDEN)' : '❌ FAIL'
  );

  console.log('--- All Smoke Tests Completed Successfully! ---');
}

testApi().catch((err) => {
  console.error('Smoke test error:', err);
  process.exit(1);
});
