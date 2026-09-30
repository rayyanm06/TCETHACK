# CivicClean — Smart Waste Reporting & Collection Management

**Hackathon Evaluation:** October 1, 2026 at 10:00 AM IST · **Problem Statement:** PS03  
**Target Pilot Zone:** Kandivali East / Borivali East (Thakur Complex & TCET vicinity, Mumbai)  
**Architecture:** Vite + React (TypeScript) · Node.js + Express · MongoDB Replica Set (Atlas-ready) · Pure Domain Engines

---

## 🌟 Executive Product Focus & Differentiation

> **"Citizen evidence becomes one reviewed waste task, which goes to the correct handling path and ends with recorded completion."**

Judges rightly questioned how this differs from existing government platforms like **Swachhata-MoHUA** or municipal CRM apps:
- Swachhata already offers photo uploads, GPS coordinates, grievance tracking, and status upvoting. We do **not** claim those features alone are novel.
- Our operational differentiation is the **logistical bridge** inside municipal operations:
  1. **Spatial Incident Consolidation:** 5 citizen reports within 100m become **1 reviewed waste event and 1 collection stop**. Supporting reports link directly to the existing incident rather than generating redundant truck dispatches.
  2. **Private Household Disposal Stream:** Citizens with 4–5 old smartphones or broken home appliances can submit household disposal requests. Residential coordinates are strictly shielded from public maps and nearby candidate searches.
  3. **Queue Segregation (E-Waste & Specialist Hazards):** Electronic waste and hazardous items are quarantined in dedicated queues and strictly excluded from ordinary municipal compactors.
  4. **Documented Specialist Handoff:** Under CPCB E-Waste Rules 2022, resolving electronic and household items strictly requires recording the receiving facility name, receipt/acceptance reference, and official CPCB/MPCB directory verification URL.
  5. **Explainable, Operator-Reviewed Priority:** Raw upvotes or repeated submissions do not boost priority. Only operator-reviewed and accepted evidence contributes to the community score (capped at 5 supporters).
  6. **Evidence-Backed Closure & Atomic Reopening:** Clearances require photo proof. If a citizen disputes a closure, reopening re-activates the incident and atomically revokes completion bonuses on the immutable credit ledger.

Detailed official source citations and comparison tables are documented in [docs/GOV_COMPARISON.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/GOV_COMPARISON.md).

---

## 📚 Key Evaluation & Presentation Documentation

