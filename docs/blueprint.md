# CivicClean — Implementation Blueprint
**Hackathon:** HackConquest Aether 2026 · **PS03:** Smart Waste Management System
**Repo:** `CivicClean/` (`frontend/`, `backend/`)

## 1. Executive Product Summary
CivicClean connects citizen waste reports with municipal collection planning in one operational loop:
`5 citizen REPORTS → 1 WASTE EVENT → 1 COLLECTION STOP`

## 2. Core Model Separation
A `Report` is one citizen's immutable submission (evidence + contribution).
A `WasteEvent` (API: `/complaints`) is the operational incident the municipality acts on. Many reports → one event.
Operators mutate events; nobody mutates a report's evidence (photo, AI output, citizen category, location).

## 3. Pure Domain Engines
1. `geo.js`: Haversine distance, bounding box validation, segment-circle intersection.
2. `duplicates.js`: Duplicate detection within configurable radius (100m) and time window (7 days).
3. `priority.js`: Explainable 4-factor scoring (Severity 10/25/40, Waiting time 0-25, Community 0-20, Sensitive site 15).
4. `routing.js`: 0/1 Knapsack capacity selection + priority TSP sequencing on road-travel times.
5. `traffic.js`: Simulated congestion zone cost multipliers; locks completed stops; replans remaining stops from current position.
6. `forecast.js`: Grid-cell weekly counts + 3-week weighted forecast with held-out week 12 MAE evaluation.
7. `impact.js`: Outcome-verified credit ledger (Unique: 10, Support: 3, Correction: 4, Resolution: 5).

## 4. Visual Design System — Neo-Civic / Living City
- Palette: Paper (#F5F2EA), Ink (#17231C), Moss (#2E6B4E), Lagoon (#0E6A78), Clay (#C4492F), Ochre (#C48A12), Plum (#6B4F8F).
- Waste Pulse Markers:
  - Unverified: Dashed circle outline
  - Verified Normal: Solid ink circle
  - Verified High: Solid circle + static ochre ring
  - Verified Critical: Solid clay circle + double ring pulsing (2.4s)
  - Scheduled: Lagoon inner dot + stop badge number
  - Resolved: Moss circle + check
  - Predicted Hotspot: Dashed plum ring breathing
