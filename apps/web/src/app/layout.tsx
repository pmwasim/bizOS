import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "bizOS — Quotations and invoices for service businesses",
    template: "%s · bizOS",
  },
  description:
    "Create customers, send polished quotations, and turn them into invoices. Private beta.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
