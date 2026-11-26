"use client";

/**
 * Ongoing transport agreements: the list, one agreement with its allowance, fees and history, the form to record or edit one, and the
 * "Transport pricing" section on a shipment where an agreement can be used as its price.
 *
 * Five things are shown separately on purpose, because they are easy to confuse: the agreement dates, the pricing method, the period
 * the fee or rate covers, how often the provider bills, and the period the included quantity is measured over. An agreement does not
 * book a truck: collection confirmation, readiness, dispatch, delivery, invoicing and payment stay their own steps on the shipment.
 * Fictional April 2026 demonstration data; nothing is sent to a provider.
 */
import type { Shipment } from "@vesper/api-contracts";
import { ArrowLeft, Check, FileText, Info, Lock, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTransportBase } from "./use-transport-base";
import { formatDemoDateTime } from "@/lib/demo-clock";
import { formatTonnes, shortDate } from "@/lib/shipment-rules";
import {
  agreementPricingMethods,
  agreementStatus,
  agreementStatusWords,
  agreementTone,
  allocatedCost,
  allowanceFor,
  allowancePeriodWords,
  billingWords,
  chargeAmount,
  chargePeriods,
  durationLabel,
  eligibleAgreements,
  feeEquivalents,
  formatRand,
  monthsCovered,
  periodName,
  periodWords,
  rangeLabel,
  rolloverWords,
  vatWords,
  type Agreement,
  type AgreementPricingMethod,
  type Attachment,
  type Billing,
  type FeePeriod,
} from "@/lib/transport-rules";
import { Dialog } from "./dialog";
import { Field } from "./form-field";
import { PageHeader } from "./page-header";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useLogistics, useSubmissionId } from "./use-logistics";
import { DemoPeriodNote, ProviderTabs, providerName } from "./transport-screens";
import { useTransport, useTransportAction, type Transport } from "./use-transport";
import { RegisterView, type Register } from "./workspace-screen";

const number = (value: number) => new Intl.NumberFormat("en-GB").format(value);

function LockedTerms() {
  return <div className="note-bar"><Lock /> <span>Quotes, rates and agreement terms are commercial information. They are shown to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller.</span></div>;
}

/** "R1,000,000 / month", "R120 / t", or the manual estimate, clearly labelled. Never invented: a missing fee says so. */
export function priceOf(agreement: Agreement): string {
  if (agreement.method === "manual_estimate" && agreement.manualEstimate) return `About ${formatRand(agreement.manualEstimate.amount)} / ${periodWords[agreement.manualEstimate.period]} (manual estimate)`;
  if (agreement.fee === null) return "Price not recorded";
  if (agreement.method === "unit_rate") return `${formatRand(agreement.fee)} / t`;
  return `${formatRand(agreement.fee)} / ${periodWords[agreement.feePeriod]}`;
}

function WithTransport({ children }: { children: (data: Transport) => React.ReactNode }) {
  const query = useTransport();
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

// ---- List ---------------------------------------------------------------------------------------------------------------

export function AgreementsScreen() {
  return <WithTransport>{(data) => (data.terms ? <AgreementsView data={data} agreements={data.terms.agreements} /> : <div className="workspace-page"><PageHeader eyebrow="Shipments · Logistics" title="Transport agreements" description="Ongoing agreements with transport providers." icon={Truck} /><ProviderTabs active="agreements" /><LockedTerms /></div>)}</WithTransport>;
}

function AgreementsView({ data, agreements }: { data: Transport; agreements: Agreement[] }) {
  const base = useTransportBase();
  const logistics = useLogistics();
  const shipments = logistics.data?.shipments ?? [];
  const status = (item: Agreement) => agreementStatus(item, data.today);
  const register: Register<Agreement> = {
    icon: Truck,
    tiles: [
      { label: "Active", value: agreements.filter((item) => status(item) === "active").length, hint: "In force today" },
      { label: "Draft", value: agreements.filter((item) => status(item) === "draft").length, hint: "Terms still to be reviewed", attention: agreements.some((item) => status(item) === "draft") },
      { label: "Upcoming", value: agreements.filter((item) => status(item) === "upcoming").length, hint: "Confirmed, not started" },
      { label: "Expired or ended", value: agreements.filter((item) => ["expired", "ended"].includes(status(item))).length, hint: "Kept with their history" },
    ],
    columns: [
      { key: "number", label: "Agreement", render: (item) => <span className="cell-main"><strong>{item.number}</strong><small>{providerName(data, item.providerId)}</small></span> },
      { key: "covers", label: "Covers", render: (item) => <span className="cell-main"><strong>{item.material}</strong><small>{item.from} to {item.to}</small></span> },
      { key: "dates", label: "Dates", render: (item) => <span className="cell-main"><strong>{rangeLabel(item.startDate, item.endDate)}</strong><small>{durationLabel(item.startDate, item.endDate)}</small></span> },
      { key: "price", label: "Price", render: (item) => <span className="cell-main"><strong>{priceOf(item)}</strong><small>Billed {billingWords[item.billing].toLowerCase()}</small></span> },
      { key: "available", label: `Available in ${periodName(data.period)}`, render: (item) => { if (item.includedTonnes === null) return <span className="muted">No allowance</span>; const usage = allowanceFor(item, data.period, shipments, data.terms?.earlier ?? []); return `${number(usage.available ?? 0)} t of ${number(usage.included ?? 0)} t`; } },
      { key: "status", label: "Status", render: (item) => <StatusBadge value={agreementTone[status(item)]} label={agreementStatusWords[status(item)]} /> },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "active", label: "Active", test: (item) => status(item) === "active" },
      { key: "draft", label: "Draft", test: (item) => status(item) === "draft" },
      { key: "ended", label: "Expired or ended", test: (item) => ["expired", "ended"].includes(status(item)) },
    ],
    href: (item) => `${base}/agreements/${item.id}`,
    text: (item) => [item.number, item.reference, item.material, item.to, providerName(data, item.providerId)].join(" "),
    rows: agreements,
    action: data.can.record ? { label: "New agreement", href: `${base}/agreements/new`, plus: true } : undefined,
    emptyTitle: "No agreements yet",
    emptyBody: "Record an agreement from its document, or from an accepted proposal.",
    footnote: `Demo period: ${periodName(data.period)}. Allowances are measured by confirmed delivered tonnes plus planned tonnes. An agreement does not confirm a booking.`,
  };
  return <RegisterView initialFilter={null} header={{ eyebrow: "Shipments · Logistics", title: "Transport agreements", description: "Ongoing agreements, what they allow and what has been used." }} register={register} tabs={<ProviderTabs active="agreements" />} />;
}

