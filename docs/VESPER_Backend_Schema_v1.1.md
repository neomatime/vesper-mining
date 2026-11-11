# VESPER 3.0 — Backend Schema Document

**HIMARK SGC**  
**DATA ARCHITECTURE / MINING TECHNOLOGY**

**THE MINING OPERATING SYSTEM**

Identify delays. Prevent avoidable waiting.  
Recover productive time.

| **VERSION** | **1.1**                              |
|-------------|--------------------------------------|
| **DATE**    | **10 NOVEMBER 2026**                 |
| **STATUS**  | **REVISED DRAFT - APPROVAL PENDING** |

**CURRENT DEVELOPMENT AUTHORISATION**

Schema definition and simulated frontend data only.  
No live database, production backend or mining integrations.

## Document control

| **ORGANISATION**     | HIMARK SGC                                                                                                          |
|----------------------|---------------------------------------------------------------------------------------------------------------------|
| **PRODUCT**          | VESPER - The Mining Operating System                                                                                |
| **DOCUMENT**         | Backend Schema and Data Architecture Document                                                                       |
| **VERSION / STATUS** | 1.1 / Revised draft - approval pending                                                                              |
| **PREPARED ON**      | 2 November 2026                                                                                                     |
| **CURRENT PHASE**    | Future backend data model; UI/UX simulation only                                                                    |
| **NEXT DELIVERABLE** | Aligned mock contracts for the UI/UX prototype                                                                      |
| REVISION 1.1         | 10 November 2026 - Core Mobile included; conceptual entitlement data dictionary clarified; no production migration. |

## Contents

| **01** Document Purpose, Authority and Boundaries          | **11** Workforce, Shift Execution and Handover               |
|------------------------------------------------------------|--------------------------------------------------------------|
| **02** Backend Context and Data Ownership                  | **12** Production Measures, Reports and Derived Metrics      |
| **03** Data Conventions and Field Standards                | **13** Notifications, Attachments and User Activity          |
| **04** Entity Relationship Overview                        | **14** External Integrations, Provenance and Synchronisation |
| **05** Organisation, Identity and Commercial Entitlements  | **15** Audit Events and Change Reconstruction                |
| **06** Sites, Map Plans and Operational Areas              | **16** Constraints, Indices and Performance Design           |
| **07** Equipment, Location and Meter Readings              | **17** Security, Privacy and Operational Safety              |
| **08** Operational Issues, Actions and Dependencies        | **18** Prototype Contract Mapping and Data Fixtures          |
| **09** Maintenance, Downtime and Delay Intelligence        | **19** Representative SQL Contract and Data Dictionary Notes |
| **10** Resource Readiness, Parts and Purchasing References | **20** Validation, Open Decisions and Sign-Off               |


## 1. Document Purpose, Authority and Boundaries

### 1.1 Purpose

This Backend Schema Document (BSD) defines VESPER's proposed persistent domain model and associated data-integrity contract. Its purpose is to ensure the UI prototype's mock records, identifiers, status transitions and data contracts are compatible with a future production backend. It describes **what information VESPER must represent and protect**, not permission to create a live database.

It complements the PRD (business behaviour) and the TRD (frontend implementation). The frontend TRD remains the authority for visual design, motion, routing, mock APIs and testing. This document is the authority for the proposed logical schema, entity ownership, field semantics, relationships, quality, auditability and future integration boundaries, subject to formal approval.

### 1.2 Non-Negotiable Development Boundary

**Current phase:** Define the schema, use aligned TypeScript/Zod types, and populate deterministic, fictional fixtures through the existing mock service architecture. **Do not provision PostgreSQL, create production migrations, deploy backend services, connect actual mine systems, collect real personnel data or start background ingestion during this phase.**

Proposed SQL in this document is illustrative engineering reference only. A real migration requires a later, separately approved backend architecture/security review and migration plan.

### 1.3 Design Principles

- **Tenant isolation by design:** Every tenant-owned entity is linked to an organisation; site records are further scoped to the correct mine site.

- **Existing systems remain authoritative:** Maintenance work orders, inventory balances, procurement commitments, telemetry and safety clearances are referenced or integrated rather than silently duplicated as competing sources of truth.

- **Time and source matter:** Preserve occurrence time, observation time, receipt time and source details separately where they differ.

- **Uncertainty is explicit:** Unknown, stale, reported and verified are distinct from operational status and must not be collapsed into one field.

- **No inferred safety authority:** Production readiness and authorised safety/operational release remain separate concepts.

- **Event history before attractive dashboards:** Changes must be explainable and reconstructable; dashboards are derived views, not primary evidence.

- **Human authorisation:** Purchase, maintenance completion and equipment release remain subject to approved human processes.

- **Minimal sensitive data:** Store only what the product needs, with defensible retention and access controls.

### 1.4 Technical Decision Register

| **ID**     | **Proposed decision**                                                 | **Design consequence**                                                           |
|------------|-----------------------------------------------------------------------|----------------------------------------------------------------------------------|
| BSD-ADR-01 | PostgreSQL as relational system of record                             | Enforce foreign keys, transactions, checks and queryable history                 |
| BSD-ADR-02 | UUID primary keys; unique tenant-scoped business codes                | Stable IDs across API and mock fixtures; no code-as-identity assumptions         |
| BSD-ADR-03 | Organisation + site scope on applicable records                       | Consistent tenancy and stronger cross-site foreign-key checks                    |
| BSD-ADR-04 | Explicit operational events with immutable history                    | Explain state changes and support reliable reports                               |
| BSD-ADR-05 | Approved source provenance and quality metadata                       | Distinguish actual, reported, estimated and unknown values                       |
| BSD-ADR-06 | External source mappings, not shadow master systems                   | Preserve CMMS/ERP/fleet ownership of authoritative facts                         |
| BSD-ADR-07 | Polygon data in site-plan coordinates for v1                          | Do not confuse diagram pixels with surveyed geospatial positions                 |
| BSD-ADR-08 | Optional PostGIS for future real geospatial use cases                 | Introduce only after geographic requirements and source accuracy are validated   |
| BSD-ADR-09 | Attachments in controlled object storage, not binary database columns | Keep relational store focused on metadata and references                         |
| BSD-ADR-10 | Row-level security as defence in depth                                | No substitution for service-layer authorisation, site grants or security testing |

## 2. Backend Context and Data Ownership

### 2.1 Logical Architecture

The future target has five conceptual layers: (1) client applications and validated APIs; (2) operational domain services and policy evaluations; (3) a PostgreSQL transactional database and attachment metadata; (4) approved integration adapters into authoritative external systems; and (5) reporting projections generated from verified facts and recorded events.

The UI-only phase substitutes a single deterministic in-memory mock domain store for layers (2)-(4). It must preserve the same entity identities, time semantics, status meanings and relationships specified here.

### 2.2 System-of-Record Matrix

