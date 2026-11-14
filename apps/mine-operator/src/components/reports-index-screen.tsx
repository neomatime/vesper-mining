"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Gauge, Layers3, LineChart, Lock, PackageCheck, Repeat2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { entitlementsFor } from "@/lib/entitlements";
import type { ReportKey, ReportSummary } from "@/lib/reports";
import { useDemoContext } from "@/stores/demo-context";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";

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
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const reports = query.data;
  const unlocked = reports.filter((report) => !report.advanced || plan.advancedAnalytics).length;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Reports" title="Operational intelligence" description="Evidence-linked measures with clear units, definitions and information quality." icon={BarChart3} />
      <section className="kpi-row" aria-label="Reporting summary">
        <article className="kpi"><span>Reporting level</span><strong>{plan.reporting}</strong><small>{plan.label}</small></article>
        <article className="kpi"><span>Reports available</span><strong>{unlocked} of {reports.length}</strong><small>{plan.advancedAnalytics ? "Every report is included" : "Advanced analytics are not included"}</small></article>
        <article className="kpi"><span>Data basis</span><strong>Live records</strong><small>Most reports update as you work</small></article>
      </section>
      <section className="catalogue" aria-label="Reports">
        {reports.map((report) => {
          const Icon = icons[report.key];
          const locked = report.advanced && !plan.advancedAnalytics;
          return (
            <Link key={report.key} href={`/reports/${report.key}`} className={`catalogue__card ${locked ? "catalogue__card--locked" : ""}`}>
              <span className="catalogue__icon"><Icon aria-hidden="true" /></span>
              <strong>{report.title}</strong>
              <p>{report.description}</p>
              <span className="catalogue__foot">
                {report.advanced ? <span className="chip">{locked ? <Lock /> : null} Advanced</span> : <span className="chip">Included</span>}
                <span className="catalogue__open">{locked ? "Not included" : "Open report"}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
