export function ActionMessage({ error }: { error?: string | undefined }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert" aria-live="polite">
      {error}
    </div>
  );
}
