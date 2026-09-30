# CivicClean — report waste and track the right handling path

PS03 · HackConquest Aether 2026

CivicClean is an **independent pilot** connecting citizen evidence to operator review, compatible collection planning and recorded completion. It is not connected to a municipality's dispatch system or a recycler booking API.

The citizen flow stays short: **photo → category → GPS/map location → review**. Public waste reports and private household disposal requests share this flow, but follow different handling rules.

| Waste/request | What the application does |
|---|---|
| Public wet / organic waste | Operator review → compatible wet vehicle → road-based route → clearance evidence |
| Public dry recyclables | Operator review → compatible dry vehicle → road-based route → clearance evidence |
| Mixed waste | Operator checks hazards; eligible ordinary residual waste uses a residual vehicle |
| Electronics or flagged specialist waste | Kept outside ordinary routes; operator records actual receiving service, reference, source and completion evidence |
| Household disposal | Address excluded from public map/duplicate results; operator coordinates a receiving service |
| Unknown category | Operator must classify it or explicitly mark specialist review before verification |

Nearby matching reports can share one waste event. Supporting evidence affects priority only after operator acceptance. A citizen can reopen a false closure; the previous closure is preserved in the audit history and completion credits are revoked.

## Start here

1. Read [deployment and setup](docs/DEPLOYMENT.md).
2. Read [judge questions, government comparison and PPT alignment](docs/EVALUATION-PLAYBOOK.md).
3. Use [verification and release checklist](docs/VALIDATION.md).

## Development

Use Node.js 22 and a MongoDB replica set such as Atlas. Node 22 is the CI target.

```bash
git clone https://github.com/rayyanm06/TCETHACK.git
cd TCETHACK
git checkout codex/reliable-category-handling
npm ci --prefix backend
npm ci --prefix frontend
```

Copy each `.env.example` to `.env` in the same directory and configure the backend database and secrets. Start in separate terminals:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

Open http://localhost:5173. Register a citizen normally. Create the first operator using `npm run operator:create --prefix backend` with the setup environment described in the deployment guide.

**Do not run seed/reset commands against a live database.** Startup no longer creates demo users or reports. Existing `isSeed: true` events, reports, vehicles and credits are excluded from live queries. Old demo accounts are blocked. Legacy seed utilities require explicit non-production demo mode and a database name ending in `_demo`.

## Tests

```bash
npm test --prefix backend
npm run build --prefix frontend
```

Integration tests use an isolated temporary MongoDB replica set and a local road-service fixture. No test fixtures are loaded into the live application. Browser tests use the actual frontend and backend against a separate isolated test database:

```bash
cd backend
npx playwright install chromium
npm run test:browser
```

GitHub Actions runs these checks and retains browser screenshots. The test database requires an environment that permits MongoDB to start.

## Design and implementation

- React, TypeScript, Vite, Leaflet and the existing paper/green visual theme.
- Express, Mongoose, persistent MongoDB replica-set transactions.
- Cloudinary for deployed photo storage. Image decoding, resizing and metadata stripping happen server-side.
- Optional vision classification; unavailable AI means manual category selection, never a fabricated prediction.
- OSRM road matrices and geometry; no silent straight-line substitute in live mode.
- Conservative capacity selection, corrected matrix indexing and a driving-time budget. Driving estimates exclude collection time and live traffic.
- Explainable urgency using operator-confirmed severity, waiting time, reviewed supporting evidence and sensitive sites.
- Forecast only after four complete weeks of real, reviewed public incident history. A three-week baseline is evaluated against one held-out week.

This is a more reliable pilot, not a production certification. Identity verification, private signed media, city authorization, recycler partnerships, fleet dispatch, backup/retention processes and larger-scale monitoring remain deployment work. See the guides for exact limits.
