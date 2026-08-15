"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { confirmPasswordResetAction, type PasswordResetState } from "@/app/actions";

const initialState: PasswordResetState = {};

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, formAction, pending] = useActionState(confirmPasswordResetAction, initialState);

  if (!token) {
    return (
      <>
        <div className="form-error" role="alert">
          This reset link is incomplete. Request a new one to continue.
        </div>
        <p className="auth-note">
          <Link href="/forgot-password">Request a new reset link</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <form className="form-stack" action={formAction}>
        {state.error ? (
          <div className="form-error" role="alert" aria-live="polite">
            {state.error}
          </div>
        ) : null}

        <input name="token" type="hidden" value={token} />

        <label className="field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            autoFocus
            disabled={pending}
            name="password"
            required
            type="password"
          />
          <small>
            At least 10 characters, including an uppercase letter, a lowercase letter, and a number.
          </small>
        </label>

        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Saving…" : "Set new password"}
        </button>
      </form>

      <p className="auth-note">
        Link expired? <Link href="/forgot-password">Request a new one</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        bizOS
      </Link>

      <section className="auth-panel" aria-labelledby="reset-heading">
        <div className="page-heading compact">
          <span className="step-label">Password help</span>
          <h1 id="reset-heading">Choose a new password</h1>
          <p>Pick a password you do not use anywhere else.</p>
        </div>

        <Suspense fallback={<p>Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
