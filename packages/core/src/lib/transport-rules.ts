/**
 * Service providers, transport quotes and transport agreements: the records, who may do what, and the calculations.
 *
 * Five things about an agreement are kept independent on purpose, because they are often confused:
 *   agreement dates     when the agreement applies
 *   pricing method      how the charge is worked out
 *   fee or rate period  what the quoted amount covers (a month, a year, the whole agreement)
 *   billing frequency   how often a bill is raised
 *   allowance period    when the included quantity is measured and resets
 * A 12-month agreement can have a monthly fee, monthly billing and a monthly tonnage allowance. A yearly bill does not add a
 * discount, does not mean paying in advance, and never turns monthly allowances into one yearly allowance.
 *
 * Everything here is a manual record-keeping prototype with fictional data. Prices exclude VAT unless a record says otherwise.
 * The agreement demonstration runs in a labelled simulated period (April 2026), separate from the rest of the demo's clock.
 */
import type { PricingSource, Shipment } from "@vesper/api-contracts";
import type { Actor, Check } from "./issue-rules";
import { shipmentFigures } from "./shipment-rules";

/** The simulated "today" for agreements and allowances. The Demo period label on every agreement screen says so. */
export const TRANSPORT_DEMO_DATE = "2026-04-24";
export const TRANSPORT_DEMO_PERIOD = "2026-04";
export const COLLECTION_POINT = "Riverside Mine";

// ---- Who may do what ---------------------------------------------------------------------------------------------------

export type TransportCapability = "view_terms" | "manage_providers" | "approve_providers" | "record_quotes" | "decide_quotes" | "confirm_agreements";

