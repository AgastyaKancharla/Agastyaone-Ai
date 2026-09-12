import { createAdapter, q } from './generic.ts';
import type { DirectoryAdapter } from './types.ts';

/**
 * The five Indian directories that matter for a dental clinic.
 *
 * A KEYED registry, not the retired tool's hardcoded array — audits can target
 * a subset, which is what makes the Console's directory selection meaningful
 * rather than decorative.
 *
 * SELECTOR CAVEAT, stated plainly: these are best-effort and every one of these
 * sites ships obfuscated, build-hashed class names that change on their deploys.
 * The retired adapters keyed off literals like `.jsx-3098522197`, which is a
 * webpack artifact. Each field here has a fallback chain and degrades to
 * "missing" rather than throwing, so stale selectors show up as low coverage in
 * the report instead of silently wrong data — but they still need calibrating
 * against live pages, and re-calibrating periodically.
 *
 * The durable fix is not better selectors. It is the Google Business Profile
 * API for Google (sanctioned, stable, and first on the procurement list), and
 * scraping only where no API exists.
 */
export const ADAPTERS: DirectoryAdapter[] = [
  createAdapter({
    code: 'google_business',
    name: 'Google Business Profile',
    searchUrl: (s) => `https://www.google.com/maps/search/${q(s)}`,
    selectors: {
      card: ['div[role="feed"] > div > div[jsaction]', 'div.Nv2PK', 'div[role="article"]'],
      name: ['div.qBF1Pd', 'a.hfpxzc[aria-label]', 'div.fontHeadlineSmall'],
      address: ['div.W4Efsd:nth-child(2) > div:nth-child(2)', 'div.W4Efsd span:nth-child(3)'],
      phone: ['span.UsdlK', 'div.W4Efsd span:has-text("+91")'],
      link: ['a.hfpxzc', 'a[href*="/maps/place/"]'],
      rating: ['span.MW4etd', 'span[aria-label*="stars"]'],
      reviewCount: ['span.UY7F9', 'span[aria-label*="reviews"]'],
    },
  }),

  createAdapter({
    code: 'justdial',
    name: 'Justdial',
    searchUrl: (s) =>
      `https://www.justdial.com/${encodeURIComponent(s.city ?? 'Bangalore')}/search?q=${q(s)}`,
    selectors: {
      card: ['div.resultbox', 'li.cntanr', 'div[class*="resultbox"]'],
      name: ['h2.resultbox_title_anchor', 'span.lng_cont_name', 'a[class*="title"]'],
      address: ['div.resultbox_address', 'span.cont_fl_addr', 'div[class*="address"]'],
      phone: ['span.callcontent', 'a.contact-info', 'span[class*="callcontent"]'],
      link: ['a.resultbox_title_anchor', 'a[href*="justdial.com/"]'],
      rating: ['span.resultbox_totalrate', 'span[class*="rating"]'],
      reviewCount: ['span.resultbox_countrating', 'span[class*="votes"]'],
    },
  }),

  createAdapter({
    code: 'practo',
    name: 'Practo',
    searchUrl: (s) =>
      `https://www.practo.com/search/clinics?q=${q(s)}&city=${encodeURIComponent(s.city ?? 'Bangalore')}`,
    selectors: {
      card: ['div.u-border-general--bottom', 'div[data-qa-id="clinic_card"]', 'div.pure-g.listing-card'],
      name: ['h2[data-qa-id="clinic_name"]', 'h2.u-title', 'a[data-qa-id="clinic_name"]'],
      address: ['[data-qa-id="clinic_locality"]', 'p.u-c-pointer', 'span.u-grey_3-text'],
      phone: ['[data-qa-id="call_button"]', 'span.u-bold.u-d-inlineblock'],
      link: ['a[data-qa-id="clinic_name"]', 'a[href*="/clinic/"]'],
      rating: ['[data-qa-id="star_rating"]', 'span.u-green-text'],
      reviewCount: ['[data-qa-id="total_recommendation"]', 'span.u-smallest-font'],
    },
  }),

  createAdapter({
    code: 'lybrate',
    name: 'Lybrate',
    searchUrl: (s) => `https://www.lybrate.com/search?q=${q(s)}`,
    selectors: {
      card: ['div.doctor-card', 'div[class*="listing-card"]', 'div.search-result'],
      name: ['h2.doctor-name', 'a[class*="name"]', 'h3'],
      address: ['div.clinic-address', 'span[class*="locality"]', 'p[class*="address"]'],
      phone: ['span.phone', 'a[href^="tel:"]'],
      link: ['a[href*="/clinic/"]', 'a[href*="/doctor/"]'],
    },
  }),

  createAdapter({
    code: 'sulekha',
    name: 'Sulekha',
    searchUrl: (s) => `https://www.sulekha.com/search?q=${q(s)}`,
    selectors: {
      card: ['div.lst-bx', 'div[class*="listing"]', 'li.result-item'],
      name: ['h2.biz-name', 'a[class*="title"]', 'h3'],
      address: ['span.biz-addr', 'div[class*="address"]', 'p.addr'],
      phone: ['span.ph-no', 'a[href^="tel:"]', 'span[class*="phone"]'],
      link: ['a.biz-name', 'a[href*="sulekha.com/"]'],
    },
  }),
];

export const adapterByCode = new Map(ADAPTERS.map((a) => [a.code, a]));
