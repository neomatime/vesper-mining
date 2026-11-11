"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CirclePlus,
  ClipboardCheck,
  FileText,
  PackageCheck,
  Settings2,
  UsersRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

export type WorkspaceKey = "exceptions" | "equipment" | "resources" | "shifts" | "reports" | "admin";

type WorkspaceRecord = {
  id: string;
  title?: string;
  name?: string;
  code?: string;
  detail?: string;
  description?: string;
  state?: string;
  status?: string;
  quality?: string;
  issueNumber?: string;
  workflowState?: string;
  owner?: string | null;
  supervisor?: string;
  time?: string;
  unresolved?: number;
  equipmentId?: string;
  scheduledFor?: string;
  parts?: unknown[];
};

type WorkspaceResponse = {
  eyebrow: string;
  title: string;
  description: string;
  records: WorkspaceRecord[];
};

const icons = {
  exceptions: ClipboardCheck,
  equipment: Wrench,
  resources: PackageCheck,
  shifts: UsersRound,
  reports: BarChart3,
  admin: Settings2,
};

const actionLabels: Partial<Record<WorkspaceKey, string>> = {
  exceptions: "Report issue",
  resources: "View next readiness risk",
  shifts: "Prepare handover",
  reports: "Open production report",
};

const actionLinks: Partial<Record<WorkspaceKey, string>> = {
  exceptions: "/exceptions/new",
  resources: "/resources/readiness-ex204-1000h",
  shifts: "/shifts/shift-a-20250424/handover",
  reports: "/reports/production-vs-plan",
};

function recordHref(workspace: WorkspaceKey, record: WorkspaceRecord) {
  if (workspace === "exceptions") return `/exceptions/${record.id}`;
  if (workspace === "equipment") return `/equipment/${record.id}`;
  if (workspace === "resources") return `/resources/${record.id}`;
  if (workspace === "shifts") return `/shifts/${record.id}`;
  if (workspace === "reports") return `/reports/${record.id}`;
  return "/admin";
}

function recordTitle(record: WorkspaceRecord) {
  return record.title ?? record.name ?? record.code ?? record.id;
}

function recordDescription(record: WorkspaceRecord) {
  return (
    record.detail ??
    record.description ??
    record.state ??
    (record.time ? `${record.time} · ${record.supervisor ?? "Supervisor pending"}` : undefined) ??
    (record.issueNumber ? `${record.issueNumber} · ${record.owner ?? "Owner pending"}` : undefined) ??
    "Open the evidence-linked record."
  );
}

export function WorkspaceScreen({ workspace }: { workspace: WorkspaceKey }) {
  const query = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: () => demoFetch<WorkspaceResponse>(`/workspaces/${workspace}`),
  });
  const Icon = icons[workspace];

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const actionLabel = actionLabels[workspace];
  const actionLink = actionLinks[workspace];

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow={query.data.eyebrow}
        title={query.data.title}
        description={query.data.description}
        icon={Icon}
        action={
          actionLabel && actionLink ? (
            <Link className="button button--primary" href={actionLink}>
              {workspace === "exceptions" ? <CirclePlus /> : <ArrowRight />}
              {actionLabel}
            </Link>
          ) : undefined
        }
      />

      <section className="workspace-summary-grid">
        <article className="summary-tile"><span>Current site</span><strong>Riverside Mine</strong><small>Fictional · site-scoped</small></article>
        <article className="summary-tile"><span>Records shown</span><strong>{query.data.records.length}</strong><small>Deterministic demo data</small></article>
        <article className="summary-tile"><span>Information state</span><strong>Mixed</strong><small>Reported, verified and unknown remain separate</small></article>
      </section>

      <section className="card register-card">
        <header className="card__header">
          <div><span className="eyebrow">Canonical records</span><h2>{query.data.title}</h2></div>
          <div className="filter-chips" aria-label="Record filters"><button className="active">All</button><button>Needs attention</button><button>Unknown</button></div>
        </header>
        <div className="record-list">
          {query.data.records.map((record, index) => {
            const href = recordHref(workspace, record);
            const quality = record.quality ?? record.workflowState ?? record.status ?? (index === 0 ? "reported" : "pending");
            return (
              <Link href={href} className="record-row" key={record.id}>
                <span className="record-row__icon">
                  {workspace === "equipment" ? <Wrench /> : workspace === "resources" ? <Boxes /> : workspace === "reports" ? <BarChart3 /> : <FileText />}
                </span>
                <span className="record-row__copy">
                  <strong>{recordTitle(record)}</strong>
                  <small>{recordDescription(record)}</small>
                </span>
                {record.unresolved !== undefined ? <span className="record-row__metric"><strong>{record.unresolved}</strong><small>open</small></span> : null}
                {workspace !== "admin" ? <StatusBadge value={quality} /> : <StatusBadge value="verified" label="Demo only" />}
                <ArrowRight className="record-row__arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      {workspace === "admin" ? (
        <section className="safety-boundary">
          <Settings2 />
          <div><h2>Configuration preview only</h2><p>No production identity, live integration, tenant, billing or permission system is connected.</p></div>
        </section>
      ) : null}
    </div>
  );
}
