export function Field({
  label,
  error,
  hint,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`form-field ${wide ? "form-field--wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && !error ? <small className="field-hint">{hint}</small> : null}
      {error ? <small className="field-error" role="alert">{error}</small> : null}
    </label>
  );
}
