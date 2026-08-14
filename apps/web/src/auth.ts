import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticatedUserSchema, verifyCredentialsRequestSchema } from "@bizo/contracts/auth";
import { readWebEnvironment } from "@bizo/config/web";

import { clientIpHeaders } from "@/lib/client-ip";

export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = verifyCredentialsRequestSchema.safeParse({
          email: credentials.email,
          password: credentials.password,
        });
        if (!parsed.success) return null;

        const clientIp = await clientIpHeaders();
        const response = await fetch(
          `${readWebEnvironment(process.env).API_INTERNAL_URL}/auth/verify`,
          {
            cache: "no-store",
            headers: {
              "content-type": "application/json",
              ...clientIp,
            },
            method: "POST",
            body: JSON.stringify(parsed.data),
          },
        );
        if (!response.ok) return null;
        return authenticatedUserSchema.parse(await response.json());
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        const u = user as { tenantId?: string; businessId?: string };
        if (u.tenantId) token.tenantId = u.tenantId;
        if (u.businessId) token.businessId = u.businessId;
      }
      if (trigger === "update" && session) {
        if (session.tenantId !== undefined) token.tenantId = session.tenantId;
        if (session.businessId !== undefined) token.businessId = session.businessId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      const s = session as unknown as Record<string, unknown>;
      if (typeof token.tenantId === "string") {
        s.tenantId = token.tenantId;
      }
      if (typeof token.businessId === "string") {
        s.businessId = token.businessId;
      }
      return session;
    },
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
});