| **Information**                                 | **Expected system of record**                     | **VESPER persistence responsibility**                                                 |
|-------------------------------------------------|---------------------------------------------------|---------------------------------------------------------------------------------------|
| Organisations, site access, VESPER entitlements | VESPER commercial/identity control plane          | Local tenant, membership, scope and entitlement records                               |
| VESPER issues, dependencies, handovers          | VESPER                                            | Primary records, history, acknowledgements and evidence references                    |
| Maintenance work orders and OEM service plans   | Mine CMMS or approved maintenance authority       | References, approved read models, local coordination notes                            |
| Spare-parts balances, reservations and orders   | Mine ERP/stores/procurement                       | Timestamped sourced snapshots and purchasing review actions                           |
| Machine telemetry, meter readings               | Approved fleet/OEM/OT system                      | Sourced observations with validity and units                                          |
| Site map boundary and operational areas         | Mine-approved plans and HIMARK site configuration | Versioned map assets, polygons and operational status evaluations                     |
| Safety release or permit                        | Mine-approved safety control system and personnel | At most a referenced, explicitly verified clearance status; never issue authorisation |
| Reports and operational metrics                 | Derived from underlying sources                   | Definitions, calculation versions and evidence-linked projections                     |

### 2.3 Proposed PostgreSQL Namespaces

Use logical schema groups for conceptual clarity: identity, sites, operations, maintenance, resources, shifts, insights, integrations, audit and commercial. Physical PostgreSQL namespaces are optional; the production team may initially use a single schema with domain-prefixed table names to reduce migration complexity. **Domain ownership and clear naming are required; multiple physical databases are not.**

## 3. Data Conventions and Field Standards

### 3.1 Naming, Keys and Types

| **Convention**    | **Standard**                                                                          |
|-------------------|---------------------------------------------------------------------------------------|
| Table naming      | Lowercase plural snake_case, e.g. operational_issues                                  |
| Column naming     | Lowercase snake_case; FK names end with \_id                                          |
| Primary key       | id uuid generated by an approved database or application UUID strategy                |
| Tenant ownership  | organisation_id uuid NOT NULL for tenant-owned records                                |
| Site ownership    | site_id uuid NOT NULL for site-specific records, constrained to same organisation     |
| Event times       | timestamptz stored as UTC instants; display using the site's IANA time zone           |
| Quantities        | numeric with explicit nonnegative checks and an associated unit where applicable      |
| Durations         | Integer seconds or numeric hours with explicit unit; do not store "2h 30m"            |
| Currencies        | ISO currency code plus numeric(18,2) for money; amounts are never assumed profit      |
| Geo polygons      | Validated JSON coordinate arrays in known map-plan pixel space for initial site maps  |
| Flexible payloads | jsonb only for bounded external payloads/metadata with documented schema version      |
| Soft deletion     | archived_at for relevant master records; operational evidence is not silently deleted |
| Status fields     | Explicit domain-specific code; workflow transition rules handled by approved policy   |

### 3.2 Shared Row Metadata

Every mutable primary business record should carry created_at, updated_at, created_by_user_id where meaningful and a concurrency row_version or equivalent optimistic-lock token. Site-bound records also carry organisation_id and site_id even if derivable through a parent, where it provides robust scoping and efficient filters.

A sourced observation or imported fact should also capture observed_at, received_at, source_system_id, source_record_key, quality_state, and verification_reference or actor where applicable. Do not require nonexistent telemetry fields on native UI-only records; store appropriate provenance per fact category.

### 3.3 Two Independent Status Dimensions

**Operational state** can be on_plan, at_risk, blocked or unknown. **Information quality** can be reported, verified, pending, stale, conflicting, unknown or pending_sync. A record might be blocked with reported quality. Neither dimension substitutes for the other.

**Rule:** Unknown or stale measurements must remain null or explicitly unavailable, never converted to zero. verified means verified by a defined source/process and does not necessarily authorise equipment operation.

### 3.4 Time Semantics

Use occurred_at for the actual event time where established, observed_at for reading/inspection time, received_at for arrival into VESPER, recorded_at for persistent record creation and effective_at for when a change takes effect. The API must never overwrite an observed timestamp with server receipt time. Clock skew, late arrivals and corrected timestamps require visible provenance.

### 3.5 Integrity and Referential Scope

- Every site belongs to exactly one organisation.

- A site-scoped foreign key must point to a row within the same organisation and site (prefer composite unique/FK contracts where feasible).

- Business identifiers such as asset codes are unique **within their declared scope**, not assumed globally unique.

- No cascading deletion of incident evidence, audit events or historical handovers.

- Source identifiers and client idempotency keys are unique in their explicit tenant-and-source scope.

- No update to imported inventory snapshots may be mistaken for the ERP's own stock transaction.

## 4. Entity Relationship Overview

### 4.1 Top-Level Cardinalities

| **Parent (1)**        | **Child (many)**                                | **Relationship rule**                                                        |
|-----------------------|-------------------------------------------------|------------------------------------------------------------------------------|
| Organisation          | Sites                                           | Tenant owns one or more mine sites                                           |
| Organisation          | Memberships, subscriptions, integrations        | Organisational commercial and security scope                                 |
| Site                  | Areas, equipment, shifts, issues                | Site-local operational scope                                                 |
| Equipment             | Meter observations and maintenance plans        | A machine can have multiple dated readings and plans                         |
| Operational issue     | Actions, dependencies, events, evidence         | One issue can require several distinct responses                             |
| Maintenance activity  | Resource/part requirements and readiness checks | A job has multiple requirements and assessments                              |
| Stock source/snapshot | Part at a site and point in time                | Balances are observations, not double-booked transactions                    |
| Shift                 | Handover                                        | Outgoing shift has zero or more handover versions; one accepted final record |
| Handover              | Linked issue references                         | Handover does not create a duplicate issue                                   |
| Organisation          | Report definitions and projections              | Reports belong to tenant and authorised site scope                           |

### 4.2 Reference Relationship Diagram

The accompanying diagram groups critical entity relationships; it is **logical** rather than a full physical ERD. The numbered data dictionaries below provide authoritative relationship detail. Polymorphic external reference records are not a replacement for typed foreign keys on critical domain relationships.

![Conceptual VESPER data relationship diagram. Organisations contain sites; sites contain operating areas, equipment, shifts, issues and stock views. Equipment links to maintenance and required parts; issues link to actions and events; external sources supply evidence; reporting is derived from these entities.](VESPER_assets/Backend_Schema/media/image1.png)

Figure 1. Core VESPER entities and their logical relationships.

## 5. Organisation, Identity and Commercial Entitlements

### 5.1 Tenant and Access Tables

| **Table**                     | **Essential columns and types**                                                                             | **Key constraint / purpose**                                                                                               |
|-------------------------------|-------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| organisations                 | id uuid, code text, legal_name text, display_name text, status text, created_at timestamptz                 | Unique organisation code; tenant root                                                                                      |
| sites                         | id uuid, organisation_id uuid, site_code text, name text, timezone text, status text                        | Unique (organisation_id, site_code); known IANA zone                                                                       |
| users                         | id uuid, identity_subject text, display_name text, email text, status text                                  | Global identity; minimised personal data                                                                                   |
| organisation_memberships      | id uuid, organisation_id uuid, user_id uuid, membership_status text                                         | Unique active membership per organisation/user                                                                             |
| roles                         | id uuid, organisation_id uuid NULL, role_code text, role_name text                                          | Platform templates or organisation-configured roles                                                                        |
| permissions                   | code text, description text, module text                                                                    | Controlled capability catalogue                                                                                            |
| role_permissions              | role_id uuid, permission_code text                                                                          | Explicit role-to-permission mapping                                                                                        |
| membership_role_assignments   | membership_id uuid, role_id uuid, site_id uuid NULL, granted_at timestamptz                                 | Organisation-wide or site-scoped grants; same tenant check                                                                 |
| subscriptions                 | id uuid, organisation_id uuid, plan_code text, starts_at timestamptz, ends_at timestamptz NULL, status text | One active governing subscription policy per effective period                                                              |
| subscription_entitlements     | subscription_id uuid, feature_code text, enabled boolean, site_limit int NULL                               | Core Mobile essential field access on all active plans; approved advanced workflow/report entitlements and site allowances |
| subscription_site_allocations | subscription_id uuid, site_id uuid, starts_at timestamptz, ends_at timestamptz NULL                         | Active site count within contracted allowance                                                                              |

