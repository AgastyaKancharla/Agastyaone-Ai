import { headers } from 'next/headers';

/**
 * The origin patient-facing links are built against.
 *
 * Derived from the request rather than hardcoded, so a review QR printed from a
 * preview deployment points at that deployment instead of silently at
 * production. NEXT_PUBLIC_SITE_URL overrides it for the cases with no request
 * to read — anything generated off the request path later.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
