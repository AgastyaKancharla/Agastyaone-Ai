/**
 * Normalisation for comparing Indian business listings.
 *
 * Rules live in exported data rather than inline literals so a second city or
 * vertical is a config change, not a code change.
 */

/** Longest-first. Order matters: see applyAbbreviations. */
export const ABBREVIATIONS: [RegExp, string][] = [
  // Multi-word forms MUST come first. The retired tool listed `rd -> road`
  // before `main rd -> main road`, so the second rule was unreachable — `rd`
  // had already been rewritten by the time it ran.
  [/\bmain\s+rd\b/g, 'main road'],
  [/\bcross\s+rd\b/g, 'cross road'],
  [/\bopp\.?\s+to\b/g, 'opposite'],
  [/\bnr\.?\s+to\b/g, 'near'],

  [/\brd\b/g, 'road'],
  [/\bst\b/g, 'street'],
  [/\bave\b/g, 'avenue'],
  [/\blayt\b/g, 'layout'],
  [/\blyt\b/g, 'layout'],
  [/\bflr\b/g, 'floor'],
  [/\bbldg\b/g, 'building'],
  [/\bblrg\b/g, 'building'],
  [/\bnr\b/g, 'near'],
  [/\bopp\b/g, 'opposite'],
  [/\badj\b/g, 'adjacent'],
  [/\bextn\b/g, 'extension'],
  [/\bext\b/g, 'extension'],
  [/\bblk\b/g, 'block'],
  [/\bph\b/g, 'phase'],
  [/\bsec\b/g, 'sector'],
];

/**
 * `no` means "number" only when a number follows it ("No. 45"). The retired
 * tool rewrote every `\bno\b`, so an address containing the English word "no"
 * was mangled.
 */
export const NUMBER_PREFIX = /\bno\.?\s*(?=\d)/g;

/** City spellings that refer to the same place. */
export const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  poona: 'pune',
  trivandrum: 'thiruvananthapuram',
  gurgaon: 'gurugram',
  mysore: 'mysuru',
  mangalore: 'mangaluru',
  hubli: 'hubballi',
  belgaum: 'belagavi',
};

/** Locality shorthands people actually type. */
export const LOCALITY_ALIASES: Record<string, string> = {
  hsr: 'hsr layout',
  kora: 'koramangala',
  jp: 'jp nagar',
  btm: 'btm layout',
  cbd: 'central business district',
};

/** Honorifics and suffixes that carry no identity signal. */
export const NAME_NOISE = /\b(dr|drs|mr|mrs|ms|prof|the|a|an)\b\.?/g;
export const ENTITY_SUFFIX = /\b(pvt|private|ltd|limited|llp|inc|co|company)\b\.?/g;

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

function applyAliases(input: string, aliases: Record<string, string>): string {
  let out = input;
  for (const [from, to] of Object.entries(aliases)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return out;
}

function applyAbbreviations(input: string): string {
  let out = input;
  for (const [pattern, replacement] of ABBREVIATIONS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * E.164 for India. Mirrors app.normalize_phone_e164 in the database, because a
 * phone normalised one way in TypeScript and another way in SQL creates
 * duplicate contacts that no later fix can merge automatically.
 */
export function normalizePhone(raw: string | null | undefined, defaultCc = '91'): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+${defaultCc}${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCc}${digits}`;
  return `+${digits}`;
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return '';
  return collapse(
    raw
      .toLowerCase()
      .replace(/[&]/g, ' and ')
      .replace(NAME_NOISE, ' ')
      .replace(ENTITY_SUFFIX, ' ')
      .replace(/[^a-z0-9\s]/g, ' '),
  );
}

export function normalizeAddress(raw: string | null | undefined): string {
  if (!raw) return '';
  let out = raw.toLowerCase();
  out = out.replace(NUMBER_PREFIX, 'number ');
  out = applyAliases(out, CITY_ALIASES);
  out = applyAliases(out, LOCALITY_ALIASES);
  out = applyAbbreviations(out);
  out = out.replace(/[^a-z0-9\s]/g, ' ');
  return collapse(out);
}

export function normalizeWebsite(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split(/[?#]/)[0]!;
}

/** Levenshtein distance, iterative with two rows. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** 0–100 similarity. Two empty strings are treated as no evidence, not a match. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  return Math.round(((max - levenshtein(a, b)) / max) * 10000) / 100;
}

/**
 * Token overlap, which survives reordering that Levenshtein punishes.
 * "Nissa Dental Clinic Koramangala" vs "Koramangala Nissa Dental" scores badly
 * on edit distance and correctly here.
 */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return Math.round((shared / Math.min(ta.size, tb.size)) * 10000) / 100;
}
