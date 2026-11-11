"use client";

import { useQuery } from "@tanstack/react-query";
import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { CirclePlus, ClipboardCheck, PackageCheck, Search, UsersRound, Wrench, ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatStatus } from "@/lib/calculations";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { activeActions, isFinished, openDependencies, stateLabels } from "@/lib/issue-rules";
import { indicativeOrderBy, partPosition } from "@/lib/readiness-rules";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";

export type WorkspaceKey = "exceptions" | "equipment" | "resources" | "shifts";

type Header = { eyebrow: string; title: string; description: string };
type WorkspaceResponse<T> = Header & { records: T[] };

type EquipmentRecord = { id: string; code: string; name: string; area: string; state: string; quality: string; nextAction: string };
type ShiftRecord = {
  id: string;
  name: string;
  time: string;
  supervisor: string;
  status: string;
  unresolved: number;
  handover: { state: "draft" | "published" | "acknowledged" };
};

type Tile = { label: string; value: string | number; hint: string; attention?: boolean };
type Column<T> = { key: string; label: string; render: (row: T) => React.ReactNode };
type Filter<T> = { key: string; label: string; test: (row: T) => boolean };

type Register<T extends { id: string }> = {
  icon: LucideIcon;
  tiles: Tile[];
  columns: Column<T>[];
  filters: Filter<T>[];
  href: (row: T) => string;
  text: (row: T) => string;
  rows: T[];
  action?: { label: string; href: string; plus?: boolean };
  emptyTitle: string;
  emptyBody: string;
};

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const handoverLabel = { draft: "Draft", published: "Published", acknowledged: "Acknowledged" } as const;

function issueRegister(records: OperationalIssue[]): Register<OperationalIssue> {
  const open = records.filter((issue) => !isFinished(issue.workflowState) && issue.workflowState !== "verified");
  const overdue = open.reduce((total, issue) => total + activeActions(issue).filter((action) => action.state === "overdue").length, 0);
  const unassigned = open.filter((issue) => !issue.owner).length;
  const sorted = [...records].sort((a, b) => {
    const aOpen = open.includes(a) ? 0 : 1;
    const bOpen = open.includes(b) ? 0 : 1;
    return aOpen - bOpen || priorityRank[a.priority] - priorityRank[b.priority] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  return {
    icon: ClipboardCheck,
    tiles: [
      { label: "Open issues", value: open.length, hint: "Not yet verified or closed" },
      { label: "Awaiting dependency", value: records.filter((issue) => issue.workflowState === "awaiting_dependency").length, hint: "Work is waiting on something" },
      { label: "Overdue actions", value: overdue, hint: overdue ? "Past their deadline" : "Nothing is past its deadline", attention: overdue > 0 },
      { label: "No owner", value: unassigned, hint: unassigned ? "Needs an accountable owner" : "Every open issue has an owner", attention: unassigned > 0 },
    ],
    columns: [
      { key: "issue", label: "Issue", render: (issue) => <span className="cell-main"><strong>{issue.title}</strong><small>{issue.issueNumber}</small></span> },
      { key: "state", label: "State", render: (issue) => <StatusBadge value={issue.workflowState} label={stateLabels[issue.workflowState]} /> },
      { key: "priority", label: "Priority", render: (issue) => <span className={`priority priority--${issue.priority}`}>{formatStatus(issue.priority)}</span> },
      { key: "owner", label: "Owner", render: (issue) => issue.owner ?? <span className="muted">Not assigned</span> },
      {
        key: "actions",
        label: "Actions",
        render: (issue) => {
          const actions = activeActions(issue);
          return actions.length ? `${actions.filter((action) => action.state === "complete").length} of ${actions.length} done` : <span className="muted">None yet</span>;
        },
      },
      { key: "waiting", label: "Waiting on", render: (issue) => (openDependencies(issue).length ? `${openDependencies(issue).length} open` : <span className="muted">Nothing</span>) },
      { key: "updated", label: "Updated", render: (issue) => formatDemoDateTime(issue.updatedAt) },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "open", label: "Open", test: (issue) => open.includes(issue) },
      { key: "waiting", label: "Awaiting dependency", test: (issue) => issue.workflowState === "awaiting_dependency" },
      { key: "noowner", label: "No owner", test: (issue) => open.includes(issue) && !issue.owner },
      { key: "finished", label: "Finished", test: (issue) => !open.includes(issue) },
    ],
    href: (issue) => `/exceptions/${issue.id}`,
    text: (issue) => [issue.title, issue.issueNumber, issue.owner, issue.workflowState, issue.priority].join(" "),
    rows: sorted,
    action: { label: "Report issue", href: "/exceptions/new", plus: true },
    emptyTitle: "No issues yet",
    emptyBody: "Issues appear here as soon as they are reported.",
  };
}

function equipmentRegister(records: EquipmentRecord[], issues: OperationalIssue[]): Register<EquipmentRecord> {
  const linked = issues.filter((issue) => issue.equipmentId && !isFinished(issue.workflowState)).length;
  return {
    icon: Wrench,
    tiles: [
      { label: "Equipment", value: records.length, hint: "On the register" },
      { label: "Reported unavailable", value: records.filter((item) => item.state.startsWith("Unavailable")).length, hint: "Reported, not verified" },
      { label: "Service approaching", value: records.filter((item) => item.state.toLowerCase().includes("service")).length, hint: "Approaching or due" },
      { label: "Open linked issues", value: linked, hint: "Across all equipment" },
    ],
    columns: [
      { key: "name", label: "Equipment", render: (item) => <span className="cell-main"><strong>{item.name}</strong><small>{item.code}</small></span> },
      { key: "area", label: "Area", render: (item) => item.area },
      { key: "state", label: "Reported state", render: (item) => item.state },
      { key: "next", label: "Next action", render: (item) => item.nextAction },
      { key: "quality", label: "Information", render: (item) => <StatusBadge value={item.quality.toLowerCase().includes("verified") ? "verified" : item.quality.toLowerCase().includes("pending") ? "pending" : "reported"} label={item.quality} /> },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "unavailable", label: "Unavailable", test: (item) => item.state.startsWith("Unavailable") },
      { key: "service", label: "Service due", test: (item) => item.state.toLowerCase().includes("service") },
    ],
    href: (item) => `/equipment/${item.id}`,
    text: (item) => [item.name, item.code, item.area, item.state, item.nextAction].join(" "),
    rows: records,
    emptyTitle: "No equipment on the register",
    emptyBody: "Equipment appears here once it is added to the site.",
  };
}

