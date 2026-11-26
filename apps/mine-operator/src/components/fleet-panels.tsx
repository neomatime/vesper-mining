"use client";

/**
 * "Transport handled by": the choice between a logistics provider and the mine's own fleet, and the own-fleet section of a shipment:
 * who is responsible, the loads (vehicle, driver, quantity, planned times), vehicle availability and maintenance, an optional
 * internal cost estimate, breakdowns linked to loads, and the coordinator's schedule confirmation.
 *
 * Vehicles come from the equipment register and drivers from the people already in VESPER. Assigning a vehicle does not mark the
 * shipment ready, dispatched or delivered: those stay their own steps. Fictional data; nothing is sent to anyone.
 */
import type { Shipment } from "@vesper/api-contracts";
import { AlertTriangle, CheckCircle2, Info, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { assignedTonnes, transportModeLabels, type FleetVehicle } from "@/lib/fleet-rules";
import { formatMoney, formatTonnes } from "@/lib/shipment-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useLogisticsAction, useSubmissionId, type Logistics } from "./use-logistics";
import { Busy } from "./busy";

/** Two buttons, one choice. Used on the create form (controlled) and on the shipment page (it asks the server to switch). */
export function TransportModeChoice({ value, onChange, disabled = false }: { value: "provider" | "own_fleet"; onChange: (mode: "provider" | "own_fleet") => void; disabled?: boolean }) {
  return (
    <div className="segmented" role="group" aria-label="Transport handled by">
      {(["own_fleet", "provider"] as const).map((mode) => (
        <button key={mode} type="button" className={value === mode ? "active" : ""} aria-pressed={value === mode} disabled={disabled} onClick={() => onChange(mode)}>
          {mode === "own_fleet" ? <Truck size={15} aria-hidden="true" /> : null} {transportModeLabels[mode]}
        </button>
      ))}
    </div>
  );
}

/** On a shipment that is still being prepared: switch who handles the transport. A priced shipment asks why. */
export function TransportModeSwitch({ shipment, disabled }: { shipment: Shipment; disabled: boolean }) {
  const [asking, setAsking] = useState<"provider" | "own_fleet" | null>(null);
  const [reason, setReason] = useState("");
  const change = useLogisticsAction<{ mode: string; reason?: string; version: number }, Shipment>({
    path: `/shipments/${shipment.id}/transport-mode`,
    success: (item) => ({ title: item.transportMode === "own_fleet" ? "Our fleet will move this shipment" : "A logistics provider will move this shipment" }),
    onDone: () => { setAsking(null); setReason(""); },
  });
  const pick = (mode: "provider" | "own_fleet") => (mode === shipment.transportMode ? undefined : shipment.pricingSource ? setAsking(mode) : change.mutate({ mode, version: shipment.version }));
  return (
    <>
      <TransportModeChoice value={shipment.transportMode} onChange={pick} disabled={disabled || change.isPending} />
      {asking ? (
        <Dialog title="Change who handles the transport?" description={`This shipment is priced from ${shipment.pricingSource?.label}. That pricing source is removed and kept in the history.`} onClose={() => setAsking(null)} locked={change.isPending}
          footer={<><button className="button button--quiet" onClick={() => setAsking(null)} disabled={change.isPending}>Cancel</button><button className="button button--primary" disabled={change.isPending || reason.trim().length < 5} onClick={() => change.mutate({ mode: asking, reason, version: shipment.version })}><Busy pending={change.isPending} label="Saving…">Change</Busy></button></>}>
          <Field label="Why? (required)"><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        </Dialog>
      ) : null}
    </>
  );
}

const vehicleTone = (vehicle: FleetVehicle) => (!vehicle.assignable ? (vehicle.state === "unavailable" ? "blocked" : "at_risk") : vehicle.maintenance === "due_soon" ? "at_risk" : "on_plan");
const vehicleWord = (vehicle: FleetVehicle) => (vehicle.state === "unavailable" ? "Unavailable" : vehicle.maintenance === "overdue" ? "Service overdue" : vehicle.maintenance === "due_soon" ? "Service due soon" : "Available");

/** The own-fleet part of a shipment page. */
export function FleetSection({ data, shipment, canManage, problems }: { data: Logistics; shipment: Shipment; canManage: boolean; problems: string[] }) {
  const [adding, setAdding] = useState(false);
  const fleet = data.fleet;
  const editable = canManage && ["preparing", "waiting", "confirmed"].includes(shipment.state);
  const alerts = fleet.alerts[shipment.id] ?? [];
  const left = Math.round((shipment.tonnes - assignedTonnes(shipment)) * 100) / 100;
  const request = data.requests.find((item) => item.id === shipment.requestId);
  const [coordinator, setCoordinator] = useState(shipment.fleet.coordinator ?? "");
  const [cost, setCost] = useState(shipment.fleet.internalCost && fleet.canSeeCost ? String(shipment.fleet.internalCost.amount) : "");
  const [costNote, setCostNote] = useState(shipment.fleet.internalCost && fleet.canSeeCost ? shipment.fleet.internalCost.note : "");
  const savePlan = useLogisticsAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}/fleet`, method: "PATCH", success: () => ({ title: "Saved" }) });
  const remove = useLogisticsAction<{ loadId: string; reason?: string; version: number }, Shipment>({
    path: (input) => `/shipments/${shipment.id}/fleet-loads/${input.loadId}/remove`,
    success: () => ({ title: "Load removed", detail: "If the schedule was already confirmed, it needs confirming again." }),
  });
  const confirm = useLogisticsAction<{ version: number }, Shipment>({ path: `/shipments/${shipment.id}/fleet-confirm`, success: () => ({ title: "Schedule confirmed", detail: "Dispatch is still recorded when the material leaves the mine." }) });
  const vehicleOf = (id: string) => fleet.vehicles.find((item) => item.id === id);

  return (
    <section className="task-section" aria-label="Our fleet">
      <h2>Our fleet</h2>
      <div className="fact-row">
        <div className="fact"><span>Responsible for the transport</span><strong>{shipment.fleet.coordinator ?? "Not chosen yet"}</strong></div>
        <div className="fact"><span>Loads</span><strong>{shipment.fleet.loads.length === 0 ? "None assigned" : `${shipment.fleet.loads.length} · ${formatTonnes(assignedTonnes(shipment))} of ${formatTonnes(shipment.tonnes)}`}</strong></div>
        <div className="fact"><span>Transport pricing</span><strong>Our own vehicles: no quote or agreement needed</strong></div>
      </div>

      {editable && (shipment.state === "preparing") ? (
        <div className="task-grid task-grid--two">
          <Field label="Responsible for the transport">
            <Select value={coordinator} onChange={(event) => { setCoordinator(event.target.value); savePlan.mutate({ coordinator: event.target.value, version: shipment.version }); }}>
              <option value="">Choose a person</option>
              {fleet.coordinators.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
        </div>
      ) : null}

      {alerts.map((alert) => (
        <div className="note-bar note-bar--warn" role="alert" key={alert.loadId}>
          <AlertTriangle /> <span><strong>{alert.reason}</strong> Responsible: {alert.responsible}. Next: {alert.nextAction}{alert.issueId ? <> <Link className="row-link-text" href={`/exceptions/${alert.issueId}`}>Open {alert.issueNumber}</Link></> : <> <Link className="row-link-text" href="/exceptions/new">Report the breakdown</Link></>}</span>
        </div>
      ))}

      {shipment.fleet.loads.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Vehicle</th><th scope="col">Driver</th><th scope="col" className="number-cell">Load</th><th scope="col">Collect</th><th scope="col">Deliver</th><th scope="col">Vehicle status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {shipment.fleet.loads.map((load) => {
                const vehicle = vehicleOf(load.vehicleId);
                return (
                  <tr key={load.id}>
                    <td data-label="Vehicle"><span className="cell-main"><strong>{vehicle?.code ?? "Vehicle"}</strong><small>{vehicle?.name}</small></span></td>
                    <td data-label="Driver">{load.driverName}</td>
                    <td data-label="Load" className="number-cell">{formatTonnes(load.tonnes)}</td>
                    <td data-label="Collect">{formatDemoDateTime(load.plannedCollectionAt)}</td>
                    <td data-label="Deliver">{formatDemoDateTime(load.plannedDeliveryAt)}</td>
                    <td data-label="Vehicle status">{vehicle ? <span className="cell-main"><StatusBadge value={vehicleTone(vehicle)} label={vehicleWord(vehicle)} /><small>{vehicle.maintenanceLabel}</small></span> : "—"}</td>
                    <td data-label="Actions">{editable ? <button className="link-button" disabled={remove.isPending} onClick={() => remove.mutate({ loadId: load.id, version: shipment.version })}>Remove</button> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">No vehicle or driver assigned yet.</p>}

      {editable && left > 0 ? <div className="button-row button-row--end"><button className="button button--quiet" onClick={() => setAdding(true)}><Plus /> Assign vehicle and driver</button></div> : null}
      {editable && left > 0 ? <p className="field-hint">{formatTonnes(left)} is not on a load yet.</p> : null}

      {shipment.state === "preparing" && problems.length > 0 && shipment.fleet.loads.length > 0 ? <div className="note-bar" role="status"><Info /> <span>{problems[0]}</span></div> : null}
      <div className="note-bar"><Info /> <span>Assigning a vehicle does not make the shipment ready, dispatched or delivered. Readiness checks, dispatch and delivery are still recorded one by one.</span></div>

      {fleet.canSeeCost ? (
        <div className="task-grid task-grid--two">
          <Field label="Estimated internal transport cost (R)" hint={shipment.fleet.internalCost ? "An internal estimate, kept apart from sales value. It is not an invoice." : "Cost not yet assessed. Optional."}>
            <input inputMode="decimal" value={cost} disabled={!editable} onChange={(event) => setCost(event.target.value)} onBlur={() => { if (editable && cost !== (shipment.fleet.internalCost ? String(shipment.fleet.internalCost.amount) : "")) savePlan.mutate({ internalCostAmount: cost, internalCostNote: costNote, version: shipment.version }); }} />
          </Field>
          <Field label="What the estimate covers"><input value={costNote} disabled={!editable} placeholder="Fuel, driver time, tyre wear" onChange={(event) => setCostNote(event.target.value)} onBlur={() => { if (editable && cost && costNote !== (shipment.fleet.internalCost?.note ?? "")) savePlan.mutate({ internalCostAmount: cost, internalCostNote: costNote, version: shipment.version }); }} /></Field>
        </div>
      ) : null}
      {fleet.canSeeCost && shipment.fleet.internalCost ? <p className="muted">Estimated internal cost: {formatMoney(shipment.fleet.internalCost.amount)}</p> : null}

      {shipment.state === "waiting" && request ? (
        <div className="note-bar"><Info /> <span><strong>Waiting for {shipment.fleet.coordinator} to confirm the schedule.</strong> A plan is not a booking until it is confirmed.</span></div>
      ) : null}
      {shipment.state === "waiting" && canManage ? (
        <div className="button-row button-row--end"><button className="button button--primary" disabled={confirm.isPending || alerts.length > 0} onClick={() => confirm.mutate({ version: shipment.version })}><CheckCircle2 /> <Busy pending={confirm.isPending} label="Confirming…">Confirm schedule</Busy></button></div>
      ) : null}
      {adding ? <AssignDialog data={data} shipment={shipment} left={left} onClose={() => setAdding(false)} /> : null}
    </section>
  );
}

function AssignDialog({ data, shipment, left, onClose }: { data: Logistics; shipment: Shipment; left: number; onClose: () => void }) {
  const vehicles = data.fleet.vehicles;
  const first = vehicles.find((item) => item.assignable)?.id ?? "";
  const [vehicleId, setVehicleId] = useState(first);
  const [driverName, setDriverName] = useState("");
  const [tonnes, setTonnes] = useState(String(left));
  const day = shipment.preferredDate;
  const [collect, setCollect] = useState(`${day}T08:00`);
  const [deliver, setDeliver] = useState(`${day}T14:00`);
  const submission = useSubmissionId();
  const add = useLogisticsAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}/fleet-loads`, success: () => ({ title: "Load assigned", detail: "The shipment is not ready or dispatched until those steps are recorded." }), onDone: onClose });
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  return (
    <Dialog title="Assign vehicle and driver" description={`${shipment.number} · ${formatTonnes(left)} still to assign`} size="wide" onClose={onClose} locked={add.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={add.isPending}>Cancel</button><button className="button button--primary" disabled={add.isPending || !vehicle?.assignable || !driverName || !(Number(tonnes) > 0)} onClick={() => add.mutate({ vehicleId, driverName, tonnes: Number(tonnes), plannedCollectionAt: collect, plannedDeliveryAt: deliver, submissionId: submission.id, version: shipment.version })}><Busy pending={add.isPending} label="Assigning…">Assign</Busy></button></>}>
      <div className="task-grid task-grid--two">
        <Field label="Vehicle" hint="From the equipment register.">
          <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">Choose a vehicle</option>
            {vehicles.map((item) => <option key={item.id} value={item.id} disabled={!item.assignable}>{item.code} · {item.name}{item.assignable ? "" : ` (${vehicleWord(item).toLowerCase()})`}</option>)}
          </Select>
        </Field>
        <Field label="Driver"><Select value={driverName} onChange={(event) => setDriverName(event.target.value)}><option value="">Choose a driver</option>{data.fleet.drivers.map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field>
        <Field label="Load (t)"><input inputMode="decimal" value={tonnes} onChange={(event) => setTonnes(event.target.value)} /></Field>
        <div />
        <Field label="Planned collection"><input type="datetime-local" value={collect} onChange={(event) => setCollect(event.target.value)} /></Field>
        <Field label="Planned delivery"><input type="datetime-local" value={deliver} onChange={(event) => setDeliver(event.target.value)} /></Field>
      </div>
      {vehicle ? <p className="muted">{vehicle.code}: {vehicleWord(vehicle)}. {vehicle.maintenanceLabel}.{vehicle.reason ? ` It cannot take a load: ${vehicle.reason}.` : ""}</p> : null}
    </Dialog>
  );
}
