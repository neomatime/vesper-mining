# VESPER current state audit

**Date:** 14 November 2026
**Scope:** the repository as it stood before the subscription architecture work, inspected to decide what to reuse, what to change and what to document.
**Method:** the code, the tests and the four specifications were read directly. Nothing here is inferred from a specification alone.
**Status of the specifications:** the PRD (v1.1), TRD (v1.2), Backend Schema (v1.1), App Flow (v1.1) and the UI/UX specification are still approval-pending. This audit records no approval.

> **Update, 14 November 2026.** This audit is the position **before** the subscription work and is kept as it was written. Since then: the product owner has approved the direction of dedicated client databases and defined the Core, Operations, Enterprise and Group entitlements, the Group licensing rule and the UAT approach. The five documentation conflicts in section 15 are now written up as five exact proposed amendments in `VESPER_PROPOSED_SPECIFICATION_AMENDMENTS.md`, with their implications, awaiting the owner's decision. Nothing in the specifications was changed.

## 1. Summary

VESPER is a working front-end prototype on simulated data. It is one Next.js application plus one shared contracts package. There is **no backend, no database, no real authentication and no per-client deployment configuration**. Subscription logic existed in two small files and was **out of step with the specifications**: Core had VESPER Mobile switched off, while the PRD (section 11.1, VES-BR-014 and 015) and the Backend Schema (revision 1.1) say every subscription, Core included, has it.

Nothing needed rebuilding. The subscription work is a refactor of two files, a new shared configuration module, a deployment template and documents.

## 2. Framework and versions

| Item | Version |
| --- | --- |
| Next.js (App Router, Turbopack) | 16.4.6 |
| React | 19.3.1 |
| TypeScript | 5.9.3, strict |
| Package manager | pnpm 11 (workspace, single lockfile) |
| Data layer | TanStack Query 5, Zustand 5, MSW 2.15, Zod 4 |
| UI | Tailwind 4 plus hand-written CSS layers, Lucide, Motion, Recharts, Leaflet |
| Tests | Vitest 5 and Testing Library, Playwright 1.65 |
| Hosting | Vercel (git integration), production from `main`, previews per branch |

## 3. Structure

```text
VESPER/
├── apps/mine-operator/        the single frontend
│   ├── src/app/               routes and style sheets
│   ├── src/components/        screens, dialogs, shared UI
│   ├── src/lib/               rules, selectors, reports, the mock domain store
│   ├── src/mocks/             MSW handlers (the in-browser mock API)
│   ├── src/stores/            session and demo context
│   └── e2e/                   Playwright tests
├── packages/api-contracts/    Zod contracts shared by the app and tests
├── docs/                      specifications; docs/architecture/ added by this work
├── .github/workflows/ci.yml   typecheck, lint, unit tests, build, browser tests
└── README.md, AGENTS.md, CLAUDE.md
```

## 4. Routes and navigation

The eight workspaces exist as the PRD defines them: `/overview`, `/map`, `/exceptions`, `/equipment`, `/resources`, `/shifts`, `/reports`, `/admin`. Supporting routes include `/profile`, `/shifts/[id]/handover`, `/shifts/[id]/allocation`, `/reports/[reportKey]`, `/equipment/[id]/service/...`, `/provider/respond/[token]`, `/sign-in` and the presenter console `/demo`. VESPER Mobile is the `/mobile/*` group: My Shift, My Work, Report, Notifications, Schedule, Profile.

## 5. Functionality by module

| Module | What works now |
| --- | --- |
| Overview | Role-aware "Needs you now" ranking and a home for each of five roles |
| Operational Map | Leaflet site plan with explainable area statuses |
| Work & Exceptions | Full issue lifecycle, actions, dependencies, verification, primary and secondary causes |
| Equipment & Maintenance | Register, plans, service log, readings, availability with reasons, downtime, contractor service requests |
| Resource Readiness | Parts against planned work, unknown stock kept separate from zero |
| Shift Control & Handover | Shifts, crew, work, calendar, task evidence, handover draft, allocation sheet |
| Reports | Six reports, one of them advanced (`delay-analytics`) |
| Administration | People, roles and rights, providers, site and company details, "Plan and usage" tab |
| Mobile field workflows | My Shift, My Work, Report (with a simulated offline state), Notifications |

## 6. Subscription-related code before this work

| Where | What it did |
| --- | --- |
| `src/lib/personas.ts` | A hand-written `tiers` table: label, site text, mobile, reporting label, advanced analytics |
| `src/lib/entitlements.ts` | `entitlementsFor(tier)` reading that table, plus `tierThatIncludes` and display rows |
| `packages/api-contracts/src/index.ts` | `demoContextSchema.tier`, a second copy of the five identifiers |
| Components | Eight places asked `entitlementsFor(...)`: app shell (mobile gate), reports index and detail (advanced), admin plan tab, sign-in, account menus, the entitlement gate and the presenter console |
| Tests | Unit and browser tests that asserted **Core without mobile** |

