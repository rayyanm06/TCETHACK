# CivicClean: Core Algorithms & Architecture Defense Guide

This document equips the student team with clear, concise, and mathematically sound explanations of the core algorithms and architectural decisions implemented in CivicClean.

---

## 1. High-Level System Architecture

CivicClean follows a **Clean Architecture** model with **Pure Domain Engines** decoupled from Express and Mongoose:

```
┌─────────────────────────────────────────────────────────┐
│                   Vite + React Frontend                 │
│  (Tailored Neo-Civic UI, Leaflet Maps, Role Separation) │
└────────────────────────────┬────────────────────────────┘
                             │ REST / JSON (JWT Auth)
┌────────────────────────────▼────────────────────────────┐
│                    Express API Layer                    │
│  (Middleware: Role Enforcement, Zod Validation, Multer) │
└────────────────────────────┬────────────────────────────┘
                             │ Service Orchestration
┌────────────────────────────▼────────────────────────────┐
│               Pure Domain Engines (100% Tested)         │
│  ├── Geo Engine (Haversine distance, bounding box)      │
│  ├── Priority Engine (4-factor explainable score)       │
│  ├── Duplicate Engine (Spatial & category matching)     │
│  ├── Routing Engine (0/1 Knapsack + 2-opt TSP)          │
│  ├── Traffic Engine (Congestion segment intersection)   │
│  ├── Forecast Engine (Spatial grid moving average)      │
│  └── Impact Engine (Derived balance ledger)             │
└────────────────────────────┬────────────────────────────┘
                             │ ACID Transactions
┌────────────────────────────▼────────────────────────────┐
│              MongoDB Database (Replica Set)             │
│  (WasteEvent, Report, ImpactTransaction, UploadEvidence)│
└─────────────────────────────────────────────────────────┘
```

---

## 2. Core Algorithms Defensibility

### A. Route Planning: 0/1 Knapsack + 2-Opt TSP Sequencing
- **The Problem:** Municipal collection trucks have fixed payload capacities (e.g. 1000 kg) and maximum shift durations (e.g. 180 mins). You cannot collect all piles in one run.
- **The Solution:**
  1. **Filtering:** First, exclude all non-compatible categories (e-waste, hazardous, household items).
  2. **Capacity Selection (0/1 Knapsack):** Using dynamic programming, select the subset of verified incidents that maximizes total priority points subject to:
     $$\sum_{i \in \text{selected}} \text{weight}_i \le \text{Vehicle Capacity}$$
  3. **Matrix Subsetting:** Dynamically map selected incidents back to their original duration matrix positions to extract the exact $(K+1) \times (K+1)$ sub-matrix for depot + selected stops.
  4. **Sequencing (2-Opt TSP):** Start with Nearest Neighbor heuristic, then iteratively apply 2-opt edge swaps to eliminate road crossings until no further time reduction is achieved.
- **Key Defense Point for Judges:**  
  *"We do not use naive straight-line TSP. We solve a 0/1 Knapsack first to strictly enforce vehicle tonnage, then run 2-opt on real road-network duration matrices. Excluded stops are returned to the supervisor with explicit operational explanations."*

---

### B. Explainable Priority Engine (4-Factor Rule Model)
- **The Problem:** Machine-learning "black box" priority scores cannot be explained to a corporator or citizen demanding to know why a pile was collected ahead of theirs. Raw upvoting allows bots to inflate priority.
- **The Solution:** Deterministic, additive scoring normalized to $[0, 100]$:
  $$\text{Priority Score} = \text{Severity} + \text{Wait Time} + \text{Community Confirmations} + \text{Sensitive Site}$$
  - **Severity:** $S_1 = 10 \text{ pts}$ (small), $S_2 = 25 \text{ pts}$ (medium), $S_3 = 40 \text{ pts}$ (large).
  - **Waiting Time:** Linear ramp up to $25 \text{ pts}$ over a 7-day maximum: $\min(\text{days}/7, 1) \times 25$.
  - **Community Confirmations:** $4 \text{ pts}$ per **operator-reviewed and accepted** neighbor report, capped at 5 supporters ($20 \text{ pts}$ max). Unreviewed reports award $0 \text{ pts}$.
  - **Sensitive Site:** $+15 \text{ pts}$ if within proximity of a school, hospital, market, or public drain.
- **Tiers:** Critical ($\ge 70$), High ($50-69$), Normal ($30-49$), Low ($<30$).
- **Key Defense Point for Judges:**  
  *"Our priority engine generates human-readable sentences explaining the exact point allocation (e.g., 'High because it is a medium pile (+25), waiting 2 days (+7), near a school (+15)'). Community reports require operator review before counting, preventing bot upvoting abuse."*

---

### C. Incident De-Duplication & Spatial Consolidation
- **The Problem:** When 5 residents report the same pile on a busy street corner, traditional complaint portals generate 5 separate work orders, causing multiple trucks to visit or false closure disputes.
- **The Solution:**
  1. Calculate great-circle Haversine distance between new report $(lat_1, lng_1)$ and active incidents $(lat_2, lng_2)$:
     $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos \phi_1 \cos \phi_2 \sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  2. If $d \le 100\text{ meters}$, age $\le 7\text{ days}$, and categories are compatible, prompt the citizen with candidate photos and distances.
  3. Supporting citizen's photo is linked as `role: 'SUPPORTING'` under the existing `WasteEvent`, maintaining **one municipal task**.
- **Key Defense Point for Judges:**  
  *"5 citizen reports become 1 reviewed waste event and 1 collection stop. This saves fuel, prevents double-dispatch, and aggregates multiple photographic angles of the same waste site."*

---

### D. Hotspot Forecasting Engine
- **The Problem:** Fabricating artificial historical trends makes demos look fancy but collapses in production.
- **The Solution:**
  1. Discretize the pilot area into a uniform spatial grid of $0.005^\circ \times 0.005^\circ$ cells (~$550\text{m} \times 550\text{m}$).
  2. Filter only completed calendar weeks (Monday–Sunday), excluding incomplete current weeks and shielding private household locations.
  3. Require at least 3 completed weeks. If insufficient history exists, honestly return `INSUFFICIENT_HISTORY`.
  4. Calculate recency-weighted moving average for each cell:
     $$\hat{Y}_{i, t+1} = 0.5 \cdot Y_{i, t} + 0.3 \cdot Y_{i, t-1} + 0.2 \cdot Y_{i, t-2}$$
  5. Validate against held-out historical weeks using Mean Absolute Error (MAE):
     $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |\hat{Y}_i - Y_i|$$
- **Key Defense Point for Judges:**  
  *"We do not invent fake accuracy percentages. If our database lacks enough historical records, our system transparently displays an insufficient history notice. When sufficient data exists, it uses spatial moving averages evaluated with held-out MAE."*

---

### E. Immutable Civic Impact Credit Ledger
- **The Problem:** Citizen loyalty points are often vulnerable to database updates, race conditions, or duplicate credits on network retries.
- **The Solution:**
  - Double-entry civic ledger where citizen credit balance is **derived**, never directly overwritten:
    $$\text{Balance} = \sum_{\text{status}=\text{VERIFIED}} \text{credits}_i$$
  - Every credit creation is accompanied by an idempotent `requestId`.
  - Resolution bonus is awarded only on verifiable closure evidence.
  - If a citizen disputes a closure via the reopening workflow, the resolution bonus is atomically transitioned to `status: 'REVOKED'`, preserving an auditable history of the dispute.
