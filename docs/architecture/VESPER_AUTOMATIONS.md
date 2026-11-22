# Automations and the Administration page

Status: demo and UAT scope. Rules run on the demo's records; nothing is sent outside VESPER.

## Administration tabs

The Administration (Organisation) page keeps its approved look, tidied:

- **Tabs live in the address** (`/admin?tab=automations`), so a refresh, the back button and a shared link return to the same tab.
- **Grouped**: people and access (Employees, User rights), the organisation (Site, Company), operations set-up (Service providers, Automations), plan and connections (Plan and usage, Connections), with a thin divider between groups.
- The Plan / Site / Employees summary shows only on Employees and Plan and usage, where it helps.
- The **Service providers** tab is now a short summary with a link to Manage Service Providers (Assets), so providers are managed in one place.

## Automations

Seven rules, from a fixed list, all **off** to begin with. The Mine Manager switches each on or off, chooses who is told, and, where it applies, how early or late it counts.

| Rule | Fires when | Tells (default) |
| --- | --- | --- |
| Service due soon or overdue | A maintenance plan is overdue or due within N days (7) | Maintenance Planner |
| Issue with no owner | An open issue has had no owner for N hours (4) | Mine Manager |
| Overdue action | A corrective action on an open issue has passed its deadline | The action's owner |
| Handover not sent | A shift is ending (within N hours, 2) or ended with a draft handover | The shift's supervisor |
| Shipment waiting on transport | Transport is unconfirmed or declined and collection is within N days (2) | Inventory Controller |
| Vehicle problem on a planned load | A vehicle on an own-fleet load is unavailable, overdue for service or has an open issue | The person responsible for the transport |
| Provider approval ending | A provider's approval expired or ends within N days (30) | Mine Manager |

How they behave:

- **They only notify.** A rule never changes an issue, shipment, handover or any record, never approves or sends anything, and tells nobody outside VESPER: a notification is a record in the person's notification list, linking to the record.
- **Once per record.** A rule announces a record once and stays quiet until the problem has cleared (or the rule is switched off and on again, or its threshold is changed).
- **Run now.** There is no background scheduler in this build: rules run when the Mine Manager presses Run all rules now or Run on a rule. Each run, and each setting change, is kept in a history (what was found, who was told, who changed what).
- Only the Mine Manager manages automations; other roles cannot open Administration.

Code: `lib/automation-rules.ts` (the catalogue and the pure evaluation), store methods `automations`, `updateAutomation`, `runAutomations`, `components/automations-panel.tsx`, `components/admin-screen.tsx`. Tests: `lib/automations.test.ts`, `e2e/automations.spec.ts`.

## Not built

A scheduler that runs rules by itself; rules you write yourself (the list is fixed); sending by email, SMS or chat; per-person notification preferences; automations that act (create tasks, change status).
