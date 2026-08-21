import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { requireSystemAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";

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
        <AdminNav />
        <form action={signOutAction} className="admin-signout">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="admin-workspace">{children}</main>
    </div>
  );
}