### 5.2 Membership and Role Rules

A user's right to access a record requires: active identity, active organisation membership, an appropriate role permission, an authorised site scope and the relevant subscribed feature entitlement. A UI-hidden button is never a security boundary. Future APIs must re-evaluate every read and write in the authenticated request context.

Commercial entitlement baseline (revision 1.1): every active VESPER subscription, including Core, includes the essential mobile field experience for authorised users at allocated sites. Feature flags may restrict approved expanded workflows, but must not deny basic issue reporting, assigned work, issue tracking, notifications or simulated offline status solely because the plan is Core. Role/site/organisation permissions remain independent guards.

The demo entitlement catalogue must expose stable feature codes for essential mobile access and optional expanded capabilities. The proposed future schema remains conceptual; this change does not authorise database provisioning, production migration or live identity enforcement.

Role assignment scope must not permit membership from organisation A to obtain access to organisation B's site. Role definitions may be shared templates, but tenant-custom roles must remain isolated.

### 5.3 HIMARK Reserve Integration

The proposed Reserve benefit is a commercial policy record or externally managed contract entitlement, **not a second VESPER product, tenant or licence database**. A client with qualifying Reserve status may be granted one Operations Single Site allocation under a defined, revocable subscription-benefit rule. A contract-reference field can link to HIMARK's authorised commercial source, but VESPER must not infer eligibility from an unverified free-text flag.

## 6. Sites, Map Plans and Operational Areas

### 6.1 Spatial and Status Tables

| **Table**                  | **Essential columns and types**                                                                                                                                                                     | **Key constraint / purpose**                        |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| site_plan_versions         | id uuid, organisation_id uuid, site_id uuid, version_number int, asset_uri text, pixel_width int, pixel_height int, approved_at timestamptz NULL                                                    | Immutable plan versions, no implicit GPS            |
| operating_areas            | id uuid, organisation_id uuid, site_id uuid, area_code text, name text, parent_area_id uuid NULL                                                                                                    | Unique area code per site; parent must be same site |
| area_plan_polygons         | id uuid, area_id uuid, site_plan_version_id uuid, polygon_coordinates jsonb, geometry_version int                                                                                                   | Coordinates in referenced image/pixel space         |
| area_status_evaluations    | id uuid, organisation_id uuid, site_id uuid, area_id uuid, operational_status text, quality_state text, reason_code text, rule_version text, evaluated_at timestamptz, valid_until timestamptz NULL | Append history; status requires basis and freshness |
| area_status_inputs         | evaluation_id uuid, issue_id uuid NULL, source_record_id uuid NULL, input_role text                                                                                                                 | Evidence linking a map state to its inputs          |
| equipment_area_assignments | equipment_id uuid, area_id uuid, effective_from timestamptz, effective_to timestamptz NULL                                                                                                          | Assigned area, **not** verified live GPS position   |

### 6.2 Map Status Calculation

The map never sets an area green solely because no fault was reported. Red requires a verified blocking condition for the configured operation. Yellow denotes a documented risk, deviation or review; grey denotes missing, stale or conflicting information. Overlapping area hierarchy requires explicit scope rules: a blocked excavator does not necessarily block an entire pit.

A status evaluation is a **derived, reproducible decision**. Store its rule/version, source inputs, evaluation time and an explanation. For a high-volume implementation, maintain a replaceable latest-status projection in addition to historical evaluations; do not erase evaluation history.

### 6.3 Geometry Integrity

Initial polygons are site-plan/image coordinates, validated against the plan's dimensions, not geographic longitude/latitude. Store point order, closure, minimum vertices and plan-version link; reject self-intersecting or out-of-bounds configurations through validation. If future approved GPS geometry is introduced, store it distinctly with an explicit coordinate reference system and consider PostGIS; never mix image coordinates and geographical SRIDs in one column.

## 7. Equipment, Location and Meter Readings

### 7.1 Equipment Data Dictionary

| **Field**                 | **Type**    | **Required** | **Meaning / rule**                                    |
|---------------------------|-------------|--------------|-------------------------------------------------------|
| id                        | uuid        | Yes          | Stable equipment identifier                           |
| organisation_id / site_id | uuid        | Yes          | Tenant and mine-site ownership                        |
| asset_code                | text        | Yes          | Unique within site, e.g. EX-204                       |
| equipment_type            | text        | Yes          | Controlled category, not free-form magic logic        |
| model_reference           | text        | No           | Manufacturer/model reference; source retained         |
| reported_state            | text        | Yes          | Operational state of equipment as reported or sourced |
| state_quality             | text        | Yes          | Verified/reported/stale/unknown etc.                  |
| last_observed_at          | timestamptz | No           | Last valid source observation                         |
| external_asset_ref_id     | uuid        | No           | Mapping to authoritative equipment register           |
| archived_at               | timestamptz | No           | Preserve history, prevent silent deletion             |

### 7.2 Equipment Tables

| **Table**                    | **Essential columns and types**                                                                                                          | **Key constraint / purpose**                               |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| equipment                    | Fields in 7.1 plus created_at, updated_at, row_version                                                                                   | Unique (organisation_id, site_id, asset_code)              |
| equipment_state_observations | equipment_id uuid, reported_state text, quality_state text, observed_at timestamptz, received_at timestamptz, source_system_id uuid NULL | Event-based state evidence; no unsourced live claim        |
| equipment_meter_readings     | equipment_id uuid, meter_type text, meter_value numeric(18,3), unit text, observed_at timestamptz, source_system_id uuid NULL            | Values are nonnegative; distinguish actual from estimated  |
| equipment_area_assignments   | See 6.1                                                                                                                                  | Assigned area over time, not continuous location telemetry |

### 7.3 Equipment and Meter Rules

Meter types and units must be controlled (e.g. engine_hours measured in hours). A lower new reading may represent rollover, replacement, correction or bad data; it must not silently reset the planned maintenance clock. Imported readings require deduplication by source key or defined meter identity and observation time.

Actual position tracking, high-frequency sensor storage and predictive diagnostics are not part of this schema's initial implementation commitment. They require separate OT/security and data-volume decisions.

## 8. Operational Issues, Actions and Dependencies

### 8.1 Operational Issue - Core Record

