# VESPER database architecture

**Status:** a logical design and a set of decisions to confirm. **No database exists, none is provisioned by this work, and no migration has been written or run.** Nothing here chooses a database product or an ORM.

## 1. The arrangement

```text
CLIENT ORGANISATION
│
├── UAT environment ─────── UAT database
└── Production environment ─ Production database
                              │
                              ├── Mining Site A
                              ├── Mining Site B
                              └── further authorised sites
```

- **Two databases per client**: one for UAT, one for production. Each has the **same standard schema**, at the version the release expects.
- **One schema for every subscription.** There is no Core schema, Operations schema, Enterprise schema or Group schema. A feature a subscription does not include is simply not used. The tables exist.
- **Sites are rows, not databases.** A client with three sites has one UAT database and one production database. A site never has a database, schema or environment of its own.
- **UAT never uses the production database.** The deployment manifest enforces separate database references.

## 2. What this changes in the existing Backend Schema (v1.1)

The Backend Schema was written for one shared multi-tenant database ("tenant isolation by design", `organisation_id` on every tenant-owned row, `organisations` as the tenant root). The deployment decision is **one dedicated database per client per environment**.

| Backend Schema | Amendment needed |
| --- | --- |
| 1.3 Tenant isolation | Isolation is by deployment: a client's data is in its own database. Row-level tenant filtering stops being the security boundary |
| 2.1 and 5.1 `organisations` | Holds exactly one organisation per database: the client |
| `organisation_id` on tenant-owned rows | Keep it where it earns its place: consistency and uniqueness scopes, audit and event records, integration contracts, a future move to a shared platform, and safe export and import. Do not rely on it for isolation |
| 5.1 `sites` | Unchanged. Sites belong to the organisation and are the unit of operational scoping |
| 5.1 `subscriptions`, `subscription_entitlements`, `subscription_site_allocations` | Keep, with the clarification in section 4 |
| TRD 842 | Site partitioning stays server-side. Tenant partitioning is the deployment boundary |

These are recorded for the owner to approve. The specification is not edited by this work.

## 3. Logical groups

The standard schema covers the groups the Backend Schema already defines. They are listed here against the contracts that already exist in the prototype.

| Group | Main records | Scope | Prototype contract |
| --- | --- | --- | --- |
| Organisation and access | organisation, memberships, roles, role assignments | organisation, optionally site | `organisation.ts` (Member, Company) |
| Subscription | subscription, entitlements, site allocations | organisation | `subscription/` (plan configuration and the stored subscription) |
| Sites and areas | sites, site plans, operating areas, area status | site | `index.ts` (MapArea), `SiteDetails` |
| Equipment | equipment, maintenance plans, service entries, readings, availability events | site | `equipment.ts` |
| Issues | issues, actions, dependencies, comments, verifications, events | site | `index.ts` (OperationalIssue) |
| Maintenance and work | service requests, quotes, contractor responses | site | `service.ts` |
| Resource readiness | activities, parts, reviews | site | `index.ts` (ReadinessActivity) |
| Shifts | shifts, crew, work, handover, events | site | `shift.ts` |
| Reports | report definitions and derived figures | organisation, site | computed in `lib/reports.ts` |
| Event history | issue, equipment, shift and organisation events | as the record | the `events` arrays on each record |
| Configuration | settings, cause lists, notification rules | organisation | `causes.ts` and per-module constants |

## 4. How subscriptions relate to the database

- The **plan configuration** (which features and how many sites each of the five subscriptions has) is **code**, in `packages/api-contracts/src/subscription/`. It is one definition that ships with every release.
- The database holds the **client's subscription**: `subscriptions.plan_code` (one of the five identifiers), the contracted site count for Group, the effective dates and status.
- `subscription_entitlements` should hold **only agreed overrides** to the plan's defaults, not a copy of every feature for every client. This avoids two sources of truth that can drift. It is a decision to confirm (see section 7).
- `subscription_site_allocations` records which sites count against the allowance, so a site limit can be checked.

## 5. Scoping rules for the standard schema

1. Every record that belongs to a mining site carries `site_id`, and the site must belong to the organisation.
2. Records that belong to the organisation as a whole (users, memberships, the subscription, settings) carry no `site_id`.
3. `organisation_id` is carried by the organisation-level records and by audit and event history, so every exported or integrated row is attributable. Where a site record already implies its organisation through `site_id`, carrying it again is optional. **Pick one rule for the whole schema and apply it everywhere.**
4. Role assignments may be organisation-wide or limited to a site, and can never reach a site of another organisation. In a one-organisation database this holds by construction, but the constraint is kept.
5. Site-scoped uniqueness (equipment codes, shift names) is scoped to the site or the organisation, never global.

**Current prototype contracts:** only issues carry `organisationId`. Equipment, shifts, readiness activities and map areas carry `siteId` only. This is consistent with rule 3 once the rule is chosen. It does not need to change until the production schema is designed.

## 6. Multiple sites

The schema supports many sites per organisation from the start. The prototype has one. Real multi-site work needs: a site-creation action that checks `canAddSite`, a site selector backed by the user's authorised sites, site-scoped queries on every list, and an area and site-plan per site. None of this is built.

## 7. Decisions that cannot be validated yet

1. **Database product.** PostgreSQL is a candidate in the TRD. Not decided.
2. **ORM or query layer.** Not decided. None is added.
3. **Rule for `organisation_id`** (section 5, rule 3).
4. **Source of default entitlements**: code with overrides (proposed) or database rows.
5. **Data retention for a lost feature** after a downgrade.
6. **Audit design**: immutable event tables, who can read them, retention.
7. **Backups, restore and residency** per client, including POPIA obligations.
8. **Migration method**: one schema version applied to every client's two databases, with a record of which version each runs (see the deployment architecture).
9. **Secrets and connection management** for each environment.

## 8. Not done

No database, schema file, migration or connection string has been created. The deployment manifest holds only a database **name** for each environment, validated to be different for UAT and production.
