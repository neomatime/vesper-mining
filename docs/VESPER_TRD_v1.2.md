# VESPER 3.0 — Technical Requirements Document

**HIMARK SGC**  
**TECHNICAL ARCHITECTURE / MINING TECHNOLOGY**

**THE MINING OPERATING SYSTEM**

Identify delays. Prevent avoidable waiting.  
Recover productive time.

| **VERSION** | **1.2**                              |
|-------------|--------------------------------------|
| **DATE**    | **11 NOVEMBER 2026**                 |
| **STATUS**  | **REVISED DRAFT - APPROVAL PENDING** |

**CURRENT DEVELOPMENT AUTHORISATION**

Interactive frontend prototype only.  
No production backend, live integrations or operational deployment.

## Document control

| **ORGANISATION**     | HIMARK SGC                                                                                                                                               |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **PRODUCT**          | VESPER - The Mining Operating System                                                                                                                     |
| **DOCUMENT**         | Technical Requirements Document (TRD)                                                                                                                    |
| **VERSION / STATUS** | 1.2 / Mobile architecture reference - approval pending                                                                                                   |
| **PREPARED ON**      | 2 November 2026                                                                                                                                          |
| **CURRENT PHASE**    | UI/UX prototype architecture and specifications                                                                                                          |
| **NEXT DELIVERABLE** | Interactive UI/UX prototype after approval                                                                                                               |
| REVISION 1.1         | 10 November 2026 - Core Mobile entitlement and associated frontend guards updated; no backend authorisation.                                             |
| REVISION 1.2         | 11 November 2026 - proposed native mobile, future web/backend architecture and offline-sync requirements documented; Build 01 remains UI prototype only. |

## Contents

| **01** Document Authority and Technical Decisions        | **11** Equipment, Delay Intelligence and Maintenance Calculations |
|----------------------------------------------------------|-------------------------------------------------------------------|
| **02** Scope and Explicit Exclusions                     | **12** Resource Readiness and Spare Parts Early Warning           |
| **03 Prototype and Future Technology Stacks**            | **13** Module-Level Technical Requirements                        |
| **04** Application Architecture and Repository Structure | **14 Mobile Application and Offline Strategy**                    |
| **05** Design System and Brand Fidelity                  | **15** Roles, Sites and Subscription Entitlements                 |
| **06** Motion, Hover and Interaction Specification       | **16** Notifications, Search and Operational Feedback             |
| **07** Responsive Layout, Routing and Navigation         | **17** Accessibility, Responsiveness and Performance              |
| **08** Data Model and Contract Standards                 | **18** Security, Data Protection and Safety Boundaries            |
| **09** State Management and Mock Service Architecture    | **19** Testing Strategy and Definition of Done                    |
| **10** Operational Map Technical Specification           | **20** Delivery Sequence, Handover and Sign-Off                   |

## 1. Document Authority and Technical Decisions

### 1.1 Purpose

This TRD establishes the technical implementation contract for VESPER 3.0's UI/UX prototype. It converts the approved-priority features in the Product Requirements Document (PRD) into frontend architecture, library choices, interfaces, visual tokens, interaction standards, mock-data behaviours and testable acceptance conditions.

**This TRD does not authorise production software development.** A convincing prototype is not evidence of live integrations, operational safety approval, backend readiness or commercial deployment.

### 1.2 Decision Register

| **ID** | **Technical decision**                                                                                                                                          | **Rationale**                                                                                                   |
|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| ADR-01 | One VESPER product; browser-optimised mobile in Build 01 and a possible native Android/iOS client in a separately approved future phase                         | One product identity and shared domain; separate delivery technologies do not imply separate brands or accounts |
| ADR-02 | Next.js App Router, React and strict TypeScript as the greenfield reference stack                                                                               | Reusable routes, layouts and typed feature boundaries                                                           |
| ADR-03 | Preserve an existing healthy React/Vite codebase if repository audit shows migration adds no value                                                              | Avoid rebuilding code for cosmetic reasons                                                                      |
| ADR-04 | Tailwind CSS v4 and HIMARK-controlled shadcn/ui components                                                                                                      | Consistent, inspectable UI foundations                                                                          |
| ADR-05 | Motion for React for coordinated layout and gesture animation; native CSS for simple transitions                                                                | One coherent motion language                                                                                    |
| ADR-06 | TanStack Query for domain query/cache state; Zustand for UI and demo controls                                                                                   | Avoid duplicated sources of truth                                                                               |
| ADR-07 | Mock Service Worker (MSW) for browser-intercepted demo endpoints                                                                                                | Realistic application behaviour without backend services                                                        |
| ADR-08 | Leaflet CRS.Simple with a local site-plan image and polygons                                                                                                    | Spatial interaction without pretending to have live GPS                                                         |
| ADR-09 | A single scenario engine with repeatable fixtures                                                                                                               | All modules react consistently to the same demo events                                                          |
| ADR-10 | No external system integrations, real procurement, safety authorisation or production data                                                                      | Protect the project's explicit UI-only boundary                                                                 |
| ADR-11 | React Native + Expo + TypeScript is the preferred native-mobile reference stack for a future production phase, pending a repository and field-device assessment | Capture the mobile architecture now without authorising native app development                                  |
| ADR-12 | Web and native mobile would share approved domain types, API contracts and design tokens, but maintain platform-specific presentation components                | Avoid the false assumption that browser components can be copied directly into a native app                     |
| ADR-13 | Future field workflows require local persistence, idempotent synchronisation, server acknowledgement and explicit conflict states                               | Prevent offline data loss, duplicate submission and misleading delivery indicators                              |
| ADR-14 | Production APIs, identity, tenancy controls, deployment distribution and database security require separate architecture and mine-site approvals                | Keep the current interactive demonstration distinct from a deployable mining system                             |

### 1.3 Governance and Pre-Implementation Gate

Before coding starts, the delivery lead must inspect the existing VESPER repository, identify its framework, current packages, routing, components and deployments, and record any proposed divergence from this TRD. **Do not migrate an already functional React frontend to Next.js without a separately approved engineering case.** The document specifies the reference target, not permission to discard working code.

Latest mutually compatible, stable package versions must be selected at project initiation, recorded in the lockfile and reviewed for known security issues. No instruction in this TRD means automatically installing the newest untested major release.

### 1.4 Status of the Mobile Architecture

This revision documents a preferred future production architecture for Web, native Mobile and shared services. The React Native/Expo stack is a technical proposal, not a signed implementation decision. No native project, production API, database, authentication integration or application-store submission is authorised by this TRD revision.

Before implementation, the VESPER Engineering Lead must audit the existing repository, assess actual mining-device policies and connectivity constraints, review security obligations and record an approved Architecture Decision Record (ADR). The PRD remains the authority for product capability and subscription entitlements; this amendment does not add new P0 features.

## 2. Scope and Explicit Exclusions

### 2.1 In Scope - UI/UX Prototype

- Complete, reusable design system and application shell.

- Responsive VESPER Web, tablet and mobile browser interfaces.

- The eight PRD workspaces with prioritised P0 workflows.

- Interactive 2D Operational Map using simulated site information.

- Operational incident creation, ownership, dependencies and simulated verification.

- Equipment, maintenance, Delay Intelligence and Spare Parts Early Warning experiences.

- Shift preparation, work lists and handover interactions.

- Demonstration reports and tier-based feature visibility.

- Role and site switching using fictional demo personas.

- Consistent simulated requests, loading, errors and notifications.

- Automated tests, component documentation and protected preview deployments.

### 2.2 Out of Scope - No Exceptions Without Change Approval

- Production backend, database, API server or durable multi-user data storage.

- Live SAP, Maximo, ERP, CMMS, FMS, attendance or procurement connections.

- Actual equipment GPS, telematics, sensor streams, biometric clock-in or CCTV.

- Real permissions or identity provider integration; SSO and enterprise authentication are future concerns.

- Live mining-site deployment, safety-critical decisions or equipment commands.

- Actual purchase requisitions, procurement approvals, payments or orders.

- Predictive maintenance algorithms, AI agents or verified economic recovery modelling.

- Native iOS/Android builds, app distribution, push-notification infrastructure and real offline transaction synchronisation during Build 01; they are future design candidates only.

