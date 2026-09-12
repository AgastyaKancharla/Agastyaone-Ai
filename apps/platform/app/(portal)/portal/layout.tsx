import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { Shell, type NavItem } from '@/components/shell';
import { PORTAL_MODULES } from '@/lib/modules';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  // Staff who land here directly (bookmark, stale tab, back button) belong in
  // the Console. Without this, a staff account's tenant_scope='all' makes
  // session.tenants[0] resolve to the internal AgastyaOne tenant instead of
  // "no account linked" — a confusing, empty-looking Portal instead of a
  // bounce to where they actually work.
  if (session.workspace !== 'portal') redirect('/console');

  // A client's tenant comes from their membership, already filtered by RLS.
  const tenant = session.tenants[0];
  if (!tenant) {
    return (
      <div className="min-h-screen grid place-items-center p-8">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-medium">No account linked yet</h1>
          <p className="hint mt-2">
            Your sign-in worked, but this address is not attached to a business yet.
            Your account manager at AgastyaOne can link it.
          </p>
        </div>
      </div>
    );
  }

  const entitlements = await getEntitlements(tenant.id);

  // Nav follows what they bought. Not a security boundary — RLS is — but it is
  // why the Portal never shows a module the client has no reason to see.
  const nav: NavItem[] = [
    { href: '/portal', label: 'Overview', icon: '◫' },
    ...PORTAL_MODULES.filter((m) => isEntitled(entitlements, m.code)).map((m) => ({
      href: m.href,
      label: m.label,
      icon: m.icon,
      // Enabled as each slice lands; the rest show as visibly not-yet rather
      // than as broken links.
      disabled: !m.ready,
    })),
  ];

  return (
    <Shell
      workspace="Portal"
      nav={nav}
      user={{ name: session.fullName, email: session.email }}
      context={
        <div className="px-1">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Account</div>
          <div className="text-sm font-medium truncate">{tenant.name}</div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