function resourceRegister(records: ReadinessActivity[]): Register<ReadinessActivity> {
  const attention = records.filter((activity) => activity.status !== "ready");
  const unknownParts = records.reduce((total, activity) => total + activity.parts.filter((part) => partPosition(part) === "unknown").length, 0);
  const orderDates = records
    .map((activity) => indicativeOrderBy(activity.scheduledFor, activity.parts))
    .filter((value): value is string => value !== null)
    .sort();
  const date = (iso: string) => formatDemoDateTime(iso).split(" · ")[0];

  return {
    icon: PackageCheck,
    tiles: [
      { label: "Need attention", value: attention.length, hint: "Not yet ready", attention: attention.length > 0 },
      { label: "Parts with unknown stock", value: unknownParts, hint: "Unknown is not zero", attention: unknownParts > 0 },
      { label: "Earliest order-by", value: orderDates[0] ? date(orderDates[0]) : "None", hint: "Indicative, longest lead time plus buffer" },
      { label: "Reviewed", value: records.filter((activity) => activity.reviews.length > 0).length, hint: "Human review recorded" },
    ],
    columns: [
      { key: "title", label: "Planned work", render: (activity) => <span className="cell-main"><strong>{activity.title}</strong><small>{activity.parts.length} {activity.parts.length === 1 ? "part" : "parts"} required</small></span> },
      { key: "needed", label: "Needed by", render: (activity) => date(activity.scheduledFor) },
      { key: "status", label: "Readiness", render: (activity) => <StatusBadge value={activity.status} label={formatStatus(activity.status)} /> },
      { key: "parts", label: "Parts to confirm", render: (activity) => { const n = activity.parts.filter((part) => partPosition(part) !== "covered").length; return n ? `${n} of ${activity.parts.length}` : <span className="muted">None</span>; } },
      { key: "orderby", label: "Order-by", render: (activity) => { const value = indicativeOrderBy(activity.scheduledFor, activity.parts); return value ? date(value) : <span className="muted">Not needed</span>; } },
      { key: "review", label: "Review", render: (activity) => (activity.reviews.length ? <StatusBadge value="reviewed" label="Reviewed" /> : <StatusBadge value="pending" label="Not reviewed" />) },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "attention", label: "Needs attention", test: (activity) => activity.status !== "ready" },
      { key: "ready", label: "Ready", test: (activity) => activity.status === "ready" },
    ],
    href: (activity) => `/resources/${activity.id}`,
    text: (activity) => [activity.title, activity.status, ...activity.parts.map((part) => part.name)].join(" "),
    rows: records,
    action: { label: "Open next readiness risk", href: `/resources/${(attention[0] ?? records[0])?.id ?? ""}` },
    emptyTitle: "No upcoming work to prepare",
    emptyBody: "Planned maintenance appears here with its required parts.",
  };
}

