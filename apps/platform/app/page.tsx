import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { signOut } from '@/app/(auth)/sign-in/actions';
import { EmptyState } from '@/components/shell';

/**
 * The only routing decision that matters: who you are decides what you see.
 * Staff get the Console; the database enforces the boundary regardless of how
 * you got here. A non-staff account has nowhere built for it yet, so it lands
 * here rather than on a route that doesn't exist.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.workspace === 'console') redirect('/console');

  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="w-full max-w-md">
        <EmptyState
          title="Nothing here for this account yet"
          description="This sign-in isn't set up as AgastyaOne staff. If you're a client of AgastyaOne, get in touch with us about seeing your results."
          action={
            <form action={signOut}>
              <button type="submit" className="btn-ghost">
                Sign out
              </button>
            </form>
          }
        />
      </div>
    </div>
  );
}
