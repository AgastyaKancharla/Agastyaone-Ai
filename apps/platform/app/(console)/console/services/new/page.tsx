import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import NewServiceForm from './form';

export default function NewServicePage() {
  return (
    <>
      <PageHeader
        title="Add a service"
        description="Starts as a draft by default — flip it to active once the price and GST rate are right."
        action={
          <Link href="/console/services" className="btn-secondary">
            Cancel
          </Link>
        }
      />
      <div className="p-8 max-w-2xl">
        <NewServiceForm />
      </div>
    </>
  );
}
