# CivicClean — Smart Waste Management & Collection Planning System

**Hackathon:** HackConquest Aether 2026 · **Problem Statement:** PS03  
**Architecture:** React + TypeScript (Vite) · Node.js + Express · Embedded MongoDB (Atlas-ready) · Pure Domain Engines

---

## 🌟 Executive Product Summary

CivicClean connects citizen waste reporting with municipal collection operations in one unified civic loop:
```
5 citizen REPORTS  →  1 WASTE EVENT  →  1 COLLECTION STOP
```

1. **Citizens:** Photograph waste, review AI-suggested categories with correction support, set editable map locations, consolidate duplicate reports, and see outcomes through a verified Civic Impact credit ledger.
2. **Municipal Operators:** Inspect de-duplicated waste events, verify severity and load, plan capacity-constrained collection routes on road networks, simulate traffic congestion to replan remaining stops, clear events with photo evidence, and forecast recurring hotspots.

---

## 🚀 Quick Start (Development & Demo)

### Prerequisites
- Node.js v18+ (tested on Node v22.20.0)
- npm v9+

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Krish/CivicClean.git
cd CivicClean

# Install dependencies for both backend and frontend
npm run install:all
```

### 2. Database & Demo Baseline Seeding
The backend includes a zero-friction embedded in-memory MongoDB server that runs automatically out-of-the-box (no local MongoDB installation required). To use MongoDB Atlas, simply provide your connection string in `backend/.env`.

To seed the initial scenario:
```bash
npm run seed
```

### 3. Launching Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend API (port 4000)
npm run dev:backend

# Terminal 2: Frontend App (port 5173)
npm run dev:frontend
```

Now open `http://localhost:5173` in your browser.

---

## 🔑 Demo Accounts & One-Click Access

On the login screen (`http://localhost:5173/login`), click any of the one-click demo buttons:

| Role | Account | Password | Context |
|---|---|---|---|
| **Municipal Operator** | `operator@civicclean.demo` | `demo123` | Full access to Live City Map, Needs Attention rail, Event Drawer, Collection Planner, and Hotspot Forecast |
| **Citizen (Seeded)** | `asha@civicclean.demo` | `demo123` | Has 4 unique reports, 3 resolved incidents, and 62 verified credits on the Civic Impact Ledger |
| **Citizen (Live Demo)** | `ravi@civicclean.demo` | `demo123` | Clean account for demonstrating live photo reporting and duplicate support detection |

To reset the database back to this pristine state at any point:
```bash
npm run demo:reset
```

---

## 🧠 Core System Capabilities & Pure Engines

CivicClean is architected around deterministic pure engines covered by automated tests:

1. **Geo Engine (`backend/src/engines/geo.js`):** Great-circle Haversine distance, bounding box validation, and circle-segment spatial intersections.
2. **Duplicate Detection Engine (`backend/src/engines/duplicates.js`):** Transparently finds unresolved nearby events (≤100m, 7-day window, category compatibility) and prompts citizens to support existing incidents rather than generating redundant truck trips.
3. **Priority Engine (`backend/src/engines/priority.js`):** 4-factor explainable rule-based scoring: Severity (10/25/40), Waiting Time (0-25 over 7 days), Community Confirmations (0-20, 4 pts/unique citizen, cap 5), and Sensitive Sites (+15 pts for schools, hospitals, markets, drains).
4. **Route Planning Engine (`backend/src/engines/routing.js`):** 0/1 Knapsack selection strictly respecting vehicle capacity (default 1000 kg) combined with priority-weighted TSP sequencing on road-network matrices (with distance/speed fallback).
5. **Traffic Replanning Engine (`backend/src/engines/traffic.js`):** Simulated congestion zone multipliers (×1.5, ×2, ×3); locks completed stops in place, preserves remaining truck capacity, and re-sequences pending stops from the truck's current position.
6. **Hotspot Forecasting Engine (`backend/src/engines/forecast.js`):** Aggregates unique incidents across spatial grid cells (`0.005°` ~550m) and calculates weighted multi-week forecasts (`0.5 · W12 + 0.3 · W11 + 0.2 · W10`) with held-out week 12 MAE evaluation.
7. **Impact Credit Ledger (`backend/src/engines/impact.js`):** Outcome-verified credit ledger (Unique: 10, Support: 3, Correction: 4, Resolution: 5). Balances are derived directly from immutable transaction rows.

---

## 🧪 Running Unit Tests

Run the engine test suite:
```bash
npm test
```
All 12 test suites across geo, duplicate detection, priority, routing, traffic, and impact will execute.

---

## 🗺️ Project Structure

```
CivicClean/
├── docs/
│   ├── blueprint.md          # Architectural Blueprint
│   ├── demo-script.md        # Step-by-step 4-minute presentation rehearsal script
│   └── phase0-notes.md       # Inspection & baseline decisions
├── backend/
│   ├── scripts/              # seed.js, resetDemo.js
│   ├── seed/                 # demo.data.js, history.generator.js
│   ├── src/
│   │   ├── adapters/         # vision (Gemini/fallback), storage (Cloudinary/local), routing (OSRM/estimate)
│   │   ├── config/           # env.js, thresholds.js, db.js
│   │   ├── engines/          # PURE: geo, duplicates, priority, routing, traffic, forecast, impact
│   │   ├── middleware/       # auth, role verification, error handler
│   │   ├── models/           # User, Report, WasteEvent, Vehicle, Route, StatusEvent, ImpactTransaction, HistoryIncident
│   │   ├── routes/           # auth, config, report, event, route, analytics, impact, admin
│   │   ├── services/         # business logic
│   │   ├── app.js            # Express app
│   │   └── server.js         # Boot entrypoint
│   └── tests/                # Automated engine unit tests
└── frontend/
    ├── src/
    │   ├── citizen/          # Home, ReportWaste (4-step flow), MyReports, ReportDetails, MyImpact
    │   ├── ops/              # OpsShell, NowLens, RoutesLens, ForecastLens, ImpactLens, QueueTable, EventDrawer
    │   ├── map/              # CityMap, markerUtils (Waste Pulse animations)
    │   ├── components/       # StatusChip, PriorityChip, CategoryChip, Timeline
    │   ├── lib/              # api client, auth context
    │   ├── styles/           # tokens.css, base.css, map.css
    │   ├── types/            # TypeScript API types
    │   ├── App.tsx           # Router
    │   └── main.tsx          # React root
    ├── index.html
    ├── package.json
    └── tailwind.config.ts
```
