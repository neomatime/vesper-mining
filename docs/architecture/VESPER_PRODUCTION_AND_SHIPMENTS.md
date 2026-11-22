# Production, inventory and shipments

**Scope:** demonstration and UAT only. Everything here runs on the prototype's in-browser store with fictional manganese data from Riverside Mine. No external system is connected and no real message is sent to anyone.
**Updated:** 22 November 2026.

## 1. The workflow

```text
Record production → Check quantity → Receive into inventory → Prepare eligible material → Reserve stock for a shipment
→ Confirm readiness → Request collection → Transporter confirms → Record dispatch → Record delivery
```

| Step | Who | What changes |
| --- | --- | --- |
| Record production | Shift Supervisor, Mine Manager | A production record: reported amount, how it was measured, where it was moved. **Stock does not change** |
| Check quantity | Inventory Controller, Mine Manager (never the person who reported it) | The confirmed amount, the measurement record and the reason for any difference are added. The reported amount is kept. A **receipt** goes into the stock ledger |
| Create shipment | Inventory Controller, Mine Manager | Only from stockpiles that are *ready for shipment*, and never more than is available. A **reserve** goes into the ledger |
| Mark ready & notify transporter | Same | Needs all four checks and an approved transporter. Creates **exactly one** collection request. The request is **not a booking** |
| Transporter replies | The transporter, on a page with no sign-in | Confirms a collection time or declines. The shipment becomes *Collection confirmed* or returns to *Preparing* |
| Record dispatch | Inventory Controller, Mine Manager | Any part of the shipment, up to what is still at the mine. A **dispatch** takes the amount off stock and off the reservation |
| Record delivery | Same | What arrived against what was dispatched. A difference needs a reason and stays visible until reviewed |

Closing a shift sends its handover but does not mark it received. The incoming supervisor confirms receipt separately.

## 2. The rules the code enforces

- **Reported is not stock.** Stock is a ledger of movements (`opening`, `receipt`, `reserve`, `release`, `dispatch`). Every balance is worked out from it (`stockPosition` in `shipment-rules.ts`).
- **Material that needs processing can be stored but never reserved.** Its available amount is always zero.
- **No double reservation.** A shipment cannot exceed the stockpile's available amount, so the same tonnes cannot be promised twice.
- **Repeated submissions.** Every form sends a `submissionId`. A request whose id was already saved is refused with `DUPLICATE`. The id is remembered only after success, so a form that failed validation can be corrected and sent again. A second collection request, a second receipt, and a second dispatch beyond what is left are also refused by the state of the record.
- **Cancelling before dispatch releases the reservation** and closes the open request. After any dispatch a shipment cannot be cancelled.
- **A bulk shipment is not dispatched by its first load.** `remaining`, `dispatched`, `inTransit` and `received` are tracked separately.
- **Differences stay visible.** A delivery whose amount differs from the dispatched amount is flagged until someone reviews it.
- **Permissions are checked on the server side of the demo** (`canActOnShipments`), not only by hiding buttons.
- **A record's history is kept.** Reports, checks and corrections append events. Nothing is overwritten.

## 3. Where it lives

| Area | Files |
| --- | --- |
| Records and shapes | `packages/api-contracts/src/shipments.ts` |
| Rules and words | `apps/mine-operator/src/lib/shipment-rules.ts` |
| Seed data | `apps/mine-operator/src/lib/shipment-data.ts` |
| Store and API | `lib/demo-store.ts` (the *Production, inventory and shipments* section), `mocks/handlers.ts` |
| Screens | `components/production-screens.tsx`, `shipments-screens.tsx`, `shift-control-screens.tsx`, `transport-response-screen.tsx`, `module-tabs.tsx` |
| Routes | `/shifts/production`, `/shifts/production/new`, `/shifts/exceptions`, `/shifts/reports`, `/shifts/handover`, `/shifts/[id]/close`, `/shipments`, `/shipments/inventory`, `/shipments/inventory/check/[id]`, `/shipments/list`, `/shipments/logistics`, `/shipments/history`, `/shipments/new`, `/shipments/[id]`, `/transport/respond/[token]` |
| Tests | `lib/demo-store.shipments.test.ts`, `lib/shipment-rules.test.ts`, `lib/csv.test.ts`, `e2e/shipments.spec.ts` |

## 4. What is simulated

- Collection requests are **recorded**, not sent. The Logistics page and the shipment page offer *Open reply page (demo)* so a presenter can answer as the transporter.
- Evidence (measurement records, delivery notes) is recorded by file name. No file is stored.
- The shift target (1,200 t) is a fixed demonstration figure.
- Stock opens at fixed balances. Shipments delivered before the scenario date are history only.
- Stored data uses the key `vesper-demo-state-v5`. Browsers holding older demo data start from the new seed.

## 5. Known limits

- There is no separate Logistics Coordinator role. Inventory Controller and Mine Manager do that work.
- Mineral inventory has no manual stock adjustment ("Record movement" in the reference screens). Stock changes only through checked production, reservations, dispatch and cancellation.
- A multi-material production report is entered one material at a time (*Send and add another material*).
- Shipments are available on every subscription. They are not yet a feature code in the subscription model.
- Closing a shift requires every unfinished task to have an owner. The deadline shown is the linked issue's earliest open action, or the start of the next shift.

## 6. Sales value (added 22 November 2026)

Shipments can show an **estimated sales value** beside their operational status. It is a separate layer on top of the workflow above.

- **A sale is linked to a customer order or contract** by its order reference. An **internal transfer** has no sales value.
- **Prices** are supplied by the **Commercial / Finance Officer**: a fixed price per tonne, one currency (ZAR), on the same quantity basis as the shipment (*tonnes dispatched from the mine*). A price on a different basis is not used, and the shipment shows **Not priced**.
- **Value status:** *Estimated* (price × planned tonnes), *Provisional* (price × tonnes actually dispatched, once everything has left), *Final* (the value finance has settled) or *Not priced*.
- **Four amounts stay apart:** sales value (an estimate), transport cost, accounting revenue and cash received. The last three come from finance records and are never added to the sales value.
- **Totals on the Shipments overview** never overlap: *Value awaiting collection* (requested or confirmed, on time) and *Value of delayed shipments* (collection date reached without a confirmed collection, a passed collection time, or a declined request). Each shipment is in at most one. A delayed shipment's value is what is at stake, not a loss.
- **History is kept.** A price is never overwritten: a change is a new version, and every change to a shipment's value is a snapshot, so the original estimate stays visible.
- **Money is restricted by role.** The Mine Manager and the Commercial / Finance Officer see values; only the Commercial / Finance Officer sets prices. For everyone else the server sends no price, value or finance record, so there is nothing to export. Transporter pages never contain money.
- **Not built:** a screen for finance to edit its own records (they are read from a seeded ledger), and currency conversion.

Files: `shipment-rules.ts` (the value rules), `shipment-data.ts` (prices, finance, history), `demo-store.ts` (`setPrice`, value snapshots, restricted `logistics`), `components/value-panels.tsx`, `lib/shipment-value.test.ts`, `e2e/shipment-value.spec.ts`.

