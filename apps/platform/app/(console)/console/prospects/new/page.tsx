import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import NewProspectForm from './form';

export default function NewProspectPage() {
  return (
    <>
      <PageHeader
        title="Add a prospect"
        description="No GSTIN, billing, or contract needed — just enough to run an audit."
        action={<Link href="/console/prospects" className="btn-secondary">Cancel</Link>}
      />
      <div className="p-8 max-w-2xl">
        <NewProspectForm />
      </div>
    </>
  );
}
