# VESPER 3.0

**The Mining Operating System**  
**HIMARK SGC**  
*Identify delays. Prevent avoidable waiting. Recover productive time.*

> **Current status (3 November 2026):** Atlas reports that documentation reconciliation is complete: all five authoritative specifications are now **v1.1** in the real project `docs/` directory. **All five still await formal approval**, and technical-lead sign-off for architecture decision ADR-11 remains pending. The VESPER workspace remains an empty monorepo scaffold, not a runnable application. **This README does not authorise application development.** The next delivery target, once separately approved, is an interactive UI/UX prototype using fictional, clearly labelled simulated data.

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

This is the **existing monorepo scaffold** reported by Atlas, with intended responsibilities. Subdirectories shown below the scaffold may not exist yet; **do not treat this diagram as evidence of created code**.

```text
VESPER/
├── .github/                  # Reserved for approved workflows and PR templates
├── apps/
│   └── mine-operator/        # Intended single VESPER frontend (currently a scaffold)
├── docs/
│   ├── VESPER_3.0_Product_Requirements.md
│   ├── VESPER_3.0_Technical_Requirements.md
│   ├── HIMARK_VESPER_3.0_Backend_Schema.md
│   ├── VESPER_3.0_Application_Flow.md
│   ├── VESPER_3.0_UI_UX_Design_Specification.md
│   └── VESPER v3.0 Operational Recovery Dashboard.png
├── infrastructure/           # Scaffold only; not permission for live infrastructure
├── packages/
│   └── api-contracts/        # Approved shared typed/Zod contract location (ADR-12); no code yet
├── tests/                    # Reserved for cross-module and acceptance tests
├── AGENTS.md                 # Mandatory rules for any implementation agent
├── CLAUDE.md                 # Atlas / Claude-specific work instructions
└── README.md                 # This project orientation
```

The versionless Backend Schema filename shown here reflects the completed v1.1 reconciliation. Verify actual files before relying on links; do not invent missing files. The folder `apps/mine-operator` is a location, **not** a distinct VESPER-branded product.

**Recorded technical placement (ADR-11 and ADR-12; technical-lead sign-off for ADR-11 still pending):** app routes, UI components, features, demo service, MSW fixtures and E2E screens belong in `apps/mine-operator/`; reusable business entity schemas and Zod contracts belong in `packages/api-contracts/`. Do not create a database or actual API server to populate these folders. No code has been created yet.

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

Only **one desktop Overview screenshot** has been provided; do not claim that tablet/mobile reference designs already exist. Desktop visual fidelity must not override documented business rules, safety constraints or mobile usability.

## 7. Proposed frontend architecture (not yet installed)

The TRD's greenfield reference architecture includes:

- **Next.js App Router, React, strict TypeScript, Node.js LTS and pnpm** in a single workspace/lockfile.
- **Tailwind CSS v4**, HIMARK-owned **shadcn/ui/Radix** components and **Lucide React** icons.
- **Motion for React** for controlled transitions; **Recharts** for charts; **Leaflet CRS.Simple** over a local fictional site-plan image.
- **TanStack Query** for query/cache management and **Zustand** for UI and demo controls.
- **Mock Service Worker (MSW)** with typed, deterministic in-memory simulation and **Zod** schema validation.
- **React Hook Form**, **Vitest/Testing Library**, **Playwright** and **Storybook**.

The Stage 0 read-only audit reported no existing application framework to preserve; **Next.js within the existing monorepo is now the recorded architecture decision (ADR-11)**, subject to outstanding technical-lead sign-off. **Do not claim dependencies are installed, tests are running or a development server is available.** There are no valid project run commands to document until Stage 1 actually creates and verifies the manifest/scripts.

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
**Last updated for documentation baseline v1.1:** 3 November 2026
