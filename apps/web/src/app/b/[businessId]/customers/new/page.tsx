import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { CustomerForm } from "@/components/customer-form";

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return (
    <div className="page narrow-page">
      <Link className="back-link" href={`/b/${businessId}`}>
        <ChevronLeft aria-hidden="true" size={18} /> Back
      </Link>
      <header className="page-heading">
        <span className="step-label">Step 3 of 4</span>
        <h1>Who is this quotation for?</h1>
        <p>Add only what you know. You can fill in the rest later.</p>
      </header>
      <CustomerForm businessId={businessId} />
    </div>
  );
}