Gaps found: the five identifiers were written in two places, site allowances were display text rather than numbers, **Group was "7+ sites" with no contracted allowance**, there was no feature code, no site-capacity check, no upgrade logic, and Core mobile contradicted the PRD and the Backend Schema.

## 7. Roles and access control

Five desk roles plus Field Employee, held as role names in each module's rules (`issue-rules.ts`, `equipment-rules.ts`, `shift-rules.ts`, `readiness-rules.ts`, `service-rules.ts`, `organisation-rules.ts`). `src/lib/rights.ts` derives the rights matrix from those same rules, so the matrix cannot drift from behaviour. Service providers reach one page by a link token. All checks run in the browser and in the in-browser mock, so none of them is real access control (PRD VES-BR-019).

## 8. Organisation, client and site models

`packages/api-contracts/src/organisation.ts` has `Member`, `Company` and `SiteDetails`. There is **one site** (Riverside Mine). Issues carry `organisationId` and `siteId`; equipment, shifts, readiness and areas carry `siteId` only. There is no multi-site UI and no "add a site" action. A client is not modelled beyond the single company record.

## 9. Schema documentation

The Backend Schema (v1.1) describes a PostgreSQL-oriented logical schema with `organisation_id` on every tenant-owned record and `site_id` on site-bound records, an `organisations` tenant root, and `subscriptions`, `subscription_entitlements` and `subscription_site_allocations` tables. No schema is implemented. The TRD names PostgreSQL only as a candidate.

## 10. Authentication

A client-side session (Zustand, local storage) over six seeded accounts and a shared demonstration password. First-sign-in password change and a "Microsoft" button that signs in by email only are simulated. There is no identity provider, token or server.

## 11. Deployment and environment configuration

One Vercel project (`vesper-mining`) deploys `main` to production and every branch to a preview. There is no `vercel.json` and no environment variables. CI (added in the template cleanup) runs checks and browser tests. There is no UAT environment, no per-client project and no deployment record of which client runs which version.

## 12. Tests

312 unit tests across 31 files (after this work) and about 260 Playwright tests run on desktop Chrome and a Pixel 7 profile. A unit test keeps the generated dark stylesheet fresh. Tests are well placed for the work here: the existing Vitest and Playwright setups were reused.

## 13. Mock data and simulation architecture

MSW serves a typed in-browser API under `/_demo/api/v1`, backed by one domain store (`src/lib/demo-store.ts`) persisted to local storage. The demonstration subscription, persona and scenario live in a small session-scoped Zustand store (`demo-context`). **A subscription is therefore not part of the operational data**: switching it cannot change a record. This is what makes a prototype-level upgrade safe.

## 14. Reusable components found

The Zod contracts package, the per-module rules files, `entitlementRows` and the admin "Plan and usage" tab, the presenter console's subscription selector, and the test helpers (`setPlan`, `signIn`). All were reused.

## 15. Where documentation conflicts with the architecture decisions

| # | Document and section | Says | Required amendment |
| --- | --- | --- | --- |
| C1 | Backend Schema 1.3, 2.1, 5.1 | Tenant isolation by design: one shared database, `organisation_id` on every tenant-owned row, `organisations` as the tenant root | One dedicated database per client per environment. `organisations` holds exactly one organisation. `organisation_id` stays for consistency, audit and integration contracts, but row-level tenant isolation is no longer the boundary. The deployment is. |
| C2 | TRD 842 | "Partition tenants and sites server-side" | Tenants are separated by deployment and database. Sites are still partitioned server-side within a client database. |
| C3 | TRD 14 (ADR-14) and 20.2 | Previews on GitHub and Vercel; production tenancy and deployment distribution need separate approval | Add the per-client project, UAT and production arrangement as the proposed production deployment model, still awaiting approval. |
| C4 | PRD 11.1 | Group is "7+ sites", custom price | Make the Group allowance contract-defined, with 7 as the provisional minimum. Never unlimited by default. |
| C5 | BSD 5.1 `subscription_entitlements` | Per-subscription feature rows | Decide whether the plan configuration in code is the source of defaults and the table holds only the client's subscription and contractual overrides. This work proposes yes. |
| C6 | PRD 11.1 and BSD revision 1.1 against the code | Core includes VESPER Mobile | The **code** was wrong. It has been corrected. No document change needed. |

The specifications are not edited by this work. These amendments are recorded here for the owner to approve.

## 16. Risks

1. Subscription checks in the browser look like access control but are not. Production must enforce them on the server.
2. Core and Operations are the same product apart from one unbuilt capability. This is deliberate and unresolved (see the subscription architecture).
3. `organisationId` is on issues only. A production schema needs a clear rule for where it is carried (see the database architecture).
4. The seed data and the demonstration password are in source. They are fictional, but a per-client deployment must never inherit them.
5. A downgrade could strand data that a lower subscription cannot show. The change logic blocks a downgrade while a client has more sites than the new allowance, but data from a lost feature needs a retention decision.

## 17. Proposed modifications (made in this work)

A central subscription configuration in the shared package, entitlement checks as plain functions, the two app files turned into thin readers of it, the Core mobile correction, a deployment manifest schema and example, tests, and the five documents in this folder.