// ---- One agreement -------------------------------------------------------------------------------------------------------

export function AgreementScreen({ id }: { id: string }) {
  return <WithTransport>{(data) => (data.terms ? <AgreementView data={data} agreement={data.terms.agreements.find((item) => item.id === id)} /> : <div className="task-page"><ProviderTabs active="agreements" /><LockedTerms /></div>)}</WithTransport>;
}

function AgreementView({ data, agreement }: { data: Transport; agreement: Agreement | undefined }) {
  const base = useTransportBase();
  const logistics = useLogistics();
  const [ending, setEnding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const charge = useTransportAction<{ period: string }, unknown>({ path: `/agreements/${agreement?.id}/charges`, success: (_, input) => ({ title: "Fee recorded", detail: `The fee for ${periodName(input.period)} is recorded once. Shipments are not charged it again.` }) });
  if (!agreement) return <ErrorState message="This agreement could not be found." />;
  const terms = data.terms!;
  const shipments = logistics.data?.shipments ?? [];
  const status = agreementStatus(agreement, data.today);
  const linked = shipments.filter((item) => item.pricingSource?.agreementId === agreement.id);
  const usage = allowanceFor(agreement, data.period, shipments, terms.earlier);
  const recorded = terms.charges.filter((item) => item.agreementId === agreement.id);
  const periods = chargePeriods(agreement);
  const equivalents = agreement.method === "fixed_fee" && agreement.fee !== null ? feeEquivalents(agreement.fee, agreement.feePeriod) : null;
  const monthsToShow = agreement.allowancePeriod === "calendar_month" ? monthsCovered(agreement.startDate, agreement.endDate).filter((month) => month <= data.period) : [];
  const dueNow = periods.filter((period) => period === "all" || (period.slice(0, 4) <= data.period.slice(0, 4) && (period.length === 4 || period <= data.period)));
  const canEdit = data.can.record && status !== "ended" && (status === "draft" || data.can.confirm);

  return (
    <div className="task-page">
      <Link href={`${base}/agreements`} className="back-link"><ArrowLeft /> Back to Transport agreements</Link>
      <PageHeader eyebrow="Transport agreements" title={`${agreement.number} · ${providerName(data, agreement.providerId)}`} description={`${agreement.material}, ${agreement.from} to ${agreement.to}. ${agreement.service}.`} icon={Truck}
        action={<StatusBadge value={agreementTone[status]} label={agreementStatusWords[status]} />} />
      <DemoPeriodNote />

      {status === "draft" ? <div className="note-bar note-bar--warn" role="status"><Info /> <span><strong>Draft.</strong> These terms have not been reviewed yet, so the agreement cannot be applied to a shipment. {data.can.confirm ? "Check them against the document, then confirm." : "The Mine Manager or the Commercial / Finance Officer reviews and activates it."}</span></div> : null}

      <section className="card task-card" aria-label="Terms">
        <h2>Terms</h2>
        <p className="muted">Each of these is kept separate: a longer agreement can still be billed monthly and measured monthly.</p>
        <div className="fact-row">
          <div className="fact"><span>Agreement dates</span><strong>{rangeLabel(agreement.startDate, agreement.endDate)} · {durationLabel(agreement.startDate, agreement.endDate)}</strong></div>
          <div className="fact"><span>Pricing method</span><strong>{agreementPricingMethods[agreement.method]}</strong></div>
          <div className="fact"><span>Fee or rate</span><strong>{priceOf(agreement)}</strong></div>
          <div className="fact"><span>Billing</span><strong>{billingWords[agreement.billing]}</strong></div>
          <div className="fact"><span>Included quantity</span><strong>{agreement.includedTonnes === null ? "None recorded" : `${number(agreement.includedTonnes)} t per ${allowancePeriodWords[agreement.allowancePeriod]}`}</strong></div>
          <div className="fact"><span>Excess charge</span><strong>{agreement.excessRate === null ? "Not recorded" : `${formatRand(agreement.excessRate)} / t`}</strong></div>
        </div>
        {equivalents?.perMonth !== null && equivalents ? <p className="muted">On the same footing: {formatRand(equivalents.perMonth ?? 0)} / month · {formatRand(equivalents.perYear ?? 0)} / year. Plain arithmetic: no discount or advance payment is implied.</p> : null}
        <div className="fact-row">
          <div className="fact"><span>Reference</span><strong>{agreement.reference}</strong></div>
          <div className="fact"><span>Document</span><strong>{agreement.document ? <><FileText size={14} aria-hidden="true" /> {agreement.document.name}</> : "Not attached"}</strong></div>
          <div className="fact"><span>VAT</span><strong>{vatWords[agreement.vat]}</strong></div>
          <div className="fact"><span>Rollover</span><strong>{rolloverWords[agreement.rollover]}</strong></div>
          <div className="fact"><span>Minimum commitment</span><strong>{agreement.minimumCommitment ?? "None recorded"}</strong></div>
          <div className="fact"><span>Renewal</span><strong>{agreement.renewal || "Not recorded"}</strong></div>
        </div>
        {agreement.invoiceTiming || agreement.paymentTerms ? <p><strong>Invoicing:</strong> {agreement.invoiceTiming || "not recorded"} · <strong>Payment terms:</strong> {agreement.paymentTerms || "not recorded"}</p> : null}
        {agreement.included || agreement.excluded ? <p><strong>Included:</strong> {agreement.included || "not recorded"} · <strong>Excluded:</strong> {agreement.excluded || "not recorded"}</p> : null}
        {agreement.manualEstimate ? <div className="note-bar"><Info /> <span><strong>Manual estimate.</strong> {agreement.manualEstimate.note} The full terms are in the document; this figure is only an estimate.</span></div> : null}
        {agreement.confirmedBy ? <p className="muted">Reviewed and confirmed by {agreement.confirmedBy}, {formatDemoDateTime(agreement.confirmedAt!)}.</p> : null}
        {agreement.endedAt ? <div className="note-bar"><Info /> <span><strong>Ended.</strong> {agreement.endReason}</span></div> : null}
        <div className="button-row button-row--end">
          {canEdit ? <Link className="button button--quiet" href={`${base}/agreements/${agreement.id}/edit`}>Edit terms</Link> : null}
          {status === "draft" && data.can.confirm ? <button className="button button--primary" onClick={() => setConfirming(true)}><Check /> Review and confirm</button> : null}
          {status !== "ended" && status !== "draft" && data.can.confirm ? <button className="button button--quiet" onClick={() => setEnding(true)}>End agreement</button> : null}
        </div>
      </section>

      {agreement.includedTonnes !== null ? (
        <section className="card task-card" aria-label="Allowance">
          <h2>Allowance · {periodName(data.period)}</h2>
          <div className="kpi-row">
            <article className="kpi"><span>Included</span><strong>{number(usage.included ?? 0)} t</strong><small>Per {allowancePeriodWords[agreement.allowancePeriod]}</small></article>
            <article className="kpi"><span>Delivered</span><strong>{number(usage.delivered)} t</strong><small>Confirmed received</small></article>
            <article className="kpi"><span>Planned</span><strong>{number(usage.planned)} t</strong><small>Linked shipments not yet delivered</small></article>
            <article className={`kpi ${usage.excess > 0 ? "kpi--attention" : ""}`}><span>{usage.excess > 0 ? "Over the allowance" : "Available for new plans"}</span><strong>{number(usage.excess > 0 ? usage.excess : usage.available ?? 0)} t</strong><small>{usage.excess > 0 ? `Charged at ${agreement.excessRate === null ? "the excess rate (not recorded)" : `${formatRand(agreement.excessRate)} / t`}` : "Included less delivered less planned"}</small></article>
          </div>
          <p className="card__footnote">A shipment is counted once: planned until it is delivered, then delivered. Cancelling an undelivered plan releases its tonnes. {rolloverWords[agreement.rollover]}</p>
          {monthsToShow.length > 1 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th scope="col">Period</th><th scope="col">Included</th><th scope="col">Delivered</th><th scope="col">Planned</th><th scope="col">Left</th></tr></thead>
                <tbody>
                  {[...monthsToShow].reverse().map((month) => { const row = allowanceFor(agreement, month, shipments, terms.earlier); return <tr key={month}><td data-label="Period">{periodName(month)}</td><td data-label="Included">{number(row.included ?? 0)} t</td><td data-label="Delivered">{number(row.delivered)} t</td><td data-label="Planned">{number(row.planned)} t</td><td data-label="Left">{number(row.available ?? 0)} t</td></tr>; })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card task-card" aria-label="Fees">
        <h2>Fees recorded</h2>
        <p className="muted">A fixed fee is recorded once for each charge period. It is not copied onto each shipment.</p>
        {periods.length === 0 || agreement.fee === null ? <p className="muted">There is no fixed fee to record for this agreement.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Charge period</th><th scope="col">Amount</th><th scope="col">Recorded</th></tr></thead>
              <tbody>
                {periods.filter((period) => recorded.some((item) => item.period === period) || dueNow.includes(period)).map((period) => {
                  const done = recorded.find((item) => item.period === period);
                  return (
                    <tr key={period}>
                      <td data-label="Charge period">{period === "all" ? "Whole agreement" : periodName(period)}</td>
                      <td data-label="Amount">{formatRand(done?.amount ?? chargeAmount(agreement) ?? 0)}</td>
                      <td data-label="Recorded">{done ? `${done.recordedBy}, ${formatDemoDateTime(done.recordedAt)}` : status !== "draft" && data.can.confirm ? <button className="link-button" disabled={charge.isPending} onClick={() => charge.mutate({ period })}>Record fee</button> : <span className="muted">Not yet</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card task-card" aria-label="Linked shipments">
        <h2>Shipments using this agreement</h2>
        {linked.length === 0 ? <p className="muted">No shipments use this agreement yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Shipment</th><th scope="col">Material</th><th scope="col">Quantity</th><th scope="col">State</th><th scope="col">Allocated cost estimate</th></tr></thead>
              <tbody>
                {linked.map((item) => { const share = allocatedCost(agreement, item.tonnes); return (
                  <tr key={item.id}><td data-label="Shipment"><Link className="row-link-text" href={`/shipments/${item.id}`}>{item.number}</Link></td><td data-label="Material">{item.mineral}</td><td data-label="Quantity">{formatTonnes(item.tonnes)}</td><td data-label="State">{item.state === "cancelled" ? "Cancelled" : item.state === "delivered" ? "Delivered" : "Planned"}</td><td data-label="Allocated cost estimate">{share.amount === null ? <span className="muted">Not worked out</span> : <span className="cell-main"><strong>{formatRand(share.amount)}</strong><small>{share.formula}</small></span>}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
        <p className="card__footnote">An allocated cost is a share of the agreement fee for reporting, not an extra charge. It is never added to the fee.</p>
      </section>

      <section className="card task-card" aria-label="History"><h2>Change history</h2>{agreement.history.length === 0 ? <p className="muted">Nothing recorded yet.</p> : <ul className="timeline-list">{[...agreement.history].reverse().map((line) => <li key={line.id}><strong>{line.summary}</strong><small>{formatDemoDateTime(line.at)} · {line.actor}{line.note ? ` · “${line.note}”` : ""}</small></li>)}</ul>}</section>

      {confirming ? <ConfirmDialog agreement={agreement} onClose={() => setConfirming(false)} /> : null}
      {ending ? <EndDialog agreement={agreement} onClose={() => setEnding(false)} /> : null}
    </div>
  );
}

function ConfirmDialog({ agreement, onClose }: { agreement: Agreement; onClose: () => void }) {
  const [note, setNote] = useState("");
  const save = useTransportAction<{ note: string }, Agreement>({ path: `/agreements/${agreement.id}/confirm`, success: () => ({ title: "Agreement confirmed", detail: "It can now be used for shipments that match its material, route and dates." }), onDone: onClose });
  return (
    <Dialog title={`Confirm ${agreement.number}?`} description="You are saying the terms match the document." onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending} onClick={() => save.mutate({ note })}>{save.isPending ? "Saving…" : "Confirm agreement"}</button></>}>
      <Field label="Note (optional)"><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </Dialog>
  );
}

function EndDialog({ agreement, onClose }: { agreement: Agreement; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const save = useTransportAction<{ reason: string }, Agreement>({ path: `/agreements/${agreement.id}/end`, success: () => ({ title: "Agreement ended", detail: "It is kept with its history. Shipments already using it keep their pricing record." }), onDone: onClose });
  return (
    <Dialog title={`End ${agreement.number}?`} onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || reason.trim().length < 5} onClick={() => save.mutate({ reason })}>{save.isPending ? "Saving…" : "End agreement"}</button></>}>
      <Field label="Why is it ending? (required)"><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </Dialog>
  );
}

// ---- Record or edit an agreement -----------------------------------------------------------------------------------------

type AgreementForm = {
  providerId: string; reference: string; material: string; from: string; to: string; service: string; startDate: string; endDate: string; renewal: string;
  method: AgreementPricingMethod; fee: string; feePeriod: FeePeriod; billing: Billing; invoiceTiming: string; paymentTerms: string;
  includedTonnes: string; allowancePeriod: "calendar_month" | "agreement"; excessRate: string; minimumCommitment: string; rollover: "none" | "carry_forward";
  included: string; excluded: string; vat: "excluded" | "included" | "not_stated"; estimateAmount: string; estimatePeriod: FeePeriod; estimateNote: string;
};

const blank: AgreementForm = {
  providerId: "", reference: "", material: "Coal", from: "Riverside Mine", to: "", service: "Road transport", startDate: "2026-05-01", endDate: "2026-05-31", renewal: "",
  method: "fixed_fee", fee: "", feePeriod: "month", billing: "monthly", invoiceTiming: "", paymentTerms: "", includedTonnes: "", allowancePeriod: "calendar_month", excessRate: "",
  minimumCommitment: "", rollover: "none", included: "", excluded: "", vat: "excluded", estimateAmount: "", estimatePeriod: "month", estimateNote: "",
};

const formOf = (a: Agreement): AgreementForm => ({
  providerId: a.providerId, reference: a.reference, material: a.material, from: a.from, to: a.to, service: a.service, startDate: a.startDate, endDate: a.endDate, renewal: a.renewal,
  method: a.method, fee: a.fee === null ? "" : String(a.fee), feePeriod: a.feePeriod, billing: a.billing, invoiceTiming: a.invoiceTiming, paymentTerms: a.paymentTerms,
  includedTonnes: a.includedTonnes === null ? "" : String(a.includedTonnes), allowancePeriod: a.allowancePeriod, excessRate: a.excessRate === null ? "" : String(a.excessRate),
  minimumCommitment: a.minimumCommitment ?? "", rollover: a.rollover, included: a.included, excluded: a.excluded, vat: a.vat,
  estimateAmount: a.manualEstimate ? String(a.manualEstimate.amount) : "", estimatePeriod: a.manualEstimate?.period ?? "month", estimateNote: a.manualEstimate?.note ?? "",
});

export function AgreementFormScreen({ id }: { id?: string }) {
  return <WithTransport>{(data) => (data.terms && data.can.record ? <AgreementFormView data={data} existing={id ? data.terms.agreements.find((item) => item.id === id) : undefined} missing={Boolean(id) && !data.terms.agreements.some((item) => item.id === id)} /> : <div className="task-page"><ProviderTabs active="agreements" /><LockedTerms /></div>)}</WithTransport>;
}

function AgreementFormView({ data, existing, missing }: { data: Transport; existing: Agreement | undefined; missing: boolean }) {
  const base = useTransportBase();
  const router = useRouter();
  const params = useSearchParams();
  const quoteId = params.get("quote");
  const found = quoteId ? data.terms!.requests.flatMap((request) => request.quotes.map((quote) => ({ request, quote }))).find((item) => item.quote.id === quoteId) : undefined;
  const [form, setForm] = useState<AgreementForm>(() => {
    if (existing) return formOf(existing);
    if (!found) return blank;
    const { request, quote } = found;
    return {
      ...blank, providerId: quote.providerId, reference: quote.reference ?? "", material: request.material, from: request.from, to: request.to, service: request.service,
      startDate: request.startDate ?? blank.startDate, endDate: request.endDate ?? blank.endDate, method: (quote.method as AgreementPricingMethod) ?? "fixed_fee", fee: quote.amount === null ? "" : String(quote.amount),
      feePeriod: quote.feePeriod ?? "month", billing: quote.billing ?? request.preferredBilling ?? "monthly", includedTonnes: quote.includedTonnes === null ? "" : String(quote.includedTonnes),
      allowancePeriod: quote.allowancePeriod ?? "calendar_month", excessRate: quote.excessRate === null ? "" : String(quote.excessRate), vat: quote.vat,
      included: quote.inclusions, excluded: quote.exclusions,
    };
  });
  const [document, setDocument] = useState<Attachment | null>(existing?.document ?? null);
  const [reason, setReason] = useState("");
  const submission = useSubmissionId();
  const set = (key: keyof AgreementForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  const save = useTransportAction<Record<string, unknown>, Agreement>({
    path: existing ? `/agreements/${existing.id}` : "/agreements", method: existing ? "PATCH" : "POST",
    success: (item) => ({ title: existing ? "Agreement updated" : "Agreement recorded as a draft", detail: existing ? "The change is in its history." : `${item.number} is a draft until an authorised person reviews and confirms its terms.` }),
    onDone: (item) => router.push(`${base}/agreements/${item.id}`),
  });
  if (missing) return <ErrorState message="This agreement could not be found." />;
  const approved = data.providers.filter((item) => item.approval === "approved" || item.id === form.providerId);
  const manual = form.method === "manual_estimate";
  const confirmedEdit = Boolean(existing?.confirmedAt);
  const valid = form.providerId && form.reference.trim().length >= 2 && form.to.trim().length >= 3 && form.startDate && form.endDate && (!manual || (Number(form.estimateAmount) > 0 && form.estimateNote.trim().length >= 3)) && (!confirmedEdit || reason.trim().length >= 5);

  const submit = () => save.mutate({
    submissionId: submission.id, version: existing?.version, reason: confirmedEdit ? reason : undefined, sourceQuoteId: found?.quote.id, document,
    providerId: form.providerId, reference: form.reference, material: form.material, from: form.from, to: form.to, service: form.service, startDate: form.startDate, endDate: form.endDate, renewal: form.renewal,
    method: form.method, fee: manual ? null : form.fee, feePeriod: form.feePeriod, billing: form.billing, invoiceTiming: form.invoiceTiming, paymentTerms: form.paymentTerms,
    includedTonnes: form.includedTonnes, allowancePeriod: form.allowancePeriod, excessRate: form.excessRate, minimumCommitment: form.minimumCommitment, rollover: form.rollover,
    included: form.included, excluded: form.excluded, vat: form.vat,
    manualEstimate: manual ? { amount: Number(form.estimateAmount), period: form.estimatePeriod, note: form.estimateNote } : null,
  });

  return (
    <div className="task-page">
      <Link href={existing ? `${base}/agreements/${existing.id}` : `${base}/agreements`} className="back-link"><ArrowLeft /> Back</Link>
      <PageHeader eyebrow="Transport agreements" title={existing ? `Edit ${existing.number}` : "New agreement"} description={existing ? "Changes to confirmed terms are kept in the history." : found ? "Prefilled from the accepted proposal. Check every term against the signed document before it is confirmed." : "Record an existing agreement from its document. It stays a draft until its terms are reviewed and confirmed."} icon={Truck} />
      <section className="card task-card" aria-label="Agreement">
        <h2>Agreement</h2>
        <div className="task-grid task-grid--two">
          <Field label="Provider"><Select value={form.providerId} onChange={set("providerId")}><option value="">Choose an approved provider</option>{approved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Agreement reference"><input value={form.reference} onChange={set("reference")} /></Field>
          <Field label="Material"><input value={form.material} onChange={set("material")} /></Field>
          <Field label="Service"><input value={form.service} onChange={set("service")} /></Field>
          <Field label="Collection point"><input value={form.from} onChange={set("from")} /></Field>
          <Field label="Destination"><input value={form.to} onChange={set("to")} /></Field>
          <Field label="Start date"><input type="date" value={form.startDate} onChange={set("startDate")} /></Field>
          <Field label="End date" hint={form.startDate && form.endDate && form.endDate >= form.startDate ? `${durationLabel(form.startDate, form.endDate)}. The length does not decide billing or allowance.` : undefined}><input type="date" value={form.endDate} onChange={set("endDate")} /></Field>
          <Field label="Renewal" wide><input value={form.renewal} onChange={set("renewal")} placeholder="Renews yearly unless either side gives 60 days' notice" /></Field>
          <Field label="Agreement document" wide hint="Optional. Only the file name is kept in this prototype.">
            <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) setDocument({ name: file.name, sizeLabel: file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB` }); }} />
            {document ? <span className="chip-row"><span className="chip"><FileText size={13} aria-hidden="true" /> {document.name}</span></span> : null}
          </Field>
        </div>

        <h2>Price</h2>
        <div className="task-grid task-grid--two">
          <Field label="Pricing method"><Select value={form.method} onChange={set("method")}>{Object.entries(agreementPricingMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          {manual ? (
            <>
              <Field label="Estimated amount (R)"><input inputMode="decimal" value={form.estimateAmount} onChange={set("estimateAmount")} /></Field>
              <Field label="Estimate covers"><Select value={form.estimatePeriod} onChange={set("estimatePeriod")}>{(["month", "year", "agreement"] as const).map((value) => <option key={value} value={value}>Per {periodWords[value]}</option>)}</Select></Field>
              <Field label="What the estimate is based on" wide hint="Complex terms stay in the document. This is a labelled estimate, not a calculation."><textarea rows={2} value={form.estimateNote} onChange={set("estimateNote")} /></Field>
            </>
          ) : (
            <>
              <Field label={form.method === "unit_rate" ? "Agreed rate per tonne (R)" : "Fee (R)"}><input inputMode="decimal" value={form.fee} onChange={set("fee")} /></Field>
              {form.method !== "unit_rate" ? <Field label="The fee covers"><Select value={form.feePeriod} onChange={set("feePeriod")}>{(["month", "year", "agreement"] as const).map((value) => <option key={value} value={value}>Per {periodWords[value]}</option>)}</Select></Field> : null}
            </>
          )}
          <Field label="Billing" hint="How often the provider invoices. Yearly billing is not an annual allowance or a discount."><Select value={form.billing} onChange={set("billing")}>{Object.entries(billingWords).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="VAT"><Select value={form.vat} onChange={set("vat")}><option value="excluded">Excluding VAT</option><option value="included">Including VAT</option><option value="not_stated">Not stated</option></Select></Field>
          <Field label="Invoice timing"><input value={form.invoiceTiming} onChange={set("invoiceTiming")} placeholder="Invoiced on the last day of the month" /></Field>
          <Field label="Payment terms"><input value={form.paymentTerms} onChange={set("paymentTerms")} placeholder="30 days from invoice" /></Field>
        </div>

        <h2>Allowance</h2>
        <div className="task-grid task-grid--two">
          <Field label="Included quantity (t)" hint="Leave empty if the agreement has no included quantity."><input inputMode="decimal" value={form.includedTonnes} onChange={set("includedTonnes")} /></Field>
          <Field label="Measured per" hint="Separate from the fee period and billing."><Select value={form.allowancePeriod} onChange={set("allowancePeriod")}>{Object.entries(allowancePeriodWords).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="Excess charge per tonne (R)"><input inputMode="decimal" value={form.excessRate} onChange={set("excessRate")} /></Field>
          <Field label="Unused allowance"><Select value={form.rollover} onChange={set("rollover")}><option value="none">Does not roll over</option><option value="carry_forward">Rolls forward as agreed</option></Select></Field>
          <Field label="Minimum commitment" wide hint="Only if the agreement states one. Leave empty otherwise: it is never assumed."><input value={form.minimumCommitment} onChange={set("minimumCommitment")} /></Field>
          <Field label="What is included"><input value={form.included} onChange={set("included")} /></Field>
          <Field label="What is excluded"><input value={form.excluded} onChange={set("excluded")} /></Field>
        </div>
        {confirmedEdit ? <Field label="Why are you changing confirmed terms? (required)"><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
        <div className="task-footer">
          <p>{existing ? "Saves the change and records it in the history." : "Saves a draft. An authorised person then reviews the terms and confirms."}</p>
          <div className="button-row"><button className="button button--primary" disabled={!valid || save.isPending} onClick={submit}>{save.isPending ? "Saving…" : existing ? "Save changes" : "Save draft"}</button></div>
        </div>
      </section>
    </div>
  );
}

// ---- Transport pricing on a shipment ---------------------------------------------------------------------------------------

/**
 * The shipment's one transport price: from an accepted quote, or from an agreement. Only shown to roles that may see commercial terms.
 * Replacing the source needs an explicit step and a reason, and the earlier source stays in the history.
 */
export function TransportPricingSection({ shipment }: { shipment: Shipment }) {
  const base = useTransportBase();
  const query = useTransport();
  const logistics = useLogistics();
  const [choosing, setChoosing] = useState(false);
  if (!query.data?.terms || shipment.kind !== "sale" || shipment.transportMode === "own_fleet") return null;
  const data = query.data;
  const terms = data.terms!;
  const source = shipment.pricingSource;
  const agreement = source?.agreementId ? terms.agreements.find((item) => item.id === source.agreementId) : undefined;
  const share = agreement ? allocatedCost(agreement, shipment.tonnes) : null;
  const open = !["dispatched", "delivered", "cancelled"].includes(shipment.state);
  const request = terms.requests.find((item) => item.shipmentId === shipment.id && ["draft", "sent"].includes(item.status));

  return (
    <section className="task-section" aria-label="Transport pricing">
      <h2>Transport pricing</h2>
      {source ? (
        <>
          <div className="fact-row">
            <div className="fact"><span>Pricing source</span><strong>{source.type === "quote" ? `Quote ${terms.requests.find((item) => item.id === source.requestId)?.number ?? ""} · ${providerName(data, source.providerId)}` : `${source.label} · ${providerName(data, source.providerId)}`}</strong></div>
            {source.costExVat !== null ? <div className="fact"><span>Agreed transport cost</span><strong>{formatRand(source.costExVat)} ex VAT</strong></div> : null}
            {agreement ? <div className="fact"><span>Agreement price</span><strong>{priceOf(agreement)}</strong></div> : null}
            {share ? <div className="fact"><span>Allocated transport cost estimate</span><strong>{share.amount === null ? "Not worked out" : formatRand(share.amount)}</strong></div> : null}
          </div>
          {share ? <p className="muted">{share.amount === null ? share.reason : `${share.formula}. This is this shipment's share of the agreement fee for reporting. It is not an extra charge and is not added to the fee.`}</p> : null}
          <p className="muted">Freight cost is kept apart from the sales value. A price or an allowance does not book a truck: collection must still be confirmed by the provider.</p>
        </>
      ) : <p className="muted">Transport cost not yet assessed. No quote has been accepted and no agreement is used.</p>}
      {request ? <p className="muted">Quote request <Link className="row-link-text" href={`${base}/quotes/${request.id}`}>{request.number}</Link> is {request.status === "draft" ? "a draft" : "waiting for replies"}.</p> : null}
      {open && data.can.shipments ? (
        <div className="button-row button-row--end">
          {data.can.record && !request ? <Link className="button button--quiet" href={`${base}/quotes/new?shipment=${shipment.id}`}>Request a quote</Link> : null}
          <button className="button button--quiet" onClick={() => setChoosing(true)}>Use transport agreement</button>
        </div>
      ) : null}
      {choosing ? <ChooseAgreementDialog data={data} shipment={shipment} shipments={logistics.data?.shipments ?? []} onClose={() => setChoosing(false)} /> : null}
    </section>
  );
}

function ChooseAgreementDialog({ data, shipment, shipments, onClose }: { data: Transport; shipment: Shipment; shipments: Shipment[]; onClose: () => void }) {
  const terms = data.terms!;
  const { eligible, rejected } = eligibleAgreements(terms.agreements, data.providers, shipment, data.today);
  const [picked, setPicked] = useState(eligible[0]?.id ?? "");
  const [replace, setReplace] = useState(false);
  const [reason, setReason] = useState("");
  const replaces = Boolean(shipment.pricingSource);
  const save = useTransportAction<Record<string, unknown>, Shipment>({ path: `/shipments/${shipment.id}/pricing-agreement`, success: () => ({ title: "Agreement used for this shipment", detail: "Its tonnes now count as planned in the agreement. Collection is still not confirmed." }), onDone: onClose });
  const chosen = eligible.find((item) => item.id === picked);
  const usage = chosen ? allowanceFor(chosen, data.period, shipments, terms.earlier) : null;
  return (
    <Dialog title="Use transport agreement" description={`${shipment.number} · ${shipment.mineral} · ${formatTonnes(shipment.tonnes)} to ${shipment.destination}`} size="wide" onClose={onClose} locked={save.isPending}
      footer={<><button className="button button--quiet" onClick={onClose} disabled={save.isPending}>Cancel</button><button className="button button--primary" disabled={save.isPending || !chosen || (replaces && (!replace || reason.trim().length < 5))} onClick={() => save.mutate({ agreementId: picked, replace: replaces ? replace : undefined, reason })}>{save.isPending ? "Saving…" : "Use this agreement"}</button></>}>
      <div className="dialog__stack">
        {eligible.length === 0 ? <div className="note-bar"><Info /> <span>No agreement covers this shipment: the material, route, dates, provider approval and agreement status all have to match.</span></div> : (
          <ul className="check-list">
            {eligible.map((item) => <li key={item.id}><label style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}><input type="radio" name="agreement" checked={picked === item.id} onChange={() => setPicked(item.id)} /><span><strong>{item.number}</strong> · {providerName(data, item.providerId)} · {priceOf(item)}<br /><small className="muted">{item.material}, {item.from} to {item.to} · {rangeLabel(item.startDate, item.endDate)}</small></span></label></li>)}
          </ul>
        )}
        {usage && chosen ? <p className="muted">{periodName(data.period)}: {number(usage.available ?? 0)} t available of {number(usage.included ?? 0)} t. This shipment adds {formatTonnes(shipment.tonnes)} as planned.{usage.available !== null && shipment.tonnes > usage.available ? " That is more than is available, so the extra is charged at the excess rate." : ""}</p> : null}
        {replaces ? (
          <>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /> <span>This shipment already has a transport price ({shipment.pricingSource?.label}). Replace it. The earlier source stays in the history.</span></label>
            <Field label="Why? (required)"><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          </>
        ) : null}
        {rejected.length > 0 ? (
          <details>
            <summary>{rejected.length} agreement{rejected.length === 1 ? "" : "s"} cannot be used for this shipment</summary>
            <ul className="timeline-list">{rejected.map((item) => <li key={item.agreement.id}><strong>{item.agreement.number} · {providerName(data, item.agreement.providerId)}</strong><small>{item.reason}</small></li>)}</ul>
          </details>
        ) : null}
        <p className="muted">Collection date {shortDate(shipment.preferredDate)}. An agreement does not confirm a booking.</p>
      </div>
    </Dialog>
  );
}
