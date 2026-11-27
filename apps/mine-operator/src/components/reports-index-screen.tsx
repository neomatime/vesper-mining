"use client";

/**
 * The list of reports, showing only those the subscription's reporting level can open.
 */
import { useQuery } from "@tanstack/react-query";
import { reportingLevelLabels } from "@vesper/api-contracts";
import { BarChart3, Gauge, Layers3, LineChart, Lock, PackageCheck, Repeat2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@core/lib/api";
import { canSeeReport, entitlementsFor } from "@core/lib/entitlements";
import type { ReportKey, ReportSummary } from "@core/lib/reports";
import { useDemoContext } from "@core/stores/demo-context";
import { PageHeader } from "@core/components/page-header";
import { ErrorState, LoadingState } from "@core/components/query-state";

const icons: Record<ReportKey, typeof BarChart3> = {
  "production-vs-plan": Gauge,
  "operational-exceptions": ShieldAlert,
  "equipment-delay-stages": Layers3,
  "resource-readiness": PackageCheck,
  "recurring-causes": Repeat2,
  "delay-analytics": LineChart,
};

export function ReportsIndexScreen() {
  const { context } = useDemoContext();
  const plan = entitlementsFor(context.tier);
  const query = useQuery({ queryKey: ["reports"], queryFn: () => demoFetch<ReportSummary[]>("/reports") });
  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;

  const reports = query.data;
  const unlocked = reports.filter((report) => canSeeReport(context.tier, report.level)).length;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Intelligence" title="Reports" description="Evidence-linked measures with clear units, definitions and information quality." icon={BarChart3} />
      <section className="kpi-row" aria-label="Reporting summary">
        <article className="kpi"><span>Reporting level</span><strong>{plan.reporting}</strong><small>{plan.label}</small></article>
        <article className="kpi"><span>Reports available</span><strong>{unlocked} of {reports.length}</strong><small>{unlocked === reports.length ? "Every report is included" : "Higher reporting levels are not included"}</small></article>
        <article className="kpi"><span>Data basis</span><strong>Live records</strong><small>Most reports update as you work</small></article>
      </section>
      <section className="catalogue" aria-label="Reports">
        {reports.map((report) => {
          const Icon = icons[report.key];
          const locked = !canSeeReport(context.tier, report.level);
          return (
            <Link key={report.key} href={`/reports/${report.key}`} className={`catalogue__card ${locked ? "catalogue__card--locked" : ""}`}>
              <span className="catalogue__icon"><Icon aria-hidden="true" /></span>
              <strong>{report.title}</strong>
              <p>{report.description}</p>
              <span className="catalogue__foot">
                <span className="chip">{locked ? <Lock /> : null} {reportingLevelLabels[report.level]}</span>
                <span className="catalogue__open">{locked ? "Not included" : "Open report"}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