- Production billing, subscription enforcement or enterprise multi-tenancy.

A mocked interaction must never be described in the UI as a completed real-world action. The application must display an unobtrusive but persistent **DEMO / SIMULATED DATA** indicator, with a more prominent explanation on its landing screen.

### 2.3 Priority Handling

P0 means the behaviour must be demonstrated in the current prototype; P1 means an optional enhancement; P2 means future product implementation. The UI-only boundary applies to all three categories. The PRD is the source of truth for business scope; this TRD is the source of truth for technical execution.

## 3. Prototype and Future Technology Stacks

| **Layer**              | **Technology**                                    | **Implementation requirement**                                        |
|------------------------|---------------------------------------------------|-----------------------------------------------------------------------|
| Application            | Next.js App Router + React + TypeScript           | Greenfield reference; use strict typing and persistent shared layouts |
| Package management     | pnpm and Node.js active LTS                       | Committed lockfile; no floating dependency versions                   |
| Styling                | Tailwind CSS v4                                   | Theme tokens and approved utility patterns                            |
| Accessible components  | shadcn/ui with Radix primitives where appropriate | Source-controlled and restyled to VESPER; not generic theme defaults  |
| Animation              | Motion for React (motion/react)                   | Shared motion presets; CSS for simple hover/focus responses           |
| Icons                  | Lucide React                                      | Consistent stroke weight and semantic use                             |
| Tables                 | TanStack Table                                    | Sort, filter, paginate and accessible table semantics                 |
| Charts                 | Recharts                                          | Shared visual grammar, tooltips, legend and empty states              |
| Operational map        | Leaflet with CRS.Simple                           | Local image overlay; polygon and issue-marker interaction             |
| Forms                  | React Hook Form + Zod                             | Schema-driven validation and field-level messages                     |
| Domain query state     | TanStack Query                                    | Typed queries, mutations and cache invalidation                       |
| UI / demo state        | Zustand                                           | Selected persona, site, shell state and scenario controls only        |
| API mocking            | Mock Service Worker (MSW)                         | Browser worker for deterministic in-memory demo requests              |
| Unit/component testing | Vitest + Testing Library                          | Rules, components and interaction correctness                         |
| End-to-end testing     | Playwright                                        | Chromium, Firefox, WebKit and representative mobile viewports         |
| Component reference    | Storybook                                         | Document shared design elements and behaviour variants                |
| Source / previews      | GitHub + Vercel                                   | Branch review, CI checks and preview deployment protection            |

### 3.1 Dependency Discipline

- One package manager and one lockfile across the repository.

- No duplicate icon, toast, chart or animation frameworks without an approved architecture decision.

- Evaluate bundle cost and maintenance risk before adding a dependency.

- Do not combine GSAP, Lenis, Lottie or another global animation engine with Motion by default.

- Prefer maintained, accessible primitives to custom implementations of modal focus trapping, keyboard menus and popovers.

- Update package choices only through reviewed pull requests with test evidence.

### 3.2 Next.js Integration Rule

Use Server Components where they naturally support static application chrome, but implement interactive simulation and browser-only mapping in appropriately scoped Client Components. MSW runs in the browser; its worker must initialise before any mocked data requests fire. Do not use Next.js route handlers or server actions as an undeclared production backend.

If the repository audit chooses the existing Vite architecture, the same feature boundaries, components, tokens, mock contracts and acceptance requirements remain mandatory.

### 3.3 Delivery Architecture by Phase

VESPER has one product identity and domain model, but different clients may be built with different technologies. The approved current phase remains a browser-based prototype; the production references below are explicitly subject to engineering, security and mining-site validation.

| **Delivery layer**               | **Reference technology**                                                                                               | **Purpose / implementation boundary**                                                                                                                |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Build 01 - interactive prototype | Current React/Next.js or retained healthy Vite + TypeScript; Tailwind; MSW                                             | Web, tablet and mobile browser screens; only fictional seeded data and simulated offline states; no real backend.                                    |
| Future production Web            | React + TypeScript; Next.js preferred where justified by repository audit                                              | Desktop/tablet Command Centre, operational map, maintenance, readiness, shift management and Reports.                                                |
| Future production Mobile         | React Native + Expo + TypeScript; Android and iOS builds                                                               | Dedicated field workflow client. Native UI built separately; shared product branding, typed contracts and approved business rules.                   |
| Future shared platform           | Versioned APIs, identity/authorisation, PostgreSQL candidate, event history, sync service and encrypted object storage | One authoritative operational record across Web and Mobile; actual stack and hosting selected only after threat modelling and integration discovery. |

### 3.4 Proposed Native Mobile Technology Stack - Future Phase Only

| **Concern**             | **Preferred candidate**                                                        | **Architecture note / review gate**                                                                             |
|-------------------------|--------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| App framework           | React Native + Expo + TypeScript                                               | One dedicated Android/iOS codebase. Confirm device support, native module needs and lifecycle cost.             |
| Navigation              | Expo Router                                                                    | Role-aware mobile routes and deep links; validate actual offline entry and link handling.                       |
| Local operational data  | expo-sqlite / SQLite                                                           | Persistent drafts and queued mutations; evaluate SQLCipher and validate encryption in compiled device builds.   |
| Credentials and secrets | expo-secure-store                                                              | Store limited secrets/keys, not large report payloads; use approved session policies and revocation.            |
| Field evidence          | Expo camera/image picker and file-system APIs, subject to approval             | Preserve file metadata, access controls, consent and attachment retry; no assumption cameras are allowed.       |
| Connectivity and sync   | Network-state detection + VESPER-owned outbox/sync engine                      | Retry on foreground/reconnection; OS-scheduled background tasks are best-effort, not guaranteed delivery.       |
| App state / contracts   | Shared TypeScript schemas/Zod + mobile-specific state/query layer              | Share identifiers and domain rules; do not treat browser UI components as React Native components.              |
| Notifications           | Device push only when authorised; in-app status first                          | Push not guaranteed underground or offline; never a mine safety or emergency notification system.               |
| Build / distribution    | Expo EAS development/production builds; approved MDM or store channel          | No public app-store publication, external account or production signing key in Build 01.                        |
| Validation              | Automated native component tests + device-level E2E; real Android/iOS hardware | Verify low-end hardware, storage pressure, interrupted sync, lifecycle and accessibility before any mine trial. |

### 3.5 Shared Backend and API - Proposed, Not Authorised

The future shared backend should serve both Web and Mobile under the same organisation/site scoping rules. The reference is versioned HTTPS APIs with token-based enterprise authentication (OIDC/OAuth 2.0 or site-approved equivalent), server-side authorisation, PostgreSQL as a candidate system of record, immutable operational event history, attachment storage, synchronisation endpoints and observable failure/retry handling. Exact backend framework, hosting region, integration pattern and data-retention policy remain open decisions.

Do not provision an API, database, cloud storage bucket, identity provider, device push service or background worker in Build 01. The existing MSW mock endpoints remain the sole interactive prototype source.

## 4. Application Architecture and Repository Structure

### 4.1 Layered Frontend

**Layer 1 - Application shell:** Routing, persistent top bar, responsive contextual sidebar, page container, breadcrumbs, notification tray and demo ribbon.

**Layer 2 - Design system:** Tokens, primitives, VESPER-specific components, accessible interaction patterns and motion presets.

**Layer 3 - Feature domains:** Overview, Operational Map, Work & Exceptions, Equipment & Maintenance, Resource Readiness, Shift Control, Reports and Administration.

**Layer 4 - Typed data contracts:** Domain schemas, validation, request/response types, selectors and calculations.

**Layer 5 - Mock service:** MSW handlers, deterministic fixtures, simulation clock, mock event history and scenario reset.

**Future replacement boundary:** The simulated service can later be replaced with authorised, versioned operational APIs without redesigning feature components.

### 4.2 Required Folder Responsibilities

