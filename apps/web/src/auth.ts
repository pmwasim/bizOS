import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticatedUserSchema, verifyCredentialsRequestSchema } from "@bizo/contracts/auth";
import { readWebEnvironment } from "@bizo/config/web";

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

        const response = await fetch(
          `${readWebEnvironment(process.env).API_INTERNAL_URL}/auth/verify`,
          {
            cache: "no-store",
            headers: { "content-type": "application/json" },
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
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
});
