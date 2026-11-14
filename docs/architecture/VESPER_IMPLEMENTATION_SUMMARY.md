# VESPER subscription, database and deployment standardisation: implementation summary

**Date:** 14 November 2026
**Phase:** front-end prototype. No live database, infrastructure, credential or production deployment was created or changed.

## 1. What was found

VESPER is a working Next.js prototype with a shared Zod contracts package, an in-browser mock API and good test coverage. Subscription logic was two small files with a hand-written table. It was out of step with the PRD and the Backend Schema: **Core had VESPER Mobile switched off**, Group was "7+ sites" with no contracted allowance, the five subscription identifiers were written in two places, and there were no feature codes, no site-capacity check and no upgrade logic. There was no deployment template and no UAT arrangement. Full detail: `VESPER_CURRENT_STATE_AUDIT.md`.

## 2. What was changed

| Area | Change |
| --- | --- |
| Subscription configuration | New `packages/api-contracts/src/subscription/` (types, plans, entitlements). One definition of the five plans, three editions, twelve feature codes, site allowances and the checks |
| App integration | `personas.ts` builds its subscription list from the plans. `entitlements.ts` is a thin reader of the central module. `demoContextSchema.tier` uses the one identifier list. Six of the eight components that read subscriptions were left unchanged because they already went through `entitlementsFor`. Two (the account menu and the entitlement gate) had small text changes |
| Core mobile | Corrected: every subscription includes VESPER Mobile, as the PRD and Backend Schema already say |
| Deployment | New `deployment/` (README, checklist, example manifest) and `packages/api-contracts/src/deployment.ts` (the manifest rules and a secret scan) |
| Tests | 48 new unit tests, one browser test replaced by three, two old unit tests corrected for Core mobile |
| Documents | Five documents in `docs/architecture/`, and the README repository map |

No UI was redesigned. No module was removed. No dependency was added.

## 3. Relevant structure

```text
packages/api-contracts/src/
├── subscription/
│   ├── types.ts          shapes: subscription id, edition, feature code, plan
│   ├── plans.ts          the five plans as data; one feature list per edition
│   ├── entitlements.ts   resolve, planAllows, reportingAllows, canAddSite, evaluateAccess, describeChange
│   └── index.ts
├── deployment.ts         manifest schema, rules between fields, secret scan
└── index.ts              exports both
apps/mine-operator/src/lib/
├── entitlements.ts       the prototype's reader of the central module
├── personas.ts           the console's subscription list, built from the plans
├── subscription.test.ts  plans, site limits, reporting, two gates, upgrades
├── entitlements.test.ts  the app's view, and switching keeps records
└── deployment.test.ts    the template and its rules
deployment/
├── README.md
├── DEPLOYMENT_CHECKLIST.md
└── templates/client-deployment.example.json
docs/architecture/        five documents (this folder)
```

## 4. How the five subscriptions work

Core (1 site), Operations – Single Site (1), Operations (3), Enterprise (6) and Group (contracted, at least 7). The two Operations subscriptions have identical features and differ only in sites. Group is the Enterprise edition plus `group_reporting`, and it is rejected unless it carries a valid contracted number. Every plan includes Web and Mobile. Advanced analytics needs Enterprise or Group. No other restriction was invented. A subscription entitlement and a user permission are separate gates, and `evaluateAccess` reports which one refused. Details: `VESPER_SUBSCRIPTION_ARCHITECTURE.md`.

## 5. How the deployment template works

One manifest per client records organisation, subscription, edition, contracted sites, release version, the one hosting project, a restricted UAT environment and a production environment, each with a database **reference name**, the first sites by name, and a status. The validator refuses an unknown subscription, a wrong edition, a Group without a contract number, too many sites, UAT and production sharing a database or address, secret-looking keys or values, and anything giving a site its own database or environment. Details: `deployment/README.md`, `VESPER_DEPLOYMENT_ARCHITECTURE.md`.

## 6. Tests

| Check | Result |
| --- | --- |
| Type check (app and contracts package) | Passed |
| Lint (zero warnings) | Passed |
| Unit tests | **312 passed** (31 files). 48 are new |
| Browser tests for the affected areas (workspaces, admin, core flows, responsive) | **48 passed**, 36 skipped by design |
| Full browser suite, local | Running when this was written. See the pull request |
| Full browser suite, CI | Runs on the pull request and on `main` |
| Pre-existing failures | None found in the areas touched |

The twenty required checks are covered: plan resolution and site limits (1 to 9 in `subscription.test.ts`), routes and workflows through the existing browser suite, subscription switching preserving records (`entitlements.test.ts` and a browser test), permissions kept distinct from entitlements (`subscription.test.ts`), and the template rules (15 to 20 in `deployment.test.ts`).

## 7. Unresolved architectural decisions

1. Where Core ends and Operations begins (today they differ only in an unbuilt capability).
2. What the expanded field workflows are.
3. What Enterprise and Group include beyond the advanced and group-level reports.
4. The Group minimum (7, from the PRD) and per-client overrides.
5. The rule for carrying `organisation_id`, and whether default entitlements live in code or the database.
6. Data retention after a downgrade.
7. The amendments to the Backend Schema and TRD in the audit (C1 to C5), which need the owner's approval.
8. Which Vercel mechanism provides UAT on the plan in use, to be verified.

## 8. Needed before production

Server-side enforcement of subscriptions, site limits and roles on every call. Real authentication. A chosen database product, migration method and secrets store. A verified UAT mechanism. Multi-site management (site creation, site selector, site-scoped queries). Audited subscription changes with a downgrade and retention rule. Backups and a tested restore. A client version register and a real release-approval process. Approval of the specifications, which are still pending.
