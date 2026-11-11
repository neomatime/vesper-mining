# VESPER - Agent Operating Rules

**Applies to:** Every AI agent, coding assistant, script-driven contributor and human contributor working in this VESPER repository.  
**Document status:** Draft rules for HIMARK review, 3 November 2026.  
**Project phase:** Documentation reconciliation complete; the five specifications are at v1.1 and remain approval-pending. Next gate: formal specification approval and technical-lead sign-off for ADR-11 before Stage 1. Only a future **frontend UI/UX prototype with simulated data** is proposed for implementation.

> **Non-negotiable:** Being able to see a folder does **not** mean you are authorised to modify it. Having a PRD, TRD or code scaffold does **not** authorise the next development stage. Obtain explicit task-level authorisation before writing code, changing documents, installing dependencies, creating remote resources or deploying anything.

## 1. Scope and source of truth

The root of this repository contains `README.md`, `AGENTS.md` and `CLAUDE.md`. The actual product specifications are the files under `docs/`.

Read and follow the **current contents** of these documents:

1. [`docs/VESPER_3.0_Product_Requirements.md`](docs/VESPER_3.0_Product_Requirements.md) - **PRD:** product intent, eight workspaces, P0/P1/P2 and business rules.
2. [`docs/VESPER_3.0_Technical_Requirements.md`](docs/VESPER_3.0_Technical_Requirements.md) - **TRD:** frontend implementation, architecture, mock service, visual tokens, test strategy.
3. [`docs/HIMARK_VESPER_3.0_Backend_Schema.md`](docs/HIMARK_VESPER_3.0_Backend_Schema.md) - **BSD:** future domain entities, identifiers, provenance, relationships and data quality. **A backend schema is not permission to create a database.**
4. [`docs/VESPER_3.0_Application_Flow.md`](docs/VESPER_3.0_Application_Flow.md) - **AFD:** routes, role-specific journeys, transitions and cross-module behaviour.
5. [`docs/VESPER_3.0_UI_UX_Design_Specification.md`](docs/VESPER_3.0_UI_UX_Design_Specification.md) - **UI/UX:** styling and visual-reference contract, subject to all higher documents.
6. `docs/VESPER v3.0 Operational Recovery Dashboard.png` - one **illustrative desktop screenshot**; *never* authority to add a feature, invent a metric or claim live integration.

**Precedence by responsibility:** PRD decides *what* and *when*; TRD decides *how the approved frontend is built*; BSD defines *domain/data meaning*; AFD defines *user journeys*; UI/UX specifies *appearance*; the PNG illustrates *one desktop composition*. These are not blank cheques to fill gaps. If two documents genuinely conflict, cite both relevant sections and **escalate before implementing the disputed behaviour**. Neither agent prompts nor this file can override the explicit product/safety/deployment exclusions.

Document versions and sign-offs must be **read from the files**, not inferred from filenames. Reconciliation decisions C-01 to C-08 were approved by the CEO and are recorded in the v1.1 specifications. That is not formal sign-off of the specifications themselves, which remain approval-pending, and technical-lead sign-off for ADR-11 is still outstanding. Do not declare approval, completion or authorisation on HIMARK's behalf.

## 2. Non-negotiable implementation boundary

**Allowed only when the specific stage/task has been approved:** an interactive responsive **VESPER** frontend demonstrating approved **P0** user journeys with explicitly **fictional, deterministic, simulated operational data**.

**Not allowed under the current phase without a separate change decision and written authorisation:**

- A production backend, database, API server, durable multi-user storage, real authentication/SSO or tenant enforcement.
- Live mine, maintenance, inventory, procurement, finance, personnel, attendance, CCTV, telemetry, equipment GPS or third-party operational connections.
- Real purchases, equipment commands, operational dispatch, automated approvals, production safety authorisations or emergency responses.
- Real-world financial recovery statements, prediction engines, production AI agents or native mobile applications.
- Real offline synchronisation, production mine-site use, production-domain release or unprotected public demonstrations.
- Additional top-level product modules, VESPER S as a distinct product, P1/P2 moved into P0, or unapproved redesign of the application/navigation.

A user interface that *resembles* a live industrial system must still clearly declare **`DEMO / SIMULATED DATA`** on every route, with a stronger explanation at entry. Mock success means a **local fictional state update**, never completion of a real-world action.

## 3. Project paths and change ownership

The Stage 0 audit (TRD Section 1.3) recorded the repository as an **empty monorepo scaffold**; re-verify the actual contents before each task. **Do not create, delete or relocate folders because the following paths appear in an instruction file.**