| **Field**                   | **Type**    | **Required** | **Meaning / rule**                                       |
|-----------------------------|-------------|--------------|----------------------------------------------------------|
| id                          | uuid        | Yes          | Stable issue identity shared across all workspaces       |
| organisation_id / site_id   | uuid        | Yes          | Authoritative scope for issue access                     |
| issue_number                | text        | Yes          | Human-readable unique code within site                   |
| title / description         | text        | Title yes    | Concise description and details                          |
| category_code               | text        | Yes          | Controlled issue category                                |
| workflow_state              | text        | Yes          | Reported, reviewed, assigned, in progress, waiting, etc. |
| priority_code               | text        | Yes          | Priority definition from approved site rules             |
| equipment_id / area_id      | uuid        | No           | Optional same-site references                            |
| reported_by_membership_id   | uuid        | No           | User or integrated source provenance                     |
| current_owner_membership_id | uuid        | No           | One accountable owner, if assigned                       |
| reported_at / occurred_at   | timestamptz | Reported yes | Do not assume report time equals occurrence time         |
| quality_state               | text        | Yes          | Evidence trust dimension, independent of status          |
| row_version                 | integer     | Yes          | Detect conflicting concurrent edits                      |

### 8.2 Issue and Workflow Tables

| **Table**           | **Essential columns and types**                                                                                                                                    | **Key constraint / purpose**                                              |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| operational_issues  | Fields in 8.1 plus created_at, updated_at, closed_at NULL                                                                                                          | Site scoped; no automatic closure on repair completion                    |
| issue_actions       | id uuid, issue_id uuid, owner_membership_id uuid NULL, action_type text, state text, due_at timestamptz NULL, completed_at timestamptz NULL                        | Distinct actions under one issue                                          |
| issue_dependencies  | id uuid, issue_id uuid, blocked_action_id uuid NULL, blocking_action_id uuid NULL, dependency_type text, state text                                                | Same-site references; prevent self-dependency and cycles when enforceable |
| issue_events        | id uuid, issue_id uuid, event_type text, previous_state text NULL, next_state text NULL, occurred_at timestamptz, recorded_at timestamptz, actor_user_id uuid NULL | Append-only transition/evidence history                                   |
| issue_evidence      | id uuid, issue_id uuid, attachment_id uuid, evidence_type text, submitted_at timestamptz                                                                           | Evidence metadata; access inherited from issue                            |
| issue_verifications | id uuid, issue_id uuid, verification_kind text, result text, verifier_membership_id uuid, verified_at timestamptz                                                  | Human or approved-source verification trail                               |
| escalation_records  | id uuid, issue_id uuid, rule_code text, reason text, triggered_at timestamptz, acknowledged_at timestamptz NULL                                                    | Track management visibility without sending emergency alarms              |

### 8.3 State Transition and Authorisation Contract

Proposed issue states: reported, under_review, assigned, in_progress, awaiting_dependency, resolution_reported, verified, closed, and cancelled_or_duplicate. Allowed transitions must be versioned policy rather than unrestricted writes. resolution_reported does not mean the asset is safe or authorised to operate; the latter is an external human/safety process with separately recorded references.

Changes to ownership, severity, status and verification generate issue_events. Avoid a dual-source-of-truth problem by treating the issue row as a current-state projection and the event history as the explanation for changes.

### 8.4 Dependency Semantics

For action-to-action dependencies, blocked_action_id cannot equal blocking_action_id. External prerequisites (supplier, permits, parts) should use a controlled dependency type and a typed external/source link; do not invent a local purchase order or safety permit as if VESPER owns it. Unresolved dependencies remain open across shift changes.

## 9. Maintenance, Downtime and Delay Intelligence

### 9.1 Maintenance and Downtime Tables

| **Table**                      | **Essential columns and types**                                                                                                                                        | **Key constraint / purpose**                                  |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|
| maintenance_plans              | id uuid, equipment_id uuid, plan_code text, plan_version text, authoritative_source_id uuid NULL, active_from timestamptz                                              | Approved plans sourced/maintained by authorised system        |
| maintenance_triggers           | maintenance_plan_id uuid, trigger_type text, meter_type text NULL, threshold_value numeric NULL, scheduled_at timestamptz NULL                                         | Hours or calendar triggers; trigger logic explicit            |
| maintenance_activities         | id uuid, equipment_id uuid, maintenance_plan_id uuid NULL, scheduled_start timestamptz NULL, due_at timestamptz NULL, state text, external_work_order_ref_id uuid NULL | One planned job may reference CMMS work order                 |
| maintenance_activity_events    | id uuid, maintenance_activity_id uuid, event_type text, occurred_at timestamptz, recorded_at timestamptz                                                               | Preparation, work, repair, verification and return milestones |
| equipment_downtime_periods     | id uuid, equipment_id uuid, issue_id uuid NULL, unavailable_from timestamptz, unavailable_until timestamptz NULL, basis text                                           | Distinct unavailable periods; no implied production loss      |
| delay_stage_intervals          | id uuid, downtime_period_id uuid, stage_code text, started_at timestamptz, ended_at timestamptz NULL, reason_code text NULL, quality_state text                        | Time breakdown, distinguish active work and waiting           |
| operational_release_references | id uuid, maintenance_activity_id uuid, external_authority_ref text, verified_by_user_id uuid NULL, verified_at timestamptz NULL                                        | Reference evidence only, not VESPER-granted safety clearance  |

### 9.2 Maintenance Due Calculation

An approved hour-based trigger supports: hours_remaining = due_meter_hours - last_valid_observed_meter_hours. A display estimate of days remaining may use observed utilisation: hours_remaining / average_hours_per_day. Calendar-based services use the authorised due date. Multiple active triggers require an explicit governing policy. A missing, stale or conflicting meter reading yields unknown or needs_review, **not a fabricated due date**.

The numeric calculation belongs to a future rules service. The UI-only phase simulates it deterministically from fixture inputs and preserves the input values in the mock contract.

### 9.3 Downtime Integrity

Store timestamped stage events and derived intervals separately. Never sum overlapping intervals as if mutually exclusive. Partial stage records must remain incomplete rather than forcing a false exact total. Classifying an interval as waiting does **not** prove it was avoidable. Classifying equipment as unavailable does **not** prove lost production; any economic attribution requires additional throughput and counterfactual evidence.

### 9.4 Closure Rules

repair_completed_at, authorised_release_verified_at and operation_resumed_at are separate timestamps and events. Neither repair completion nor VESPER issue closure should automatically set the equipment's safety status to cleared or the area status to green.

## 10. Resource Readiness, Parts and Purchasing References

### 10.1 Core Resource Tables

