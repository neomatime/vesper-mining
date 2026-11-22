# VESPER Intelligence (demo scope)

Status: demo and UAT scope, simulated data. Not production-ready.

## Principle

The system calculates. The text explains. The manager decides. VESPER Intelligence is a layer over records that already exist: it creates no
records of its own, so a breakdown, shipment or production figure lives in one place and every view points at it.

## Layers

1. **Operational data**: issues, equipment (with its events), readiness, shifts and handovers, shipments, and the Gold impact estimate.
2. **Rules and calculations** (`apps/mine-operator/src/lib/intelligence-rules.ts`): deterministic. The shortfall and the sales value
   potentially delayed come from the existing impact calculation (`impact-rules.ts`), never from text.
3. **Explanation**: plain-language text written by the rules in this build ("Generated from your records"). A live language model could later
   rephrase the same output; the figures and links would still come from layer 2. No model is connected today, so nothing leaves the browser.

## What is built (Command Centre, Overview)

| Capability | Where | Behaviour |
| --- | --- | --- |
| Prioritised insights | VESPER Intelligence card under the priority card | What is affected, why it matters, a linked action. Production at risk (Gold estimate), shipment awaiting transport, recurring breakdowns (only with 2 or more recorded breakdowns), overdue maintenance, readiness shortages. Top two shown; "Show all" adds the reasoning. |
| Ask VESPER | Inside that card | Seven agreed questions (attention, production target, recurring failures, an outage, shipments at risk, sales value, shift changes). Answers use the same insights, link to records and list what is missing. Other questions are declined with the list of what can be asked. |
| Shift briefing | Right column | Production (reported, not verified), work completed, open items, handover state and suggested next-shift priorities, assembled from records. Never sends or approves a handover. |
| Impact analysis | Existing "What happens if we wait?" | Unchanged: deterministic, scenario controls, estimates kept apart from losses. |

## Safeguards

- Sales values appear only for roles allowed to see them; otherwise the operational insight shows without money.
- Nothing is invented: no failure probability, no quantity or rand value without the calculation behind it. Missing inputs are named.
- Delayed sales value is never called a loss, revenue or cash.
- No button on these panels changes data; each opens the record where the work is done.

## Not yet built

Supervisor edit/approve of a generated briefing; reliability trends beyond recurrence counts; a full intelligence page; connecting a live language
model (needs a server route, a key and an approval of the data flow); site-level data restrictions beyond the existing role checks.