| **Path**                 | **Responsibility**                                                     |
|--------------------------|------------------------------------------------------------------------|
| src/app/                 | App Router routes, layout, error boundaries and loading views          |
| src/components/ui/       | Accessible, unbranded primitives owned by HIMARK                       |
| src/components/vesper/   | Branded cards, status indicators, issue timelines and shell components |
| src/design-system/       | CSS tokens, motion presets, component rules and illustrations          |
| src/features/overview/   | Command Centre UI and view-specific selectors                          |
| src/features/map/        | Leaflet implementation, polygons, legend, area detail drawer           |
| src/features/exceptions/ | Issue registration, tracking, dependencies and escalations             |
| src/features/equipment/  | Asset views, maintenance plan and downtime timeline                    |
| src/features/resources/  | Parts readiness, lead-time and purchase-review UI                      |
| src/features/shifts/     | Shift views, work assignments and handover                             |
| src/features/reports/    | Report pages, charts, filters and data definitions                     |
| src/features/admin/      | Mock role, organisation, site and entitlement settings                 |
| src/domain/              | Shared entity types, Zod schemas, calculation functions                |
| src/services/            | Typed API client and query/mutation hooks                              |
| src/mocks/               | MSW browser handlers, scenarios, fixtures and seeded state             |
| src/test/                | Unit helpers and integration test fixtures                             |
| e2e/                     | Playwright journeys and visual regression baselines                    |
| public/demo/             | Fictional site plans and non-sensitive demo assets                     |

No component may import mutable fixtures directly from another screen. All meaningful operational domain data must be accessed through typed service/query hooks.

### 4.3 Routing Contract

Base paths should be predictable: /overview, /map, /exceptions, /equipment, /resources, /shifts, /reports and /admin. Detail routes use stable identifiers, for example /exceptions/\[id\] and /equipment/\[id\]. A direct link must reopen the correct record and respect the current demo persona and site scope.

Preserve the shell across route changes. A route transition must not reset the selected site, persona, sidebar state or scenario unless explicitly requested.

### 4.4 Future Web/Mobile Code Ownership

If a later repository audit supports a shared workspace, a candidate structure is apps/web, apps/mobile, packages/contracts, packages/domain, packages/design-tokens and packages/api-client. This is illustrative only: do not reorganise the current repository simply to match a diagram.

Share product semantics, API schemas, entitlement predicates, calculation utilities and palette/spacing tokens where practical. Web continues to use its existing web primitives; React Native uses platform-native accessible components. Do not assume shadcn/ui, DOM layout, CSS transitions or browser MSW handlers will run directly inside the Android/iOS application.

### 4.5 Cross-Client State Consistency

Both clients must ultimately derive issue status, equipment impact, resource readiness and shift handovers from the same authorised backend records. Mobile-only optimistic state must be explicitly pending until confirmed; reports, Map and Command Centre must not present a local draft as a received operational fact.

## 5. Design System and Brand Fidelity

### 5.1 Visual Source of Truth

The approved VESPER desktop and mobile reference designs establish the visual direction: **obsidian-black horizontal top navigation, white contextual inner sidebar, mineral-white main workspace, restrained emerald accents and premium minimalist neuromorphism**. Earlier artwork labelled VESPER S is historical inspiration only; all new experiences must use the single VESPER brand.

Styling decisions must reference one shared token system. Codex must not invent a different palette or icon style for each screen.

### 5.2 Proposed Colour Tokens

| **Token**      | **Reference value**           | **Usage**                                              |
|----------------|-------------------------------|--------------------------------------------------------|
| brand.obsidian | \#111817                      | Top navigation and approved dark surfaces              |
| brand.emerald  | \#16865B                      | Primary actions, selected navigation and confirmations |
| surface.base   | \#FFFFFF                      | Cards and contextual sidebar                           |
| surface.canvas | \#F5F7F5                      | Main workspace background                              |
| surface.soft   | \#EAF1EC                      | Subtle selection and support surfaces                  |
| text.primary   | \#17251C                      | Core interface text                                    |
| text.secondary | \#5A6A60                      | Supporting labels and metadata                         |
| border.subtle  | \#DEE7E0                      | Quiet boundaries and dividers                          |
| status.warning | Controlled amber token        | Operational risk, not decorative highlighting          |
| status.blocked | Controlled red token          | Verified blocked conditions                            |
| status.unknown | Controlled neutral-grey token | Missing, stale or conflicting conditions               |

Token values are implementation starting points and must be visually reconciled against the final approved mockups. Accessibility contrast takes precedence over literal colour matching when necessary.

### 5.3 Typography, Layout and Surfaces

- Use a single professional sans-serif family, proposed **Inter**, with sensible system fallbacks; licence and load fonts through approved project assets.

- Use a small, documented type scale, proposed 12 / 14 / 16 / 20 / 24 / 32 pixels. Avoid unreadably small operational labels.

- Use a 4-pixel base spacing scale with intentional multiples; establish consistent 8, 12, 16, 24 and 32-pixel patterns.

- Use limited border radii, proposed 8 / 12 / 16 pixels, rather than arbitrary values per component.

- Build restrained surface depth using soft shadows and subtle borders; avoid exaggerated inset treatments or low-contrast controls.

- Keep action hierarchy obvious: one clear primary action per local workflow, secondary actions visually quieter.

- Support meaningful information density on desktop without overcrowding the main dashboard.

### 5.4 Shared Component Catalogue

At minimum, implement **AppShell, TopBar, CollapsibleSidebar, PageHeader, SiteSelector, ShiftSelector, DemoBanner, MetricCard, PriorityCard, DataQualityBadge, OperationalStatusBadge, EntityTable, FilterBar, DetailDrawer, Modal, AlertDialog, FormField, NotificationItem, EmptyState, Skeleton, ErrorState, Timeline, DependencyList, ResourceReadinessCard, PurchaseReviewPanel, MapLegend, MapAreaPanel, ReportChart and ResponsiveBottomNavigation**.

Each component requires documented default, hover, active, focus, disabled, loading and error states where applicable. Shared components belong to the design system; business-specific logic remains in the relevant feature module.

## 6. Motion, Hover and Interaction Specification

### 6.1 Motion Philosophy

**Motion must communicate state, direction and continuity.** It must not delay operational information, obstruct a decision or make a screen feel like a marketing website. Keep the global header stable during navigation. Prefer transform and opacity changes to expensive animated layout properties.

### 6.2 Standard Interaction Budgets

| **Interaction**           | **Target duration** | **Required behaviour**                                             |
|---------------------------|---------------------|--------------------------------------------------------------------|
| Button hover or press     | 100-160 ms          | Subtle colour/shadow shift; immediate press response               |
| Card or row hover         | 140-200 ms          | Mild elevation or tint; no disruptive scaling                      |
| Dropdown / tooltip        | 120-190 ms          | Short fade and limited translation                                 |
| Sidebar expand / collapse | 200-260 ms          | Coordinated layout change; text and icons remain legible           |
| Route content transition  | 180-280 ms          | Small fade/translation of content only; shell remains mounted      |
| Detail drawer / modal     | 200-300 ms          | Predictable entry/exit; correct focus handling                     |
| Toast / notification      | 150-220 ms          | Non-blocking arrival and dismissal                                 |
| Map selection highlight   | 100-180 ms          | Immediate accessible outline and details, without obscuring status |

These are **design targets**, not fixed delay timers or promises of frame rate. Review against measured responsiveness on agreed reference devices.

### 6.3 Motion Requirements

**VES-TRD-MOT-001:** Motion presets must be centralised in a typed motion configuration, with a consistent easing strategy.

**VES-TRD-MOT-002:** Use Motion for React for layout transitions and cross-component animation; use CSS transitions for simple background, border and opacity feedback.

**VES-TRD-MOT-003:** Sidebar collapse must animate the layout without causing text distortion, focus loss or unwanted horizontal scrolling.

**VES-TRD-MOT-004:** Avoid infinite pulsing, scroll hijacking, parallax dashboards, animated backgrounds and routine bounce effects.

**VES-TRD-MOT-005:** Operational status changes must be communicated immediately through colour **and** accessible text/icon changes. Animation is optional enhancement, never the sole signal.

**VES-TRD-MOT-006:** Respect prefers-reduced-motion; significant transforms must be disabled or replaced with minimal state changes.

**VES-TRD-MOT-007:** Hover-only functionality is prohibited. The same operation must be available by keyboard and touch.

**VES-TRD-MOT-008:** Charts must not repeat decorative intro animations on every filter change; rapid updates must remain readable.

