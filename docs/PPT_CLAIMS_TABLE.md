# CivicClean: PPT Claim-to-Feature Alignment Table

This document ensures that every presentation slide, verbal claim, and architecture diagram presented to judges is defensible and aligns with the implemented codebase.

---

## 1. Feature Status Matrix

| System Domain | Slide / Pitch Claim | Implementation Status | Technical Mechanism in Codebase | Limitations & Honest Disclosures |
|---|---|---|---|---|
| **Intake Scopes** | Public waste reporting and private household disposal intake. | **Fully Implemented** | `reportType: 'PUBLIC' \| 'HOUSEHOLD'` in `Report` and `WasteEvent` schemas. Multi-step form in `ReportWaste.tsx`. | Household requests do not guarantee instant door-to-door pickup; they enter an operator specialist coordination queue. |
| **Household Privacy** | Household addresses and item inventories are kept private. | **Fully Implemented** | Household events filtered from `/api/complaints` for citizens, `/api/complaints/nearby`, and public map pins. | Coordinates are viewable only by authenticated municipal operators in the specialist drawer. |
| **Photo Upload Integrity** | Verifiable image uploads with tamper and replay protection. | **Fully Implemented** | Magic bytes verification (JPEG/PNG/WebP), SHA-256 hash check, `UploadEvidence` schema, and signed upload tokens (`verifyUploadToken`). | Does not perform forensic camera EXIF authenticity verification if metadata is stripped for citizen privacy. |
| **AI Vision Assistance** | AI classification of waste materials from photos. | **Implemented with Fallback** | Gemini Vision API integration in `backend/src/adapters/vision/gemini.js` with structured JSON output and graceful manual fallback. | AI is an advisory suggestion; citizen can override, and operator confirms during verification. |
| **Location & Boundaries** | Interactive map with browser GPS and pilot boundary check. | **Fully Implemented** | Leaflet interactive map with tap/drag pin, browser `navigator.geolocation` accuracy display, and rectangular pilot bounding box validation in `engines/geo.js`. | Pilot boundary is an engineering rectangle (Kandivali East / Borivali East), not an official digitized municipal ward shapefile. |
| **Duplicate Consolidation** | Merges duplicate neighbor reports into a single collection stop. | **Fully Implemented** | `findNearbyCandidates` (100m, 7 days, category compatibility) in `engines/duplicates.js`. Linking supporting reports to existing `WasteEvent`. | Consolidates reports into one event; does not claim automated computer-vision 3D pile volume merging. |
| **Anti-Abuse Priority** | Prevents priority manipulation by bots or repeated upvotes. | **Fully Implemented** | `computePriority` in `engines/priority.js` uses `reviewedSupportCount`. Pending support reports do not increase score until operator accepts them. | Email/password login does not prove unique human identity (e.g. no Aadhaar or biometric KYC). Rate limits and operator review mitigate abuse. |
| **Stream Segregation** | Keeps e-waste, specialist hazards, and wet/dry waste separate. | **Fully Implemented** | Queue segregation filters in `eventService.js` (`public_ordinary`, `e_waste`, `specialist`, `household`). Compactor routing strictly excludes non-ordinary items. | Operational segregation inside municipal dispatch; does not physically inspect truck bin dividers. |
| **Vehicle Routing** | Real capacity-constrained route planning on road networks. | **Fully Implemented** | 0/1 Knapsack optimization for vehicle weight capacity combined with 2-opt TSP on OSRM road-network duration matrices in `engines/routing.js`. | Calculates road driving durations and distances; does not claim live real-time traffic without an enterprise live traffic provider. |
| **Route Stale Check** | Prevents assigning outdated routes or double-booking stops. | **Fully Implemented** | Checks candidate stop status, assignment, and existence inside atomic database transaction before updating to `SCHEDULED`. | Rejects stale route previews with `409 PREVIEW_STALE` and requires operator refresh. |
| **Specialist Handoff Closure** | Documented chain of custody for e-waste and household disposal. | **Fully Implemented** | `resolveOperatorEvent` strictly enforces receiving facility name, receipt/acceptance reference, and official CPCB/MPCB directory verification URL. | Records human-confirmed physical handoffs; does not integrate with private recycler proprietary ERP APIs. |
| **Reopening & Credit Ledger** | Citizen dispute of bad cleanups with atomic credit reversal. | **Fully Implemented** | `reopenResolvedReport` transitions status to `REOPENED` and atomically marks `ImpactTransaction.status = 'REVOKED'` on the immutable ledger. | Credit ledger is civic and non-monetary; credits cannot be redeemed for fiat currency unless an external voucher partner is configured. |
| **Hotspot Forecasting** | Spatial pattern prediction based on reviewed incident history. | **Fully Implemented** | 550m spatial grid moving average with recency weighting (`0.5 · W_t + 0.3 · W_{t-1} + 0.2 · W_{t-2}`). Returns `INSUFFICIENT_HISTORY` if <3 weeks exist. | Excludes incomplete current week and household private locations. Transparently discloses model baseline limitations. |

---

## 2. Guardrails: What NOT to Claim in Presentation Slides

To maintain credibility during hackathon evaluation, the team **must NOT claim**:

1. **NO "Live Traffic Routing"**:  
   Do not claim real-time Google Maps or TomTom live traffic data. The system uses OSRM road-network geometry and allows supervisors to simulate roadwork/congestion scenarios via bottleneck multipliers.
2. **NO "Guaranteed Pickup Service"**:  
   Do not claim that submitting 4 old phones guarantees a municipal truck will arrive at the citizen's doorstep within 2 hours. The system queues household items for supervisor coordination with authorized e-waste channels.
3. **NO "Automated Recycler Partnerships"**:  
   Do not claim formal contracts or automated API integrations with recyclers like Eco-Recycling. The system records verifiable handoff credentials (facility name, receipt ref, CPCB/MPCB portal link).
4. **NO "Unique Biometric Identity"**:  
   Do not claim to have eliminated fake accounts using email/password authentication. Claim practical anti-manipulation controls (rate limits, one contribution per account per event, operator-reviewed support, and capped priority weights).
5. **NO "99% Forecast Accuracy" or "X Tons of CO₂ Saved"**:  
   Do not present fabricated impact figures or accuracy statistics that were never measured. Point to our held-out Mean Absolute Error (MAE) validation on completed calendar weeks.
6. **NO "Official Government Integration"**:  
   Do not claim CivicClean is officially endorsed or deployed by BMC or MoHUA. It is an independent engineering pilot designed for municipal operations in Kandivali East / Borivali East.