| **Table**                    | **Essential columns and types**                                                                                                                                             | **Key constraint / purpose**                                     |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| parts_catalogue              | id uuid, organisation_id uuid, part_code text, description text, manufacturer_reference text NULL, unit_of_measure text                                                     | Unique approved part code per tenant; external catalogue mapping |
| equipment_part_applicability | equipment_model_ref text, part_id uuid, applicability_basis text, source_system_id uuid NULL                                                                                | Compatibility evidence; never guess part fitment                 |
| activity_part_requirements   | id uuid, maintenance_activity_id uuid, part_id uuid, required_quantity numeric, required_by timestamptz, requirement_quality text                                           | One requirement per activity/part/line revision                  |
| activity_other_requirements  | id uuid, maintenance_activity_id uuid, resource_type text, description text, required_by timestamptz                                                                        | Labour, tools and verified work prerequisites                    |
| stock_snapshots              | id uuid, organisation_id uuid, site_id uuid, part_id uuid, on_hand numeric NULL, reserved numeric NULL, allocated numeric NULL, snapshot_at timestamptz, quality_state text | Sourced inventory snapshot; NULL means unknown                   |
| supplier_lead_time_records   | id uuid, organisation_id uuid, part_id uuid, supplier_ref text, duration_days numeric, calendar_basis text, confirmed_at timestamptz                                        | Source-and-date-controlled lead time                             |
| purchase_order_references    | id uuid, organisation_id uuid, site_id uuid, external_ref text, supplier_ref text, status text, source_system_id uuid                                                       | Read-only imported purchasing reference                          |
| purchase_order_lines         | purchase_order_ref_id uuid, part_id uuid, ordered_quantity numeric, expected_arrival_at timestamptz NULL, line_status text                                                  | Avoid duplicate buys; no assumption of certain delivery          |
| readiness_assessments        | id uuid, maintenance_activity_id uuid, assessment_state text, evaluated_at timestamptz, rule_version text, quality_state text                                               | Historical assessment with evidence                              |
| readiness_assessment_items   | assessment_id uuid, part_requirement_id uuid NULL, other_requirement_id uuid NULL, finding_code text, rationale text                                                        | Per-requirement result; exactly one target type                  |
| parts_warning_records        | id uuid, maintenance_activity_id uuid, part_requirement_id uuid, warning_state text, latest_review_at timestamptz NULL, reason_code text, input_assessment_id uuid          | Purchase-review alert, not a purchase order                      |
| purchase_review_actions      | id uuid, warning_id uuid, reviewer_membership_id uuid, review_outcome text, recorded_at timestamptz                                                                         | Record acknowledgement/recommendation only                       |

### 10.2 Stock Calculation Boundaries

The default conceptual calculation is potentially_allocable = on_hand - reserved - allocated. **This formula may only be used if the authoritative ERP defines reserved and allocated as mutually exclusive quantities.** If one number already includes the other, use the ERP-specific mapping contract to avoid double subtraction. Negative values indicate source or mapping inconsistencies and require review, not silent clamping.

Inbound stock remains separate. Only source-confirmed inbound inventory arriving on/before the required date may be considered in a conditional readiness assessment. An open purchase order is not equivalent to delivered, allocable stock.

### 10.3 Purchasing Deadline Rule

indicative_latest_order_date = required_by - confirmed_supplier_lead_time - approved_planning_buffer, explicitly stating whether lead times are business or calendar days. If the supplier lead time is unconfirmed, the system must request confirmation rather than invent a precise deadline. Existing purchase orders, site transfer options and equipment compatibility are considered before raising a review warning.

### 10.4 Warning States and Human Control

Approved states for the recommendation record may include needs_confirmation, shortage_risk, inbound_review, ready, overdue and resolved. They are not procurement approvals. Site managers receive only escalated material operational risks; planners, stores and procurement receive detailed routine checks. The system must **never** automatically submit purchases or change an external ERP order in the initial scope.

## 11. Workforce, Shift Execution and Handover

### 11.1 Shift Data Tables

| **Table**                    | **Essential columns and types**                                                                                    | **Key constraint / purpose**                                |
|------------------------------|--------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| shift_patterns               | id uuid, site_id uuid, name text, local_start time, duration_minutes int                                           | Template; time-zone semantics explicit                      |
| shifts                       | id uuid, organisation_id uuid, site_id uuid, starts_at timestamptz, ends_at timestamptz, state text                | Exact UTC instants for each shift occurrence                |
| shift_assignments            | shift_id uuid, membership_id uuid, assignment_role text, equipment_id uuid NULL, area_id uuid NULL                 | Scope-validated association; not safety/attendance approval |
| shift_handover_records       | id uuid, outgoing_shift_id uuid, incoming_shift_id uuid, revision_number int, status text, prepared_at timestamptz | One accountable handover; revisions traceable               |
| shift_handover_items         | id uuid, handover_id uuid, issue_id uuid NULL, action_id uuid NULL, note text, status_at_handover text             | Linked unresolved record; never duplicate underlying issue  |
| handover_acknowledgements    | handover_id uuid, acknowledging_membership_id uuid, acknowledged_at timestamptz                                    | Who acknowledged receipt and when                           |
| attendance_source_references | id uuid, shift_id uuid, membership_id uuid, source_record_id uuid, observed_at timestamptz                         | Approved read-only integration reference if needed later    |

### 11.2 Shift Rules

An incoming shift begins with a new identity even if its times overlap a preceding shift. Handover items link to unresolved issues rather than creating new faults. Acknowledgement confirms receipt only; it cannot close an issue, confer a competency, confirm fitness for work or grant operational permission. Existing biometric/attendance systems remain authoritative.

## 12. Production Measures, Reports and Derived Metrics

### 12.1 Reporting Tables

| **Table**               | **Essential columns and types**                                                                                                                 | **Key constraint / purpose**                |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| production_targets      | id uuid, site_id uuid, metric_code text, period_start timestamptz, period_end timestamptz, target_value numeric, unit text                      | Versioned targets by site/time/measure      |
| production_measurements | id uuid, site_id uuid, metric_code text, measured_value numeric, unit text, observed_at timestamptz, quality_state text                         | Measured values with source and quality     |
| metric_definitions      | id uuid, organisation_id uuid, metric_code text, metric_version text, expression_reference text, unit text                                      | Calculation semantics and provenance        |
| metric_calculation_runs | id uuid, metric_definition_id uuid, window_start timestamptz, window_end timestamptz, computed_at timestamptz, input_hash text                  | Reproducibility of derived analysis         |
| metric_results          | calculation_run_id uuid, site_id uuid, value numeric NULL, quality_state text, evidence_ref text NULL                                           | Null means unknown, never silently zero     |
| report_snapshots        | id uuid, organisation_id uuid, site_id uuid NULL, report_key text, produced_at timestamptz, definition_version text, data_quality_summary jsonb | Optional materialised presentation snapshot |

### 12.2 Production Recovery and Economic Claims

Unavailable equipment hours, avoided waiting hours, throughput, revenue and profit are distinct measures. Do not store an unqualified money_saved field on an operational issue. Any economic estimate must identify its unit/currency, method/version, source inputs, horizon, confidence and whether it is **estimated**, **validated** or **realised**. A true realised benefit claim requires an approved measurement methodology and baseline.

### 12.3 Reporting and Projection Policy

Operational dashboards and report cards are projections derived from scoped primary entities or approved external measurements. Store definitions/versioning and calculation history when decisions depend on them. Users must be able to open the underlying supporting records. Advanced reporting entitlements govern access, not separate reporting databases per price tier.

## 13. Notifications, Attachments and User Activity

### 13.1 Supporting Tables

| **Table**                      | **Essential columns and types**                                                                                                                        | **Key constraint / purpose**                          |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| notifications                  | id uuid, organisation_id uuid, site_id uuid NULL, type_code text, subject_entity_type text, subject_entity_id uuid, created_at timestamptz             | Event-linked user notice, not a safety alarm          |
| notification_recipients        | notification_id uuid, membership_id uuid, read_at timestamptz NULL, dismissed_at timestamptz NULL                                                      | Recipient-specific state; no global read flag         |
| notification_delivery_attempts | id uuid, notification_id uuid, channel_code text, attempted_at timestamptz, delivery_state text                                                        | Future optional delivery telemetry                    |
| attachments                    | id uuid, organisation_id uuid, site_id uuid NULL, object_key text, content_type text, size_bytes bigint, checksum text, uploaded_by_user_id uuid NULL  | File metadata, safe access and retention              |
| activity_log_entries           | id uuid, organisation_id uuid, site_id uuid NULL, actor_user_id uuid NULL, verb_code text, subject_type text, subject_id uuid, occurred_at timestamptz | User-readable history subset, distinct from audit log |

