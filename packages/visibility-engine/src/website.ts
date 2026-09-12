import type {
  PageSpeedSummary,
  Severity,
  SignalGroup,
  WebsiteAnalysis,
  WebsiteFinding,
} from './types.ts';

/**
 * Website visibility: how findable a clinic's own site is to a search engine
 * (SEO), to an AI answer engine deciding what to cite (GEO), and to a featured
 * snippet or voice assistant extracting a direct answer (AEO).
 *
 * Pure, like `checkNmcCompliance` beside it: the worker has already fetched
 * the page for the compliance check, so this runs on bytes that are in memory
 * and costs no network call of its own.
 *
 * HTML is read with regular expressions rather than a parser because this
 * package, like nap-engine, carries zero dependencies. That is a real
 * trade-off: these are signal detectors, not a conformance checker, and they
 * are written to fail toward "passed" rather than accuse a clinic of a fault
 * it does not have. A finding here is a prompt for a human to look, never an
 * auto-published verdict.
 */

interface PageView {
  html: string;
  text: string;
  title: string | null;
  metaDescription: string | null;
  robots: string | null;
  canonical: string | null;
  viewport: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  h1s: string[];
  headings: string[];
  jsonLd: unknown[];
  jsonLdTypes: string[];
  images: { hasAlt: boolean }[];
  wordCount: number;
  links: { href: string; text: string }[];
}

interface Check {
  group: SignalGroup;
  /** Relative weight inside its group. */
  weight: number;
  severity: Severity;
  /** A failure that is a real fault, versus one that is only a missed gain. */
  failKind: 'issue' | 'opportunity';
  passLabel: string;
  failLabel: string;
  remediation: string;
  /**
   * true  -> passed
   * string -> passed, with evidence to show the client
   * false -> failed
   * null  -> not applicable to this run, excluded from the denominator
   */
  run(page: PageView, psi: PageSpeedSummary | null): boolean | string | null;
}

const QUESTION_WORDS = /^(how|what|why|when|where|who|which|can|is|are|do|does|should|will)\b/i;

