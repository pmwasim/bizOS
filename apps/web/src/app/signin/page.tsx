"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

const DEFAULT_CALLBACK_PATH = "/start";

/**
 * Resolve the post-sign-in destination to a URL that is provably on this origin.
 *
 * `callbackUrl` arrives from the query string, so it is attacker-controlled: a bare
 * `startsWith("/")` check is not enough (`/\evil.com`, `/\/evil.com` and backslash variants are
 * normalised to another origin by some browsers). Parsing against `window.location.origin` and
 * then rejecting anything whose resolved origin differs closes that open-redirect
 * (CodeQL js/client-side-unvalidated-url-redirection).
 */
function safeCallbackUrl(value: string | null, origin: string): string {
  const fallback = new URL(DEFAULT_CALLBACK_PATH, origin).href;

  if (!value || !/^\/[^/\\]/.test(value)) {
    return fallback;
  }

  try {
    const resolved = new URL(value, origin);
    return resolved.origin === origin ? resolved.href : fallback;
  } catch {
    return fallback;
  }
}

function SignInView() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const justReset = useSearchParams().get("reset") === "1";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result?.ok) {
        setError("Email or password is incorrect. Please try again.");
        return;
      }

      window.location.assign(
        safeCallbackUrl(
          new URLSearchParams(window.location.search).get("callbackUrl"),
          window.location.origin,
        ),
      );
    } catch {
      setError("Sign in is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
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

        <form className="form-stack" onSubmit={handleSubmit}>
          {justReset ? (
            <div className="form-success" role="status" aria-live="polite">
              Your password has been updated. Sign in with your new password.
            </div>
          ) : null}

          {error ? (
            <div className="form-error" role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              autoFocus
              disabled={pending}
              inputMode="email"
              name="email"
              required
              type="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              disabled={pending}
              name="password"
              required
              type="password"
            />
          </label>

          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-note">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>

        <p className="auth-note">
          Access is limited to accounts already enabled for the private beta.
        </p>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInView />
    </Suspense>
  );
}
