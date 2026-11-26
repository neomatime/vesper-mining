"use client";

/**
 * The delivery page's route and locations: both exact points on a map with the route, the site contacts and hours, the load,
 * transport and required documents. A delivery planned before exact locations existed offers to add them.
 */
import { MapPinned } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatCoordinates, formatDuration, formatKm, formatTonnes, loadFormLabels, locationSourceLabels, offloadingLabels, requiredDocumentLabels, routeSourceLabels, type SiteDetails } from "@/lib/trade-rules";
import type { DeliveryRow } from "../use-trade";

const LocationMap = dynamic(() => import("./location-map").then((module) => module.LocationMap), {
  ssr: false,
  loading: () => <div className="dm-map lp-map dm-map--loading" role="status">Loading the map…</div>,
});

function Site({ letter, kind, title, site, extra }: { letter: string; kind: "collection" | "delivery"; title: string; site: SiteDetails; extra?: React.ReactNode }) {
  const window = site.windowFrom && site.windowTo ? `${site.windowFrom}–${site.windowTo}` : site.windowFrom || site.windowTo || "Not set";
  return (
    <section className="pc-site" aria-label={title}>
      <header><span className={`lp-dot lp-dot--${kind}`} aria-hidden="true">{letter}</span><div><small>{title}</small><strong>{site.location.name}</strong></div></header>
      {site.location.address ? <p>{site.location.address}</p> : null}
      <p className="pc-coords">{formatCoordinates(site.location.position)} · {locationSourceLabels[site.location.source]}</p>
      <dl className="pc-facts">
        <div><dt>Contact</dt><dd>{site.contactName}{site.contactPhone ? <> · <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`}>{site.contactPhone}</a></> : null}</dd></div>
        {site.contactEmail ? <div><dt>Email</dt><dd><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></dd></div> : null}
        <div><dt>{kind === "collection" ? "Loading window" : "Receiving hours"}</dt><dd>{window}</dd></div>
        {extra}
        {site.instructions ? <div className="pc-wide"><dt>Instructions</dt><dd>{site.instructions}</dd></div> : null}
      </dl>
    </section>
  );
}

export function DeliveryPlanCard({ delivery, canEdit }: { delivery: DeliveryRow; canEdit: boolean }) {
  const plan = delivery.plan;
  if (!plan) {
    return (
      <article className="card pc-card pc-card--empty" aria-label="Route and locations">
        <MapPinned aria-hidden="true" />
        <div>
          <h2>Route and locations</h2>
          <p className="muted">This delivery was planned to “{delivery.destination}” without exact points. Add the collection and delivery points so the route, travel time and live tracking are exact.</p>
        </div>
        {canEdit ? <Link className="button button--primary" href={`/trade/deliveries/${delivery.id}/edit`}>Add locations</Link> : null}
      </article>
    );
  }
  return (
    <article className="card pc-card" aria-label="Route and locations">
      <header className="pc-head">
        <h2><MapPinned aria-hidden="true" /> Route and locations</h2>
        <dl className="pc-route">
          <div><dt>Distance</dt><dd>{formatKm(plan.route.km)}</dd></div>
          <div><dt>Driving time</dt><dd>{formatDuration(plan.route.minutes)}</dd></div>
          <div><dt>Route</dt><dd>{routeSourceLabels[plan.route.source]}</dd></div>
        </dl>
      </header>
      <div className="pc-body">
        <div className="pc-map"><LocationMap collection={plan.collection.location.position} delivery={plan.receiving.location.position} route={plan.route.points} readOnly /></div>
        <div className="pc-sites">
          <Site letter="A" kind="collection" title="Collection point" site={plan.collection} />
          <Site letter="B" kind="delivery" title="Delivery point" site={plan.receiving} extra={<>
            <div><dt>Offloading</dt><dd>{offloadingLabels[plan.receiving.offloading]}{plan.receiving.weighbridgeOnSite ? " · weighbridge on site" : ""}</dd></div>
            {plan.receiving.safetyRequirements ? <div className="pc-wide"><dt>Site safety</dt><dd>{plan.receiving.safetyRequirements}</dd></div> : null}
          </>} />
        </div>
      </div>
      <div className="pc-strip">
        <div><span>Load</span><strong>{plan.load.loadCount} × {formatTonnes(plan.load.tonnesPerLoad)}</strong><small>{[plan.load.grade, loadFormLabels[plan.load.form], plan.load.moisturePercent !== null ? `${plan.load.moisturePercent}% moisture` : ""].filter(Boolean).join(" · ")}</small></div>
        <div><span>Transport</span><strong>{plan.logistics.transporterName || "Not assigned yet"}</strong><small>{plan.logistics.vehicles.length ? plan.logistics.vehicles.map((item) => item.registration).join(", ") : "No vehicles yet"}{plan.logistics.trackingRequired ? " · live tracking required" : ""}</small></div>
        <div><span>Documents</span><strong>{plan.compliance.documents.length ? `${plan.compliance.documents.length} required` : "None listed"}</strong><small>{plan.compliance.documents.map((item) => requiredDocumentLabels[item]).join(", ")}{plan.compliance.hazardous ? " · dangerous goods" : ""}</small></div>
      </div>
      {plan.compliance.specialInstructions ? <p className="pc-note">{plan.compliance.specialInstructions}</p> : null}
    </article>
  );
}