const CHECKS: Check[] = [
  // ---------------------------------------------------------------- SEO ----
  {
    group: 'seo', weight: 3, severity: 'high', failKind: 'issue',
    passLabel: 'Page title present',
    failLabel: 'No page title',
    remediation: 'Add a <title> naming the practice and the city, e.g. "Smile Dental Clinic — Koramangala, Bengaluru".',
    run: (p) => (p.title ? p.title : false),
  },
  {
    group: 'seo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Page title is a usable length',
    failLabel: 'Page title is too short or will be truncated in results',
    remediation: 'Aim for roughly 30–60 characters so Google shows the whole thing.',
    run: (p) => (p.title ? p.title.length >= 30 && p.title.length <= 60 : null),
  },
  {
    group: 'seo', weight: 2, severity: 'high', failKind: 'issue',
    passLabel: 'Meta description present',
    failLabel: 'No meta description',
    remediation: 'Add a meta description. Without one Google invents the snippet from page text, and it rarely picks the sentence you would.',
    run: (p) => (p.metaDescription ? p.metaDescription : false),
  },
  {
    group: 'seo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Meta description is a usable length',
    failLabel: 'Meta description is too short or will be truncated',
    remediation: 'Aim for roughly 70–160 characters.',
    run: (p) => (p.metaDescription ? p.metaDescription.length >= 70 && p.metaDescription.length <= 160 : null),
  },
  {
    group: 'seo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Exactly one H1 heading',
    failLabel: 'Missing or duplicated H1 heading',
    remediation: 'Use a single H1 stating what the page is. Multiple H1s leave the page\'s main subject ambiguous.',
    run: (p) => p.h1s.length === 1,
  },
  {
    group: 'seo', weight: 3, severity: 'high', failKind: 'issue',
    passLabel: 'Page is indexable',
    failLabel: 'Page is blocked from search by a noindex directive',
    remediation: 'Remove the noindex robots directive. Nothing else on this list matters while it is there.',
    run: (p) => !(p.robots ?? '').toLowerCase().includes('noindex'),
  },
  {
    group: 'seo', weight: 1, severity: 'medium', failKind: 'opportunity',
    passLabel: 'Canonical URL declared',
    failLabel: 'No canonical URL',
    remediation: 'Add a self-referencing canonical link so duplicate URLs do not split ranking signals.',
    run: (p) => (p.canonical ? p.canonical : false),
  },
  {
    group: 'seo', weight: 2, severity: 'high', failKind: 'issue',
    passLabel: 'Mobile viewport declared',
    failLabel: 'No mobile viewport tag',
    remediation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">. Most clinic traffic in India is mobile.',
    run: (p) => Boolean(p.viewport),
  },
  {
    group: 'seo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Social preview tags present',
    failLabel: 'No Open Graph preview tags',
    remediation: 'Add og:title and og:image so links shared on WhatsApp show a proper card rather than a bare URL.',
    run: (p) => Boolean(p.ogTitle && p.ogImage),
  },
  {
    group: 'seo', weight: 1, severity: 'medium', failKind: 'opportunity',
    passLabel: 'Images carry alt text',
    failLabel: 'Most images have no alt text',
    remediation: 'Describe each image in its alt attribute — it is read by search engines and by screen readers alike.',
    run: (p) => {
      if (p.images.length === 0) return null;
      const withAlt = p.images.filter((i) => i.hasAlt).length;
      return withAlt / p.images.length >= 0.8;
    },
  },
  {
    group: 'seo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Page has substantive content',
    failLabel: 'Very little text on the page',
    remediation: 'Thin pages rarely rank and give an AI engine nothing to quote. Aim for 300+ words describing treatments, the team and the location.',
    run: (p) => p.wordCount >= 300,
  },
  {
    group: 'seo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Google\'s own SEO audit passes',
    failLabel: 'Google\'s own SEO audit flags problems',
    remediation: 'Open PageSpeed Insights for this URL and work the SEO section — these are Google\'s own checks, reported directly.',
    run: (_p, psi) => (psi?.seo == null ? null : psi.seo >= 90),
  },
  {
    group: 'seo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Loads quickly enough (LCP)',
    failLabel: 'Main content takes too long to appear',
    remediation: 'Largest Contentful Paint should be under 2.5s. Usually an oversized hero image on a clinic site.',
    run: (_p, psi) => (psi?.lcpMs == null ? null : psi.lcpMs <= 2500),
  },
  {
    group: 'seo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Layout is stable while loading',
    failLabel: 'Page content shifts around as it loads',
    remediation: 'Cumulative Layout Shift should be under 0.1 — set explicit width and height on images and embeds.',
    run: (_p, psi) => (psi?.cls == null ? null : psi.cls <= 0.1),
  },

  // ---------------------------------------------------------------- GEO ----
  {
    group: 'geo', weight: 3, severity: 'high', failKind: 'issue',
    passLabel: 'Structured data present',
    failLabel: 'No structured data at all',
    remediation: 'Add JSON-LD. It is the single strongest lever for being understood — and cited — by AI answer engines.',
    run: (p) => p.jsonLd.length > 0,
  },
  {
    group: 'geo', weight: 3, severity: 'high', failKind: 'issue',
    passLabel: 'Business is declared as a local medical entity',
    failLabel: 'No LocalBusiness or medical-practice schema',
    remediation: 'Declare Dentist, MedicalClinic or LocalBusiness in JSON-LD with name, address, phone and opening hours. This is how an engine knows you are a real clinic in a real place.',
    run: (p) => {
      const wanted = ['dentist', 'dentalclinic', 'medicalclinic', 'medicalbusiness', 'localbusiness', 'physician', 'hospital'];
      const hit = p.jsonLdTypes.find((t) => wanted.includes(t.toLowerCase()));
      return hit ?? false;
    },
  },
  {
    group: 'geo', weight: 2, severity: 'medium', failKind: 'opportunity',
    passLabel: 'Profiles linked for entity matching (sameAs)',
    failLabel: 'No sameAs links to official profiles',
    remediation: 'Add sameAs entries pointing at the Google Business Profile, Practo and social pages, so engines connect them all to one clinic.',
    run: (p) => /"sameAs"\s*:/i.test(p.html),
  },
  {
    group: 'geo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Practitioner qualifications shown',
    failLabel: 'No practitioner qualifications on the page',
    remediation: 'Name the dentists and state their qualifications (BDS, MDS). Answer engines weight named, credentialled authors heavily — and NMC rules expect it anyway.',
    run: (p) => {
      const m = p.text.match(/\b(BDS|MDS|MBBS|MD|MS|DNB|MCh|FRCS)\b/);
      return m ? m[0] : false;
    },
  },
  {
    group: 'geo', weight: 2, severity: 'high', failKind: 'issue',
    passLabel: 'Phone number visible on the page',
    failLabel: 'No phone number found on the page',
    remediation: 'Put the clinic phone number in the page text, not only inside an image or a click-to-call icon.',
    run: (p) => {
      const m = p.text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
      return m ? m[0].trim() : false;
    },
  },
  {
    group: 'geo', weight: 2, severity: 'medium', failKind: 'issue',
    passLabel: 'Address with PIN code visible',
    failLabel: 'No postal address with a PIN code found',
    remediation: 'Show the full address including the 6-digit PIN code. It is what ties the site to the same entity as your Maps listing.',
    run: (p) => {
      const m = p.text.match(/\b[1-9]\d{5}\b/);
      return m ? m[0] : false;
    },
  },
  {
    group: 'geo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'About or team page linked',
    failLabel: 'No About or Team page linked',
    remediation: 'Link an About or Team page. It is where an engine looks to decide whether a site is a real practice with real people.',
    run: (p) => p.links.some((l) => /about|team|our\s*doctors|meet/i.test(`${l.href} ${l.text}`)),
  },
  {
    group: 'geo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Contact page linked',
    failLabel: 'No contact page linked',
    remediation: 'Link a contact page carrying the same name, address and phone as your listings.',
    run: (p) => p.links.some((l) => /contact|reach|visit|book/i.test(`${l.href} ${l.text}`)),
  },

  // ---------------------------------------------------------------- AEO ----
  {
    group: 'aeo', weight: 3, severity: 'high', failKind: 'opportunity',
    passLabel: 'FAQ structured data present',
    failLabel: 'No FAQ structured data',
    remediation: 'Mark up common patient questions with FAQPage JSON-LD — the most direct route into featured snippets and voice answers.',
    run: (p) => p.jsonLdTypes.some((t) => t.toLowerCase() === 'faqpage'),
  },
  {
    group: 'aeo', weight: 2, severity: 'medium', failKind: 'opportunity',
    passLabel: 'Headings phrased as patient questions',
    failLabel: 'No question-phrased headings',
    remediation: 'Phrase section headings the way patients actually search: "How much does a root canal cost in Bengaluru?" rather than "Pricing".',
    run: (p) => {
      const q = p.headings.filter((h) => QUESTION_WORDS.test(h.trim()) || h.trim().endsWith('?'));
      return q.length > 0 ? q[0] ?? true : false;
    },
  },
  {
    group: 'aeo', weight: 2, severity: 'medium', failKind: 'opportunity',
    passLabel: 'Questions are answered concisely enough to quote',
    failLabel: 'Question headings are not followed by a short, quotable answer',
    remediation: 'Follow each question heading with a 40–60 word direct answer before elaborating. That paragraph is what gets lifted into a snippet.',
    run: (p) => {
      const answers = questionAnswerLengths(p.html);
      if (answers.length === 0) return null;
      return answers.some((w) => w >= 20 && w <= 80);
    },
  },
  {
    group: 'aeo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Uses lists a search engine can lift',
    failLabel: 'No list content',
    remediation: 'Steps and options as <ul>/<ol> lists are eligible for list snippets; the same content as a paragraph is not.',
    run: (p) => /<(ul|ol)\b/i.test(p.html),
  },
  {
    group: 'aeo', weight: 1, severity: 'low', failKind: 'opportunity',
    passLabel: 'Locality named in the content',
    failLabel: 'No locality or city named in the content',
    remediation: 'Name the area and city in the text ("Koramangala, Bengaluru"). Voice and "near me" searches resolve against exactly this.',
    run: (p) => /\b(bengaluru|bangalore|koramangala|indiranagar|whitefield|jayanagar|hsr|marathahalli|rajajinagar|malleshwaram)\b/i.test(p.text),
  },
];

