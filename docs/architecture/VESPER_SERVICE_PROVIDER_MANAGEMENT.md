# Service provider management (repair and maintenance providers)

Status: demo and UAT scope. Providers are **fictional demonstration records**; the seven added for this feature are marked "Fictional demonstration provider" and sit beside the earlier five without changing them.

Not to be confused with logistics providers (transport quotes and agreements under Shipments); those are a separate register.

## Where it is

Equipment & Maintenance > **Assets** > **Manage Service Providers** opens `/equipment/providers`, with a breadcrumb back to Assets. No new sidebar item. A provider's own page is `/equipment/providers/[id]`. The Admin screen still lists the same providers.

## The directory

Four figures (service providers, approved, pending approval, inactive), search, specialisation and status filters, a Filters panel (service area, response time), a table (provider, specialisation, service area, status, response time, actions menu), pagination of five, and empty states ("No service providers yet" and "No service providers match these filters" with Clear filters). An approved provider whose approval date has passed shows "Approval expired" instead of "Approved".

## Approval

Status is **Pending approval**, **Approved** or **Inactive**.

| Action | Who |
| --- | --- |
| Add and edit a provider | Mine Manager, Maintenance Planner |
| Approve, deactivate, reactivate, delete | Mine Manager |

A provider added by anyone starts **pending**, unless the Mine Manager explicitly approves it in the form. Deactivating needs a reason; a provider with repair work in progress cannot be deactivated until it is finished or cancelled. Every change is kept in the provider's audit history (who, when, what, why).

## Create, read, update, delete

- **Create**: registered company name, registration number, contact person, email, phone, specialisation, equipment and infrastructure categories serviced, service areas, expected response time, certifications and documents (file names only in this prototype), notes. The server validates, refuses a duplicate name or registration number, and refuses a repeated submission.
- **Read**: contact details, specialisations, status, documents, linked repair requests, completed repairs, and performance worked out only from recorded requests and quotes (asked, replied, declined, completed, average time to reply). With nothing recorded it says so; no statistics are invented. Standing maintenance agreements are not modelled in this prototype, and the page says "No maintenance agreements recorded".
- **Update**: ordinary edits record what changed; approval changes use the approval action.
- **Delete**: always asks first. A provider that any repair request refers to is **never deleted**: the dialog explains and offers **Deactivate instead**, so history stays whole. Only an unreferenced provider can be permanently deleted, and only by the Mine Manager.

## Repair requests

Only **approved** providers (not expired) that service the equipment's category and the site are offered when an external repair is requested, and the server refuses pending or inactive providers. Providers are reused across equipment and infrastructure: categories include the infrastructure categories (pumps, conveyors, substations, roads and so on).

Code: `packages/api-contracts/src/service.ts`, `lib/service-rules.ts`, `lib/service-data.ts`, store methods `createProvider`, `updateProvider`, `setProviderApproval`, `deleteProvider`, `providerDetail`, `components/provider-directory-screens.tsx`, `components/provider-dialogs.tsx`. Tests: `lib/provider-directory.test.ts`, `e2e/provider-directory.spec.ts`.

## Not built

Maintenance agreements with providers; uploading real documents (names only); sending anything to a provider from this page; organisation-level restrictions beyond the existing role checks (this prototype has one site).
