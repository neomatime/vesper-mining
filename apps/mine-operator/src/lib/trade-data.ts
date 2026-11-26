/**
 * The starting Trade records for Riverside Mine. Fictional companies and people; figures are internally consistent: every delivery
 * belongs to a commitment inside an agreement, every invoice is raised on tonnes the customer accepted, and the April deliveries for
 * Bayside Metals and Highveld Power are the same Mining Operations shipments (SHP-0043 to SHP-0048 and SHP-0051) seen from Trade.
 *
 * Older months are generated from each agreement's plan so the history, fulfilment and settlement figures add up; the current month
 * is written out by hand. The scenario's 'today' is 24 April 2025, the same as Mining Operations.
 */
import {
  addDays,
  type Agreement,
  type Approval,
  type Client,
  type Commitment,
  type Commodity,
  type Delivery,
  type Enquiry,
  type OperationLink,
  type SavedReport,
  type Settlement,
  type TradeDocument,
  type TradeEvent,
} from "./trade-rules";

export const TRADE_TODAY = "2025-04-24";
const at = (date: string, time = "09:00") => `${date}T${time}:00+02:00`;

let eventCounter = 0;
const ev = (date: string, actor: string, summary: string, note: string | null = null, time = "09:00"): TradeEvent => ({ id: `tev-${String(++eventCounter).padStart(4, "0")}`, at: at(date, time), actor, summary, note });

// ---- Clients -------------------------------------------------------------------------------------------------------------

type ClientSeed = Omit<Client, "version" | "history" | "contacts" | "notes"> & { contacts: [string, string][]; notes?: string };