const roles: Record<TransportCapability, { roles: string[]; message: string }> = {
  // Prices and terms are commercial information. Operations see providers, not what they charge.
  view_terms: { roles: ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"], message: "Quotes, rates and agreement terms are shown to the Mine Manager, the Commercial / Finance Officer and the Inventory Controller." },
  manage_providers: { roles: ["Mine Manager", "Stores / Inventory Controller"], message: "Provider details are managed by the Mine Manager or the Inventory Controller." },
  approve_providers: { roles: ["Mine Manager"], message: "Mine approval of a provider is given by the Mine Manager." },
  record_quotes: { roles: ["Mine Manager", "Stores / Inventory Controller", "Commercial / Finance Officer"], message: "Quotes are recorded by the Mine Manager, the Inventory Controller or the Commercial / Finance Officer." },
  decide_quotes: { roles: ["Mine Manager", "Commercial / Finance Officer"], message: "A quote is accepted or not selected by the Mine Manager or the Commercial / Finance Officer." },
  confirm_agreements: { roles: ["Mine Manager", "Commercial / Finance Officer"], message: "An agreement is reviewed and activated by the Mine Manager or the Commercial / Finance Officer." },
};

export function canActOnTransport(capability: TransportCapability, actor: Actor): Check {
  const rule = roles[capability];
  return rule.roles.includes(actor.role) ? { allowed: true } : { allowed: false, reason: rule.message };
}

// ---- Words -------------------------------------------------------------------------------------------------------------

export const approvalLabels = { needs_review: "Needs review", approved: "Approved", inactive: "Inactive" } as const;
export const approvalTone = { needs_review: "needs_confirmation", approved: "confirmed", inactive: "cancelled" } as const;
export type Approval = keyof typeof approvalLabels;

export const requestStatusWords = { draft: "Draft", sent: "Request sent", decision_recorded: "Decision recorded", closed: "Closed" } as const;
export type RequestStatus = keyof typeof requestStatusWords;

export const quoteStatusWords = { waiting: "Waiting for quote", to_review: "To review", accepted: "Accepted", not_selected: "Not selected", unavailable: "Provider unavailable", expired: "Expired" } as const;
export type QuoteStatus = keyof typeof quoteStatusWords;
export const quoteTone = { waiting: "pending", to_review: "needs_confirmation", accepted: "confirmed", not_selected: "cancelled", unavailable: "at_risk", expired: "at_risk" } as const;

export const agreementStatusWords = { draft: "Draft", upcoming: "Upcoming", active: "Active", expired: "Expired", ended: "Ended" } as const;
export type AgreementStatus = keyof typeof agreementStatusWords;
export const agreementTone = { draft: "draft", upcoming: "pending", active: "confirmed", expired: "at_risk", ended: "cancelled" } as const;

export const shipmentPricingMethods = { whole_shipment: "Whole-shipment price", per_tonne: "Rate per tonne", per_load: "Rate per load" } as const;
export const agreementPricingMethods = { fixed_fee: "Recurring fixed fee", unit_rate: "Agreed rate per tonne", fixed_plus_usage: "Fixed fee plus usage charges", manual_estimate: "Manual estimate (terms kept in the document)" } as const;
export type ShipmentPricingMethod = keyof typeof shipmentPricingMethods;
export type AgreementPricingMethod = keyof typeof agreementPricingMethods;

export const periodWords = { month: "month", year: "year", agreement: "whole agreement", shipment: "shipment" } as const;
export type FeePeriod = keyof typeof periodWords;
export const allowancePeriodWords = { calendar_month: "calendar month", agreement: "whole agreement" } as const;
export type AllowancePeriod = keyof typeof allowancePeriodWords;
export const billingWords = { monthly: "Monthly", yearly: "Yearly", custom: "Custom" } as const;
export type Billing = keyof typeof billingWords;
export const rolloverWords = { none: "Unused allowance does not roll over.", carry_forward: "Unused allowance rolls forward as agreed." } as const;
export type Rollover = keyof typeof rolloverWords;
export const vatWords = { excluded: "Excluding VAT", included: "Including VAT", not_stated: "VAT treatment not stated" } as const;
export type Vat = keyof typeof vatWords;

/** "R1,000,000". The transport screens write rand without a space, to match the agreed designs. */
export const formatRand = (value: number) => `R${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}`;

// ---- Records -----------------------------------------------------------------------------------------------------------

export type Attachment = { name: string; sizeLabel: string };
export type HistoryLine = { id: string; at: string; actor: string; summary: string; note: string | null };

export type Quote = {
  id: string;
  providerId: string;
  status: QuoteStatus;
  reference: string | null;
  receivedOn: string | null;
  validUntil: string | null;
  currency: "ZAR";
  /** shipment: whole_shipment, per_tonne or per_load. Agreement: recurring fixed fee, agreed rate, or fixed plus usage. */
  method: ShipmentPricingMethod | AgreementPricingMethod | null;
  /** The quoted fee or rate. */
  amount: number | null;
  /** What the fee or rate covers. */
  feePeriod: FeePeriod | null;
  /** Needed for a per-load price. */
  loads: number | null;
  quantityTonnes: number | null;
  /** Agreement quotes: the proposed allowance, billing and excess. */
  includedTonnes: number | null;
  allowancePeriod: AllowancePeriod | null;
  billing: Billing | null;
  excessRate: number | null;
  inclusions: string;
  availability: string;
  vat: Vat;
  fuelAdjustment: string;
  otherCharges: string;
  exclusions: string;
  conditions: string;
  attachments: Attachment[];
  decision: { by: string; at: string; reason: string } | null;
};

export type QuoteRequest = {
  id: string;
  number: string;
  kind: "shipment" | "agreement";
  status: RequestStatus;
  shipmentId: string | null;
  material: string;
  from: string;
  to: string;
  service: string;
  quantityTonnes: number | null;
  unit: string;
  collectionWindow: string | null;
  requiredBy: string | null;
  requirements: string;
  // Agreement requests
  startDate: string | null;
  endDate: string | null;
  expectedVolume: number | null;
  volumePeriod: AllowancePeriod | null;
  preferredBilling: Billing | null;
  providerIds: string[];
  replyBy: string;
  sentRecordedAt: string | null;
  sentBy: string | null;
  createdBy: string;
  createdAt: string;
  quotes: Quote[];
  history: HistoryLine[];
};

export type Agreement = {
  id: string;
  number: string;
  providerId: string;
  reference: string;
  document: Attachment | null;
  material: string;
  from: string;
  to: string;
  service: string;
  startDate: string;
  endDate: string;
  renewal: string;
  method: AgreementPricingMethod;
  currency: "ZAR";
  fee: number | null;
  feePeriod: FeePeriod;
  billing: Billing;
  invoiceTiming: string;
  paymentTerms: string;
  includedTonnes: number | null;
  allowancePeriod: AllowancePeriod;
  excessRate: number | null;
  /** Only where the agreement explicitly has one. Never assumed. */
  minimumCommitment: string | null;
  rollover: Rollover;
  included: string;
  excluded: string;
  vat: Vat;
  /** For terms the calculations cannot express: a clearly labelled manual estimate, with the document kept. */
  manualEstimate: { amount: number; period: FeePeriod; note: string } | null;
  sourceQuoteId: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  history: HistoryLine[];
  version: number;
  createdAt: string;
};

/** A fixed fee recorded once for its charge period. The same period can never be recorded twice. */
export type AgreementCharge = { id: string; agreementId: string; period: string; amount: number; recordedBy: string; recordedAt: string };
/** Deliveries from before the prototype's own records, kept so earlier periods and their totals are preserved. */
export type EarlierDelivery = { id: string; agreementId: string; period: string; tonnes: number; note: string };

// ---- Quote figures -----------------------------------------------------------------------------------------------------

/**
 * The total a shipment quote comes to, or null when it cannot be worked out. A per-load price needs the number of loads, and a
 * per-tonne price needs the quantity: nothing is guessed.
 */
export function quoteTotal(quote: Pick<Quote, "method" | "amount" | "loads" | "quantityTonnes">): number | null {
  if (quote.amount === null) return null;
  if (quote.method === "whole_shipment") return quote.amount;
  if (quote.method === "per_tonne") return quote.quantityTonnes === null ? null : Math.round(quote.amount * quote.quantityTonnes * 100) / 100;
  if (quote.method === "per_load") return quote.loads === null || quote.loads <= 0 ? null : Math.round(quote.amount * quote.loads * 100) / 100;
  return null;
}

/** "R350 / t", "R105,000 for the shipment", "R12,000 / load". */
export function rateLabel(quote: Pick<Quote, "method" | "amount" | "feePeriod">): string {
  if (quote.amount === null) return "No rate yet";
  if (quote.method === "per_tonne" || quote.method === "unit_rate") return `${formatRand(quote.amount)} / t`;
  if (quote.method === "per_load") return `${formatRand(quote.amount)} / load`;
  if (quote.method === "whole_shipment") return `${formatRand(quote.amount)} for the shipment`;
  return `${formatRand(quote.amount)} / ${quote.feePeriod ? periodWords[quote.feePeriod] : "period"}`;
}

/**
 * A recurring fee on a common footing, so offers can be compared on the same period: the monthly and the yearly equivalent, each
 * clearly labelled. It is plain arithmetic only: a yearly fee is divided by 12 and a monthly fee multiplied by 12. No discount or
 * advance payment is implied, and fees for other periods are left alone.
 */
export function feeEquivalents(fee: number | null, period: FeePeriod): { perMonth: number | null; perYear: number | null } {
  if (fee === null) return { perMonth: null, perYear: null };
  if (period === "month") return { perMonth: fee, perYear: fee * 12 };
  if (period === "year") return { perMonth: Math.round((fee / 12) * 100) / 100, perYear: fee };
  return { perMonth: null, perYear: null };
}

/** The status shown for a quote: Expired when its validity has passed without a decision. */
export function quoteStatusNow(quote: Pick<Quote, "status" | "validUntil">, today: string): QuoteStatus {
  if ((quote.status === "to_review" || quote.status === "waiting") && quote.validUntil && quote.validUntil < today) return "expired";
  return quote.status;
}

// ---- Agreements --------------------------------------------------------------------------------------------------------

/** Draft until an authorised person has reviewed and confirmed its terms. Then upcoming, active or expired by its dates. */
export function agreementStatus(agreement: Pick<Agreement, "confirmedAt" | "endedAt" | "startDate" | "endDate">, today: string): AgreementStatus {
  if (agreement.endedAt) return "ended";
  if (!agreement.confirmedAt) return "draft";
  if (today < agreement.startDate) return "upcoming";
  if (today > agreement.endDate) return "expired";
  return "active";
}

const dayMs = 86_400_000;
const parseDay = (value: string) => Date.parse(`${value}T12:00:00Z`);

/** "12 months", "1 month" or "45 days", from the dates alone. */
export function durationLabel(startDate: string, endDate: string): string {
  const start = new Date(parseDay(startDate));
  const end = new Date(parseDay(endDate));
  const endsOnLast = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate() === end.getUTCDate();
  if (start.getUTCDate() === 1 && endsOnLast) {
    const wholeMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
    return `${wholeMonths} ${wholeMonths === 1 ? "month" : "months"}`;
  }
  const days = Math.round((parseDay(endDate) - parseDay(startDate)) / dayMs) + 1;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "1 Jan 2026". */
export function dayLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}
/** "1 Jan–31 Dec 2026" when both dates share a year, otherwise each with its year. */
export function rangeLabel(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return sy === ey ? `${sd} ${months[sm - 1]}–${ed} ${months[em - 1]} ${ey}` : `${dayLabel(start)}–${dayLabel(end)}`;
}
/** "April 2026" from "2026-04". */
export function periodName(period: string) {
  const [year, month] = period.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return month ? `${names[month - 1]} ${year}` : period;
}

/** The allowance period a date falls in: its calendar month, or one period for the whole agreement. */
export const periodOf = (date: string, allowance: AllowancePeriod) => (allowance === "agreement" ? "all" : date.slice(0, 7));

/** Every calendar month an agreement covers, oldest first. */
export function monthsCovered(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  let [year, month] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

/** The periods a fixed fee is charged for. Monthly billing has a charge for each month, yearly billing one for the agreement year. */
export function chargePeriods(agreement: Pick<Agreement, "billing" | "startDate" | "endDate" | "feePeriod">): string[] {
  if (agreement.billing === "yearly") return [agreement.startDate.slice(0, 4)];
  if (agreement.billing === "monthly") return monthsCovered(agreement.startDate, agreement.endDate);
  return ["all"];
}

/** What one charge for a period comes to, from the fee and the periods it covers. Null when the fee period does not line up. */
export function chargeAmount(agreement: Pick<Agreement, "fee" | "feePeriod" | "billing">): number | null {
  if (agreement.fee === null) return null;
  if (agreement.billing === "monthly" && agreement.feePeriod === "month") return agreement.fee;
  if (agreement.billing === "yearly" && agreement.feePeriod === "year") return agreement.fee;
  if (agreement.billing === "yearly" && agreement.feePeriod === "month") return agreement.fee * 12;
  if (agreement.billing === "monthly" && agreement.feePeriod === "year") return Math.round((agreement.fee / 12) * 100) / 100;
  return agreement.fee;
}

// ---- Allowance ---------------------------------------------------------------------------------------------------------


/**
 * The period a shipment's tonnes count in: the month of its collection date, whether it is still planned or already delivered. A delivery
 * that slips into the next month therefore stays in the month it was planned for, which keeps each shipment in exactly one period.
 */
export function shipmentPeriod(shipment: Pick<Shipment, "preferredDate">, allowance: AllowancePeriod): string {
  return periodOf(shipment.preferredDate, allowance);
}

export type Allowance = {
  period: string;
  included: number | null;
  /** Confirmed delivered tonnes (what was received). */
  delivered: number;
  /** Planned tonnes: linked shipments not yet delivered and not cancelled. */
  planned: number;
  /** Included less delivered less planned, never below zero. Null when no allowance is agreed. */
  available: number | null;
  /** Tonnes beyond the allowance that would be charged at the excess rate. */
  excess: number;
};

/**
 * Allowance for one period. Each linked shipment is in exactly one place: delivered (by the tonnes received), or planned (until it
 * is delivered), or neither (cancelled). So a delivery moves its tonnes from planned to delivered without counting them twice, and
 * cancelling an unfulfilled plan releases it. Earlier recorded deliveries count as delivered for their own period only.
 */
export function allowanceFor(agreement: Pick<Agreement, "id" | "includedTonnes" | "allowancePeriod">, period: string, shipments: Shipment[], earlier: EarlierDelivery[]): Allowance {
  let delivered = earlier.filter((item) => item.agreementId === agreement.id && item.period === period).reduce((total, item) => total + item.tonnes, 0);
  let planned = 0;
  for (const shipment of shipments) {
    const source: PricingSource | null = shipment.pricingSource;
    if (!source || source.agreementId !== agreement.id || shipment.state === "cancelled") continue;
    if (shipmentPeriod(shipment, agreement.allowancePeriod) !== period) continue;
    if (shipment.state === "delivered") delivered += shipmentFigures(shipment).received;
    else planned += shipment.tonnes;
  }
  delivered = Math.round(delivered * 100) / 100;
  planned = Math.round(planned * 100) / 100;
  const included = agreement.includedTonnes;
  return {
    period,
    included,
    delivered,
    planned,
    available: included === null ? null : Math.max(0, Math.round((included - delivered - planned) * 100) / 100),
    excess: included === null ? 0 : Math.max(0, Math.round((delivered + planned - included) * 100) / 100),
  };
}

export type CostAllocation = { amount: number | null; formula: string | null; reason: string | null };

/**
 * A shipment's share of an agreement's fixed fee, as an estimate: tonnes / included tonnes x the fee for that period. It is a share of
 * the agreement cost and never another charge from the provider, so it must not be added to the fee. It is only worked out when the
 * fee period and the allowance period are the same; otherwise it says why it cannot be, and a manual estimate can be recorded.
 */
export function allocatedCost(agreement: Pick<Agreement, "fee" | "feePeriod" | "includedTonnes" | "allowancePeriod" | "method" | "manualEstimate">, tonnes: number): CostAllocation {
  if (agreement.fee === null || agreement.includedTonnes === null || agreement.includedTonnes <= 0) {
    return { amount: null, formula: null, reason: "The agreement has no fee or included quantity to share, so no allocation is worked out." };
  }
  const aligned = (agreement.feePeriod === "month" && agreement.allowancePeriod === "calendar_month") || (agreement.feePeriod === "agreement" && agreement.allowancePeriod === "agreement");
  if (!aligned) {
    return { amount: null, formula: null, reason: `The fee is per ${periodWords[agreement.feePeriod]} but the allowance is per ${allowancePeriodWords[agreement.allowancePeriod]}, so there is no agreed way to share it. Clarify with the provider or record a manual estimate.` };
  }
  const amount = Math.round((tonnes / agreement.includedTonnes) * agreement.fee * 100) / 100;
  return { amount, formula: `${new Intl.NumberFormat("en-GB").format(tonnes)} ÷ ${new Intl.NumberFormat("en-GB").format(agreement.includedTonnes)} × ${formatRand(agreement.fee)} = ${formatRand(amount)}`, reason: null };
}

// ---- Applying an agreement to a shipment -----------------------------------------------------------------------------------

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Which agreements a shipment may use, with the reason for each one that cannot. It must be approved, active on the shipment's
 * date, and match the material, the route and the transport service. Having an agreement or allowance never confirms a collection.
 */
export function eligibleAgreements(agreements: Agreement[], providers: { id: string; approval: Approval }[], shipment: Pick<Shipment, "mineral" | "destination" | "preferredDate">, today: string) {
  const eligible: Agreement[] = [];
  const rejected: { agreement: Agreement; reason: string }[] = [];
  for (const agreement of agreements) {
    const provider = providers.find((item) => item.id === agreement.providerId);
    let reason: string | null = null;
    const status = agreementStatus(agreement, today);
    if (!provider || provider.approval !== "approved") reason = "The provider is not approved by the mine.";
    else if (status !== "active") reason = `The agreement is ${agreementStatusWords[status].toLowerCase()}, not active.`;
    else if (!same(agreement.material, shipment.mineral)) reason = `It covers ${agreement.material.toLowerCase()}, not ${shipment.mineral.toLowerCase()}.`;
    else if (!same(agreement.from, COLLECTION_POINT) || !same(agreement.to, shipment.destination)) reason = `It covers ${agreement.from} to ${agreement.to}, not ${COLLECTION_POINT} to ${shipment.destination}.`;
    else if (shipment.preferredDate < agreement.startDate || shipment.preferredDate > agreement.endDate) reason = "The shipment's collection date is outside the agreement dates.";
    if (reason) rejected.push({ agreement, reason });
    else eligible.push(agreement);
  }
  return { eligible, rejected };
}