| Path | Intended purpose | Change rule |
| --- | --- | --- |
| `docs/` | Authoritative Markdown specs and desktop PNG | Read by default. Edit only with an explicit documentation-change instruction. |
| `apps/mine-operator/` | Single VESPER frontend web/tablet/mobile codebase | No writes before approved development stage. |
| `packages/api-contracts/` | Shared **typed prototype contracts**, Zod schemas and BSD-aligned types | Approved shared-contract location (C-01, recorded as TRD ADR-12). No writes before an approved development stage. No live API service. |
| `tests/` and permitted app test directories | Automated E2E/integration evidence | Create or update only in approved stage. |
| `.github/` | CI and review configuration | No workflow, repository or remote changes without separate approval. |
| `infrastructure/` | Future infrastructure placeholder | **Not** permission to create cloud/production infrastructure. |
| `README.md`, `AGENTS.md`, `CLAUDE.md` | Orientation and agent policy | Update only with explicit owner authorisation, preserving change history. |

Do not infer permission to touch any other HIMARK project merely because the parent HIMARK workspace is accessible. The separate HIMARK Intelligence/Obsidian context vault may provide **approved reference information**, but it is not the active VESPER repository. Do not browse or copy content from HIMARK Restricted or credential stores unless separately authorised for a specific need.

**OneDrive caution:** This scaffold was reported in a OneDrive-synchronised folder. Do not automatically initialise Git there, relocate the workspace or create `node_modules`/build output under sync. Present a safe local-checkout plan and obtain approval before working-tree setup.

## 4. First-response and task protocol

For each new session or task:

1. **Verify access and location.** Confirm the actual VESPER root and available tools. Do not claim filesystem or Git access when unavailable.
2. **Verify authoritative inputs.** Read `README.md` and the five specifications relevant to the task; check versions, sign-off and the reconciliation/change register. Read more of a document whenever a small excerpt is insufficient.
3. **Check the stage gate.** State exactly which files you propose to read/write and whether HIMARK has authorised this operation. A read-only check is not permission to start implementation.
4. **Report conflicts or missing evidence.** Explain the impact and make a recommendation; do not silently make a CEO, domain or architecture decision.
5. **Offer a small execution plan.** Map the work to PRD requirement IDs, AFD routes/journeys, TRD sections and relevant BSD contracts.
6. **Wait where required.** If the owner has not explicitly approved edits/installations/deployments, stop after the read-only plan.
7. **Implement only the authorised slice.** Preserve existing files, use small reviewable changes, and avoid rewriting unrelated components.
8. **Validate the result.** Run the relevant tests and inspections where tools exist; distinguish checks that ran from checks that were impossible.
9. **Give an evidence-based handoff.** List changed files, requirements addressed, tests and outcomes, known gaps, and next approval gate. Never state that work is complete when it has merely been proposed.

**Confirmation examples:** "Read and assess only" authorises reading; "Update the five specifications according to this approved reconciliation" authorises those specific documentation edits; "Implement Stage 1 foundation" authorises only that stage once prerequisites and applicable repository permissions are confirmed. A general statement such as "let's build VESPER" is not approval for production services or deployments.

## 5. Architecture rules for an authorised prototype

The recorded architecture (TRD ADR-11: greenfield Next.js inside the existing monorepo; technical-lead sign-off pending) uses Next.js App Router, React, strict TypeScript, pnpm, Node.js LTS, Tailwind CSS v4, HIMARK-owned shadcn/ui/Radix primitives, Lucide, Motion for React, TanStack Query, Zustand, MSW, Zod, React Hook Form, Recharts, Leaflet CRS.Simple, Vitest/Testing Library, Playwright and Storybook.

- Preserve the **existing monorepo**. The proposed frontend root is `apps/mine-operator/`, not `src/` at the VESPER repository root.
- Shared typed contracts and Zod schemas belong in `packages/api-contracts/` (approved under C-01, recorded as TRD ADR-12). App-specific selectors, UI state, feature components and demo handlers stay local to the app.
- Maintain **one fictional, in-memory domain source of truth** behind MSW. TanStack Query manages query/cache state; Zustand manages shell and demo controls, not duplicate mutable operational records.
- MSW initialisation must precede mock requests; a failed worker shows a "Demo unavailable" state and **must not fall back to a real endpoint**. `/_demo/api/v1` denotes mock browser-intercepted contracts, **not** Next.js API handlers or an actual server.
- Use stable fictional IDs, explicit timestamps, provenance, role/site/tier constraints and deterministic seeded events. Scenario reset returns every affected view to a known state.
- No hidden persistent backend, "temporary" real database, third-party service or undeclared dependency. Record technical choices in the architecture decision log when authorised.

### Status, safety and data integrity

