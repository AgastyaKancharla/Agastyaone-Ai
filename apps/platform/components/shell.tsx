import Link from 'next/link';
import { signOut } from '@/app/(auth)/sign-in/actions';

export type NavItem = { href: string; label: string; icon: string; disabled?: boolean };

/**
 * One shell for both workspaces. The Console and the Portal are the same
 * product with different navigation and different data — not two apps — so
 * they share this chrome rather than drifting apart visually.
 */
export function Shell({
  workspace,
  nav,
  user,
  context,
  children,
}: {
  workspace: 'Console' | 'Portal';
  nav: NavItem[];
  user: { name: string; email: string };
  context?: React.ReactNode | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-hairline bg-surface flex flex-col">
        <div className="p-4 border-b border-hairline">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand grid place-items-center font-bold text-white text-sm">
              A
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">AgastyaOne</div>
              <div className="text-[11px] text-muted">{workspace}</div>
            </div>
          </Link>
        </div>

        {context && <div className="p-3 border-b border-hairline">{context}</div>}

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) =>
            item.disabled ? (
              <span
                key={item.href}
                title="Not part of this release yet"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted/50 cursor-not-allowed"
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-ink hover:bg-brand-wash transition"
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="p-3 border-t border-hairline">
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted truncate">{user.email}</div>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn-ghost w-full justify-start text-sm">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return (
    <div className="border-b border-hairline bg-surface px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted mt-1">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: 'bg-brand-wash text-brand-deep',
    onboarding: 'bg-accent/10 text-accent-deep',
    prospect: 'bg-hairline text-muted',
    paused: 'bg-hairline text-muted',
    churned: 'bg-danger/10 text-danger',
    green: 'bg-brand-wash text-brand-deep',
    amber: 'bg-accent/10 text-accent-deep',
    red: 'bg-danger/10 text-danger',
    unknown: 'bg-hairline text-muted',
  };
  return <span className={`pill ${tone[status] ?? 'bg-hairline text-muted'}`}>{status}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-12 text-center">
      <h3 className="font-medium">{title}</h3>
      <p className="hint max-w-md mx-auto mt-2">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
