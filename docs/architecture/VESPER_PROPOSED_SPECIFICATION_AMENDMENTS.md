# Proposed specification amendments

**Status: PROPOSED. NOT APPLIED. For the product owner's decision.**
No specification has been edited. The PRD, TRD and Backend Schema read exactly as they did before. Each amendment below shows the current wording, the proposed wording and what it would mean. Approve, change or reject each one separately.

**Why these five:** the product owner approved the direction of dedicated client databases (one client, one VESPER instance, one UAT database, one production database) and set out the Core, Operations, Enterprise and Group entitlements, the Group licensing rule and the UAT approach. These are the passages of the approved documents that those decisions contradict or leave undefined.

| # | Document and section | Subject |
| --- | --- | --- |
| 1 | Backend Schema 1.3 | Tenant isolation by design |
| 2 | Backend Schema 2.1 and 5.1 (`organisations`) | Logical architecture and the organisation record |
| 3 | Backend Schema 5.1 and 5.2 (subscription tables and baseline) | Entitlements, overrides and their audit |
| 4 | PRD 11.1 and 11.2 | What each subscription includes, and Group licensing |
| 5 | TRD 1.2 (ADR-14), 18.3 and 20.2 | Deployment, UAT and tenancy |

---

## Amendment 1. Backend Schema 1.3, first design principle

**Current text**

> **Tenant isolation by design:** Every tenant-owned entity is linked to an organisation; site records are further scoped to the correct mine site.

**Proposed text**

> **Isolation by deployment:** Each client organisation has its own VESPER instance, its own UAT database and its own production database. One client's data is separated from every other client's by that boundary, not by row filters in a shared database. Within a client's database, every site-specific record is scoped to the correct mine site, and organisation-level and audit records carry the organisation identifier.

**What it means**
- The security boundary moves from the application's query filters to the infrastructure. A coding mistake in one client's instance cannot expose another client's data.
- Cross-client reporting is impossible by design. Group-level oversight exists only across the sites of one client.
- Every client needs its own provisioning, migrations, backups and restore. Operating cost and effort grow with the number of clients.
- Row-level security for tenant separation is no longer needed. Site and role scoping inside a database remain essential.

---

## Amendment 2. Backend Schema 2.1 (logical architecture) and 5.1 (`organisations` row)

**Current text, 2.1**

> The future target has five conceptual layers: (1) client applications and validated APIs; (2) operational domain services and policy evaluations; (3) a PostgreSQL transactional database and attachment metadata; (4) approved integration adapters into authoritative external systems; and (5) reporting projections generated from verified facts and recorded events.

**Current text, 5.1, `organisations` row**

> organisations | id uuid, code text, legal_name text, display_name text, status text, created_at timestamptz | Unique organisation code; tenant root

**Proposed text, new paragraph at the end of 2.1**

> **Deployment topology.** Each client organisation is served by one dedicated VESPER instance, one UAT database and one production database. The same standard schema, at the same version, is applied to every client's two databases. UAT and production never share a database. A mining site is a record inside the client's database, never a database, schema or deployment of its own. The database product remains a candidate and is not decided here.

**Proposed text, 5.1, `organisations` row**

> organisations | id uuid, code text, legal_name text, display_name text, status text, created_at timestamptz | Exactly one organisation per database: the client that the deployment serves. The organisation identifier is kept on organisation-level, audit and event records and wherever an integration needs attribution.

**What it means**
- There is still one standard schema for every client and every subscription. No schema per client, per subscription or per site.
- The `organisations` table is enforced to hold one row. `organisation_id` stays in the model for consistency, audit, integration contracts and a possible later consolidation, but it no longer provides isolation.
- A rule is needed for which records carry `organisation_id` (see the database architecture document). It can be decided when the production schema is designed.
- Each release must name the schema version it needs, and a register must record which version each client's databases run.

---

## Amendment 3. Backend Schema 5.1 (`subscription_entitlements`) and 5.2 (entitlement baseline)

**Current text, 5.1**

> subscription_entitlements | subscription_id uuid, feature_code text, enabled boolean, site_limit int NULL | Core Mobile essential field access on all active plans; approved advanced workflow/report entitlements and site allowances

