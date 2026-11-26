/**
 * "What happens if we wait?": how an operational problem becomes a forecast and an estimated sales value, for the Gold demonstration.
 *
 * One shared calculation (calculateImpact) turns three things (how long the crusher is out, how much usable stock sits downstream,
 * and what catch-up has been approved) into the ore shortfall, the gold affected, the forecast for the delivery and the estimated sales
 * value potentially delayed. Every screen reads that one result, so they cannot disagree.
 *
 * What this is not: a forecast is not verified production or physical inventory, an estimated sales value is not a confirmed loss,
 * and a better forecast does not approve a partial shipment or release anything for dispatch. All figures are fictional.
 */
import type { Actor, Check } from "./issue-rules";

// ---- The Gold demonstration's fixed assumptions (all fictional) -----------------------------------------------------------

export const GOLD = {
  label: "Gold delivery",
  /** Gold the customer has been promised for this delivery, in grams. This commitment never changes with a forecast. */
  requiredGrams: 1000,
  /** What was expected before the breakdown. */
  baselineForecastGrams: 1000,
  plannedRateTph: 100,
  gradeGramsPerTonne: 2,
  /** Share of the gold in the ore that processing recovers. */
  recovery: 0.9,
  pricePerGram: 1000,
  currency: "ZAR",
} as const;

/** What was promised, in rand: 1,000 g at R1,000 per gram. It is the commitment's value and does not move with the forecast. */
export const plannedSalesValue = GOLD.requiredGrams * GOLD.pricePerGram;

/** The three outage lengths the demonstration offers, in total hours from the same breakdown start time. */
export const outageScenarios = [2, 4, 6] as const;

// ---- The calculation ---------------------------------------------------------------------------------------------------

export type ImpactInputs = {
  /** Total outage in hours, measured from the breakdown start. Null when nobody has estimated it. */
  outageHours: number | null;
  /** Crushed ore downstream of the crusher that can keep processing running. Null when not known. */
  usableStockTonnes: number | null;
  /** Extra processing before the deadline that has been approved. Null counts as none approved. */
  catchUpTonnes: number | null;
  /** Gold recorded as produced since the breakdown towards the shortfall (recorded progress, not verified stock). */
  recoveredGrams: number;
};

export type ImpactResult = {
  /** False when a required input is missing. Then nothing below is shown as a number. */
  assessed: boolean;
  missing: string[];
  /** How long usable stock plus approved catch-up keeps processing running. */
  stockCoverHours: number | null;
  oreShortfallTonnes: number | null;
  /** Gold the outage puts at risk, capped at what is still required. Before any recovery. */
  goldAffectedGrams: number | null;
  /** What is still short after recorded recovery. */
  remainingShortfallGrams: number | null;
  forecastGrams: number | null;
  /** Estimated sales value potentially delayed. Not a loss, not a cost and not profit. */
  valueDelayed: number | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * ore shortfall = max(0, rate x outage hours - usable stock - approved catch-up)
 * gold affected = min(gold still required, ore shortfall x gold content x recovery)
 * forecast      = max(0, baseline forecast - gold still short)
 * value delayed = gold still short x price per gram
 * With 2, 4 and 6 hours these give 0 g, 180 g and 540 g affected, forecasts of 1,000 g, 820 g and 460 g, and R0, R180,000 and R540,000.
 */
export function calculateImpact(inputs: ImpactInputs): ImpactResult {
  const missing: string[] = [];
  if (inputs.outageHours === null) missing.push("the expected outage length");
  if (inputs.usableStockTonnes === null) missing.push("the usable stock downstream of the crusher");
  if (missing.length > 0) {
    return { assessed: false, missing, stockCoverHours: null, oreShortfallTonnes: null, goldAffectedGrams: null, remainingShortfallGrams: null, forecastGrams: null, valueDelayed: null };
  }
  const catchUp = inputs.catchUpTonnes ?? 0;
  const stock = inputs.usableStockTonnes as number;
  const hours = inputs.outageHours as number;
  const shortfall = Math.max(0, GOLD.plannedRateTph * hours - stock - catchUp);
  const affected = round(Math.min(GOLD.requiredGrams, shortfall * GOLD.gradeGramsPerTonne * GOLD.recovery));
  const remaining = round(Math.max(0, affected - Math.max(0, inputs.recoveredGrams)));
  return {
    assessed: true,
    missing,
    stockCoverHours: round((stock + catchUp) / GOLD.plannedRateTph),
    oreShortfallTonnes: round(shortfall),
    goldAffectedGrams: affected,
    remainingShortfallGrams: remaining,
    forecastGrams: round(Math.max(0, GOLD.baselineForecastGrams - remaining)),
    valueDelayed: Math.round(remaining * GOLD.pricePerGram),
  };
}

/**
 * The same affected output is counted once, however many issues affect it: totals are by scenario, not by issue.
 * (Two issues on the same delivery share one scenario, so they share one figure.)
 */
export function totalValueDelayed(impacts: { scenarioId: string; valueDelayed: number | null }[]): number {
  const seen = new Map<string, number>();
  for (const item of impacts) if (item.valueDelayed !== null && !seen.has(item.scenarioId)) seen.set(item.scenarioId, item.valueDelayed);
  return [...seen.values()].reduce((total, value) => total + value, 0);
}

// ---- Words -------------------------------------------------------------------------------------------------------------

export const formatGrams = (value: number) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)} g`;
export const formatHours = (value: number) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)} ${value === 1 ? "hour" : "hours"}`;
export const UNASSESSED = "Impact not yet assessed";

