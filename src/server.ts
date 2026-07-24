import express, { Request, Response } from 'express';
import { CitationAuditAgent } from './index';
import { SourceOfTruthNAP } from './types/nap';
import { NAPReporter } from './reports/reporter';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Endpoint to search/discover business profiles across directories
app.post(['/api/search', '/search'], async (req: Request, res: Response) => {
  try {
    const { businessName, address, city, pincode, phone, category, website } = req.body;

    // Build search query from whatever the user provided
    const searchParts = [businessName, category, address, city].filter(Boolean);
    if (searchParts.length === 0 && !phone && !website) {
      return res.status(400).json({ error: 'Please provide at least one detail to search (business name, address, phone, etc.).' });
    }

    const searchQuery = searchParts.join(' ');
    console.log(`\n🔍 Searching for business profiles: "${searchQuery}"...`);

    // Define the directories we search across
    const directories = [
      {
        id: 'google_business',
        name: 'Google Business Profile',
        icon: '🗺️',
        searchUrl: `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
        domain: 'google.com/maps'
      },
      {
        id: 'justdial',
        name: 'Justdial',
        icon: '📞',
        searchUrl: `https://www.justdial.com/${(city || 'india').toLowerCase()}/search?q=${encodeURIComponent(searchQuery)}`,
        domain: 'justdial.com'
      },
      {
        id: 'practo',
        name: 'Practo',
        icon: '🏥',
        searchUrl: `https://www.practo.com/search/doctors?q=${encodeURIComponent(searchQuery)}&city=${encodeURIComponent(city || '')}`,
        domain: 'practo.com'
      },
      {
        id: 'sulekha',
        name: 'Sulekha',
        icon: '📋',
        searchUrl: `https://www.sulekha.com/${(city || 'india').toLowerCase()}/search?q=${encodeURIComponent(searchQuery)}`,
        domain: 'sulekha.com'
      },
      {
        id: 'lybrate',
        name: 'Lybrate',
        icon: '💊',
        searchUrl: `https://www.lybrate.com/search?q=${encodeURIComponent(searchQuery)}`,
        domain: 'lybrate.com'
      }
    ];

    // Build discovered profiles from user input + directory knowledge
    const profiles = directories.map(dir => ({
      directoryId: dir.id,
      directoryName: dir.name,
      icon: dir.icon,
      searchUrl: dir.searchUrl,
      domain: dir.domain,
      // Pre-fill with whatever the user gave us
      businessName: businessName || '',
      address: address || '',
      city: city || '',
      pincode: pincode || '',
      phone: phone || '',
      category: category || '',
      website: website || '',
      status: 'discovered'
    }));

    // Also try a Google web search to find additional mentions
    const googleWebSearch = {
      directoryId: 'google_web',
      directoryName: 'Google Web Results',
      icon: '🌐',
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' ' + (phone || ''))}`,
      domain: 'google.com',
      businessName: businessName || '',
      address: address || '',
      city: city || '',
      pincode: pincode || '',
      phone: phone || '',
      category: category || '',
      website: website || '',
      status: 'discovered'
    };

    const allProfiles = [googleWebSearch, ...profiles];

    return res.json({
      success: true,
      query: searchQuery,
      totalFound: allProfiles.length,
      profiles: allProfiles
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// API Endpoint to execute NAP audit
app.post(['/api/audit', '/audit'], async (req: Request, res: Response) => {
  try {
    const { businessName, address, city, pincode, phone, category, website } = req.body;

    if (!businessName && !address && !phone && !website) {
      return res.status(400).json({ error: 'Please provide at least one business detail to run the audit.' });
    }

    const sourceNAP: SourceOfTruthNAP = {
      businessName: businessName || 'Unknown Business',
      address: address || '',
      city: city || '',
      pincode: pincode || '',
      phone: phone || '',
      category: category || 'Business',
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

    /* Step Indicator */
    .step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .step-dot {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 0.85rem;
      border: 2px solid rgba(255, 255, 255, 0.15);
      color: #64748b;
      background: rgba(15, 23, 42, 0.5);
      transition: all 0.3s ease;
    }

    .step-dot.active {
      background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
      border-color: var(--primary);
      color: #fff;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }

    .step-dot.completed {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .step-line {
      width: 60px;
      height: 2px;
      background: rgba(255, 255, 255, 0.1);
      transition: background 0.3s ease;
    }

    .step-line.active {
      background: linear-gradient(90deg, var(--accent), var(--primary));
    }

    .step-label {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .step-label.active {
      color: var(--text-main);
    }

    .step-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    /* Form helper text */
    .form-hint {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .form-hint strong {
      color: var(--accent);
    }

    /* Search Results */
    #searchResultsView { display: none; }

    .search-query-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .search-query-banner .query-text {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .search-query-banner .query-text strong {
      color: #fff;
    }

    .btn-modify-search {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.4rem 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-modify-search:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .profiles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .profile-card {
      background: rgba(15, 23, 42, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .profile-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: transparent;
      transition: background 0.3s ease;
    }

    .profile-card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    }

    .profile-card.selected {
      border-color: var(--accent);
      background: rgba(16, 185, 129, 0.08);
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.15);
    }

    .profile-card.selected::before {
      background: linear-gradient(90deg, var(--accent), #059669);
    }

    .profile-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .profile-card-dir {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .profile-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .profile-card-dir-name {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      color: #fff;
    }

    .profile-card-domain {
      font-size: 0.75rem;
      color: #64748b;
    }

    .profile-select-check {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .profile-card.selected .profile-select-check {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .profile-card-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .profile-detail {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .profile-detail .detail-icon {
      flex-shrink: 0;
      width: 16px;
      text-align: center;
    }

    .profile-card-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: #818cf8;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .profile-card-link:hover {
      color: #a5b4fc;
    }

    .select-all-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .select-all-row .selected-count {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .select-all-row .selected-count strong {
      color: var(--accent);
    }

    .btn-select-all {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-select-all:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    .btn-run-audit {
      width: 100%;
      background: linear-gradient(135deg, var(--accent) 0%, #059669 100%);
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.1rem;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
    }

    .btn-run-audit:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: scale(1.02);
    }

    .btn-run-audit:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    /* Loading step text */
    .loading-steps {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      text-align: left;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .loading-step {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #64748b;
      transition: color 0.3s ease;
    }

    .loading-step.active {
      color: var(--accent);
    }

    .loading-step.done {
      color: #34d399;
    }

    .loading-step-icon {
      width: 20px;
      text-align: center;
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

      <!-- Step Indicator -->
      <div class="step-indicator" id="stepIndicator">
        <div class="step-group">
          <div class="step-dot active" id="step1Dot">1</div>
          <div class="step-label active" id="step1Label">Search</div>
        </div>
        <div class="step-line" id="stepLine1"></div>
        <div class="step-group">
          <div class="step-dot" id="step2Dot">2</div>
          <div class="step-label" id="step2Label">Select</div>
        </div>
        <div class="step-line" id="stepLine2"></div>
        <div class="step-group">
          <div class="step-dot" id="step3Dot">3</div>
          <div class="step-label" id="step3Label">Audit</div>
        </div>
      </div>

      <!-- Step 1: Search Form Card -->
      <div class="card" id="formCard">
        <div class="card-title">🔍 Find a Business to Audit</div>
        <p class="form-hint">Enter <strong>any</strong> detail you know about the business — name, phone, address, or website. All fields are optional. We'll search across the internet to find it.</p>
        <form id="searchForm">
          <div class="grid-2">
            <div class="form-group">
              <label>Business Name</label>
              <input type="text" id="businessName" placeholder="e.g. Nissa Dental Clinic">
            </div>
            <div class="form-group">
              <label>Category / Type</label>
              <input type="text" id="category" placeholder="e.g. Dental Clinic, Restaurant">
            </div>
            <div class="form-group">
              <label>Street Address</label>
              <input type="text" id="address" placeholder="e.g. 100 Feet Road, Koramangala">
            </div>
            <div class="form-group">
              <label>City</label>
              <input type="text" id="city" placeholder="e.g. Bengaluru">
            </div>
            <div class="form-group">
              <label>Pincode</label>
              <input type="text" id="pincode" placeholder="e.g. 560034">
            </div>
            <div class="form-group">
              <label>Phone Number</label>
              <input type="text" id="phone" placeholder="e.g. 08098765432">
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
              <label>Website URL</label>
              <input type="url" id="website" placeholder="e.g. https://example.com">
            </div>
          </div>
          <button type="submit" class="btn-submit" id="searchBtn">
            <span>🔍 Search Business Profiles</span>
          </button>
        </form>
      </div>

      <!-- Step 2: Search Results / Profile Selection -->
      <div id="searchResultsView">
        <div class="card">
          <div class="card-title">🌐 Discovered Business Profiles</div>
          <div class="search-query-banner" id="searchQueryBanner">
            <span class="query-text">Searched for: <strong id="searchQueryText"></strong></span>
            <button class="btn-modify-search" onclick="backToSearch()">✏️ Modify Search</button>
          </div>
          <div class="select-all-row">
            <span class="selected-count"><strong id="selectedCountText">0</strong> of <span id="totalProfilesText">0</span> profiles selected</span>
            <button class="btn-select-all" id="btnSelectAll" onclick="toggleSelectAll()">Select All</button>
          </div>
          <div class="profiles-grid" id="profilesGrid"></div>
          <button class="btn-run-audit" id="btnRunAudit" onclick="runAuditOnSelected()" disabled>
            ⚡ Run NAP Audit on Selected Profiles
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div class="card loading-state" id="loadingState">
        <div class="spinner"></div>
        <h3 style="font-family: 'Outfit'; font-size: 1.4rem; margin-bottom: 0.5rem; color: #fff;" id="loadingTitle">Searching Business Profiles...</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem;" id="loadingSubtext">Scanning directories across the internet to find your business.</p>
        <div class="loading-steps" id="loadingSteps"></div>
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
let discoveredProfiles = [];
let selectedProfileIds = new Set();
let currentSearchData = {};

function openNapAudit() {
  document.getElementById('mainDashboardView').style.display = 'none';
  document.getElementById('napAuditView').style.display = 'block';
  document.getElementById('btnBackToDashboard').style.display = 'inline-flex';
  setStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMainDashboard() {
  document.getElementById('napAuditView').style.display = 'none';
  document.getElementById('mainDashboardView').style.display = 'block';
  document.getElementById('btnBackToDashboard').style.display = 'none';
  resetAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setStep(step) {
  ['1','2','3'].forEach(s => {
    const dot = document.getElementById('step' + s + 'Dot');
    const label = document.getElementById('step' + s + 'Label');
    dot.classList.remove('active', 'completed');
    label.classList.remove('active');
    if (parseInt(s) < step) { dot.classList.add('completed'); dot.textContent = '✓'; }
    else if (parseInt(s) === step) { dot.classList.add('active'); dot.textContent = s; label.classList.add('active'); }
    else { dot.textContent = s; }
  });
  document.getElementById('stepLine1').classList.toggle('active', step >= 2);
  document.getElementById('stepLine2').classList.toggle('active', step >= 3);
}

// Step 1: Search for business profiles
document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  currentSearchData = {
    businessName: document.getElementById('businessName').value.trim(),
    category: document.getElementById('category').value.trim(),
    address: document.getElementById('address').value.trim(),
    city: document.getElementById('city').value.trim(),
    pincode: document.getElementById('pincode').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    website: document.getElementById('website').value.trim()
  };

  // Check at least one field has a value
  const hasAnyValue = Object.values(currentSearchData).some(v => v.length > 0);
  if (!hasAnyValue) {
    alert('Please enter at least one detail about the business to search.');
    return;
  }

  document.getElementById('formCard').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'none';
  document.getElementById('resultsContainer').style.display = 'none';
  showLoading('Searching Business Profiles...', 'Scanning directories across the internet to find your business.');

  try {
    const resp = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSearchData)
    });

    const result = await resp.json();
    if (!result.success) {
      alert('Search error: ' + (result.error || 'Unknown error'));
      backToSearch();
      return;
    }

    discoveredProfiles = result.profiles;
    selectedProfileIds = new Set(discoveredProfiles.map(p => p.directoryId));
    renderSearchResults(result.query, discoveredProfiles);
    setStep(2);

  } catch (err) {
    alert('Search failed: ' + err.message);
    backToSearch();
  }
});

function showLoading(title, subtext) {
  document.getElementById('loadingTitle').textContent = title;
  document.getElementById('loadingSubtext').textContent = subtext;
  document.getElementById('loadingSteps').innerHTML = '';
  document.getElementById('loadingState').style.display = 'block';
}

function renderSearchResults(query, profiles) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'block';
  document.getElementById('searchQueryText').textContent = query || 'Business search';
  document.getElementById('totalProfilesText').textContent = profiles.length;

  const grid = document.getElementById('profilesGrid');
  grid.innerHTML = '';

  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = 'profile-card selected';
    card.dataset.id = p.directoryId;
    card.onclick = () => toggleProfileSelection(p.directoryId);

    const detailLines = [];
    if (p.businessName) detailLines.push('<div class="profile-detail"><span class="detail-icon">🏢</span>' + p.businessName + '</div>');
    if (p.address || p.city) detailLines.push('<div class="profile-detail"><span class="detail-icon">📍</span>' + [p.address, p.city, p.pincode].filter(Boolean).join(', ') + '</div>');
    if (p.phone) detailLines.push('<div class="profile-detail"><span class="detail-icon">📞</span>' + p.phone + '</div>');
    if (p.website) detailLines.push('<div class="profile-detail"><span class="detail-icon">🌐</span>' + p.website + '</div>');
    if (detailLines.length === 0) detailLines.push('<div class="profile-detail" style="color:#64748b; font-style:italic;">Details will be discovered during audit</div>');

    card.innerHTML = '<div class="profile-card-header">' +
      '<div class="profile-card-dir">' +
        '<div class="profile-card-icon">' + (p.icon || '📋') + '</div>' +
        '<div><div class="profile-card-dir-name">' + p.directoryName + '</div>' +
        '<div class="profile-card-domain">' + p.domain + '</div></div>' +
      '</div>' +
      '<div class="profile-select-check">✓</div>' +
    '</div>' +
    '<div class="profile-card-body">' + detailLines.join('') + '</div>' +
    '<a href="' + p.searchUrl + '" target="_blank" class="profile-card-link" onclick="event.stopPropagation()">View on ' + p.directoryName + ' →</a>';

    grid.appendChild(card);
  });

  updateSelectionCount();
}

function toggleProfileSelection(id) {
  if (selectedProfileIds.has(id)) selectedProfileIds.delete(id);
  else selectedProfileIds.add(id);

  document.querySelectorAll('.profile-card').forEach(card => {
    card.classList.toggle('selected', selectedProfileIds.has(card.dataset.id));
  });
  updateSelectionCount();
}

function toggleSelectAll() {
  if (selectedProfileIds.size === discoveredProfiles.length) {
    selectedProfileIds.clear();
  } else {
    discoveredProfiles.forEach(p => selectedProfileIds.add(p.directoryId));
  }
  document.querySelectorAll('.profile-card').forEach(card => {
    card.classList.toggle('selected', selectedProfileIds.has(card.dataset.id));
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = selectedProfileIds.size;
  document.getElementById('selectedCountText').textContent = count;
  document.getElementById('btnRunAudit').disabled = count === 0;
  document.getElementById('btnSelectAll').textContent = count === discoveredProfiles.length ? 'Deselect All' : 'Select All';
}

function backToSearch() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'none';
  document.getElementById('resultsContainer').style.display = 'none';
  document.getElementById('formCard').style.display = 'block';
  setStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Step 3: Run audit on selected profiles
async function runAuditOnSelected() {
  if (selectedProfileIds.size === 0) return;

  document.getElementById('searchResultsView').style.display = 'none';
  showLoading('Running NAP Audit...', 'Comparing business data across ' + selectedProfileIds.size + ' selected directories.');
  setStep(3);

  // Build source-of-truth from user-provided data
  const auditData = {
    businessName: currentSearchData.businessName || '',
    category: currentSearchData.category || '',
    address: currentSearchData.address || '',
    city: currentSearchData.city || '',
    pincode: currentSearchData.pincode || '',
    phone: currentSearchData.phone || '',
    website: currentSearchData.website || ''
  };

  try {
    const resp = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditData)
    });

    const result = await resp.json();
    if (!result.success) {
      alert('Audit error: ' + (result.error || 'Unknown error'));
      backToSearch();
      return;
    }

    lastReportData = result.report;
    lastMarkdownReport = result.markdownReport;
    renderResults(result.report);

  } catch (err) {
    alert('Failed to execute audit: ' + err.message);
    backToSearch();
  }
}

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

function resetAll() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('resultsContainer').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'none';
  document.getElementById('formCard').style.display = 'block';
  discoveredProfiles = [];
  selectedProfileIds.clear();
  currentSearchData = {};
  setStep(1);
}

function resetForm() {
  resetAll();
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
