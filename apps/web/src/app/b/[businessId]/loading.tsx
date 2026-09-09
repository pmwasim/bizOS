import { Loader2 } from "lucide-react";

// Shown by Next.js while any page under /b/[businessId] awaits its server-side data fetch --
// covers the dashboard and every workspace route (customers, quotations, invoices, payments,
// inventory, projects, CRM, ...) with one file instead of per-route duplicates.
export default function WorkspaceLoading() {
  return (
    <div
      className="page"
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        minHeight: "50vh",
      }}
    >
      <Loader2 aria-hidden="true" className="spin" size={28} />
      <span>Loading…</span>
    </div>
  );
}
