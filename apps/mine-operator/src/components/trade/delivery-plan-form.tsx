"use client";

/**
 * Planning a delivery (and changing its plan later) on its own page: the agreement and quantity, the exact collection and delivery
 * points, the route between them, the load, transport, and documents. Points are found by search (Google Maps when configured,
 * VESPER's place list always), a saved location, a pin dropped or dragged on the map, or typed coordinates. The route and travel
 * time come from Google when available, otherwise VESPER's road network or a labelled straight-line estimate.
 */
import { ArrowLeft, Bookmark, CircleAlert, Crosshair, FileCheck2, Info, MapPin, MapPinned, Navigation, PackageOpen, Plus, RotateCcw, Route, Search, Trash2, Truck, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { locationService, type PlaceSuggestion } from "@/lib/geo/location-service";
import { placeForDestination } from "@/lib/tracking/network";
import {
  addDays,
  formatCoordinates,
  formatDuration,
  formatKm,
  formatTonnes,
  loadFormLabels,
  locationSourceLabels,
  offloadingLabels,
  parseCoordinates,
  requiredDocumentLabels,
  routeSourceLabels,
  STANDARD_LOAD_TONNES,
  straightKm,
  type DeliveryLocation,
  type DeliveryPlan,
  type DeliveryRoute,
  type DeliveryVehicle,
  type LatLngPair,
  type RequiredDocument,
} from "@/lib/trade-rules";
import { Busy } from "../busy";
import { EmptyState } from "../query-state";
import { Select } from "../select";
import { useSubmissionId } from "../use-logistics";
import { useTradeAction, type DeliveryRow, type TradeView } from "../use-trade";
import type { PointKey } from "./location-map";
import { Crumbs, TradeData, TradeHeader } from "./trade-ui";

const LocationMap = dynamic(() => import("./location-map").then((module) => module.LocationMap), {
  ssr: false,
  loading: () => <div className="dm-map lp-map dm-map--loading" role="status">Loading the map…</div>,
});

type SiteDraft = { location: DeliveryLocation | null; contactName: string; contactPhone: string; contactEmail: string; windowFrom: string; windowTo: string; instructions: string };
type Draft = {
  agreementId: string;
  commitmentId: string;
  tonnes: string;
  scheduledDate: string;
  shipmentId: string;
  collection: SiteDraft;
  receiving: SiteDraft & { offloading: keyof typeof offloadingLabels; weighbridgeOnSite: boolean; safetyRequirements: string };
  saveCollection: boolean;
  saveDelivery: boolean;
  load: { grade: string; form: keyof typeof loadFormLabels; loadCount: string; tonnesPerLoad: string; moisturePercent: string };
  logistics: { transporterId: string; vehicles: DeliveryVehicle[]; trackingRequired: boolean };
  compliance: { documents: RequiredDocument[]; hazardous: boolean; specialInstructions: string };
};
type Errors = Partial<Record<string, string>>;

const emptySite: SiteDraft = { location: null, contactName: "", contactPhone: "", contactEmail: "", windowFrom: "", windowTo: "", instructions: "" };
const gradeFor = (commodity: string) => (commodity === "Coal" ? "RB1 thermal coal" : commodity === "Chrome lumpy ore" ? "Lumpy 40-42% Cr2O3" : "Met grade 42% Cr2O3");
const sectionIds = { agreement: "dp-agreement", collection: "dp-collection", delivery: "dp-delivery", load: "dp-load", transport: "dp-transport", documents: "dp-documents" };

// ---- Screens -------------------------------------------------------------------------------------------------------------

export function NewDeliveryScreen() {
  return <TradeData label="Loading" variant="detail">{(data) => <PlanPage data={data} delivery={null} />}</TradeData>;
}

export function EditDeliveryPlanScreen({ id }: { id: string }) {
  return <TradeData label="Loading the delivery" variant="detail">{(data) => {
    const delivery = data.deliveries.find((item) => item.id === id);
    if (!delivery) return <div className="workspace-page"><Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: "Not found" }]} /><EmptyState title="This delivery could not be found" description="The link may be wrong." /></div>;
    return <PlanPage data={data} delivery={delivery} />;
  }}</TradeData>;
}

function initialDraft(data: TradeView, delivery: DeliveryRow | null, agreementId: string): Draft {
  const plan = delivery?.plan ?? null;
  const agreement = data.agreements.find((item) => item.id === (delivery?.agreementId ?? agreementId));
  const commodity = delivery?.commodity ?? agreement?.commodity ?? "";
  const bay = data.locations.find((item) => item.kind === "collection");
  // The last plan's collection contact is usually the same person.
  const lastCollection = [...data.deliveries].reverse().find((item) => item.plan)?.plan?.collection;
  const site = (value: DeliveryPlan["collection"]): SiteDraft => ({ location: value.location, contactName: value.contactName, contactPhone: value.contactPhone, contactEmail: value.contactEmail, windowFrom: value.windowFrom, windowTo: value.windowTo, instructions: value.instructions });
  if (plan) {
    return {
      agreementId: delivery!.agreementId, commitmentId: delivery!.commitmentId, tonnes: String(delivery!.tonnes), scheduledDate: delivery!.scheduledDate, shipmentId: delivery!.shipmentId ?? "",
      collection: site(plan.collection),
      receiving: { ...site(plan.receiving), offloading: plan.receiving.offloading, weighbridgeOnSite: plan.receiving.weighbridgeOnSite, safetyRequirements: plan.receiving.safetyRequirements },
      saveCollection: false, saveDelivery: false,
      load: { grade: plan.load.grade, form: plan.load.form, loadCount: String(plan.load.loadCount), tonnesPerLoad: String(plan.load.tonnesPerLoad), moisturePercent: plan.load.moisturePercent === null ? "" : String(plan.load.moisturePercent) },
      logistics: { transporterId: plan.logistics.transporterId ?? "", vehicles: plan.logistics.vehicles, trackingRequired: plan.logistics.trackingRequired },
      compliance: plan.compliance,
    };
  }
  const tonnes = delivery?.tonnes ?? 0;
  return {
    agreementId: delivery?.agreementId ?? (agreement?.status === "active" ? agreement.id : ""), commitmentId: delivery?.commitmentId ?? "", tonnes: delivery ? String(delivery.tonnes) : "", scheduledDate: delivery?.scheduledDate ?? addDays(data.today, 3), shipmentId: delivery?.shipmentId ?? "",
    collection: { ...emptySite, location: bay ? { name: bay.name, address: bay.address, position: bay.position, source: "saved", placeId: bay.placeId, savedLocationId: bay.id } : null, contactName: lastCollection?.contactName ?? "", contactPhone: lastCollection?.contactPhone ?? "", windowFrom: lastCollection?.windowFrom ?? "05:00", windowTo: lastCollection?.windowTo ?? "15:00", instructions: lastCollection?.instructions ?? "" },
    receiving: { ...emptySite, windowFrom: "07:00", windowTo: "17:00", offloading: commodity === "Coal" ? "end_tipper" : "side_tipper", weighbridgeOnSite: true, safetyRequirements: "" },
    saveCollection: false, saveDelivery: true,
    load: { grade: commodity ? gradeFor(commodity) : "", form: "bulk", loadCount: tonnes ? String(Math.ceil(tonnes / STANDARD_LOAD_TONNES)) : "", tonnesPerLoad: String(STANDARD_LOAD_TONNES), moisturePercent: "" },
    logistics: { transporterId: "", vehicles: [], trackingRequired: true },
    compliance: { documents: commodity === "Coal" ? ["delivery_note", "weighbridge_ticket"] : ["delivery_note", "weighbridge_ticket", "quality_certificate"], hazardous: false, specialInstructions: "" },
  };
}

