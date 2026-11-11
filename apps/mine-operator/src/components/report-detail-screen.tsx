"use client";

import { useQuery } from "@tanstack/react-query";
import type { OperationalIssue } from "@vesper/api-contracts";
import { ArrowLeft, BarChart3, Database, Info } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

type ReportResponse = {
  key: string;
  title: string;
  period: string;
  quality: string;
  source: string;
  series: Array<{ label: string; plan: number; actual: number }>;
  issues: OperationalIssue[];
};

export function ReportDetailScreen({ reportKey }: { reportKey: string }) {
  const query = useQuery({
    queryKey: ["report", reportKey],
    queryFn: () => demoFetch<ReportResponse>(`/reports/${reportKey}`),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const report = query.data;

  return (
    <div className="workspace-page">
      <Link href="/reports" className="back-link"><ArrowLeft /> Reports</Link>
      <PageHeader eyebrow={`${report.period} · fictional data`} title={report.title} description="Evidence-linked reporting with visible units, definitions and source quality." icon={BarChart3} action={<StatusBadge value={report.quality} />} />
      <section className="report-layout">
        <article className="card report-chart-card">
          <header className="card__header"><div><span className="eyebrow">Production context</span><h2>Actual vs plan · thousand tonnes</h2></div><span><Database /> {report.source}</span></header>
          <div className="report-chart" aria-label="Illustrative production actual versus plan bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.series}>
                <CartesianGrid vertical={false} stroke="#E7ECE8" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} unit="k" />
                <Tooltip />
                <Legend />
                <Bar name="Plan" dataKey="plan" fill="#CDE8DA" radius={[5, 5, 0, 0]} />
                <Bar name="Actual" dataKey="actual" fill="#16865B" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="report-table" role="table" aria-label="Production chart data">
            <div role="row"><strong>Date</strong><strong>Plan (kt)</strong><strong>Actual (kt)</strong></div>
            {report.series.map((item) => <div role="row" key={item.label}><span>{item.label}</span><span>{item.plan}</span><span>{item.actual}</span></div>)}
          </div>
        </article>
        <aside className="report-sidebar">
          <article className="card report-definition"><Info /><span className="eyebrow">Metric definition</span><h2>Production vs plan</h2><p>Compares a fictional shift-level reported actual with its fixture target. Values are not verified mine output and do not establish loss, recovery or financial benefit.</p></article>
          <article className="card"><header className="card__header"><div><span className="eyebrow">Source records</span><h2>Related exceptions</h2></div></header>{report.issues.map((issue) => <Link className="report-source-link" href={`/exceptions/${issue.id}`} key={issue.id}><span>{issue.issueNumber}</span><strong>{issue.title}</strong><StatusBadge value={issue.quality} /></Link>)}</article>
        </aside>
      </section>
    </div>
  );
}
