import { FileText, Home, LogOut, Receipt, ScrollText, Settings, Users } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/actions";

const items = [
  { href: "", label: "Home", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/purchase-orders", label: "POs", icon: Receipt },
  { href: "/invoices", label: "Invoices", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  businessId,
  businessName,
  children,
}: {
  businessId: string;
  businessName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href={`/b/${businessId}`}>
          bizOS
        </Link>
        <div className="business-chip">
          <span>{businessName.slice(0, 1).toUpperCase()}</span>
          <strong>{businessName}</strong>
        </div>
        <nav className="side-nav" aria-label="Workspace">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={`/b/${businessId}${href}`}>
              <Icon aria-hidden="true" size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="signout">
          <button type="submit">
            <LogOut aria-hidden="true" size={18} /> Sign out
          </button>
        </form>
      </aside>
      <main className="workspace">{children}</main>
      <nav className="mobile-nav" aria-label="Workspace">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={`/b/${businessId}${href}`}>
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
