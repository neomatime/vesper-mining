"use client";

import { useQuery } from "@tanstack/react-query";
import type { MapArea } from "@vesper/api-contracts";
import { Clock3, Info, Map, MapPin, ShieldAlert } from "lucide-react";
import { demoFetch } from "@/lib/api";
import { formatDemoTime } from "@/lib/demo-clock";
import { ErrorState, LoadingState } from "./query-state";
import { OperationalMapClient } from "./operational-map-client";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

const legend = [
  { label: "On plan", color: "#16865B", meaning: "Current evidence supports the operating criteria." },
  { label: "At risk", color: "#D38B17", meaning: "A deviation or review may affect progress." },
  { label: "Blocked", color: "#D43F3A", meaning: "Verified information confirms a blocking condition." },
  { label: "Unknown", color: "#77847C", meaning: "Information is missing, old or conflicting." },
];

export function MapScreen() {
  const query = useQuery({
    queryKey: ["areas", "site-riverside"],
    queryFn: () => demoFetch<MapArea[]>("/areas"),
  });
  if (query.isPending) return <LoadingState label="Loading the operational map" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Operational Map" title="Area status" description="Inspect operating areas, the evidence behind each status and related operational constraints." icon={Map} />
      <section className="map-workspace">
        <article className="card map-workspace__canvas">
          <header className="card__header"><div><span className="eyebrow">Riverside Mine · site plan</span><h2>Current state</h2></div><span className="map-quality"><Info /> No live GPS or surveyed positioning</span></header>
          <OperationalMapClient areas={query.data} />
          <ul className="map-legend" aria-label="Status legend">
            {legend.map((item) => (
              <li key={item.label}><span style={{ background: item.color }} aria-hidden="true" /><div><strong>{item.label}</strong><small>{item.meaning}</small></div></li>
            ))}
          </ul>
        </article>
        <aside className="card map-workspace__list">
          <header className="card__header"><div><span className="eyebrow">Accessible map alternative</span><h2>Operating areas</h2></div></header>
          <div className="area-list">
            {query.data.map((area) => (
              <article key={area.id} className="area-list__item">
                <div className="area-list__title"><span><MapPin /></span><div><strong>{area.name}</strong><small>{area.source.label}</small></div><StatusBadge value={area.status} /></div>
                <p>{area.rationale}</p>
                <small className="area-list__meta"><Clock3 /> Last evidence: {formatDemoTime(area.source.observedAt)} · <StatusBadge value={area.source.quality} /></small>
              </article>
            ))}
          </div>
          <div className="evidence-callout"><ShieldAlert /><div><strong>Operational status is not safety clearance</strong><p>Map colours describe operating condition only.</p></div></div>
        </aside>
      </section>
    </div>
  );
}
