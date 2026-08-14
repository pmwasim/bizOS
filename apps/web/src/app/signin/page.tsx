"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

function safeCallbackUrl(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/start";
}

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

      const callbackUrl = safeCallbackUrl(
        new URLSearchParams(window.location.search).get("callbackUrl"),
      );
      window.location.assign(callbackUrl);
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
          Access is limited to accounts already enabled for the private beta.
        </p>
      </section>
    </main>
  );
}
