"use client";

import { useQuery } from "@tanstack/react-query";
import type { MapArea } from "@vesper/api-contracts";
import { Clock3, Info, Map, MapPin, ShieldAlert } from "lucide-react";
import { demoFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "./query-state";
import { OperationalMapClient } from "./operational-map-client";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";

export function MapScreen() {
  const query = useQuery({
    queryKey: ["areas", "site-riverside"],
    queryFn: () => demoFetch<MapArea[]>("/areas"),
  });
  if (query.isPending) return <LoadingState label="Loading fictional operational map" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Operational Map" title="Explainable area status" description="Inspect fictional operating areas, the evidence behind each status and related operational constraints." icon={Map} />
      <section className="map-workspace">
        <article className="card map-workspace__canvas">
          <header className="card__header"><div><span className="eyebrow">Riverside Mine · fictional site plan</span><h2>Current demonstration state</h2></div><span className="map-quality"><Info /> No live GPS or surveyed positioning</span></header>
          <OperationalMapClient areas={query.data} />
        </article>
        <aside className="card map-workspace__list">
          <header className="card__header"><div><span className="eyebrow">Accessible map alternative</span><h2>Operating areas</h2></div></header>
          <div className="area-list">
            {query.data.map((area) => (
              <article key={area.id} className="area-list__item">
                <div className="area-list__title"><span><MapPin /></span><div><strong>{area.name}</strong><small>{area.source.label}</small></div><StatusBadge value={area.status} /></div>
                <p>{area.rationale}</p>
                <small className="area-list__meta"><Clock3 /> Last evidence: {area.source.observedAt.slice(11, 16)} demo time · <StatusBadge value={area.source.quality} /></small>
              </article>
            ))}
          </div>
          <div className="evidence-callout"><ShieldAlert /><div><strong>Operational status is not safety clearance</strong><p>Map colours describe a fictional operating condition only.</p></div></div>
        </aside>
      </section>
    </div>
  );
}
