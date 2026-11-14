# VESPER subscription architecture

**Status:** implemented for the prototype. Production enforcement is not built and not authorised.
**Updated:** 14 November 2026, after the product owner defined Core, Operations, Enterprise and Group, the Group licensing rule and client-specific overrides.

## 1. The model

VESPER is **one product**. There are five commercial subscriptions and three functional editions. A subscription is configuration. It never means a separate application, branch, page set or database schema.

| Subscription | Identifier | Edition | Site allowance | Reporting |
| --- | --- | --- | --- | --- |
| VESPER Core | `core` | Core | 1 | Essential |
| VESPER Operations – Single Site | `operations_single` | Operations | 1 | Operational |
| VESPER Operations | `operations` | Operations | 3 | Operational |
| VESPER Enterprise | `enterprise` | Enterprise | 6 | Advanced |
| VESPER Group | `group` | Enterprise foundation | **Licensed**: 7 or more, maximum set by the agreement | Group-level |

- **Core is operational visibility. Operations is operational coordination.** Operations – Single Site and Operations have **identical functionality**. Only the site allowance differs.
- **Group is not a separate edition or application.** It is the Enterprise foundation plus the Group capabilities.
- **Group licensing.** The minimum of seven is a commercial licensing threshold, not a requirement that seven sites are active. A Group client may license 10 and activate 4. The **licensed maximum is enforced**. A Group subscription without a valid licensed number is rejected. It is never unlimited by default.
- Every subscription includes VESPER Web and VESPER Mobile (the plan schema allows no plan without them).

## 2. Where it lives

`packages/api-contracts/src/subscription/`, framework-free, depending only on Zod.

| File | Contents |
| --- | --- |
| `types.ts` | The shapes: subscription identifier, edition, feature codes, site allowance, plan |
| `plans.ts` | The five plans as data, one feature list per edition, the Group minimum |
| `features.ts` | The **feature catalogue**: what each feature is, whether it is built, and whether the interface enforces it |
| `entitlements.ts` | The checks (section 5) |
| `overrides.ts` | The client entitlement record, its validation and its resolution (section 6) |

## 3. The features, by edition

Codes are stable. Status is the truth about the prototype today, recorded as data in `features.ts` and checked by a test.

### Core: operational visibility

| Feature | Intended entitlement | Status in the prototype |
| --- | --- | --- |
| `overview` | Operational overview | Built |
| `operational_map` | Basic live operational map | Built |
| `issue_tracking` | Report and track operational issues | Built |
| `equipment_visibility` | Essential equipment visibility | Built |
| `assigned_tasks` | Assigned tasks and work updates | Built |
| `shift_basic` | Basic shift information | Built |
| `administration` | Administration (not named in either list; assumed needed by all) | Built |
| `mobile_field_essential` | Essential VESPER Mobile (cannot be overridden off) | Built |
| (reporting level) | Essential reporting | Built: two essential reports |

### Operations: operational coordination (everything in Core, plus)

| Feature | Intended entitlement | Status | Enforced in the interface |
| --- | --- | --- | --- |
| `work_coordination` | Action ownership, dependencies and escalation | Built | **No.** Part of the issue lifecycle. See section 8 |
| `shift_handover` | Detailed shift handovers | Built | **Yes**: the handover page, links and tiles |
| `equipment_maintenance` | Downtime and maintenance coordination | Built | **Yes**: the equipment sections and the maintenance and service-request routes |
| `resource_readiness` | Resource Readiness and spare-parts early warnings | Built | **Yes**: the workspace, navigation, tiles and readiness items |
| `digital_inspections` | Structured digital inspections and checklists | **Not built** | Nothing to enforce |
| `mobile_field_expanded` | Expanded Mobile workflows | **Not built** | Nothing to enforce |
| (reporting level) | Detailed operational reporting | Built: operational reports | **Yes** |

### Enterprise (everything in Operations, plus)

| Feature | Intended entitlement | Status |
| --- | --- | --- |
| `advanced_analytics` | Advanced operational analytics | Partial: one advanced report (Delay analytics, indicative data). Enforced |
| `multi_site_comparison` | Multi-site performance comparisons | **Not built** |
| `management_oversight` | Advanced reporting and management oversight | **Not built** beyond the advanced report |
| `contracted_integrations` | Support for contracted integrations | **Not built**. Connectors are excluded from the current phase |
| `customer_configurations` | Approved customer-specific configurations | Partial: the client entitlement record exists with mock records (section 6) |

### Group (everything in Enterprise, plus)

| Feature | Intended entitlement | Status |
| --- | --- | --- |
| `group_dashboards` | Consolidated group-level dashboards | **Not built** |
| `cross_site_oversight` | Cross-site performance oversight | **Not built** |
| `group_administration` | Group-level administration and governance | **Not built** |
| `contracted_extensions` | Contractually agreed enterprise extensions | Partial: carried by the same client record. No extension exists |

**Nothing was built to tell the subscriptions apart.** The plan configuration records the intended entitlements. The interface responds where a clean boundary already exists, and the rest is listed as outstanding.

## 4. How the interface responds

All through one reader (`apps/mine-operator/src/lib/entitlements.ts`). No component compares subscription names.

