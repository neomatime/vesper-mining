"use client";

/**
 * The Map view of Deliveries: a collapsible filter panel, the live map, a floating panel for the chosen vehicle or delivery, and a
 * legend. Filters and selection belong to the Deliveries page, so the table below the map follows the same filters and a delivery
 * chosen in the table is found on the map.
 */
import { ChevronLeft, ChevronRight, Filter, Truck, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatTonnes } from "@/lib/trade-rules";
import { freshnessLabels } from "@/lib/tracking/telematics";
import { deliveryTrackingStatus, trackingStatusLabels, type Journey, type TrackingStatus } from "@/lib/tracking/tracking";
import { places } from "@/lib/tracking/network";
import { Select } from "../select";
import type { MapSelection } from "./delivery-map";

const DeliveryMap = dynamic(() => import("./delivery-map").then((module) => module.DeliveryMap), {
  ssr: false,
  loading: () => <div className="dm-map dm-map--loading" role="status">Loading the map…</div>,
});

export type MapFilters = { query: string; agreementId: string; clientId: string; mineral: string; statuses: TrackingStatus[]; provider: string; vehicle: string; origin: string; destination: string };
export const emptyFilters: MapFilters = { query: "", agreementId: "", clientId: "", mineral: "", statuses: [], provider: "", vehicle: "", origin: "", destination: "" };
export const filtersActive = (filters: MapFilters) => Object.entries(filters).some(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));

