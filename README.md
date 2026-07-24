# 100% Self-Hosted Cloud Citation & NAP Audit Agent

A production-grade, 100% self-hosted Local Citation & NAP Audit worker service built in Node.js, TypeScript, and Playwright. Operates with zero third-party browser SaaS subscriptions (no Browserless/Apify/ZenRows).

## 100% Self-Hosted Architecture

```
[ Next.js CRM on Vercel ]
        │
        ▼ (Inserts audit job)
[ Supabase Cloud DB ]
        │
        ▼ (Worker polls/processes job)
[ Self-Hosted Container Worker ] ─── Built-in Chromium ───▶ [ Justdial / Practo / GBP / Sulekha ]
  (Docker / Railway / Render)
        │
        ▼ (Writes NAPAuditReport JSON)
[ Supabase Cloud DB ] ───▶ Realtime Update ───▶ [ Next.js UI ]
```

---

## Key Features

1. **Zero External SaaS Dependencies**: Runs bundled Playwright Chromium inside the worker container using `mcr.microsoft.com/playwright:v1.42.0-jammy`.
2. **Supabase Cloud Job Queue**: Communicates seamlessly with your `dental-leads-crm` database for asynchronous background audits.
3. **Smart Indian Address & Phone Normalization**: Strips `+91`, handles STD prefixes, and standardizes local area aliases (`Bengaluru`/`Bangalore`, `HSR`, `Koramangala`, `Rd`/`Road`).
4. **Field-Level Diffing**: Generates exact match confidence scores (`CONSISTENT`, `DRIFT`, `INCONSISTENT`, `NOT_FOUND`).

---

## Deployment (Railway / Render / Fly.io / Docker)

### Option A: 1-Click Docker Container Deployment
Deploy directly using the provided `Dockerfile`.

1. Point your Railway/Render service to repository root `/citation-audit-agent`.
2. Set Environment Variables:
   - `SUPABASE_URL=https://<your-project>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<your-key>`
   - `HEADLESS=true`

### Option B: Local CLI Testing
```bash
cd citation-audit-agent
npm install
npx playwright install chromium
npm start
```