**Current text, 5.2, second paragraph**

> Commercial entitlement baseline (revision 1.1): every active VESPER subscription, including Core, includes the essential mobile field experience for authorised users at allocated sites. Feature flags may restrict approved expanded workflows, but must not deny basic issue reporting, assigned work, issue tracking, notifications or simulated offline status solely because the plan is Core. Role/site/organisation permissions remain independent guards.

**Proposed text, 5.1 row**

> subscription_entitlements | subscription_id uuid, feature_code text, enabled boolean, site_limit int NULL, agreement_reference text, effective_from date, approved_by text, approved_at timestamptz, created_at timestamptz | Holds only **approved overrides** to the plan's default features, not a copy of every feature. The defaults for each subscription are defined once in the application's plan configuration. Every override has an agreement reference, an effective date and approval details. The contracted site maximum for a Group subscription is held on the subscription record.

**Proposed new table, 5.1**

> subscription_audit_events | id uuid, subscription_id uuid, occurred_at timestamptz, actor text, action text, detail text | Append-only history of every creation, approval, amendment and revocation of a subscription or its overrides.

**Proposed addition to 5.2** (after the existing baseline paragraph)

> A feature override may grant a feature the plan does not include, or remove one it does, but never removes the essential mobile field experience. An override must be explicit and traceable to an agreement and an approver, and takes effect only from its effective date. Overrides are stored securely and enforced by the backend on every request. A client's overrides are changed by data, never by editing the application source.

**What it means**
- The plan configuration (in code) becomes the single source of the default entitlements. A change to what a subscription includes is a release, reviewed and tested like any other change.
- The database holds exactly what is particular to a client: its subscription, its licensed sites, its overrides and their history. This avoids two sources of truth that can drift.
- Overrides become auditable and reversible, and a downgrade has a defined record. The retention of data created under a feature the client later loses is still undecided.
- The existing 5.2 protection for basic issue reporting, tracking, assigned work and notifications is consistent with the Core definition and is kept as it is.

---

## Amendment 4. PRD 11.1 (subscription structure) and 11.2 (entitlement requirements)

**Current text, 11.1, table rows**

> | Core | 1 | Included - essential field workflows | Essential | **R45,000** |
> | Operations - Single Site | 1 | Included | Operational | **R70,000** |
> | Operations | Up to 3 | Included | Operational | **R95,000** |
> | Enterprise | Up to 6 | Included | Advanced | **From R180,000** |
> | Group | 7+ | Included | Group-level | **Custom** |

**Current text, 11.2**

> **VES-BR-014:** Core customers are entitled to essential VESPER Web and Mobile workflows at one authorised site, subject to role and site permissions.
> **VES-BR-015:** All active tiers include the dedicated VESPER Mobile field experience. Operations and above may unlock approved expanded workflows such as digital inspections; essential reporting and offline-state clarity must not be premium-gated.
> **VES-BR-017:** Site allowances apply to the subscribed mining organisation.

**Proposed text, new section 11.1A after the table**

> **What each subscription includes.**
> **Core: operational visibility.** The operational overview and a basic live operational map; reporting and tracking of operational issues; essential equipment visibility; assigned tasks and work updates; basic shift information; essential reporting; and essential VESPER Mobile.
> **Operations: operational coordination.** Everything in Core, plus advanced work and exception coordination (action ownership, dependencies and escalation); detailed shift handovers; equipment downtime and maintenance coordination; Resource Readiness and spare-parts early warnings; structured digital inspections and checklists; detailed operational reporting; and expanded Mobile workflows that support these capabilities. Operations - Single Site and Operations have identical functionality. Only their site allowances differ.
> **Enterprise.** Everything in Operations, plus advanced operational analytics; multi-site performance comparisons; advanced reporting and management oversight; support for contracted integrations; and approved customer-specific configurations and enhancements.
> **Group.** Everything in Enterprise, plus consolidated group-level operational dashboards; cross-site performance oversight; group-level administration and governance; and contractually agreed enterprise extensions.
> Tailoring for Enterprise and Group is controlled configuration of the standard product. There are no separate applications.

