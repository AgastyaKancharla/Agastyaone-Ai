import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import NewClientForm from './form';

export default function NewClientPage() {
  return (
    <>
      <PageHeader
        title="Add a client"
        description="Creates the account, its first location, and the portal they will sign into."
        action={<Link href="/console/clients" className="btn-secondary">Cancel</Link>}
      />
      <div className="p-8 max-w-3xl">
        <NewClientForm />
      </div>
    </>
  );
}