// ---- Who may change the estimate ---------------------------------------------------------------------------------------

export type ImpactCapability = "update_impact" | "record_recovery";

const impactRoles: Record<ImpactCapability, { roles: string[]; message: string }> = {
  update_impact: { roles: ["Mine Manager", "Shift Supervisor", "Maintenance Planner"], message: "The repair estimate is updated by the Maintenance Planner, a Shift Supervisor or the Mine Manager." },
  record_recovery: { roles: ["Mine Manager", "Shift Supervisor"], message: "Recovered production is recorded by a Shift Supervisor or the Mine Manager." },
};

export function canActOnImpact(capability: ImpactCapability, actor: Actor): Check {
  const rule = impactRoles[capability];
  return rule.roles.includes(actor.role) ? { allowed: true } : { allowed: false, reason: rule.message };
}

// ---- The scenario record and its history -----------------------------------------------------------------------------------

export type ImpactScenario = {
  id: string;
  label: string;
  equipmentId: string;
  issueId: string;
  /** Every issue that affects this delivery. They share one result, so the output is counted once. */
  linkedIssueIds: string[];
  activityId: string;
  shiftId: string;
  shiftName: string;
  orderRef: string;
  customer: string;
  shipmentNumber: string;
  commitmentGrams: number;
  deliveryDeadline: string;
  breakdownStartedAt: string;
  /** The current estimate of the total outage, or the actual outage once repair is recorded complete. */
  outageHours: number | null;
  usableStockTonnes: number | null;
  catchUpTonnes: number | null;
  recoveredGrams: number;
  repairCompletedAt: string | null;
  actualOutageHours: number | null;
  responsible: string;
  /** Safety and environmental priorities. Shown separately and never weighed against value. */
  safetyNote: string;
  updatedAt: string;
  updatedBy: string;
};

export type ImpactSnapshot = {
  outageHours: number | null;
  usableStockTonnes: number | null;
  catchUpTonnes: number | null;
  recoveredGrams: number;
  goldAffectedGrams: number | null;
  forecastGrams: number | null;
  /** Null for people who may not see money. */
  valueDelayed: number | null;
};

export type ImpactChange = {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  kind: "estimate" | "repair_complete" | "recovery" | "reset";
  reason: string;
  previous: ImpactSnapshot;
  revised: ImpactSnapshot;
};
