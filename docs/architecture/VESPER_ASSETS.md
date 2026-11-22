# VESPER assets: equipment and infrastructure

Status: demo and UAT scope. Infrastructure records are **simulated demonstration data**, kept in the same register as equipment.

## One register, two views

Equipment & Maintenance is the **Assets** page (the sidebar keeps the name "Equipment & Maintenance"). It has two tabs, **Equipment** and
**Infrastructure**, over one asset register: the same record shape, the same maintenance plans, service history, availability reports, linked
issues, permissions and screens. Nothing is duplicated.

- **Classification** lives in one place (`equipment-rules.ts`). A category is equipment or infrastructure, never both. Infrastructure groups:
  Power (substation, generator, electrical distribution), Water (pump, pipeline), Processing (conveyor, processing facility), Transport (mine
  road, rail, loading facility) and Communications (communications network). A pump or conveyor is therefore one record, classed once.
- **Per-tab figures**: assets, unavailable, service due and open linked issues are worked out from the selected tab only.
- **Filters**: Equipment has All, Available, Unavailable, Service due, Retired. Infrastructure has All, the five groups and Retired. Search covers
  name, code, location, responsible person, category and group.
- **Columns**: Equipment shows name and code, area or location, availability, next service and hours. Infrastructure adds the category and shows
  "Hours / usage": hours where they apply, otherwise a usage measure, otherwise a dash.
- **Add asset** offers Add equipment or Add infrastructure; each form lists only its own categories.

## What each asset records

Unique code and id, category, location (a mapped area, or free text such as "Tailings storage facility"), **responsible person**, **condition**
(good, needs attention, not assessed), an optional usage measure, availability (reported, never verified), maintenance plans (hours or days, so
inspections work for infrastructure), service and inspection history, linked issues, notes and an event history for every change.

**Availability, condition and maintenance status stay separate.** A pump can be available, in poor condition and due for service at the same time;
the register shows "Needs attention" for an available infrastructure asset whose condition is flagged, and "Unavailable" only when it has been
reported unavailable.

## Dependencies

An asset records the assets it **depends on** (a crusher and a conveyor on their substation). The other direction ("needed by") is worked out, never
stored twice. Rules: an asset cannot depend on itself or on anything that already depends on it (no circles), nothing can depend on retired
infrastructure, and an asset that active assets depend on cannot be retired until they no longer do.

On an asset's page, **Depends on and affects** shows what it depends on and what needs it, a warning when something it depends on is unavailable,
and, when it is itself unavailable, which assets are affected and which open shift work (through the issues linked to those assets) depends on it.

## VESPER Intelligence

An unavailable asset that others depend on becomes a **Dependent assets affected** insight on the Command Centre (and an Ask VESPER answer): it
names the affected assets and links to each record. It **does not estimate production or money**: a production or financial impact only appears
where one has been calculated (the existing Gold impact estimate), and no asset failure is assumed to cause a loss.

## Demo infrastructure

SUB-01 Main Substation (power), GEN-01 Standby Generator (power), PWP-03 Process Water Pump (water, needs attention), TP-01 Tailings Pipeline (water),
CV-07 Conveyor (processing, depends on SUB-01), HR-01 Haul Road North (transport) and COM-01 Site Communications Network (communications). The
primary crusher C-02 also depends on SUB-01.

## Not built

A dedicated drawing of infrastructure systems or a map layer (deliberately out of scope); linking a dependency to a specific production process or
shipment, so impact is only the named dependents and linked shift work; supporting-document attachments on assets (service requests and quotes
already keep documents); bulk import of infrastructure.

Code: `packages/api-contracts/src/equipment.ts`, `lib/equipment-rules.ts`, store methods `createEquipment`, `updateEquipment`, `retireEquipment`,
`components/workspace-screen.tsx` (Assets tabs), `components/equipment-dialogs.tsx`, `components/equipment-detail-screen.tsx`. Tests:
`lib/assets.test.ts`, `e2e/assets.spec.ts`.