const clientSeeds: ClientSeed[] = [
  { id: "cl-01", code: "BAY", name: "Bayside Metals", segment: "Ferrochrome smelter", status: "active", city: "Germiston", country: "South Africa", registration: "2004/018223/07", email: "procurement@baysidemetals.example", phone: "+27 11 555 0181", website: "baysidemetals.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 30, creditLimit: 25_000_000, since: "2019-02-01", contacts: [["Nandi Mokoena", "Head of Procurement"], ["Peter Barnes", "Logistics Lead"], ["Kgomotso Thwala", "Accounts Payable"]] },
  { id: "cl-02", code: "HOR", name: "Horizon Metals", segment: "Stainless steel producer", status: "active", city: "Middelburg", country: "South Africa", registration: "1998/004512/06", email: "buying@horizonmetals.example", phone: "+27 13 555 0122", website: "horizonmetals.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 45, creditLimit: 18_000_000, since: "2021-06-15", contacts: [["Lindiwe Khumalo", "Raw Materials Buyer"], ["Johan Steyn", "Plant Receiving"]] },
  { id: "cl-03", code: "FTA", name: "FerroTrade Africa", segment: "Commodity trader", status: "active", city: "Johannesburg", country: "South Africa", registration: "2012/221908/07", email: "trading@ferrotrade.example", phone: "+27 10 555 0190", website: "ferrotrade.example", accountOwner: "John Dlamini", paymentTermsDays: 30, creditLimit: 20_000_000, since: "2020-09-01", contacts: [["Kabelo Dube", "Trader"], ["Ayesha Patel", "Operations"]] },
  { id: "cl-04", code: "EAA", name: "Eastern Alloys", segment: "Ferrochrome smelter", status: "active", city: "eMalahleni", country: "South Africa", registration: "2007/113402/07", email: "supply@easternalloys.example", phone: "+27 13 555 0144", website: "easternalloys.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 30, creditLimit: 22_000_000, since: "2018-03-12", contacts: [["Thabo Ndlovu", "Supply Manager"], ["Grace Mthembu", "Quality"]] },
  { id: "cl-05", code: "NCO", name: "Northern Commodities", segment: "Commodity trader", status: "active", city: "Polokwane", country: "South Africa", registration: "2015/300144/07", email: "deals@northerncommodities.example", phone: "+27 15 555 0108", website: "northerncommodities.example", accountOwner: "John Dlamini", paymentTermsDays: 30, creditLimit: 8_000_000, since: "2022-01-20", contacts: [["Pieter Venter", "Director"]] },
  { id: "cl-06", code: "GAT", name: "Global Alloy Traders", segment: "Commodity trader", status: "active", city: "Durban", country: "South Africa", registration: "2010/087731/07", email: "ops@globalalloy.example", phone: "+27 31 555 0166", website: "globalalloy.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 30, creditLimit: 15_000_000, since: "2020-11-05", contacts: [["Sanele Mkhize", "Commercial Manager"], ["Ravi Naidoo", "Shipping"]] },
  { id: "cl-07", code: "HPC", name: "Highveld Power Co-op", segment: "Power producer", status: "active", city: "Secunda", country: "South Africa", registration: "2009/055610/09", email: "fuel@highveldpower.example", phone: "+27 17 555 0119", website: "highveldpower.example", accountOwner: "John Dlamini", paymentTermsDays: 30, creditLimit: 12_000_000, since: "2023-06-01", contacts: [["Mpho Sithole", "Fuel Procurement"], ["Erika Botha", "Coal Yard Supervisor"]] },
  { id: "cl-08", code: "KAL", name: "Kalahari Minerals", segment: "Commodity trader", status: "on_hold", city: "Upington", country: "South Africa", registration: "2016/402211/07", email: "accounts@kalaharimin.example", phone: "+27 54 555 0131", website: "kalaharimin.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 30, creditLimit: 4_000_000, since: "2023-02-14", contacts: [["Willem de Bruin", "Owner"]], notes: "On hold while an overdue invoice is resolved. New deliveries need Mine Manager approval." },
  { id: "cl-09", code: "ELS", name: "Eastlink Smelters", segment: "Ferrochrome smelter", status: "inactive", city: "Rustenburg", country: "South Africa", registration: "2003/009981/07", email: "info@eastlink.example", phone: "+27 14 555 0175", website: "eastlink.example", accountOwner: "John Dlamini", paymentTermsDays: 30, creditLimit: null, since: "2017-05-01", contacts: [["Sibusiso Zulu", "Buyer"]], notes: "No active agreement since 2024." },
  { id: "cl-10", code: "NLM", name: "Northline Metals", segment: "Industrial user", status: "onboarding", city: "Pretoria", country: "South Africa", registration: "2019/150077/07", email: "procure@northline.example", phone: "+27 12 555 0153", website: "northline.example", accountOwner: "Zinhle Mahlangu", paymentTermsDays: 30, creditLimit: 3_000_000, since: "2025-03-28", contacts: [["Refilwe Moloi", "Procurement Officer"]], notes: "KYC pack expires on 29 April 2025; renewal requested." },
];

const contactEmail = (name: string, website: string) => `${name.toLowerCase().replace(/[^a-z ]/g, "").split(" ").join(".")}@${website}`;

export const seedClients: Client[] = clientSeeds.map((seed, index) => ({
  ...seed,
  notes: seed.notes ?? "",
  contacts: seed.contacts.map(([name, role], contactIndex) => ({ id: `ct-${seed.id}-${contactIndex + 1}`, name, role, email: contactEmail(name, seed.website), phone: `+27 82 555 ${String(1000 + index * 10 + contactIndex)}` })),
  version: 1,
  history: [ev(seed.since, seed.accountOwner, "Client added"), ...(seed.status === "on_hold" ? [ev("2025-04-11", "John Dlamini", "Status changed from active to on hold", "Invoice overdue by more than 30 days.")] : [])],
}));

// ---- Agreements, commitments, deliveries and invoices --------------------------------------------------------------------

type Plan = {
  id: string;
  number: string;
  clientId: string;
  commodity: Commodity;
  title: string;
  status: Agreement["status"];
  start: string;
  end: string;
  price: number;
  incoterm: string;
  terms: number;
  owner: string;
  /** Months per commitment period. */
  every: 1 | 3;
  tonnes: number;
  point: string;
  /** Share of each past commitment the customer accepted. */
  performance: number;
};

const plans: Plan[] = [
  { id: "ag-47", number: "AGR-0047", clientId: "cl-01", commodity: "Chrome concentrate", title: "Chrome concentrate offtake 2025", status: "active", start: "2025-01-01", end: "2025-12-31", price: 3150, incoterm: "FCA Riverside Mine", terms: 30, owner: "Zinhle Mahlangu", every: 1, tonnes: 2000, point: "Richards Bay Terminal", performance: 0.97 },
  { id: "ag-46", number: "AGR-0046", clientId: "cl-02", commodity: "Chrome lumpy ore", title: "Lumpy ore supply 2025–26", status: "active", start: "2025-03-01", end: "2026-02-28", price: 2480, incoterm: "DAP Middelburg works", terms: 45, owner: "Zinhle Mahlangu", every: 1, tonnes: 1500, point: "Horizon Metals, Middelburg", performance: 1 },
  { id: "ag-45", number: "AGR-0045", clientId: "cl-07", commodity: "Coal", title: "Boiler coal supply 2024–25", status: "active", start: "2024-07-01", end: "2025-06-30", price: 1180, incoterm: "DAP Secunda coal yard", terms: 30, owner: "John Dlamini", every: 1, tonnes: 3000, point: "Highveld Power coal yard, Secunda", performance: 0.78 },
  { id: "ag-44", number: "AGR-0044", clientId: "cl-04", commodity: "Chrome concentrate", title: "Concentrate supply 2024–25", status: "active", start: "2024-10-01", end: "2025-09-30", price: 3050, incoterm: "FCA Riverside Mine", terms: 30, owner: "Zinhle Mahlangu", every: 3, tonnes: 4500, point: "Riverside Mine loading bay", performance: 0.96 },
  { id: "ag-43", number: "AGR-0043", clientId: "cl-03", commodity: "Chrome concentrate", title: "Trading allocation 2024–25", status: "active", start: "2024-06-01", end: "2025-05-31", price: 3100, incoterm: "FCA Riverside Mine", terms: 30, owner: "John Dlamini", every: 1, tonnes: 1200, point: "Riverside Mine loading bay", performance: 0.93 },
  { id: "ag-42", number: "AGR-0042", clientId: "cl-08", commodity: "Coal", title: "Coal trading allocation", status: "active", start: "2024-11-01", end: "2025-10-31", price: 1120, incoterm: "FCA Riverside Mine", terms: 30, owner: "Zinhle Mahlangu", every: 1, tonnes: 1000, point: "Riverside Mine loading bay", performance: 0.52 },
  { id: "ag-41", number: "AGR-0041", clientId: "cl-06", commodity: "Chrome lumpy ore", title: "Lumpy ore export allocation", status: "active", start: "2024-09-01", end: "2025-08-31", price: 2450, incoterm: "FCA Riverside Mine", terms: 30, owner: "Zinhle Mahlangu", every: 3, tonnes: 3600, point: "Durban Bulk Terminal", performance: 0.98 },
  { id: "ag-40", number: "AGR-0040", clientId: "cl-05", commodity: "Chrome concentrate", title: "Concentrate spot contract 2024", status: "completed", start: "2024-04-01", end: "2024-12-31", price: 2980, incoterm: "FCA Riverside Mine", terms: 30, owner: "John Dlamini", every: 3, tonnes: 1800, point: "Riverside Mine loading bay", performance: 1 },
];

const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
const monthName = (year: number, month: number) => new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function periodsOf(plan: Plan) {
  const [startYear, startMonth] = plan.start.split("-").map(Number);
  const periods: { label: string; due: string }[] = [];
  let year = startYear;
  let month = startMonth - 1;
  while (monthEnd(year, month) <= plan.end) {
    const lastMonth = month + plan.every - 1;
    const due = monthEnd(year + Math.floor(lastMonth / 12), lastMonth % 12);
    periods.push({ label: plan.every === 1 ? `${monthName(year, month)} tranche` : `${monthName(year, month)} quarter`, due });
    month += plan.every;
    year += Math.floor(month / 12);
    month %= 12;
  }
  return periods;
}

export const seedAgreements: Agreement[] = [];
export const seedDeliveries: Delivery[] = [];
export const seedSettlements: Settlement[] = [];

let deliveryNumber = 200;
let settlementNumber = 280;
let invoiceNumber = 10400;
const nextDelivery = () => `DEL-${String(++deliveryNumber).padStart(4, "0")}`;
const nextSettlement = () => ({ number: `SET-${String(++settlementNumber).padStart(4, "0")}`, invoiceNumber: `INV-${++invoiceNumber}` });

/** Invoice adjustments for particular agreements' most recent past invoices, so the ledger shows each settlement state once. */
const ledgerTwists: Record<string, "overdue" | "partial" | "disputed"> = { "ag-42": "overdue", "ag-44": "partial", "ag-43": "disputed" };

for (const plan of plans) {
  const commitments: Commitment[] = periodsOf(plan).map((period, index) => ({ id: `${plan.id}-c${index + 1}`, label: period.label, tonnes: plan.tonnes, dueDate: period.due, deliveryPoint: plan.point }));
  const agreement: Agreement = {
    id: plan.id, number: plan.number, clientId: plan.clientId, commodity: plan.commodity, title: plan.title, status: plan.status,
    startDate: plan.start, endDate: plan.end, pricePerTonne: plan.price, incoterm: plan.incoterm, paymentTermsDays: plan.terms, owner: plan.owner,
    enquiryId: null, approvalId: null, commitments, amendments: [], version: 1,
    history: [ev(addDays(plan.start, -20), plan.owner, "Agreement drafted"), ev(addDays(plan.start, -10), "John Dlamini", "Approved and made active"), ...(plan.status === "completed" ? [ev(addDays(plan.end, 15), plan.owner, "Marked completed", "All commitments accepted and settled.")] : [])],
  };
  seedAgreements.push(agreement);

  // Past periods: two deliveries each, dispatched, received and accepted, then one invoice for the accepted tonnes.
  const past = commitments.filter((commitment) => commitment.dueDate < "2025-04-01");
  past.forEach((commitment, index) => {
    const accepted = Math.round((commitment.tonnes * plan.performance) / 10) * 10;
    const halves = [Math.round(accepted / 20) * 10, accepted - Math.round(accepted / 20) * 10];
    const ids: string[] = [];
    halves.forEach((tonnes, half) => {
      const scheduled = addDays(commitment.dueDate, half === 0 ? -16 : -3);
      // Most loads arrive the next day; every fifth one was held up on the road.
      const received = addDays(scheduled, (index * 2 + half) % 5 === 4 ? 3 : 1);
      const id = `${plan.id}-d${index + 1}${half ? "b" : "a"}`;
      ids.push(id);
      seedDeliveries.push({
        id, number: nextDelivery(), agreementId: plan.id, commitmentId: commitment.id, tonnes: Math.round(commitment.tonnes / 2), scheduledDate: scheduled, destination: plan.point,
        shipmentId: null, operations: { dispatched: tonnes, dispatchedAt: at(scheduled, "10:00"), received: tonnes, receivedAt: at(received, "08:30"), source: "Mining Operations dispatch record (archived)" },
        acceptance: { tonnes, at: at(addDays(received, 1), "11:00"), by: plan.owner, note: "Weighbridge and quality accepted." }, discrepancy: null, cancelled: null, version: 3,
        history: [ev(addDays(scheduled, -7), plan.owner, "Delivery planned"), ev(scheduled, "Naledi Khoza", `${tonnes.toLocaleString("en-GB")} t dispatched (Mining Operations)`, null, "10:00"), ev(received, "Naledi Khoza", `${tonnes.toLocaleString("en-GB")} t received`, null, "08:30"), ev(addDays(received, 1), plan.owner, `${tonnes.toLocaleString("en-GB")} t accepted by the customer`, null, "11:00")],
      });
    });
    const issued = addDays(commitment.dueDate, 3);
    const due = addDays(issued, plan.terms);
    const amount = accepted * plan.price;
    // The second most recent invoice is the one whose due date has passed, so the twist lands on it.
    const twist = index === past.length - 2 ? ledgerTwists[plan.id] : undefined;
    const settled = due < "2025-04-24" || twist === "partial";
    const payments = twist === "overdue" || twist === "disputed" || !settled ? [] : [{ id: `pay-${plan.id}-${index + 1}`, at: at(addDays(due, -2), "14:00"), amount: twist === "partial" ? Math.round(amount * 0.6) : amount, reference: `EFT ${plan.clientId.toUpperCase()}-${index + 1}`, by: "Zinhle Mahlangu" }];
    const numbers = nextSettlement();
    seedSettlements.push({
      id: `${plan.id}-s${index + 1}`, ...numbers, agreementId: plan.id, deliveryIds: ids, tonnes: accepted, amount, issuedAt: issued, dueDate: due, payments,
      dispute: twist === "disputed" ? { amount: Math.round(amount * 0.08), reason: "Customer reports moisture above the agreed limit on the second load.", at: at("2025-04-15", "10:20"), by: "Zinhle Mahlangu", resolved: false, resolution: null } : null,
      version: 1, history: [ev(issued, "Zinhle Mahlangu", `Invoice ${numbers.invoiceNumber} issued for ${accepted.toLocaleString("en-GB")} t`), ...payments.map((payment) => ev(payment.at.slice(0, 10), payment.by, `Payment of R ${payment.amount.toLocaleString("en-GB")} recorded`, payment.reference, "14:00"))],
    });
  });
}

// ---- The current month, written out ---------------------------------------------------------------------------------------

const planned = (id: string, agreementId: string, commitmentId: string, tonnes: number, date: string, destination: string, shipmentId: string | null, owner = "Zinhle Mahlangu"): Delivery => ({
  id, number: nextDelivery(), agreementId, commitmentId, tonnes, scheduledDate: date, destination, shipmentId, operations: null, acceptance: null, discrepancy: null, cancelled: null, version: 1,
  history: [ev(addDays(date, -6), owner, "Delivery planned")],
});

const april = (agreementId: string) => seedAgreements.find((item) => item.id === agreementId)!.commitments.find((item) => item.dueDate.startsWith("2025-04"))!.id;

// Bayside Metals: the April tranche is the same chrome concentrate shipments Mining Operations is moving (SHP-0043 to SHP-0047).
{
  const commitment = april("ag-47");
  const cancelled = planned("ag-47-apr-43", "ag-47", commitment, 350, "2025-04-21", "Richards Bay Terminal", "ship-43");
  cancelled.cancelled = { reason: "The customer postponed the order; Mining Operations cancelled SHP-0043 before dispatch.", at: at("2025-04-21", "07:05"), by: "John Dlamini" };
  cancelled.history.push(ev("2025-04-21", "John Dlamini", "Delivery cancelled", cancelled.cancelled.reason, "07:05"));
  const first = planned("ag-47-apr-44", "ag-47", commitment, 450, "2025-04-21", "Richards Bay Terminal", "ship-44");
  first.acceptance = { tonnes: 450, at: at("2025-04-23", "10:00"), by: "Zinhle Mahlangu", note: "Weighbridge and grade certificate accepted." };
  first.history.push(ev("2025-04-23", "Zinhle Mahlangu", "450 t accepted by the customer", null, "10:00"));
  seedDeliveries.push(
    cancelled,
    first,
    planned("ag-47-apr-45", "ag-47", commitment, 600, "2025-04-22", "Richards Bay Terminal", "ship-45"),
    planned("ag-47-apr-46", "ag-47", commitment, 500, "2025-04-25", "Richards Bay Terminal", "ship-46"),
    planned("ag-47-apr-47", "ag-47", commitment, 400, "2025-04-24", "Richards Bay Terminal", "ship-47"),
  );
  // A top-up commitment added by amendment: the Germiston stockyard load (SHP-0048).
  const agreement = seedAgreements.find((item) => item.id === "ag-47")!;
  const topUp: Commitment = { id: "ag-47-topup", label: "Germiston stockyard top-up", tonnes: 300, dueDate: "2025-04-30", deliveryPoint: "Customer Stockyard A, Germiston" };
  agreement.commitments.splice(agreement.commitments.findIndex((item) => item.id === commitment) + 1, 0, topUp);
  agreement.amendments.push({ id: "am-47-1", at: at("2025-04-17", "15:00"), actor: "Zinhle Mahlangu", summary: "Added 300 t top-up to Customer Stockyard A, Germiston", kind: "add_commitment", detail: { commitment: topUp }, status: "approved", approvalId: "apr-094" });
  agreement.history.push(ev("2025-04-17", "Zinhle Mahlangu", "Amendment approved: 300 t top-up added", null, "15:00"));
  seedDeliveries.push(planned("ag-47-apr-48", "ag-47", "ag-47-topup", 300, "2025-04-26", "Customer Stockyard A, Germiston", "ship-48"));
}

// Horizon Metals: one April load is on the road (recorded before shipments were linked), the rest is planned.
{
  const commitment = april("ag-46");
  const onRoad = planned("ag-46-apr-1", "ag-46", commitment, 800, "2025-04-23", "Horizon Metals, Middelburg", null);
  onRoad.operations = { dispatched: 780, dispatchedAt: at("2025-04-23", "13:40"), received: 0, receivedAt: null, source: "Weighbridge ticket WB-22871 (Mining Operations)" };
  onRoad.history.push(ev("2025-04-23", "Naledi Khoza", "780 t dispatched (Mining Operations)", null, "13:40"));
  seedDeliveries.push(onRoad, planned("ag-46-apr-2", "ag-46", commitment, 700, "2025-04-29", "Horizon Metals, Middelburg", null));
}

// Highveld Power: behind on coal; the April load is SHP-0051, still being prepared.
{
  const commitment = april("ag-45");
  const early = planned("ag-45-apr-1", "ag-45", commitment, 1200, "2025-04-10", "Highveld Power coal yard, Secunda", null, "John Dlamini");
  early.operations = { dispatched: 1180, dispatchedAt: at("2025-04-10", "09:30"), received: 1180, receivedAt: at("2025-04-11", "07:10"), source: "Mining Operations dispatch record (archived)" };
  early.acceptance = { tonnes: 1120, at: at("2025-04-12", "09:00"), by: "John Dlamini", note: "60 t rejected for ash content." };
  early.discrepancy = { tonnes: 60, reason: "Ash content above specification on one load; customer rejected 60 t.", at: at("2025-04-12", "09:00"), by: "John Dlamini", resolution: "Accepted 1,120 t; 60 t to be replaced in the next load." };
  early.history.push(ev("2025-04-11", "Naledi Khoza", "1,180 t received", null, "07:10"), ev("2025-04-12", "John Dlamini", "1,120 t accepted; 60 t rejected", "Ash content above specification.", "09:00"));
  seedDeliveries.push(early, planned("ag-45-apr-51", "ag-45", commitment, 300, "2025-04-27", "Highveld Power coal yard, Secunda", "ship-51", "John Dlamini"), planned("ag-45-apr-2", "ag-45", commitment, 1500, "2025-04-30", "Highveld Power coal yard, Secunda", null, "John Dlamini"));
}

// The other active agreements: one planned delivery each in the coming days.
seedDeliveries.push(
  planned("ag-43-apr-1", "ag-43", april("ag-43"), 1200, "2025-04-28", "Riverside Mine loading bay", null, "John Dlamini"),
  planned("ag-42-apr-1", "ag-42", april("ag-42"), 1000, "2025-04-22", "Riverside Mine loading bay", null),
  planned("ag-44-q2-1", "ag-44", seedAgreements.find((item) => item.id === "ag-44")!.commitments.find((item) => item.dueDate === "2025-06-30")!.id, 2200, "2025-05-06", "Riverside Mine loading bay", null),
  planned("ag-41-q2-1", "ag-41", seedAgreements.find((item) => item.id === "ag-41")!.commitments.find((item) => item.dueDate === "2025-05-31")!.id, 1800, "2025-05-08", "Durban Bulk Terminal", null),
);

// Number deliveries and invoices in date order, as they would have been issued.
seedDeliveries.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id)).forEach((item, index) => { item.number = `DEL-${String(201 + index).padStart(4, "0")}`; });
deliveryNumber = 200 + seedDeliveries.length;
seedSettlements.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id)).forEach((item, index) => {
  const previous = item.invoiceNumber;
  item.number = `SET-${String(281 + index).padStart(4, "0")}`;
  item.invoiceNumber = `INV-${10401 + index}`;
  item.history = item.history.map((line) => ({ ...line, summary: line.summary.replace(previous, item.invoiceNumber) }));
});

// Two agreements that are not active yet: one drafted from a won enquiry, one waiting for approval.
seedAgreements.push(
  {
    id: "ag-48", number: "AGR-0048", clientId: "cl-10", commodity: "Coal", title: "Industrial coal supply 2025", status: "draft", startDate: "2025-06-01", endDate: "2026-05-31",
    pricePerTonne: 1210, incoterm: "FCA Riverside Mine", paymentTermsDays: 30, owner: "Zinhle Mahlangu", enquiryId: "enq-100", approvalId: null,
    commitments: [{ id: "ag-48-c1", label: "Jun 2025 tranche", tonnes: 500, dueDate: "2025-06-30", deliveryPoint: "Riverside Mine loading bay" }, { id: "ag-48-c2", label: "Jul 2025 tranche", tonnes: 500, dueDate: "2025-07-31", deliveryPoint: "Riverside Mine loading bay" }],
    amendments: [], version: 1, history: [ev("2025-04-18", "Zinhle Mahlangu", "Agreement drafted from enquiry ENQ-0100")],
  },
  {
    id: "ag-49", number: "AGR-0049", clientId: "cl-02", commodity: "Chrome concentrate", title: "Concentrate supply H2 2025", status: "pending_approval", startDate: "2025-07-01", endDate: "2025-12-31",
    pricePerTonne: 3200, incoterm: "DAP Middelburg works", paymentTermsDays: 45, owner: "Zinhle Mahlangu", enquiryId: "enq-099", approvalId: "apr-101",
    commitments: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => ({ id: `ag-49-c${index + 1}`, label: `${month} 2025 tranche`, tonnes: 600, dueDate: monthEnd(2025, 6 + index), deliveryPoint: "Horizon Metals, Middelburg" })),
    amendments: [], version: 2, history: [ev("2025-04-16", "Zinhle Mahlangu", "Agreement drafted from enquiry ENQ-0099"), ev("2025-04-22", "Zinhle Mahlangu", "Sent for approval", null, "16:10")],
  },
);

