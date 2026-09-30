# CivicClean — 4-Minute Demo Script & Rehearsal Guide

**Hackathon:** HackConquest Aether 2026 · **PS03:** Smart Waste Management System  
**Roles:** Laptop = Municipal Operator (`operator@civicclean.demo`) · Mobile/Window = Citizen Ravi (`ravi@civicclean.demo`)

---

## Pre-Demo Setup (1 minute before presentation)
1. Run backend: `npm run dev:backend` (port 4000)
2. Run frontend: `npm run dev:frontend` (port 5173)
3. Reset DB to pristine seed: `npm run demo:reset`
4. Open two browser windows / tabs:
   - Window A (Desktop view): `http://localhost:5173/login` -> click **"Continue as Demo Operator (Dilip)"**
   - Window B (Mobile 390px view): `http://localhost:5173/login` -> click **"Continue as Ravi M."**

---

## Live Demo Walkthrough (4–5 minutes)

### Step 1: Framing & The One Loop (0:00 - 0:20)
- **Say:** "CivicClean solves the core operational bottleneck of smart waste management: turning citizen reports into capacity-aware municipal collection stops without duplicate truck visits."
- **Show Window A (Operator Live City Map):**
  - Point out the top header ticker: `16 reports → 13 events → 7 planned stops`.
  - Explain: "5 citizen reports collapse into 1 waste event on the map, which becomes 1 collection stop."

---

### Step 2: Citizen Photo-First Reporting (0:20 - 1:00)
- **Show Window B (Ravi on Mobile):**
  - Click **"Report Waste Now"** (large green button).
  - Step 1 (Photo): Click "Take Photo" or "Choose from Gallery", select sample organic pile.
  - Step 2 (Category): Point out the **frosted-paper label** layered over the photo: *"Looks like Organic · Vegetable and food waste pile"*.
  - Show citizen confirmation chip and click **"Confirm Category & Set Location"**.
  - Step 3 (Location): Draggable pin shows the coordinates near Greenwood Apartments.

---

### Step 3: Transparent Duplicate Detection & Support (1:00 - 1:30)
- **Show Window B:**
  - Click **"Confirm Location & Check Area"**.
  - The **"This May Already Be Reported"** sheet appears:
    *"WE-0006 · Organic · about 45m away · reported 2 days ago"*.
  - Show the two equal-prominence choices:
    - *"Yes, that's the same one (Support)"*
    - *"No, this is a separate pile"*
  - Ravi taps **"Yes, that's the same one (Support)"**.
  - Success screen: *"Report Received — Incident Code: WE-0006"*.

---

### Step 4: Operator Consolidation & Verification (1:30 - 2:15)
- **Show Window A (Operator):**
  - Click on **WE-0006** in the Needs Attention rail or on the map.
  - The **Event Drawer** opens:
    - Photo gallery now shows 2 photos (original primary + Ravi's supporting photo).
    - Linked citizen evidence shows both contributors with credits.
  - Open **WE-0010** (Plastic, unverified):
    - Select Severity: **S2 Medium (+25)**.
    - Set Estimated Weight: **20 kg**.
    - Click **"Verify Event"**.
    - The priority breakdown bar animates and updates to verified priority tier!

---

### Step 5: Capacity-Aware Route Planning (2:15 - 3:00)
- **Show Window A (Operator):**
  - Switch to the **ROUTES** lens in the top command bar.
  - The Collection Planner opens:
    - **Capacity bar:** Shows planned load of **990 kg / 1000 kg (99% utilized)**.
    - **Deferred Stops list:**
      - `WE-0008`: **CAPACITY** — 900 kg does not fit remaining 10 kg vehicle capacity.
      - `WE-0009`: **INCOMPATIBLE** — E-waste requires special vehicle handling.
    - **Route Ribbon:** Clean road travel-time route drawn between stops.
    - **Horizontal Stop Sequence Dock:** Transit-sign style stop badges.
  - Click **"Assign This Route to Crew"** -> Events move to `SCHEDULED`.

---

### Step 6: Clearance & Outcome Verification (3:00 - 3:30)
- **Show Window A:**
  - On stop `WE-0006` in the dock or drawer, click **"Mark Cleared"** or enter operator note *"Cleared during morning collection run."*
  - Click **"Confirm Resolution"** -> Stop turns green with checkmark.

---

### Step 7: Simulated Congestion & Remaining Route Replan (3:30 - 4:10)
- **Show Window A:**
  - Under Simulated Traffic, click **"Simulate Congestion on Busiest Leg (×2.0)"**.
  - Notice the permanent badge: **`SIMULATED — not live traffic`**.
  - Click **"Replan Remaining Route"**:
    - Completed stops stay locked in place.
    - Remaining pending stops re-sequence from the truck's current position.
    - Notification banner displays: *"Replanned after congestion: 46 min → 61 min"*.

---

### Step 8: Closing the Loop — Citizen Impact Ledger (4:10 - 4:40)
- **Show Window B (Ravi):**
  - Tap the bottom **"Impact"** tab:
    - Civic Impact Ring updates with verified credits.
    - "What Changed Because of You" feed displays: *"Greenwood Apartments pile — cleared on 30 Sep. 2 neighbours confirmed it."*
    - Total verified credits increased with resolution bonus!

---

### Step 9: Predictive Hotspots & Conclusion (4:40 - 5:00)
- **Show Window A:**
  - Switch to the **FORECAST** lens:
    - Toggle **History / Forecast**: soft heat zones switch to dashed plum breathing forecast rings.
    - Point out the Model Card: *"Held-out week 12 evaluation: model MAE 0.42 vs naive baseline 0.61 on synthetic data."*
  - Close with: *"One closed loop: citizen reporting, operator verification, capacity-aware routing, honest traffic replanning, and outcome-verified citizen recognition."*