### 13.2 Notification Policy

A notification must point to a valid scoped subject, be visible only to an authorised recipient and deep-link to the correct workspace. If the underlying risk is resolved or the user's access is removed, the UI must update or block that notification appropriately. No design should suggest ordinary in-app alerts are guaranteed safety-critical or emergency communications.

### 13.3 Attachment Policy

The future API validates content type, size, scanning status and authorised access to the parent record. Store only object keys and metadata in PostgreSQL; keep actual files in a controlled object store. A file from site A must not be available through a copied URL or guessed identifier in site B. Avoid including real mine plans or employee images in prototype fixtures.

## 14. External Integrations, Provenance and Synchronisation

### 14.1 Integration Tables

| **Table**                | **Essential columns and types**                                                                                                                              | **Key constraint / purpose**                                          |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| source_systems           | id uuid, organisation_id uuid, system_code text, system_type text, status text, last_verified_at timestamptz                                                 | Approved integration registry; do not store secret credentials inline |
| external_record_mappings | id uuid, source_system_id uuid, external_entity_type text, external_key text, internal_entity_type text, internal_entity_id uuid                             | Unique source/entity/external key; typed resolution review            |
| ingestion_batches        | id uuid, source_system_id uuid, started_at timestamptz, ended_at timestamptz NULL, result_state text                                                         | Future ingestion observability                                        |
| ingested_events          | id uuid, source_system_id uuid, external_event_key text, observed_at timestamptz, received_at timestamptz, payload_hash text, processing_state text          | Deduplicate/replay with immutable receipt facts                       |
| quality_findings         | id uuid, organisation_id uuid, site_id uuid NULL, entity_type text, entity_id uuid, finding_code text, detected_at timestamptz, resolved_at timestamptz NULL | Stale, missing, conflicting, invalid and source-issue tracking        |
| sync_cursors             | source_system_id uuid, cursor_name text, cursor_value text, updated_at timestamptz                                                                           | Future incremental integration state                                  |
| api_idempotency_records  | organisation_id uuid, actor_scope text, operation_code text, idempotency_key text, response_digest text, created_at timestamptz                              | Same operation replay cannot generate duplicate business event        |

### 14.2 Source and Freshness Rules

Maintain a field-level or record-level source identity, freshness policy and documented precedence. VESPER must not treat the latest timestamp as automatically the most authoritative fact. Late-arriving events are valid only after source reconciliation. Conflict detection should retain both input claims and an explicit resolution status.

A future ingestion event must not automatically trigger a legal purchase, write a work order to a CMMS or change a safety clearance. Those actions require separately approved integrations and authorisation controls.

### 14.3 Offline Field Operations

Future offline synchronisation must use stable client-generated record IDs, unique mutation IDs, server acknowledgement and version-aware conflict handling. pending_sync is a client/transmission state; it cannot be represented as a centrally received event. A phone showing 'saved locally' must not imply a manager has been notified. Real offline persistence and delivery guarantees are deferred from the current phase.

## 15. Audit Events and Change Reconstruction

### 15.1 Audit Tables

| **Table**            | **Essential columns and types**                                                                                                                                                                     | **Key constraint / purpose**                              |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| audit_events         | id uuid, organisation_id uuid, site_id uuid NULL, actor_user_id uuid NULL, action_code text, entity_type text, entity_id uuid, recorded_at timestamptz, before_hash text NULL, after_hash text NULL | Append-only evidence of sensitive actions                 |
| domain_events        | id uuid, organisation_id uuid, site_id uuid, aggregate_type text, aggregate_id uuid, event_type text, sequence bigint, occurred_at timestamptz, recorded_at timestamptz, payload jsonb              | Events from which relevant histories can be reconstructed |
| transactional_outbox | id uuid, organisation_id uuid, event_id uuid, event_type text, created_at timestamptz, published_at timestamptz NULL                                                                                | Future reliable service event publication; not active now |
| event_corrections    | id uuid, original_event_id uuid, correction_event_id uuid, reason_code text, authorised_by_user_id uuid, corrected_at timestamptz                                                                   | Correct without erasing the original                      |

### 15.2 What Must Be Audited

Account access changes, role grants, subscription entitlements, operational status overrides, issue assignment and closure, maintenance verification references, parts readiness assessments, purchasing reviews, map configuration changes and critical source-data corrections. Capture request trace identifiers where useful without storing passwords, authentication tokens or sensitive raw payloads unnecessarily.

### 15.3 Immutability and Retention

Audit and historical event tables are append-only under application roles. Database administrators retain controlled maintenance capabilities with independent logging and backup controls; avoid claiming absolute immutability. Record retention, legal holds, deletion/redaction of personal data, backup lifecycle and mine contractual obligations must be resolved before production. Audit streams should be partitioned/archiveable when actual volume justifies it.

## 16. Constraints, Indices and Performance Design

### 16.1 Integrity Checklist

| **Area**            | **Mandatory constraint / verification**                                                      |
|---------------------|----------------------------------------------------------------------------------------------|
| Tenancy             | Composite same-organisation/site FKs or equivalent validated database constraints            |
| Identity            | Unique identity-provider subject; membership and roles cannot cross tenants                  |
| Equipment           | Unique site asset code; no negative meter reading; preserve reading units                    |
| Issue workflow      | Legal transitions only; row-version compare; verified closure not inferred from repair event |
| Event deduplication | Unique source event key in source scope; unique idempotent request key in operation scope    |
| Readiness           | Nonnegative parts quantities; NULL means unknown; explicit stock semantics                   |
| Shifts              | ends_at \> starts_at; acknowledgement distinct from closure                                  |
| Downtime            | ended_at \> started_at when set; no accidental double-count of overlapping stages            |
| Map polygons        | Validate shape, vertex count, plan bounds and plan-version association                       |
| Reports             | Define unit, metric version, source and calculation period                                   |

### 16.2 Recommended Initial Indices (Future)

| **Table / concern**      | **Candidate index**                                                     |
|--------------------------|-------------------------------------------------------------------------|
| operational_issues       | (organisation_id, site_id, workflow_state, reported_at DESC)            |
| issue_actions            | (organisation_id, site_id, owner_membership_id, state, due_at)          |
| issue_events             | (organisation_id, site_id, issue_id, recorded_at DESC)                  |
| equipment_meter_readings | (organisation_id, site_id, equipment_id, meter_type, observed_at DESC)  |
| maintenance_activities   | (organisation_id, site_id, due_at) for upcoming schedules               |
| stock_snapshots          | (organisation_id, site_id, part_id, snapshot_at DESC)                   |
| shift_handover_items     | (organisation_id, site_id, issue_id) for continuity                     |
| notification_recipients  | (membership_id, read_at, created_at DESC) via appropriate joined access |
| domain_events            | (organisation_id, site_id, aggregate_type, aggregate_id, sequence)      |

These are candidate designs, not a mandate to create every index. Actual index selections must be reviewed against query plans, real data distributions and write rates.

### 16.3 Scaling Strategy

