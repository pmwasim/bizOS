import { AuthForm } from "@/components/auth-form";

export default function SignUpPage() {
  return (
    <>
      <div className="page-heading compact">
        <span className="step-label">Step 1 of 4</span>
        <h1>Create your account</h1>
        <p>You’ll create your business next. It takes about a minute.</p>
      </div>
      <AuthForm mode="signup" />
    </>
  );
}