| Place | What changes without the feature |
| --- | --- |
| Navigation | Resource Readiness, Readiness risks and Shift handover are not shown |
| `/resources` and its records | A "not part of your subscription" screen that names the feature and the subscription that includes it |
| Overview and shared data | Readiness records and tiles, and the handover tile, are left out. Readiness is also left out of search and role homes |
| Equipment page | The Downtime, Maintenance plans, Service history and Service requests sections, and "Log service", are not shown. Details, availability, readings and linked issues stay |
| Shift page and handover route | The handover card, link and page are not available. Shifts, crew, tasks, calendar and the allocation sheet stay |
| Reports | Each report has a level (essential, operational, advanced). Core sees two of six, Operations five, Enterprise and Group all six |

This is presentation for the prototype. It is **not production access control**.

## 5. The checks

Plain functions in `entitlements.ts`:

| Function | Answers |
| --- | --- |
| `resolveSubscription` | Is this stored subscription valid, and what is its allowance? |
| `planAllows` | Does the client have a feature (plan plus approved overrides)? |
| `reportAllowed` | May a report at this level be seen? (advanced follows the feature, so an override can grant it) |
| `canAddSite` | Can the organisation add another mining site, given how many it has? |
| `lowestPlanWith` | Which is the lowest subscription with a feature? |
| `evaluateAccess` | Does this person get this feature, with the subscription gate and the role and site gate kept apart? |
| `describeChange` | What does changing subscription do, and is it blocked? |

**Two gates, never one.** A subscription entitlement is not a user permission. `evaluateAccess` takes the result of the caller's own role and site rules and reports which gate refused: `subscription`, `role` or `site`.

## 6. Client-specific entitlements

A client's agreement must never mean editing the source. One **client entitlement record** per organisation holds:

| Field | Purpose |
| --- | --- |
| `organisationId` | The client |
| `subscriptionId` | The plan |
| `contractedSites` | The licensed maximum. Required for Group. For other plans empty, or equal to the fixed allowance |
| `featureOverrides` | Approved overrides: a feature, whether it is granted or removed, and the reason |
| `agreementReference` | The commercial agreement the record comes from |
| `effectiveDate` | The first day the record applies |
| `approval` | Who approved it, in what role, and when |
| `auditHistory` | Everything that has happened to the record, in order |

**Overrides are explicit, validated and traceable.** The validator refuses a record without an agreement reference, an effective date, approval or audit history. An override needs a reason. It must change something (granting a feature the plan already has, or removing one it lacks, is refused). A feature cannot be overridden twice. The essential mobile experience can never be switched off. The audit history must start with creation, run in order and show the approval when there are overrides. Approval must be on or before the effective date. Unknown fields are refused. Each problem is reported against the field it concerns.

`resolveClientEntitlements(record, date)` returns what the client has on that date: the plan's features, changed by the overrides. It throws, rather than guesses, if the record is invalid or does not yet apply.

The prototype uses **mock records**: one valid record per subscription with no overrides, and `deployment/templates/client-entitlements.example.json` as the model, which a test validates. **In production these records are stored securely and enforced by the backend.** A record read in the browser is not access control.

## 7. Upgrades

A change of subscription changes **entitlements and site capacity only**. The application, the schema and the data are untouched.

| Change | What changes |
| --- | --- |
| Operations – Single Site to Operations | Allowance 1 to 3. Nothing else |
| Core to Operations | Gains the six Operations capabilities |
| Enterprise to Group | Gains the four Group capabilities. Allowance 6 to the licensed number |
| Any downgrade | Blocked while the client uses more sites than the new allowance. Data is kept |

The presenter console can switch subscriptions at any time. A browser test proves operational records survive every switch.

**Production requirements:** an authorised, audited action by HIMARK staff (not self-service), with reason and effective date, a site-count check before a downgrade, a rule for data created under a feature the client no longer has, and no billing coupling until billing is approved.

## 8. Known limits of the prototype's enforcement

1. **Work coordination in Core.** Action ownership, dependencies and escalation are part of the issue lifecycle: an issue cannot move or close without its actions. Core therefore still has them. A Core-specific lifecycle is needed to separate them, and is a design decision.
2. **Closing a shift in Core.** A shift with unresolved items asks for a handover, which Core does not have. A rule for closing a shift without a handover is needed.
3. **Equipment register columns** such as maintenance due are still shown in Core.
4. **Mobile.** Every subscription has the four mobile screens. There are no expanded mobile workflows to differ.

## 9. Enterprise and Group extensibility

Tailoring is controlled configuration of the standard product, never a fork. In order of preference:

1. **A client entitlement record**: an approved override of a feature already in the product.
2. **A new feature code** in the plan configuration, shipped to everyone and entitled by plan or override.
3. **A defined extension point** (a named integration adapter, a report definition, a workflow setting) added to the standard product when a second client needs it.

A customisation is allowed only if it keeps working across releases and is covered by the compatibility tests in the deployment architecture. No plugin framework is proposed.

## 10. Remaining decisions

1. The two Core rules in section 8 (the lifecycle and closing a shift).
2. What the digital inspections and expanded mobile workflows are, before they are built.
3. What the contracted integrations include for each Enterprise client.
4. How a downgrade treats data created under a feature the client no longer has.
5. Where and how production overrides are stored, and who may approve them.
6. Whether administration should be in every subscription (assumed yes).

## 11. Required before production

Server-side enforcement of every entitlement, site limit and role on every request. Secure storage for client entitlement records with an immutable audit trail. A site-creation action that calls `canAddSite` on the server. A tested downgrade and retention rule. Entitlement changes recorded and reviewable by HIMARK.
