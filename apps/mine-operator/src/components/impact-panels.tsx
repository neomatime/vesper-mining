"use client";

/**
 * "What happens if we wait?": the Gold demonstration's consequence, shown where each person already works. The full section goes on
 * the equipment issue; short cards on the equipment, shift, readiness and shipment pages show the part of it each one cares about.
 * All of them read the one shared calculation (see lib/impact-rules.ts), so a change made anywhere shows everywhere.
 *
 * Labels are careful on purpose: a forecast is not verified production, and the money figure is an "estimated sales value
 * potentially delayed", not a loss, a cost or a profit. Safety is shown on its own line and never weighed against value.
 */
import { AlertTriangle, ArrowRight, Info, Lock, Pickaxe, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { GOLD, UNASSESSED, formatGrams, formatHours, outageScenarios } from "@/lib/impact-rules";
import { formatMoney, formatTonnes } from "@/lib/shipment-rules";
import { ConfirmDialog, Dialog } from "./dialog";
import { Field } from "./form-field";
import { ErrorState, LoadingState } from "./query-state";
import { StatusBadge } from "./status-badge";
import { useImpact, useImpactAction, type ImpactView } from "./use-impact";

export const GOLD_LABEL = "Gold demonstration · simulated data";

const when = (iso: string | null) => (iso ? formatDemoDateTime(iso) : "Not set");
const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text));

/** The one sentence that leads: the consequence, in plain words. */
export function consequenceText(view: ImpactView): string {
  const { result, scenario } = view;
  if (!result.assessed) return `${UNASSESSED}. We still need ${result.missing.join(" and ")}.`;
  const deadline = when(scenario.deliveryDeadline);
  if (result.remainingShortfallGrams === 0) return `On current figures the ${formatGrams(scenario.commitmentGrams)} gold delivery to ${scenario.customer} (due ${deadline}) is not expected to be short.`;
  const money = view.canSeeValue && result.valueDelayed !== null ? ` Estimated sales value potentially delayed: ${formatMoney(result.valueDelayed)}.` : "";
  return `Up to ${formatGrams(result.remainingShortfallGrams ?? 0)} of the ${formatGrams(scenario.commitmentGrams)} gold delivery to ${scenario.customer} (due ${deadline}) may be short.${money}`;
}

// ---- The full section, on the equipment issue ----------------------------------------------------------------------------------