// A pending amendment on Horizon Metals: an extra 500 t in May.
{
  const agreement = seedAgreements.find((item) => item.id === "ag-46")!;
  agreement.amendments.push({ id: "am-46-1", at: at("2025-04-23", "11:30"), actor: "Zinhle Mahlangu", summary: "Add 500 t extra in May 2025", kind: "add_commitment", detail: { commitment: { id: "ag-46-extra-may", label: "May 2025 extra", tonnes: 500, dueDate: "2025-05-31", deliveryPoint: "Horizon Metals, Middelburg" } }, status: "pending", approvalId: "apr-103" });
}

// ---- Enquiries ---------------------------------------------------------------------------------------------------------

const enquiry = (seed: Omit<Enquiry, "version" | "history" | "quotationApprovalId" | "lostReason" | "agreementId" | "quotationRef" | "nextAction" | "nextActionDate" | "pricePerTonne"> & Partial<Enquiry>): Enquiry => ({
  pricePerTonne: null, quotationRef: null, quotationApprovalId: null, nextAction: null, nextActionDate: null, lostReason: null, agreementId: null, version: 1,
  history: [ev(seed.receivedAt.slice(0, 10), seed.owner, "Enquiry received")],
  ...seed,
});

export const seedEnquiries: Enquiry[] = [
  enquiry({ id: "enq-105", number: "ENQ-0105", clientId: "cl-10", commodity: "Coal", tonnes: 1200, deliveryWindow: "Jun 2025", stage: "new", owner: "Zinhle Mahlangu", receivedAt: at("2025-04-23", "15:20"), nextAction: "Qualify volumes and credit", nextActionDate: "2025-04-25" }),
  enquiry({ id: "enq-104", number: "ENQ-0104", clientId: "cl-02", commodity: "Chrome concentrate", tonnes: 3000, deliveryWindow: "Q3 2025", stage: "qualified", owner: "John Dlamini", receivedAt: at("2025-04-14", "10:00"), pricePerTonne: 3200, quotationRef: "QTN-0104", quotationApprovalId: "apr-102", nextAction: "Quotation waiting for finance approval", nextActionDate: "2025-04-25" }),
  enquiry({ id: "enq-103", number: "ENQ-0103", clientId: "cl-03", commodity: "Chrome concentrate", tonnes: 6000, deliveryWindow: "Jun 2025 – May 2026", stage: "quotation_sent", owner: "John Dlamini", receivedAt: at("2025-04-02", "09:15"), pricePerTonne: 3180, quotationRef: "QTN-0103", nextAction: "Follow up on renewal of AGR-0043", nextActionDate: "2025-04-26" }),
  enquiry({ id: "enq-102", number: "ENQ-0102", clientId: "cl-06", commodity: "Chrome lumpy ore", tonnes: 2500, deliveryWindow: "Jul 2025", stage: "negotiation", owner: "Zinhle Mahlangu", receivedAt: at("2025-03-27", "11:00"), pricePerTonne: 2520, quotationRef: "QTN-0102", nextAction: "Commercial call on price and grade", nextActionDate: "2025-04-28" }),
  enquiry({ id: "enq-101", number: "ENQ-0101", clientId: "cl-04", commodity: "Chrome concentrate", tonnes: 1800, deliveryWindow: "Pending", stage: "new", owner: "Zinhle Mahlangu", receivedAt: at("2025-04-22", "08:40"), nextAction: "Confirm grade and delivery point", nextActionDate: "2025-04-25" }),
  enquiry({ id: "enq-100", number: "ENQ-0100", clientId: "cl-10", commodity: "Coal", tonnes: 6000, deliveryWindow: "Jun 2025 – May 2026", stage: "won", owner: "Zinhle Mahlangu", receivedAt: at("2025-03-31", "09:00"), pricePerTonne: 1210, quotationRef: "QTN-0100", agreementId: "ag-48" }),
  enquiry({ id: "enq-099", number: "ENQ-0099", clientId: "cl-02", commodity: "Chrome concentrate", tonnes: 3600, deliveryWindow: "Jul – Dec 2025", stage: "won", owner: "Zinhle Mahlangu", receivedAt: at("2025-03-20", "14:00"), pricePerTonne: 3200, quotationRef: "QTN-0099", agreementId: "ag-49" }),
  enquiry({ id: "enq-098", number: "ENQ-0098", clientId: "cl-09", commodity: "Chrome concentrate", tonnes: 2200, deliveryWindow: "May 2025", stage: "lost", owner: "John Dlamini", receivedAt: at("2025-03-10", "10:30"), pricePerTonne: 3250, quotationRef: "QTN-0098", lostReason: "The buyer chose a lower-grade supplier on price." }),
];

