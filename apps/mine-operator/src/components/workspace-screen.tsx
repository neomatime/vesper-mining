"use client";

import { useQuery } from "@tanstack/react-query";
import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { CalendarDays, CirclePlus, ClipboardCheck, List, PackageCheck, Search, UsersRound, Wrench, ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatStatus } from "@/lib/calculations";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { activeActions, isFinished, openDependencies, stateLabels } from "@/lib/issue-rules";
import { canActOnEquipment, categoryLabels, planTone, type EquipmentView } from "@/lib/equipment-rules";
import { formatDay, shiftTimes, suggestNextShift } from "@/lib/shift-format";
import { canActOnShift, handoverLabels, shiftStateLabels, shiftTone, type ShiftView } from "@/lib/shift-rules";
import { useDemoContext } from "@/stores/demo-context";
import { indicativeOrderBy, partPosition } from "@/lib/readiness-rules";
import { EquipmentFormDialog } from "./equipment-dialogs";
import { ShiftFormDialog } from "./shift-dialogs";
import { ShiftCalendar } from "./shift-calendar";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { StatusBadge } from "./status-badge";
import { useCreateEquipment } from "./use-equipment-mutations";
import { useCreateShift, type ShiftFormInput } from "./use-shift-mutations";

export type WorkspaceKey = "exceptions" | "equipment" | "resources" | "shifts";

type Header = { eyebrow: string; title: string; description: string };
type WorkspaceResponse<T> = Header & { records: T[] };

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
  action?: { label: string; href?: string; onClick?: () => void; plus?: boolean };
  emptyTitle: string;
  emptyBody: string;
};

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

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

