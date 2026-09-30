# Deployment and setup

Use this guide for the category-aware pilot branch. The older blueprint/demo documents describe an earlier prototype and are not the current release instructions.

## 1. Keep existing data safe

- Take a database backup before changing a deployed application.
- Use a **new database name** for the live pilot (for example `civicclean_pilot`). Keep the previous demo database intact.
- Do not import seeded incidents, invented fleet records or synthetic history into the pilot.
- Existing live-data migrations require review: new evidence-review fields default to pending and specialist fields must be confirmed by an operator. Old reports whose `isSeed` tag is missing are not automatically identifiable as synthetic. A fresh pilot database avoids presenting them as real.
- Do not run `seed`, `demo:reset`, or delete collections during deployment.

## 2. Configure the API

Deploy the `backend` directory as a Node 22 web service. Commands:

```bash
npm ci
npm start
```

Set these in the host's secret/environment settings, not in Git:

| Variable | Required value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your authenticated Atlas/replica-set connection string |
| `MONGODB_DB` | Your new live pilot database name |
| `JWT_SECRET` | Unique random secret, at least 32 characters |
| `UPLOAD_TOKEN_SECRET` | A different unique random secret, at least 32 characters |
| `CORS_ORIGINS` | Exact HTTPS frontend origin; comma-separated if more than one |
| `STORAGE_DRIVER` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Your server-side Cloudinary credentials |
| `CLOUDINARY_FOLDER` | A dedicated pilot folder |
| `DEMO_MODE` / `ALLOW_DEMO_RESET` / `ALLOW_MEMORY_DB` | `false` |
| `ALLOW_ROUTING_ESTIMATES` | `false` |
| `SERVICE_AREA_BBOX` | `[minLng,minLat,maxLng,maxLat]` for your actual acceptance area |
| `OSRM_BASE_URL` | A reachable OSRM endpoint serving your pilot roads |
| `OSRM_TIMEOUT_MS` | e.g. `10000` |
| `VISION_PROVIDER` | `none`, or a configured provider (`gemini`/`anthropic`) |
| `VISION_MODEL` | Exact available model ID if enabling vision |

Generate each secret independently, locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Store the result directly in the hosting secret settings. Do not paste secrets into a PR, screenshot or chat.

The API refuses production startup without persistent storage configuration, secure secrets and a database. MongoDB must support transactions. Memory databases are only explicitly available outside production for tests/local experiments; they are not a deployment fallback.

The supplied rectangular Mumbai pilot area is an application acceptance boundary, **not an official municipal ward boundary**. Adjust it to the area the team can actually serve. It does not prove land access or road reachability.

For a Vercel API deployment, `backend/api/index.js` remains available, but check that your plan supports the photo size and processing duration you need. A continuously running Node service is easier to operate for tomorrow's small pilot. In-process rate limits do not provide a shared limit across multiple serverless instances; use one API instance for the limited pilot or configure a shared limiter/edge controls before wider access.

## 3. Configure and deploy the frontend

Deploy the `frontend` directory as a Vite static site. Build command `npm run build`, output `dist`.

Set before building:

```text
VITE_API_BASE_URL=https://YOUR-API-HOST/api
```

Only the public API base URL and tile configuration belong in `VITE_*` variables. API keys and database credentials do not.

The included frontend rewrite supports direct links such as `/reports/…` and `/ops/routes`. Add the final frontend origin to backend `CORS_ORIGINS`, then restart the API. HTTPS is needed for reliable browser location permission outside localhost.

Map tiles default to CARTO/OSM attribution. OSRM and map-tile reachability must be tested on the actual presentation network. For sustained production traffic, arrange suitable hosted/self-hosted routing and map services and review their usage terms; a public routing endpoint is not an uptime commitment.

## 4. Create the first operator

In a secure backend setup environment, temporarily set:

```text
OPERATOR_NAME=<actual team operator name>
OPERATOR_EMAIL=<their email>
OPERATOR_PASSWORD=<unique password of 12–72 characters>
```

Run:

```bash
npm run operator:create
```

Remove the setup password from the environment afterward. The command refuses to overwrite an existing account or promote an existing citizen silently. Public registration always creates a citizen.

Email/password registration authenticates possession of that password; it does **not** verify email ownership or a unique person. Do not claim OTP, Aadhaar or one-human-one-account protection. See the playbook for the current abuse controls and remaining identity work.

## 5. Enter real operating details

- In the operator's **Routes** view, choose **Configure a collection vehicle**.
- Enter an actual arranged vehicle's name, registration, usable capacity, driving budget, collection stream and depot pin.
- Wet, dry and residual streams are kept separate. Electronics and flagged specialist waste are excluded from these routes.
- If the team has no collection vehicle/crew arrangement, leave fleet empty and show the review/handoff workflow. Do not present an invented truck as operational capacity.
- For a specialist/household request, contact an appropriate currently eligible receiving service. Check accepted material and current registration using official resources/manufacturer take-back information.
- Only after real acceptance/handling, record the receiving service, receipt/reference, source URL, photo and note. Entering these fields records an operator attestation; it does not automatically verify the service or book a pickup.

## 6. Verify the actual deployment

```bash
npm run check:ready
```

This is a read-only configuration check. It checks database/replica-set configuration, non-demo operator/fleet presence and road routing if a depot exists. Cloudinary credentials are checked for presence; **a real photo upload is still required** to verify them.

Then follow `VALIDATION.md` using two citizen accounts and one operator account. Use actual photos and locations. Refresh, sign out/in and restart the API once to verify persistence.

## 7. Final release gates

- CI green on the exact branch commit you will deploy.
- A real photo remains accessible after an API restart.
- Phone GPS/map selection works over HTTPS, with permission denied handled.
- Public map excludes household coordinates; other citizens cannot read private report details.
- Category decisions, route exclusions, receipts and timeline match what actually happened.
- No successful closure displayed without evidence; no fabricated route if OSRM is down.
- Backups, host errors and data access limited to your team.

For a wider public release: add verified email/phone identity and recovery, private signed photo delivery, a defined retention/deletion policy, shared abuse controls, vehicle updates/cancellation, operator organization scoping, monitoring, backups/restore drills and agreements with actual service providers. Current uploads use unguessable provider URLs, not authenticated private media access. Do not upload sensitive documents or identifiable bystanders during the pilot.