**VES-TRD-MOT-009:** Use no arbitrary animation delays on urgent warnings, saving confirmation or error feedback.

### 6.4 Micro-Interaction Standards

- Buttons: distinct normal, hovered, pressed, loading, disabled and focused states; never disguise a disabled control as active.

- Cards: subtle hover only if clickable; non-clickable metrics must not imitate buttons.

- Table rows: restrained active-row highlighting and clear action discoverability; no whole-row scale effects.

- Sidebar: icon tooltips when collapsed; logical keyboard order; preserve selection indicator.

- Notifications: deep-link to the underlying simulated issue; preserve unread/read state during the current demo session.

- Forms: lightweight inline validation; avoid shaking fields, moving error labels or auto-dismissing important errors.

- Maps: selected area gains a visible outline and detail pane; no distracting continuous marker animation.

## 7. Responsive Layout, Routing and Navigation

### 7.1 Reference Viewports

| **Profile**  | **Reference width**   | **Expected layout**                                                             |
|--------------|-----------------------|---------------------------------------------------------------------------------|
| Wide desktop | 1440 pixels and above | Fixed top bar, expanded or collapsed contextual sidebar, multi-column workspace |
| Laptop       | 1024-1439 pixels      | Compact dashboard, collapsible sidebar, flexible tables and cards               |
| Tablet       | 768-1023 pixels       | Drawer-style sidebar when required, touch-friendly controls and condensed cards |
| Mobile       | 360-767 pixels        | Dedicated field-focused flows, simple bottom navigation where appropriate       |

These are design reference ranges, not hard device assumptions. Validate content at intermediary sizes and at 200% text zoom. Mobile layouts must remain usable at 320 CSS pixels where applicable under accessibility reflow requirements.

### 7.2 Shared Application Shell

The top navigation must carry the VESPER wordmark, selected site context, search, notifications and demo user information. It uses the approved obsidian background. The white contextual sidebar must support collapse and expansion on desktop, route-aware navigation, an active-state indicator and clear tooltips when collapsed. The main work surface uses mineral-white cards on a soft canvas.

The greeting must reflect the demo local time (for example, Good morning or Good afternoon) without showing a false live operational timestamp. Date, shift, source freshness and demo clock controls must be clearly distinguishable.

### 7.3 Navigation and Accessibility

**VES-TRD-NAV-001:** Every P0 screen has a stable route and meaningful page title.

**VES-TRD-NAV-002:** Browser back/forward navigation must behave correctly.

**VES-TRD-NAV-003:** A detail drawer must have predictable close/back behaviour; deep-linked records must remain accessible after a reload of the demo route.

**VES-TRD-NAV-004:** On mobile, the minimum primary navigation is My Shift, My Work, Report and Notifications, with Profile available without crowding the bottom bar.

**VES-TRD-NAV-005:** A direct link to a record outside a demo persona's permitted site or tier must show an appropriate restricted/unknown state rather than silently showing other-site information.

## 8. Data Model and Contract Standards

### 8.1 Type-Safe Domain Rules

Use TypeScript strict mode, Zod validation at mock service boundaries, stable IDs and explicit nullable or unknown states. Avoid any in public feature contracts. Dates and event times must use ISO 8601 with offsets or UTC instants; site-local presentation must use the configured IANA time zone (South African fixtures may use Africa/Johannesburg). Durations must use a standard internal unit such as seconds, not ambiguous stored strings.

All relevant operational records require id, organisationId, siteId, createdAt, updatedAt, source, reportedAt or observedAt as applicable, and a meaningful information-quality status. Do not conflate observed event time with time received by VESPER.

### 8.2 Minimum Shared Entities

| **Entity**               | **Essential fields in prototype**                                               |
|--------------------------|---------------------------------------------------------------------------------|
| Organisation / Site      | IDs, names, site time zone and active context                                   |
| User / Role              | Fictional user ID, role, site access and demo profile                           |
| Shift                    | ID, site, start/end time, assigned crew and handover state                      |
| Operating Area           | ID, site, image bounds, polygon coordinates, status and status rationale        |
| Equipment                | ID, asset code, type, assigned area, reported state, current meter reading      |
| Operational Issue        | ID, category, site/area/equipment reference, status, priority, reporter, owner  |
| Action / Dependency      | ID, issue reference, accountable owner, prerequisite, deadline and progress     |
| Maintenance Plan         | Asset ID, threshold or scheduled date, applicable part/service requirements     |
| Part Requirement         | Approved part reference, quantity, planned need date and certainty              |
| Stock Snapshot           | On-hand, allocated, reserved, inbound, source and verification state            |
| Purchase Order Reference | Linked part, quantity, expected arrival, status and provenance                  |
| Supplier Lead Time       | Part/supplier reference, duration, basis and last-confirmed date                |
| Operational Event        | Event type, event time, received time, actor/source and audit-friendly sequence |
| Handover                 | Outgoing and incoming shifts, unresolved issues and acknowledgement             |
| Report Metric            | Name, unit, calculation, source inputs, period and confidence                   |
| Subscription Entitlement | Plan, site allowance, enabled capabilities and demo-only indicator              |

### 8.3 Information Quality State

Use explicit information states: **reported, verified, pending, stale, conflicting, unknown and pending synchronisation**. Model operational status separately as **on plan, at risk, blocked or unknown**. A record can be reported and at risk at the same time; these are different dimensions and must never be merged into one status enum.

Critical numeric values must have unit, last-known timestamp and data origin. A null measurement must not silently render as zero, and a missing inventory count must not be interpreted as no stock.

### 8.4 Mock Endpoint Contracts

Use a stable mock endpoint namespace, for example /\_demo/api/v1, with endpoints such as:

- GET /sites, GET /sites/{siteId}/overview, GET /sites/{siteId}/areas.

- GET /issues, GET /issues/{issueId}, POST /issues, PATCH /issues/{issueId}.

- GET /equipment, GET /equipment/{equipmentId}, GET /equipment/{equipmentId}/maintenance.

- GET /readiness, GET /readiness/{activityId}, POST /readiness/{activityId}/reviews.

- GET /shifts, GET /shifts/{shiftId}/handover, POST /shifts/{shiftId}/acknowledgement.

- GET /reports/{reportKey}, GET /notifications, PATCH /notifications/{notificationId}.

These are **frontend mock contracts**. Do not build actual Next.js route handlers for them. The real API design, transport, authentication and eventual endpoint versioning require separate production approval.

### 8.5 Request and Response Behaviour

- Mock request/response validation uses Zod schemas.

- Read responses include metadata and data as appropriate; lists support controlled filtering, sorting and pagination.

- Mutations use stable record identifiers and return the updated canonical entity.

- Expected errors include NOT_FOUND, VALIDATION_ERROR, FORBIDDEN_DEMO, CONFLICT, OFFLINE_SIMULATED and SERVER_ERROR_SIMULATED.

- Mock latency, failure and stale data are selectable for testing, not random surprises during executive demonstrations.

- Request state must be visible through skeletons, disabled-submit affordances and human-readable error messages.

### 8.6 Future Mobile Mutation and Synchronisation Contracts

Future mobile write contracts must define clientMutationId (idempotency key), organisationId, siteId, actor/role context, sourceRecordedAt, serverReceivedAt, entity version, data-quality state and explicit syncState. The server must validate authorisation on every mutation and return a stable authoritative record ID and acknowledgement. Replayed submissions must not create duplicate incidents.

Offline-created media must have durable local references, upload-retry status and clear association with the original issue. Conflict policy must be defined per operation: append-only report events may merge, while competing edits to ownership, priorities or verification require an explicit server-side rule or human resolution. Never silently overwrite the most recent verified state.

Build 01 uses typed fictional DTOs and simulation states only. These future contracts are design constraints for API planning, not an instruction to implement production endpoints now.

## 9. State Management and Mock Service Architecture

### 9.1 One Domain Source of Truth

All mutable operational records belong to one **in-memory mock domain store accessed through MSW**. TanStack Query acts as the client-side cache and data-fetch orchestration layer. Zustand must hold only interface and demo-control state such as selected site, persona, sidebar state and scenario selection. It must not duplicate the mutable issue, equipment, inventory or report records.

