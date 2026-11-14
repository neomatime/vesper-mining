# VESPER subscription, database and deployment standardisation: implementation summary

**Updated:** 14 November 2026
**Phase:** front-end prototype. No live database, infrastructure, branch, variable, credential or production deployment was created or changed. Nothing was pushed by this second round.

## 1. Two rounds of work

**Round 1** built the central subscription configuration, the deployment manifest template and the first four documents (merged to `main`).

**Round 2** applied the product owner's decisions of 14 November 2026: the Core and Operations definitions, the Enterprise and Group entitlements, the Group licensing rule, client-specific overrides, the Vercel UAT approach, and the request to see the exact specification amendments before anything is changed.

## 2. What was found

The prototype's Core had been defined by the old tier table: every workspace in every subscription. Core had VESPER Mobile switched off (corrected in round 1, because the PRD and Backend Schema include it). The Backend Schema (5.2) already forbids denying basic issue reporting, tracking, assigned work or notifications because a plan is Core, which matches the new Core definition. The team's Vercel limit for Custom Environments is **0**.

## 3. What changed in round 2

| Area | Change |
| --- | --- |
| Features | The feature codes now follow your lists: 8 for Core, 6 more for Operations, 5 more for Enterprise, 4 more for Group (23 in all) |
| Feature catalogue | `features.ts` records, for every feature, what it is, whether it is **built, partial or not built**, and whether the interface **enforces** it. A test keeps it honest |
| Core versus Operations | Resource Readiness, detailed handovers, maintenance and downtime coordination, and the operational reports are Operations capabilities. The interface now responds where a clean boundary exists (navigation, routes, sections, tiles, reports by level) |
| Operations equality | Operations – Single Site and Operations have identical features and reports. A unit test and a browser test prove it |
| Group | Licensed sites: 7 or more, the maximum from the agreement, enforced. Fewer sites may be activated. Tests cover licensing 10 and activating 4 |
| Client overrides | A validated client entitlement record: client, plan, licensed sites, approved feature overrides, agreement reference, effective date, approval, audit history. Resolved with `resolveClientEntitlements`. Mock records in the prototype, and an example template |
| Deployment manifest | Each environment has a **branch** and the **names** of its variables. UAT deploys from `staging`. Both environments list the same names |
| Vercel | Branch-scoped Preview variables, verified in Vercel's documentation. Custom Environments are not used because the plan allows none |
| Amendments | `VESPER_PROPOSED_SPECIFICATION_AMENDMENTS.md`: the exact five proposed amendments with their implications. **The specifications are unchanged** |
| Documents | Subscription, deployment and database architecture updated. The audit now points at the amendments |

## 4. Relevant structure

```text
packages/api-contracts/src/
├── subscription/
│   ├── types.ts          feature codes, plan and record shapes
│   ├── plans.ts          the five plans as data
│   ├── features.ts       the feature catalogue: built or not, enforced or not
│   ├── entitlements.ts   resolve, planAllows, reportAllowed, canAddSite, evaluateAccess, describeChange
│   └── overrides.ts      the client entitlement record, its validation and resolution
├── deployment.ts         manifest rules, branches and variable names, secret scan
└── index.ts
apps/mine-operator/src/
├── lib/entitlements.ts   the prototype's reader, with mock entitlement records
├── components/use-entitlements.ts, entitlement-gate.tsx (FeatureGate)
└── lib/*.test.ts         subscription, client-entitlements, entitlements, deployment tests
deployment/templates/
├── client-deployment.example.json
└── client-entitlements.example.json
docs/architecture/        six documents
```

## 5. How the subscriptions work now

Core is operational visibility, Operations is operational coordination (identical for Single Site and Operations), Enterprise adds analytics, multi-site comparison, oversight, contracted integrations and approved customer configurations, and Group adds group dashboards, cross-site oversight, group administration and contracted extensions. Site allowances are 1, 1, 3, 6 and the licensed maximum for Group. A client entitlement record can add or remove a feature with an agreement reference, approval and audit trail, and can never remove essential mobile. Details: `VESPER_SUBSCRIPTION_ARCHITECTURE.md`.

## 6. What exists and what is outstanding

Built and enforced: Resource Readiness, detailed handovers, equipment maintenance and downtime, reports by level, advanced analytics. Built but not separable: work coordination (it is part of the issue lifecycle). **Not built:** digital inspections, expanded mobile, multi-site comparison, management oversight, contracted integrations, group dashboards, cross-site oversight and group administration. **Partial:** advanced analytics (one report), customer configurations and contracted extensions (the override record exists, with no secure storage or backend). None of the unbuilt items was built to tell the plans apart.

## 7. Tests

| Check | Result |
| --- | --- |
| Type check, lint | Passed |
| Unit tests | **342 passed** (32 files) |
| Browser tests for workspaces and subscriptions | **11 passed**, including Core visibility, Operations coordination, Operations equality and records surviving every plan switch |
| Full browser suite (chromium and mobile) | **166 passed, 0 failed**, 104 skipped by the suite's own desktop-only and mobile-only rules |

## 8. Decisions still open

1. The two Core rules the prototype cannot enforce: a Core issue lifecycle without actions and dependencies, and closing a shift without a handover.
2. What digital inspections and expanded mobile workflows are, before they are built.
3. What contracted integrations include for each Enterprise client.
4. How a downgrade treats data created under a feature the client no longer has.
5. Where and how production overrides are stored, and who may approve them.
6. The five proposed amendments, awaiting the owner's decision.
7. Whether branch-scoped Preview variables work on the plan in use, to be confirmed when the first client project is created.

## 9. Needed before production

Server-side enforcement of subscriptions, site limits, overrides and roles on every request. Secure storage for client entitlement records with an immutable audit trail. Real authentication. A chosen database product, migration method and secrets store. Real multi-site management. A `staging` branch and branch-scoped variables for each client. Backups and a tested restore. A client version register and a real release process. Approval of the specifications, which are still pending.
