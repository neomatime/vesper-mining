# VESPER 3.0

**The Mining Operating System**  
**HIMARK SGC**  
*Identify delays. Prevent avoidable waiting. Recover productive time.*

> **Current status (14 November 2026):** VESPER is a **working, interactive front-end prototype** on simulated data: a Next.js app in `apps/mine-operator/` with shared contracts in `packages/api-contracts/`, deployed from `main`. There is **no backend**: the data is a deterministic in-browser mock. The five specifications in `docs/` are still **approval-pending** and the technical-lead sign-off for ADR-11 is still outstanding; nothing in this README records an approval. This README does not authorise production infrastructure or real mine data.

## Quick start

Requires Node.js 22 or later and pnpm (the version is pinned in `package.json`).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | Type-checks the shared contracts and the app |
| `pnpm lint` | ESLint with zero warnings allowed |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Builds, serves and runs the Playwright browser tests (desktop Chrome and a Pixel 7 phone) |

**Signing in.** The app starts at `/sign-in`. Six fictional accounts cover every role (Mine Manager, two Shift Supervisors, Maintenance Planner, Stores / Inventory Controller, Field Employee). Their emails and the demonstration password are in `apps/mine-operator/src/lib/accounts.ts`. Data is kept in the browser's local storage, so each browser has its own copy. Use the Administration area or `/demo` to reset it.

**Styles.** After editing `globals.css` or `theme.css`, regenerate the dark theme with `node apps/mine-operator/scripts/generate-dark-theme.mjs`. A unit test fails if the committed `dark.generated.css` is out of date. Hand-written dark rules belong in `dark.css`.

**Do not run the app from inside a OneDrive-synced folder** for day-to-day development: `node_modules` and build output cause sync conflicts. Keep a local checkout and push to Git.

## What is built

| Area | What works |
| --- | --- |
| Sign in and roles | Email and password sign-in, first-sign-in password change, five desk roles on a role-specific Overview, Field Employees on VESPER Mobile, sign out |
| Overview | "Needs you now" decision screen ranked from real records, with a role lens per role |
| Work & Exceptions | Report, assign, act, depend, verify, close and reopen issues. Equipment issues carry a **primary cause and a secondary cause from that primary's own list** (`packages/api-contracts/src/causes.ts`) and whether the unit is still working, as the reporter sees it |
| Equipment & Maintenance | Full equipment register, maintenance plans, service log, meter readings, availability reports with a reason, a **Downtime** card, and contractor service requests with quote comparison and a reply link |
| Resource Readiness | Parts against planned work, with unknown stock kept separate from zero, and review decisions |
| Shift Control & Handover | Shifts with crew and work, calendar (month, week, day), tasks marked done with an optional note and evidence, **handover draft built from the shift's records**, publish and acknowledge, and a printable **allocation sheet** |
| Production, Inventory & Shipments (demo and UAT scope) | **Production** recorded by a shift and **checked** before it counts as stock, a stock ledger with reservations, **shipments** from ready stock, a **collection request** answered by the transporter on its own page, dispatch and delivery that reconcile, and a **Close shift** step that sends the handover. See `docs/architecture/VESPER_PRODUCTION_AND_SHIPMENTS.md` |
| Gold demonstration: "What happens if we wait?" (demo and UAT scope) | A breakdown followed through production, a shipment and an **estimated sales value potentially delayed**, from one shared calculation, with scenario controls, repair completion that keeps the actual downtime, and a history of estimates. See `docs/architecture/VESPER_GOLD_IMPACT.md` |
| Service providers, transport quotes and transport agreements (demo and UAT scope) | Providers with mine approval, manual quote requests and replies, accepted quotes pricing a shipment, agreements with independent dates/price/billing/allowance, monthly allowance tracking, fees recorded once, commercial terms visible only to permitted roles. See `docs/architecture/VESPER_SERVICE_PROVIDERS.md` |
| Transport handled by our own fleet (demo and UAT scope) | Choose Our fleet or Logistics provider per shipment; assign vehicles from the equipment register and drivers, several loads, availability and maintenance checks, coordinator schedule confirmation, breakdowns linked to loads, optional internal cost estimate. See the last section of `docs/architecture/VESPER_SERVICE_PROVIDERS.md` |
| VESPER Intelligence (demo and UAT scope) | Rule-based, evidence-linked insights, Ask VESPER and a shift briefing on the Command Centre; the system calculates, the text explains, the manager decides. See `docs/architecture/VESPER_INTELLIGENCE.md` |
| Assets: equipment and infrastructure (demo and UAT scope) | One register with Equipment and Infrastructure tabs, per-tab figures and filters, condition kept apart from availability and maintenance, asset dependencies, and dependent assets surfaced in VESPER Intelligence. See `docs/architecture/VESPER_ASSETS.md` |
| Reports | Six reports including **Recurring causes** (primary and secondary) |
| Administration | People, roles and rights, service providers, site and company details |
| Subscriptions | Five subscriptions on one product and one schema, defined once in `packages/api-contracts/src/subscription/` (feature entitlements, site allowances, upgrade rules, validated client-specific overrides), with a deployment manifest template for per-client instances. See `docs/architecture/` |
| Experience | Light and dark themes, Inter at a light weight scale, one soft radius scale, a floating top bar, phone and tablet layouts |