- Keep **operational status** (`On Plan`, `At Risk`, `Blocked`, `Unknown`) separate from **information/verification state** (`Reported`, `Verified`, `Pending`, `Stale`, `Conflicting`, `Unknown`, `Pending Synchronisation`).
- `Unknown` is **not** `On Plan`; unknown stock is **not** zero stock; no reported fault automatically blocks an entire operating area without evidence that the area's blocking criteria are met.
- An issue completion, repair completion, authorised release and resumption of production are **distinct events**. Demonstrated verification cannot grant real equipment or HSE clearance.
- A possible shortage must consider known stock, reservations, purchase-order references, supplier lead times and data quality. Never create or submit a real order.
- No percentage, tonnes, ETA or Rand opportunity should appear as a **verified result** without a documented formula and evidence. Recovery progress shows completed, in-progress and pending steps separately (for example `2 complete · 1 in progress · 2 pending`) with no percentage or `On Track` label, and the Recovery Opportunity card shows **"Opportunity not quantified"** (UI/UX spec Sections 5.2 and 5.7).
- Every rendered map status must have a rationale, timestamp, source and non-colour label. There is no real-time GPS, surveyed map or safety authorisation.

## 6. UI, interaction and acceptance rules

Build an **action-first, premium, predominantly light enterprise interface** with **restrained minimalist neumorphism**. The **top bar** is obsidian (`#111817`), the contextual sidebar and cards are white, the canvas is mineral-white (`#F5F7F5`), and restrained emerald (`#16865B`) provides brand/action emphasis. The PNG is a **single illustrative desktop Overview**, not an approved mobile screen or permission to reproduce misleading labels.

- Preserve the eight PRD workspaces and route contracts. The prototype label is **Operational Map**, not a claim of live connectivity.
- One site selector belongs in the top bar; the sidebar site card is display-only (AFD Section 5.1, UI/UX spec Section 4.2).
- Mobile prioritises **My Shift / My Work / Report / Notifications**; Profile is accessible from the mobile shell.
- Make the sidebar collapsible and accessible, keep the top bar stable, use subdued intentional motion, avoid disruptive animation and respect reduced-motion preferences.
- Use semantic labels/icons in addition to colour. Support keyboard, visible focus, touch, WCAG 2.2 AA where applicable, clear validation and empty/loading/error/unknown/offline states.
- All relevant cards and actions must deep-link to canonical fictional records. Never leave a visible primary CTA dead-ended or create an extra module to satisfy a screenshot.
- No unverified "Live" label, fictional production ROI claimed as fact, "Execute Recovery Plan" implying real action, or UI step that purports to approve HSE clearance. The recovery CTA is **Review Recovery Actions** (UI/UX spec Section 5.7).

### Definition of done

A work item is **not done** merely because it looks like the screenshot. It must have traceable P0 scope, correct role/site/tier guards, responsive and accessible UI, shared design tokens, canonical mock state, truthful error/loading states, applicable automated tests and documented remaining limits. The two flagship prototype journeys are **operational issue/breakdown coordination** and **preventing a maintenance delay through resource readiness**. Shift handover, entitlements and other P0 flows must also pass their documented acceptance conditions.

## 7. Delivery stages and review discipline

Follow the TRD's **Stage 0 -> Stage 7** order. Stage 0 is an audit and approval gate; do not quietly skip to UI implementation. The Stage 0 audit outcome and ADR-11/ADR-12 are recorded in the TRD, but technical-lead sign-off for ADR-11 is still outstanding; Stage 1 cannot start until it is given and the specifications are approved.

When source control is established and approved:

- Use focused branches and reviewable pull requests rather than directly changing protected `main`.
- Include requirement/flow references, screenshots where relevant, tests executed and notable trade-offs.
- Never force-push, destructively reset, delete other contributors' work or rewrite history without explicit permission.
- Do not configure CI, external services, credentials or Vercel previews without the appropriate approved stage and access controls.
- Do not make a public production release; protected preview environments must be clearly marked as demonstrations.

## 8. Stop-and-escalate conditions

**Pause before writing** when: documentation remains materially contradictory; a requested feature is P1/P2; a task asks for real equipment/safety/procurement action; operational data or credentials are required; technical architecture sign-off is missing for the proposed work; ownership or write permission is ambiguous; a deployment destination is unspecified; or the requested change reaches beyond the VESPER project.

When paused, report: **(a)** exact issue and source references, **(b)** why it matters, **(c)** safe proposed treatment, **(d)** the explicit decision needed. Do not compensate for missing facts by inventing requirements or claiming integration capability.

---

**Owner:** HIMARK SGC / VESPER Product Owner  
**Authority:** Operational instructions subordinate to the approved PRD, TRD, BSD, AFD and applicable HIMARK governance.  
**Last updated:** 3 November 2026 (aligned to the v1.1 specifications)