export function WaitSection({ issueId }: { issueId: string }) {
  const query = useImpact();
  const [dialog, setDialog] = useState<"estimate" | "repair" | "recovery" | "reset" | null>(null);
  const scenarioSwitch = useImpactAction<{ outageHours: number; reason: string }>("/impact/estimate", (view) => ({ title: "Scenario changed", detail: `Outage of ${view.scenario.outageHours} hours. The forecast is updated everywhere.` }));
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const view = query.data;
  if (!view.scenario.linkedIssueIds.includes(issueId)) return null;
  const { scenario, result } = view;
  const done = scenario.repairCompletedAt !== null;
  const others = scenario.linkedIssueIds.length - 1;

  return (
    <section className="card detail-card impact" aria-labelledby="wait-heading">
      <header className="card__header">
        <div><span className="eyebrow"><Pickaxe size={14} aria-hidden="true" /> {GOLD_LABEL}</span><h2 id="wait-heading">What happens if we wait?</h2></div>
      </header>

      <div className={`note-bar ${result.assessed && (result.remainingShortfallGrams ?? 0) > 0 ? "note-bar--warn" : result.assessed ? "note-bar--good" : ""}`} role="status">
        {result.assessed ? <AlertTriangle /> : <Info />} <span><strong>{consequenceText(view)}</strong></span>
      </div>

      <div className="fact-row">
        <div className="fact"><span>Affects</span><strong>Gold delivery {scenario.shipmentNumber} · {scenario.shiftName} production target</strong></div>
        <div className="fact"><span>Delivery deadline</span><strong>{when(scenario.deliveryDeadline)}</strong></div>
        <div className="fact"><span>Stock keeps processing running for</span><strong>{result.assessed && result.stockCoverHours !== null ? formatHours(result.stockCoverHours) : "Not assessed"}</strong>{result.assessed ? <small>{formatTonnes(scenario.usableStockTonnes ?? 0)} usable{scenario.catchUpTonnes ? ` + ${formatTonnes(scenario.catchUpTonnes)} approved catch-up` : ""}</small> : null}</div>
        <div className="fact"><span>{done ? "Repair completed" : "Expected repair completion"}</span><strong>{when(view.expectedRepairCompletion)}</strong><small>{done ? `Actual outage ${formatHours(scenario.actualOutageHours ?? 0)}, recorded` : scenario.outageHours === null ? "No estimate yet" : `${formatHours(scenario.outageHours)} after the breakdown at ${when(scenario.breakdownStartedAt)}`}</small></div>
      </div>

      <div className="fact-row" aria-label="Target and forecast">
        <div className="fact"><span>Original target</span><strong>{formatGrams(scenario.commitmentGrams)}</strong></div>
        <div className="fact"><span>Current forecast</span><strong>{result.forecastGrams === null ? UNASSESSED : formatGrams(result.forecastGrams)}</strong><small>A forecast, not verified production</small></div>
        <div className="fact"><span>Possible shortfall</span><strong>{result.remainingShortfallGrams === null ? UNASSESSED : formatGrams(result.remainingShortfallGrams)}</strong>{done && (result.goldAffectedGrams ?? 0) > 0 ? <small>{formatGrams(scenario.recoveredGrams)} recovered of {formatGrams(result.goldAffectedGrams ?? 0)}</small> : null}</div>
        {view.canSeeValue ? <div className="fact"><span>Estimated sales value potentially delayed</span><strong>{result.valueDelayed === null ? UNASSESSED : formatMoney(result.valueDelayed)}</strong><small>Of {formatMoney(view.plannedValue ?? 0)} planned. An estimate, not a loss.</small></div> : null}
      </div>

      <div className="fact-row" aria-label="Who and what is needed">
        <div className="fact"><span>Responsible</span><strong>{scenario.responsible}</strong></div>
        <div className="fact"><span>Next action</span><strong>{view.repair ? view.repair.title : "Verify the repair"}</strong>{view.repair?.dueAt ? <small>Due {when(view.repair.dueAt)}</small> : null}</div>
        <div className="fact"><span>Spare part</span><strong>{view.part ? `${view.part.name} · ${view.part.required} needed` : "None recorded"}</strong>{view.part ? <small>{view.part.onHand === null ? "Not confirmed at the mine" : `${view.part.onHand} on hand`} · {view.part.inbound ?? 0} on its way (reported)</small> : null}</div>
        <div className="fact"><span>Estimate last updated</span><strong>{when(scenario.updatedAt)}</strong><small>by {scenario.updatedBy}</small></div>
      </div>

      <div className="note-bar"><ShieldCheck /> <span><strong>Safety and environment:</strong> {scenario.safetyNote}</span></div>
      <p className="field-hint">
        This is a forecast from simulated inputs. It does not change verified stock, the customer commitment ({formatGrams(scenario.commitmentGrams)}) or any readiness check, and it does not approve a partial shipment.
        {others > 0 ? ` ${others} other ${others === 1 ? "issue also affects" : "issues also affect"} this delivery. The same output is counted once.` : ""}
      </p>

      <div className="button-row" style={{ justifyContent: "flex-start" }}>
        <Link className="button button--quiet" href="/shipments/gold">View affected shipment <ArrowRight size={16} /></Link>
        {view.can.update ? <button className="button button--primary" onClick={() => setDialog(done ? "recovery" : "estimate")} disabled={done && (result.remainingShortfallGrams ?? 0) === 0}>{done ? "Record recovery" : "Update repair estimate"}</button> : null}
        <Link className="button button--quiet" href={`/exceptions/${view.issue?.id ?? issueId}#actions`}>Open repair task</Link>
      </div>

      {view.can.update ? (
        <div className="task-section" aria-label="Demonstration controls">
          <h2 style={{ fontSize: 17 }}>Try it: scenario controls</h2>
          <div className="segmented" role="group" aria-label="Outage scenario">
            {outageScenarios.map((hours) => (
              <button key={hours} type="button" className={scenario.outageHours === hours ? "active" : ""} aria-pressed={scenario.outageHours === hours} disabled={done || scenarioSwitch.isPending} onClick={() => scenarioSwitch.mutate({ outageHours: hours, reason: `Scenario: a ${hours} hour outage.` })}>{hours} hour outage</button>
            ))}
          </div>
          <div className="button-row" style={{ justifyContent: "flex-start" }}>
            <button className="button button--quiet button--small" onClick={() => setDialog("estimate")}>Adjust stock or catch-up</button>
            {!done ? <button className="button button--quiet button--small" onClick={() => setDialog("repair")}>Record repair complete</button> : null}
            <button className="button button--quiet button--small" onClick={() => setDialog("reset")}><RotateCcw size={14} /> Reset demonstration</button>
          </div>
          <small className="field-hint">Switching scenario changes the demonstration inputs only. It is not a recorded outage, and verified inventory is not touched.</small>
        </div>
      ) : (
        <div className="note-bar"><Lock /> <span>Only the Maintenance Planner, a Shift Supervisor or the Mine Manager can change the estimate.</span></div>
      )}

      <details>
        <summary>How this was calculated</summary>
        <Calculation view={view} />
      </details>
      <details>
        <summary>History of the estimate · {view.history.length} {view.history.length === 1 ? "change" : "changes"}</summary>
        <History view={view} />
      </details>

      {dialog === "estimate" ? <EstimateDialog view={view} onClose={() => setDialog(null)} /> : null}
      {dialog === "repair" ? <RepairDialog view={view} onClose={() => setDialog(null)} /> : null}
      {dialog === "recovery" ? <RecoveryDialog view={view} onClose={() => setDialog(null)} /> : null}
      {dialog === "reset" ? <ResetDialog onClose={() => setDialog(null)} /> : null}
    </section>
  );
}

