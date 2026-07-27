import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { loadWorkspace } from "@/lib/workspace";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const workspace = await loadWorkspace();
  const business = workspace.businesses.find((item) => item.id === businessId);
  if (!business) notFound();

  return (
    <AppShell businessId={business.id} businessName={business.name}>
      {children}
    </AppShell>
  );
}
