"use client";

/**
 * One screen for the four registers (issues, equipment, resources, shifts). The WorkspaceKey picks the endpoint and the columns;
 * the screen supplies the summary tiles, filters and search, and opens a record from anywhere in its row.
 */
import { useQuery } from "@tanstack/react-query";
import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { CalendarDays, ChevronDown, CirclePlus, Ellipsis, FileText, ClipboardCheck, List, PackageCheck, Search, UsersRound, Wrench, ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useRef, useState } from "react";
import { demoFetch } from "@/lib/api";
import { formatStatus } from "@/lib/calculations";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { activeActions, isFinished, openDependencies, stateLabels } from "@/lib/issue-rules";
import { canRequestService } from "@/lib/service-rules";
import { assetGroupLabels, assetGroups, canActOnEquipment, categoryLabels, planTone, type AssetKind, type EquipmentView } from "@/lib/equipment-rules";
import { formatDay, shiftTimes, suggestNextShift } from "@/lib/shift-format";
import { canActOnShift, handoverLabels, shiftStateLabels, shiftTone, type ShiftView } from "@/lib/shift-rules";
import { useDemoContext } from "@/stores/demo-context";
import { indicativeOrderBy, partPosition } from "@/lib/readiness-rules";
import { EquipmentFormDialog } from "./equipment-dialogs";
import { ShiftFormDialog } from "./shift-dialogs";
import { ShiftCalendar } from "./shift-calendar";
import { PageHeader } from "./page-header";
import { ShiftControlTabs } from "./module-tabs";
import { ErrorState, LoadingState } from "./query-state";
import { useShellData } from "./shell-data";
import { useDismiss } from "./use-dismiss";
import { StatusBadge } from "./status-badge";
import { useCreateEquipment } from "./use-equipment-mutations";
import { useServiceRequests } from "./use-service";
import { useCreateShift, type ShiftFormInput } from "./use-shift-mutations";
import { Tick } from "./tick";
import { DEMO_NOW } from "@/lib/demo-data";

export type WorkspaceKey = "exceptions" | "equipment" | "resources" | "shifts";

export type Header = { eyebrow: string; title: string; description: string };
type WorkspaceResponse<T> = Header & { records: T[] };

type Tile = { label: string; value: string | number; hint: string; attention?: boolean };
type Column<T> = { key: string; label: string; render: (row: T) => React.ReactNode };
type Filter<T> = { key: string; label: string; test: (row: T) => boolean };

export type Register<T extends { id: string }> = {
  icon: LucideIcon;
  tiles: Tile[];
  columns: Column<T>[];
  filters: Filter<T>[];
  href: (row: T) => string;
  text: (row: T) => string;
  rows: T[];
  action?: { label: string; href?: string; onClick?: () => void; plus?: boolean; /** A quieter button, for secondary actions such as a download. */ quiet?: boolean; icon?: LucideIcon };
  emptyTitle: string;
  emptyBody: string;
  /** Replaces the default line under the table. */
  footnote?: string;
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
    emptyTitle: "No issues yet",
    emptyBody: "Issues appear here as soon as they are reported.",
  };
}