A user submitting an issue triggers a typed mutation; the mock service updates the domain store; dependent queries are invalidated or updated through documented cache keys. All affected views then render the same event consistently.

### 9.2 MSW Bootstrap

The browser mock worker must initialise before the first mocked network request. The UI shows a deliberate bootstrap/loading state until registration succeeds. If the worker cannot start, show a clear demonstration-unavailable error instead of silently contacting a real API. Mock handlers are enabled only under an explicitly configured demonstration environment, including protected Vercel previews.

### 9.3 Repeatable Simulation Rules

**VES-TRD-DATA-001:** Scenario reset replaces all mutable mock records with a known seeded state and clears relevant query caches.

**VES-TRD-DATA-002:** A mutation in one module must propagate to all dependent modules.

**VES-TRD-DATA-003:** UI refresh in a demonstration may reconstruct seeded data; it must not imply real durable storage.

**VES-TRD-DATA-004:** Mock actions have a deterministic event sequence and repeatable timestamps from the configured demo clock.

**VES-TRD-DATA-005:** Site and role switches must filter all visible demo records consistently.

**VES-TRD-DATA-006:** No seeded scenario may represent operational status, maintenance authorization or purchases as verified real-world activity.

### 9.4 Persistence Policy

Use browser memory as the default. Local storage may remember harmless UI preferences such as sidebar collapse or preferred demo persona; it must not contain real mining data, production access tokens or confidential client information. If a showcase requires persistence across refreshes, an explicitly labelled local-only demo snapshot may be introduced with a clear reset action and schema-version migration.

## 10. Operational Map Technical Specification

### 10.1 Rendering Architecture

Use Leaflet with **CRS.Simple** and a local, non-sensitive fictional mine plan. Each operating area is a polygon in the same image-coordinate system. Selecting an area opens an accessible detail panel listing its status rationale, relevant constraints, recorded source and last update.

Do not draw realistic moving truck positions without actual location data. The approved first release needs **no external basemap, mapping API key, drone feed, CCTV or GPS service**. Lazy-load Leaflet on the client to prevent browser/server rendering conflicts.

### 10.2 Status Logic

| **Map status**   | **Preconditions for demonstration**                                                           |
|------------------|-----------------------------------------------------------------------------------------------|
| Green - On Plan  | Current sufficient and trusted information confirms the configured operating criteria are met |
| Yellow - At Risk | Credible developing or reported constraint; operation not confirmed blocked                   |
| Red - Blocked    | Verified condition meets the area's defined blocking rule                                     |
| Grey - Unknown   | Required status inputs absent, stale or conflicting                                           |

**VES-TRD-MAP-001:** A newly reported equipment fault must not automatically turn its assigned area red.

**VES-TRD-MAP-002:** Status calculations must expose rule identifier, evaluated inputs and last evaluation time in a human-readable form.

**VES-TRD-MAP-003:** Unknown data must not default to green.

**VES-TRD-MAP-004:** Resolving an issue must not automatically restore green until the area-level operational criteria are again met.

**VES-TRD-MAP-005:** Colours must have labels, icons or text equivalents; keyboard selection and a list-based alternative to map-only interaction are required.

**VES-TRD-MAP-006:** The demo map must show a clear simulated-data statement and must never indicate safety clearance or permission to work.

### 10.3 Responsive Behaviour

Desktop supports a primary map and contextual side panel. Tablet permits a collapsible area drawer. Mobile must prioritise an accessible area list/details workflow over forcing precision interaction with tiny polygons. Zoom, reset view and map legend must remain available at practical touch sizes.

## 11. Equipment, Delay Intelligence and Maintenance Calculations

### 11.1 Equipment View

Each equipment record must show asset identity, assigned area, known state, relevant issues, scheduled maintenance and a link to its mocked external work-order reference where available. The UI must distinguish machine unavailability from actual verified production impact.

### 11.2 Delay Stage Timeline

The timeline supports illustrative events: **Fault Detected, Reported, Response Started, Assessment Completed, Resources Ready, Repair Completed, Authorised Release Recorded and Operation Resumed**. For each stage display an event timestamp, source and any required verification state.

**VES-TRD-MNT-001:** Calculate elapsed time only between valid, ordered events.

**VES-TRD-MNT-002:** Do not double-count overlapping segments when constructing a downtime breakdown.

**VES-TRD-MNT-003:** A missing start/end event results in an incomplete or estimated interval label, not fabricated precision.

**VES-TRD-MNT-004:** Repair completed, authorised release and actual operation resumed are separate states.

**VES-TRD-MNT-005:** A recorded waiting duration is not automatically avoidable or financially recoverable.

### 11.3 Maintenance Due Soon

For hour-based planned maintenance:

**Hours remaining = Next planned service threshold - Current valid operating-hour reading.**

**Estimated days remaining = Hours remaining / Assumed average operating hours per day**, provided the denominator is greater than zero and the reading is sufficiently current.

Calendar-based plans use their authorised scheduled service date. Where multiple triggers apply, display the governing rule explicitly; do not silently infer OEM schedules or component life limits.

If inputs are missing, stale, incompatible or overdue, the UI must say so and suppress misleading exact countdowns. The approved maintenance plan or OEM information remains authoritative in a future implementation.

## 12. Resource Readiness and Spare Parts Early Warning

### 12.1 Technical Objective

Demonstrate how VESPER can connect scheduled work with the parts and other prerequisites needed to perform it. The frontend highlights potential shortages and prompts authorised review; it never places a real order.

### 12.2 Readiness Calculation Rules

A proposed usable-stock calculation is:

**Potentially allocable quantity = Verified on-hand quantity - Allocated quantity - Reserved quantity.**

The exact meaning and exclusivity of stock categories must be confirmed against each future ERP/CMMS integration to avoid subtracting the same reservation twice.

The initial prototype should represent inbound stock separately and only count it toward readiness if its expected arrival date is before the required date and its status meets the configured acceptance rule. An outstanding purchase order does not automatically mean a part will arrive on time.

**Indicative latest-order date = Scheduled need date - Supplier lead time - Approved planning buffer**, with calendar-day versus business-day conventions defined in the relevant fixture.

### 12.3 Warning Decision Contract

| **Condition**                                                     | **UI outcome**                                             |
|-------------------------------------------------------------------|------------------------------------------------------------|
| Confirmed allocable stock sufficient                              | Ready; no duplicate purchase prompt                        |
| Known insufficient stock with viable confirmed inbound delivery   | Review incoming delivery; avoid duplicate suggestion       |
| Known insufficient stock and no timely confirmed inbound delivery | Potential procurement risk; purchasing review advised      |
| Stock or lead-time information unknown / stale                    | Needs confirmation; no assertion that stock equals zero    |
| Maintenance deadline already passed                               | Overdue state; do not show a future ordering window        |
| Component requirement itself unverified                           | Verify maintenance scope before procurement recommendation |

### 12.4 Role-Specific Routing

- Maintenance Planner: upcoming work at risk and missing prerequisites.

- Inventory / Stores: available, reserved and incoming stock data requiring confirmation.

- Procurement: candidate purchasing review and documented supplier lead time.

- Site Manager: only material risks with a justified operational-impact rationale.

**VES-TRD-RES-001:** Show the inputs behind every warning: part reference, applicable maintenance task, required quantity, available status, existing orders, lead time, need date and quality state.

**VES-TRD-RES-002:** A review button records a **simulated acknowledgement/review** only. Never label it Purchase, Order Placed or Purchase Approved unless explicitly marked as a mock action.

**VES-TRD-RES-003:** Demo notifications must deep-link to the affected maintenance/readiness record and be removed or updated when the underlying risk no longer applies.

**VES-TRD-RES-004:** The feature must not automatically recommend increased inventory merely because a component has failed historically. Future forecasting needs validated data and commercial rules.

## 13. Module-Level Technical Requirements

