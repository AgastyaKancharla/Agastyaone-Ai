/**
 * Maps catalog service codes to what a client sees in their Portal.
 *
 * Only components appear here, never the bundle wrappers — a client who bought
 * the Front Desk Bundle should see "WhatsApp", "AI Receptionist" and so on, not
 * a nav item called "Front Desk Bundle". The bundle is a commercial construct;
 * the modules are the product.
 */
export const PORTAL_MODULES: { code: string; label: string; icon: string; href: string }[] = [
  { code: 'website',              label: 'Website',        icon: '◻', href: '/portal/website' },
  { code: 'gbp_management',       label: 'Google Profile', icon: '◉', href: '/portal/gbp' },
  { code: 'directory_nap',        label: 'Listings',       icon: '◈', href: '/portal/listings' },
  { code: 'geo',                  label: 'AI Visibility',  icon: '✦', href: '/portal/ai-visibility' },
  { code: 'unified_inbox',        label: 'Inbox',          icon: '✉', href: '/portal/inbox' },
  { code: 'ai_receptionist',      label: 'Receptionist',   icon: '☏', href: '/portal/receptionist' },
  { code: 'call_tracking',        label: 'Calls',          icon: '☎', href: '/portal/calls' },
  { code: 'booking_capture',      label: 'Bookings',       icon: '▣', href: '/portal/bookings' },
  { code: 'crm',                  label: 'Patients',       icon: '◍', href: '/portal/patients' },
  { code: 'review_automation',    label: 'Reviews',        icon: '★', href: '/portal/reviews' },
  { code: 'recall',               label: 'Recall',         icon: '↻', href: '/portal/recall' },
  { code: 'reporting',            label: 'Reports',        icon: '▤', href: '/portal/reports' },
];