Quality: unit tests for the rules and the mock domain, and Playwright tests for the main journeys, run by CI on every change.

## 1. What VESPER is

VESPER is a proposed mining-operations coordination platform designed to help mines see operational constraints, coordinate corrective actions, prepare resources for planned work, and maintain continuity across shifts. It is intended to sit **alongside** existing mine systems such as maintenance, inventory and procurement platforms, not silently replace their authoritative records or established human procedures.

Three product capabilities anchor the proposition:

- **Operational visibility:** show significant constraints, affected areas and equipment, accountable people, information sources and data quality.
- **Operational coordination:** track issues, actions, dependencies, verification and handover between departments and shifts.
- **Delay prevention:** surface scheduled maintenance prerequisites and potential spare-parts risks before they interrupt planned work.

The initial target segment - mid-sized South African surface mining operators - is a **market hypothesis requiring validation**, not an established customer fact. Financial recovery figures, operational benefits, integration feasibility and pricing are also unvalidated unless explicitly supported by evidence.

**HIMARK principle:** Human First. Tools Second.  
**Experience standard:** The complexity belongs to the system. The clarity belongs to the user.

## 2. One product, three experiences

VESPER is **one product and one brand**, with a shared domain model and role-appropriate experiences:

| Experience | Primary purpose | Current phase |
| --- | --- | --- |
| **VESPER Web** | Management, coordination, administration and reporting | Responsive browser prototype |
| **VESPER Tablet** | Supervision, operational review and shift workflows | Tablet-optimised browser prototype |
| **VESPER Mobile** | Field work, issue reporting and progress tracking | Mobile-optimised browser prototype; **not** a native mobile application |

Do not create a separately branded VESPER S or VESPER ONE app. Advanced analytics remain inside the VESPER **Reports** workspace.

### Eight core workspaces

| Workspace | Proposed frontend route | Primary purpose |
| --- | --- | --- |
| Overview / Command Centre | `/overview` | Role-aware priorities, constraints and drill-downs |
| Operational Map | `/map` | Interactive, fictional site plan and explainable area statuses |
| Work & Exceptions | `/exceptions` | Report, assess, assign, act, verify and track issues |
| Equipment & Maintenance | `/equipment` | Equipment, maintenance due and recorded delay stages |
| Resource Readiness | `/resources` | Work prerequisites, stock status and spare-parts early warnings |
| Shift Control & Handover | `/shifts` | Current work, unresolved items and shift continuity |
| Reports | `/reports` | Evidence-linked metrics and entitlement-aware analysis |
| Administration | `/admin` | Demonstration site, persona, role and tier configuration |

