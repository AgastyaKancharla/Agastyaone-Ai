import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Shell, type NavItem } from '@/components/shell';

const nav: NavItem[] = [
  { href: '/console', label: 'Overview', icon: '◫' },
  { href: '/console/clients', label: 'Clients', icon: '◈' },
  { href: '/console/delivery', label: 'Delivery', icon: '◷', disabled: true },
  { href: '/console/commercial', label: 'Commercial', icon: '₹', disabled: true },
  { href: '/console/services', label: 'Services', icon: '⚙', disabled: true },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  // A client who guesses the URL is bounced to their own workspace. RLS would
  // return nothing here anyway; this just avoids showing them an empty Console.
  if (session.workspace !== 'console') redirect('/portal');

  return (
    <Shell
      workspace="Console"
      nav={nav}
      user={{ name: session.fullName, email: session.email }}
      context={
        <div className="px-1">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Visibility</div>
          <div className="text-sm">
            {session.tenantScope === 'all'
              ? 'All accounts'
              : session.tenantScope === 'assigned'
                ? 'Assigned accounts'
                : 'Task-level only'}
          </div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
