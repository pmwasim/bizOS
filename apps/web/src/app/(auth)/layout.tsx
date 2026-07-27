import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await auth()) redirect("/start");
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        bizOS
      </Link>
      <section className="auth-panel">{children}</section>
      <p className="auth-note">Simple tools for small business teams.</p>
    </main>
  );
}