/** The workings, with the numbers. Calculations and assumptions live here so the section above can stay short. */
function Calculation({ view }: { view: ImpactView }) {
  const { scenario, result } = view;
  if (!result.assessed) return <p className="field-hint">{UNASSESSED}. We still need {result.missing.join(" and ")} before anything can be worked out.</p>;
  const hours = scenario.outageHours ?? 0;
  return (
    <div className="dialog__stack">
      <ol className="timeline-list" style={{ marginTop: 12 }}>
        <li><strong>Ore shortfall = {formatTonnes(result.oreShortfallTonnes ?? 0)}</strong><small>The most that can be processed in the outage ({GOLD.plannedRateTph} t/hour × {hours} hours = {formatTonnes(GOLD.plannedRateTph * hours)}) less usable stock ({formatTonnes(scenario.usableStockTonnes ?? 0)}) and approved catch-up ({formatTonnes(scenario.catchUpTonnes ?? 0)}), never below zero.</small></li>
        <li><strong>Gold affected = {formatGrams(result.goldAffectedGrams ?? 0)}</strong><small>{formatTonnes(result.oreShortfallTonnes ?? 0)} × {GOLD.gradeGramsPerTonne} g/tonne × {GOLD.recovery * 100}% recovery, and never more than the {formatGrams(scenario.commitmentGrams)} still required for this delivery.</small></li>
        <li><strong>Forecast = {formatGrams(result.forecastGrams ?? 0)}</strong><small>{formatGrams(GOLD.baselineForecastGrams)} expected before the breakdown, less the {formatGrams(result.remainingShortfallGrams ?? 0)} still short{scenario.recoveredGrams > 0 ? ` (${formatGrams(scenario.recoveredGrams)} recovered so far)` : ""}, never below zero.</small></li>
        {view.canSeeValue ? <li><strong>Estimated sales value potentially delayed = {formatMoney(result.valueDelayed ?? 0)}</strong><small>{formatGrams(result.remainingShortfallGrams ?? 0)} × R{GOLD.pricePerGram.toLocaleString("en-GB")} per gram (illustrative price). The planned value of the commitment is {formatMoney(view.plannedValue ?? 0)} and does not change.</small></li> : null}
      </ol>
      <p className="field-hint">Assumptions, all fictional: the recovered gold is fully payable and would otherwise be ready within the delivery window. Additional costs, profit and confirmed losses are separate and are not estimated here. Quantities are in grams of gold and tonnes of ore, and the price is per gram, so they are never mixed with the manganese shipments (tonnes).</p>
    </div>
  );
}

