# CivicClean: 5-Minute Hackathon Evaluation Walkthrough

**Audience:** Technical & Domain Judges (HackConquest Aether 2026 · Problem Statement PS03)  
**Presenter Strategy:** Confident, explainable, and honest. Never oversell; let working code and defensible architecture demonstrate competence.

---

## Minute 0:00 – 0:45: The Problem & Honest Differentiation

> *"Good morning, judges. We are presenting CivicClean for PS03 — Waste Reporting and Collection Management.*
>
> *Existing platforms like Swachhata-MoHUA already let citizens snap photos, track grievances, and reopen tickets. Our research showed the breakdown happens after the report: municipal supervisors face dozens of duplicate complaints for the exact same corner pile, hazardous electronic waste ends up mixed into ordinary compactors, and route planning is done on static paper beats.*
>
> *Our operational focus is simple: **Citizen evidence becomes one reviewed waste task, which goes to the correct handling path and ends with recorded completion.**"*

---

## Minute 0:45 – 1:45: Citizen Flow (Public vs Household Electronics)

1. Open `/report` on mobile view (390px width).
2. **Show Scope Selection:**
   > *"Notice our first screen: we offer two clear choices: A. Waste in a public place, or B. Items at home needing disposal.*
   >
   > *If a citizen has 4 old phones or a broken microwave, logging it as street waste creates a false public pile. We provide a private household intake that records items and quantities, and strictly shields the citizen's address from public maps."*
3. **Show Real Photo & Interactive Location:**
   > *"We upload real evidence with magic-byte validation and hash verification. Our Leaflet map captures real browser GPS with an accuracy badge (`±6m`), allowing the citizen to drag the pin. The server enforces our rectangular pilot boundary in Kandivali East without hardcoding."*
4. **Show Duplicate Consolidation:**
   > *"If a neighbor reports a pile 20 meters away, our duplicate engine detects it. Rather than dispatching two trucks, the citizen can support the existing incident. But crucially: unreviewed support does NOT automatically boost priority or award credits — preventing multi-account manipulation."*

---

## Minute 1:45 – 3:00: Municipal Operations & Explainable Priority

1. Switch to Operator Console (`/ops`).
2. **Reviewing Community Evidence:**
   > *"Here in the Operator Dossier, our priority score is an explainable 4-factor sum: Severity, Waiting Time, Sensitive Sites, and Community Confirmations. Notice Bikram's supporting photo starts as PENDING. Only when the supervisor accepts it is the community weight added (+4 points)."*
3. **Queue Segregation:**
   > *"Notice our stream tabs: All, Ordinary Public, E-Waste, Specialist, and Household. E-waste and household electronics are quarantined in a specialist queue. They are never mixed into ordinary compactor routes."*

---

## Minute 3:00 – 4:00: Real Fleet & Capacity Routing

1. Open Routes Lens (`/ops/routes`).
2. **Fleet Configuration:**
   > *"The supervisor configures real vehicle parameters: vehicle registration (`MH-02-PILOT-01`), 1000 kg usable capacity, dry stream compatibility, and depot location.
   >
   > Our routing engine solves a 0/1 Knapsack to select the highest-priority compatible stops that fit the truck's weight limit, then sequences them along real road networks using OSRM. Any excluded stops are explicitly listed with clear operational reasons (e.g. over capacity or incompatible category)."*
3. **Stale Check Protection:**
   > *"If an incident status changes while the operator inspects the route preview, the server rejects assignment with `409 PREVIEW_STALE` to prevent double-booking or dispatching to already cleared piles."*

---

## Minute 4:00 – 4:45: Specialist Handoff, Closure Evidence & Reopening

1. Open the Household E-Waste incident in the Event Drawer.
2. **Documented Handoff:**
   > *"For electronic and household waste, municipal compaction is illegal under CPCB E-Waste Rules 2022. To resolve this task, the supervisor must record the human-confirmed handoff: the registered recycler name, the receipt reference, and the official CPCB/MPCB directory verification URL.*
   >
   > *We do not invent fake recyclers or claim automated APIs; we provide an auditable chain of custody."*
3. **Citizen Reopening & Credit Reversal:**
   > *"When a public street incident is resolved with a clearance photo, the reporting citizen receives a resolution bonus. But if the street wasn't properly cleared, the citizen can click 'Dispute & Reopen'. This reopens the task and atomically revokes the completion bonus on their impact ledger."*

---

## Minute 4:45 – 5:00: Hotspot Analytics & Conclusion

1. Open Forecast Lens (`/ops/forecast`).
2. **Honest Data Science:**
   > *"Our forecasting engine uses real, reviewed incident history grouped into 550m spatial cells. If fewer than 3 full calendar weeks exist, the system honestly displays 'Insufficient History' rather than fabricating fake historical trends.*
   >
   > *Every line of this pilot is verified by our 26 automated regression tests covering security, role boundaries, idempotency, and domain engines. Thank you, and we welcome your questions."*
