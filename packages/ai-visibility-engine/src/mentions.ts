import type { AnswerAnalysis, Mention, Sentiment } from './types.ts';

/**
 * Reads a raw LLM answer the way a patient would: does it name this clinic,
 * where in the answer, and who else does it name.
 *
 * Regex over the raw text, deliberately, for the same reason nmc-compliance.ts
 * uses regex rather than a parser: this is a first-pass signal for a human to
 * confirm, not an auto-published verdict, and free-form prose from four
 * different providers has no shared grammar a real parser could target.
 *
 * ENTITY EXTRACTION IS A HEURISTIC, STATED PLAINLY
 *
 * Answer engines usually name businesses inside a numbered or bulleted list —
 * "1. Smile Dental Clinic — Koramangala" — so each list item's leading
 * capitalised phrase is treated as a candidate entity, up to the first comma,
 * dash or line break. Prose mentions outside a list are still caught (the
 * client's own name is searched for across the whole text), but competitors
 * named only in prose are not enumerated — extracting them reliably needs
 * real NER, which is out of scope for a pure, dependency-free package. This
 * under-counts competitor lists on unusually prose-heavy answers; it does not
 * miss whether the CLIENT was mentioned, which is the number the score rests on.
 */

const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+(.+)$/gm;
const CANDIDATE_NAME = /^([A-Z][\w&'.]*(?:\s+[A-Z][\w&'.]*){0,5})/;
const CITATION_MARKER = /\[(\d+)\]/;

const POSITIVE_WORDS = /\b(excellent|recommend(?:ed)?|best|highly[\s-]rated|trusted|top[\s-]choice|great|outstanding|reputable)\b/i;
const NEGATIVE_WORDS = /\b(avoid|poor|complaints?|not\s+recommended|bad\s+reviews?|unreliable|disappointing)\b/i;

/** Normalise for comparison: lowercase, strip punctuation, collapse whitespace. */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A loose match, on purpose. "Smile Dental Clinic" said as "Smile Dental" or
 * "Smile Dental Clinic, Koramangala" both count — an answer engine paraphrases
 * a business name as often as it quotes it exactly.
 */
function namesMatch(candidate: string, clientName: string): boolean {
  const a = normalise(candidate);
  const b = normalise(clientName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const aWords = new Set(a.split(' ').filter((w) => w.length > 2));
  const bWords = new Set(b.split(' ').filter((w) => w.length > 2));
  if (bWords.size === 0) return false;
  const shared = [...bWords].filter((w) => aWords.has(w)).length;
  return shared / bWords.size >= 0.7;
}

function sentimentNear(text: string, index: number): Sentiment | null {
  const window = text.slice(Math.max(0, index - 80), index + 80);
  if (POSITIVE_WORDS.test(window)) return 'positive';
  if (NEGATIVE_WORDS.test(window)) return 'negative';
  return null;
}

/** Citation markers like "[1]" near a mention, resolved against citedUrls[0-indexed]. */
function citedUrlNear(text: string, index: number, citedUrls: string[] | undefined): string | null {
  if (!citedUrls || citedUrls.length === 0) return null;
  const window = text.slice(index, index + 40);
  const marker = window.match(CITATION_MARKER);
  if (!marker) return null;
  const n = Number(marker[1]);
  return citedUrls[n - 1] ?? null;
}

export function analyseAnswer(
  text: string,
  clientName: string,
  citedUrls?: string[],
): AnswerAnalysis {
  const mentions: Mention[] = [];
  const seen = new Set<string>();

  let listPosition = 0;
  for (const match of text.matchAll(LIST_ITEM)) {
    const item = match[1] ?? '';
    const nameMatch = item.match(CANDIDATE_NAME);
    if (!nameMatch) continue;

    const entityName = nameMatch[1]!.trim();
    const key = normalise(entityName);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);

    listPosition += 1;
    const index = match.index ?? 0;
    mentions.push({
      entityName,
      isClient: namesMatch(entityName, clientName),
      position: listPosition,
      citedUrl: citedUrlNear(text, index, citedUrls),
      sentiment: sentimentNear(text, index),
    });
  }

  const clientInList = mentions.find((m) => m.isClient) ?? null;

  // Caught even when the answer has no list structure at all — plain prose
  // ("You might consider Smile Dental in Koramangala...") still counts as a
  // real mention, just with no ranked position to report.
  const mentionedInProse = !clientInList && normalise(text).includes(normalise(clientName));
  if (mentionedInProse) {
    const index = text.toLowerCase().indexOf(normalise(clientName).split(' ')[0] ?? '');
    mentions.push({
      entityName: clientName,
      isClient: true,
      position: null,
      citedUrl: null,
      sentiment: index >= 0 ? sentimentNear(text, index) : null,
    });
  }

  const wasMentioned = clientInList !== null || mentionedInProse;
  const position = clientInList?.position ?? null;
  const namedBusinesses = mentions.length;

  return {
    wasMentioned,
    position,
    // Share among however many businesses this answer actually named.
    // Zero named at all (a refusal, or a purely informational answer with no
    // recommendation) measures nothing about the client and is left null —
    // the same "absence of evidence" rule as an unmeasured pillar. Once the
    // answer DOES name businesses, silence about the client is a real,
    // measured zero: it counts against the score exactly as "not_ranked"
    // counts against a map-rank point, because a competitor being named in
    // the client's place is the actual event a patient just experienced.
    shareOfVoice: namedBusinesses === 0 ? null : wasMentioned ? round1(100 / namedBusinesses) : 0,
    mentions,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
