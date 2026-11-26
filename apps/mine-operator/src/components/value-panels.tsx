"use client";

/**
 * Financial visibility on shipments (demonstration scope): the value shown beside a shipment, the compact Value section on its page,
 * and the dialog where an authorised commercial or finance user supplies a price.
 *
 * Four amounts are shown separately and never added together: the sales value (an estimate from a price per tonne), transport cost,
 * accounting revenue and cash received. The last three come from finance records. Everything here is hidden from roles that may not
 * see money: for them the server sends no price, value or finance record at all, so `data.commercial` is null.
 */
import type { Shipment } from "@vesper/api-contracts";
import { AlertTriangle, Info, Tag } from "lucide-react";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import {
  CURRENCY,
  PRICE_BASIS,
  QUANTITY_BASIS,
  currentPrice,
  delayReason,
  formatMoney,
  formatTonnes,
  paymentLabels,
  shipmentValue,
  valueStatusLabels,
  valueTone,
  type ShipmentValue,
} from "@/lib/shipment-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { StatusBadge } from "./status-badge";
import { useLogisticsAction, useSubmissionId, type Logistics } from "./use-logistics";
import { Busy } from "./busy";

/** Everything a screen needs to show values, worked out from one set of records so every page shows the same figure. */
export function shipmentValuesOf(data: Logistics) {
  const commercial = data.commercial;
  const requestOf = (shipment: Shipment) => data.requests.find((item) => item.id === shipment.requestId) ?? null;
  const financeOf = (shipment: Shipment) => commercial?.finance?.find((item) => item.shipmentId === shipment.id) ?? null;
  const valueOf = (shipment: Shipment): ShipmentValue | null =>
    commercial ? shipmentValue(shipment, currentPrice(commercial.prices, shipment.orderRef), financeOf(shipment)) : null;
  return { visible: commercial !== null, commercial, valueOf, requestOf, financeOf };
}

/** The value in a table: the amount with how firm it is beneath, or the plain words when there is none. */
export function ValueCell({ value }: { value: ShipmentValue | null }) {
  if (!value) return null;
  if (value.status === "not_applicable") return <span className="muted">Internal transfer</span>;
  if (value.amount === null) return <span className="cell-main"><strong>Not priced</strong><small>No price supplied yet</small></span>;
  return <span className="cell-main"><strong>{formatMoney(value.amount)}</strong><small>{valueStatusLabels[value.status]}</small></span>;
}

const reasonLabels = { created: "Created", priced: "Price supplied", price_changed: "Price changed", dispatched: "Dispatched", finance_final: "Settled by finance" } as const;