// ---- Approvals ---------------------------------------------------------------------------------------------------------

const approval = (seed: Omit<Approval, "version" | "decidedBy" | "decidedAt" | "note"> & Partial<Approval>): Approval => ({ decidedBy: null, decidedAt: null, note: null, version: 1, ...seed });

export const seedApprovals: Approval[] = [
  approval({ id: "apr-103", number: "APP-0103", type: "amendment", subjectId: "ag-46", subjectNumber: "AGR-0046", description: "Amendment: add 500 t extra in May 2025", clientId: "cl-02", value: 500 * 2480, submittedBy: "Zinhle Mahlangu", submittedAt: at("2025-04-23", "11:30"), approverRole: "Mine Manager", status: "pending" }),
  approval({ id: "apr-102", number: "APP-0102", type: "quotation", subjectId: "enq-104", subjectNumber: "ENQ-0104", description: "Quotation QTN-0104: 3,000 t chrome concentrate at R 3,200/t", clientId: "cl-02", value: 3000 * 3200, submittedBy: "John Dlamini", submittedAt: at("2025-04-22", "17:05"), approverRole: "Commercial / Finance Officer", status: "pending" }),
  approval({ id: "apr-101", number: "APP-0101", type: "agreement", subjectId: "ag-49", subjectNumber: "AGR-0049", description: "New agreement: concentrate supply H2 2025 (3,600 t)", clientId: "cl-02", value: 3600 * 3200, submittedBy: "Zinhle Mahlangu", submittedAt: at("2025-04-22", "16:10"), approverRole: "Mine Manager", status: "pending" }),
  approval({ id: "apr-100", number: "APP-0100", type: "delivery", subjectId: "ag-42-apr-1", subjectNumber: "DEL-0000", description: "Release April coal delivery to a client on hold", clientId: "cl-08", value: 1000 * 1120, submittedBy: "Naledi Khoza", submittedAt: at("2025-04-21", "09:40"), approverRole: "Mine Manager", status: "pending" }),
  approval({ id: "apr-097", number: "APP-0097", type: "settlement", subjectId: "ag-41-s2", subjectNumber: "SET-0000", description: "Early-payment discount of 1% on settlement", clientId: "cl-06", value: 85000, submittedBy: "Zinhle Mahlangu", submittedAt: at("2025-03-18", "10:00"), approverRole: "Mine Manager", status: "rejected", decidedBy: "John Dlamini", decidedAt: at("2025-03-19", "08:15"), note: "Not within the agreed terms." }),
  approval({ id: "apr-094", number: "APP-0094", type: "amendment", subjectId: "ag-47", subjectNumber: "AGR-0047", description: "Amendment: 300 t top-up to Customer Stockyard A, Germiston", clientId: "cl-01", value: 300 * 3150, submittedBy: "Zinhle Mahlangu", submittedAt: at("2025-04-16", "12:00"), approverRole: "Mine Manager", status: "approved", decidedBy: "John Dlamini", decidedAt: at("2025-04-17", "15:00") }),
  approval({ id: "apr-090", number: "APP-0090", type: "agreement", subjectId: "ag-46", subjectNumber: "AGR-0046", description: "New agreement: lumpy ore supply 2025–26", clientId: "cl-02", value: 12 * 1500 * 2480, submittedBy: "Zinhle Mahlangu", submittedAt: at("2025-02-14", "09:00"), approverRole: "Mine Manager", status: "approved", decidedBy: "John Dlamini", decidedAt: at("2025-02-15", "10:30") }),
];
// The delivery and settlement numbers are only known once the generated records exist.
for (const item of seedApprovals) {
  if (item.type === "delivery") item.subjectNumber = seedDeliveries.find((delivery) => delivery.id === item.subjectId)!.number;
  if (item.type === "settlement") item.subjectNumber = seedSettlements.find((settlement) => settlement.id === item.subjectId)!.number;
}
seedEnquiries.find((item) => item.id === "enq-104")!.history.push(ev("2025-04-22", "John Dlamini", "Quotation QTN-0104 prepared and sent for approval", null, "17:05"));

