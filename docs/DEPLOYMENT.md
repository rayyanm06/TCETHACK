# CivicClean: Production Deployment & Operations Guide

This guide details the exact environment variables, production security configuration, database transaction requirements, and operator provisioning needed to deploy CivicClean.

---

## 1. Architecture Overview & Services

```
[ Browser / Mobile Client ]
         │ (HTTPS / WSS)
         ▼
[ Vite React Frontend ] (Port 5173 / Cloudflare Pages / Vercel)
         │ (REST API / JWT)
         ▼
[ Express Node.js Backend ] (Port 4000 / Render / Railway / EC2)
    ├── Pure Engines (Geo, Priority, Routing, Traffic, Forecast, Impact)
    ├── OSRM / Road-Network Routing Service (Local or routing.openstreetmap.de)
    ├── Cloudinary / S3-Compatible Persistent Storage (or Secure Local Disk)
    └── MongoDB Replica Set (Atlas M0/M10+ or Self-Hosted Replica Set)
```

---

## 2. Environment Variables Specification

### Backend Configuration (`backend/.env`)

| Variable Name | Required | Default / Example | Purpose / Safeguard |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Set to `production` in live environments. Disables automatic demo seeding and disables in-memory database fallback. |
| `PORT` | No | `4000` | HTTP port for the Express application. |
| `MONGODB_URI` | **Yes (in prod)** | `mongodb+srv://user:pass@cluster.mongodb.net/civicclean?retryWrites=true&w=majority` | Persistent MongoDB connection string. **Must be a replica set** (Atlas or local `rs0`) to support ACID transactions across reports, events, and ledgers. |
| `MONGODB_DB` | No | `civicclean_prod` | Target database name. |
| `JWT_SECRET` | **Yes** | `[Min 32-char cryptographically random string]` | Secret key used to sign citizen and operator authentication tokens. Never commit to source control. |
| `UPLOAD_TOKEN_SECRET` | **Yes** | `[Min 32-char cryptographically random string]` | Independent secret key used to sign upload validation tokens, binding photo evidence to its owner. |
| `CORS_ORIGIN` | **Yes** | `https://civicclean.yourdomain.com` | Exact frontend URL permitted for cross-origin requests. Disallows open wildcards in production. |
| `STORAGE_PROVIDER` | No | `cloudinary` or `local` | `cloudinary` for persistent cloud photo storage; `local` stores files in `/uploads`. |
| `CLOUDINARY_CLOUD_NAME`| If Cloudinary | `your_cloud_name` | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | If Cloudinary | `your_api_key` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | If Cloudinary | `your_api_secret` | Cloudinary API secret. |
| `VISION_PROVIDER` | No | `gemini` or `mock` | Vision AI classification provider. |
| `GEMINI_API_KEY` | If Gemini | `AIzaSy...` | Google Gemini API key for photo waste classification. |
| `ROUTING_PROVIDER` | No | `osrm` or `matrix` | OSRM road-network distance/duration provider. Fallback to Haversine speed matrix if unavailable. |
| `OSRM_BASE_URL` | No | `https://routing.openstreetmap.de/routed-car` | OSRM routing endpoint for driving durations and road geometry. |

### Frontend Configuration (`frontend/.env.production`)

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | `https://api.civicclean.yourdomain.com/api` | Base URL of the deployed CivicClean backend API. |
| `VITE_TILE_URL` | No | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | Vector or raster map tile URL for Leaflet. |
| `VITE_TILE_ATTRIBUTION`| No | `© OpenStreetMap contributors © CARTO` | Map tile attribution string. |

---

## 3. MongoDB Replica Set Requirement for Transactions

CivicClean enforces consistency across multi-document updates using MongoDB ACID transactions:
- When a report is created: `WasteEvent`, `Report`, `StatusEvent`, `ImpactTransaction`, and `UploadEvidence` must commit atomically.
- When an incident is resolved: `WasteEvent`, `Route`, `StatusEvent`, and `ImpactTransaction` commit together.
- When an incident is reopened: `WasteEvent.status`, `StatusEvent`, and `ImpactTransaction.status = 'REVOKED'` execute in a single transaction.

### Recommended: MongoDB Atlas (Free M0 or higher)
MongoDB Atlas automatically configures a 3-node replica set out of the box. Simply paste your Atlas connection string into `MONGODB_URI`.

### Self-Hosted Local Replica Set:
If running MongoDB locally via Docker:
```bash
docker run -d --name mongo-rs -p 27017:27017 mongo:7.0 --replSet rs0
docker exec -it mongo-rs mongosh --eval "rs.initiate()"
```

---

## 4. Production Safeguards Implemented in Code

1. **Fatal Database Guard (`backend/src/config/db.js`):**
   If `NODE_ENV === 'production'` and `MONGODB_URI` is unset, the server exits immediately with a fatal error. It will **never** silently fall back to an ephemeral in-memory database in production.
2. **Automatic Seeding Guard (`backend/src/server.js`):**
   Automatic demo scenario seeding runs only when `NODE_ENV !== 'production'`. Live databases are protected from accidental test overwrites.
3. **Reset Endpoint Disabled in Live Mode (`backend/src/routes/adminRoutes.js`):**
   The `/api/admin/reset` endpoint is blocked in production.
4. **Standalone Script for Initial Operator:**
   To bootstrap the first administrator without public signup or insecure defaults, run:
   ```bash
   node backend/scripts/createOperator.js --name "Operations Director" --email "director@mumbai.gov.in" --password "SecurePass2026!"
   ```

---

## 5. Deployment Commands & Verification

### Build Backend
```bash
cd backend
npm ci --production
node scripts/createOperator.js --name "Admin" --email "admin@mumbai.gov.in" --password "AdminPass2026!"
node src/server.js
```

### Build Frontend
```bash
cd frontend
npm ci
npm run build
# Deploy the generated dist/ folder to any static host (Vercel, Netlify, Cloudflare Pages, S3/CloudFront)
```

### Health & Readiness Check
```bash
curl -I https://api.civicclean.yourdomain.com/api/health
```
Expected response:
```json
{
  "ok": true,
  "status": "HEALTHY",
  "service": "CivicClean API",
  "timestamp": "2026-10-01T04:30:00.000Z"
}
```