function shiftRegister(records: ShiftRecord[]): Register<ShiftRecord> {
  const current = records[0];
  return {
    icon: UsersRound,
    tiles: [
      { label: "Carried forward", value: current?.unresolved ?? 0, hint: "Open issues and dependencies" },
      { label: "Handover", value: current ? handoverLabel[current.handover.state] : "None", hint: current?.name ?? "No shift" },
      { label: "Current supervisor", value: current?.supervisor ?? "None", hint: current?.time ?? "" },
      { label: "Next supervisor", value: records[1]?.supervisor ?? "None", hint: records[1]?.time ?? "" },
    ],
    columns: [
      { key: "shift", label: "Shift", render: (shift) => <span className="cell-main"><strong>{shift.name}</strong><small>{shift.time}</small></span> },
      { key: "supervisor", label: "Supervisor", render: (shift) => shift.supervisor },
      { key: "status", label: "Status", render: (shift) => <StatusBadge value={shift.status === "In progress" ? "in_progress" : "pending"} label={shift.status} /> },
      { key: "carried", label: "Carried forward", render: (shift) => (shift.unresolved ? `${shift.unresolved} open` : <span className="muted">Nothing</span>) },
      { key: "handover", label: "Handover", render: (shift) => <StatusBadge value={shift.handover.state === "acknowledged" ? "verified" : shift.handover.state === "published" ? "reported" : "pending"} label={handoverLabel[shift.handover.state]} /> },
    ],
    filters: [],
    href: (shift) => `/shifts/${shift.id}`,
    text: (shift) => [shift.name, shift.supervisor, shift.status].join(" "),
    rows: records,
    action: { label: "Prepare handover", href: `/shifts/${current?.id ?? "shift-a-20250424"}/handover` },
    emptyTitle: "No shifts scheduled",
    emptyBody: "Shifts appear here once a roster is set up.",
  };
}

export function WorkspaceScreen({ workspace }: { workspace: WorkspaceKey }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Workspace workspace={workspace} />
    </Suspense>
  );
}

function Workspace({ workspace }: { workspace: WorkspaceKey }) {
  const requestedFilter = useSearchParams().get("filter");
  const query = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: () => demoFetch<WorkspaceResponse<never>>(`/workspaces/${workspace}`),
  });
  const { data: shell } = useShellData();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const header = query.data;
  const records = query.data.records as unknown[];

  if (workspace === "exceptions") return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={issueRegister(records as OperationalIssue[])} />;
  if (workspace === "equipment") return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={equipmentRegister(records as EquipmentRecord[], shell?.issues ?? [])} />;
  if (workspace === "resources") return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={resourceRegister(records as ReadinessActivity[])} />;
  return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={shiftRegister(records as ShiftRecord[])} />;
}

function RegisterView<T extends { id: string }>({ header, register, initialFilter }: { header: Header; register: Register<T>; initialFilter: string | null }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(() =>
    register.filters.some((item) => item.key === initialFilter) ? (initialFilter as string) : "all",
  );
  const [search, setSearch] = useState("");
  const Icon = register.icon;

  const filter = register.filters.find((item) => item.key === activeFilter) ?? register.filters[0];
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = register.rows.filter((row) => (filter?.test(row) ?? true) && terms.every((term) => register.text(row).toLowerCase().includes(term)));
  const filtering = Boolean(search.trim()) || (filter ? filter.key !== "all" : false);

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        icon={Icon}
        action={
          register.action ? (
            <Link className="button button--primary" href={register.action.href}>
              {register.action.plus ? <CirclePlus /> : <ArrowRight />}
              {register.action.label}
            </Link>
          ) : undefined
        }
      />

      <section className="kpi-row" aria-label="Summary">
        {register.tiles.map((tile) => (
          <article className={`kpi ${tile.attention ? "kpi--attention" : ""}`} key={tile.label}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <small>{tile.hint}</small>
          </article>
        ))}
      </section>

      <section className="card register-card">
        <div className="register-toolbar">
          <div className="register-search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="register-search">Filter records</label>
            <input id="register-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this list" />
          </div>
          {register.filters.length > 0 ? (
            <div className="filter-chips" role="group" aria-label="Record filters">
              {register.filters.map((item) => (
                <button key={item.key} className={item.key === filter?.key ? "active" : ""} aria-pressed={item.key === filter?.key} onClick={() => setActiveFilter(item.key)}>{item.label}</button>
              ))}
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="empty-inline empty-inline--centered">
            <strong>{filtering ? "No records match these filters" : register.emptyTitle}</strong>
            <span>{filtering ? "Try a different filter or clear the search." : register.emptyBody}</span>
            {filtering ? <button className="button button--quiet button--small" onClick={() => { setSearch(""); setActiveFilter("all"); }}>Clear filters</button> : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--register">
              <thead><tr>{register.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest("a, button")) router.push(register.href(row));
                    }}
                  >
                    {register.columns.map((column, index) => (
                      <td key={column.key} data-label={column.label}>
                        {index === 0 ? <Link className="row-link" href={register.href(row)}>{column.render(row)}</Link> : column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="card__footnote">{filtering ? `Showing ${visible.length} of ${register.rows.length}. ` : ""}Demonstration records. Reported and verified information stay separate.</p>
      </section>
    </div>
  );
}
