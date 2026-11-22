# VESPER service providers, transport quotes and transport agreements

Status: demonstration and UAT scope. Manual record-keeping with fictional data. Nothing is sent to a provider, no quote is received
automatically and no booking is made. Prices exclude VAT unless a record says otherwise.

## Where things are

| Workflow | Where |
| --- | --- |
| Entry point | Shipments > Logistics > **Manage providers** |
| Providers (add, view, edit, approve) | `/shipments/providers`, `/shipments/providers/[id]` |
| Transport quotes (request, record, decide) | `/shipments/providers/quotes`, `/quotes/new`, `/quotes/[id]` |
| Transport agreements (record, confirm, allowance, fees) | `/shipments/providers/agreements`, `/agreements/new`, `/agreements/[id]`, `/agreements/[id]/edit` |
| Use a quote or agreement for a shipment | **Transport pricing** section on the shipment page |

Code: `lib/transport-rules.ts` (rules and calculations), `lib/transport-data.ts` (demo data), `lib/demo-store.ts` (workflow methods),
`mocks/handlers.ts` (`/transport`, `/transport-providers`, `/quote-requests`, `/agreements`), `components/transport-screens.tsx`,
`components/transport-agreement-screens.tsx`. Tests: `lib/transport.test.ts`, `e2e/service-providers.spec.ts`.

## Rules worth knowing

- **Mine approval** (Needs review / Approved / Inactive) is the Mine Manager's. Only approved providers can be asked to quote, chosen for a
  shipment or hold an active agreement. Inactive providers keep their history; one with shipments in progress cannot be made inactive.
- **Quotes**: a request is saved as a Draft, the text is copied or downloaded, a person sends it, then records it as sent and enters each
  reply by hand. Recording a quote is not accepting it. Accepting or not selecting keeps who, when and why. An expired quote cannot be accepted.
- **One pricing source per shipment** (quote or agreement). Replacing it needs an explicit step and a reason; the earlier source stays in history.
  A price or allowance never confirms collection, readiness, dispatch, delivery, invoicing or payment.
- **Agreements keep five things independent**: agreement dates, pricing method, fee or rate period, billing frequency, allowance period.
  Yearly billing is not a discount, an advance payment or an annual allowance. Minimum commitments are only recorded when stated.
- **Allowance** (per period): included, delivered (confirmed received tonnes), planned, available. Each linked shipment is counted once:
  planned until delivered, then delivered; cancelling releases it. Tonnes beyond the allowance show as excess. A shipment counts in the
  month of its collection date. Earlier periods are preserved; no rollover unless agreed.
- **Fees**: a fixed fee is recorded once per charge period and is never copied onto shipments. The "allocated transport cost estimate"
  (tonnes / included x fee) is a labelled share for reporting, only worked out when the fee and allowance periods line up, never an extra charge.
- **Commercial visibility**: quotes, rates and agreement terms are sent only to Mine Manager, Commercial / Finance Officer and Inventory
  Controller. Other roles see providers and approval only; the server sends them no prices.
- Draft agreements (including ones prefilled from an accepted proposal) must be reviewed and confirmed by the Mine Manager or Commercial /
  Finance Officer before they can be used. Complex terms: keep the document and record a labelled manual estimate.

## Demonstration data (simulated April 2026)

SHP-0048 (300 t chrome concentrate to Customer Stockyard A, Germiston): ABC R350/t = R105,000 accepted, Highveld R380/t = R114,000 not
selected, collection unconfirmed. AG-0001 (ABC, coal, R1,000,000/month, 10,000 t per calendar month; April 6,500 delivered, 300 planned
via SHP-0051, 3,200 available; allocated estimate R30,000). AG-0002 (Highveld, R12,000,000/year billed yearly, monthly allowance). AG-0003 (draft).

## Known limits

- The agreement demonstration runs on its own labelled date (24 April 2026); quote validity and shipments use the app's demo clock.
- Attachments keep file names only. "Sent" requests, notifications and reminders are simulated.
- In-house transport ("Our fleet") is not part of this slice.
