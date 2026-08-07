import {
  Boxes,
  Briefcase,
  FileBarChart,
  FileText,
  Home,
  LogOut,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Undo2,
  UserPlus,
  Users,
  Wallet,
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

// Maps module codes (from the configuration snapshot, see module-catalog.ts) to nav items.
// `payments` and `statements` shipped before the module catalog tracked them accurately (older
// businesses' assigned configuration version predates those codes), so they are force-included
// below regardless of the module list — every business gets them. Everything else here only
// shows up for businesses whose assigned configuration version actually enables that module.
const MODULE_NAV: Record<string, { href: string; label: string; icon: LucideIcon }> = {
  customers: { href: "/customers", label: "Customers", icon: Users },
  quotations: { href: "/quotations", label: "Quotations", icon: FileText },
  "purchase-orders": { href: "/purchase-orders", label: "POs", icon: Receipt },
  invoices: { href: "/invoices", label: "Invoices", icon: ScrollText },
  payments: { href: "/payments", label: "Payments", icon: Wallet },
  statements: { href: "/statements", label: "Statements", icon: FileBarChart },
  "sales-orders": { href: "/sales-orders", label: "Sales Orders", icon: Truck },
  "delivery-service": { href: "/delivery-notes", label: "Delivery Notes", icon: Truck },
  "credit-notes": { href: "/credit-notes", label: "Credit Notes", icon: Undo2 },
  inventory: { href: "/inventory", label: "Inventory", icon: Boxes },
  projects: { href: "/projects", label: "Projects", icon: Briefcase },
  leads: { href: "/leads", label: "Leads", icon: UserPlus },
  opportunities: { href: "/opportunities", label: "Opportunities", icon: Target },
  suppliers: { href: "/suppliers", label: "Suppliers", icon: Truck },
};

const ALWAYS_ON_CODES = ["payments", "statements"] as const;

function buildNavItems(modules: EnabledModuleSummary[]): NavItem[] {
  const items: NavItem[] = [{ href: "", label: "Home", icon: Home }];
  const codes = new Set(modules.map((m) => m.code));
  for (const code of ALWAYS_ON_CODES) codes.add(code);
  for (const code of codes) {
    const entry = MODULE_NAV[code];
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
