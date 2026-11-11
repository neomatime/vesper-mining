import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export function LoadingState({ label = "Loading simulated records" }: { label?: string }) {
  return (
    <div className="state-panel" aria-live="polite">
      <div className="skeleton skeleton--title" />
      <div className="skeleton" />
      <div className="skeleton skeleton--short" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <h2>This demo view could not be loaded</h2>
        <p>{message ?? "Your context is preserved. Retry the simulated request."}</p>
      </div>
      {onRetry ? (
        <button className="button button--quiet" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-panel">
      <Inbox size={24} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