The mobile field navigation prioritises **My Shift / My Work / Report / Notifications**; Profile is available from the application shell. Routes are **design contracts**, not proof that pages have been implemented.

## 3. Current release boundary

**P0** is the agreed priority set for an interactive frontend prototype; **P1** is later prototype enhancement subject to validation; **P2** is future production work. A P0 requirement does **not** authorise production infrastructure.

In scope **after specific implementation approval**: a reusable design system; responsive web/tablet/mobile interfaces; the P0 journeys and eight workspaces; an interactive 2D fictional Operational Map; simulated issue, action, equipment, readiness, handover and reporting interactions; role/site/tier switching; deterministic mock responses; loading, error, stale, unknown and offline demonstration states; accessibility and tests.

**Not authorised in this phase:**

- Production backend, database, API server, durable multi-user storage or production identity and access control.
- Live mine/ERP/CMMS/stock/procurement/attendance integrations or real mine operational data.
- Real GPS, telemetry, CCTV, equipment commands, emergency dispatch or safety clearance.
- Real purchasing, payment, billing, automatic procurement or operational approvals.
- Production offline synchronisation, native mobile applications, prediction engines, AI operational agents or verified recovery/ROI claims.
- Production mine-site deployment or an unapproved public production release.

A persistent **`DEMO / SIMULATED DATA`** indicator must appear throughout a future prototype. Mock actions must never imply that real equipment, people, purchasing or safety processes were controlled.

## 4. Repository map

The monorepo has two workspaces: the app and the shared contracts.

```text
VESPER/
├── .github/workflows/        # CI: typecheck, lint, unit tests, build and browser tests
├── apps/
│   └── mine-operator/        # The single VESPER frontend (Next.js App Router)
│       ├── src/app/          # Routes, layouts and the style sheets
│       ├── src/components/   # Screens, dialogs and shared UI
│       ├── src/lib/          # Rules, selectors, reports and the mock domain store
│       ├── src/mocks/        # MSW handlers: the in-browser mock API
│       ├── e2e/              # Playwright tests
│       └── public/           # Brand images, fonts and the fictional site plan
├── deployment/               # Client deployment template, README and checklist (no provisioning)
├── docs/                     # The five specifications and the reference image
│   └── architecture/         # Current-state audit, subscription, database and deployment architecture
├── infrastructure/           # Placeholder only; not permission for live infrastructure
├── packages/
│   └── api-contracts/        # Zod contracts and the cause lists shared by app and tests
├── tests/                    # Placeholder for cross-module acceptance tests
├── AGENTS.md                 # Mandatory rules for any implementation agent
├── CLAUDE.md                 # Atlas / Claude-specific work instructions
└── README.md                 # This project orientation
```

The versionless Backend Schema filename shown here reflects the completed v1.1 reconciliation. Verify actual files before relying on links; do not invent missing files. The folder `apps/mine-operator` is a location, **not** a distinct VESPER-branded product.

**Recorded technical placement (ADR-11 and ADR-12; technical-lead sign-off for ADR-11 still pending):** app routes, UI components, features, demo service, MSW fixtures and E2E screens belong in `apps/mine-operator/`; reusable business entity schemas and Zod contracts belong in `packages/api-contracts/`. Do not create a database or actual API server to populate these folders.

### Workspace location and OneDrive

The inspected scaffold resides under a OneDrive-synchronised HIMARK workspace. An actively developed Git working tree, `node_modules` and build output should not be casually operated inside a synchronised folder because of sync conflicts. **Do not move, delete or recreate the project, initialise Git, or alter the HIMARK folder architecture without explicit approval.** An approved local development checkout and a documented sync strategy can be established when implementation is authorised.

## 5. Authoritative documents

Read the current file contents and approval status; do not assume a document is approved merely because its name or version appears here.