// ---- Documents ---------------------------------------------------------------------------------------------------------

let documentCounter = 0;
const doc = (seed: Omit<TradeDocument, "id" | "version">): TradeDocument => ({ id: `doc-${String(++documentCounter).padStart(3, "0")}`, version: 1, ...seed });
const clientOf = (agreementId: string) => seedAgreements.find((item) => item.id === agreementId)!.clientId;
const deliveryNo = (id: string) => seedDeliveries.find((item) => item.id === id)!.number;

export const seedDocuments: TradeDocument[] = [
  ...seedAgreements.filter((item) => item.status !== "draft").map((item) => doc({ name: `Supply Agreement – ${item.number}.pdf`, folder: "agreements", kind: "Agreement", reference: item.number, clientId: item.clientId, sizeBytes: 3_800_000 - Number(item.number.slice(-2)) * 21_000, uploadedBy: item.owner, uploadedAt: at(addDays(item.startDate, -8), "12:00"), status: item.status === "pending_approval" ? "pending_review" : "approved", expiresOn: item.endDate, confidential: true })),
  doc({ name: "Amendment – Germiston top-up.pdf", folder: "agreements", kind: "Amendment", reference: "AGR-0047", clientId: "cl-01", sizeBytes: 1_200_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2025-04-17", "15:10"), status: "approved", expiresOn: null, confidential: true }),
  doc({ name: "Delivery Note (POD) – SHP-0044.pdf", folder: "deliveries", kind: "Proof of delivery", reference: deliveryNo("ag-47-apr-44"), clientId: "cl-01", sizeBytes: 640_000, uploadedBy: "Naledi Khoza", uploadedAt: at("2025-04-22", "17:20"), status: "final", expiresOn: null, confidential: false }),
  doc({ name: "Weighbridge Report – SHP-0044.pdf", folder: "deliveries", kind: "Weighbridge ticket", reference: deliveryNo("ag-47-apr-44"), clientId: "cl-01", sizeBytes: 220_000, uploadedBy: "Naledi Khoza", uploadedAt: at("2025-04-22", "17:22"), status: "final", expiresOn: null, confidential: false }),
  doc({ name: "Quality Certificate – Cr2O3 April lot 3.pdf", folder: "operations", kind: "Quality certificate", reference: deliveryNo("ag-47-apr-44"), clientId: "cl-01", sizeBytes: 310_000, uploadedBy: "Naledi Khoza", uploadedAt: at("2025-04-21", "15:00"), status: "final", expiresOn: null, confidential: false }),
  doc({ name: "Delivery Note (POD) – SHP-0045.pdf", folder: "deliveries", kind: "Proof of delivery", reference: deliveryNo("ag-47-apr-45"), clientId: "cl-01", sizeBytes: 610_000, uploadedBy: "Naledi Khoza", uploadedAt: at("2025-04-23", "08:40"), status: "final", expiresOn: null, confidential: false }),
  doc({ name: "Ash content report – April load 1.pdf", folder: "operations", kind: "Quality certificate", reference: deliveryNo("ag-45-apr-1"), clientId: "cl-07", sizeBytes: 280_000, uploadedBy: "John Dlamini", uploadedAt: at("2025-04-12", "09:10"), status: "final", expiresOn: null, confidential: false }),
  ...seedSettlements.slice(-6).map((item) => doc({ name: `Invoice – ${item.invoiceNumber}.pdf`, folder: "settlements", kind: "Invoice", reference: item.invoiceNumber, clientId: clientOf(item.agreementId), sizeBytes: 160_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at(item.issuedAt, "16:00"), status: "final", expiresOn: null, confidential: true })),
  doc({ name: "Settlement Statement – March 2025.xlsx", folder: "settlements", kind: "Statement", reference: "Mar 2025", clientId: null, sizeBytes: 2_100_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2025-04-04", "10:00"), status: "final", expiresOn: null, confidential: true }),
  doc({ name: "Quotation – QTN-0103.pdf", folder: "enquiries", kind: "Quotation", reference: "ENQ-0103", clientId: "cl-03", sizeBytes: 420_000, uploadedBy: "John Dlamini", uploadedAt: at("2025-04-08", "11:00"), status: "final", expiresOn: "2025-05-08", confidential: true }),
  doc({ name: "Quotation – QTN-0104 (draft).pdf", folder: "enquiries", kind: "Quotation", reference: "ENQ-0104", clientId: "cl-02", sizeBytes: 400_000, uploadedBy: "John Dlamini", uploadedAt: at("2025-04-22", "17:00"), status: "pending_review", expiresOn: null, confidential: true }),
  doc({ name: "KYC pack – Northline Metals.pdf", folder: "compliance", kind: "KYC pack", reference: "NLM", clientId: "cl-10", sizeBytes: 5_400_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2024-04-29", "09:00"), status: "approved", expiresOn: "2025-04-29", confidential: false }),
  doc({ name: "BEE certificate – Global Alloy Traders.pdf", folder: "compliance", kind: "BEE certificate", reference: "GAT", clientId: "cl-06", sizeBytes: 900_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2024-05-12", "09:00"), status: "approved", expiresOn: "2025-05-12", confidential: false }),
  doc({ name: "Tax clearance – Bayside Metals.pdf", folder: "compliance", kind: "Tax clearance", reference: "BAY", clientId: "cl-01", sizeBytes: 450_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2025-01-10", "09:00"), status: "approved", expiresOn: "2026-01-10", confidential: false }),
  doc({ name: "KYC pack – Kalahari Minerals.pdf", folder: "compliance", kind: "KYC pack", reference: "KAL", clientId: "cl-08", sizeBytes: 4_900_000, uploadedBy: "Zinhle Mahlangu", uploadedAt: at("2024-11-01", "09:00"), status: "approved", expiresOn: "2025-11-01", confidential: false }),
];

// ---- Links to Mining Operations work ----------------------------------------------------------------------------------

export const seedLinks: OperationLink[] = [
  { id: "lop-16", number: "LOP-016", agreementId: "ag-47", commitmentId: april("ag-47"), workstream: "Chrome concentrate loading – Richards Bay tranche", areaId: "area-crusher-line", shiftId: "shift-a-20250424", shipmentIds: ["ship-44", "ship-45", "ship-46", "ship-47"], createdBy: "Zinhle Mahlangu", createdAt: at("2025-04-14", "08:00"), note: "Crusher C-02 output feeds the finished stockpile for this tranche.", removed: false },
  { id: "lop-15", number: "LOP-015", agreementId: "ag-47", commitmentId: "ag-47-topup", workstream: "Germiston top-up load preparation", areaId: "area-rom-pad", shiftId: "shift-b-20250424", shipmentIds: ["ship-48"], createdBy: "Zinhle Mahlangu", createdAt: at("2025-04-17", "15:20"), note: "", removed: false },
  { id: "lop-14", number: "LOP-014", agreementId: "ag-45", commitmentId: april("ag-45"), workstream: "Coal load-out for Highveld Power", areaId: "area-south-pit", shiftId: null, shipmentIds: ["ship-51"], createdBy: "John Dlamini", createdAt: at("2025-04-15", "07:30"), note: "Replace the 60 t rejected in the first April load.", removed: false },
  { id: "lop-13", number: "LOP-013", agreementId: "ag-46", commitmentId: april("ag-46"), workstream: "Lumpy ore screening and stockpiling", areaId: "area-north-pit", shiftId: "shift-a-20250424", shipmentIds: [], createdBy: "Zinhle Mahlangu", createdAt: at("2025-04-10", "09:00"), note: "", removed: false },
  { id: "lop-12", number: "LOP-012", agreementId: "ag-44", commitmentId: seedAgreements.find((item) => item.id === "ag-44")!.commitments.find((item) => item.dueDate === "2025-06-30")!.id, workstream: "Q2 concentrate stockpile build", areaId: "area-central-pit", shiftId: null, shipmentIds: [], createdBy: "Zinhle Mahlangu", createdAt: at("2025-04-05", "10:00"), note: "", removed: false },
];

// ---- Reports -----------------------------------------------------------------------------------------------------------

export const seedReports: SavedReport[] = [
  { id: "rep-1", name: "Commercial performance summary", kind: "commercial_summary", frequency: "monthly", owner: "John Dlamini", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-24", "08:12"), standard: true },
  { id: "rep-2", name: "Agreement fulfilment report", kind: "agreement_fulfilment", frequency: "weekly", owner: "Zinhle Mahlangu", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-22", "17:46"), standard: true },
  { id: "rep-3", name: "Delivery variance report", kind: "delivery_variance", frequency: "weekly", owner: "Naledi Khoza", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-21", "09:30"), standard: true },
  { id: "rep-4", name: "Settlement ageing report", kind: "settlement_ageing", frequency: "weekly", owner: "Zinhle Mahlangu", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-21", "10:08"), standard: true },
  { id: "rep-5", name: "Logistics performance report", kind: "logistics_performance", frequency: "monthly", owner: "Naledi Khoza", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-17", "15:21"), standard: true },
  { id: "rep-6", name: "Operational exposure report", kind: "operational_exposure", frequency: "monthly", owner: "John Dlamini", createdAt: at("2025-01-05"), lastRunAt: at("2025-04-16", "11:37"), standard: true },
];

export const tradeCounters = { delivery: deliveryNumber, settlement: settlementNumber, invoice: invoiceNumber, enquiry: 105, agreement: 49, approval: 103, document: documentCounter, link: 16, report: 6, event: eventCounter, client: 10, contact: 0, payment: 0, quotation: 104 };
