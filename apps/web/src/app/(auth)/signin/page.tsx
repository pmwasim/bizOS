import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <>
      <div className="page-heading compact">
        <h1>Welcome back</h1>
        <p>Sign in to continue where you left off.</p>
      </div>
      <AuthForm mode="signin" />
    </>
  );
}
