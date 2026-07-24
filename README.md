# 100% Self-Hosted Local Citation & NAP Audit Suite

A production-grade, 100% self-hosted Local Citation & NAP Audit web dashboard and worker service built in Node.js, TypeScript, Express, and Playwright. Operates with zero third-party browser SaaS subscriptions (no Browserless/Apify/ZenRows).

---

## 🏗️ Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │   Interactive Web Dashboard (Built-in UI)    │
                               │   - Form to enter business details           │
                               │   - Real-time audit progress & score card    │
                               │   - Export Markdown / JSON reports           │
                               └──────────────────────┬───────────────────────┘
                                                      │ (Triggers audit)
                                                      ▼
 ┌──────────────────────┐  (Optional DB Queue)  ┌──────────────────────────────┐
 │ Next.js CRM (Vercel) ├──────────────────────▶│  Self-Hosted Container App   │──▶ Playwright Chromium ──▶ [ Justdial / Practo / GBP / Sulekha ]
 └──────────────────────┘                       │  (Railway / Render / Docker) │
                                                └──────────────────────────────┘
```

---

## ✨ Key Features

1. **Integrated Web Dashboard**: Clean, responsive UI served on Port `3000` to enter business details (Name, Address, City, Pincode, Phone, Website) and get live audit reports with field-level diffing.
2. **Zero External SaaS Dependencies**: Runs bundled Playwright Chromium inside the worker container using `mcr.microsoft.com/playwright:v1.42.0-jammy`.
3. **Smart Indian Address & Phone Normalization**: Strips `+91`, handles STD prefixes, and standardizes local area aliases (`Bengaluru`/`Bangalore`, `HSR`, `Koramangala`, `Rd`/`Road`).
4. **Field-Level Diffing**: Generates exact match confidence scores (`CONSISTENT`, `DRIFT`, `INCONSISTENT`, `NOT_FOUND`).
5. **Supabase Integration (Optional)**: Can run as an async queue worker for background processing.

---

## 🚀 Deployment (Railway / Render / Fly.io / VPS / Docker)

### Option A: 1-Click Container Deployment (Web Dashboard + Scraper)
Deploy directly using the provided `Dockerfile` to Railway, Render, Fly.io, or any VPS.

1. Connect your git repository to **Railway** or **Render**.
2. Railway/Render will automatically pick up the `Dockerfile` and build it with pre-bundled Chromium binaries.
3. Once deployed, open your generated domain (e.g. `https://citation-audit-agent.up.railway.app`) to access the web form and run audits anytime!

### Option B: Local Web Server Testing
```bash
# 1. Install dependencies
npm install

# 2. Install Playwright Chromium binaries
npx playwright install chromium

# 3. Start Web Dashboard
npm start
# Open http://localhost:3000 in your browser
```

### Option C: Async Supabase Worker Mode
To run in background polling mode for Supabase queue jobs:
```bash
npm run worker
```

---

## 📡 REST API Endpoint

### `POST /api/audit`
Triggers an automated NAP audit programmatically.

**Request Body:**
```json
{
  "businessName": "Nissa Dental Clinic & Implant Center",
  "address": "No. 45, 100 Feet Road, 4th Block, Koramangala",
  "city": "Bengaluru",
  "pincode": "560034",
  "phone": "08098765432",
  "category": "Dental Clinic",
  "website": "https://nissadental.com"
}
```

**Response:**
Returns complete `NAPAuditReport` object with directory scores, field diffs, and generated Markdown report.