Start with transactional relational storage, correctly indexed queries and measured API needs. Avoid prematurely introducing a microservice mesh, event broker, time-series extension or warehouse. High-frequency equipment telemetry may eventually need distinct storage/retention policies; it is not required to design the UI-only prototype. Reporting projections should be reproducible from facts and events and scoped to each authorised mine.

## 17. Security, Privacy and Operational Safety

### 17.1 Organisation and Site Isolation

Future API requests must derive organisation and authorised site scope from the authenticated server-side security context, never trust a request body's organisation_id. Row-level security is recommended as additional protection, with explicit USING and WITH CHECK policies tested for reads and writes. Database-owner and BYPASSRLS exemptions require architectural care, role separation and deliberate FORCE ROW LEVEL SECURITY policy where appropriate. RLS does not replace application authorisation or composite reference integrity.

### 17.2 Data Classification

**Critical operational:** mine plans, asset inventories, incident locations, production figures and operational history. **Personal:** identities, membership, reporting/approval actions, possible attachments. **Sensitive security:** access assignments, source integration metadata, audit traces. **Public demo:** fictional, non-sensitive synthetic data only. Classifications must feed contractual permissions, encryption, export and retention policy.

### 17.3 POPIA and Security Design

Collect minimum necessary personal information. Document data purpose, retention, correction and authorised access. Production-readiness reviews must assess applicable South African privacy legislation, client mine policies and OT boundary requirements with qualified specialists. Encryption at rest/in transit, secure backups, secret management, intrusion monitoring and access reviews are future production acceptance gates.

### 17.4 Mining Operational Safety Boundary

The database must not contain a VESPER-controlled safe_to_operate = true shortcut interpreted as authorisation. Store only verified evidence references to official mine work-permit, release or equipment-clearance systems, with source and date. Area colour, issue closure, shift acknowledgement and a repaired-state indicator never substitute for formal safety sign-off.

## 18. Prototype Contract Mapping and Data Fixtures

### 18.1 Mapping Between Frontend and Future Persistence

| **PRD/TRD mock domain**       | **Future table owner**                                                  | **Prototype representation**                 |
|-------------------------------|-------------------------------------------------------------------------|----------------------------------------------|
| Site and demo persona         | organisations, sites, users, organisation_memberships                   | Fictional tenant, site and role profiles     |
| Operational map               | site_plan_versions, operating_areas, area_status_evaluations            | Seeded polygon geometry and status evidence  |
| Issue and actions             | operational_issues, issue_actions, issue_events, issue_dependencies     | One mutable in-memory issue aggregate        |
| Equipment and due maintenance | equipment, equipment_meter_readings, maintenance_activities             | Testable planned-service inputs              |
| Spare-parts readiness         | activity_part_requirements, stock_snapshots, readiness_assessments      | Controlled available/unknown/inbound states  |
| Shift handover                | shifts, shift_handover_records, shift_handover_items                    | Linked unresolved issue in next shift        |
| Notifications                 | notifications, notification_recipients                                  | Recipient-scoped deep links and unread state |
| Reporting                     | metric_definitions, metric_results, report_snapshots                    | Derived or labelled fictional measures       |
| Tier and site access          | subscriptions, subscription_entitlements, subscription_site_allocations | Demo entitlement decisions only              |

### 18.2 Deterministic Seed Scenarios

- **Normal operations:** Explicitly verified on-plan areas, valid readings and no confirmed blockers.

- **Equipment breakdown:** One issue linked to equipment/area; status changes affect the same map, worklist, shift and report projections.

- **Parts risk:** A verified upcoming activity requires a part whose allocable stock is insufficient; purchase/lead-time information determines a review warning.

- **Unknown inventory:** Stock quantity is null or stale; the UI must display 'Confirm stock', not 'Out of stock'.

- **Shift handover:** Original unresolved issue is linked to incoming shift without duplication or automatic closure.

- **Stale map data:** No new evidence; current area status becomes unknown according to the configured freshness rule.

- **Access restriction:** A persona cannot access another site or higher-tier report, even though the data exists in the fixture store.

### 18.3 Frontend Contract Shapes

The TRD's mock API routes remain /\_demo/api/v1 and are intercepted by MSW. TypeScript DTOs should expose camelCase fields while the conceptual database uses snake_case. A single mapping layer performs the conversion. Example: equipmentId maps to equipment.id; organisationId maps to organisation_id; observedAt is an ISO timestamp, not a locale string.

The UI prototype must **not** import SQL adapters, database clients or future migration files. It only consumes typed scenario fixtures and MSW responses. No real client, employee, mine or supplier information is required.

### 18.4 Mock Mutation Integrity

An issue status change must append a mock issue event and update relevant projections, including affected area status where applicable. A part-requirement change triggers a new simulated readiness assessment; it does not create a purchase order. Scenario reset restores the full fixture graph and all related read-models, not just the visible page.

## 19. Representative SQL Contract and Data Dictionary Notes

### 19.1 Illustrative Relational Contract

The following is a minimal example of **future** relational integrity; it is deliberately not a complete migration and must not be executed during the authorised UI phase. The full proposed logical model is specified by the tables above.

```sql
-- REFERENCE ONLY: NOT AN APPROVED DATABASE MIGRATION
CREATE TABLE organisations (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    legal_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sites (
    id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL REFERENCES organisations(id),
    site_code text NOT NULL,
    name text NOT NULL,
    timezone text NOT NULL,
    UNIQUE (organisation_id, id),
    UNIQUE (organisation_id, site_code)
);
CREATE TABLE equipment (
    id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL,
    site_id uuid NOT NULL,
    asset_code text NOT NULL,
    reported_state text NOT NULL DEFAULT 'unknown',
    state_quality text NOT NULL DEFAULT 'unknown',
    CONSTRAINT equipment_site_scope FOREIGN KEY (organisation_id, site_id)
    REFERENCES sites (organisation_id, id),
    UNIQUE (organisation_id, site_id, id),
    UNIQUE (organisation_id, site_id, asset_code)
);
CREATE TABLE operational_issues (
    id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL,
    site_id uuid NOT NULL,
    equipment_id uuid NULL,
    issue_number text NOT NULL,
    title text NOT NULL,
    workflow_state text NOT NULL DEFAULT 'reported',
    quality_state text NOT NULL DEFAULT 'reported',
    reported_at timestamptz NOT NULL,
    row_version integer NOT NULL DEFAULT 1,
    CONSTRAINT issue_site_scope FOREIGN KEY (organisation_id, site_id)
    REFERENCES sites (organisation_id, id),
    CONSTRAINT issue_equipment_scope FOREIGN KEY (organisation_id, site_id, equipment_id)
    REFERENCES equipment (organisation_id, site_id, id),
    UNIQUE (organisation_id, site_id, id),
    UNIQUE (organisation_id, site_id, issue_number),
    CHECK (row_version >= 1)
);
CREATE TABLE issue_events (
    id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL,
    site_id uuid NOT NULL,
    issue_id uuid NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamptz NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    source_event_key text NULL,
    CONSTRAINT issue_event_scope FOREIGN KEY (organisation_id, site_id, issue_id)
    REFERENCES operational_issues (organisation_id, site_id, id)
);
```

### 19.2 SQL Contract Cautions

The example omits authentication tables, full role grants, RLS policies, audit/retention, separate event-source deduplication and indexes. They must be added and reviewed before production. Foreign keys with nullable referenced columns allow the optional relation to be absent; they do not allow a relation to another site when populated. RLS must cover both rows returned and rows inserted/modified.