export function analyseWebsite(
  html: string,
  text: string,
  psi: PageSpeedSummary | null = null,
): WebsiteAnalysis {
  const page = parsePage(html, text);
  const findings: WebsiteFinding[] = [];
  const totals: Record<SignalGroup, { earned: number; possible: number }> = {
    seo: { earned: 0, possible: 0 },
    geo: { earned: 0, possible: 0 },
    aeo: { earned: 0, possible: 0 },
  };

  for (const check of CHECKS) {
    const outcome = check.run(page, psi);

    // Not applicable: excluded from the denominator entirely, rather than
    // counted as a failure. Same rule as an unmeasured pillar in the composite
    // and an errored directory in the NAP audit.
    if (outcome === null) continue;

    const passed = outcome !== false;
    totals[check.group].possible += check.weight;
    if (passed) totals[check.group].earned += check.weight;

    findings.push({
      kind: passed ? 'passed' : check.failKind,
      signalGroup: check.group,
      ruleLabel: passed ? check.passLabel : check.failLabel,
      severity: passed ? null : check.severity,
      snippet: typeof outcome === 'string' ? truncate(outcome, 180) : null,
      remediation: passed ? null : check.remediation,
    });
  }

  const seo = groupScore(totals.seo);
  const geo = groupScore(totals.geo);
  const aeo = groupScore(totals.aeo);

  // The three weigh equally. SEO still brings the traffic today, but a clinic
  // invisible to answer engines is losing the queries that convert best, and
  // weighting by today's traffic would keep telling clients to optimise for
  // where search has already been.
  const score = round2((seo + geo + aeo) / 3);

  return { seo, geo, aeo, score, findings };
}

