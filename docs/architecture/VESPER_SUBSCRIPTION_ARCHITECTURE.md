# VESPER subscription architecture

**Status:** implemented for the prototype. Production enforcement is not built and not authorised.

## 1. The model

VESPER is **one product**. There are five commercial subscriptions and three functional editions. A subscription is configuration. It never means a separate application, branch, page set or database schema.

| Subscription | Identifier | Edition | Site allowance | Reporting |
| --- | --- | --- | --- | --- |
| VESPER Core | `core` | Core | 1 | Essential |
| VESPER Operations – Single Site | `operations_single` | Operations | 1 | Operational |
| VESPER Operations | `operations` | Operations | 3 | Operational |
| VESPER Enterprise | `enterprise` | Enterprise | 6 | Advanced |
| VESPER Group | `group` | Enterprise foundation | **Contracted** (at least 7) | Group-level |

- Operations – Single Site and Operations are **the same product**. Only the site allowance differs.
- Group is not a separate edition. It is the Enterprise foundation plus the Group entitlements, with a site allowance set by the client agreement. It is **never unlimited by default**: a Group subscription without a valid contracted number is rejected.
- Every subscription includes VESPER Web and VESPER Mobile. This is enforced by the plan schema (`webAccess` and `mobileAccess` can only be `true`).

## 2. Where it lives

`packages/api-contracts/src/subscription/`, framework-free, with no dependency beyond Zod.

| File | Contents |
| --- | --- |
| `types.ts` | The shapes: subscription identifier, edition, reporting level, feature code, site allowance, plan, and the stored organisation subscription |
| `plans.ts` | The five plans as data, one feature list per edition, the Group minimum, labels |
| `entitlements.ts` | The checks (below) |

The deployment manifest rules are in `packages/api-contracts/src/deployment.ts` and use the same plans.

## 3. Features

Feature codes are stable and name what a client can use. The navigation, a workflow check and a future backend all use the same code.

| Feature code | What it covers | In the prototype |
| --- | --- | --- |
| `overview`, `operational_map`, `work_exceptions`, `equipment_maintenance`, `resource_readiness`, `shift_control`, `reports`, `administration` | The eight workspaces | Built. In every subscription |
| `mobile_field_essential` | My Shift, My Work, Report, Notifications | Built. In every subscription |
| `mobile_field_expanded` | Expanded field workflows such as digital inspections (PRD VES-BR-015: "Operations and above may unlock") | **Not built.** Defined as Operations and above |
| `advanced_analytics` | Advanced analytical reports (VES-BR-016) | Built (`delay-analytics`). Enterprise and Group |
| `group_reporting` | Group-level reporting | **Not built.** Group only |

Editions add to each other: Core, then Operations (adds `mobile_field_expanded`), then Enterprise (adds `advanced_analytics`), then Group (adds `group_reporting`).

**No commercial restriction has been invented.** Every workspace is in every subscription, because none has been approved otherwise.

## 4. The checks

All are plain functions in `entitlements.ts`:

| Function | Answers |
| --- | --- |
| `resolveSubscription` | Is this stored subscription valid, and what is its site allowance? |
| `planAllows` | Does the subscription include a feature? |
| `reportingAllows` | Does reporting reach a level (essential, operational, advanced, group)? |
| `canAddSite` | Can the organisation add another mining site, given how many it has? |
| `lowestPlanWith` | Which is the lowest subscription with a feature? (for "included from" text) |
| `evaluateAccess` | Does this person get this feature, with the subscription gate and the role and site gate kept apart? |
| `describeChange` | What does changing subscription do, and is it blocked? |

### Two gates, never one

A subscription entitlement is **not** a user permission. A person needs both. `evaluateAccess` takes the result of the caller's own role and site rules and reports which gate refused: `subscription`, `role` or `site`. A generous role never overrides a missing feature, and an included feature never overrides a missing role.

## 5. How the app uses it

| App file | Role |
| --- | --- |
| `src/lib/entitlements.ts` | Turns the prototype's selected subscription into a stored subscription and answers in the screens' words (`entitlementsFor`, `can`, `siteCapacity`, `accessFor`, `changeSubscription`). The only place that knows the demonstration Group contract (10 sites) |
| `src/lib/personas.ts` | The presenter console's list of subscriptions, **built from the central plans** |
| Components | Ask `entitlementsFor` or `can`. None compares subscription names |
| `demoContextSchema.tier` | Now the same identifier list, not a second copy |

Frontend checks here are for navigation and presentation only. They are **not** production access control.

## 6. Upgrades

A change of subscription changes **entitlements and site capacity only**. The application, the database schema and the client's data are untouched.

| Change | What changes |
| --- | --- |
| Operations – Single Site to Operations | Allowance 1 to 3. Nothing else |
| Core to Operations | Gains `mobile_field_expanded` |
| Enterprise to Group | Gains `group_reporting`. Allowance 6 to the contracted number |
| Any downgrade | Blocked while the client uses more sites than the new allowance. Data is kept |

`describeChange` returns the direction, the features gained and lost, both allowances, and a `blockedBy` message. The prototype presenter console can switch subscriptions at any time, and a browser test proves operational records survive every switch.

**Production requirements for a subscription change:** an authorised, audited action by HIMARK staff (not self-service), a recorded effective date, a recorded reason, a site-count check before applying a downgrade, a rule for data created under a feature the client no longer has, and no automatic billing coupling until billing is approved.

## 7. Enterprise and Group extensibility

Enterprise and Group clients may need tailoring. It must not fork the codebase. The order of preference:

1. **Configuration.** A new capability becomes a feature code and an entry in the plan or an agreed per-client override. The code ships to everyone, and entitlements decide who sees it.
2. **Reusable components** that the standard product also uses.
3. **A defined extension point** (a named integration adapter, a report definition, a workflow setting) added to the standard product when a second client needs it, not before.

A customisation is allowed only if it keeps working across releases and is covered by the compatibility tests in the deployment architecture. No plugin framework is proposed: the code does not yet show a need for one.

## 8. Pending decisions (not resolved here)

1. **Where Core ends and Operations begins.** Today they differ only in the unbuilt `mobile_field_expanded`. Document the intended commercial difference before restricting anything.
2. **What the expanded field workflows are** (digital inspections and which others).
3. **What Enterprise and Group include beyond the advanced and group-level reports.** Only those two are built.
4. **The Group minimum.** The code uses 7, from the PRD's "7+". Confirm or change it.
5. **Per-client overrides.** Whether a client agreement can add or remove a feature outside its plan, and how that is recorded.
6. **Prices and the HIMARK Reserve licence.** Out of scope for code. The PRD marks them provisional.
7. **Whether the plan configuration in code or the database table is the source of default entitlements.** This work assumes code, with the database holding the client's subscription and any agreed overrides.

## 9. Required before production

- Server-side enforcement of every entitlement, site limit and role on every API call.
- A stored organisation subscription with an audit trail.
- A site-creation action that calls `canAddSite` on the server.
- A tested downgrade and data-retention rule.
- Entitlement changes recorded and reviewable by HIMARK.