| Document | Purpose |
|---|---|
| [docs/GOV_COMPARISON.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/GOV_COMPARISON.md) | Official government comparison with links to Swachhata-MoHUA, BMC, MPCB, and CPCB. |
| [docs/ACCEPTANCE_CHECKLIST.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/ACCEPTANCE_CHECKLIST.md) | Complete manual acceptance testing checklist for evaluators and judges. |
| [docs/DEPLOYMENT.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/DEPLOYMENT.md) | Production deployment guide, exact environment variables, replica set setup, and security safeguards. |
| [docs/EVALUATION_WALKTHROUGH.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/EVALUATION_WALKTHROUGH.md) | Rehearsed 5-minute presentation script for the student team. |
| [docs/PPT_CLAIMS_TABLE.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/PPT_CLAIMS_TABLE.md) | Presentation slide claim-to-feature matrix with explicit "What NOT to claim" guardrails. |
| [docs/ALGORITHMS_AND_ARCHITECTURE.md](file:///c:/Users/Krish/OneDrive/Desktop/CivicClean/docs/ALGORITHMS_AND_ARCHITECTURE.md) | Defensible technical explanations of 0/1 Knapsack, 2-opt TSP, 4-factor Priority, and spatial moving averages. |

---

## 🚀 Quick Start (Development & Demo)

### Prerequisites
- Node.js v18+ (tested on Node v22+)
- npm v9+

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/rayyanm06/TCETHACK.git
cd TCETHACK

# Install dependencies for root, backend, and frontend
npm run install:all
```

### 2. Database
The backend includes a zero-friction embedded in-memory MongoDB server that runs automatically out-of-the-box (no local MongoDB installation required in development). To use MongoDB Atlas, provide your connection string in `backend/.env`.

### 3. Launching Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend API (port 4000)
npm run dev:backend

# Terminal 2: Frontend App (port 5173)
npm run dev:frontend
```

Open `http://localhost:5173` in your browser.

---

## 🔑 Demo Accounts & One-Click Access

On the login screen (`http://localhost:5173/login`), click any of the one-click demo buttons:

| Role | Account | Password | Context |
|---|---|---|---|
| **Municipal Operator** | `operator@civicclean.demo` | `demo123` | Full access to Live City Map, Stream Queues, Event Dossier, Route Planner, and Hotspot Forecast |
| **Citizen (Asha)** | `asha@civicclean.demo` | `demo123` | Active citizen account with verified reports and credit ledger |
| **Citizen (Ravi)** | `ravi@civicclean.demo` | `demo123` | Clean citizen account for demonstrating live photo reporting and duplicate candidate support |

### Creating Initial Operator in Production:
Public registration always enforces `role: "CITIZEN"`. To securely provision an operator account without demo seeds:
```bash
node backend/scripts/createOperator.js --name "Chief Officer" --email "chief@mumbai.gov.in" --password "SecurePass2026!"
```

---

## 🧪 Automated Regression & Engine Tests

CivicClean features 100% passing automated test coverage across mathematical domain engines, API security, and end-to-end workflows:

```bash
# Run all tests (Engine Unit Tests + Workflow & Security Integration Suite)
cd backend
npm test
```

### Test Suite Highlights:
- `engines.test.js`: 12 pure domain tests (Haversine distance, bounding box, 4-factor priority capping, duplicate matching, 0/1 Knapsack capacity, and congestion multipliers).
- `workflow.test.js`: 14 end-to-end regression tests:
  1. Citizen cannot use operator APIs (403 Forbidden).
  2. Public signup cannot create an operator (role escalation prevented).
  3. Photo upload rejects corrupt/non-image buffer (magic bytes validation).
  4. Photo upload with valid JPEG succeeds and returns upload token.
  5. Citizen creates primary report; submission retries with same `requestId` are idempotent.
  6. Another citizen cannot access private report details (404 Not Found).
  7. Citizen submits private household disposal (4 old phones) — coordinates shielded from public endpoints.
  8. Duplicate candidate detection and neighbor support creates single incident with PENDING impact (does not inflate priority).
  9. Operator reviews supporting evidence: accepting increases `reviewedSupportCount` and verified credits.
  10. Route planning excludes household and e-waste; sub-matrices remain correctly aligned.
  11. Stale / double route assignment is rejected (`409 PREVIEW_STALE`).
  12. Specialist/Household resolution requires receiving facility, receipt ref, official URL, and completion photo.
  13. Repeat closure on already resolved incident returns 409 or prevents duplicate resolution credits.
  14. Citizen reopening disputed incident changes status to `REOPENED` and revokes `RESOLUTION_BONUS` credits.

---

## 🗺️ Project Structure

```
CivicClean/
├── docs/
│   ├── GOV_COMPARISON.md             # Official government comparison & source links
│   ├── ACCEPTANCE_CHECKLIST.md       # Step-by-step evaluator checklist
│   ├── DEPLOYMENT.md                 # Production deployment & environment variables
│   ├── EVALUATION_WALKTHROUGH.md     # 5-minute presentation script
│   ├── PPT_CLAIMS_TABLE.md           # Claim-to-feature alignment & slide guardrails
│   └── ALGORITHMS_AND_ARCHITECTURE.md# Technical algorithms defense
├── backend/
│   ├── scripts/                      # createOperator.js, seed.js, resetDemo.js
│   ├── src/
│   │   ├── adapters/                 # vision (Gemini/fallback), storage (Cloudinary/local), routing (OSRM/estimate)
│   │   ├── config/                   # env.js, thresholds.js, db.js
│   │   ├── engines/                  # PURE: geo, duplicates, priority, routing, traffic, forecast, impact
│   │   ├── middleware/               # auth, role verification, error handler
│   │   ├── models/                   # User, Report, WasteEvent, Vehicle, Route, StatusEvent, ImpactTransaction, UploadEvidence
│   │   ├── routes/                   # auth, config, report, event, route, analytics, impact, admin
│   │   ├── services/                 # business logic & transaction orchestration
│   │   ├── app.js                    # Express app configuration
│   │   └── server.js                 # Server boot entrypoint
│   └── tests/
│       ├── engines.test.js           # Unit engine tests (12 passing)
│       ├── workflow.test.js          # Integration & security tests (14 passing)
│       └── smoke.test.js             # Live API smoke tests
└── frontend/
    ├── src/
    │   ├── citizen/                  # CitizenHome, ReportWaste (4-step flow), ReportDetails, MyReports, MyImpact
    │   ├── ops/                      # OpsShell, NowLens, RoutesLens, ForecastLens, ImpactLens, EventDrawer
    │   ├── map/                      # CityMap, markerUtils (Neo-Civic styles)
    │   ├── components/               # StatusChip, PriorityChip, CategoryChip, Timeline
    │   ├── lib/                      # api client, auth context
    │   ├── styles/                   # tokens.css, base.css, map.css
    │   └── types/                    # TypeScript API types
    ├── index.html
    └── package.json
```
