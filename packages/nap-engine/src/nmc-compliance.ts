/**
 * NMC/DCI healthcare-advertising compliance.
 *
 * Ported as a specification, not as code, from a since-abandoned local
 * prototype's `lib/audit/nmcCompliance.js`. The regex rules and their clause
 * citations are the valuable part -- worth keeping. Everything the rules were
 * wired into there (an Express route with no auth, results that were never
 * stored anywhere queryable) is not, and none of it made the trip.
 *
 * A pure function on the audit worker's existing website fetch, same shape as
 * `evaluateDirectory`/`summarize`: no I/O, easy to test without a browser.
 */

export type NmcFindingKind = 'violation' | 'missing_disclosure' | 'disclosure_present';
export type NmcSeverity = 'high' | 'medium' | 'low';

export interface NmcFinding {
  kind: NmcFindingKind;
  ruleLabel: string;
  severity: NmcSeverity | null;
  snippet: string | null;
  remediation: string | null;
}

export interface NmcComplianceResult {
  score: number;
  isCompliant: boolean;
  findings: NmcFinding[];
}

interface ViolationRule {
  regex: RegExp;
  ruleLabel: string;
  severity: NmcSeverity;
  remediation: string;
}

/**
 * Each pattern is mapped to an actual clause of the NMC's 2023 advertising
 * regulations, not a house style guide -- these are things a clinic's website
 * can be cited for, not merely things AgastyaOne would rather it not say.
 */
const VIOLATION_RULES: ViolationRule[] = [
  {
    regex:
      /(?:#\s*1|no\.?\s*1|best|leading|top|cheapest|premier|most\s+trusted)\s+(?:doctor|dentist|clinic|hospital|surgeon|implantologist|specialist|orthodontist|pediatrician)/i,
    ruleLabel: 'Prohibited superlative claims (NMC Reg 2023, Ch. 4)',
    severity: 'high',
    remediation:
      'Remove comparative superlatives (e.g. "#1 Dentist", "Best Clinic"). Replace with verified clinical qualifications and factual treatment descriptions.',
  },
  {
    regex: /(?:100%|guaranteed|permanent)\s+(?:cure|relief|painless|success|result|implant)/i,
    ruleLabel: 'Prohibited guarantee of cure (NMC Reg 2023, Cl. 26)',
    severity: 'high',
    remediation:
      'Medical professionals cannot guarantee treatment outcomes. Replace with "evidence-based clinical care" and procedure explanations.',
  },
  {
    regex:
      /(?:flat\s+\d+%\s+off|\d+%\s+discount|cashback|free\s+consultation\s+today\s+only|referral\s+reward|cash\s+voucher)/i,
    ruleLabel: 'Commercial solicitation & inducements (NMC Reg 2023, Cl. 28)',
    severity: 'high',
    remediation:
      'Remove commercial retail sales tactics or rebates. Maintain standard transparent fee schedules.',
  },
];

interface DisclosureRule {
  regex: RegExp;
  presentLabel: (match: string) => string;
  missingLabel: string;
}

const DISCLOSURE_RULES: DisclosureRule[] = [
  {
    regex: /\b(BDS|MDS|MBBS|MS|MD|DNB|MCh|FRCS)\b/i,
    presentLabel: (match) => `Doctor qualifications displayed (${match.toUpperCase()})`,
    missingLabel: 'Doctor medical qualifications (BDS, MDS, MBBS, MS) not prominently displayed on the primary page',
  },
  {
    regex: /(?:reg(?:istration)?\.?\s*(?:no|num|number)?\.?|kmc|dci|smc|dmc)\s*[:#-]?\s*(\d{4,8})/i,
    presentLabel: (match) => `Medical council registration detected (${match})`,
    missingLabel: 'State medical council / DCI doctor registration number not visibly cited',
  },
  {
    regex:
      /medical\s+disclaimer|not\s+a\s+substitute\s+for\s+professional\s+medical|in\s+case\s+of\s+(?:a\s+)?emergency\s+call|telemedicine\s+disclaimer/i,
    presentLabel: () => 'Clinical / telemedicine emergency disclaimer present',
    missingLabel: 'Emergency medical advisory / telemedicine disclaimer missing',
  },
  {
    regex: /privacy\s+policy|patient\s+confidentiality|data\s+protection/i,
    presentLabel: () => 'Patient data privacy policy present',
    missingLabel: 'Healthcare privacy policy / patient data notice missing',
  },
];

/**
 * @param html Raw page HTML.
 * @param text Extracted visible text (`innerText`-shaped).
 *
 * Both are checked together, deliberately erring toward over-flagging: a
 * violation phrase sitting in the source (a comment, a hidden template, a
 * pre-render variable) is still something a crawler can index and quote, and
 * a disclosure encoded in structured data or an image's alt text deserves
 * credit even when it is not rendered text. Either way this is a first pass
 * for a human to confirm, not an auto-published verdict.
 */
export function checkNmcCompliance(html: string, text: string): NmcComplianceResult {
  const corpus = `${html} ${text}`;
  const findings: NmcFinding[] = [];

  for (const rule of VIOLATION_RULES) {
    const match = corpus.match(rule.regex);
    if (!match) continue;
    findings.push({
      kind: 'violation',
      ruleLabel: rule.ruleLabel,
      severity: rule.severity,
      snippet: match[0].trim(),
      remediation: rule.remediation,
    });
  }

  for (const rule of DISCLOSURE_RULES) {
    const match = corpus.match(rule.regex);
    if (match) {
      findings.push({
        kind: 'disclosure_present',
        ruleLabel: rule.presentLabel(match[0]),
        severity: null,
        snippet: match[0].trim(),
        remediation: null,
      });
    } else {
      findings.push({
        kind: 'missing_disclosure',
        ruleLabel: rule.missingLabel,
        severity: null,
        snippet: null,
        remediation: null,
      });
    }
  }

  const violationCount = findings.filter((f) => f.kind === 'violation').length;
  const missingCount = findings.filter((f) => f.kind === 'missing_disclosure').length;

  const score = Math.max(10, Math.min(100, 100 - violationCount * 20 - missingCount * 10));
  const isCompliant = violationCount === 0 && missingCount <= 1;

  return { score, isCompliant, findings };
}
