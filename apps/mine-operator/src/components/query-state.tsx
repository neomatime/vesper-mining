import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-panel state-panel--loading" aria-live="polite" aria-busy="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--row" />
      <div className="skeleton skeleton--row" />
      <div className="skeleton skeleton--row skeleton--short" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <h2>This view could not be loaded</h2>
        <p>{message ?? "Your work is saved. Try again."}</p>
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
