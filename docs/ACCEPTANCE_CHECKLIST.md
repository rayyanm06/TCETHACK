# CivicClean: Manual Acceptance Checklist for Evaluators

**Target Evaluation Date:** October 1, 2026 at 10:00 AM IST  
**Pilot Zone:** Kandivali East / Borivali East (Thakur Complex & TCET vicinity, Mumbai)

Use this checklist during manual evaluation to verify each workflow end-to-end.

---

## 1. Authentication & Role Boundaries
- [ ] **Citizen Registration:**
  - Navigate to `/register`.
  - Register with name, email, and password.
  - Verify that the account is created with `role: "CITIZEN"` regardless of client input.
- [ ] **Operator Access Restrictions:**
  - Log in as a citizen (e.g. `asha@civicclean.demo` or newly registered account).
  - Attempt to access `/ops` in the browser or send `GET /api/complaints/:id` via API.
  - Verify that citizen is redirected or receives `403 Forbidden`.
  - Verify that citizen cannot access the operator leaderboard (`/api/impact/leaderboard`).
- [ ] **First Operator Initialization:**
  - Run `node scripts/createOperator.js --name "Chief Officer" --email "chief@mumbai.gov.in" --password "OfficerPass123"`.
  - Verify operator account creation is logged securely and works for login.

---

## 2. Citizen Photo Upload & Classification Integrity
- [ ] **File Validation:**
  - In Citizen Report (`/report`), attempt to upload a text file renamed to `.jpg` or a non-image file.
  - Verify upload is blocked with error `INVALID_IMAGE_FORMAT`.
- [ ] **Persistent Upload Binding:**
  - Upload a valid photo of street waste.
  - Check Network tab: upload returns `{ uploadToken, imageUrl, ai }`.
  - Verify backend records an `UploadEvidence` document bound to the authenticated citizen's ID.
- [ ] **AI Classification Assistance & Manual Override:**
  - Verify AI suggestion is displayed with confidence and explanation.
  - Verify citizen can accept the AI category or manually select another category (e.g., Plastic vs Mixed).
  - If AI service is unavailable, verify photo remains uploaded and citizen selects category manually without blockage.

---

## 3. Real Location & Boundary Enforcement
- [ ] **Interactive Leaflet Map:**
  - Check location step in `/report`.
  - Verify Leaflet map loads tiles without hardcoded coordinates silently submitted.
  - Tap or drag pin to adjust location.
  - Tap "Use My Current GPS": verify browser permission prompt and horizontal accuracy badge (e.g. `±8m`).
- [ ] **Pilot Bounding Box Validation:**
  - Place pin outside Kandivali East / Borivali East pilot rectangle (e.g. Pune or Colaba).
  - Attempt submission; verify server rejects with `OUTSIDE_SERVICE_AREA`.
  - Verify description clearly states rectangular pilot boundary rather than claiming official municipal ward borders.

---

## 4. Household vs Public Intake Flow
- [ ] **Public Street Waste Flow:**
  - Select "A. Waste in a Public Place".
  - Submit report with photo, category, and location.
  - Verify report appears as `PUBLIC` and creates an active `WasteEvent`.
- [ ] **Private Household Disposal Flow (4–5 Old Phones):**
  - Select "B. Items at my Home Needing Disposal".
  - Specify items: `"4 old smartphones, 1 broken tablet"`.
  - Quantity: `4 phones, 1 tablet`.
  - Submit report.
  - Verify confirmation note clearly explains: *"Your request is in the specialist queue for operator coordination with authorized e-waste channels. Pickup is not automatically booked."*
- [ ] **Privacy Verification:**
  - Log in as another citizen or check `/api/complaints/public` or `/api/complaints/nearby`.
  - Verify household request coordinates and item details are completely shielded and do not appear on public street maps.

---

## 5. Duplicate Detection & Anti-Abuse Priority
- [ ] **Duplicate Candidate Match:**
  - As a second citizen, submit a report within 100m of the public incident in the same category.
  - Verify nearby candidate popup appears with distance (e.g. `24m away`) and original photo.
