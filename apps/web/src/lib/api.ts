import { SignJWT } from "jose";

import { readWebEnvironment } from "@bizo/config/web";

import { auth } from "@/auth";
import { clientIpHeaders } from "@/lib/client-ip";

interface ProblemDetails {
  detail?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: ProblemDetails["errors"] = [],
  ) {
    super(message);
  }
}

function environment() {
  return readWebEnvironment(process.env);
}

export async function publicApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const clientIp = await clientIpHeaders();
  return fetch(`${environment().API_INTERNAL_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...clientIp,
      ...init?.headers,
    },
  });
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError("Sign in to continue.", 401);
  }
  const env = environment();
  const clientIp = await clientIpHeaders();
  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("bizo-web")
    .setAudience("bizo-api")
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(env.INTERNAL_AUTH_SECRET));

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${assertion}`);
  for (const [key, value] of Object.entries(clientIp)) {
    headers.set(key, value);
  }
  if (!(init?.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${env.API_INTERNAL_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemDetails;
    throw new ApiError(problem.detail ?? "We could not complete that request.", response.status);
  }
  return (await response.json()) as T;
}
