"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordResetAction, type PasswordResetState } from "@/app/actions";

const initialState: PasswordResetState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        bizOS
      </Link>

      <section className="auth-panel" aria-labelledby="forgot-heading">
        <div className="page-heading compact">
          <span className="step-label">Password help</span>
          <h1 id="forgot-heading">Reset your password</h1>
          <p>Enter your account email and we will send you a link to choose a new password.</p>
        </div>

        {state.sent ? (
          <>
            <div className="form-success" role="status" aria-live="polite">
              If an account exists for that email, a reset link is on its way. The link works once
              and expires in 15 minutes.
            </div>
            <p className="auth-note">
              <Link href="/signin">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <form className="form-stack" action={formAction}>
              {state.error ? (
                <div className="form-error" role="alert" aria-live="polite">
                  {state.error}
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

              <button className="button button-primary" disabled={pending} type="submit">
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="auth-note">
              Remembered it? <Link href="/signin">Sign in instead</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