/** Whether a vehicle journey passes the map filters. */
export function journeyMatches(journey: Journey, filters: MapFilters) {
  const query = filters.query.trim().toLowerCase();
  if (query && ![journey.delivery.number, journey.delivery.agreementNumber, journey.delivery.clientName, journey.registration].some((value) => value.toLowerCase().includes(query))) return false;
  if (filters.statuses.length && !filters.statuses.includes(journey.status === "arrived" ? "on_track" : journey.status)) return false;
  if (filters.provider && journey.providerName !== filters.provider) return false;
  if (filters.vehicle && journey.registration !== filters.vehicle) return false;
  if (filters.origin && journey.origin.id !== filters.origin) return false;
  if (filters.destination && journey.destination.id !== filters.destination) return false;
  return true;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
const statusKeys: TrackingStatus[] = ["on_track", "at_risk", "delayed", "unavailable"];

export function DeliveryMapView({ journeys, allJourneys, now, live, onLiveChange, filters, onApply, options, selection, onSelect, focusKey }: {
  /** The journeys that pass the filters (shown on the map). */
  journeys: Journey[];
  /** Every tracked journey, for the filter options and the legend. */
  allJourneys: Journey[];
  now: string;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  filters: MapFilters;
  onApply: (filters: MapFilters) => void;
  options: { agreements: { id: string; label: string }[]; clients: { id: string; label: string }[]; minerals: string[] };
  selection: MapSelection;
  onSelect: (selection: MapSelection, focus?: boolean) => void;
  focusKey: string;
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  // Full screen sits above the whole app (top bar and sidebar included), so it is drawn on the page body, not inside the page.
  // A placeholder keeps the page's height while the map is out, so the table does not jump.
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const toggleExpanded = () => {
    if (!expanded) setPlaceholderHeight(placeholderRef.current?.offsetHeight ?? 0);
    setExpanded(!expanded);
  };
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector(".floating-panel")) setExpanded(false); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [expanded]);

  const providers = useMemo(() => [...new Set(allJourneys.map((item) => item.providerName))].sort(), [allJourneys]);
  const vehicles = useMemo(() => [...new Set(allJourneys.map((item) => item.registration))].sort(), [allJourneys]);
  const destinations = useMemo(() => [...new Map(allJourneys.map((item) => [item.destination.id, item.destination.name])).entries()], [allJourneys]);
  const counts = (status: TrackingStatus) => journeys.filter((item) => (item.status === "arrived" ? "on_track" : item.status) === status).length;

  const vehicle = journeys.find((item) => item.vehicleId === selection.vehicleId) ?? allJourneys.find((item) => item.vehicleId === selection.vehicleId) ?? null;
  const chosenDeliveries = selection.deliveryIds.map((id) => allJourneys.filter((item) => item.delivery.id === id)).filter((group) => group.length);

  const view = (
    <div className={`dm-view ${expanded ? "is-expanded" : ""} ${panelOpen ? "" : "is-collapsed"}`} role="region" aria-label="Delivery map">
      <aside className="dm-filters" aria-label="Map filters">
        <header className="dm-filters__head">
          <span><Filter aria-hidden="true" /> {panelOpen ? "Filters" : null}</span>
          <button type="button" className="icon-button icon-button--light" aria-label={panelOpen ? "Collapse filters" : "Expand filters"} aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? <ChevronLeft /> : <ChevronRight />}</button>
        </header>
        {panelOpen ? (
          <FilterForm key={JSON.stringify(filters)} filters={filters} onApply={onApply} options={options} providers={providers} vehicles={vehicles} destinations={destinations} />
        ) : null}
      </aside>

      <div className="dm-stage">
        <DeliveryMap
          journeys={journeys}
          selection={selection}
          focusKey={focusKey}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          onSelectVehicle={(journey, add) => onSelect(add ? { deliveryIds: [...new Set([...selection.deliveryIds, journey.delivery.id])], vehicleId: journey.vehicleId } : { deliveryIds: [journey.delivery.id], vehicleId: journey.vehicleId })}
        />
        <div className="dm-live">
          <button type="button" className={`dm-live__toggle ${live ? "is-live" : ""}`} aria-pressed={live} onClick={() => onLiveChange(!live)}>
            <span className="dm-live__dot" aria-hidden="true" />{live ? "Live tracking" : "Tracking paused"}
          </button>
          <small>Updated {clock(now)}</small>
        </div>

        {vehicle ? (
          <VehiclePanel journey={vehicle} siblings={allJourneys.filter((item) => item.delivery.id === vehicle.delivery.id)} onSelect={(next) => onSelect({ deliveryIds: [next.delivery.id], vehicleId: next.vehicleId }, true)} onClose={() => onSelect({ deliveryIds: [], vehicleId: null })} />
        ) : chosenDeliveries.length ? (
          <DeliveriesPanel groups={chosenDeliveries} onSelect={(next) => onSelect({ deliveryIds: selection.deliveryIds, vehicleId: next.vehicleId }, true)} onClose={() => onSelect({ deliveryIds: [], vehicleId: null })} />
        ) : null}

        <ul className="dm-legend" aria-label="Legend">
          {statusKeys.map((status) => <li key={status}><span className={`dm-dot dm-dot--${status}`} aria-hidden="true" />{status === "unavailable" ? "No tracking" : trackingStatusLabels[status]} ({counts(status)})</li>)}
          <li><span className="dm-dot dm-dot--destination" aria-hidden="true" />Destination</li>
          <li><span className="dm-line" aria-hidden="true" />Route</li>
        </ul>
      </div>
    </div>
  );

  if (expanded) {
    return (
      <>
        <div className="dm-view-placeholder" style={{ height: placeholderHeight }} aria-hidden="true" />
        {createPortal(<div className="dm-fullscreen">{view}</div>, document.body)}
      </>
    );
  }
  return <div ref={placeholderRef} className="dm-view-host">{view}</div>;
}