| **Module**                | **P0 screens and interactions**                                                             | **Cross-module dependencies**                 |
|---------------------------|---------------------------------------------------------------------------------------------|-----------------------------------------------|
| Overview / Command Centre | Role-aware metrics, priorities, constraints, source freshness and deep links                | Issues, equipment, map, shifts, reports       |
| Operational Map           | Site-plan canvas, polygons, status explanation, issues and area panel                       | Areas, issues, equipment, quality rules       |
| Work & Exceptions         | New issue, details, assignment, dependency, timeline, escalation and simulated verification | Map, equipment, shifts, notifications         |
| Equipment & Maintenance   | Equipment register, details, planned work, service due, downtime stage analysis             | Issues, resource readiness, reports           |
| Resource Readiness        | Maintenance prerequisites, stock status, lead times, purchasing-review warning              | Maintenance, notifications, reports           |
| Shift Control & Handover  | Current shift, assigned work, unresolved issues, handover review and acknowledgement        | Issues, equipment and relevant role/site data |
| Reports                   | Essential dashboard reports, filters, definitions and entitled advanced views               | Read-only projections of shared mock data     |
| Administration            | Site/persona switch, mock role entitlements, configuration previews and reset control       | All feature gating and demo scenarios         |

### 13.1 Common Component Rules

- Tables must have clear sort/filter affordances, preserved keyboard access, loading and no-data states.

- Record detail views must expose the same canonical ID, status, owner and source as other modules.

- Drawer/modal actions must have explicit consequences and confirmation where a user may mistake a demo state for an authorised real outcome.

- All save/submit actions must report success, validation failure or simulated connectivity failure correctly.

- Display brief, contextual help for terms such as Blocked, Unverified, Estimated service due and Potential shortage.

### 13.2 Reports

Use common chart components with accessible legend and data-table alternatives. Essential reports cover shift execution, issues, equipment downtime stages, production-versus-plan sample information and resource readiness. Advanced analytics appear inside the same Reports workspace for eligible demo tiers. Reports must show units, date range, source type, update time and calculation definition.

The prototype must **not** equate machine downtime to loss of tonnes or financial savings without a defined and appropriately qualified model. All monetary values, where used, are illustrative and prominently identified as estimates.

## 14. Mobile Application and Offline Strategy

### 14.1 Mobile Design Decision

For the current phase, **VESPER Mobile is a mobile-optimised browser experience sharing the React codebase**. It is not a separately branded native app and does not require app-store publication. It must be designed for field tasks, not merely shrink desktop screens.

### 14.2 Mobile Navigation and Tasks

Core (and higher) mobile access includes My Shift, My Work, Report, Notifications and Profile. The central field flow is Report -\> Act -\> Track. Essential field workflows and simulated offline/pending-sync states remain available on Core; expanded digital inspections are subject to approved higher-tier entitlement. Inputs should prefill known site, shift and equipment context, permit a concise fault description and optionally demonstrate photo/evidence attachment using fictional assets.

No default mobile clock-in feature is authorised. Biometric attendance remains the responsibility of the mine's existing system. Attendance, fitness for work, equipment permission and safety clearance must not be conflated.

### 14.3 Simulated Offline Experience

The prototype must offer explicit demo connectivity toggles. A locally entered report may be represented as **Pending Synchronisation**, but it must not appear as successfully received centrally until the simulation deliberately advances. This is a UI state demonstration only, not actual resilient offline storage or background sync.

**VES-TRD-MOB-001:** Interactive targets should aim for at least 44 x 44 CSS pixels on touch-heavy flows; all controls must satisfy WCAG 2.2 AA target-size criteria.

**VES-TRD-MOB-002:** The reporting workflow must be completable with minimal mandatory fields and without a long wizard.

**VES-TRD-MOB-003:** A simulated offline submission must never claim to have notified the supervisor or dispatched an emergency response.

**VES-TRD-MOB-004:** Screen designs must account for safe use restrictions, glare, small screens, intermittent connectivity and one-handed interaction without assuming phones are permitted in all mine areas.

### 14.4 Native Mobile Application - Conditional Production Direction

Following prototype validation, HIMARK may develop VESPER Mobile as a dedicated React Native/Expo application for iOS and Android. It remains VESPER Mobile - the same product and subscription, not a new product or second account system. A native build is justified only if field device access, connectivity, ergonomics and ownership constraints demonstrate clear value over a robust browser/PWA alternative.

Core and higher tiers retain their approved essential mobile entitlements. Advanced inspections and extended coordination remain controlled by feature/role entitlement rules. The eventual native client must not invent new chargeable capabilities outside the PRD.

### 14.5 Offline-First Field Reporting and Synchronisation - Future Requirements

In a future production mobile client, user-entered reports should first be committed transactionally to an encrypted local queue before the application indicates local save success. On authorised reconnection, the client submits queued mutations with idempotency keys, validates the authoritative response and updates the shared record state. Sync must be restart-safe, retryable and observable.

| **User-visible state**     | **Meaning**                                                                  | **Required consequence**                                                         |
|----------------------------|------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| Saved on this device       | Durable local draft or queued field report exists; no server acknowledgement | Keep visible after restart; warn about device-loss and no central delivery.      |
| Waiting to sync            | Pending mutation has not been confirmed by the server                        | Do not notify or update central dashboards as though received.                   |
| Synchronising              | Transmission/verification in progress                                        | Allow recovery from interruption; prevent duplicate user submissions.            |
| Received by VESPER         | Server issued an authoritative acknowledgement and record ID                 | Update associated issue, equipment and manager views from same canonical record. |
| Needs attention / conflict | Request failed validation, permission, attachment upload or conflicted edit  | Show clear retry or review action; never erase or silently overwrite work.       |

Prioritise foreground and reconnect synchronisation. Background execution on iOS/Android is operating-system controlled and may be deferred or stopped; the UI must never promise immediate delivery or completion from a scheduled background task.

### 14.6 Device and Mine-Site Operational Guardrails

- Confirm permitted devices, prohibited areas, intrinsically safe equipment requirements, corporate-owned versus BYOD controls, camera use and network availability at candidate mines before a native deployment decision.

- Design for sunlight glare, gloves and one-handed use where permitted; keep critical field reports concise, with clear local-save, pending and received states.

- Maintain approved mine safety and emergency channels separately. VESPER issue reporting does not authorise equipment release, substitute for a permit to work or guarantee emergency contact.

- Plan managed-device distribution and revocation where required. Do not treat mobile push or biometric device unlock as mine worker attendance or operational clearance.

## 15. Roles, Sites and Subscription Entitlements

### 15.1 Demo Personas

Demonstration personas must include Mine Manager, Production Manager, Shift Supervisor, Maintenance Planner, Inventory/Stores Controller, Procurement User, Field Employee and Organisation Administrator. They are fictional profiles, not authenticated employee accounts.

### 15.2 Access Evaluation

Visible features depend on the selected demo persona, site scope **and** subscription entitlement. The same mocked policy should be used for navigation and component gating. Hiding a button does not constitute real access control; production authorisation must be enforced by future backend APIs.

| **Subscription**         | **Site allowance** | **Dedicated mobile field experience** | **Reports** |
|--------------------------|--------------------|---------------------------------------|-------------|
| Core                     | 1                  | Included - essential field flows      | Essential   |
| Operations - Single Site | 1                  | Included                              | Operational |
| Operations               | Up to 3            | Included                              | Operational |
| Enterprise               | Up to 6            | Included                              | Advanced    |
| Group                    | 7+                 | Included                              | Group-level |

The Single Site package is a capacity option within Operations, not a new product tier. Subscription prices and any HIMARK Reserve inclusion are commercial settings, not constants that should be hard-coded into every component.

### 15.3 HIMARK Reserve Eligibility

For demonstrations, support a proposed **HIMARK Reserve benefit** representing one Operations - Single Site licence included in a qualifying Reserve engagement at no additional recurring licence charge. This remains subject to commercial approval. It must not override role permissions, actual site entitlements or the restriction on live operational deployment.

### 15.4 Acceptance Requirements

- A Core field persona can access the essential VESPER Mobile experience, including My Shift, My Work, Report, Notifications, Profile and simulated offline states, subject to role and site scope.

- Switching to Operations preserves essential mobile access and enables only the approved expanded workflows, subject to role, site and feature-level restrictions.

- Advanced reports are displayed only for entitled Enterprise/Group demo configurations.

- Changing the selected site changes all site-scoped records, metrics and map details.

- Unauthorised demo routes show a clear restricted-access state rather than inconsistent or empty unlabelled content.

