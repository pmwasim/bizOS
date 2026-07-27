import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { requireSystemAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/actions";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/customization-requests", label: "Customization Requests" },
  { href: "/admin/audit-events", label: "Audit Events" },
  { href: "/admin/default-erp", label: "Default ERP" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const principal = await requireSystemAdmin();

  return (
    <div className="admin-frame">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <ShieldCheck aria-hidden="true" size={20} />
          <span>bizOS Admin</span>
        </Link>
        <div className="admin-principal-chip" title={principal.systemAdminId}>
          <span>SA</span>
          <strong>System Admin</strong>
        </div>
        <nav className="admin-nav" aria-label="System Admin">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="admin-signout">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="admin-workspace">{children}</main>
    </div>
  );
}
