/**
 * The loading, error and empty states used by every screen that reads data, so they look and read the same everywhere.
 *
 * Loading shows a skeleton shaped like what is coming (a register, a dashboard, a record or a panel), so the page does not jump when
 * the data arrives. Screens keep their data while it refreshes in the background (TanStack Query), so these show only on first load.
 */
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Busy } from "./busy";

export type LoadingVariant = "page" | "dashboard" | "detail" | "panel";

const rows = (count: number) => Array.from({ length: count }, (_, index) => <div key={index} className="skeleton skeleton--table-row" />);

export function LoadingState({ label = "Loading", variant = "page" }: { label?: string; variant?: LoadingVariant }) {
  return (
    <div className={`skeleton-page skeleton-page--${variant}`} aria-live="polite" aria-busy="true" role="status">
      {variant === "panel" ? (
        <div className="skeleton-panel state-panel--loading">
          <div className="skeleton skeleton--title" />
          {rows(3)}
        </div>
      ) : (
        <>
          {variant === "detail" ? (
            <div className="skeleton-detail-head">
              <div className="skeleton skeleton--mark" />
              <div className="skeleton-page__header" style={{ flex: 1 }}>
                <div className="skeleton skeleton--heading" />
                <div className="skeleton skeleton--line" />
              </div>
            </div>
          ) : (
            <div className="skeleton-page__header">
              <div className="skeleton skeleton--eyebrow" />
              <div className="skeleton skeleton--heading" />
              <div className="skeleton skeleton--line" />
            </div>
          )}
          <div className="skeleton-tiles">{Array.from({ length: variant === "detail" ? 4 : 5 }, (_, index) => <div key={index} className="skeleton skeleton--tile" />)}</div>
          {variant === "dashboard" ? (
            <div className="skeleton-split">
              <div className="skeleton skeleton--hero" />
              <div className="skeleton skeleton--panel" />
            </div>
          ) : variant === "detail" ? (
            <div className="skeleton-split">
              <div className="skeleton-card">{rows(5)}</div>
              <div className="skeleton-card">{rows(3)}</div>
            </div>
          ) : (
            <div className="skeleton-card">
              <div className="skeleton-card__toolbar">
                <div className="skeleton skeleton--search" />
                <div className="skeleton skeleton--chip" />
                <div className="skeleton skeleton--chip" />
              </div>
              {rows(6)}
            </div>
          )}
        </>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry, retrying = false }: { message?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <h2>This view could not be loaded</h2>
        <p>{message ?? "Your work is saved. Try again."}</p>
      </div>
      {onRetry ? (
        <button className="button button--quiet" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
          {retrying ? <Busy pending label="Retrying…">Retry</Busy> : <><RefreshCw size={16} aria-hidden="true" /> Retry</>}
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