const minutesOf = (time: string) => (/^\d{2}:\d{2}$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : null);
const timeOf = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(Math.round(minutes) % 60).padStart(2, "0")}`;

function validate(draft: Draft, route: DeliveryRoute | null, editing: boolean, remaining: number | null): Errors {
  const errors: Errors = {};
  const tonnes = Number(draft.tonnes);
  if (!editing) {
    if (!draft.agreementId) errors.agreementId = "Choose an active agreement.";
    if (!draft.commitmentId) errors.commitmentId = "Choose the commitment this delivery fulfils.";
    if (!(tonnes > 0)) errors.tonnes = "Enter the planned tonnes.";
    else if (remaining !== null && tonnes > remaining * 1.1 + 0.001) errors.tonnes = `More than the ${formatTonnes(remaining)} still open on this commitment (10% tolerance). Amend the agreement first.`;
  }
  if (!draft.collection.location) errors["collection.location"] = "Set the collection point.";
  if (!draft.receiving.location) errors["receiving.location"] = "Set the delivery point.";
  if (draft.collection.location && draft.receiving.location && straightKm(draft.collection.location.position, draft.receiving.location.position) < 0.2) errors["receiving.location"] = "The delivery point is the same place as the collection point.";
  if (draft.collection.location && draft.receiving.location && !route) errors.route = "The route is still being worked out.";
  for (const [key, site, label] of [["collection", draft.collection, "collection"], ["receiving", draft.receiving, "receiving"]] as const) {
    if (site.location && site.location.name.trim().length < 2) errors[`${key}.name`] = "Give the site a name.";
    if (site.contactName.trim().length < 2) errors[`${key}.contactName`] = `Name the ${label} contact.`;
    if (site.contactPhone && !/^\+?[\d\s()-]{7,20}$/.test(site.contactPhone)) errors[`${key}.contactPhone`] = "Enter a valid phone number.";
    if (site.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contactEmail)) errors[`${key}.contactEmail`] = "Enter a valid email address.";
    const from = minutesOf(site.windowFrom);
    const to = minutesOf(site.windowTo);
    if (from !== null && to !== null && to <= from) errors[`${key}.windowTo`] = "The window must end after it starts.";
  }
  const loads = Number(draft.load.loadCount);
  const perLoad = Number(draft.load.tonnesPerLoad);
  if (!(loads >= 1) || !Number.isInteger(loads)) errors["load.loadCount"] = "Enter the number of truckloads.";
  if (!(perLoad > 0) || perLoad > 80) errors["load.tonnesPerLoad"] = "Enter the payload per truck (up to 80 t).";
  if (loads >= 1 && perLoad > 0 && tonnes > 0 && loads * perLoad < tonnes) errors["load.loadCount"] = `${loads} loads of ${formatTonnes(perLoad)} carry only ${formatTonnes(loads * perLoad)}. Add loads.`;
  if (draft.load.moisturePercent && !(Number(draft.load.moisturePercent) >= 0 && Number(draft.load.moisturePercent) <= 40)) errors["load.moisturePercent"] = "Between 0 and 40%.";
  if (draft.logistics.vehicles.length > loads && loads >= 1) errors.vehicles = `${draft.logistics.vehicles.length} vehicles are listed for ${loads} loads.`;
  const registrations = draft.logistics.vehicles.map((item) => item.registration.trim().toUpperCase());
  draft.logistics.vehicles.forEach((vehicle, index) => {
    if (vehicle.registration.trim().length < 4) errors[`vehicle.${index}.registration`] = "Enter the registration.";
    else if (registrations.indexOf(registrations[index]) !== index) errors[`vehicle.${index}.registration`] = "This vehicle is listed twice.";
    if (vehicle.driverPhone && !/^\+?[\d\s()-]{7,20}$/.test(vehicle.driverPhone)) errors[`vehicle.${index}.driverPhone`] = "Enter a valid phone number.";
  });
  return errors;
}

/** Which section an error belongs to, so the summary can link to it. */
const sectionOf = (key: string) => (key.startsWith("collection") ? sectionIds.collection : key.startsWith("receiving") || key === "route" ? sectionIds.delivery : key.startsWith("load") ? sectionIds.load : key.startsWith("vehicle") ? sectionIds.transport : sectionIds.agreement);

function PlanPage({ data, delivery }: { data: TradeView; delivery: DeliveryRow | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const submission = useSubmissionId();
  const editing = delivery !== null;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(data, delivery, params.get("agreement") ?? ""));
  const [route, setRoute] = useState<DeliveryRoute | null>(delivery?.plan?.route ?? null);
  const [routing, setRouting] = useState(false);
  const [picking, setPicking] = useState<PointKey | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [loadsEdited, setLoadsEdited] = useState(editing);
  const summaryRef = useRef<HTMLDivElement>(null);
  const routeRequest = useRef(0);

  const active = data.agreements.filter((item) => item.status === "active");
  const agreement = data.agreements.find((item) => item.id === draft.agreementId);
  const commitments = agreement?.commitments.filter((item) => editing || item.state !== "fulfilled") ?? [];
  const commitment = commitments.find((item) => item.id === draft.commitmentId);
  const remaining = commitment && !editing ? Math.max(0, commitment.tonnes - commitment.planned) : null;
  const client = data.clients.find((item) => item.id === agreement?.clientId);
  const taken = new Set(data.deliveries.filter((item) => item.shipmentId && item.stage !== "cancelled" && item.id !== delivery?.id).map((item) => item.shipmentId));
  const shipments = data.mining.shipments.filter((item) => !taken.has(item.id) && item.state !== "cancelled");
  const dispatched = (delivery?.quantities.dispatched ?? 0) > 0;
  const tonnes = Number(draft.tonnes) || 0;

  const save = useTradeAction<Record<string, unknown>, { id: string; number: string }>({
    path: editing ? `/trade/deliveries/${delivery.id}/plan` : "/trade/deliveries",
    method: editing ? "PATCH" : "POST",
    success: (result) => (editing ? { title: `${result.number} updated`, detail: "The locations, route and details are saved." } : { title: `${result.number} planned`, detail: "Mining Operations prepares and dispatches the load." }),
    onDone: (result) => router.push(`/trade/deliveries/${result.id}`),
  });

  const update = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
  const updateSite = (key: "collection" | "receiving", change: Partial<SiteDraft>) => setDraft((current) => ({ ...current, [key]: { ...current[key], ...change } }));

  const recalculate = async (from: LatLngPair | null, to: LatLngPair | null) => {
    const request = ++routeRequest.current;
    if (!from || !to || straightKm(from, to) < 0.2) {
      setRoute(null);
      return;
    }
    setRouting(true);
    const next = await locationService.route(from, to);
    if (request !== routeRequest.current) return;
    setRoute(next);
    setRouting(false);
  };

  /** Sets a point (from search, saved list, map or coordinates) and works out the route again. */
  const setPoint = (key: PointKey, location: DeliveryLocation | null) => {
    const siteKey = key === "collection" ? "collection" : "receiving";
    updateSite(siteKey, { location });
    setPicking(null);
    const from = key === "collection" ? location?.position ?? null : draft.collection.location?.position ?? null;
    const to = key === "delivery" ? location?.position ?? null : draft.receiving.location?.position ?? null;
    void recalculate(from, to);
  };
  const placeAt = async (key: PointKey, position: LatLngPair, source: DeliveryLocation["source"]) => {
    const current = key === "collection" ? draft.collection.location : draft.receiving.location;
    // Dragging a named pin keeps its name; a new pin is described from the nearest place.
    const described = current && source === "map_pin" && straightKm(current.position, position) < 2 ? { ...current, position, source: current.source === "saved" ? ("map_pin" as const) : current.source, savedLocationId: null } : await locationService.describe(position, source);
    setPoint(key, described);
  };

  const chooseCommitment = (id: string) => {
    const picked = commitments.find((item) => item.id === id);
    const open = picked ? Math.max(0, picked.tonnes - picked.planned) : 0;
    const change: Partial<Draft> = { commitmentId: id };
    if (picked && !editing) {
      change.tonnes = String(open || "");
      if (!loadsEdited) change.load = { ...draft.load, loadCount: open ? String(Math.ceil(open / (Number(draft.load.tonnesPerLoad) || STANDARD_LOAD_TONNES))) : draft.load.loadCount };
    }
    update(change);
    // The commitment names the delivery point; use the saved site for it when there is one.
    if (picked && !draft.receiving.location) {
      const place = placeForDestination(picked.deliveryPoint);
      const saved = data.locations.find((item) => item.kind === "delivery" && (item.name === picked.deliveryPoint || (place && straightKm(item.position, place.position) < 1)));
      const contact = client?.contacts[0];
      updateSite("receiving", {
        contactName: draft.receiving.contactName || contact?.name || "",
        contactPhone: draft.receiving.contactPhone || contact?.phone || "",
        contactEmail: draft.receiving.contactEmail || contact?.email || "",
      });
      if (saved) setPoint("delivery", { name: saved.name, address: saved.address, position: saved.position, source: "saved", placeId: saved.placeId, savedLocationId: saved.id });
    }
  };

  const setTonnes = (value: string) => {
    const change: Partial<Draft> = { tonnes: value };
    if (!loadsEdited && Number(value) > 0) change.load = { ...draft.load, loadCount: String(Math.ceil(Number(value) / (Number(draft.load.tonnesPerLoad) || STANDARD_LOAD_TONNES))) };
    update(change);
  };

  const currentErrors = showErrors ? validate(draft, route, editing, remaining) : errors;
  const submit = () => {
    const found = validate(draft, route, editing, remaining);
    setErrors(found);
    setShowErrors(true);
    if (Object.keys(found).length) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const plan = {
      collection: { ...draft.collection, location: draft.collection.location },
      receiving: { ...draft.receiving, location: draft.receiving.location },
      route,
      load: { ...draft.load, loadCount: Number(draft.load.loadCount), tonnesPerLoad: Number(draft.load.tonnesPerLoad), moisturePercent: draft.load.moisturePercent === "" ? null : Number(draft.load.moisturePercent) },
      logistics: { ...draft.logistics, transporterId: draft.logistics.transporterId || null },
      compliance: draft.compliance,
    };
    if (editing) save.mutate({ plan, version: delivery.version, saveCollection: draft.saveCollection, saveDelivery: draft.saveDelivery });
    else save.mutate({ agreementId: draft.agreementId, commitmentId: draft.commitmentId, tonnes, scheduledDate: draft.scheduledDate, shipmentId: draft.shipmentId || null, plan, saveCollection: draft.saveCollection, saveDelivery: draft.saveDelivery, submissionId: submission.id });
  };

  // Departure at the start of the loading window, arrival after the route's travel time, compared with the receiving window.
  const departs = minutesOf(draft.collection.windowFrom);
  const arrives = route && departs !== null ? departs + route.minutes : null;
  const receiveFrom = minutesOf(draft.receiving.windowFrom);
  const receiveTo = minutesOf(draft.receiving.windowTo);
  const arrivalNote = arrives === null ? null : arrives >= 24 * 60 ? `Arrives the next day (${timeOf(arrives)}). Plan an overnight stop or an earlier departure.` : receiveTo !== null && arrives > receiveTo ? `Arrives about ${timeOf(arrives)}, after receiving closes at ${draft.receiving.windowTo}.` : receiveFrom !== null && arrives < receiveFrom ? `Arrives about ${timeOf(arrives)}, before receiving opens at ${draft.receiving.windowFrom}.` : null;
  const capacity = (Number(draft.load.loadCount) || 0) * (Number(draft.load.tonnesPerLoad) || 0);
  const errorList = Object.entries(currentErrors).filter(([, message]) => message) as [string, string][];

  if (!data.can.manageDeliveries) return <div className="workspace-page"><Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: editing ? delivery.number : "Plan a delivery" }]} /><EmptyState title="Deliveries are planned by the commercial and stores teams" description="The Mine Manager, the Commercial / Finance Officer or the Stores / Inventory Controller can plan deliveries." /></div>;
  if (editing && (delivery.stage === "cancelled" || delivery.acceptance || dispatched)) {
    return <div className="workspace-page"><Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: delivery.number, href: `/trade/deliveries/${delivery.id}` }, { label: "Edit plan" }]} /><EmptyState title="This delivery's plan can no longer change" description={dispatched ? "It has left the mine. Its route and sites are fixed." : "It is closed."} /></div>;
  }
  if (!editing && active.length === 0) return <div className="workspace-page"><Crumbs items={[{ label: "Deliveries", href: "/trade/deliveries" }, { label: "Plan a delivery" }]} /><EmptyState title="No active agreement" description="Deliveries are planned against an active agreement's commitment." /></div>;

  return (
    <div className="workspace-page trade-page dp-page">
      <Crumbs items={editing ? [{ label: "Deliveries", href: "/trade/deliveries" }, { label: delivery.number, href: `/trade/deliveries/${delivery.id}` }, { label: "Edit plan" }] : [{ label: "Deliveries", href: "/trade/deliveries" }, { label: "Plan a delivery" }]} />
      <TradeHeader title={editing ? `Edit plan for ${delivery.number}` : "Plan a delivery"} description={editing ? "Change the exact locations, route and details before the load leaves the mine." : "Against one commitment of an active agreement: exact collection and delivery points, the route, the load, transport and documents."} icon={MapPinned} />

      {showErrors && errorList.length ? (
        <div className="dp-error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong><CircleAlert aria-hidden="true" /> {errorList.length === 1 ? "One thing needs attention" : `${errorList.length} things need attention`}</strong>
          <ul>{errorList.map(([key, message]) => <li key={key}><a href={`#${sectionOf(key)}`}>{message}</a></li>)}</ul>
        </div>
      ) : null}

      <div className="dp-layout">
        <div className="dp-sections">
          <Section id={sectionIds.agreement} index={1} title="Agreement and quantity" description="Which commitment this delivery fulfils, how much and when." icon={FileCheck2}>
            {editing ? (
              <dl className="dp-facts">
                <div><dt>Agreement</dt><dd>{delivery.agreementNumber} · {client?.name}</dd></div>
                <div><dt>Commitment</dt><dd>{delivery.commitmentLabel}</dd></div>
                <div><dt>Planned</dt><dd>{formatTonnes(delivery.tonnes)} of {delivery.commodity}</dd></div>
                <div><dt>Scheduled</dt><dd>{delivery.scheduledDate} <small className="muted">(reschedule from the delivery page)</small></dd></div>
              </dl>
            ) : (
              <div className="form-grid">
                <FieldBox label="Agreement" error={currentErrors.agreementId}>
                  <Select value={draft.agreementId} onChange={(event) => update({ agreementId: event.target.value, commitmentId: "" })}><option value="">Choose an agreement</option>{active.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.clientName} · {item.commodity}</option>)}</Select>
                </FieldBox>
                <FieldBox label="Commitment" error={currentErrors.commitmentId} hint={commitment ? `Due ${commitment.dueDate} · ${commitment.deliveryPoint}` : undefined}>
                  <Select value={draft.commitmentId} disabled={!agreement} onChange={(event) => chooseCommitment(event.target.value)}><option value="">{agreement ? "Choose a commitment" : "Choose an agreement first"}</option>{commitments.map((item) => <option key={item.id} value={item.id}>{item.label} · {formatTonnes(Math.max(0, item.tonnes - item.planned))} unplanned</option>)}</Select>
                </FieldBox>
                <FieldBox label="Planned quantity (t)" error={currentErrors.tonnes} hint={commitment ? `${formatTonnes(commitment.planned)} of ${formatTonnes(commitment.tonnes)} already planned` : undefined}>
                  <input inputMode="decimal" value={draft.tonnes} onChange={(event) => setTonnes(event.target.value)} />
                </FieldBox>
                <FieldBox label="Scheduled date">
                  <input type="date" min={data.today} value={draft.scheduledDate} onChange={(event) => update({ scheduledDate: event.target.value })} />
                </FieldBox>
                <FieldBox label="Mining Operations shipment" hint="Optional. Link the shipment that will carry this load.">
                  <Select value={draft.shipmentId} onChange={(event) => update({ shipmentId: event.target.value })}><option value="">Not linked yet</option>{shipments.map((item) => <option key={item.id} value={item.id}>{item.number} · {formatTonnes(item.tonnes)} · {item.state}</option>)}</Select>
                </FieldBox>
                {agreement ? <div className="dp-context"><span>Commodity</span><strong>{agreement.commodity}</strong><span>Delivery terms</span><strong>{agreement.incoterm}</strong></div> : null}
              </div>
            )}
          </Section>

          <Section id={sectionIds.collection} index={2} title="Collection point" description="Where the trucks load: the exact point, who to report to and when." icon={MapPin} tone="collection">
            <LocationField pointKey="collection" label="Collection point" value={draft.collection.location} saved={data.locations.filter((item) => item.kind === "collection")} picking={picking === "collection"} onPicking={(on) => setPicking(on ? "collection" : null)} onChange={(location) => setPoint("collection", location)} onRename={(name) => draft.collection.location && updateSite("collection", { location: { ...draft.collection.location, name } })} error={currentErrors["collection.location"] ?? currentErrors["collection.name"]} save={draft.saveCollection} onSave={(on) => update({ saveCollection: on })} />
            <SiteFields prefix="collection" site={draft.collection} errors={currentErrors} label="Loading window" onChange={(change) => updateSite("collection", change)} />
          </Section>

          <Section id={sectionIds.delivery} index={3} title="Delivery point" description="Where the load is received: the exact offloading point, receiving contact, hours and site rules." icon={Navigation} tone="delivery">
            <LocationField pointKey="delivery" label="Delivery point" value={draft.receiving.location} saved={data.locations.filter((item) => item.kind === "delivery").sort((a, b) => Number(b.clientId === client?.id) - Number(a.clientId === client?.id))} picking={picking === "delivery"} onPicking={(on) => setPicking(on ? "delivery" : null)} onChange={(location) => setPoint("delivery", location)} onRename={(name) => draft.receiving.location && updateSite("receiving", { location: { ...draft.receiving.location, name } })} error={currentErrors["receiving.location"] ?? currentErrors["receiving.name"] ?? currentErrors.route} save={draft.saveDelivery} onSave={(on) => update({ saveDelivery: on })} clientName={client?.name} />
            <SiteFields prefix="receiving" site={draft.receiving} errors={currentErrors} label="Receiving hours" onChange={(change) => updateSite("receiving", change)} />
            <div className="form-grid">
              <FieldBox label="Offloading method">
                <Select value={draft.receiving.offloading} onChange={(event) => updateSite("receiving", { offloading: event.target.value as Draft["receiving"]["offloading"] } as Partial<SiteDraft>)}>{Object.entries(offloadingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
              </FieldBox>
              <label className="dp-check"><input type="checkbox" checked={draft.receiving.weighbridgeOnSite} onChange={(event) => updateSite("receiving", { weighbridgeOnSite: event.target.checked } as Partial<SiteDraft>)} /><span><strong>Weighbridge on site</strong><small>Received tonnes are weighed at the delivery point.</small></span></label>
              <FieldBox label="Site safety requirements" wide hint="PPE, induction and anything drivers must know before entering.">
                <textarea rows={2} value={draft.receiving.safetyRequirements} onChange={(event) => updateSite("receiving", { safetyRequirements: event.target.value } as Partial<SiteDraft>)} />
              </FieldBox>
            </div>
          </Section>

          <Section id={sectionIds.load} index={4} title="Load" description="What is carried and how it is split into truckloads." icon={PackageOpen}>
            <div className="form-grid">
              <FieldBox label="Grade or specification" hint={agreement ? `Commodity: ${agreement.commodity}` : undefined}>
                <input value={draft.load.grade} onChange={(event) => update({ load: { ...draft.load, grade: event.target.value } })} />
              </FieldBox>
              <FieldBox label="How it is carried">
                <Select value={draft.load.form} onChange={(event) => update({ load: { ...draft.load, form: event.target.value as Draft["load"]["form"] } })}>{Object.entries(loadFormLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
              </FieldBox>
              <FieldBox label="Number of truckloads" error={currentErrors["load.loadCount"]}>
                <input inputMode="numeric" value={draft.load.loadCount} onChange={(event) => { setLoadsEdited(true); update({ load: { ...draft.load, loadCount: event.target.value } }); }} />
              </FieldBox>
              <FieldBox label="Payload per truck (t)" error={currentErrors["load.tonnesPerLoad"]} hint={`A standard side tipper carries ${STANDARD_LOAD_TONNES} t.`}>
                <input inputMode="decimal" value={draft.load.tonnesPerLoad} onChange={(event) => update({ load: { ...draft.load, tonnesPerLoad: event.target.value } })} />
              </FieldBox>
              <FieldBox label="Moisture (%)" error={currentErrors["load.moisturePercent"]} hint="Optional. As sampled at loading.">
                <input inputMode="decimal" value={draft.load.moisturePercent} onChange={(event) => update({ load: { ...draft.load, moisturePercent: event.target.value } })} />
              </FieldBox>
              <div className={`dp-capacity ${tonnes > 0 && capacity < tonnes ? "is-short" : ""}`} role="status">
                <span>Truck capacity</span>
                <strong>{formatTonnes(capacity)}</strong>
                <small>{tonnes > 0 ? (capacity >= tonnes ? `Covers the ${formatTonnes(tonnes)} planned` : `${formatTonnes(tonnes - capacity)} short of the plan`) : "Enter the planned quantity"}</small>
              </div>
            </div>
          </Section>

          <Section id={sectionIds.transport} index={5} title="Transport" description="Who carries the load and in which vehicles. Vehicles can be added later, before dispatch." icon={Truck}>
            <div className="form-grid">
              <FieldBox label="Transport provider" hint="Approved providers from Mining Operations.">
                <Select value={draft.logistics.transporterId} onChange={(event) => update({ logistics: { ...draft.logistics, transporterId: event.target.value } })}><option value="">Not assigned yet</option>{data.transporters.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (not active)"}</option>)}</Select>
              </FieldBox>
              <label className="dp-check"><input type="checkbox" checked={draft.logistics.trackingRequired} onChange={(event) => update({ logistics: { ...draft.logistics, trackingRequired: event.target.checked } })} /><span><strong>Live tracking required</strong><small>Vehicles must send positions so the delivery shows on the live map.</small></span></label>
            </div>
            <VehicleList vehicles={draft.logistics.vehicles} errors={currentErrors} max={Number(draft.load.loadCount) || 0} onChange={(vehicles) => update({ logistics: { ...draft.logistics, vehicles } })} />
            {currentErrors.vehicles ? <p className="field-error" role="alert">{currentErrors.vehicles}</p> : null}
          </Section>

          <Section id={sectionIds.documents} index={6} title="Documents and compliance" description="What must travel with the load and be returned as evidence." icon={FileCheck2}>
            <fieldset className="dp-docs">
              <legend>Required documents</legend>
              {Object.entries(requiredDocumentLabels).map(([key, label]) => {
                const on = draft.compliance.documents.includes(key as RequiredDocument);
                return <label key={key} className={`dm-chip ${on ? "is-on" : ""}`}><input type="checkbox" checked={on} onChange={() => update({ compliance: { ...draft.compliance, documents: on ? draft.compliance.documents.filter((item) => item !== key) : [...draft.compliance.documents, key as RequiredDocument] } })} />{label}</label>;
              })}
            </fieldset>
            <div className="form-grid">
              <label className="dp-check"><input type="checkbox" checked={draft.compliance.hazardous} onChange={(event) => update({ compliance: { ...draft.compliance, hazardous: event.target.checked } })} /><span><strong>Dangerous goods</strong><small>Needs placards, a trained driver and the transport documents for dangerous goods.</small></span></label>
              <FieldBox label="Special instructions" wide>
                <textarea rows={3} value={draft.compliance.specialInstructions} onChange={(event) => update({ compliance: { ...draft.compliance, specialInstructions: event.target.value } })} />
              </FieldBox>
            </div>
          </Section>
        </div>

        <aside className="dp-aside" aria-label="Route summary">
          <section className="card dp-route-card">
            <header className="dp-route-card__head">
              <h2><Route aria-hidden="true" /> Route</h2>
              {picking ? <span className="dp-picking" role="status"><Crosshair aria-hidden="true" /> Click the map to place {picking === "collection" ? "A" : "B"}<button type="button" className="icon-button icon-button--light" aria-label="Stop placing" onClick={() => setPicking(null)}><X /></button></span> : null}
            </header>
            <div className="dp-map-wrap">
              <LocationMap collection={draft.collection.location?.position ?? null} delivery={draft.receiving.location?.position ?? null} route={route?.points ?? null} picking={picking} onPick={(key, position) => void placeAt(key, position, "map_pin")} onMove={(key, position) => void placeAt(key, position, "map_pin")} />
            </div>
            <ol className="dp-stops">
              <li><span className="lp-dot lp-dot--collection">A</span><div><strong>{draft.collection.location?.name ?? "Collection point not set"}</strong><small>{draft.collection.location ? formatCoordinates(draft.collection.location.position) : "Search, choose a saved site or drop a pin"}</small></div></li>
              <li><span className="lp-dot lp-dot--delivery">B</span><div><strong>{draft.receiving.location?.name ?? "Delivery point not set"}</strong><small>{draft.receiving.location ? formatCoordinates(draft.receiving.location.position) : "Search, choose a saved site or drop a pin"}</small></div></li>
            </ol>
            <dl className="dp-route-facts" aria-live="polite">
              <div><dt>Distance</dt><dd>{routing ? "Working out…" : route ? formatKm(route.km) : "—"}</dd></div>
              <div><dt>Driving time</dt><dd>{routing ? "…" : route ? formatDuration(route.minutes) : "—"}</dd></div>
              <div><dt>Departs</dt><dd>{draft.collection.windowFrom || "—"}</dd></div>
              <div><dt>Arrives about</dt><dd>{arrives !== null ? timeOf(arrives) : "—"}</dd></div>
            </dl>
            {route ? <p className={`dp-route-source dp-route-source--${route.source}`}><Info aria-hidden="true" /> {routeSourceLabels[route.source]}{route.source === "estimated" ? ". Distance and time are approximate until a road route is available." : "."}</p> : null}
            {arrivalNote ? <p className="dp-route-warning" role="status"><CircleAlert aria-hidden="true" /> {arrivalNote}</p> : null}
            {route ? <button type="button" className="button button--quiet dp-recalc" onClick={() => void recalculate(draft.collection.location?.position ?? null, draft.receiving.location?.position ?? null)} disabled={routing}><RotateCcw aria-hidden="true" /> Recalculate route</button> : null}
          </section>

          <section className="card dp-summary">
            <h2>Summary</h2>
            <dl>
              <div><dt>Customer</dt><dd>{client?.name ?? "—"}</dd></div>
              <div><dt>Quantity</dt><dd>{tonnes ? formatTonnes(tonnes) : "—"}{agreement ? ` of ${agreement.commodity}` : ""}</dd></div>
              <div><dt>Truckloads</dt><dd>{draft.load.loadCount || "—"} × {draft.load.tonnesPerLoad ? formatTonnes(Number(draft.load.tonnesPerLoad)) : "—"}</dd></div>
              <div><dt>Vehicles assigned</dt><dd>{draft.logistics.vehicles.length} of {draft.load.loadCount || "—"}</dd></div>
              <div><dt>Scheduled</dt><dd>{draft.scheduledDate}</dd></div>
            </dl>
            <p className="muted trade-small">Locations come from {locationService.provider === "google" ? "Google Maps, saved sites, pins and coordinates" : "VESPER's place list, saved sites, pins and coordinates"}.</p>
            <div className="dp-actions">
              <Link className="button button--quiet" href={editing ? `/trade/deliveries/${delivery.id}` : "/trade/deliveries"}><ArrowLeft aria-hidden="true" /> Cancel</Link>
              <button type="button" className="button button--primary" onClick={submit} disabled={save.isPending || routing}><Busy pending={save.isPending} label="Saving…">{editing ? "Save changes" : "Plan delivery"}</Busy></button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ---- Parts ---------------------------------------------------------------------------------------------------------------

function Section({ id, index, title, description, icon: Icon, tone, children }: { id: string; index: number; title: string; description: string; icon: typeof MapPin; tone?: PointKey; children: React.ReactNode }) {
  return (
    <section id={id} className={`card dp-section ${tone ? `dp-section--${tone}` : ""}`} aria-labelledby={`${id}-title`}>
      <header className="dp-section__head">
        <span className="dp-section__index" aria-hidden="true">{index}</span>
        <div>
          <h2 id={`${id}-title`}><Icon aria-hidden="true" /> {title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="dp-section__body">{children}</div>
    </section>
  );
}

/** A label, control, hint and error (the shared Field without the wrapping label, so composite controls work too). */
function FieldBox({ label, error, hint, wide, children }: { label: string; error?: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`form-field ${wide ? "form-field--wide" : ""} ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && !error ? <small className="field-hint">{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function SiteFields({ prefix, site, errors, label, onChange }: { prefix: "collection" | "receiving"; site: SiteDraft; errors: Errors; label: string; onChange: (change: Partial<SiteDraft>) => void }) {
  return (
    <div className="form-grid">
      <FieldBox label="Site contact" error={errors[`${prefix}.contactName`]}><input value={site.contactName} autoComplete="off" onChange={(event) => onChange({ contactName: event.target.value })} /></FieldBox>
      <FieldBox label="Contact phone" error={errors[`${prefix}.contactPhone`]}><input type="tel" inputMode="tel" value={site.contactPhone} placeholder="+27 …" onChange={(event) => onChange({ contactPhone: event.target.value })} /></FieldBox>
      <FieldBox label="Contact email" error={errors[`${prefix}.contactEmail`]} hint="Optional."><input type="email" value={site.contactEmail} onChange={(event) => onChange({ contactEmail: event.target.value })} /></FieldBox>
      <div className="dp-window">
        <FieldBox label={`${label} from`}><input type="time" value={site.windowFrom} onChange={(event) => onChange({ windowFrom: event.target.value })} /></FieldBox>
        <FieldBox label="to" error={errors[`${prefix}.windowTo`]}><input type="time" value={site.windowTo} onChange={(event) => onChange({ windowTo: event.target.value })} /></FieldBox>
      </div>
      <FieldBox label={prefix === "collection" ? "Loading instructions" : "Access and offloading instructions"} wide hint={prefix === "collection" ? "Gate, weighbridge, loading bay." : "Entrance, booking-in, where to tip, height limits."}>
        <textarea rows={2} value={site.instructions} onChange={(event) => onChange({ instructions: event.target.value })} />
      </FieldBox>
    </div>
  );
}

function LocationField({ pointKey, label, value, saved, picking, onPicking, onChange, onRename, error, save, onSave, clientName }: {
  pointKey: PointKey;
  label: string;
  value: DeliveryLocation | null;
  saved: TradeView["locations"];
  picking: boolean;
  onPicking: (on: boolean) => void;
  onChange: (location: DeliveryLocation | null) => void;
  onRename: (name: string) => void;
  error?: string;
  save: boolean;
  onSave: (on: boolean) => void;
  clientName?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [searching, setSearching] = useState(false);
  const [coordinates, setCoordinates] = useState("");
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [mode, setMode] = useState<"search" | "coordinates">("search");
  const letter = pointKey === "collection" ? "A" : "B";

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const found = await locationService.search(text, saved);
      if (cancelled) return;
      setResults(found);
      setHighlight(0);
      setOpen(true);
      setSearching(false);
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, saved]);

  const pick = async (suggestion: PlaceSuggestion) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    try {
      onChange(await locationService.resolve(suggestion));
    } catch {
      setCoordinateError("That place could not be opened. Try another result, a saved site or a pin on the map.");
    }
  };
  const applyCoordinates = async () => {
    const position = parseCoordinates(coordinates);
    if (!position) return setCoordinateError("Enter latitude and longitude in decimal degrees, for example -26.53000, 29.20000.");
    setCoordinateError(null);
    setCoordinates("");
    onChange(await locationService.describe(position, "coordinates"));
  };
  const savedOptions = saved.map((item) => ({ value: item.id, label: `${item.name}${item.clientName ? ` · ${item.clientName}` : ""}` }));

  return (
    <div className={`lp-field ${error ? "has-error" : ""}`}>
      {value ? (
        <div className={`lp-chosen lp-chosen--${pointKey}`}>
          <span className={`lp-dot lp-dot--${pointKey}`} aria-hidden="true">{letter}</span>
          <div className="lp-chosen__body">
            <label className="lp-chosen__name"><span className="sr-only">{label} name</span><input value={value.name} onChange={(event) => onRename(event.target.value)} /></label>
            {value.address ? <small>{value.address}</small> : null}
            <small className="lp-chosen__meta"><span>{formatCoordinates(value.position)}</span><span className="lp-source">{locationSourceLabels[value.source]}</span></small>
          </div>
          <div className="lp-chosen__actions">
            <button type="button" className={`button button--quiet ${picking ? "is-active" : ""}`} aria-pressed={picking} onClick={() => onPicking(!picking)}><Crosshair aria-hidden="true" /> {picking ? "Click the map" : "Adjust on map"}</button>
            <button type="button" className="icon-button icon-button--light" aria-label={`Clear the ${label.toLowerCase()}`} onClick={() => onChange(null)}><Trash2 /></button>
          </div>
        </div>
      ) : null}

      <div className="lp-find">
        <div className="lp-tabs" role="group" aria-label={`How to set the ${label.toLowerCase()}`}>
          <button type="button" className={mode === "search" ? "is-on" : ""} aria-pressed={mode === "search"} onClick={() => setMode("search")}><Search aria-hidden="true" /> Search</button>
          <button type="button" className={mode === "coordinates" ? "is-on" : ""} aria-pressed={mode === "coordinates"} onClick={() => setMode("coordinates")}><MapPin aria-hidden="true" /> Coordinates</button>
          <button type="button" className={picking ? "is-on" : ""} aria-pressed={picking} onClick={() => onPicking(!picking)}><Crosshair aria-hidden="true" /> {picking ? "Placing on the map…" : "Drop a pin"}</button>
        </div>

        {mode === "search" ? (
          <div className="lp-search">
            <Search aria-hidden="true" />
            <input
              role="combobox"
              aria-label={`Search for the ${label.toLowerCase()}`}
              aria-expanded={open && query.trim().length >= 2}
              aria-controls={`${id}-results`}
              aria-autocomplete="list"
              aria-activedescendant={open && results[highlight] ? `${id}-option-${highlight}` : undefined}
              placeholder={value ? `Replace with another place, site or address` : `Search a site, address or town${clientName ? ` (e.g. ${clientName})` : ""}`}
              value={query}
              onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim().length < 2) { setResults([]); setOpen(false); } }}
              onFocus={() => results.length && setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setHighlight((index) => Math.min(results.length - 1, index + 1)); }
                if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((index) => Math.max(0, index - 1)); }
                if (event.key === "Enter" && open && results[highlight]) { event.preventDefault(); void pick(results[highlight]); }
                if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
              }}
            />
            {searching ? <span className="lp-search__busy" aria-hidden="true" /> : null}
            {open && query.trim().length >= 2 ? (
              <ul className="lp-results" id={`${id}-results`} role="listbox" aria-label="Places found">
                {results.length ? results.map((item, index) => (
                  <li key={`${item.provider}-${item.id}`} id={`${id}-option-${index}`} role="option" aria-selected={index === highlight} className={index === highlight ? "is-active" : ""} onMouseDown={(event) => { event.preventDefault(); void pick(item); }} onMouseEnter={() => setHighlight(index)}>
                    {item.location?.source === "saved" ? <Bookmark aria-hidden="true" /> : <MapPin aria-hidden="true" />}
                    <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </li>
                )) : <li className="lp-results__empty" role="option" aria-selected={false} aria-disabled="true">{searching ? "Searching…" : "No place found. Drop a pin on the map or enter coordinates."}</li>}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="lp-coordinates">
            <input aria-label={`${label} coordinates`} placeholder="Latitude, longitude  e.g. -26.53000, 29.20000" value={coordinates} onChange={(event) => setCoordinates(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyCoordinates(); } }} />
            <button type="button" className="button button--quiet" onClick={() => void applyCoordinates()}>Use coordinates</button>
          </div>
        )}
        {coordinateError ? <small className="field-error" role="alert">{coordinateError}</small> : null}

        {savedOptions.length ? (
          <label className="lp-saved">
            <span><Bookmark aria-hidden="true" /> Saved {pointKey === "collection" ? "collection points" : "delivery points"}</span>
            <Select value={value?.savedLocationId ?? ""} onChange={(event) => {
              const pickedSaved = saved.find((item) => item.id === event.target.value);
              if (pickedSaved) onChange({ name: pickedSaved.name, address: pickedSaved.address, position: pickedSaved.position, source: "saved", placeId: pickedSaved.placeId, savedLocationId: pickedSaved.id });
            }}>
              <option value="">Choose a saved site</option>
              {savedOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </label>
        ) : null}
      </div>

      {value && !value.savedLocationId ? <label className="dp-check dp-check--inline"><input type="checkbox" checked={save} onChange={(event) => onSave(event.target.checked)} /><span><strong>Save this point for future deliveries</strong></span></label> : null}
      {error ? <small className="field-error" role="alert">{error}</small> : null}
    </div>
  );
}

function VehicleList({ vehicles, errors, max, onChange }: { vehicles: DeliveryVehicle[]; errors: Errors; max: number; onChange: (vehicles: DeliveryVehicle[]) => void }) {
  const change = (index: number, patch: Partial<DeliveryVehicle>) => onChange(vehicles.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  return (
    <div className="dp-vehicles">
      <div className="dp-vehicles__head">
        <h3>Vehicles <small className="muted">{vehicles.length} of {max || "—"} loads</small></h3>
        <button type="button" className="button button--quiet" disabled={max > 0 && vehicles.length >= max} onClick={() => onChange([...vehicles, { registration: "", driverName: "", driverPhone: "", trackingUnit: "" }])}><Plus aria-hidden="true" /> Add vehicle</button>
      </div>
      {vehicles.length === 0 ? <p className="muted trade-small">No vehicles yet. The transport provider can confirm them before dispatch.</p> : (
        <ol className="dp-vehicle-rows">
          {vehicles.map((vehicle, index) => (
            <li key={index}>
              <span className="dp-vehicle-index" aria-hidden="true">{index + 1}</span>
              <FieldBox label="Registration" error={errors[`vehicle.${index}.registration`]}><input value={vehicle.registration} autoCapitalize="characters" onChange={(event) => change(index, { registration: event.target.value.toUpperCase() })} /></FieldBox>
              <FieldBox label="Driver"><input value={vehicle.driverName} onChange={(event) => change(index, { driverName: event.target.value })} /></FieldBox>
              <FieldBox label="Driver phone" error={errors[`vehicle.${index}.driverPhone`]}><input type="tel" value={vehicle.driverPhone} onChange={(event) => change(index, { driverPhone: event.target.value })} /></FieldBox>
              <FieldBox label="Tracking unit" hint={vehicle.trackingUnit ? undefined : "Blank: no tracking"}><input value={vehicle.trackingUnit} onChange={(event) => change(index, { trackingUnit: event.target.value })} /></FieldBox>
              <button type="button" className="icon-button icon-button--light" aria-label={`Remove vehicle ${index + 1}`} onClick={() => onChange(vehicles.filter((_, position) => position !== index))}><Trash2 /></button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