| Document | Link | Governs |
| --- | --- | --- |
| Product Requirements Document (PRD) | [PRD](docs/VESPER_3.0_Product_Requirements.md) | Product intent, P0/P1/P2 scope, business rules and acceptance criteria |
| Technical Requirements Document (TRD) | [TRD](docs/VESPER_3.0_Technical_Requirements.md) | Frontend stack, architecture, design tokens, mock services and testing |
| Backend Schema Document (BSD) | [BSD](docs/HIMARK_VESPER_3.0_Backend_Schema.md) | Proposed future domain entities and data integrity; **no database build authorised** |
| Application Flow Document (AFD) | [AFD](docs/VESPER_3.0_Application_Flow.md) | Routes, user journeys, state transitions and cross-screen interactions |
| UI/UX Design Specification | [Design spec](docs/VESPER_3.0_UI_UX_Design_Specification.md) | Visual system and detailed Overview / Command Centre design reference |
| Desktop screenshot | [Reference image](docs/VESPER%20v3.0%20Operational%20Recovery%20Dashboard.png) | **One unapproved illustrative visual mockup**, not a new source of feature requirements |

**Conflict rule:** PRD governs product scope; TRD governs technical execution; BSD governs domain meaning; AFD governs app behaviour; the UI/UX specification governs visual implementation without overriding the earlier documents. The screenshot is **illustrative only**. If requirements conflict, identify the exact sections, request a decision and record it; never resolve a material conflict by quietly inventing functionality.

Atlas reports that decisions **C-01 through C-08** were incorporated into the five **v1.1** specifications, including **ADR-11** (Next.js in the existing monorepo) and **ADR-12** (shared Zod/typed contracts). This is a **reconciled documentation baseline, not formal document sign-off or permission to code**. The PRD, TRD, BSD, AFD and UI/UX specification remain approval-pending; the technical lead must still sign off ADR-11.

## 6. Visual identity

The approved *direction* for design review is a **premium, predominantly light enterprise interface with restrained minimalist neumorphism**:

- Obsidian-black top bar, starting token `#111817`.
- White contextual sidebar and white cards on mineral-white canvas, starting token `#F5F7F5`.
- Restrained emerald accent, starting token `#16865B`.
- Soft, shallow shadows; clear typography, readable status labels, consistent iconography and motion.
- Accessible warning, blocked and unknown states; colour alone never conveys status.

**As built (14 November 2026), directed by the product owner:** the top bar is a white surface that follows the light or dark theme rather than obsidian; type is Inter at a light weight scale (300 to 500); corners use one soft radius scale (4, 6, 8 and 12 px, with 20 px for the sign-in card); and the sign-in page is a full-screen photograph with a single card. These changes are not yet reflected in the UI/UX specification.

Only **one desktop Overview screenshot** has been provided; do not claim that tablet/mobile reference designs already exist. Desktop visual fidelity must not override documented business rules, safety constraints or mobile usability.

## 7. Frontend architecture

What is installed and in use (see `apps/mine-operator/package.json`):

- **Next.js 16 App Router, React 19, strict TypeScript and pnpm** in one workspace and lockfile.
- **Tailwind CSS v4** plus hand-written CSS layers (`globals.css`, `theme.css`, `typography.css`, `chrome.css`, `login.css`, `allocation.css`, `dark.css`), **Lucide React** icons and **Motion** for controlled transitions.
- **Recharts** for charts and **Leaflet** over a local fictional site-plan image for the Operational Map.
- **TanStack Query** for data fetching and caching and **Zustand** for session and demo controls.
- **Mock Service Worker (MSW)** serving a typed, deterministic in-browser API, with **Zod** contracts shared through `packages/api-contracts`, and **React Hook Form** for forms.
- **Vitest and Testing Library** for unit tests and **Playwright** for browser tests.

Not installed: shadcn/ui and Radix (the components are hand-built), and Storybook. The TRD lists them as options, not as built.

### Simulation integrity

