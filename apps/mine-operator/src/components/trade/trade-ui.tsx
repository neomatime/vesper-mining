"use client";

/**
 * Shared pieces of the Trade screens, built on the existing VESPER components and classes (page header, cards, KPI row, data table,
 * status badge, dialog, field). A register here adds what the commercial lists need: sortable columns, filter chips, extra filters and
 * pagination, with the same empty and loading states as the rest of VESPER.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Ellipsis, Lock, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { formatPercent, formatRand } from "@/lib/trade-rules";
import { PageHeader } from "../page-header";
import { Tick } from "../tick";
import { ErrorState, LoadingState, type LoadingVariant } from "../query-state";
import { StatusBadge } from "../status-badge";
import { useDismiss } from "../use-dismiss";
import { useTrade, type TradeView } from "../use-trade";

/** Loads the Trade data once and hands it to the page; shows the shared loading and error states meanwhile. */
export function TradeData({ children, label = "Loading Trade", variant = "page" }: { children: (data: TradeView) => React.ReactNode; label?: string; variant?: LoadingVariant }) {
  const query = useTrade();
  if (query.isPending) return <LoadingState label={label} variant={variant} />;
  // A failed background refresh keeps the records on screen; only a failed first load shows the error.
  if (!query.data) return <ErrorState message={query.error instanceof Error ? query.error.message : "Trade could not be loaded."} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  return <>{children(query.data)}</>;
}

export function TradeHeader({ eyebrow = "Commercial Operations · Trade", title, description, icon, actions }: { eyebrow?: string; title: string; description: string; icon?: LucideIcon; actions?: React.ReactNode }) {
  return <PageHeader eyebrow={eyebrow} title={title} description={description} icon={icon} action={actions ? <div className="header-actions">{actions}</div> : undefined} />;
}

export type Kpi = { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: "attention" | "critical" };

