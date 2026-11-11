"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Database, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoFetch } from "@/lib/api";
import { formatStatus } from "@/lib/calculations";
import { entitlementsFor } from "@/lib/entitlements";
import type { ReportView } from "@/lib/reports";
import { useDemoContext } from "@/stores/demo-context";
import { EntitlementGate } from "./entitlement-gate";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

function cellText(key: string, value: string | number | null) {
  if (value === null) return "Unknown";
  if (key === "priority" && typeof value === "string") return formatStatus(value);
  return value;
}

export function ReportDetailScreen({ reportKey }: { reportKey: string }) {
  const { context } = useDemoContext();
  const query = useQuery({
    queryKey: ["report", reportKey],
    queryFn: () => demoFetch<ReportView>(`/reports/${reportKey}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const report = query.data;

  if (report.advanced && !entitlementsFor(context.tier).advancedAnalytics) {
    return (
      <div className="workspace-page">
        <Link href="/reports" className="back-link"><ArrowLeft /> Reports</Link>
        <EntitlementGate capability="advancedAnalytics" />
      </div>
    );
  }

  const { chart } = report;

  return (
    <div className="workspace-page">
      <Link href="/reports" className="back-link"><ArrowLeft /> Reports</Link>
      <PageHeader eyebrow={`${report.period}`} title={report.title} description={report.description} icon={BarChart3} action={<StatusBadge value={report.quality} />} />
      <section className="report-layout">
        <article className="card report-chart-card">
          <header className="card__header"><div><span className="eyebrow">Chart</span><h2>{chart.title}{chart.unit ? ` · ${chart.unit}` : ""}</h2></div><span><Database /> {report.source}</span></header>
          <div className="report-chart" role="img" aria-label={`${chart.title} bar chart. The same figures are in the table below.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data}>
                <CartesianGrid vertical={false} stroke="#E7ECE8" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={chart.data.length > 5 ? "preserveStartEnd" : 0} minTickGap={12} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "rgba(22,134,91,0.06)" }} />
                {chart.series.length > 1 ? <Legend /> : null}
                {chart.series.map((series) => (
                  <Bar key={series.key} name={series.label} dataKey={series.key} fill={series.color} stackId={chart.stacked ? "stack" : undefined} radius={chart.stacked ? 0 : [5, 5, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {report.rows.length === 0 ? (
            <div className="empty-inline"><strong>No records yet</strong><span>This report fills in as issues and stock figures are recorded.</span></div>
          ) : (
            <div className="report-table-wrap">
              <table className="data-table" aria-label={`${chart.title} data`}>
                <thead><tr>{report.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
                <tbody>
                  {report.rows.map((row, index) => (
                    <tr key={index}>{report.columns.map((column) => <td key={column.key}>{cellText(column.key, row[column.key])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <aside className="report-sidebar">
          <article className="card report-definition"><Info /><span className="eyebrow">Metric definition</span><h2>{report.title}</h2><p>{report.definition}</p></article>
          <article className="card report-definition report-definition--caveat"><TriangleAlert /><span className="eyebrow">Read with care</span><p>{report.caveat}</p></article>
          {report.issues.length > 0 && report.key !== "delay-analytics" ? (
            <article className="card"><header className="card__header"><div><span className="eyebrow">Source records</span><h2>Related issues</h2></div></header>{report.issues.map((issue) => <Link className="report-source-link" href={`/exceptions/${issue.id}`} key={issue.id}><span>{issue.issueNumber}</span><strong>{issue.title}</strong><StatusBadge value={issue.workflowState} /></Link>)}</article>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