- The mock domain store is the single mutable operational source of truth; MSW exposes only fictional mock endpoints (for example, `/_demo/api/v1`), not real backend routes.
- Treat `On Plan`, `At Risk`, `Blocked` and `Unknown` as **operational status**; treat `Reported`, `Verified`, `Pending`, `Stale`, `Conflicting`, `Unknown` and `Pending Synchronisation` as distinct **information-quality/processing states**.
- An unknown inventory value is **not zero**; a reported fault is **not automatically a verified area blockage**; a repair-complete event is **not safety clearance or proof of operational resumption**.
- Use one fictional scenario record graph so issue, area, equipment, action, handover and report views remain consistent. The reconciled v1.1 documentation adopts the fictional `Riverside Mine / Crusher C-02` fixture for the existing Equipment Breakdown scenario; it adds no new product scenario.
- Present recovery or financial opportunity as **not quantified** unless an approved, inspectable calculation exists. Never invent verified tonnes or Rand savings.

## 8. Delivery stages and approval gates

The TRD describes a gated Stage 0-7 sequence. The list below is a plan, **not a command to commence**:

| Stage | Planned work | Evidence needed to exit |
| --- | --- | --- |
| **0 - Repository audit** | Scaffold inspected; ADR-11/12 recorded; technical-lead sign-off outstanding | Formal technical architecture sign-off before the next authorised stage |
| **1 - Foundation** | Approved framework, TypeScript, tooling, design tokens, component baseline | Build and component smoke tests |
| **2 - Shell and motion** | Header, collapsible sidebar, routes, responsive navigation and Overview composition | Reference designs and interactions reviewed (the screenshot is a visual reference, not a pixel-perfect target) |
| **3 - Demo domain** | Typed contracts, MSW, seeded fixtures and cross-view state | Deterministic mutation and state tests |
| **4 - Core workflows** | Exceptions, equipment, map and dependencies | Operational-breakdown scenario passes |
| **5 - Preventive workflows** | Maintenance due, resource readiness and parts warning | Maintenance-delay-prevention scenario passes |
| **6 - Continuity and intelligence** | Shift handover, Reports, notifications and demo entitlements | Handover, tier and deep-link tests pass |
| **7 - Refinement** | Accessibility, responsiveness, visual QA, regression and handover | P0 acceptance criteria and mandatory scenarios pass |

**Where the build stands.** In practice the application covers the stages above through the shell, demo domain, core and preventive workflows, shift continuity, reports, notifications and demo entitlements, with accessibility and visual refinement ongoing. This records what exists. It is **not** a record that any stage gate was formally passed, and the approval-pending status of the specifications is unchanged.

Stages need an explicit task-level go-ahead and scope; do not infer authorisation from this table or from the existence of files. Approved previews require appropriate access protection and demo labelling; a live production release remains prohibited.

## 9. First steps for a human or AI contributor

1. Confirm that the active folder really is the **VESPER project root**, not the separate HIMARK Intelligence vault or a placeholder product-context folder.
2. Read [`AGENTS.md`](AGENTS.md). If using Claude/Atlas, also read [`CLAUDE.md`](CLAUDE.md).
3. Open all five documents in `docs/`, verify their actual versions and approval status, and inspect the reference image when a visual task warrants it.
4. Check which work stage and exact files have been authorised. If approval is missing, **stop at read-only assessment and ask**.
5. Before permitted changes, provide a focused change plan and identify risks or contradictions.
6. After permitted changes, report exactly what changed, checks run (or not run), limitations, and which approval gate remains.

**Repository access does not mean edit approval.** The separate HIMARK Intelligence vault is contextual knowledge, not this repository's source-code working tree. Do not access HIMARK Restricted or secrets without a separate, explicit business need and authorisation.

---

**Maintainer:** HIMARK SGC / VESPER product owner  
**README status:** Draft for leadership and technical review; no sign-off implied.  
**Last updated:** 14 November 2026 (build status, run instructions and repository map; documentation baseline v1.1)