function FilterForm({ filters, onApply, options, providers, vehicles, destinations }: {
  filters: MapFilters;
  onApply: (filters: MapFilters) => void;
  options: { agreements: { id: string; label: string }[]; clients: { id: string; label: string }[]; minerals: string[] };
  providers: string[];
  vehicles: string[];
  destinations: [string, string][];
}) {
  // A draft until Apply, so the map does not jump with every change; the key resets it when the filters are cleared elsewhere.
  const [draft, setDraft] = useState(filters);
  const set = (key: keyof MapFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [key]: event.target.value });
  return (
    <form className="dm-filters__body" onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
      <label className="dm-field"><span>Delivery</span><input value={draft.query} onChange={set("query")} placeholder="Reference, customer or vehicle" /></label>
      <label className="dm-field"><span>Agreement</span><Select value={draft.agreementId} onChange={set("agreementId")}><option value="">All agreements</option>{options.agreements.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
      <label className="dm-field"><span>Customer</span><Select value={draft.clientId} onChange={set("clientId")}><option value="">All customers</option>{options.clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
      <label className="dm-field"><span>Mineral</span><Select value={draft.mineral} onChange={set("mineral")}><option value="">All minerals</option>{options.minerals.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <fieldset className="dm-field dm-status">
        <legend>Status</legend>
        {statusKeys.map((status) => (
          <label key={status} className={`dm-chip ${draft.statuses.includes(status) ? "is-on" : ""}`}>
            <input type="checkbox" checked={draft.statuses.includes(status)} onChange={(event) => setDraft({ ...draft, statuses: event.target.checked ? [...draft.statuses, status] : draft.statuses.filter((item) => item !== status) })} />
            <span className={`dm-dot dm-dot--${status}`} aria-hidden="true" />{trackingStatusLabels[status]}
          </label>
        ))}
      </fieldset>
      <label className="dm-field"><span>Logistics provider</span><Select value={draft.provider} onChange={set("provider")}><option value="">All providers</option>{providers.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <label className="dm-field"><span>Vehicle</span><Select value={draft.vehicle} onChange={set("vehicle")}><option value="">All vehicles</option>{vehicles.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <label className="dm-field"><span>Origin</span><Select value={draft.origin} onChange={set("origin")}><option value="">All origins</option><option value={places.riverside.id}>{places.riverside.name}</option></Select></label>
      <label className="dm-field"><span>Destination</span><Select value={draft.destination} onChange={set("destination")}><option value="">All destinations</option>{destinations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></label>
      <div className="dm-filters__actions">
        <button type="button" className="row-link-text" onClick={() => { setDraft(emptyFilters); onApply(emptyFilters); }}>Clear all</button>
        <button type="submit" className="button button--primary button--small">Apply</button>
      </div>
    </form>
  );
}

function StatusPill({ status }: { status: TrackingStatus }) {
  return <span className={`dm-pill dm-pill--${status}`}>{trackingStatusLabels[status]}</span>;
}

function VehiclePanel({ journey, siblings, onSelect, onClose }: { journey: Journey; siblings: Journey[]; onSelect: (journey: Journey) => void; onClose: () => void }) {
  const progress = Math.round(journey.progress * 100);
  return (
    <section className="dm-panel" aria-label={`${journey.delivery.number}, vehicle ${journey.registration}`}>
      <header className="dm-panel__head">
        <span className="dm-panel__icon" aria-hidden="true"><Truck /></span>
        <div>
          <strong>{journey.delivery.number}</strong>
          <small>{journey.delivery.clientName}</small>
        </div>
        <StatusPill status={journey.status} />
        <button type="button" className="icon-button icon-button--light" aria-label="Close" onClick={onClose}><X /></button>
      </header>
      <dl className="dm-panel__facts">
        <div><dt>Mineral</dt><dd>{journey.delivery.commodity}</dd></div>
        <div><dt>ETA</dt><dd>{journey.moving === "arrived" ? "Arrived" : clock(journey.etaAt)}{journey.estimated ? " (estimate)" : ""}</dd></div>
        <div><dt>Delivery volume</dt><dd>{formatTonnes(journey.delivery.tonnes)}</dd></div>
        <div><dt>Distance remaining</dt><dd>{Math.round(journey.remainingKm)} km</dd></div>
        <div><dt>This load</dt><dd>{formatTonnes(journey.loadTonnes)} · {journey.loadNumber} of {journey.loadCount}</dd></div>
        <div><dt>Vehicle</dt><dd>{journey.registration}</dd></div>
        <div><dt>Logistics provider</dt><dd>{journey.providerName}</dd></div>
        <div><dt>Last update</dt><dd className={`dm-fresh dm-fresh--${journey.freshness}`}>{journey.lastUpdateAt ? `${clock(journey.lastUpdateAt)} · ${freshnessLabels[journey.freshness]}` : freshnessLabels.unavailable}</dd></div>
      </dl>
      {journey.estimated ? <p className="dm-panel__note">This vehicle sends no tracking data. Its position is estimated from its departure time.</p> : journey.moving === "stopped" ? <p className="dm-panel__note">Stopped{journey.speedKph === 0 ? " (0 km/h)" : ""}. The ETA allows for the stop.</p> : null}
      <div className="dm-panel__progress">
        <span>Journey progress <strong>{progress}%</strong></span>
        <span className="dm-bar"><span className={`dm-bar__fill dm-bar__fill--${journey.status}`} style={{ transform: `scaleX(${journey.progress})` }} /></span>
      </div>
      {siblings.length > 1 ? (
        <div className="dm-panel__siblings" role="group" aria-label="Other vehicles on this delivery">
          {siblings.map((item) => (
            <button key={item.vehicleId} type="button" className={`dm-sibling ${item.vehicleId === journey.vehicleId ? "is-current" : ""}`} aria-pressed={item.vehicleId === journey.vehicleId} onClick={() => onSelect(item)}>
              <span className={`dm-dot dm-dot--${item.status === "arrived" ? "on_track" : item.status}`} aria-hidden="true" />{item.registration}
            </button>
          ))}
        </div>
      ) : null}
      <footer className="dm-panel__foot">
        <Link className="button button--quiet button--small" href={`/trade/deliveries/${journey.delivery.id}`}>View delivery details</Link>
      </footer>
    </section>
  );
}

function DeliveriesPanel({ groups, onSelect, onClose }: { groups: Journey[][]; onSelect: (journey: Journey) => void; onClose: () => void }) {
  return (
    <section className="dm-panel" aria-label={groups.length === 1 ? `${groups[0][0].delivery.number} vehicles` : "Selected deliveries"}>
      <header className="dm-panel__head">
        <span className="dm-panel__icon" aria-hidden="true"><Truck /></span>
        <div>
          <strong>{groups.length === 1 ? groups[0][0].delivery.number : `${groups.length} deliveries`}</strong>
          <small>{groups.length === 1 ? groups[0][0].delivery.clientName : "Monitoring together"}</small>
        </div>
        {groups.length === 1 ? <StatusPill status={deliveryTrackingStatus(groups[0])} /> : null}
        <button type="button" className="icon-button icon-button--light" aria-label="Close" onClick={onClose}><X /></button>
      </header>
      {groups.map((group) => (
        <div key={group[0].delivery.id} className="dm-panel__group">
          {groups.length > 1 ? <p className="dm-panel__group-title">{group[0].delivery.number} · {group[0].delivery.clientName}</p> : <p className="dm-panel__group-title">{formatTonnes(group[0].delivery.tonnes)} {group[0].delivery.commodity.toLowerCase()} to {group[0].destination.name} · {group.length} vehicles</p>}
          <ul className="dm-vehicle-list">
            {group.map((item) => (
              <li key={item.vehicleId}>
                <button type="button" onClick={() => onSelect(item)}>
                  <span className={`dm-dot dm-dot--${item.status === "arrived" ? "on_track" : item.status}`} aria-hidden="true" />
                  <strong>{item.registration}</strong>
                  <span>{trackingStatusLabels[item.status]}</span>
                  <span>{item.moving === "arrived" ? "Arrived" : `ETA ${clock(item.etaAt)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 1 ? <footer className="dm-panel__foot"><Link className="button button--quiet button--small" href={`/trade/deliveries/${groups[0][0].delivery.id}`}>View delivery details</Link></footer> : null}
    </section>
  );
}
