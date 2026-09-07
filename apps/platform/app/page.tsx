import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * The only routing decision that matters: who you are decides which workspace
 * you land in. Staff get the Console, clients get the Portal, and the database
 * enforces the boundary regardless of how you got here.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  redirect(session.workspace === 'console' ? '/console' : '/portal');
}
