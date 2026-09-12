import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import ChangePasswordForm from './change-password-form';

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight mt-4">Change password</h2>
        <p className="text-sm text-muted mt-1.5">{session.email}</p>
        <div className="mt-8">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
