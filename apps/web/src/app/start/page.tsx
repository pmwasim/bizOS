import { redirect } from "next/navigation";

import { BusinessForm } from "@/components/business-form";
import { loadWorkspace } from "@/lib/workspace";

export default async function StartPage() {
  const workspace = await loadWorkspace();
  if (workspace.businesses[0]) redirect(`/b/${workspace.businesses[0].id}`);

  return (
    <main className="setup-page">
      <div className="setup-progress" aria-label="Setup progress">
        <span className="done">Account</span>
        <span className="active">Business</span>
        <span>Customer</span>
        <span>Quotation</span>
      </div>
      <section className="setup-panel">
        <div className="page-heading compact">
          <span className="step-label">Step 2 of 4</span>
          <h1>Tell us about your business</h1>
          <p>We’ll use these details to prepare your quotation.</p>
        </div>
        <BusinessForm />
      </section>
    </main>
  );
}