## 16. Notifications, Search and Operational Feedback

### 16.1 Notification Contract

Use a dropdown anchored to the top navigation rather than an unrelated permanent notification sidebar. Notifications must link to existing demo records, carry a meaningful category, timestamp and read status, and respect persona/site context.

Supported categories include new issue assignment, dependency overdue, maintenance approaching due, part availability unconfirmed, purchase review needed and shift handover pending. Escalation intensity must correspond to documented significance rather than using red for routine updates.

### 16.2 Search

The prototype may provide site-scoped client-side search over seeded equipment, issues and relevant work records. Results must display entity type and context. It must not imply an enterprise-wide indexed search service exists.

### 16.3 System State Patterns

All key workflows require designed states for initial loading, empty results, no matching filters, saving, success, failure, stale information, permission restriction and simulated offline status. Error messages must explain what happened and suggest a meaningful next step. The interface must never silently discard entered information after a simulated failure.

## 17. Accessibility, Responsiveness and Performance

### 17.1 Accessibility Standard

Target **WCAG 2.2 Level AA** for applicable user interactions. Implement semantic HTML, keyboard operability, meaningful form labels, accessible dialogs, screen-reader status messages, visible focus indicators, non-colour-only states, accessible chart alternatives and reduced-motion support.

All crucial map operations require a non-map alternative. Test keyboard and touch interaction on every core workflow; a desktop hover-only interaction is never sufficient. Do not assume an animation library provides accessibility automatically.

### 17.2 Browser Support

Target current stable Chrome, Edge, Firefox and Safari releases, with representative modern Android Chrome and iOS Safari browser emulation. Validate actual customer device/browser constraints during later discovery. Legacy industrial browser requirements are not assumed in this prototype.

### 17.3 Performance Acceptance Targets

| **Metric**                   | **Target for prototype validation**                                   | **Measurement note**                                                        |
|------------------------------|-----------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Fluid motion                 | Aim for 60 fps in ordinary transitions                                | Review recordings on agreed baseline hardware; avoid long main-thread tasks |
| Primary interaction response | Visually acknowledge interaction promptly                             | Do not delay acknowledgements behind decorative animation                   |
| LCP                          | 2.5 seconds or better where measurable                                | Evaluate representative pages, device profiles and network conditions       |
| INP                          | 200 ms or better where measurable                                     | Evaluate interactive prototype behaviour                                    |
| CLS                          | 0.1 or less                                                           | Preserve layout stability while content loads                               |
| Modal / menu                 | No focus trap defects or clipping                                     | Keyboard and small-viewport tests required                                  |
| Large data views             | Maintain responsiveness with pagination or virtualisation when needed | Do not render thousands of complex rows unconditionally                     |

Core Web Vitals targets are aspirational evaluation benchmarks, not demonstrated field measurements. Record test environment, hardware, viewport, dataset and methodology before declaring a pass.

### 17.4 Optimisation Rules

- Code-split heavier screens including the map and advanced chart components.

- Lazy-load assets and avoid unnecessary autoplay video.

- Use the framework's supported image optimisation where practical.

- Prevent chart or map re-initialisation on unrelated sidebar state changes.

- Use stable query keys and selective rendering to avoid cascading refreshes.

- Keep the main desktop shell stable while feature content changes.

- Respect user reduced-motion settings across the entire application.

## 18. Security, Data Protection and Safety Boundaries

### 18.1 Prototype Security

- Use only **fictional or expressly authorised non-sensitive demo data**. No real employee credentials, individual health or attendance records, mining drawings, customer commercial information or operational secrets without separate permission.

- Enable deployment protection or restricted access for internal/executive previews; do not rely on hidden URLs.

- Prevent search indexing of preview deployments where supported.

- Keep all repository secrets outside client bundles and source control; no production API tokens are needed.

- Run dependency audits and licence review prior to release of a preview to external stakeholders.

- Show a persistent demo-state indicator; exports and screenshots should not misleadingly appear to be live mine reports.

- Use secure defaults for links, file upload demos and user-generated text, avoiding unsafe HTML insertion.

### 18.2 Mine Safety and Operational Boundaries

- Map green/red/amber classifications describe simulated operational conditions, **not permission to work**.

- A digital issue closure is not a lockout/tagout, safety clearance, permit to work or equipment release.

- No automatic dispatch of physical work, control signal or safety-critical instruction.

- Mock offline submission does not signal delivery of emergency alerts.

- Approved mine systems and authorised personnel remain responsible for all safety-critical actions in future production deployments.

The future production programme must evaluate applicable South African privacy (including POPIA), mine safety, cybersecurity and OT requirements with qualified professionals. The prototype is not evidence of regulatory or site-safety compliance.

### 18.3 Native Mobile and Backend Security Prerequisites - Future Phase

- Approve identity lifecycle, organisation/site/role authorisation at the API boundary, token expiry/revocation, device enrolment and session termination; hiding a mobile screen is never access control.

- Use encryption at rest for locally persisted operational records, protected key handling and TLS in transit. Confirm real database encryption with a compiled native build rather than assuming a configuration flag or development client provides it.

- Define device loss and offboarding controls, local retention, selective wipe, audit evidence, consent for photos, file access, and attachment scanning according to mine policy and applicable legal review.

- Partition tenants and sites server-side; log immutable actor/source/time fields without collecting unnecessary sensitive employee information. Define residence, retention and breach response in the production threat model.

- Require specialist review of mine OT network boundaries, POPIA/privacy obligations, mobile distribution policy and non-safety-critical positioning before any production pilot.

## 19. Testing Strategy and Definition of Done

### 19.1 Test Layers

**Unit tests:** Maintenance countdown arithmetic, overdue states, lead-time windows, stock certainty, data-quality status, map colour rules and entitlement predicates.

**Component tests:** Sidebar behaviour, cards, forms, badges, drawers, keyboard access, error states, loading states and reduced-motion behaviour.

**Integration tests:** MSW mutation triggers cross-module query updates; role/site changes filter all information; reset returns the exact fixture baseline.

**End-to-end tests:** Playwright covers the two critical customer journeys and supporting handover, offline and entitlement scenarios across agreed browsers.

**Visual regression:** Capture approved reference screenshots for shell, representative dashboard, map, resource warning, field mobile, error/empty states and collapsed sidebar. Investigate changes rather than blindly approving screenshots.

### 19.2 Mandatory End-to-End Test Cases

| **Test ID** | **Scenario**                          | **Pass criteria**                                                          |
|-------------|---------------------------------------|----------------------------------------------------------------------------|
| E2E-01      | Report a simulated excavator fault    | Record appears in Issues and Equipment with same ID and status             |
| E2E-02      | Validate area impact                  | Map changes only when configured blocking rule and evidence justify it     |
| E2E-03      | Reveal parts dependency               | Issue details and Resource Readiness show matching outstanding requirement |
| E2E-04      | Confirm existing stock/order          | Duplicate purchase review is suppressed or appropriately qualified         |
| E2E-05      | Missing stock information             | Unknown/needs-confirmation state, never false zero stock                   |
| E2E-06      | Maintenance countdown                 | Due window is correct for validated sample inputs; overdue case handled    |
| E2E-07      | Escalation / handover                 | Unresolved issue persists across simulated shift transition                |
| E2E-08      | Issue resolution                      | Repair completion alone does not automatically mean operations resumed     |
| E2E-09      | Site and tier switching               | Routes, widgets and records reflect new demo context consistently          |
| E2E-10      | Simulated offline report              | Pending status appears; no false server-received confirmation              |
| E2E-11      | Sidebar / modal / map keyboard access | Focus is visible and navigation works without a mouse                      |
| E2E-12      | Reduced motion                        | Significant animation is reduced while state changes remain clear          |
| E2E-13      | Mock worker failure                   | Clear demo-unavailable state; no unintentional production network request  |
| E2E-14      | Reset scenario                        | Seeded records and derived reports return to reproducible baseline         |

### 19.3 Definition of Done

A feature is complete only when it has an approved PRD requirement, accessible responsive UI, shared design-system components, typed mock contract, standard empty/loading/error states, applicable test coverage and documented limitations.

