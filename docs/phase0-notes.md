> Historical prototype document. For the current category-aware pilot, use [DEPLOYMENT.md](DEPLOYMENT.md) and [EVALUATION-PLAYBOOK.md](EVALUATION-PLAYBOOK.md). Do not reuse demo claims/data for the live evaluation.

# Phase 0 Inspection & Decisions — CivicClean

**Date:** 2026-09-30  
**Repository State:** Fresh empty repository at `c:\Users\Krish\OneDrive\Desktop\CivicClean`.

## Decisions & Baseline Alignment
1. **Architecture & Stack:**
   - Frontend: Vite + React 18/19 + TypeScript + Tailwind CSS + Leaflet + Lucide Icons + Self-hosted Fraunces & Inter fonts (`@fontsource-variable/*`).
   - Backend: Node.js (v22) + Express + Mongoose + Zod + JWT + Multer + Cloudinary / Local storage adapter + Gemini Vision adapter (with graceful offline fallback) + OSRM routing adapter (with speed/distance fallback).
   - Database: Mongoose connecting to `MONGODB_URI`. For zero-friction setup if local `mongod` is absent, an embedded `mongodb-memory-server` option is built-in so `npm run dev` and `npm run seed` work immediately without setup blockers, while fully supporting any MongoDB Atlas cluster URI when set in `.env`.
2. **Coordinates Baseline:**
   - Municipal depot set to `lat: 19.2071, lng: 72.8760` (Thakur Complex / Kandivali East, Mumbai near TCET), fitting the HackConquest Aether venue context.
   - All seeded events and synthetic history clusters are calculated using exact meter offsets from this depot to guarantee realistic road snapping with OSRM and tight spatial coherence (~2 km radius).
3. **Core Data Separation:**
   - Strict separation between `Report` (immutable citizen evidence & contribution) and `WasteEvent` (mutable municipal operational incident).
   - Multi-report consolidation into single operational events with transparent duplicate detection and support workflows.
4. **Verification & Priority Engine:**
   - 4-factor explainable priority: Severity (10/25/40), Waiting Time (0-25 over 7-day scale), Community Support (0-20, 4pts/unique user, cap 5), Sensitive Site (+15).
5. **Route Planning & Congestion Replan:**
   - 0/1 Knapsack priority maximisation within vehicle capacity (default 1000 kg).
   - Permutation / 2-opt TSP sequencing factoring travel time and priority arrival bonus.
   - Simulated traffic congestion zones applying cost multipliers, replanning remaining uncompleted stops while locking completed stops.
