"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadinessActivity } from "@vesper/api-contracts";
import { ArrowLeft, CalendarClock, CheckCircle2, PackageCheck, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { demoFetch } from "@/lib/api";
import { potentiallyAllocable } from "@/lib/calculations";
import { ErrorState, LoadingState } from "./query-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

export function ReadinessDetailScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["readiness", id],
    queryFn: () => demoFetch<ReadinessActivity>(`/readiness/${id}`),
  });
  const mutation = useMutation({
    mutationFn: () => demoFetch<ReadinessActivity>(`/readiness/${id}/reviews`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["readiness", id] });
      await queryClient.invalidateQueries({ queryKey: ["workspace", "resources"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const activity = query.data;

  return (
    <div className="workspace-page">
      <Link href="/resources" className="back-link"><ArrowLeft /> Resource Readiness</Link>
      <PageHeader eyebrow="Maintenance-delay prevention" title={activity.title} description="Review required parts, information certainty, inbound supply and the next authorised human action." icon={PackageCheck} action={<StatusBadge value={activity.status} />} />
      <section className="readiness-layout">
        <article className="card readiness-summary">
          <div><span><CalendarClock /></span><small>Scheduled need</small><strong>14 May 2025</strong><p>Fixture date · 20 days from demo clock</p></div>
          <div><span><Warehouse /></span><small>Readiness state</small><strong>Potential shortage</strong><p>Based on verified hydraulic-filter stock</p></div>
          <div><span><Truck /></span><small>Indicative order-by</small><strong>27 Apr 2025</strong><p>14-day lead time + 3-day buffer</p></div>
        </article>
        <article className="card detail-card">
          <header className="card__header"><div><span className="eyebrow">Prerequisite evidence</span><h2>Required parts</h2></div><span>No automatic purchase action</span></header>
          <div className="parts-table" role="table" aria-label="Required parts and stock evidence">
            <div className="parts-table__head" role="row"><span>Part</span><span>Required</span><span>Potentially allocable</span><span>Inbound</span><span>Quality</span></div>
            {activity.parts.map((part) => {
              const allocable = potentiallyAllocable(part.onHand, part.reserved);
              return (
                <div className="parts-table__row" role="row" key={part.id}>
                  <span><strong>{part.name}</strong><small>{part.id}</small></span>
                  <span>{part.required}</span>
                  <span>{allocable === null ? "Unknown" : allocable}</span>
                  <span>{part.inbound ?? "Unknown"}</span>
                  <StatusBadge value={part.quality} />
                </div>
              );
            })}
          </div>
          <div className="evidence-callout"><PackageCheck /><div><strong>Review recommendation</strong><p>The verified hydraulic-filter allocation is insufficient and no timely inbound quantity is recorded. The engine-oil status remains unknown and must not be treated as zero.</p></div></div>
        </article>
        <article className="card review-panel">
          <span className="eyebrow">Authorised human review</span>
          <h2>{activity.reviewState === "reviewed" ? "Review recorded" : "Purchasing review recommended"}</h2>
          <p>{activity.reviewState === "reviewed" ? "A simulated review event was recorded. No purchase was approved or submitted." : "Confirm the maintenance scope, stores evidence and supplier lead time before any external procurement process."}</p>
          {activity.reviewState === "reviewed" ? <div className="inline-success"><CheckCircle2 /> Demo review complete · no order placed</div> : <button className="button button--primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Recording review…" : "Record simulated review"}</button>}
        </article>
      </section>
    </div>
  );
}