- [ ] **Support Existing Incident:**
  - Choose "Support Existing Incident" with a new confirmation photo.
  - Verify report links to the existing `WasteEvent` instead of creating a second municipal task.
  - Verify impact transaction is marked `PENDING` (not immediately verified).
- [ ] **Explainable Priority Integrity:**
  - As an operator in `/ops`, inspect the incident dossier.
  - Verify that the raw support submission did **not** automatically increase the priority score.
  - In Event Drawer, review the supporting photo and click **"Accept Supporting Evidence"**.
  - Verify `reviewedSupportCount` increments to 1, priority recalculates with community points (+4), and citizen's impact credits transition to `VERIFIED`.

---

## 6. Real Fleet Configuration & Route Optimization
- [ ] **Operator Fleet Configuration:**
  - Go to `/ops/routes` (Routes Lens).
  - Open "Configure Fleet" panel.
  - Set vehicle name (e.g. `North Compactor MH-02-PILOT-01`), usable capacity (`1000 kg`), accepted stream (`Dry Recyclables`), and time budget (`180 mins`).
- [ ] **Queue Segregation:**
  - Click "Plan Collection Route".
  - Verify only verified, unassigned public dry incidents are considered.
  - Verify household requests, e-waste, and hazardous specialist requests are strictly excluded and documented under "Deferred Stops".
- [ ] **Correct Route Matrix Sequencing:**
  - Verify stops follow road-network driving paths.
  - Check that stop badges (1, 2, 3...) match incident locations correctly without index shifting.
- [ ] **Stale Preview Prevention:**
  - In a second tab, resolve or change one of the scheduled candidate incidents.
  - In the first tab, click "Assign Route".
  - Verify server rejects with `409 PREVIEW_STALE` and prompts operator to refresh the plan.

---

## 7. Specialist Handoff & Evidence-Backed Closure
- [ ] **Ordinary Street Incident Closure:**
  - Select a verified public street incident.
  - Click "Resolve Incident".
  - Verify clearance photo upload is mandatory.
  - On resolution, verify citizen receives `RESOLUTION_BONUS` credits on their impact ledger.
- [ ] **Specialist / E-Waste Handoff Closure:**
  - Select the household 4-phone request or e-waste incident.
  - Click "Resolve Handoff".
  - Attempt closure without facility name or receipt reference: verify server rejects with `400 VALIDATION_ERROR`.
  - Enter authorized facility (e.g. `Eco-Recycle E-Waste Handlers, MPCB Reg: 27/MPCB/RO(HQ)/E-WASTE/2023`), receipt reference (`ECO-2026-MUM-8841`), and official verification directory URL (`https://cpcb.nic.in/e-waste-recyclers/`).
  - Upload clearance/receipt photograph and confirm resolution.
  - Verify completion evidence is permanently recorded with timestamp.

---

## 8. Citizen Reopening & Credit Revocation
- [ ] **Dispute / Reopen Request:**
  - Log back in as the citizen who reported the public street incident.
  - Open `/reports/:id` for the resolved report.
  - Verify municipal clearance photo is visible.
  - Click **"Waste is still there? Dispute & Reopen"**.
  - Enter reason: *"Debris was swept into gutter, not removed."*
  - Submit reopening.
- [ ] **Atomic Ledger Adjustment:**
  - Verify incident status transitions to `REOPENED` on the city map.
  - Check Citizen Impact Ledger (`/impact`): verify the 5-credit `RESOLUTION_BONUS` is marked **REVOKED** with auditable explanation.

---

## 9. Hotspot Forecasting History Verification
- [ ] **History Sufficiency Threshold:**
  - Go to `/ops/forecast` (Forecast Lens).
  - If fewer than 3 full completed weeks exist in the live database, verify system honestly displays:
    `"INSUFFICIENT_HISTORY: Predictive forecast requires at least 3 full completed calendar weeks of reviewed incident records."`
  - Verify that household coordinates are strictly excluded from spatial hotspot clustering.
  - Verify model card transparently states the algorithm (spatial moving average with linear recency weights) and data limitations.
