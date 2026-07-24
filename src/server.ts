import express, { Request, Response } from 'express';
import { CitationAuditAgent } from './agent';
import { SourceOfTruthNAP } from './types/nap';
import { NAPReporter } from './reports/reporter';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Endpoint to execute NAP audit
app.post(['/api/audit', '/audit'], async (req: Request, res: Response) => {
  try {
    const { businessName, address, city, pincode, phone, category, website } = req.body;

    if (!businessName || !address || !phone) {
      return res.status(400).json({ error: 'businessName, address, and phone are required fields.' });
    }

    const sourceNAP: SourceOfTruthNAP = {
      businessName,
      address,
      city: city || 'Bengaluru',
      pincode: pincode || '',
      phone,
      category: category || 'Dental Clinic',
      website: website || ''
    };

    console.log(`\n🚀 Web API Request: Starting audit for "${businessName}"...`);
    const agent = new CitationAuditAgent();
    const report = await agent.runAudit(sourceNAP);
    const markdownReport = NAPReporter.generateMarkdownReport(report);

    return res.json({
      success: true,
      report,
      markdownReport
    });
  } catch (error: any) {
    console.error('Audit execution error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Health check endpoint
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the Single Page Suite & Audit Dashboard
const getDashboardHTML = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Suite | Agency Operations & Audit Command Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 50% -10%, #1e1b4b 0%, #0f172a 60%, #090d16 100%);
      --card-bg: rgba(30, 41, 59, 0.65);
      --card-border: rgba(255, 255, 255, 0.1);
      --card-border-hover: rgba(99, 102, 241, 0.4);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #10b981;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --consistent: #10b981;
      --drift: #f59e0b;
      --inconsistent: #ef4444;
      --notfound: #6b7280;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      padding-bottom: 3rem;
    }

    /* Top Navbar */
    .navbar {
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-main);
      text-decoration: none;
      cursor: pointer;
    }

    .nav-brand span {
      background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--accent);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background-color: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--accent);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }

    .btn-back-nav {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }

    .btn-back-nav:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .container {
      max-width: 1200px;
      margin: 2rem auto 0;
      padding: 0 1.5rem;
    }

    /* Main Dashboard Header */
    .hero-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .hero-header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.8rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 40%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
    }

    .hero-header p {
      color: var(--text-muted);
      font-size: 1.1rem;
      max-width: 650px;
      margin: 0 auto 1.5rem;
      line-height: 1.6;
    }

    .hero-stats {
      display: inline-flex;
      gap: 1.5rem;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      padding: 0.6rem 1.5rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .hero-stats span strong {
      color: #fff;
    }

    /* Suite Modules Grid */
    .suite-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 1.75rem;
    }

    .module-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .module-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: transparent;
      transition: background 0.3s ease;
    }

    .module-card.active-module::before {
      background: linear-gradient(90deg, #6366f1, #10b981);
    }

    .module-card:hover {
      transform: translateY(-5px);
      border-color: var(--card-border-hover);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(99, 102, 241, 0.15);
    }

    .card-top {
      margin-bottom: 1.5rem;
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }

    .icon-box {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
    }

    .icon-box.disabled {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
      color: #64748b;
    }

    .status-badge-pill {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-badge-pill.status-active {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-badge-pill.status-coming {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .module-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 0.6rem;
      color: #fff;
    }

    .module-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.55;
    }

    .module-footer {
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .btn-launch {
      width: 100%;
      background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      padding: 0.85rem 1.25rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
    }

    .btn-launch:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      transform: scale(1.02);
      box-shadow: 0 12px 25px rgba(99, 102, 241, 0.45);
    }

    .btn-coming-soon {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      color: #64748b;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.85rem 1.25rem;
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      cursor: not-allowed;
      text-align: center;
    }

    /* Views visibility */
    #mainDashboardView { display: block; }
    #napAuditView { display: none; }

    /* Audit Form & Card Styles */
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      margin-bottom: 2rem;
    }

    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #fff;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-group input {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }

    .btn-submit {
      width: 100%;
      background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      margin-top: 1.5rem;
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
    }

    .btn-submit:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
    }

    /* Loading State */
    .loading-state {
      display: none;
      text-align: center;
      padding: 4rem 2rem;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Results Dashboard */
    .results-container {
      display: none;
    }

    .score-banner {
      display: flex;
      align-items: center;
      gap: 2.5rem;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: conic-gradient(var(--accent) calc(var(--score) * 1%), rgba(255, 255, 255, 0.1) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .score-circle-inner {
      width: 82px;
      height: 82px;
      background: #0f172a;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .score-num {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: #fff;
    }

    .score-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      flex: 1;
    }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .hero-header h1 { font-size: 2.1rem; }
    }

    .stat-box {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
    }

    .stat-val {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem;
      font-weight: 800;
      color: #fff;
    }

    .stat-title {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .dir-card {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .dir-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .dir-name {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
    }

    .badge-CONSISTENT { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .badge-DRIFT { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge-INCONSISTENT { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .badge-NOT_FOUND { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }

    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      margin-top: 0.5rem;
    }

    .diff-table th, .diff-table td {
      padding: 0.6rem 0.8rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .diff-table th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .match-icon { font-weight: 700; }
    .match-EXACT { color: #34d399; }
    .match-DRIFT { color: #fbbf24; }
    .match-MISMATCH { color: #f87171; }
    .match-MISSING { color: #9ca3af; }

    .action-row {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  </style>
</head>
<body>

  <!-- Top Navigation Bar -->
  <nav class="navbar">
    <div class="nav-brand" onclick="showMainDashboard()">
      <span>⚡ Nexus Suite</span> Command Center
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <button class="btn-back-nav" id="btnBackToDashboard" onclick="showMainDashboard()">
        ← Back to Main Dashboard
      </button>
      <div class="nav-status">
        <div class="status-dot"></div>
        System Online
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- VIEW 1: Main Suite Dashboard -->
    <div id="mainDashboardView">
      <div class="hero-header">
        <h1>Agency Operations & Audit Suite</h1>
        <p>100% Self-Hosted Automated Directory Scrapers, Technical Audits, Quotes, Invoicing & Business Intelligence Suite.</p>
        <div class="hero-stats">
          <span>Active Tools: <strong>1 Online</strong></span>
          <span>Scraper Engine: <strong>Chromium Playwright</strong></span>
          <span>SaaS Costs: <strong>$0 / month</strong></span>
        </div>
      </div>

      <div class="suite-grid">

        <!-- Module 1: Local Citation & NAP Audit (ACTIVE) -->
        <div class="module-card active-module">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box">📍</div>
              <span class="status-badge-pill status-active">● Active Tool</span>
            </div>
            <h3 class="module-title">Local Citation & NAP Audit</h3>
            <p class="module-desc">Scrape major Indian business directories (Justdial, Practo, Sulekha, Google) to detect NAP (Name, Address, Phone) drifts & inconsistent citations.</p>
          </div>
          <div class="module-footer">
            <button class="btn-launch" onclick="openNapAudit()">
              <span>🚀 Launch Local Citation & NAP Audit</span>
            </button>
          </div>
        </div>

        <!-- Module 2: Express Audit (Coming Soon) -->
        <div class="module-card">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box disabled">⚡</div>
              <span class="status-badge-pill status-coming">⏳ Coming Soon</span>
            </div>
            <h3 class="module-title">Express Audit</h3>
            <p class="module-desc">Lightning-fast 60-second snapshot analysis of website Core Web Vitals, Google Business Profile index status, and basic SEO meta tags.</p>
          </div>
          <div class="module-footer">
            <button class="btn-coming-soon" disabled>Coming Soon</button>
          </div>
        </div>

        <!-- Module 3: Deep Audit (Coming Soon) -->
        <div class="module-card">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box disabled">🔬</div>
              <span class="status-badge-pill status-coming">⏳ Coming Soon</span>
            </div>
            <h3 class="module-title">Deep Technical Audit</h3>
            <p class="module-desc">Multi-page website crawler to audit page speed, broken links, Schema structured data, duplicate content, and backlink authority.</p>
          </div>
          <div class="module-footer">
            <button class="btn-coming-soon" disabled>Coming Soon</button>
          </div>
        </div>

        <!-- Module 4: Quotes & Proposals (Coming Soon) -->
        <div class="module-card">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box disabled">📝</div>
              <span class="status-badge-pill status-coming">⏳ Coming Soon</span>
            </div>
            <h3 class="module-title">Quotes & Proposals</h3>
            <p class="module-desc">Generate client-ready SEO proposals, customizable service quotes, scopes of work, and downloadable client agreement PDFs.</p>
          </div>
          <div class="module-footer">
            <button class="btn-coming-soon" disabled>Coming Soon</button>
          </div>
        </div>

        <!-- Module 5: Invoices & Billing (Coming Soon) -->
        <div class="module-card">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box disabled">💳</div>
              <span class="status-badge-pill status-coming">⏳ Coming Soon</span>
            </div>
            <h3 class="module-title">Invoices & Retainers</h3>
            <p class="module-desc">Manage recurring client retainers, track invoice payment statuses, automated reminder triggers, and tax summary statements.</p>
          </div>
          <div class="module-footer">
            <button class="btn-coming-soon" disabled>Coming Soon</button>
          </div>
        </div>

        <!-- Module 6: Executive Client Reports (Coming Soon) -->
        <div class="module-card">
          <div class="card-top">
            <div class="card-header-row">
              <div class="icon-box disabled">📊</div>
              <span class="status-badge-pill status-coming">⏳ Coming Soon</span>
            </div>
            <h3 class="module-title">Executive Reports</h3>
            <p class="module-desc">Consolidate client audit metrics, historical NAP score improvements, and white-labeled PDF performance benchmarks.</p>
          </div>
          <div class="module-footer">
            <button class="btn-coming-soon" disabled>Coming Soon</button>
          </div>
        </div>

      </div>
    </div>


    <!-- VIEW 2: Local Citation & NAP Audit Tool -->
    <div id="napAuditView">

      <!-- Input Form Card -->
      <div class="card" id="formCard">
        <div class="card-title">📍 Business Source-of-Truth Details</div>
        <form id="auditForm">
          <div class="grid-2">
            <div class="form-group">
              <label>Business Name *</label>
              <input type="text" id="businessName" value="Nissa Dental Clinic & Implant Center" required>
            </div>
            <div class="form-group">
              <label>Category</label>
              <input type="text" id="category" value="Dental Clinic">
            </div>
            <div class="form-group">
              <label>Street Address *</label>
              <input type="text" id="address" value="No. 45, 100 Feet Road, 4th Block, Koramangala" required>
            </div>
            <div class="form-group">
              <label>City *</label>
              <input type="text" id="city" value="Bengaluru" required>
            </div>
            <div class="form-group">
              <label>Pincode</label>
              <input type="text" id="pincode" value="560034">
            </div>
            <div class="form-group">
              <label>Phone Number *</label>
              <input type="text" id="phone" value="08098765432" required>
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
              <label>Website URL</label>
              <input type="url" id="website" value="https://nissadental.com">
            </div>
          </div>
          <button type="submit" class="btn-submit" id="submitBtn">
            <span>🔍 Run Comprehensive NAP Audit</span>
          </button>
        </form>
      </div>

      <!-- Loading State -->
      <div class="card loading-state" id="loadingState">
        <div class="spinner"></div>
        <h3 style="font-family: 'Outfit'; font-size: 1.4rem; margin-bottom: 0.5rem; color: #fff;">Auditing Local Directories...</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem;">Scanning Justdial, Practo, Sulekha, and Google Business Profile in real-time.</p>
      </div>

      <!-- Results Dashboard -->
      <div class="results-container" id="resultsContainer">
        <div class="card">
          <div class="score-banner">
            <div class="score-circle" id="scoreCircle" style="--score: 85;">
              <div class="score-circle-inner">
                <span class="score-num" id="scoreValue">85%</span>
                <span class="score-label">NAP Score</span>
              </div>
            </div>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-val" id="statChecked">0</div>
                <div class="stat-title">Directories Checked</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color: var(--consistent);" id="statConsistent">0</div>
                <div class="stat-title">Consistent</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color: var(--drift);" id="statInconsistent">0</div>
                <div class="stat-title">Drift / Inconsistent</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color: var(--notfound);" id="statMissing">0</div>
                <div class="stat-title">Not Found</div>
              </div>
            </div>
          </div>

          <div class="card-title">📊 Directory Audit Breakdown</div>
          <div id="directoryCardsList"></div>

          <div class="action-row">
            <button class="btn-secondary" onclick="copyMarkdownReport()">📋 Copy Markdown Report</button>
            <button class="btn-secondary" onclick="downloadJSONReport()">💾 Export JSON</button>
            <button class="btn-secondary" onclick="resetForm()" style="margin-left: auto;">🔄 Audit Another Business</button>
          </div>
        </div>
      </div>

    </div>

  </div>

<script>
let lastReportData = null;
let lastMarkdownReport = '';

function openNapAudit() {
  document.getElementById('mainDashboardView').style.display = 'none';
  document.getElementById('napAuditView').style.display = 'block';
  document.getElementById('btnBackToDashboard').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMainDashboard() {
  document.getElementById('napAuditView').style.display = 'none';
  document.getElementById('mainDashboardView').style.display = 'block';
  document.getElementById('btnBackToDashboard').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('auditForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    businessName: document.getElementById('businessName').value,
    category: document.getElementById('category').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    pincode: document.getElementById('pincode').value,
    phone: document.getElementById('phone').value,
    website: document.getElementById('website').value
  };

  document.getElementById('formCard').style.display = 'none';
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('resultsContainer').style.display = 'none';

  try {
    const resp = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await resp.json();
    if (!result.success) {
      alert('Audit error: ' + (result.error || 'Unknown error'));
      resetForm();
      return;
    }

    lastReportData = result.report;
    lastMarkdownReport = result.markdownReport;
    renderResults(result.report);

  } catch (err) {
    alert('Failed to execute audit: ' + err.message);
    resetForm();
  }
});

function renderResults(report) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsContainer').style.display = 'block';

  const score = report.auditScore;
  document.getElementById('scoreValue').textContent = score + '%';
  document.getElementById('scoreCircle').style.setProperty('--score', score);

  document.getElementById('statChecked').textContent = report.totalDirectoriesChecked;
  document.getElementById('statConsistent').textContent = report.consistentCount;
  document.getElementById('statInconsistent').textContent = report.inconsistentCount;
  document.getElementById('statMissing').textContent = report.missingCount;

  const listEl = document.getElementById('directoryCardsList');
  listEl.innerHTML = '';

  report.results.forEach(res => {
    const card = document.createElement('div');
    card.className = 'dir-card';

    let diffRows = '';
    if (res.diffs && res.diffs.length > 0) {
      res.diffs.forEach(d => {
        const fieldNameStr = d.fieldName || d.field || 'field';
        const sourceVal = d.sourceValue !== undefined ? d.sourceValue : (d.expectedValue || '');
        const foundVal = d.foundValue !== undefined ? d.foundValue : (d.actualValue || '');
        const matchSymbol = d.matchStatus === 'EXACT' ? '✓' : (d.matchStatus === 'DRIFT' ? '⚠' : '✗');
        diffRows += '<tr>' +
          '<td><strong>' + fieldNameStr.toUpperCase() + '</strong></td>' +
          '<td>' + (sourceVal || '<em style="color:#64748b">None</em>') + '</td>' +
          '<td>' + (foundVal || '<em style="color:#64748b">Not Listed</em>') + '</td>' +
          '<td class="match-icon match-' + d.matchStatus + '">' + matchSymbol + ' ' + d.matchStatus + '</td>' +
        '</tr>';
      });
    }

    var errHtml = res.errorMessage ? ('<p style="color:#f87171; font-size:0.85rem;">Error: ' + res.errorMessage + '</p>') : '';
    var tableHtml = diffRows ? ('<table class="diff-table"><thead><tr><th>Field</th><th>Source of Truth</th><th>Listed Value</th><th>Match</th></tr></thead><tbody>' + diffRows + '</tbody></table>') : '<p style="color:var(--text-muted); font-size:0.85rem;">No profile listing found on this directory.</p>';
    card.innerHTML = '<div class="dir-header"><span class="dir-name">' + res.directoryName + '</span><span class="status-badge badge-' + res.status + '">' + res.status + ' (' + res.overallConfidence + '% Match)</span></div>' + errHtml + tableHtml;

    listEl.appendChild(card);
  });
}

function resetForm() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsContainer').style.display = 'none';
  document.getElementById('formCard').style.display = 'block';
}

function copyMarkdownReport() {
  if (lastMarkdownReport) {
    navigator.clipboard.writeText(lastMarkdownReport);
    alert('Markdown report copied to clipboard!');
  }
}

function downloadJSONReport() {
  if (lastReportData) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lastReportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", 'nap-audit-' + (lastReportData.businessInfo.businessName || 'report').replace(/\\s+/g, '-') + '.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }
}
</script>

</body>
</html>`;

app.get('*', (req: Request, res: Response) => {
  res.send(getDashboardHTML());
});

if (!process.env.VERCEL && !process.env.NOW_REGION) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🌐 Nexus Suite Command Center is running!`);
    console.log(`📍 Main Dashboard: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

export default app;