function History({ view }: { view: ImpactView }) {
  if (view.history.length === 0) return <p className="field-hint">No changes yet. The estimate is as it started.</p>;
  const cell = (item: ImpactView["history"][number]["previous"]) => (item.forecastGrams === null ? UNASSESSED : `${formatGrams(item.forecastGrams)} forecast${item.valueDelayed !== null ? ` · ${formatMoney(item.valueDelayed)}` : ""}`);
  const kinds = { estimate: "Estimate changed", repair_complete: "Repair complete", recovery: "Recovery recorded", reset: "Reset" } as const;
  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table className="data-table">
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Previous</th><th scope="col">Revised</th><th scope="col">Reason</th></tr></thead>
        <tbody>
          {[...view.history].reverse().map((entry) => (
            <tr key={entry.id}>
              <td data-label="When">{when(entry.at)}</td><td data-label="Who">{entry.actor}</td><td data-label="What">{kinds[entry.kind]}</td>
              <td data-label="Previous">{entry.previous.outageHours === null ? "No estimate" : `${entry.previous.outageHours} h`} · {cell(entry.previous)}</td>
              <td data-label="Revised">{entry.revised.outageHours === null ? "No estimate" : `${entry.revised.outageHours} h`} · {cell(entry.revised)}</td>
              <td data-label="Reason">{entry.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Dialogs ---------------------------------------------------------------------------------------------------------------

function EstimateDialog({ view, onClose }: { view: ImpactView; onClose: () => void }) {
  const done = view.scenario.repairCompletedAt !== null;
  const [hours, setHours] = useState(view.scenario.outageHours === null ? "" : String(view.scenario.outageHours));
  const [stock, setStock] = useState(view.scenario.usableStockTonnes === null ? "" : String(view.scenario.usableStockTonnes));
  const [catchUp, setCatchUp] = useState(view.scenario.catchUpTonnes === null ? "" : String(view.scenario.catchUpTonnes));
  const [reason, setReason] = useState("");
  const save = useImpactAction<Record<string, unknown>>("/impact/estimate", (next) => ({ title: "Estimate updated", detail: next.result.assessed ? `Forecast now ${formatGrams(next.result.forecastGrams ?? 0)}. Everything on screen is updated.` : `${UNASSESSED}.` }), onClose);
  return (
    <Dialog
      title="Update repair estimate"
      description="Change what the forecast is based on. The previous estimate stays in the history."
      size="narrow"
      onClose={onClose}
      locked={save.isPending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || reason.trim().length < 5} onClick={() => save.mutate({ ...(done ? {} : { outageHours: numberOrNull(hours) }), usableStockTonnes: numberOrNull(stock), catchUpTonnes: numberOrNull(catchUp), reason })}>{save.isPending ? "Saving…" : "Save estimate"}</button></>}
    >
      <div className="dialog__stack">
        {!done ? <Field label="Total outage (hours from the breakdown)" hint="Leave empty if it is not known. The impact then shows as not assessed."><input type="number" min="0" step="any" value={hours} onChange={(event) => setHours(event.target.value)} /></Field> : <p className="field-hint">The repair is complete, so the outage is the recorded actual.</p>}
        <Field label="Usable stock downstream (tonnes)" hint="Crushed ore that can keep processing running. Leave empty if it is not known."><input type="number" min="0" step="any" value={stock} onChange={(event) => setStock(event.target.value)} /></Field>
        <Field label="Approved catch-up (tonnes)" hint="Extra processing before the deadline that has been approved. Empty means none."><input type="number" min="0" step="any" value={catchUp} onChange={(event) => setCatchUp(event.target.value)} /></Field>
        <Field label="Why are you changing it?" hint="At least five characters."><input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function RepairDialog({ view, onClose }: { view: ImpactView; onClose: () => void }) {
  const [hours, setHours] = useState(view.scenario.outageHours === null ? "" : String(view.scenario.outageHours));
  const [note, setNote] = useState("");
  const save = useImpactAction<Record<string, unknown>>("/impact/repair-complete", (next) => ({ title: "Repair recorded as complete", detail: `Actual outage ${formatHours(next.scenario.actualOutageHours ?? 0)} is kept. Any shortfall stays until a recovery is recorded.` }), onClose);
  return (
    <Dialog
      title="Record repair complete"
      description="The actual outage is kept and the forecast is recalculated from it. It does not recover any lost output."
      size="narrow"
      onClose={onClose}
      locked={save.isPending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || !(Number(hours) > 0)} onClick={() => save.mutate({ actualOutageHours: Number(hours), note })}>{save.isPending ? "Saving…" : "Record repair complete"}</button></>}
    >
      <div className="dialog__stack">
        <Field label="Actual outage (hours, from the breakdown to the repair)"><input type="number" min="0" step="any" value={hours} onChange={(event) => setHours(event.target.value)} /></Field>
        <Field label="Note (optional)"><input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="note-bar"><Info /> <span>This records that the repair is done. It is not independent verification, and the crusher and issue stay marked as reported until someone else checks.</span></div>
      </div>
    </Dialog>
  );
}

function RecoveryDialog({ view, onClose }: { view: ImpactView; onClose: () => void }) {
  const remaining = view.result.remainingShortfallGrams ?? 0;
  const [grams, setGrams] = useState("");
  const [note, setNote] = useState("");
  const save = useImpactAction<Record<string, unknown>>("/impact/recovery", (next) => ({ title: "Recovery recorded", detail: `${formatGrams(next.result.remainingShortfallGrams ?? 0)} is still short. This is recorded progress, not verified stock.` }), onClose);
  return (
    <Dialog
      title="Record recovery"
      description={`${formatGrams(remaining)} is still short. A shortfall is only recovered by recorded production progress or an approved recovery plan.`}
      size="narrow"
      onClose={onClose}
      locked={save.isPending}
      footer={<><button className="button button--quiet" type="button" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || !(Number(grams) > 0) || note.trim().length < 5} onClick={() => save.mutate({ grams: Number(grams), note })}>{save.isPending ? "Saving…" : "Record recovery"}</button></>}
    >
      <div className="dialog__stack">
        <Field label="Gold recovered (grams)"><input type="number" min="0" step="any" value={grams} onChange={(event) => setGrams(event.target.value)} /></Field>
        <Field label="Production record or approved plan" hint="For example the production record or the plan that was approved."><input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const save = useImpactAction<Record<string, never>>("/impact/reset", () => ({ title: "Demonstration reset", detail: "The crusher is stopped again, with the four hour estimate." }), onClose);
  return <ConfirmDialog title="Reset the Gold demonstration?" body="The crusher goes back to stopped, the estimate goes back to four hours and the history is cleared. Other records are not touched." confirmLabel="Reset demonstration" pending={save.isPending} onConfirm={() => save.mutate({})} onClose={onClose} />;
}

// ---- Short cards for the other pages ---------------------------------------------------------------------------------------

type Focus = "equipment" | "shift" | "readiness" | "shipment";

/** A short version for the page it sits on: the same figures, trimmed to what that page's reader needs, linking to the full section. */
export function ImpactCard({ focus, id }: { focus: Focus; id?: string }) {
  const query = useImpact();
  if (!query.data) return null;
  const view = query.data;
  const { scenario, result } = view;
  const matches = focus === "equipment" ? id === scenario.equipmentId : focus === "shift" ? id === undefined || id === scenario.shiftId : focus === "readiness" ? id === scenario.activityId : true;
  if (!matches) return null;
  const href = `/exceptions/${scenario.issueId}`;

  return (
    <article className="card detail-card impact impact--short" aria-label="Gold demonstration: effect">
      <header className="card__header"><div><span className="eyebrow"><Pickaxe size={14} aria-hidden="true" /> {GOLD_LABEL}</span><h2>{focus === "shift" ? "Effect on the production target" : focus === "readiness" ? "Repair resources" : focus === "equipment" ? "What this breakdown affects" : "Original commitment and forecast"}</h2></div></header>
      {focus === "shift" ? (
        <>
          <div className="fact-row">
            <div className="fact"><span>Gold target for the delivery</span><strong>{formatGrams(scenario.commitmentGrams)}</strong></div>
            <div className="fact"><span>Current forecast</span><strong>{result.forecastGrams === null ? UNASSESSED : formatGrams(result.forecastGrams)}</strong></div>
            <div className="fact"><span>Possible shortfall</span><strong>{result.remainingShortfallGrams === null ? UNASSESSED : formatGrams(result.remainingShortfallGrams)}</strong></div>
          </div>
          <p className="field-hint">Caused by {view.equipment?.name}. A forecast, not verified production.</p>
        </>
      ) : null}
      {focus === "readiness" ? (
        <div className="fact-row">
          <div className="fact"><span>Required part</span><strong>{view.part ? `${view.part.name} · ${view.part.required} needed` : "None"}</strong><small>{view.part ? `${view.part.onHand === null ? "Not confirmed at the mine" : `${view.part.onHand} on hand`} · ${view.part.inbound ?? 0} on its way` : ""}</small></div>
          <div className="fact"><span>Repair crew</span><strong>{scenario.responsible}</strong><small>Mobilised, waiting for the part</small></div>
          <div className="fact"><span>Repair expected</span><strong>{when(view.expectedRepairCompletion)}</strong></div>
          <div className="fact"><span>Stock keeps processing for</span><strong>{result.stockCoverHours === null ? UNASSESSED : formatHours(result.stockCoverHours)}</strong></div>
        </div>
      ) : null}
      {focus === "equipment" ? (
        <>
          <p>{consequenceText(view)}</p>
          <div className="fact-row"><div className="fact"><span>Responsible</span><strong>{scenario.responsible}</strong></div><div className="fact"><span>Repair expected</span><strong>{when(view.expectedRepairCompletion)}</strong></div></div>
        </>
      ) : null}
      {focus === "shipment" ? (
        <>
          <div className="fact-row">
            <div className="fact"><span>Original commitment</span><strong>{formatGrams(scenario.commitmentGrams)}</strong>{view.canSeeValue ? <small>{formatMoney(view.plannedValue ?? 0)} planned</small> : null}</div>
            <div className="fact"><span>Current forecast</span><strong>{result.forecastGrams === null ? UNASSESSED : formatGrams(result.forecastGrams)}</strong></div>
            <div className="fact"><span>Linked production blocker</span><strong>{view.equipment?.code} · {view.issue?.title}</strong></div>
          </div>
          <div className="note-bar"><Info /> <span>The commitment has not changed and no partial shipment is approved. A better forecast does not verify gold or allow dispatch.</span></div>
        </>
      ) : null}
      <Link className="row-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} href={href}>See what happens if we wait <ArrowRight size={14} /></Link>
    </article>
  );
}

/** The Gold delivery as one line on the Shipments pages, with where to open it. */
export function GoldDeliveryCard() {
  const query = useImpact();
  if (!query.data) return null;
  const view = query.data;
  const { scenario, result } = view;
  return (
    <article className="card detail-card impact impact--short" aria-label="Gold delivery">
      <header className="card__header"><div><span className="eyebrow"><Pickaxe size={14} aria-hidden="true" /> {GOLD_LABEL}</span><h2>{scenario.shipmentNumber} · Gold delivery to {scenario.customer}</h2></div><StatusBadge value={(result.remainingShortfallGrams ?? 0) > 0 || !result.assessed ? "at_risk" : "on_plan"} label={!result.assessed ? UNASSESSED : (result.remainingShortfallGrams ?? 0) > 0 ? "At risk" : "On plan"} /></header>
      <div className="fact-row">
        <div className="fact"><span>Original commitment</span><strong>{formatGrams(scenario.commitmentGrams)}</strong></div>
        <div className="fact"><span>Current forecast</span><strong>{result.forecastGrams === null ? UNASSESSED : formatGrams(result.forecastGrams)}</strong></div>
        {view.canSeeValue ? <div className="fact"><span>Estimated sales value potentially delayed</span><strong>{result.valueDelayed === null ? UNASSESSED : formatMoney(result.valueDelayed)}</strong></div> : null}
        <div className="fact"><span>Blocker</span><strong>{view.equipment?.code} breakdown</strong></div>
        <div className="fact"><span>Responsible</span><strong>{scenario.responsible}</strong></div>
        <Link className="button button--quiet button--small" href="/shipments/gold">View shipment</Link>
      </div>
    </article>
  );
}

/** The Gold delivery's own page: the commitment, the forecast and what links them. */
export function GoldShipmentScreen() {
  const query = useImpact();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const view = query.data;
  const { scenario, result } = view;
  return (
    <div className="task-page">
      <Link href="/shipments/list" className="back-link">← Back to Shipments</Link>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow"><Pickaxe size={15} aria-hidden="true" /> {GOLD_LABEL}</div>
          <h1>{scenario.shipmentNumber}</h1>
          <p>Gold delivery to {scenario.customer}, order {scenario.orderRef}. Due {when(scenario.deliveryDeadline)}.</p>
        </div>
      </header>
      <section className="card task-card" aria-label="Gold shipment">
        <div className="fact-row">
          <div className="fact"><span>Original commitment</span><strong>{formatGrams(scenario.commitmentGrams)}</strong><small>Unchanged by any forecast</small></div>
          <div className="fact"><span>Current forecast</span><strong>{result.forecastGrams === null ? UNASSESSED : formatGrams(result.forecastGrams)}</strong><small>Not verified production</small></div>
          <div className="fact"><span>Possible shortfall</span><strong>{result.remainingShortfallGrams === null ? UNASSESSED : formatGrams(result.remainingShortfallGrams)}</strong></div>
          {view.canSeeValue ? <div className="fact"><span>Planned sales value</span><strong>{formatMoney(view.plannedValue ?? 0)}</strong><small>{formatGrams(scenario.commitmentGrams)} at R{GOLD.pricePerGram.toLocaleString("en-GB")} per gram (illustrative)</small></div> : null}
          {view.canSeeValue ? <div className="fact"><span>Estimated sales value potentially delayed</span><strong>{result.valueDelayed === null ? UNASSESSED : formatMoney(result.valueDelayed)}</strong><small>An estimate, not a loss</small></div> : null}
        </div>
        <div className="fact-row">
          <div className="fact"><span>Linked production blocker</span><strong>{view.equipment?.code} · {view.equipment?.name}</strong><small>{view.equipment?.state === "unavailable" ? "Out of service" : "Reported available"}</small></div>
          <div className="fact"><span>Responsible</span><strong>{scenario.responsible}</strong></div>
          <div className="fact"><span>Next action</span><strong>{view.repair?.title ?? "Verify the repair"}</strong></div>
        </div>
        <div className="note-bar"><Info /> <span><strong>Readiness checks are unchanged.</strong> Gold must still be checked and weighed before dispatch. A forecast does not verify gold, and a partial shipment would need its own approval.</span></div>
        <div className="button-row" style={{ justifyContent: "flex-start" }}>
          <Link className="button button--primary" href={`/exceptions/${scenario.issueId}`}>See what happens if we wait</Link>
          <Link className="button button--quiet" href={`/exceptions/${scenario.issueId}#actions`}>Open repair task</Link>
        </div>
        <p className="field-hint">Sales value is an estimate from an illustrative price per gram. Additional costs, profit and confirmed losses are separate and are not shown. Grams and rand per gram are never mixed with the manganese shipments, which are in tonnes.</p>
      </section>
    </div>
  );
}