The UI prototype is ready for leadership approval only when **all P0 workflows** and mandatory cross-module scenarios pass; blocker/critical defects are closed; versioned preview is accessible to designated reviewers; and no screen falsely claims live mining integration or real operational authority.

### 19.4 Separate Native Mobile Verification Matrix - Future Release Gate

| **Test** | **Situation**                                                       | **Minimum acceptance evidence**                                                            |
|----------|---------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| NM-01    | New report saved while fully offline, then app terminated/restarted | The local record persists and is never represented as centrally received.                  |
| NM-02    | Intermittent reconnection and repeated upload attempts              | Idempotent server receipt; one canonical issue and consistent Web/Mobile views.            |
| NM-03    | Expired/revoked account, changed site permission, lost device       | Server rejects unauthorised writes; device data and access obey approved controls.         |
| NM-04    | Two clients update the same issue while one is offline              | Conflict is safely resolved or explicitly escalated; verified status is not silently lost. |
| NM-05    | Local evidence files with network interruption / low storage        | Recovery or clear failure; no orphaned/silent-loss attachments.                            |
| NM-06    | Real Android/iOS devices, indoor/outdoor and offline conditions     | Meets agreed field usability, accessibility, battery and performance criteria.             |
| NM-07    | Mine-approved deployment and restricted-zone verification           | Installation/device policy signed off; no unsafe device or notification assumptions.       |

These tests are future native-application acceptance gates. They are not included in the Build 01 completion criteria, which continue to rely on mocked connectivity and Playwright-based responsive browser testing.

## 20. Delivery Sequence, Handover and Sign-Off

### 20.1 Implementation Order

| **Stage**                       | **Deliverable**                                                               | **Exit gate**                                |
|---------------------------------|-------------------------------------------------------------------------------|----------------------------------------------|
| 0 - Repository audit            | Existing-stack review, selected versions, migration decision                  | Architecture decision recorded               |
| 1 - Foundation                  | Framework, TypeScript rules, linting, tests, design tokens, Storybook         | Build and component smoke tests pass         |
| 2 - Shell and motion            | Header, collapsible sidebar, routing, common cards, mobile nav                | Reference designs and interactions reviewed  |
| 3 - Demo domain                 | Typed entities, fixtures, MSW, scenarios, query/cache rules                   | Deterministic cross-view mutation tests pass |
| 4 - Core workflow               | Exceptions, equipment, map and dependencies                                   | Operational-breakdown scenario passes        |
| 5 - Preventive workflow         | Maintenance due, Resource Readiness, Parts Early Warning                      | Maintenance-delay-prevention scenario passes |
| 6 - Continuity and intelligence | Shift handover, Reports, notifications and mock entitlements                  | Handover and tier tests pass                 |
| 7 - Final polish                | Responsive refinement, motion QA, accessibility, regression and documentation | All acceptance gates pass                    |

### 20.2 GitHub, Reviews and Preview Deployment

Use a protected main branch and feature branches; require pull-request review, TypeScript checking, linting, unit tests and Playwright smoke tests in CI. Configure Vercel preview deployments for review, with appropriate access protection and demo-only environment configuration. Production-domain release is prohibited during this phase unless separately approved for a clearly labelled demo environment.

Use a single coding style, component naming standard, test convention and structured issue/PR template. Codex must make focused pull requests with screenshots, relevant tests and documented trade-offs rather than large unreviewable UI rewrites.

### 20.3 Change Control

Any request to add backend storage, change the framework, alter the approved design language, introduce new top-level modules or move a P1/P2 feature into P0 requires a documented change decision. A visual prototype must not silently become a production system through iterative prompting.

### 20.4 PRD Traceability

| **PRD requirement group**                  | **Primary technical sections** |
|--------------------------------------------|--------------------------------|
| FR-001 to FR-008 - Command Centre          | 4, 5, 6, 9, 13                 |
| FR-009 to FR-017 - Operational Map         | 8, 9, 10, 13                   |
| FR-018 to FR-027 - Work & Exceptions       | 8, 9, 11, 13                   |
| FR-028 to FR-036 - Equipment & Maintenance | 8, 11, 13                      |
| FR-037 to FR-046 - Resource Readiness      | 8, 11, 12, 13                  |
| FR-047 to FR-053 - Shift Control           | 8, 9, 13                       |
| FR-054 to FR-062 - Mobile                  | 7, 14, 17                      |
| FR-063 to FR-072 - Reports                 | 9, 13, 15, 17                  |
| Business rules BR-001 to BR-019            | 8, 10, 11, 12, 15, 18          |
| Prototype rules PR-001 to PR-006           | 2, 9, 14, 18, 19               |

### 20.5 Formal Handover Artifacts

- Approved TRD v1.2 and recorded Architecture Decision Register.

- Repository audit and pinned dependency manifest.

- Component library and token/motion documentation.

- Typed mock-domain schemas and demo scenario fixtures.

- Responsive screen implementation and approved visual references.

- Test suite, reports, known limitations and accessibility findings.

- Preview deployment instructions and demo reset procedures.

- Gap register for future real APIs, identity, OT/data security and production operations.

### 20.6 Approvals

| **Role**                           | **Approval responsibility**                                 | **Status**                               |
|------------------------------------|-------------------------------------------------------------|------------------------------------------|
| HIMARK CEO / Product Sponsor       | Product boundaries, priorities and funding                  | Pending                                  |
| HIMARK COO / Delivery Lead         | Operational workflow coherence and execution plan           | Pending                                  |
| HIMARK Design / CMO representative | Brand, accessibility and visual consistency                 | Pending                                  |
| Technical Lead                     | Stack, maintainability, risk and test feasibility           | Pending                                  |
| Mining Domain Reviewer             | Operational realism, data assumptions and safety boundaries | Required before claims of mine readiness |

**Final delivery principle:** The complexity belongs to the system. The clarity belongs to the user.

**TRD approval authorises only the interactive frontend prototype and associated technical design. It does not approve real mine deployment, live system integration or production backend development.**

### 20.7 Separate Authorisation Gates for Native Mobile and Shared Services

Gate A - Current prototype: product owner and technical/UX reviewers approve the browser-based interface, simulated scenarios and Core-or-higher Mobile entitlements. No production data processing or native app is authorised.

Gate B - Native proof-of-feasibility decision: review repository audit, mining-site device policy, actual offline requirements, source-system feasibility, security threat model and build/maintenance cost. Record an ADR selecting React Native/Expo, an alternative native technology or a web/PWA route.

Gate C - Production architecture authorisation: separately approve backend/API framework, identity provider, tenancy and site scoping, schema, data residency, privacy/OT controls, synchronisation design, real-device acceptance plan and funding.

Gate D - Controlled pilot and release: obtain mine approval for device types and areas of use; verify real offline storage, acknowledgements, access revocation, support and incident response before any operational deployment.

Until Gates B-D are explicitly approved, all native stacks, infrastructure and integration references in Sections 3, 4, 8, 14, 18 and 19 are design proposals only. They must not be translated into unapproved source-code or cloud-resource changes.

**Reference documentation (authoritative technical guidance):**

- Next.js App Router and Client Components: https://nextjs.org/docs/app

- Tailwind CSS theme tokens: https://tailwindcss.com/docs/theme

- shadcn/ui Tailwind v4 compatibility: https://ui.shadcn.com/docs/tailwind-v4

- Motion for React and layout animation: https://motion.dev/docs/react

- Leaflet non-geographical maps: https://leafletjs.com/examples/crs-simple/crs-simple.html

- MSW browser integration: https://mswjs.io/guides/integrations/browser

- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview

- Playwright: https://playwright.dev/docs/intro

- WCAG 2.2: https://www.w3.org/TR/WCAG22/

- Web performance metrics: https://web.dev/articles/vitals

### Native Application Technology References (for Architecture Review)

- Expo Router navigation: https://docs.expo.dev/router/introduction/

- Expo SQLite and optional SQLCipher configuration: https://docs.expo.dev/versions/latest/sdk/sqlite/

- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/

- Expo background tasks and platform limits: https://docs.expo.dev/versions/latest/sdk/background-task/

- Expo mobile local storage guidance: https://docs.expo.dev/develop/user-interface/store-data/

**End of TRD v1.2**