function equipmentRegister(records: EquipmentView[], issues: OperationalIssue[], onAdd: (() => void) | null): Register<EquipmentView> {
  const active = records.filter((item) => !item.retiredAt);
  const needsService = (item: EquipmentView) => item.nextService?.state === "overdue" || item.nextService?.state === "due_soon";
  const unavailable = active.filter((item) => item.state === "unavailable").length;
  const dueCount = active.filter(needsService).length;
  const linked = issues.filter((issue) => issue.equipmentId && !isFinished(issue.workflowState)).length;

  return {
    icon: Wrench,
    tiles: [
      { label: "Equipment", value: active.length, hint: "On the active register" },
      { label: "Unavailable", value: unavailable, hint: "Reported, not verified", attention: unavailable > 0 },
      { label: "Service due", value: dueCount, hint: dueCount ? "Due soon or overdue" : "Nothing due soon", attention: dueCount > 0 },
      { label: "Open linked issues", value: linked, hint: "Across all equipment" },
    ],
    columns: [
      { key: "name", label: "Equipment", render: (item) => <span className="cell-main"><strong>{item.name}</strong><small>{item.code} · {categoryLabels[item.category]}</small></span> },
      { key: "area", label: "Area", render: (item) => item.areaName ?? <span className="muted">Not assigned</span> },
      { key: "state", label: "Availability", render: (item) => (item.retiredAt ? <StatusBadge value="unknown" label="Retired" /> : <StatusBadge value={item.state === "available" ? "complete" : "blocked"} label={item.state === "available" ? "Available" : "Unavailable"} />) },
      { key: "service", label: "Next service", render: (item) => (item.retiredAt ? <span className="muted">—</span> : item.nextService ? <StatusBadge value={planTone[item.nextService.state]} label={item.nextService.label} /> : <span className="muted">No plan</span>) },
      { key: "hours", label: "Hours", render: (item) => (item.hours !== null ? item.hours.toLocaleString("en-GB") : <span className="muted">—</span>) },
    ],
    filters: [
      { key: "all", label: "All", test: (item) => !item.retiredAt },
      { key: "available", label: "Available", test: (item) => !item.retiredAt && item.state === "available" },
      { key: "unavailable", label: "Unavailable", test: (item) => !item.retiredAt && item.state === "unavailable" },
      { key: "service", label: "Service due", test: (item) => !item.retiredAt && needsService(item) },
      { key: "retired", label: "Retired", test: (item) => Boolean(item.retiredAt) },
    ],
    href: (item) => `/equipment/${item.id}`,
    text: (item) => [item.name, item.code, item.areaName, item.makeModel, item.serialNumber, categoryLabels[item.category], item.state].join(" "),
    rows: records,
    action: onAdd ? { label: "Add equipment", onClick: onAdd, plus: true } : undefined,
    emptyTitle: "No equipment yet",
    emptyBody: "Add your first machine, vehicle or plant item to start tracking its availability and maintenance.",
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


function shiftRegister(records: ShiftView[], onAdd: (() => void) | null): Register<ShiftView> {
  const current = records.find((item) => item.state === "in_progress") ?? records.find((item) => item.state === "scheduled");
  const next = current ? records.find((item) => item.id === current.next?.id) : undefined;
  const order = (item: ShiftView) => (item.state === "in_progress" ? 0 : item.state === "scheduled" ? 1 : item.state === "closed" ? 2 : 3);
  const sorted = [...records].sort((a, b) => order(a) - order(b) || (order(a) < 2 ? Date.parse(a.startsAt) - Date.parse(b.startsAt) : Date.parse(b.startsAt) - Date.parse(a.startsAt)));

  return {
    icon: UsersRound,
    tiles: [
      { label: "Current shift", value: current?.name ?? "None", hint: current ? `${formatDay(current.startsAt)} · ${shiftTimes(current)}` : "Nothing is scheduled" },
      { label: "Carried forward", value: current?.unresolved ?? 0, hint: "Open issues and dependencies", attention: (current?.unresolved ?? 0) > 0 },
      { label: "Handover", value: current ? handoverLabels[current.handover.state] : "None", hint: current ? `From ${current.name}` : "No shift to hand over" },
      { label: "Next shift", value: next?.name ?? "None", hint: next ? `${formatDay(next.startsAt)} · ${next.supervisor ?? "No supervisor yet"}` : "Schedule the next shift" },
    ],
    columns: [
      { key: "shift", label: "Shift", render: (item) => <span className="cell-main"><strong>{item.name}</strong><small>{formatDay(item.startsAt)}</small></span> },
      { key: "time", label: "Time", render: (item) => shiftTimes(item) },
      { key: "supervisor", label: "Supervisor", render: (item) => item.supervisor ?? <span className="muted">Not assigned</span> },
      { key: "crew", label: "Crew", render: (item) => (item.crew.length ? `${item.crew.length} ${item.crew.length === 1 ? "person" : "people"}` : <span className="muted">None yet</span>) },
      { key: "work", label: "Work", render: (item) => (item.work.length ? `${item.work.filter((entry) => entry.done).length} of ${item.work.length} done` : <span className="muted">None yet</span>) },
      { key: "status", label: "Status", render: (item) => <StatusBadge value={shiftTone[item.state]} label={shiftStateLabels[item.state]} /> },
      { key: "handover", label: "Handover", render: (item) => (item.state === "scheduled" || item.state === "cancelled" ? <span className="muted">—</span> : <StatusBadge value={item.handover.state === "acknowledged" ? "verified" : item.handover.state === "published" ? "reported" : "pending"} label={handoverLabels[item.handover.state]} />) },
    ],
    filters: [
      { key: "all", label: "All", test: (item) => item.state !== "cancelled" },
      { key: "scheduled", label: "Scheduled", test: (item) => item.state === "scheduled" },
      { key: "in_progress", label: "In progress", test: (item) => item.state === "in_progress" },
      { key: "closed", label: "Closed", test: (item) => item.state === "closed" },
      { key: "cancelled", label: "Cancelled", test: (item) => item.state === "cancelled" },
    ],
    href: (item) => `/shifts/${item.id}`,
    text: (item) => [item.name, item.supervisor, shiftStateLabels[item.state], ...item.crew.map((member) => member.name)].join(" "),
    rows: sorted,
    action: onAdd ? { label: "Create shift", onClick: onAdd, plus: true } : undefined,
    emptyTitle: "No shifts yet",
    emptyBody: "Create the first shift to plan who is on site, what they are working on and how the work hands over.",
  };
}

export function WorkspaceScreen({ workspace }: { workspace: WorkspaceKey }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Workspace workspace={workspace} />
    </Suspense>
  );
}

/** Switches Shift Control between its register and its calendar. */
function ShiftViewSwitch({ view }: { view: "list" | "calendar" }) {
  return (
    <nav className="segmented segmented--links" aria-label="Shift Control view">
      <Link href="/shifts" className={view === "list" ? "active" : ""} aria-current={view === "list" ? "page" : undefined}><List /> List</Link>
      <Link href="/shifts?view=calendar" className={view === "calendar" ? "active" : ""} aria-current={view === "calendar" ? "page" : undefined}><CalendarDays /> Calendar</Link>
    </nav>
  );
}

function Workspace({ workspace }: { workspace: WorkspaceKey }) {
  const params = useSearchParams();
  const requestedFilter = params.get("filter");
  const shiftView = params.get("view") === "calendar" ? "calendar" : "list";
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingShift, setAddingShift] = useState(false);
  const create = useCreateEquipment();
  const createShift = useCreateShift();
  const { context } = useDemoContext();
  const canManageShifts = canActOnShift("manage", { name: context.persona, role: context.role }).allowed;
  const canManageEquipment = canActOnEquipment("manage", { name: context.persona, role: context.role }).allowed;
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
  if (workspace === "equipment") {
    return (
      <>
        <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={equipmentRegister(records as EquipmentView[], shell?.issues ?? [], canManageEquipment ? () => setAdding(true) : null)} />
        {adding ? <EquipmentFormDialog areas={shell?.areas ?? []} pending={create.isPending} onClose={() => setAdding(false)} onSave={(input) => create.mutate(input)} /> : null}
      </>
    );
  }
  if (workspace === "resources") return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={resourceRegister(records as ReadinessActivity[])} />;
  const shifts = records as ShiftView[];
  const startCreating = (day: string | null) => { setCreateDate(day); setAddingShift(true); };
  return (
    <>
      {shiftView === "calendar" ? (
        shell ? (
          <div className="workspace-page">
            <PageHeader
              eyebrow={header.eyebrow}
              title={header.title}
              description={header.description}
              icon={UsersRound}
              action={
                <>
                  <ShiftViewSwitch view="calendar" />
                  {canManageShifts ? <button className="button button--primary" onClick={() => startCreating(null)}><CirclePlus /> Create shift</button> : null}
                </>
              }
            />
            <ShiftCalendar shifts={shifts} now={shell.now} onCreate={canManageShifts ? startCreating : null} />
          </div>
        ) : <LoadingState />
      ) : (
        <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} viewSwitch={<ShiftViewSwitch view="list" />} register={shiftRegister(shifts, canManageShifts ? () => startCreating(null) : null)} />
      )}
      {addingShift ? (
        <ShiftFormDialog
          suggestion={{ ...suggestNextShift(shifts), ...(createDate ? { date: createDate } : {}) }}
          pending={createShift.isPending}
          onClose={() => setAddingShift(false)}
          onSave={(input) => createShift.mutate(input as ShiftFormInput)}
        />
      ) : null}
    </>
  );
}

function RegisterView<T extends { id: string }>({ header, register, initialFilter, viewSwitch }: { header: Header; register: Register<T>; initialFilter: string | null; viewSwitch?: React.ReactNode }) {
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
          register.action || viewSwitch ? (
            <>
              {viewSwitch}
              {register.action ? (
            register.action.onClick ? (
              <button className="button button--primary" onClick={register.action.onClick}>
                {register.action.plus ? <CirclePlus /> : <ArrowRight />}
                {register.action.label}
              </button>
            ) : (
              <Link className="button button--primary" href={register.action.href ?? "#"}>
                {register.action.plus ? <CirclePlus /> : <ArrowRight />}
                {register.action.label}
              </Link>
            )
              ) : null}
            </>
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
            {!filtering && register.action?.onClick ? <button className="button button--primary button--small" onClick={register.action.onClick}>{register.action.label}</button> : null}
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
        <p className="card__footnote">{filtering ? `Showing ${visible.length} of ${register.rows.length}. ` : ""}Reported and verified information stay separate.</p>
      </section>
    </div>
  );
}
