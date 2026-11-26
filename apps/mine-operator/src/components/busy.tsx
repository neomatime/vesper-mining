/**
 * A button's words while it works: a small spinner and the "…ing" label (for example "Saving…"), otherwise the normal label.
 * The button itself is disabled by its owner while the request runs, so a second click cannot submit twice.
 */
export function Busy({ pending, label, children }: { pending: boolean; label: string; children: React.ReactNode }) {
  if (!pending) return <>{children}</>;
  return (
    <>
      <span className="busy-spinner" aria-hidden="true" />
      {label}
    </>
  );
}
