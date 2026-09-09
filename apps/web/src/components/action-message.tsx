export function ActionMessage({ error }: { error?: string | undefined }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert" aria-live="polite">
      {error}
    </div>
  );
}

function fieldErrorId(name: string) {
  return `${name}-error`;
}

/** Spread onto a field's input/select/textarea to associate it with its error, if any. */
export function fieldA11y(fieldErrors: Record<string, string> | undefined, name: string) {
  return fieldErrors?.[name]
    ? { "aria-invalid": true as const, "aria-describedby": fieldErrorId(name) }
    : {};
}

/** Inline field-level error; place immediately after the input it describes. */
export function FieldError({
  name,
  fieldErrors,
}: {
  name: string;
  fieldErrors: Record<string, string> | undefined;
}) {
  const message = fieldErrors?.[name];
  if (!message) return null;
  return (
    <span id={fieldErrorId(name)} className="field-error" role="alert">
      {message}
    </span>
  );
}
