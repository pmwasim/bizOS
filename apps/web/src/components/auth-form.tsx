"use client";

import Link from "next/link";
import { useActionState } from "react";

import { type ActionState, signInAction, signUpAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const signup = mode === "signup";

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      {signup ? (
        <label className="field">
          <span>Your name</span>
          <input name="displayName" autoComplete="name" required minLength={2} autoFocus />
        </label>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus={!signup}
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 10 : 1}
        />
        {signup ? <small>10+ characters with upper, lower, and a number.</small> : null}
      </label>
      <SubmitButton pendingText={signup ? "Creating account…" : "Signing in…"}>
        {signup ? "Create my account" : "Sign in"}
      </SubmitButton>
      <p className="form-switch">
        {signup ? "Already have an account? " : "New to bizOS? "}
        <Link href={signup ? "/signin" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link>
      </p>
    </form>
  );
}
