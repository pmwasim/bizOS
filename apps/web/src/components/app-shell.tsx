import {
  Banknote,
  FileText,
  Home,
  LogOut,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { type EnabledModuleSummary } from "@bizo/contracts/configuration";

import { signOutAction } from "@/app/actions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Maps module codes (from the configuration snapshot) to nav items. Only
// implemented modules reach the nav (the API filters on implemented=true),
// so we don't need to re-check that here. Settings and Home are always
// present because they are workspace-level, not module-level.
const MODULE_NAV: Record<string, { href: string; label: string; icon: LucideIcon }> = {
  customers: { href: "/customers", label: "Customers", icon: Users },
  quotations: { href: "/quotations", label: "Quotations", icon: FileText },
  "purchase-orders": { href: "/purchase-orders", label: "POs", icon: Receipt },
  invoices: { href: "/invoices", label: "Invoices", icon: ScrollText },
  payments: { href: "/payments", label: "Payments", icon: Banknote },
};

function buildNavItems(modules: EnabledModuleSummary[]): NavItem[] {
  const items: NavItem[] = [{ href: "", label: "Home", icon: Home }];
  for (const moduleSummary of modules) {
    const entry = MODULE_NAV[moduleSummary.code];
    if (!entry) continue;
    items.push({ href: entry.href, label: entry.label, icon: entry.icon });
  }
  items.push({ href: "/settings", label: "Settings", icon: Settings });
  return items;
}

export function AppShell({
  businessId,
  businessName,
  modules = [],
  isSystemAdmin = false,
  children,
}: {
  businessId: string;
  businessName: string;
  modules?: EnabledModuleSummary[];
  isSystemAdmin?: boolean;
  children: React.ReactNode;
}) {
  const items = buildNavItems(modules);
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
        {isSystemAdmin ? (
          <Link className="side-nav-admin" href="/admin">
            <ShieldCheck aria-hidden="true" size={18} />
            System Admin
          </Link>
        ) : null}
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