export function KpiTiles({ items, label = "Summary" }: { items: Kpi[]; label?: string }) {
  return (
    <section className="trade-kpis" aria-label={label}>
      {items.map((item) => (
        <article key={item.label} className={`trade-kpi ${item.tone ? `trade-kpi--${item.tone}` : ""}`}>
          <span className="trade-kpi__icon" aria-hidden="true"><item.icon /></span>
          <div>
            <span className="trade-kpi__label">{item.label}</span>
            <strong><Tick value={item.value} /></strong>
            {item.hint ? <small>{item.hint}</small> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

/** Money when the person may see it; a clear "Restricted" otherwise. Never a zero in place of a hidden figure. */
export function Money({ value, exact = false }: { value: number | null; exact?: boolean }) {
  if (value === null) return <span className="trade-restricted" title="Prices are shown to the Mine Manager and the Commercial / Finance Officer"><Lock aria-hidden="true" /> Restricted</span>;
  return <>{exact ? `R ${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatRand(value)}</>;
}

export function Progress({ share, label, tone }: { share: number; label?: string; tone?: "positive" | "warning" | "danger" }) {
  const resolved = tone ?? (share >= 0.85 ? "positive" : share >= 0.6 ? "warning" : "danger");
  return (
    <span className="trade-progress" role="img" aria-label={label ?? `${formatPercent(share)} complete`}>
      <span className="trade-progress__value">{formatPercent(share)}</span>
      <span className="trade-progress__track"><span className={`trade-progress__bar trade-progress__bar--${resolved}`} style={{ "--share": Math.max(0, Math.min(1, share)) } as React.CSSProperties} /></span>
    </span>
  );
}

/** A status as the shared badge: `family` picks the colour family (done, attention, critical, waiting, unknown) and `label` the words. */
export function Status({ family, label }: { family: "done" | "active" | "attention" | "critical" | "waiting" | "unknown"; label: string }) {
  const value = { done: "confirmed", active: "in_progress", attention: "at_risk", critical: "overdue", waiting: "pending", unknown: "unknown" }[family];
  return <StatusBadge value={value} label={label} />;
}

export function RailCard({ title, action, children, label }: { title: string; action?: { label: string; href?: string; onClick?: () => void }; children: React.ReactNode; label?: string }) {
  return (
    <article className="card trade-rail-card" aria-label={label ?? title}>
      <header className="trade-rail-card__header">
        <h2>{title}</h2>
        {action ? (action.href ? <Link className="row-link-text trade-rail-card__action" href={action.href}>{action.label} <ArrowRight aria-hidden="true" /></Link> : <button type="button" className="row-link-text trade-rail-card__action" onClick={action.onClick}>{action.label} <ArrowRight aria-hidden="true" /></button>) : null}
      </header>
      {children}
    </article>
  );
}

export function RailList({ items, empty }: { items: { key: string; icon?: LucideIcon; title: React.ReactNode; detail?: React.ReactNode; aside?: React.ReactNode; href?: string; tone?: "attention" | "critical" }[]; empty: string }) {
  if (items.length === 0) return <p className="muted trade-rail-empty">{empty}</p>;
  return (
    <ul className="trade-rail-list">
      {items.map((item) => {
        const body = (
          <>
            {item.icon ? <span className={`trade-rail-list__icon ${item.tone ? `trade-rail-list__icon--${item.tone}` : ""}`} aria-hidden="true"><item.icon /></span> : null}
            <span className="trade-rail-list__copy"><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>
            {item.aside ? <span className="trade-rail-list__aside">{item.aside}</span> : null}
            {item.href ? <ChevronRight className="trade-rail-list__chevron" aria-hidden="true" /> : null}
          </>
        );
        return <li key={item.key}>{item.href ? <Link href={item.href}>{body}</Link> : <div>{body}</div>}</li>;
      })}
    </ul>
  );
}

/** A ring chart with a legend. Each segment says its own value in words, so colour is not the only cue. */
export function Donut({ segments, centre, caption, label }: { segments: { label: string; value: number; tone: "positive" | "warning" | "danger" | "neutral" | "info"; display?: string }[]; centre: string; caption: string; label: string }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="trade-donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${segments.map((item) => `${item.label} ${item.display ?? item.value}`).join(", ")}`}>
        <circle cx="50" cy="50" r={radius} className="trade-donut__track" />
        {total > 0
          ? segments.filter((item) => item.value > 0).map((item) => {
              const length = (item.value / total) * circumference;
              const circle = <circle key={item.label} cx="50" cy="50" r={radius} className={`trade-donut__segment trade-donut__segment--${item.tone}`} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />;
              offset += length;
              return circle;
            })
          : null}
        <text x="50" y="49" className="trade-donut__centre">{centre}</text>
        <text x="50" y="62" className="trade-donut__caption">{caption}</text>
      </svg>
      <ul className="trade-legend">
        {segments.map((item) => (
          <li key={item.label}><span className={`trade-legend__dot trade-legend__dot--${item.tone}`} aria-hidden="true" />{item.label}<strong>{item.display ?? (total ? formatPercent(item.value / total) : "0%")}</strong></li>
        ))}
      </ul>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  const back = [...items].reverse().find((item) => item.href);
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {back?.href ? <Link href={back.href} aria-label="Back"><ArrowLeft aria-hidden="true" /></Link> : null}
      {items.map((item, index) => (
        <span key={item.label} className="trade-crumb">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Tabs that switch a panel on the same page. Arrow keys move between tabs. */
export function TabBar<T extends string>({ tabs, active, onChange, label }: { tabs: { key: T; label: string; icon?: LucideIcon; count?: number }[]; active: T; onChange: (key: T) => void; label: string }) {
  return (
    <div className="tabs module-tabs trade-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          role="tab"
          id={`tab-${tab.key}`}
          aria-selected={tab.key === active}
          aria-controls={`panel-${tab.key}`}
          tabIndex={tab.key === active ? 0 : -1}
          className={`tab ${tab.key === active ? "tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
            onChange(next.key);
            (event.currentTarget.parentElement?.querySelector(`#tab-${next.key}`) as HTMLElement | null)?.focus();
          }}
        >
          {tab.icon ? <tab.icon aria-hidden="true" /> : null}
          {tab.label}
          {tab.count !== undefined ? <em>{tab.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export type MenuAction = { label: string; onClick?: () => void; href?: string; danger?: boolean; hidden?: boolean };

/** A row's "more actions" menu. */
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const visible = actions.filter((item) => !item.hidden);
  if (visible.length === 0) return null;
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="icon-button icon-button--light" data-menu-trigger aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}><Ellipsis /></button>
      {open ? (
        <div className="popover popover--menu trade-menu" role="group" aria-label={label}>
          <div className="menu-section">
            {visible.map((item) =>
              item.href ? (
                <Link key={item.label} className="menu-item" href={item.href} onClick={close}>{item.label}</Link>
              ) : (
                <button key={item.label} className={`menu-item ${item.danger ? "menu-item--danger" : ""}`} onClick={() => { close(); item.onClick?.(); }}>{item.label}</button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- The register --------------------------------------------------------------------------------------------------------

export type Column<T> = { key: string; label: string; render: (row: T) => React.ReactNode; sort?: (row: T) => string | number; align?: "end" };
export type Chip<T> = { key: string; label: string; test: (row: T) => boolean };

export function Register<T extends { id: string }>({
  title,
  noun,
  rows,
  columns,
  chips = [],
  search,
  searchLabel,
  href,
  actions,
  extra,
  pageSize = 8,
  initialChip = "all",
  initialSort,
  empty,
  toolbarEnd,
  beforeToolbar,
  rowClass,
}: {
  title: string;
  /** Plural, as in "Showing 1 – 8 of 14 agreements". */
  noun: string;
  rows: T[];
  columns: Column<T>[];
  chips?: Chip<T>[];
  search: (row: T) => string;
  searchLabel: string;
  href?: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
  /** Extra filters, such as a select. Return true to keep the row. */
  extra?: { controls: React.ReactNode; test: (row: T) => boolean; active: boolean; clear: () => void };
  pageSize?: number;
  initialChip?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
  empty: { title: string; body: string; action?: React.ReactNode };
  toolbarEnd?: React.ReactNode;
  /** Shown between the heading and the search, for example a map. */
  beforeToolbar?: React.ReactNode;
  /** An extra class for a row, for example to highlight it. */
  rowClass?: (row: T) => string | undefined;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState(chips.some((item) => item.key === initialChip) ? initialChip : "all");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const allChips: Chip<T>[] = useMemo(() => [{ key: "all", label: "All", test: () => true }, ...chips], [chips]);
  const activeChip = allChips.find((item) => item.key === chip) ?? allChips[0];
  // Typing stays immediate; the list catches up a moment later on long lists.
  const deferredQuery = useDeferredValue(query);
  const terms = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => activeChip.test(row) && (!extra || extra.test(row)) && terms.every((term) => search(row).toLowerCase().includes(term)));
  const sortColumn = sort ? columns.find((item) => item.key === sort.key) : undefined;
  const sorted = sortColumn?.sort
    ? [...filtered].sort((a, b) => {
        const [x, y] = [sortColumn.sort!(a), sortColumn.sort!(b)];
        const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort!.direction === "asc" ? result : -result;
      })
    : filtered;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);
  const filtering = Boolean(query.trim()) || chip !== "all" || Boolean(extra?.active);
  const clear = () => { setQuery(""); setChip("all"); extra?.clear(); setPage(1); };
  const pageNumbers = pages <= 5 ? Array.from({ length: pages }, (_, index) => index + 1) : [1, 2, 3, "…", pages] as (number | string)[];

  return (
    <section className="card register-card trade-register" aria-label={title}>
      <header className="trade-register__header"><h2>{title}</h2>{toolbarEnd}</header>
      {beforeToolbar}
      <div className="register-toolbar trade-toolbar">
        <div className="register-search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor={`search-${noun.replace(/\s+/g, "-")}`}>{searchLabel}</label>
          <input id={`search-${noun.replace(/\s+/g, "-")}`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`${searchLabel}…`} />
        </div>
        {extra ? <div className="trade-toolbar__extra">{extra.controls}</div> : null}
        {allChips.length > 1 ? (
          <div className="filter-chips" role="group" aria-label={`Filter ${noun}`}>
            {allChips.map((item) => (
              <button key={item.key} className={item.key === activeChip.key ? "active" : ""} aria-pressed={item.key === activeChip.key} onClick={() => { setChip(item.key); setPage(1); }}>{item.label}</button>
            ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="empty-inline empty-inline--centered">
          <strong>{filtering ? `No ${noun} match these filters` : empty.title}</strong>
          <span>{filtering ? "Try a different filter or clear the search." : empty.body}</span>
          {filtering ? <button className="button button--quiet button--small" onClick={clear}>Clear filters</button> : empty.action ?? null}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table data-table--register trade-table">
            <thead>
              <tr>
                {columns.map((column) => {
                  const sorted = sort?.key === column.key ? sort.direction : null;
                  return (
                    <th key={column.key} scope="col" className={column.align === "end" ? "align-end" : undefined} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
                      {column.sort ? (
                        <button className="trade-sort" onClick={() => setSort(sorted === "asc" ? { key: column.key, direction: "desc" } : sorted === "desc" ? null : { key: column.key, direction: "asc" })}>
                          {column.label}
                          {sorted === "asc" ? <ArrowUp aria-hidden="true" /> : sorted === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowUpDown aria-hidden="true" />}
                        </button>
                      ) : column.label}
                    </th>
                  );
                })}
                {actions ? <th scope="col" className="align-end">Action</th> : null}
              </tr>
            </thead>
            <tbody key={`${activeChip.key}-${sort?.key ?? ""}-${sort?.direction ?? ""}-${current}`} className="rows-settle">
              {visible.map((row) => (
                <tr key={row.id} className={[href ? "is-clickable" : "", rowClass?.(row) ?? ""].join(" ").trim() || undefined} onClick={(event) => { if (href && !(event.target as HTMLElement).closest("a, button, input, label")) router.push(href(row)); }}>
                  {columns.map((column, index) => (
                    <td key={column.key} data-label={column.label} className={column.align === "end" ? "align-end" : undefined}>
                      {index === 0 && href ? <Link className="row-link" href={href(row)}>{column.render(row)}</Link> : column.render(row)}
                    </td>
                  ))}
                  {actions ? <td data-label="Action" className="align-end"><div className="trade-row-actions">{actions(row)}</div></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="trade-pager">
        <span>{sorted.length === 0 ? `0 ${noun}` : `Showing ${(current - 1) * pageSize + 1} – ${Math.min(current * pageSize, sorted.length)} of ${sorted.length} ${noun}`}</span>
        {pages > 1 ? (
          <div className="trade-pager__controls">
            <button className="icon-button icon-button--light" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft /></button>
            {pageNumbers.map((number, index) => typeof number === "number"
              ? <button key={number} className={`pager-number ${number === current ? "active" : ""}`} aria-current={number === current ? "page" : undefined} aria-label={`Page ${number}`} onClick={() => setPage(number)}>{number}</button>
              : <span key={`gap-${index}`} className="muted" aria-hidden="true">…</span>)}
            <button className="icon-button icon-button--light" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight /></button>
          </div>
        ) : null}
      </footer>
    </section>
  );
}

/** A small "View →" link used in table action cells. */
export function ViewLink({ href, label = "View", name }: { href: string; label?: string; name: string }) {
  return <Link className="button button--quiet button--small trade-view" href={href} aria-label={`${label} ${name}`}>{label} <ArrowRight aria-hidden="true" /></Link>;
}

export function CellMain({ title, detail }: { title: React.ReactNode; detail?: React.ReactNode }) {
  return <span className="cell-main"><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</span>;
}

export const dayLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const dateTimeLabel = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
export const tonnes = (value: number) => `${Math.round(value).toLocaleString("en-GB")} t`;

/** Downloads rows as a CSV file the person can open in a spreadsheet. */
export function exportCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const escape = (value: string | number | null) => {
    const textValue = value === null ? "" : String(value);
    return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export { Tick };
