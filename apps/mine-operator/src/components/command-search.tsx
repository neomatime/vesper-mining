"use client";

import {
  AlertTriangle,
  BarChart3,
  CornerDownLeft,
  LayoutDashboard,
  Map,
  PackageCheck,
  PlusCircle,
  Search,
  Settings2,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatStatus } from "@/lib/calculations";
import { rankRecords, type SearchKind, type SearchRecord } from "@/lib/search";
import { useShellData } from "./shell-data";

const kindIcon: Record<SearchKind, LucideIcon> = {
  Issue: AlertTriangle,
  Equipment: Wrench,
  "Operating area": Map,
  Readiness: PackageCheck,
  Shift: UsersRound,
  Workspace: LayoutDashboard,
};

const workspaces: SearchRecord[] = [
  { id: "ws-new", kind: "Workspace", title: "Report an issue", subtitle: "Record a new operational constraint", href: "/exceptions/new", keywords: "new create add log" },
  { id: "ws-overview", kind: "Workspace", title: "Overview", subtitle: "Command Centre", href: "/overview", keywords: "home dashboard command centre" },
  { id: "ws-map", kind: "Workspace", title: "Operational Map", subtitle: "Operating areas and status", href: "/map" },
  { id: "ws-exceptions", kind: "Workspace", title: "Work & Exceptions", subtitle: "Issues, actions and dependencies", href: "/exceptions", keywords: "issues actions" },
  { id: "ws-equipment", kind: "Workspace", title: "Equipment & Maintenance", subtitle: "Register and service requirements", href: "/equipment" },
  { id: "ws-resources", kind: "Workspace", title: "Resource Readiness", subtitle: "Parts and prerequisites", href: "/resources", keywords: "spares stock parts" },
  { id: "ws-shifts", kind: "Workspace", title: "Shift Control", subtitle: "Shifts and handover", href: "/shifts", keywords: "handover" },
  { id: "ws-reports", kind: "Workspace", title: "Reports", subtitle: "Operational intelligence", href: "/reports" },
  { id: "ws-admin", kind: "Workspace", title: "Administration", subtitle: "Users, sites and subscription", href: "/admin", keywords: "settings" },
];

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data } = useShellData();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const records = useMemo<SearchRecord[]>(() => {
    const live: SearchRecord[] = [];
    for (const issue of data?.issues ?? []) {
      live.push({
        id: issue.id,
        kind: "Issue",
        title: issue.title,
        subtitle: `${issue.issueNumber} · ${formatStatus(issue.workflowState)}`,
        href: `/exceptions/${issue.id}`,
        keywords: issue.owner ?? "",
      });
    }
    for (const item of data?.equipment ?? []) {
      live.push({ id: item.id, kind: "Equipment", title: item.name, subtitle: `${item.code} · ${item.area}`, href: `/equipment/${item.id}`, keywords: item.state });
    }
    for (const area of data?.areas ?? []) {
      live.push({ id: area.id, kind: "Operating area", title: area.name, subtitle: formatStatus(area.status), href: "/map" });
    }
    for (const activity of data?.readiness ?? []) {
      live.push({ id: activity.id, kind: "Readiness", title: activity.title, subtitle: formatStatus(activity.status), href: `/resources/${activity.id}` });
    }
    for (const shift of data?.shifts ?? []) {
      live.push({ id: shift.id, kind: "Shift", title: shift.name, subtitle: `${shift.time} · ${shift.supervisor}`, href: `/shifts/${shift.id}` });
    }
    return [...live, ...workspaces];
  }, [data]);

  const results = useMemo(() => rankRecords(query, records, 8), [query, records]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  const choose = (record: SearchRecord | undefined) => {
    if (!record) return;
    onClose();
    setQuery("");
    setActive(0);
    router.push(record.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search VESPER"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="search-dialog__input">
          <Search aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-label="Search records and workspaces"
            placeholder="Search issues, equipment, areas or workspaces"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="icon-button" onClick={onClose} aria-label="Close search"><X /></button>
        </div>
        <div className="search-results">
          <p>{query.trim() ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Suggestions"}</p>
          {results.length === 0 ? (
            <div className="search-empty">
              <strong>Nothing matches “{query.trim()}”</strong>
              <span>Try an equipment code such as EX-204, an issue number, or an area name.</span>
            </div>
          ) : (
            <ul role="listbox" id={listId} aria-label="Results">
              {results.map((record, index) => {
                const Icon = record.id === "ws-new" ? PlusCircle : record.kind === "Workspace" ? workspaceIcon(record.id) : kindIcon[record.kind];
                return (
                  <li
                    key={record.id}
                    id={`${listId}-${record.id}`}
                    role="option"
                    aria-selected={index === active}
                    className={index === active ? "search-option search-option--active" : "search-option"}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(record)}
                  >
                    <span className="search-option__icon"><Icon aria-hidden="true" /></span>
                    <span className="search-option__copy"><strong>{record.title}</strong><small>{record.subtitle}</small></span>
                    <span className="search-option__kind">{record.kind}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="search-dialog__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
          <span><kbd><CornerDownLeft size={11} aria-hidden="true" /></kbd> to open</span>
          <span><kbd>Esc</kbd> to close</span>
        </footer>
      </section>
    </div>
  );
}

function workspaceIcon(id: string): LucideIcon {
  switch (id) {
    case "ws-map": return Map;
    case "ws-exceptions": return AlertTriangle;
    case "ws-equipment": return Wrench;
    case "ws-resources": return PackageCheck;
    case "ws-shifts": return UsersRound;
    case "ws-reports": return BarChart3;
    case "ws-admin": return Settings2;
    default: return LayoutDashboard;
  }
}
