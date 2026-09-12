import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * The patient-facing end of a review QR code.
 *
 * Unauthenticated by design — the person scanning is not logged in and never
 * will be. It calls the one function `anon` is granted, which records the scan
 * and returns only a destination URL: no contact data, no tenant data, nothing
 * that could be enumerated.
 *
 * An unknown token is a plain 404 with no explanation. Confirming that a token
 * is merely "expired" or "already used" would tell an unauthenticated caller
 * something about tokens they do not hold.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_review_click', { p_token: token });

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 });
  }

  // 307 rather than 308: the mapping from token to destination is not permanent,
  // and a browser that cached this forever would stop recording later scans.
  return NextResponse.redirect(data, 307);
}
