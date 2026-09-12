import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import SignInForm from './sign-in-form';

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel. Hidden on small screens so the form gets the whole viewport. */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-deep text-white p-12">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center font-bold">A</div>
          <span className="text-lg font-semibold tracking-tight">AgastyaOne</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            One platform for every client and every service.
          </h1>
          <p className="mt-4 text-white/70 leading-relaxed">
            Websites, local presence, front desk, bookings and reporting — run from a
            single console, and visible to each client in their own portal.
          </p>
        </div>
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} AgastyaOne. End-to-end business solutions.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-lg bg-brand grid place-items-center font-bold text-white">A</div>
            <span className="text-lg font-semibold tracking-tight">AgastyaOne</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-muted mt-1.5">
            Clients sign in with an email link. Team members can use a password.
          </p>
          <div className="mt-8">
            <SignInForm />
          </div>
        </div>
      </div>
    </main>
  );
}
