"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/customization-requests", label: "Customization Requests" },
  { href: "/admin/audit-events", label: "Audit Events" },
  { href: "/admin/default-erp", label: "Default ERP" },
];

export function AdminNav() {
  const pathname = usePathname();

  function checkIsActive(href: string) {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="admin-nav" aria-label="System Admin">
      {NAV_ITEMS.map((item) => {
        const isActive = checkIsActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "active" : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