**Proposed change to the table, Group row, Site Allowance:** replace `7+` with `7 or more licensed sites, maximum set by the agreement`.

**Proposed addition to 11.2**

> **VES-BR-017 (extended):** Site allowances apply to the subscribed mining organisation. For Group, the licensed minimum is seven sites and the maximum is set by the commercial agreement. The minimum is a licensing threshold, not a requirement that seven sites are active. The licensed maximum is enforced.
> **VES-BR-020 (new):** Customer-specific entitlements are held as explicit, validated, traceable configuration with an agreement reference, effective date, approval details and audit history, and are enforced by the backend. They are never made by editing application source code.

**What it means**
- This turns a table of site counts and report labels into a definition of what each subscription is for. Core becomes a visibility product and Operations a coordination product. That is a commercial positioning decision recorded in the specification.
- In the prototype this has consequences. Core no longer shows Resource Readiness, detailed handovers, maintenance and downtime coordination or the operational and advanced reports. Core keeps issues, equipment details, shift basics, tasks and essential reporting.
- Several listed capabilities are not built: digital inspections, expanded mobile workflows, multi-site comparison, management oversight, contracted integrations and all of the Group dashboards, oversight and administration. The specification would then describe intended entitlements that the product does not yet deliver. The feature catalogue in the code records this, and the PRD should say it too.
- "Advanced work and exception coordination" is intertwined with the issue lifecycle and cannot be switched off in Core without a Core-specific lifecycle. That needs a separate decision.
- Prices in the table are untouched and remain provisional.

---

## Amendment 5. TRD 1.2 (ADR-14), 18.3 and 20.2

**Current text, ADR-14**

> Production APIs, identity, tenancy controls, deployment distribution and database security require separate architecture and mine-site approvals

**Current text, 18.3 (Native Mobile and Backend Security Prerequisites - Future Phase), a bullet**

> Partition tenants and sites server-side; log immutable actor/source/time fields without collecting unnecessary sensitive employee information. Define residence, retention and breach response in the production threat model.

**Current text, 20.2**

> Use a protected main branch and feature branches; require pull-request review, TypeScript checking, linting, unit tests and Playwright smoke tests in CI. Configure Vercel preview deployments for review, with appropriate access protection and demo-only environment configuration. Production-domain release is prohibited during this phase unless separately approved for a clearly labelled demo environment.

**Proposed text, ADR-14** (kept, with a second sentence)

> Production APIs, identity, tenancy controls, deployment distribution and database security require separate architecture and mine-site approvals. The proposed production tenancy model is one dedicated VESPER instance, one UAT database and one production database per client organisation, which remains subject to those approvals.

**Proposed text, the security bullet**

> Separate clients by dedicated deployment and database. Partition sites server-side within each client's database; log immutable actor/source/time fields without collecting unnecessary sensitive employee information. Define residence, retention and breach response in the production threat model.

**Proposed text, new paragraph at the end of 20.2**

> **Proposed per-client deployment (production phase, subject to approval).** One Vercel project per client organisation. Production deploys from the approved production release. UAT deploys from a dedicated `staging` branch, using Preview environment variables scoped to that branch so that UAT has its own configuration and its own database. Vercel Custom Environments are not required and are not available on the current plan. Production and UAT run the same release against separate databases. No live deployment configuration is created in this phase, and the prohibition above on a production-domain release remains.

**What it means**
- Clients are separated by infrastructure, which the security section now says plainly. Site partitioning stays server-side.
- It adds a release process: a long-lived `staging` branch, promotion to production only from the approved release, and a record of which version each client runs.
- It is verified, not assumed: Vercel's documentation states that only Preview variables can target a Git branch, and the team's limit for Custom Environments is **0**, so the branch-variable approach is also the only available one on this plan.
- Each client still gets its own project and its own databases. That is more to operate than a shared platform, by design.
- The prototype-phase rule against a production-domain release is unchanged.

---

## Decision record

| # | Approve | Amend | Reject | Notes |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

Until a decision is recorded, the specifications stand as written and this document is only a proposal.
