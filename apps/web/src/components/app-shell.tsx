"use client";

import {
  Banknote,
  Building,
  FileText,
  Folder,
  Home,
  List,
  LogOut,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type EnabledModuleSummary } from "@bizo/contracts/configuration";

import { signOutAction } from "@/app/actions";
import { type BusinessOption, WorkspaceSwitcher } from "@/components/workspace-switcher";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Maps module codes (from the configuration snapshot) to nav items. Only
// implemented modules reach the nav (the API filters on implemented=true).
// Settings and Home are always present because they are workspace-level.
const MODULE_NAV: Record<string, { href: string; label: string; icon: LucideIcon }> = {
  customers: { href: "/customers", label: "Customers", icon: Users },
  suppliers: { href: "/suppliers", label: "Suppliers", icon: Building },
  quotations: { href: "/quotations", label: "Quotations", icon: FileText },
  "sales-orders": { href: "/sales-orders", label: "Sales Orders", icon: List },
  "delivery-notes": { href: "/delivery-notes", label: "Delivery", icon: Truck },
  invoices: { href: "/invoices", label: "Invoices", icon: ScrollText },
  "credit-notes": { href: "/credit-notes", label: "Credit Notes", icon: Receipt },
  payments: { href: "/payments", label: "Payments", icon: Banknote },
  crm: { href: "/leads", label: "CRM", icon: Target },
  projects: { href: "/projects", label: "Projects", icon: Folder },
  inventory: { href: "/inventory", label: "Inventory", icon: Package },
};

function buildNavItems(modules: EnabledModuleSummary[]): NavItem[] {
  const items: NavItem[] = [{ href: "", label: "Home", icon: Home }];
  for (const moduleSummary of modules) {
    const entry = MODULE_NAV[moduleSummary.code];
    if (!entry) continue;
    items.push({ href: entry.href, label: entry.label, icon: entry.icon });
  }
  // Receivables and account statements are the read side of the payments module — they are
  // authorized by payments:read and have no module code of their own, so they follow that module
  // into the nav rather than being reachable only by typing the URL.
  if (modules.some((moduleSummary) => moduleSummary.code === "payments")) {
    items.push({ href: "/statements", label: "Money Owed", icon: Wallet });
    items.push({ href: "/payables", label: "Bills to Pay", icon: Wallet });
  } else if (!items.some((i) => i.href === "/payments")) {
    items.push({ href: "/payments", label: "Payments", icon: Banknote });
  }
  items.push({ href: "/settings", label: "Settings", icon: Settings });
  return items;
}

export function AppShell({
  businessId,
  businessName,
  businesses = [],
  modules = [],
  isSystemAdmin = false,
  children,
}: {
  businessId: string;
  businessName: string;
  businesses?: BusinessOption[];
  modules?: EnabledModuleSummary[];
  isSystemAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = buildNavItems(modules);
  const basePath = `/b/${businessId}`;

  function checkIsActive(href: string) {
    const target = `${basePath}${href}`;
    if (href === "") {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(target);
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href={`/b/${businessId}`}>
          bizOS
        </Link>
        <WorkspaceSwitcher
          currentBusinessId={businessId}
          currentBusinessName={businessName}
          businesses={businesses}
        />
        <nav className="side-nav" aria-label="Workspace">
          {items.map(({ href, label, icon: Icon }) => {
            const isActive = checkIsActive(href);
            return (
              <Link
                key={label}
                href={`${basePath}${href}`}
                className={isActive ? "active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={19} />
                {label}
              </Link>
            );
          })}
        </nav>
        {isSystemAdmin ? (
          <Link
            className={`side-nav-admin ${pathname.startsWith("/admin") ? "active" : ""}`}
            href="/admin"
          >
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
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = checkIsActive(href);
          return (
            <Link
              key={label}
              href={`${basePath}${href}`}
              className={isActive ? "active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={19} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
