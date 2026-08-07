import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

type SignInPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function safeCallbackUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/start";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  if (session) redirect("/start");

  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const hasCredentialError = params.error === "CredentialsSignin";

  async function authenticate(formData: FormData) {
    "use server";

    const email = formData.get("email");
    const password = formData.get("password");

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const query = new URLSearchParams({
          error: "CredentialsSignin",
          callbackUrl,
        });
        redirect(`/signin?${query.toString()}`);
      }
      throw error;
    }
  }

  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        bizOS
      </Link>

      <section className="auth-panel" aria-labelledby="signin-heading">
        <div className="page-heading compact">
          <span className="step-label">Welcome back</span>
          <h1 id="signin-heading">Sign in to bizOS</h1>
          <p>Use the email and password for your bizOS account.</p>
        </div>

        <form action={authenticate} className="form-stack">
          {hasCredentialError ? (
            <div className="form-error" role="alert">
              Email or password is incorrect. Please try again.
            </div>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              required
              type="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input autoComplete="current-password" name="password" required type="password" />
          </label>

          <button className="button button-primary" type="submit">
            Sign in
          </button>
        </form>

        <p className="auth-note">
          Access is limited to accounts already enabled for the private beta. If you need access,
          return to the home page and use the beta request flow.
        </p>
      </section>
    </main>
  );
}
