'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ContactState = { error?: string; ok?: string; preview?: ImportPreview };

export type ImportPreview = {
  total: number;
  created: number;
  matched: number;
  skipped: number;
  errors: { row: number; name: string | null; reason: string }[];
};

/**
 * Every write goes through a SECURITY DEFINER RPC that re-checks
 * app.accessible_tenant_ids() server-side, so a forged tenant id in a form post
 * is refused by the database rather than by this file.
 */
export async function addContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const locationId = String(formData.get('location_id') ?? '').trim();
  const consentSource = String(formData.get('consent_source') ?? 'in_clinic');

  if (!phone && !email) {
    return { error: 'A phone number or an email address is needed — without one this patient cannot be recognised again.' };
  }

  // Omit absent keys rather than sending undefined: under
  // exactOptionalPropertyTypes an explicit undefined is not an absent key, and
  // omission is what lets the SQL DEFAULT NULL apply.
  const optional: Record<string, string> = {};
  if (phone) optional['p_phone'] = phone;
  if (email) optional['p_email'] = email;
  if (locationId) optional['p_location_id'] = locationId;

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_contact', {
    p_tenant_id: tenantId,
    p_full_name: fullName || 'Unnamed patient',
    p_consent_source: consentSource,
    ...optional,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/contacts`);
  return { ok: `${fullName || 'Patient'} saved.` };
}

/** Parses the pasted CSV the same way for the preview and the real import. */
function parseRows(csv: string): { full_name: string; phone: string; email: string }[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // A header is optional. Detect one rather than demanding it — the exports
  // clinics get from their practice software are inconsistent about it.
  const first = lines[0]!.toLowerCase();
  const hasHeader = first.includes('name') || first.includes('phone') || first.includes('email');
  const body = hasHeader ? lines.slice(1) : lines;

  return body.map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      full_name: cells[0] ?? '',
      phone: cells[1] ?? '',
      email: cells[2] ?? '',
    };
  });
}

/**
 * The preview and the import call the SAME function with p_dry_run flipped, so
 * the numbers shown before the operator commits are produced by the code that
 * will run, not by an estimate that can disagree with it.
 */
export async function previewImport(_prev: ContactState, formData: FormData): Promise<ContactState> {
  return runImport(formData, true);
}

export async function commitImport(_prev: ContactState, formData: FormData): Promise<ContactState> {
  return runImport(formData, false);
}

async function runImport(formData: FormData, dryRun: boolean): Promise<ContactState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '').trim();
  const rows = parseRows(String(formData.get('csv') ?? ''));

  if (rows.length === 0) return { error: 'Nothing to import — paste rows as name, phone, email.' };
  if (rows.length > 5000) {
    return { error: `${rows.length} rows is more than one import should carry. Split the file.` };
  }

  const optional: Record<string, string> = {};
  if (locationId) optional['p_location_id'] = locationId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_contacts', {
    p_tenant_id: tenantId,
    p_rows: rows,
    p_dry_run: dryRun,
    ...optional,
  });

  if (error) return { error: error.message };

  const preview = data as unknown as ImportPreview;

  if (dryRun) return { preview };

  revalidatePath(`/console/clients/${tenantId}/contacts`);
  return {
    preview,
    ok: `${preview.created} added, ${preview.matched} already on file${
      preview.skipped ? `, ${preview.skipped} skipped` : ''
    }.`,
  };
}

export async function setConsent(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const contactId = String(formData.get('contact_id') ?? '');
  const channel = String(formData.get('channel') ?? 'whatsapp');
  const optedIn = String(formData.get('opted_in') ?? '') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_contact_consent', {
    p_contact_id: contactId,
    p_channel: channel,
    p_opted_in: optedIn,
    ...(optedIn ? { p_source: String(formData.get('source') ?? 'in_clinic') } : {}),
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/contacts`);
  return { ok: optedIn ? 'Opt-in recorded.' : 'Opt-out recorded.' };
}
