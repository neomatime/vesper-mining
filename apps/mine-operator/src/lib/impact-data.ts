/**
 * Seed records for the Gold demonstration, all fictional and all on one timeline (24 April 2025):
 *   06:00  Crusher CR-01 stops with a motor drive failure
 *   08:47  now. The repair is waiting on a drive coupling that is on its way
 *   25 Apr 08:00  the gold delivery to Highveld Refiners is due
 * The records are ordinary VESPER records (equipment, an issue, a readiness activity) plus one scenario that links them to the
 * shift, the customer order and the delivery. The crusher is a gold plant crusher, so tonnes, grams and prices here never mix with
 * the chrome concentrate shipments, which are priced per tonne.
 */
import type { Equipment, OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import { primaryIssue } from "./demo-data";
import type { ImpactScenario } from "./impact-rules";

export const GOLD_EQUIPMENT_ID = "eq-cr01";
export const GOLD_ISSUE_ID = "issue-gold-001";
export const GOLD_ACTIVITY_ID = "readiness-cr01-coupling";

const at = (day: string, time: string) => `2025-04-${day}T${time}:00+02:00`;

export const goldEquipment: Equipment = {
  id: GOLD_EQUIPMENT_ID,
  siteId: "site-riverside",
  code: "CR-01",
  name: "Gold Plant Crusher CR-01",
  category: "crusher",
  makeModel: "Gold demonstration crusher",
  serialNumber: "CR01-20817",
  areaId: null,
  notes: "Part of the Gold demonstration. All figures are fictional.",
  state: "unavailable",
  stateNote: "Motor drive failure reported at 06:00.",
  stateQuality: "reported",
  stateUpdatedAt: at("24", "06:00"),
  hours: 2980,
  hoursReadAt: at("24", "05:30"),
  hoursSource: "Lebo Maseko",
  hoursPerDay: 20,
  plans: [],
  services: [],
  events: [
    { id: "eqev-cr01-1", type: "created", summary: "Added to the equipment register", actor: "Lebo Maseko", actorRole: "Maintenance Planner", occurredAt: "2025-02-03T09:00:00+02:00", note: null },
    { id: "eqev-cr01-2", type: "state_changed", state: "unavailable", reason: null, summary: "Reported unavailable: motor drive failure", actor: "Thabo Molefe", actorRole: "Field Employee", occurredAt: at("24", "06:00"), note: null },
  ],
  retiredAt: null,
  retiredReason: null,
  version: 1,
  createdAt: "2025-02-03T09:00:00+02:00",
};

export const goldIssue: OperationalIssue = {
  ...primaryIssue,
  id: GOLD_ISSUE_ID,
  issueNumber: "RIV-2025-042",
  title: "Crusher CR-01 — Motor Drive Failure",
  description: "The crusher has stopped. Crushed ore downstream can keep the plant running for a while. The repair is waiting for a replacement drive coupling.",
  equipmentId: GOLD_EQUIPMENT_ID,
  areaId: null,
  priority: "critical",
  workflowState: "awaiting_dependency",
  quality: "reported",
  operationalStatus: "at_risk",
  owner: "Lebo Maseko",
  reportedAt: at("24", "06:05"),
  updatedAt: at("24", "08:30"),
  source: { label: "Field report RIV-2025-042 (Gold demonstration)", observedAt: at("24", "06:05"), quality: "reported" },
  actions: [
    { id: "act-g1", title: "Isolate and lock out CR-01", owner: "Lebo Maseko", team: "Maintenance", state: "complete", dueAt: at("24", "06:30"), completedAt: at("24", "06:25"), removedAt: null },
    { id: "act-g2", title: "Replace the drive coupling", owner: "Lebo Maseko", team: "Maintenance", state: "in_progress", dueAt: at("24", "10:00"), completedAt: null, removedAt: null },
    { id: "act-g3", title: "Confirm the repair and restart", owner: "Lebo Maseko", team: "Maintenance", state: "pending", dueAt: null, completedAt: null, removedAt: null },
  ],
  dependencies: [
    { id: "dep-g1", reason: "The drive coupling is on its way. The repair cannot be finished until it arrives.", kind: "parts", blockedActionId: "act-g2", owner: "Naledi Khoza", state: "open", raisedAt: at("24", "06:40"), reviewBy: at("24", "10:00"), resolutionNote: null },
  ],
  comments: [],
  verifications: [],
  version: 1,
  resolutionReportedBy: null,
  events: [
    { id: "ev-g1", type: "reported", summary: "Issue reported from the field", actor: "Thabo Molefe", actorRole: "Field Employee", occurredAt: at("24", "06:05"), previousState: null, nextState: "reported", note: null },
    { id: "ev-g2", type: "dependency_added", summary: "Dependency identified: replacement drive coupling", actor: "Lebo Maseko", actorRole: "Maintenance Planner", occurredAt: at("24", "06:40"), previousState: null, nextState: null, note: null },
    { id: "ev-g3", type: "state_changed", summary: "Work is waiting on the drive coupling", actor: "Lebo Maseko", actorRole: "Maintenance Planner", occurredAt: at("24", "06:41"), previousState: "in_progress", nextState: "awaiting_dependency", note: null },
  ],
};

export const goldReadiness: ReadinessActivity = {
  id: GOLD_ACTIVITY_ID,
  siteId: "site-riverside",
  equipmentId: GOLD_EQUIPMENT_ID,
  title: "CR-01 — Drive coupling repair",
  scheduledFor: at("24", "10:00"),
  status: "review_inbound",
  quality: "reported",
  reviewState: "not_reviewed",
  parts: [
    { id: "part-cr01-coupling", name: "Drive coupling DC-CR01", required: 1, onHand: null, reserved: null, inbound: 1, leadTimeDays: 1, quality: "reported", confirmedBy: null, confirmedAt: null, sourceNote: "None is confirmed at the mine. The supplier says one leaves the depot at 09:30." },
  ],
  reviews: [],
};

export const seedImpactScenario: ImpactScenario = {
  id: "gold-demo",
  label: "Gold demonstration",
  equipmentId: GOLD_EQUIPMENT_ID,
  issueId: GOLD_ISSUE_ID,
  linkedIssueIds: [GOLD_ISSUE_ID],
  activityId: GOLD_ACTIVITY_ID,
  shiftId: "shift-a-20250424",
  shiftName: "Shift A",
  orderRef: "PO-G-1001",
  customer: "Highveld Refiners",
  shipmentNumber: "SHP-G-0001",
  commitmentGrams: 1000,
  deliveryDeadline: at("25", "08:00"),
  breakdownStartedAt: at("24", "06:00"),
  outageHours: 4,
  usableStockTonnes: 250,
  catchUpTonnes: 50,
  recoveredGrams: 0,
  repairCompletedAt: null,
  actualOutageHours: null,
  responsible: "Lebo Maseko",
  safetyNote: "The crusher stays locked out until the repair is checked. This comes before any delivery date and is not weighed against value.",
  updatedAt: at("24", "08:30"),
  updatedBy: "Lebo Maseko",
};
