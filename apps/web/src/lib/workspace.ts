import { redirect } from "next/navigation";

import { type CurrentUserWorkspace } from "@bizo/contracts/platform";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session;
}

export async function loadWorkspace(): Promise<CurrentUserWorkspace> {
  await requireUser();
  return apiJson<CurrentUserWorkspace>("/me");
}