### 19.3 Dictionary Ownership and Versioning

The future engineering team must maintain a single versioned data dictionary with table owner, column definition, source authority, privacy classification, retention, constraints and migration history. Every API contract and mock fixture should state its schema version. Changes to status semantics require a versioned compatibility and migration assessment, not an unreviewed rename in the UI.

## 20. Validation, Open Decisions and Sign-Off

### 20.1 Schema Acceptance Criteria

| **Test ID** | **Required result**                                                                  |
|-------------|--------------------------------------------------------------------------------------|
| BSD-AC-01   | Every P0 PRD user journey maps to named entities and relationships                   |
| BSD-AC-02   | Tenant/site identifiers cannot be used to read or attach another organisation's data |
| BSD-AC-03   | Unknown stock values never generate a false zero-stock procurement alert             |
| BSD-AC-04   | Source event replays do not create duplicate issues or observations                  |
| BSD-AC-05   | Issue, equipment and map changes have traceable source and time evidence             |
| BSD-AC-06   | Repair completion, authorised release and operation resumption are separate          |
| BSD-AC-07   | Shift handover references the original issue and does not close it automatically     |
| BSD-AC-08   | Operational state and data-quality state remain independent                          |
| BSD-AC-09   | A procurement alert contains a reason and reference; no purchase is placed           |
| BSD-AC-10   | Reports distinguish actual measurements, estimates and unknown values                |
| BSD-AC-11   | All mock fixture entities satisfy proposed foreign-key and access-scope logic        |
| BSD-AC-12   | No production database or integration is created under the current authorisation     |

### 20.2 Decisions Requiring Customer/Engineering Validation

| **Decision**                 | **Proposed position**                         | **Approval dependency**                                 |
|------------------------------|-----------------------------------------------|---------------------------------------------------------|
| Production database          | PostgreSQL                                    | Security, operations, hosting and performance review    |
| Physical schema grouping     | One database; logical domain boundaries       | Engineering migration and team ownership plan           |
| Multi-tenancy model          | Shared database with strict tenant/site scope | Threat model, data residency, customer requirements     |
| Area map geometry            | Approved image/pixel polygons                 | Mine-specific plan rights, fidelity and source accuracy |
| Stock semantics              | Adapt per approved ERP                        | Real reservation/availability mapping workshop          |
| Maintenance authority        | Existing CMMS/OEM schedules                   | Customer equipment and service-plan validation          |
| Actual telemetry             | Integrate only with approved OT source        | OT cybersecurity and field feasibility review           |
| Production reporting metrics | Evidence-linked definitions                   | Mine operations sponsor and methodology approval        |
| Retention and data residency | Define contractually                          | Legal/POPIA/security/customer policies                  |
| HIMARK Reserve entitlement   | Operations Single Site benefit proposal       | Commercial approval and licensing policy                |

### 20.3 Delivery Sequence

1. **Now - Schema documentation:** Approve terminology, entity relationships, mock DTOs and simulation expectations.

2. **Now - UI/UX implementation:** Build only the frontend and deterministic mock service defined in the TRD; do not provision a database.

3. **Next - Mining user validation:** Test the core workflow, source assumptions, relevance of spare-parts warnings and existing system coverage.

4. **Later - Backend architecture decision:** Revisit schema with real mine data, security policies, source integration feasibility and paid pilot evidence.

5. **Only after approval - Production engineering:** Create tested migrations, APIs, tenancy controls, integration adapters, observability and operational safeguards.

### 20.4 Formal Sign-Off

**Product Owner (HIMARK):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ **Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Technical Lead / Architecture:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ **Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Security and Data Governance:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ **Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Mine Domain Reviewer:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ **Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_

Approval of this document approves its conceptual schema and mock-data alignment, **not** a production build or data processing agreement.

## Appendix A. Traceability Register

| **PRD / TRD requirement area**                       | **Primary schema groups**                                              |
|------------------------------------------------------|------------------------------------------------------------------------|
| VES-FR-001 to 008 - Command Centre                   | Sites, issues, equipment, area status, reports                         |
| VES-FR-009 to 017 - Operational Map                  | Site plans, areas, polygons, status evaluations                        |
| VES-FR-018 to 027 - Work & Exceptions                | Issues, actions, dependencies, events, evidence, verification          |
| VES-FR-028 to 036 - Equipment & Maintenance          | Equipment, meter readings, maintenance plans, downtime intervals       |
| VES-FR-037 to 046 - Resource Readiness               | Parts, stock snapshots, lead times, activity requirements, assessments |
| VES-FR-047 to 053 - Shift Control                    | Shifts, assignments, handovers and linked issues                       |
| VES-FR-054 to 062 - Mobile                           | Shared entities plus pending-sync metadata in client only              |
| VES-FR-063 to 072 - Reports                          | Production measures, metric definitions, calculation results           |
| VES-BR-001 to 019 - Operational and commercial rules | Status evidence, source quality, permissions and entitlements          |
| TRD-08/09 - Mock contracts                           | Shared DTO mapping, provenance, in-memory scenario engine              |
| TRD-15 - Tenant and tier access                      | Memberships, roles, site allocations and subscriptions                 |

## Appendix B. Glossary and Interpretation

| **Term**             | **Operational definition in VESPER**                                           |
|----------------------|--------------------------------------------------------------------------------|
| Tenant               | A subscribed mining organisation with isolated sites, users and records        |
| Site                 | A distinct managed mine operation under a tenant subscription allowance        |
| Authoritative source | Approved system or qualified person responsible for a fact or permission       |
| Operational issue    | A reported or sourced constraint that may require coordination or action       |
| Action dependency    | A prerequisite that must be resolved before a linked action can progress       |
| Quality state        | Confidence/freshness of information; separate from its operational condition   |
| Operational status   | Evidence-based on_plan, at_risk, blocked or unknown classification             |
| Observed time        | Time the physical or business fact was seen by the reporting source            |
| Recorded time        | Time the event or fact was persisted in VESPER, which may be later             |
| Downtime interval    | Documented period in which defined equipment was unavailable for a purpose     |
| Avoidable waiting    | Waiting demonstrated to be controllable, not merely labelled as idle time      |
| Stock snapshot       | Timestamped, sourced view of inventory balances; not an inventory transaction  |
| Readiness assessment | Rule-based evaluation of whether resources for planned work are confirmed      |
| Idempotency key      | Scoped unique command identifier that prevents duplicate processing on retries |
| Operational release  | Authorised clearance from established mine processes; not granted by VESPER    |

## Appendix C. Standards and References

- HIMARK SGC, *VESPER 3.0 Product Requirements Document*, v1.1, 2 November 2026.

- HIMARK SGC, *VESPER 3.0 Technical Requirements Document*, v1.1, 2 November 2026.

- PostgreSQL documentation, *Row Security Policies* and *CREATE POLICY*: https://www.postgresql.org/docs/current/ddl-rowsecurity.html and https://www.postgresql.org/docs/current/sql-createpolicy.html.

- PostgreSQL documentation, *Constraints*: https://www.postgresql.org/docs/current/ddl-constraints.html.

- PostGIS documentation, *ST_GeomFromGeoJSON* (future geospatial option): https://www.postgis.net/docs/manual-dev/en/ST_GeomFromGeoJSON.html.

**End of Backend Schema Document v1.1.**