function groupScore(t: { earned: number; possible: number }): number {
  if (t.possible === 0) return 0;
  return round2((t.earned / t.possible) * 100);
}

// ---------------------------------------------------------------------------
// Extraction. Deliberately small and forgiving -- every helper returns null or
// an empty list rather than throwing, because a malformed page is a finding,
// not a crashed audit.
// ---------------------------------------------------------------------------

function parsePage(html: string, text: string): PageView {
  const jsonLd = extractJsonLd(html);
  const plain = text.trim().length > 0 ? text : stripTags(html);

  return {
    html,
    text: plain,
    title: cleanOrNull(firstGroup(html, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    metaDescription: cleanOrNull(metaContent(html, 'name', 'description')),
    robots: cleanOrNull(metaContent(html, 'name', 'robots')),
    canonical: cleanOrNull(firstGroup(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)),
    viewport: cleanOrNull(metaContent(html, 'name', 'viewport')),
    ogTitle: cleanOrNull(metaContent(html, 'property', 'og:title')),
    ogImage: cleanOrNull(metaContent(html, 'property', 'og:image')),
    h1s: allGroups(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags),
    headings: allGroups(html, /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi).map(stripTags),
    jsonLd,
    jsonLdTypes: collectTypes(jsonLd),
    images: allMatches(html, /<img\b[^>]*>/gi).map((tag) => ({ hasAlt: /\balt=["'][^"']+["']/i.test(tag) })),
    wordCount: plain.split(/\s+/).filter(Boolean).length,
    links: allMatches(html, /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi).map((tag) => ({
      href: firstGroup(tag, /href=["']([^"']+)["']/i) ?? '',
      text: stripTags(tag),
    })),
  };
}

function metaContent(html: string, attr: 'name' | 'property', key: string): string | null {
  for (const tag of allMatches(html, /<meta\b[^>]*>/gi)) {
    const found = firstGroup(tag, new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
    if (found?.toLowerCase() === key.toLowerCase()) {
      return firstGroup(tag, /content=["']([^"']*)["']/i);
    }
  }
  return null;
}

function extractJsonLd(html: string): unknown[] {
  const blocks = allGroups(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const out: unknown[] = [];
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block.trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // Malformed JSON-LD is common and is itself worth nothing rather than
      // worth failing the whole analysis over.
    }
  }
  return out;
}

/** Walks @graph and nested nodes, since real sites nest their entities. */
function collectTypes(nodes: unknown[]): string[] {
  const types: string[] = [];
  const visit = (node: unknown, depth: number): void => {
    if (depth > 5 || node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const t = record['@type'];
    if (typeof t === 'string') types.push(t);
    if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) value.forEach((v) => visit(v, depth + 1));
      else if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };
  nodes.forEach((n) => visit(n, 0));
  return types;
}

/** Word counts of the text directly following each question-phrased heading. */
function questionAnswerLengths(html: string): number[] {
  const lengths: number[] = [];
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]{0,1200}?)(?=<h[23]\b|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const heading = stripTags(match[1] ?? '');
    if (!QUESTION_WORDS.test(heading.trim()) && !heading.trim().endsWith('?')) continue;
    const body = stripTags(match[2] ?? '');
    lengths.push(body.split(/\s+/).filter(Boolean).length);
  }
  return lengths;
}

function firstGroup(source: string, re: RegExp): string | null {
  const m = source.match(re);
  return m?.[1] ?? null;
}

function allGroups(source: string, re: RegExp): string[] {
  return [...source.matchAll(re)].map((m) => m[1] ?? '');
}

function allMatches(source: string, re: RegExp): string[] {
  return [...source.matchAll(re)].map((m) => m[0]);
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOrNull(value: string | null): string | null {
  const cleaned = value ? stripTags(value) : '';
  return cleaned.length > 0 ? cleaned : null;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
