# The Gold demonstration: "What happens if we wait?"

**Scope:** demonstration and UAT only. Every quantity, price and assumption is fictional, and every notification is simulated.
**Updated:** 22 November 2026.

The question it answers: **what is wrong, what does it affect, what happens if we wait, and who needs to act?**

## 1. Where to find it

| Where | What you see |
| --- | --- |
| **Work & Exceptions → Crusher CR-01 — Motor Drive Failure** (`/exceptions/issue-gold-001`) | The full **What happens if we wait?** section, first on the page, with the scenario controls |
| **Overview → What needs attention?** | The issue, with what it does to the gold delivery in one sentence |
| **Equipment & Maintenance → CR-01** (`/equipment/eq-cr01`) | What the breakdown affects, who is responsible, when the repair is expected |
| **Shift Control → Shifts → Shift A**, and the **Production** tab | The effect on the production target: target, forecast, possible shortfall |
| **Resource Readiness → CR-01 — Drive coupling repair** | The required part, the repair crew, the expected repair time and how long stock keeps processing running |
| **Shipments → Overview and Shipments** (`/shipments/gold`) | The original commitment, the current forecast and the linked production blocker |

## 2. The assumptions

| Input | Value |
| --- | ---: |
| Failed equipment | Crusher CR-01 |
| Gold required for the delivery | 1,000 g |
| Baseline forecast before the breakdown | 1,000 g |
| Planned ore-processing rate | 100 tonnes/hour |
| Usable, already-crushed stock downstream | 250 tonnes |
| Approved additional processing before the deadline | 50 tonnes |
| Gold content of the ore | 2 g/tonne |
| Expected processing recovery | 90% |
| Illustrative sales price | R1,000/gram |

Timeline: the crusher stops at **24 April 06:00**, and the delivery is due **25 April 08:00**. The recovered gold is assumed fully payable and otherwise ready within the delivery window.

## 3. The calculation (one function, `calculateImpact` in `lib/impact-rules.ts`)

```text
ore shortfall = max(0, rate × total outage hours − usable stock − approved catch-up)
gold affected = min(gold still required, ore shortfall × gold content × recovery)
forecast      = max(0, baseline forecast − gold still short)
value delayed = gold still short × price per gram
```

| Total outage | Ore shortfall | Gold potentially delayed | Forecast | Estimated sales value potentially delayed |
| ---: | ---: | ---: | ---: | ---: |
| 2 hours | 0 t | 0 g | 1,000 g | R0 |
| 4 hours | 100 t | 180 g | 820 g | R180,000 |
| 6 hours | 300 t | 540 g | 460 g | R540,000 |

Unit tests check all three, the cap, the floor at zero, and the effect of stock and catch-up.

## 4. What is kept apart

- **Commitment and forecast.** The customer commitment stays **1,000 g** and **R1,000,000**. A forecast never changes it and never approves a partial shipment.
- **Forecast and verified stock.** Changing the scenario touches no inventory, no shipment and no readiness check. Recorded recovery is progress, not verified stock.
- **Sales value, cost, profit and loss.** The money figure is labelled *Estimated sales value potentially delayed*. Additional costs, profit and confirmed losses are separate and are not estimated.
- **Safety and environment** are shown on their own line and are never weighed against value.
- **Missing inputs** show *Impact not yet assessed* and no number.
- **The same output is counted once** even when several issues affect it: the result belongs to the scenario, not to an issue (`totalValueDelayed`).

## 5. Things a person can do

1. Switch between the **2, 4 and 6 hour** scenarios.
2. **Adjust usable stock or approved catch-up** (clear a value to see the not-assessed state).
3. See the forecast change on every page above.
4. **Record repair complete** with the actual outage. The actual downtime is kept, the forecast is recalculated from it, and the shortfall stays. The crusher and issue are marked *reported*, not verified.
5. **Record recovery** (production progress or an approved plan) to reduce the shortfall.
6. **Reset** the demonstration.

Every change is kept in the history with the previous estimate, the revised estimate, the reason and who made it.

## 6. Who sees what

- Grams, tonnes, hours, the responsible person and the next action are visible to everyone who can open the page.
- **Rand figures** (planned value and value potentially delayed) are sent only to the Mine Manager and the Commercial / Finance Officer. For everyone else the server sends no money at all, including in the history.
- The estimate is changed by the Maintenance Planner, a Shift Supervisor or the Mine Manager. Recovery is recorded by a Shift Supervisor or the Mine Manager.
- Notifications are recorded as simulated. Nothing is sent to a transporter or anyone else, and nothing financial is in any transporter-facing view.

## 7. Where the code is

| Area | Files |
| --- | --- |
| Calculation, assumptions, permissions | `lib/impact-rules.ts` |
| Seed records (equipment CR-01, the issue, the part, the scenario) | `lib/impact-data.ts` |
| Store and API | `lib/demo-store.ts` (the *Impact* section), `mocks/handlers.ts` (`/impact`) |
| Screens | `components/impact-panels.tsx`, `components/use-impact.ts` |
| Tests | `lib/impact.test.ts`, `e2e/gold-impact.spec.ts` |

## 8. Simulated, and not built

- All figures, the timeline, the part's arrival time and the customer are fictional.
- The gold delivery is a scenario record. It is not a chrome concentrate shipment and is not in the stock ledger.
- There is no real notification, assay, dispatch or finance system behind any of it.
- Only one issue is linked to the delivery. The counted-once rule is built and tested but not shown with a second issue.