function equipmentRegister(allRecords: EquipmentView[], issues: OperationalIssue[], kind: AssetKind, canRequest: boolean): Register<EquipmentView> {
  // The two tabs are one register with two views, so each tab counts only its own assets.
  const records = allRecords.filter((item) => item.kind === kind);
  const infra = kind === "infrastructure";
  const ids = new Set(records.map((item) => item.id));
  const active = records.filter((item) => !item.retiredAt);
  const needsService = (item: EquipmentView) => item.nextService?.state === "overdue" || item.nextService?.state === "due_soon";
  const unavailable = active.filter((item) => item.state === "unavailable").length;
  const dueCount = active.filter(needsService).length;
  const linked = issues.filter((issue) => issue.equipmentId && ids.has(issue.equipmentId) && !isFinished(issue.workflowState)).length;

  return {
    icon: Wrench,
    tiles: [
      { label: infra ? "Infrastructure assets" : "Equipment assets", value: active.length, hint: "On the active register" },
      { label: "Unavailable", value: unavailable, hint: "Reported, not verified", attention: unavailable > 0 },
      { label: "Service due", value: dueCount, hint: dueCount ? "Due soon or overdue" : "Nothing due soon", attention: dueCount > 0 },
      { label: "Open linked issues", value: linked, hint: infra ? "Across infrastructure" : "Across all equipment" },
    ],
    columns: [
      { key: "name", label: infra ? "Infrastructure asset" : "Equipment", render: (item) => <span className="cell-main"><strong>{item.name}</strong><small>{item.code} · {categoryLabels[item.category]}</small></span> },
      ...(infra ? [{ key: "category", label: "Category", render: (item: EquipmentView) => <span className="chip">{item.group ? assetGroupLabels[item.group] : "Other"}</span> }] : []),
      { key: "area", label: "Area / location", render: (item) => item.areaName ?? item.location ?? <span className="muted">Not assigned</span> },
      { key: "state", label: infra ? "Status" : "Availability", render: (item) => (item.retiredAt ? <StatusBadge value="unknown" label="Retired" /> : item.state === "unavailable" ? <StatusBadge value="blocked" label="Unavailable" /> : infra && item.condition === "needs_attention" ? <StatusBadge value="at_risk" label="Needs attention" /> : <StatusBadge value="complete" label="Available" />) },
      { key: "service", label: "Next service", render: (item) => (item.retiredAt ? <span className="muted">—</span> : item.nextService ? <StatusBadge value={planTone[item.nextService.state]} label={item.nextService.label} /> : <span className="muted">No plan</span>) },
      { key: "hours", label: infra ? "Hours / usage" : "Hours", render: (item) => (item.hours !== null ? item.hours.toLocaleString("en-GB") : item.usage ?? <span className="muted">—</span>) },
      { key: "actions", label: "Actions", render: (item) => <AssetRowMenu item={item} canRequest={canRequest} /> },
    ],
    filters: infra
      ? [
          { key: "all", label: "All", test: (item) => !item.retiredAt },
          ...assetGroups.map((group) => ({ key: group, label: assetGroupLabels[group], test: (item: EquipmentView) => !item.retiredAt && item.group === group })),
          { key: "retired", label: "Retired", test: (item: EquipmentView) => Boolean(item.retiredAt) },
        ]
      : [
          { key: "all", label: "All", test: (item) => !item.retiredAt },
          { key: "available", label: "Available", test: (item) => !item.retiredAt && item.state === "available" },
          { key: "unavailable", label: "Unavailable", test: (item) => !item.retiredAt && item.state === "unavailable" },
          { key: "service", label: "Service due", test: (item) => !item.retiredAt && needsService(item) },
          { key: "retired", label: "Retired", test: (item) => Boolean(item.retiredAt) },
        ],
    href: (item) => `/equipment/${item.id}`,
    text: (item) => [item.name, item.code, item.areaName, item.location, item.responsible, item.makeModel, item.serialNumber, categoryLabels[item.category], item.group ? assetGroupLabels[item.group] : "", item.state].join(" "),
    rows: records,
    emptyTitle: infra ? "No infrastructure yet" : "No equipment yet",
    emptyBody: infra ? "Add a substation, pump, conveyor, road or network to track its condition and maintenance." : "Add your first machine, vehicle or plant item to start tracking its availability and maintenance.",
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
  // An order-by date that has already passed is flagged, not shown like any other date.
  const today = DEMO_NOW.slice(0, 10);
  const past = (iso: string) => iso.slice(0, 10) < today;

  return {
    icon: PackageCheck,
    tiles: [
      { label: "Need attention", value: attention.length, hint: "Not yet ready", attention: attention.length > 0 },
      { label: "Parts with unknown stock", value: unknownParts, hint: "Unknown is not zero", attention: unknownParts > 0 },
      { label: "Earliest order-by", value: orderDates[0] ? date(orderDates[0]) : "None", hint: orderDates[0] && past(orderDates[0]) ? "Already passed: order now" : "Indicative, longest lead time plus buffer", attention: Boolean(orderDates[0] && past(orderDates[0])) },
      { label: "Reviewed", value: records.filter((activity) => activity.reviews.length > 0).length, hint: "Human review recorded" },
    ],
    columns: [
      { key: "title", label: "Planned work", render: (activity) => <span className="cell-main"><strong>{activity.title}</strong><small>{activity.parts.length} {activity.parts.length === 1 ? "part" : "parts"} required</small></span> },
      { key: "needed", label: "Needed by", render: (activity) => date(activity.scheduledFor) },
      { key: "status", label: "Readiness", render: (activity) => <StatusBadge value={activity.status} label={formatStatus(activity.status)} /> },
      { key: "parts", label: "Parts to confirm", render: (activity) => { const n = activity.parts.filter((part) => partPosition(part) !== "covered").length; return n ? `${n} of ${activity.parts.length}` : <span className="muted">None</span>; } },
      { key: "orderby", label: "Order-by", render: (activity) => { const value = indicativeOrderBy(activity.scheduledFor, activity.parts); return value ? (past(value) ? <span className="date-overdue">{date(value)}<small>Passed</small></span> : date(value)) : <span className="muted">Not needed</span>; } },
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

/** The two views of the asset register. Each tab is a page of its own, so the browser's back button works. */
function AssetTabs({ active }: { active: AssetKind }) {
  return (
    <nav className="tabs module-tabs asset-tabs" aria-label="Asset type">
      <Link href="/equipment" className={`tab ${active === "equipment" ? "tab--active active" : ""}`} aria-current={active === "equipment" ? "page" : undefined}>Equipment</Link>
      <Link href="/equipment?tab=infrastructure" className={`tab ${active === "infrastructure" ? "tab--active active" : ""}`} aria-current={active === "infrastructure" ? "page" : undefined}>Infrastructure</Link>
    </nav>
  );
}

/** "Add asset" with a short menu: the two kinds of asset share one register. */
/** The "…" menu on an asset row: ask for a repair, open the asset, or go to its maintenance history. */
function AssetRowMenu({ item, canRequest }: { item: EquipmentView; canRequest: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="icon-button icon-button--light" aria-haspopup="true" aria-expanded={open} aria-label={`Actions for ${item.name}`} onClick={() => setOpen(!open)}><Ellipsis /></button>
      {open ? (
        <div className="popover popover--menu" role="group" aria-label={`Actions for ${item.name}`}>
          <div className="menu-section">
            {canRequest && !item.retiredAt ? <Link className="menu-item" href={`/equipment/${item.id}/service/new`} onClick={close}><span className="menu-item__icon"><Wrench size={16} /></span>Request Repair</Link> : null}
            <Link className="menu-item" href={`/equipment/${item.id}`} onClick={close}><span className="menu-item__icon"><FileText size={16} /></span>View Details</Link>
            <Link className="menu-item" href={`/equipment/${item.id}#service-history`} onClick={close}><span className="menu-item__icon"><CalendarDays size={16} /></span>Maintenance History</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Repairs and service work with external providers, as three counts from the repair requests themselves: open (awaiting quotes), in
 * progress (a provider chosen or the work scheduled) and completed this month. Nothing is estimated.
 */
function RepairRequestsBand({ now }: { now: string }) {
  const requests = useServiceRequests();
  if (!requests.data) return null;
  const month = now.slice(0, 7);
  const open = requests.data.filter((item) => item.status === "open").length;
  const progress = requests.data.filter((item) => item.status === "awarded" || item.status === "scheduled").length;
  const done = requests.data.filter((item) => item.status === "completed" && (item.completedAt ?? "").slice(0, 7) === month).length;
  return (
    <section className="card repair-band" aria-label="Repair Requests">
      <span className="repair-band__icon" aria-hidden="true"><Wrench /></span>
      <div className="repair-band__title"><strong>Repair Requests</strong><small>Repairs and service work with external providers.</small></div>
      {open + progress + done === 0 ? (
        <p className="repair-band__empty">No repair requests open or in progress.</p>
      ) : (
        <dl className="repair-band__stats">
          <div><dd>{open}</dd><dt>Open</dt></div>
          <div><dd>{progress}</dd><dt>In progress</dt></div>
          <div><dd>{done}</dd><dt>Completed (this month)</dt></div>
        </dl>
      )}
      <Link className="repair-band__link" href="/equipment/repairs">View all <ArrowRight /></Link>
    </section>
  );
}

function AddAssetMenu({ onChoose }: { onChoose: (kind: AssetKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="button button--primary" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <CirclePlus /> Add asset <ChevronDown />
      </button>
      {open ? (
        <div className="popover popover--menu" role="group" aria-label="Add asset">
          <div className="menu-section">
            <button className="menu-item" onClick={() => { close(); onChoose("equipment"); }}>Add equipment</button>
            <button className="menu-item" onClick={() => { close(); onChoose("infrastructure"); }}>Add infrastructure</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Workspace({ workspace }: { workspace: WorkspaceKey }) {
  const params = useSearchParams();
  const requestedFilter = params.get("filter");
  const shiftView = params.get("view") === "calendar" ? "calendar" : "list";
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [adding, setAdding] = useState<AssetKind | null>(null);
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
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;

  const header = query.data;
  const records = query.data.records as unknown[];

  if (workspace === "exceptions") return <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} register={issueRegister(records as OperationalIssue[])} />;
  if (workspace === "equipment") {
    const kind: AssetKind = params.get("tab") === "infrastructure" ? "infrastructure" : "equipment";
    const all = records as EquipmentView[];
    return (
      <>
        <RegisterView
          key={`${kind}-${requestedFilter}`}
          initialFilter={requestedFilter}
          header={{ ...header, title: "Assets", description: "Manage equipment and site infrastructure, maintenance and availability." }}
          register={equipmentRegister(all, shell?.issues ?? [], kind, canRequestService({ name: context.persona, role: context.role }).allowed)}
          afterTiles={<RepairRequestsBand now={shell?.now ?? ""} />}
          tabs={<AssetTabs active={kind} />}
          viewSwitch={
            <>
              <Link className="button button--quiet" href="/equipment/providers"><UsersRound /> Manage Service Providers</Link>
              {canManageEquipment ? <AddAssetMenu onChoose={setAdding} /> : null}
            </>
          }
        />
        {adding ? (
          <EquipmentFormDialog
            kind={adding}
            areas={shell?.areas ?? []}
            people={(shell?.members ?? []).filter((member) => member.status !== "deactivated").map((member) => member.name)}
            assets={all.filter((item) => !item.retiredAt).map((item) => ({ id: item.id, code: item.code, name: item.name }))}
            pending={create.isPending}
            onClose={() => setAdding(null)}
            onSave={(input) => create.mutate(input)}
          />
        ) : null}
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
            <ShiftControlTabs active="shifts" />
            <ShiftCalendar shifts={shifts} now={shell.now} onCreate={canManageShifts ? startCreating : null} />
          </div>
        ) : <LoadingState variant="panel" />
      ) : (
        <RegisterView key={requestedFilter} initialFilter={requestedFilter} header={header} tabs={<ShiftControlTabs active="shifts" />} viewSwitch={<ShiftViewSwitch view="list" />} register={shiftRegister(shifts, canManageShifts ? () => startCreating(null) : null)} />
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

/** A register page: header, summary tiles, search, filters and a table. Also used by the Production and Shipments screens. */
export function RegisterView<T extends { id: string }>({ header, register, initialFilter, viewSwitch, tabs, afterTiles }: { header: Header; register: Register<T>; initialFilter: string | null; viewSwitch?: React.ReactNode; tabs?: React.ReactNode; /** Shown between the summary figures and the table. */ afterTiles?: React.ReactNode }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(() =>
    register.filters.some((item) => item.key === initialFilter) ? (initialFilter as string) : "all",
  );
  const [search, setSearch] = useState("");
  const Icon = register.icon;

  const filter = register.filters.find((item) => item.key === activeFilter) ?? register.filters[0];
  const deferredSearch = useDeferredValue(search);
  const terms = deferredSearch.toLowerCase().split(/\s+/).filter(Boolean);
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
              <button className={`button ${register.action.quiet ? "button--quiet" : "button--primary"}`} onClick={register.action.onClick}>
                {register.action.icon ? <register.action.icon /> : register.action.plus ? <CirclePlus /> : <ArrowRight />}
                {register.action.label}
              </button>
            ) : (
              <Link className={`button ${register.action.quiet ? "button--quiet" : "button--primary"}`} href={register.action.href ?? "#"}>
                {register.action.icon ? <register.action.icon /> : register.action.plus ? <CirclePlus /> : <ArrowRight />}
                {register.action.label}
              </Link>
            )
              ) : null}
            </>
          ) : undefined
        }
      />

      {tabs}

      {register.tiles.length > 0 ? <section className="kpi-row" aria-label="Summary">
        {register.tiles.map((tile) => (
          <article className={`kpi ${tile.attention ? "kpi--attention" : ""}`} key={tile.label}>
            <span>{tile.label}</span>
            <strong><Tick value={tile.value} /></strong>
            <small>{tile.hint}</small>
          </article>
        ))}
      </section> : null}

      {afterTiles}

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
              <tbody key={filter?.key ?? "all"} className="rows-settle">
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
        {filtering || register.footnote ? <p className="card__footnote">{filtering ? `Showing ${visible.length} of ${register.rows.length}. ` : ""}{register.footnote ?? ""}</p> : null}
      </section>
    </div>
  );
}