/** The compact Value section on a shipment: its value, how it was worked out, what finance holds, and how it has changed. */
export function ValueSection({ data, shipment }: { data: Logistics; shipment: Shipment }) {
  const values = shipmentValuesOf(data);
  const [pricing, setPricing] = useState(false);
  const value = values.valueOf(shipment);
  if (!value || !values.commercial) return null;
  const finance = values.financeOf(shipment);
  const history = values.commercial.history.filter((item) => item.shipmentId === shipment.id);
  const late = delayReason(shipment, values.requestOf(shipment), data.now);
  const finances = values.commercial.finance !== null;
  const canSetPrice = values.commercial.canSetPrices && shipment.kind === "sale" && shipment.state !== "cancelled" && finance?.finalValue == null;

  return (
    <section className="task-section" aria-labelledby="value-heading">
      <h2 id="value-heading"><Tag aria-hidden="true" /> Value</h2>
      {shipment.kind === "internal_transfer" ? (
        <div className="note-bar"><Info /> <span>This is an internal transfer, so it has no sales value.</span></div>
      ) : (
        <>
          <div className="fact-row">
            <div className="fact"><span>Estimated sales value</span><strong>{value.amount === null ? "Not priced" : formatMoney(value.amount)}</strong></div>
            <StatusBadge value={valueTone[value.status]} label={valueStatusLabels[value.status]} />
            <div className="fact"><span>Quantity</span><strong>{formatTonnes(value.quantity)}</strong><small>{QUANTITY_BASIS}</small></div>
            <div className="fact"><span>Price</span><strong>{value.price ? `${formatMoney(value.price.pricePerTonne)} per tonne` : "No price yet"}</strong><small>{value.price ? `${value.price.currency} · ${value.price.priceBasis}` : `${CURRENCY} · ${PRICE_BASIS}`}</small></div>
            <div className="fact"><span>Customer order</span><strong>{shipment.orderRef}</strong><small>{value.price?.customer ?? "Customer not recorded"}</small></div>
          </div>
          <p className="field-hint">
            {value.price ? <>Source: {value.price.source}. Supplied by {value.price.suppliedBy}, updated {formatDemoDateTime(value.price.updatedAt)}.</> : value.reason}
            {" "}A sales value is an estimate from a price per tonne. It is not revenue and not cash.
          </p>
          {value.status === "not_priced" && value.reason && value.price ? <div className="note-bar note-bar--warn"><AlertTriangle /> <span>{value.reason}</span></div> : null}
          {late && value.amount !== null ? <div className="note-bar note-bar--warn" role="status"><AlertTriangle /> <span><strong>Late:</strong> {late}. {formatMoney(value.amount)} is the value of this shipment, not a loss. It is only at stake if the sale does not go ahead.</span></div> : null}
          {canSetPrice ? <div className="button-row"><button className="button button--quiet button--small" onClick={() => setPricing(true)}>{value.price ? "Change price" : "Set price"}</button></div> : null}
        </>
      )}

      {finances && shipment.kind === "sale" ? (
        <div className="fact-row" aria-label="Finance records">
          <div className="fact"><span>Transport cost</span><strong>{finance?.transportCost != null ? formatMoney(finance.transportCost) : "Not provided"}</strong></div>
          <div className="fact"><span>Accounting revenue</span><strong>{finance?.revenueRecognised != null ? formatMoney(finance.revenueRecognised) : "Not recognised yet"}</strong>{finance?.invoiceNumber ? <small>{finance.invoiceNumber}</small> : null}</div>
          <div className="fact"><span>Cash received</span><strong>{finance ? formatMoney(finance.cashReceived) : "Not available"}</strong>{finance ? <small>{paymentLabels[finance.paymentStatus]}</small> : null}</div>
          <div className="fact"><span>Finance record</span><strong>{finance ? finance.source : "None yet"}</strong>{finance ? <small>Updated {formatDemoDateTime(finance.updatedAt)}</small> : null}</div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <details>
          <summary>Value history · original estimate {history[0].amount === null ? "not priced" : formatMoney(history[0].amount)}</summary>
          <ul className="timeline-list" style={{ marginTop: 12 }}>
            {[...history].reverse().map((item, index, all) => (
              <li key={item.id}>
                <strong>{item.amount === null ? "Not priced" : formatMoney(item.amount)} · {valueStatusLabels[item.status]}{index === all.length - 1 ? " · Original estimate" : ""}</strong>
                <small>{reasonLabels[item.reason]} · {formatDemoDateTime(item.at)} · {item.actor}{item.pricePerTonne !== null ? ` · ${formatTonnes(item.quantityTonnes)} at ${formatMoney(item.pricePerTonne)} per tonne` : ` · ${formatTonnes(item.quantityTonnes)}`}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {pricing ? <SetPriceDialog shipment={shipment} current={value.price?.pricePerTonne ?? null} onClose={() => setPricing(false)} /> : null}
    </section>
  );
}

/** Supplies or changes the price for a customer order. Only the Commercial / Finance Officer sees the button, and the server checks too. */
function SetPriceDialog({ shipment, current, onClose }: { shipment: Shipment; current: number | null; onClose: () => void }) {
  const [price, setPrice] = useState(current ? String(current) : "");
  const [source, setSource] = useState("");
  const submission = useSubmissionId();
  const save = useLogisticsAction<Record<string, unknown>, { pricePerTonne: number; version: number }>({
    path: "/prices",
    success: (record) => ({ title: record.version > 1 ? "Price changed" : "Price supplied", detail: `${shipment.orderRef} is now ${formatMoney(record.pricePerTonne)} per tonne. The earlier price and value are kept in the history.` }),
    onDone: () => onClose(),
  });
  const value = Number(price);
  const ready = Number.isFinite(value) && value > 0 && source.trim().length >= 3;
  return (
    <Dialog
      title={current ? "Change the price" : "Set the price"}
      description={`${shipment.orderRef}. ${CURRENCY}, ${PRICE_BASIS.toLowerCase()}, on ${QUANTITY_BASIS.toLowerCase()}.`}
      size="narrow"
      onClose={onClose}
      locked={save.isPending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || !ready} onClick={() => save.mutate({ submissionId: submission.id, reference: shipment.orderRef, pricePerTonne: value, source })}><Busy pending={save.isPending} label="Saving…">Save price</Busy></button></>}
    >
      <div className="dialog__stack">
        <Field label={`Price per tonne (${CURRENCY})`}><input type="number" inputMode="decimal" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} /></Field>
        <Field label="Source of the price" hint="For example the contract and price list."><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Contract CT-2025-014, price list 3" /></Field>
        <div className="note-bar"><Info /> <span>The old price is kept. Open shipments on this order get a new line in their value history, and their original estimate stays.</span></div>
      </div>
    </Dialog>
  );
}
