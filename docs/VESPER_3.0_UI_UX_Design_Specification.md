# VESPER 3.0 - UI/UX Design Reference Specification

**Product:** VESPER - The Mining Operating System  
**Organisation:** HIMARK SGC  
**Document:** Desktop Command Centre visual specification and design-system handoff  
**Version:** 1.1  
**Revised:** 3 November 2026  
**Prepared:** 3 November 2026  
**Status:** Design-reference draft - review and approval pending  
**Reference image:** `VESPER v3.0 Operational Recovery Dashboard.png` (1536 x 1024 pixels). The only design mockup currently available; a visual reference, not a functional specification.  
**Intended recipients:** Implementation agents, VESPER designers and frontend developers  
**Current implementation authority:** Interactive UI/UX prototype using fictional, explicitly simulated data ONLY.

> **IMPLEMENTATION AGENTS - READ THIS FIRST**  
> This is a specification of the provided VESPER desktop design, **not a request to invent features or start development**. Preserve the visual language and screen hierarchy. Cross-check the PRD, TRD, Application Flow Document (AFD), and Backend Schema before implementation. Treat screenshot text, sample values, and navigation names as visual evidence, **not independent product requirements**. Do not create, modify or delete project files until explicitly authorised. Never implement a production backend, authentication, mine integration, live map/GPS, automated procurement or operational safety actions during the prototype phase.

## Version history

| Version | Date | Change | Approval status |
| --- | --- | --- | --- |
| 1.0 | 3 November 2026 | Initial draft | Pending |
| 1.1 | 3 November 2026 | Documentation reconciliation (decisions C-01 to C-08): terminology standardised and cross-document contradictions resolved. No change to functional requirements, business rules, acceptance criteria or P0/P1/P2 classifications. | Pending |

## 1. Purpose, sources and decision hierarchy

### 1.1 Purpose

Translate the supplied **single-screen VESPER 3.0 desktop Overview / Command Centre screenshot** into a repeatable, implementation-ready Markdown design reference. It describes geometry, styling, typography, cards, icons, content hierarchy, status treatments, responsive adaptation, and expected interactions. It should help implementation agents and developers produce screens consistent with the screenshot without reinterpreting HIMARK's visual identity.

### 1.2 Source material and authority

| Source | What it establishes | Authority / caution |
|---|---|---|
| `VESPER v3.0 Operational Recovery Dashboard.png` (1536 x 1024) | Composition, graphic character, relative sizes, component treatment and visible text | **Visual reference only**; the only design mockup currently available; one static desktop screen, no proof of working features; never overrides the documents below |
| `VESPER_3.0_Product_Requirements.md` (PRD v1.1, 3 Nov 2026) | Product scope, business rules, approved priority classes, eight workspaces, success criteria | Source for product requirements; original document marked **Draft for Leadership Review** |
| `VESPER_3.0_Technical_Requirements.md` (TRD v1.1, 3 Nov 2026) | Frontend stack, design tokens, accessibility, motion, mock architecture | Source for technical direction; original marked **Final Draft - Approval Pending** |
| `VESPER_3.0_Application_Flow.md` (AFD v1.1, 3 Nov 2026) | Routes, user journeys, state transitions, data-quality feedback and role/site guards | Source for navigation and interactions; original marked **Approval Pending** |
| `HIMARK_VESPER_3.0_Backend_Schema.md` (VES-BSD-001 v1.1, 3 Nov 2026) | Entity meaning, identifiers, relationships, timestamps and the two independent status dimensions (BSD Section 3.3) | Source for domain meaning and data integrity; marked **Final design draft - approval pending**. Do not infer data semantics missing from the schema |

**Precedence when inconsistent:** PRD (scope/business priorities), TRD (technical/design standards), Backend Schema (domain meaning), AFD (flows), then this screenshot-derived design reference (appearance). Raise any material conflict for approval rather than silently resolving it through new functionality.

**Design coverage:** Only one desktop design mockup currently exists (the Overview / Command Centre screen). Tablet and mobile designs remain to be developed and approved; until then, those layouts follow the PRD, TRD and AFD rather than being inferred from the desktop screenshot.

### 1.3 Current phase and non-goals

**In scope:** The responsive design system, P0 web/tablet/mobile prototype views, interactive navigation, seeded role/site/scenario switches, interactive 2D map, simulated issue/action/resource/shift flows, reports, and clearly labelled demonstration states.

**Not authorised:** Real operational data, persistent production services, live equipment feeds, live GPS, biometric login, real purchase orders, production-grade offline sync, safety authorisations, actual equipment commands, predictive engines, production financial recovery claims, or deployed mine workflows. The screenshot's words **Live**, **Execute**, **Recovery**, and monetary estimates must be handled under the safeguards in Section 12.

## 2. Screenshot anatomy and desktop layout

### 2.1 Reference viewport

![VESPER 3.0 desktop Overview reference](VESPER%20v3.0%20Operational%20Recovery%20Dashboard.png)

- **Screenshot canvas:** 1536 px wide x 1024 px high; landscape desktop.
- **Global header:** full viewport width, approximately 60 px tall.
- **Contextual left sidebar:** approximately x=13-230, y=76-985; about 216 px wide.
- **Main content canvas:** approximately x=250-1523, y=75-985; about 1273 px usable width.
- **Gutter between sidebar and main:** about 20 px.
- **Typical card gaps:** about 11-14 px; outer content padding about 12-16 px.
- **Reference arrangement:** fixed-height dark topbar, separate rounded white sidebar, then compact high-density overview dashboard on a soft near-white canvas.
- Measurements are **image-derived estimates**, not rigid CSS constraints. Use proportional grids and responsive behaviour rather than absolute positioning.

### 2.2 Spatial map

| Region | Approximate bounds at 1536 x 1024 (x, y, w, h) | Visual role |
|---|---|---|
| Global obsidian header | `(0, 0, 1536, 60)` | Brand, site, contextual navigation, global actions, user |
| Left contextual sidebar | `(13, 76, 217, 909)` | Mine identity, workspace groups and nested navigation |
| Greeting and filters | `(250, 74, 1273, 64)` | Current persona greeting, site/date/shift/demo freshness |
| Hero: operational constraint | `(250, 149, 842, 202)` | Dominant priority story with imagery and next action |
| Recovery status | `(1104, 149, 419, 202)` | At-a-glance progress / verification sequence |
| Five KPI cards | `(250, 364, 1273, 80)` | Short operational summary strip |
| Operational map panel | `(250, 457, 788, 289)` | Spatial status and mapped issue drill-downs |
| Action plan panel | `(1049, 457, 474, 289)` | Accountable tasks for primary constraint |
| Production vs plan | `(250, 758, 334, 226)` | Trend comparison and detail route |
| Recovery opportunity | `(594, 758, 318, 226)` | Conditional, qualified impact information |
| Cross-team dependencies | `(922, 758, 331, 226)` | Ownership and prerequisite status |
| Shift handover | `(1264, 758, 259, 226)` | Outstanding carry-over items |

### 2.3 Layout composition

At 1440 px and wider, replicate three vertically stacked dashboard bands:

1. **Priority band:** operational-constraint hero (roughly 2/3 width) and recovery-status card (roughly 1/3).
2. **KPI band:** a single row of five cards of comparable widths.
3. **Operational band:** operational map (roughly 62% of the band) paired with action plan (38%).
4. **Insight band:** four cards, with practical column proportions near `1.08 : 1.03 : 1.07 : 0.84` for production chart, recovery opportunity, dependencies and handover.

Keep the hero as the visual anchor, not the KPI strip. The map is the next strongest visual object. Card headings should remain instantly scannable and share a consistent baseline. Large display imagery is restricted to the hero, small site thumbnail and map: don't introduce stock photos to every panel.

### 2.4 Visual density and hierarchy

- Greeting anchors the screen's human context.
- The **primary current constraint**, its evidence and next action receive the largest and highest-contrast surface.
- KPIs summarize current operating state but do not outshine the priority constraint.
- Map and action panel sit together to connect **where** the problem is with **who** will act.
- Lower cards provide trends, dependencies and shift continuity.
- The screen feels information-rich but not chaotic. Use progressive disclosure rather than packing every possible metric into Overview.

## 3. Design language and tokens

### 3.1 Aesthetic contract

**Premium, predominantly light enterprise interface with restrained minimalist neumorphism.** Obsidian black is used only for the global top navigation and the hero overlay. White cards appear softly lifted from a pale mineral-white canvas. Emerald is used for brand emphasis, links, actionable selections and **genuine** positive operational states. Red/amber are reserved for confirmed blocking/risk states.

Avoid exaggerated embossed controls, thick bevels, oversized glows, glass-heavy layers, constantly animated gradients, huge rounding or saturated decorative colour. This is operational software, not a marketing landing page.

### 3.2 TRD reference tokens (preferred implementation baseline)

```css
:root {
  --brand-obsidian: #111817;
  --brand-emerald: #16865B;
  --surface-base: #FFFFFF;
  --surface-canvas: #F5F7F5;
  --surface-soft: #EAF1EC;
  --text-primary: #17251C;
  --text-secondary: #5A6A60;
  --border-subtle: #DEE7E0;

  /* Screenshot-inspired component defaults; visually tune and test contrast. */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-card: 0 4px 18px rgba(17, 24, 23, 0.055);
  --shadow-raised: 0 8px 26px rgba(17, 24, 23, 0.09);
  --focus-outline: 2px solid #16865B;
}
```

The TRD does **not** finalise hex values for warning, blocked or unknown. Use accessible controlled amber, red and grey semantic tokens chosen through design review; do not assume values sampled from an image are approved. At minimum, status requires a text label and icon in addition to colour. The palette above is a documented starting point, not permission to compromise WCAG contrast.

### 3.3 Typography

- Primary family: **Inter**, or an approved metrically similar professional sans-serif with system fallbacks.
- Logo: uppercase **V E S P E R**, widely tracked, white against obsidian; small emerald `v3.0` lozenge.
- Approximate scale: 12 / 14 / 16 / 20 / 24 / 32 px; body typically 13-15 px.
- Greeting: bold approximately 30-32 px, tight line height.
- Hero constraint title: approximately 25-28 px, semibold/bold, bright white.
- Card titles: approximately 16-18 px semibold, high contrast.
- KPI values: approximately 19-22 px bold; secondary labels 12-13 px.
- Metadata: approximately 11-12 px with sufficient contrast, never the sole carrier of essential state.
- Chart labels: 11-12 px, readable and high contrast at the reference viewport.
- Use **tabular numerals** for operational values, durations, tonnage and times.
- Prefer short, explicit sentences. When a value is estimated, include its uncertainty/source rather than making the number more visually dramatic.

### 3.4 Spacing, corners and surfaces

- Use a 4 px spacing system; common steps: **8, 12, 16, 24, 32 px**.
- Cards: 12-16 px corner radius, hairline border, quiet shadow, white/light-neutral fill.
- Pill badges and small status capsules: rounded-full or 16-24 px radii with sufficient padding.
- Sidebar selection: muted emerald-tinted row, left accent bar and green icon/text.
- Icon backplates: circular pale emerald/neutral surfaces, mainly 36-44 px diameter.
- Dividers: fine neutral separators; avoid heavy gridlines.
- The screenshot has smooth raised cards: achieve with **one soft outer shadow** and restrained border, not intense embossed inset/shadow pairs.

### 3.5 Iconography

Use **Lucide React** or the icon system already governed by the TRD: outline icons with consistent stroke weight (roughly 1.8-2 px), simple geometry, and semantic labels. Similar shapes visible: home, mine/site, calendar, bell, search, person, target, layers, clock, wrench, alert triangle, shield check, package, users, production bars, gear and location pin. Do not mix filled emoji-style icons, multiple unrelated icon libraries or arbitrary icon sizes.

## 4. Global shell

### 4.1 Top navigation (screenshot appearance)

At approximately 60 px tall, use a near-black/obsidian fixed header with:

- **Left:** wide-tracked `VESPER` wordmark followed by `v3.0` emerald badge.
- **After divider:** dark rounded mine selector (`Riverside Mine` in the screenshot) with a site/mountain icon and chevron.
- **Center:** small horizontally arranged module/navigation labels; selected item has a thin emerald underline.
- **Right:** search icon, notification bell with small red unread dot, round white avatar initials `JD`, two-line identity `John Dlamini / Mine Manager`, and dropdown chevron.
- Maintain a high-contrast and keyboard-reachable control order. Search/alerts open overlays; don't navigate to an unrelated sidebar.

**Important navigation discrepancy:** The screenshot header says `Overview`, `Production`, `Operations`, `Maintenance`, `Equipment`, `People`, `Contractors`, `Reports`. Those labels are **visible in the reference image but are not the authoritative P0 product taxonomy**. The PRD specifies **eight workspaces**: Overview, Operational Map, Work & Exceptions, Equipment & Maintenance, Resource Readiness, Shift Control & Handover, Reports and Administration. Reuse the screenshot's treatment (height, spacing, underline) while mapping actual navigation to the eight workspaces and their documented routes. Do not create extra standalone Production, People or Contractors modules merely to match visible words.

### 4.2 Sidebar

An independent white rounded panel floating above the soft canvas, extending below the header. It contains:

1. **Site identity card:** approx. 48 px square mine thumbnail, `Riverside Mine`, subline `Open Pit - Gold`, chevron (as shown in the screenshot). **Display-only in the prototype:** site selection happens only through the top-bar site selector (AFD Section 5.1), so this card has no selector control of its own.
2. **Primary sidebar group:** overview and operational navigation with icons. Active Overview has pale green background and a slim left-edge emerald indicator.
3. **Workflow group:** small uppercase `WORKFLOW` label with grouped actionable links, e.g. Actions (with count badge), Work Orders, Requests, Shift Handover.
4. **Intelligence group:** `INTELLIGENCE` heading and links such as Insights, Performance, Recovery Analysis.
5. **Settings group:** `SETTINGS` heading and utility links such as Site Configuration, Integrations, Users & Roles, Preferences.

These group names and items document **the screenshot**, not additional authorisations. Implement the **AFD's canonical eight workspaces** and place subordinate controls under their permitted parent workspace; keep the visual grouping, separators, icon alignment, small section captions and selection style. No hidden ninth module or redundant navigation architecture.

**Sidebar behaviour:** collapsible on desktop; icons and tooltips remain clear when collapsed. Preserve selection state and selected site. At tablet widths use a dismissible drawer. Do not make a permanently visible sidebar on narrow field mobile views.

### 4.3 Shared top-of-page context controls

The screenshot places the following at the top of the main content:

- Heading: **Good morning, John**.
- Subheading: `Here's what's happening at Riverside Mine today.`
- Rounded date picker: `Thu, 24 Apr 2025` (a **fictional demo reference date**, not today's date).
- Shift selector: `Shift A (06:00 - 14:00)`.
- Status/freshness capsule: screenshot `Live / Updated 2 min ago`.

**Required prototype adaptation:** The greeting derives from the *demo clock*, not the computer's current time presented as mine truth. Replace `Live` with a persistent **DEMO / SIMULATED DATA** indicator; `Updated 2 min ago` is allowed only if calculated from the controlled fixture clock and visibly marked simulated. Site/date/shift/persona changes must refresh all relevant data together. An invalid site or tier cannot leak previous-site details.

## 5. Overview / Command Centre components

### 5.1 Priority hero - Operational Constraint

**Location:** large left card at top; about twice the width of Recovery Status.  
**Reference content:**

- Eyebrow: target/bullseye icon, `Operational Constraint`, compact outline capsule `Primary`.
- Main heading: `Crusher C-02 - Feed Interruption`.
- Supporting text: `Production is behind plan. Downstream capacity is limiting throughput across the North Pit.`
- Bottom quick facts, separated with subtle vertical dividers: `Delay since report: 42 min`; `Estimated impact: -3,600 t`; `Priority: High` (red status chip).
- Right-aligned light pill CTA: `View Details` with arrow.

**Visual treatment:** Full-bleed fictional mining/excavator panorama, anchored right; strong dark charcoal-to-transparent gradient over left 55-65% for readable text; emerald edge/glow is extremely subtle; rounded outer corners; white text; one light high-contrast primary CTA. No unreadable image-over-text collision.

**Behaviour:** CTA opens the **same canonical issue** via `/exceptions/[id]` subject to demo access guards. Link its equipment and area references to `/equipment/[id]` and `/map` through the issue detail. The hero should show source and information-quality context in accessible detail, even if hidden behind a small labeled tooltip or expanded record. The priority is justified by the seeded operational evidence, not an arbitrary ranking.

**Data and claim safeguards:** `-3,600 t` is an **illustrative screenshot value**, not verified loss or recoverable tonnage. Only display an estimated impact when a documented demo calculation exists; label the number `Illustrative estimate`, include calculation assumptions in the detail view, or show `Impact requires review`. Priority red denotes severity/priority and **must not automatically imply confirmed area-wide Blocked status**.

### 5.2 Recovery Status card

**Location:** upper-right white card.  
**Reference:** title `Recovery Status`, info icon, overflow menu; thick green partial doughnut/ring showing `72% / On Track`; vertical list of five steps:

1. Issue reported - complete.
2. Owner assigned - complete.
3. Response in progress - active.
4. Resolution & verification - pending.
5. Production recovery - pending.

**Visual treatment:** White raised card, circular ring with emerald progress fill and light grey track; each step icon has a filled green circle, outlined active green circle or small neutral pending circle. Right-hand labels use compact text.

**Critical correction:** The screenshot's `72%` is **not derivable** from the five visible steps (two complete, one active, two pending), and `On Track` is not evidenced without a rule. The prototype must **not hardcode 72% as an operational metric**. Display completed and in-progress steps separately, for example `2 complete · 1 in progress · 2 pending`, with no percentage and no `On Track` label. If the ring is retained, it visualises completed steps only. Completing a repair must **not** auto-verify or close the issue; safety release and actual production resumption remain distinct events.

### 5.3 Five-card KPI strip

The screenshot shows five evenly spaced raised white cards, each with a pale-green icon disc, muted small label and bold value:

| KPI as pictured | Screenshot value | Required rendering rule |
|---|---:|---|
| Production (Actual) | `156,200 t` | Show source, period, unit, information quality and demo label |
| Production (Plan) | `162,000 t` | Use an explicitly seeded plan/target for the same period |
| Variance | `-5,800 t`, `-3.6%` | Compute `actual - plan`; percentage denominator must be defined; label negative status |
| Equipment Availability | `92%` | Only show with a defined formula and represented equipment population |
| Avg. Response Time | `28 min` | Show if underlying timestamp rules and relevant sample count exist |

Subtext/trend pills in the image include positive `+5.1% vs. previous shift`, `+1.4%` and `-12 min (-30%)`; these are **illustrative**, not actual KPI improvements. If reliable mock inputs are missing, use `Not available` / `Requires confirmation` rather than inventing a plausible trend. Green or red trend arrows should be determined by **metric meaning**, not simply numeric sign (lower response time can be good; lower production usually isn't).

### 5.4 Operational map panel

**Location:** middle left. Screenshot title is `Live Operational Map` and subtitle `Current operational status across the mine.` Filters appear as small segmented chips: `All Areas`, `Equipment`, `Issues`, `Work Orders`; top-right expand icon. In the prototype the panel title is `Operational Map`; the screenshot's `Live` wording is not used.

**Visuals:** Aerial-style open-pit mine image fills the body. Semi-transparent spatial polygons conform visually to the mine terrain. Dark label capsules float over the terrain and include location icon, area label and a separate status line. The image depicts:

- **North Pit** - green; descriptive label `Active`.
- **ROM Pad** - green; label `On Track`.
- **South Pit** - green; label `On Track`.
- **Central Pit** - amber; label `Reduced Output`.
- **Crusher C-02** - red issue marker; label `Feed Interruption`.

Vertical floating map controls at the right include layer switcher, centre/locate-type button, plus/minus zoom, and expand view. White, softly shadowed square/pill control backplates are used for legibility on aerial imagery.

**P0 implementation:** Render a **fictional non-sensitive local site-plan image** with Leaflet `CRS.Simple` and correctly aligned accessible polygons. Red means `Blocked` **only where verified evidence satisfies the configured area-level blocking rule**. Yellow means `At Risk`, green means `On Plan` where adequately evidenced, and grey means `Unknown` for insufficient/stale/conflicting evidence. Descriptive labels like `Active` or `Reduced Output` are **not substitutes** for those canonical states. Include status text, accessible labels, source, last update and rule rationale. A reported fault may highlight an issue marker without turning the entire pit red. No live GPS or real surveyed positioning.

**Area status derivation:** North Pit and every other operational area derive their status from the documented rules (TRD Section 10.2, AFD Section 7.3, BSD Section 6.2) and the simulated evidence in the fixture. No area status is copied from the screenshot. The screenshot shows North Pit green `Active` while the hero states that throughput across the North Pit is limited; the prototype must not reproduce that combination.

**Interaction:** Area tap/click/keyboard selection opens an accessible contextual drawer, not an unexplained tooltip; show area ID, state/reason, evidence quality, linked issues and actions. The map filter chips update visible layers or lists within the documented P0 scope; they do not invent work-order management. A list-based alternative must serve keyboard users and small-screen interactions. Selected area, status and linked issue ID match the same shared demo store displayed by the hero, KPIs, handover and reports.

### 5.5 Action Plan - Crusher C-02

**Location:** middle right, beside map. Screenshot has heading `Action Plan - Crusher C-02`, subtitle `What needs to happen now to recover production.`, and link `View Full Plan`.

**Reference row design:** Vertical progress spine, circular step indicators, 40 px soft icon discs, title + smaller team/person line, right-aligned status chips, fine separators. Four illustrated rows:

| Row | Step and visible owner | Screenshot status | Canonical treatment |
|---|---|---|---|
| 1 | Confirm fault assessment - Maintenance / Lebo Maseko | `Overdue (5 min)` while left icon appears completed | Do **not** show simultaneous contradictory complete/overdue state unless completion was recorded late and explained |
| 2 | Verify spare part availability - Stores / Procurement / Naledi Khoza | In Progress | A parts-readiness review; link to `/resources/[activityId]` where applicable |
| 3 | Mobilise repair team - Contractor / OreTech Services | Pending | Demonstrate assigned dependency/action; do not assume a separate Contractor module |
| 4 | Restore and verify operation - Maintenance / Lebo Maseko | Pending | Separate reported repair, authorised release record and independent verification |

**Behaviour:** `View Full Plan` opens the canonical linked issue/action detail rather than a new invented planning product. Rows show source, accountable owner, next step and proper demo state. Marking a contributing task complete must not auto-close the parent issue or claim that mining operations have safely resumed.

### 5.6 Production vs Plan

Bottom-left white card with heading and `View Details` link. Chart is a **clustered green bar chart**, two bars per day, pale-mint `Plan` and deeper emerald `Actual`. Example x-axis labels `18 Apr` through `24 Apr`; y-axis `0` through `200K`; slim light gridlines; bottom legend `Plan / Actual`.

**Requirements:** Readable tooltips with units, dates and definitions; accessible data-table alternative; stable comparison periods; no decorative animation on each filter change. The image's plotted values are visual examples; use source-backed seeded data, not traced guesses. `View Details` routes to a documented report with matching site/date context.

### 5.7 Recovery Opportunity

Bottom-centre left card with a small emerald target icon, title `Recovery Opportunity`, info icon, large example `3,600 t`, descriptive text `Potential recovery if resolved within 2 hours`, adjacent mini-metrics `Estimated value R2.7M` and `Time remaining 1 h 18 min`, and solid emerald CTA `Execute Recovery Plan`.

**Visual fidelity:** Keep the hierarchy: large conditional number, muted explanation, two compact supporting facts and a full-width dark-to-green gradient/polished CTA near the bottom.

**Non-negotiable semantic adjustment:** The screenshot's tonnage, rand value, recovery window and countdown have **no evidenced model in the image**. Do not present them as validated benefits, guaranteed recovery, or a live operational commitment. **The prototype does not display unvalidated financial recovery estimates:** omit `R2.7M`, the recovery tonnage, the recovery window and the countdown, and render `Opportunity not quantified` with a short note that no validated recovery model exists. Replace **Execute Recovery Plan** with **Review Recovery Actions**. It opens the canonical issue's mock action plan only but must not actuate production or create an external approval. Do not add a new forecasting/optimisation engine.

### 5.8 Cross-Team Dependencies

Bottom-centre right card with heading and `View All` text link. Three stacked items use pale circular icons, a bold dependency label, smaller owning team + context line, and compact status pills:

1. `Spare part - Crusher (C-02)` / Procurement - Awaiting confirmation / In Progress (amber).
2. `Repair crew - On site ETA` / Contractor - 35 min / `ETA 09:05` (green).
3. `Safety authorisation` / HSE - Required before restart / Pending (neutral).

**Behaviour:** Show linked, simulated dependencies from the canonical issue. ETA is shown only when fixture timestamps support it; otherwise `ETA unconfirmed`. An HSE-related row is an **informational prerequisite**, not VESPER granting safety clearance or replacing mine-authorised safety processes. `View All` opens the relevant issue's dependencies, not a new module. In the prototype the HSE row uses the fixed label `Safety authorisation - managed outside VESPER (demo reference only)` and carries no status chip that could read as an approval. The repair-crew ETA and the Action Plan's `Mobilise repair team` step must come from the same fixture record; the screenshot's green `ETA 09:05` beside a Pending mobilisation step is not reproduced.

### 5.9 Shift Handover

Bottom-right compact card. Heading `Shift Handover`, `View` link, highlighted row with large green `3` + `Open items to carry over`, arrow, followed by three list items with small status icons:

- Crusher C-02 - Feed interruption (red alert icon).
- Central Pit - Reduced output (amber triangle).
- EX-017 - Service due (dozer) (grey information icon).

**Behaviour:** Counts derive from unresolved items scoped to the current site/shift, not static card decorations. `View` navigates to `/shifts` or a valid `/shifts/[id]/handover` route. Acknowledging a handover records receipt in the fictional history; it **never automatically closes** an unresolved issue.

## 6. Shared component contracts

### 6.1 Minimum reusable components

Build/reuse the TRD component catalogue, including:

`AppShell`, `TopBar`, `CollapsibleSidebar`, `SiteSelector`, `ShiftSelector`, `PageHeader`, `DemoBanner`, `MetricCard`, `PriorityCard`, `DataQualityBadge`, `OperationalStatusBadge`, `EntityTable`, `FilterBar`, `DetailDrawer`, `Modal`, `AlertDialog`, `FormField`, `NotificationItem`, `EmptyState`, `Skeleton`, `ErrorState`, `Timeline`, `DependencyList`, `ResourceReadinessCard`, `PurchaseReviewPanel`, `MapLegend`, `MapAreaPanel`, `ReportChart`, and `ResponsiveBottomNavigation`.

Screenshot-specific **composition components**, not separate feature systems:

`PriorityConstraintHero`, `RecoveryProgressCard`, `OverviewKpiStrip`, `MineMapOverviewPanel`, `IssueActionPlanCard`, `ProductionPlanChartCard`, `RecoveryOpportunityCard`, `CrossTeamDependenciesCard`, `ShiftHandoverCard`.

### 6.2 Component visual states

Every actionable component needs: **default, hover, keyboard focus, pressed/active, disabled, loading, error and success** where applicable. Data-bound panels also need **no data, unknown, stale, conflicting, restricted and demo-offline** states.

| Component | Default | Special state behaviour |
|---|---|---|
| Primary button | Emerald/dark polished, text + arrow where relevant | Spinner/disabled during mock mutation; success only after canonical response; visible focus |
| Secondary button | White/light surface with subtle border and dark text | No fake hover affordance when disabled |
| Active sidebar item | Emerald-tinted row, green left bar, icon and label | Retains selection on refresh; collapses with tooltip |
| Status pill | Text + icon + semantic colour | Unknown is neutral, not green; stale/conflict has explanation |
| Metric card | Label, value, unit, trend/quality | Missing numeric value is `--` with explanation, never zero by default |
| Action row | Icon, title, owner, timing, state | Pending vs overdue vs complete must not contradict one another |
| Map area | Transparent polygon with visible labelled state | Keyboard selection, selected outline, corresponding details and list alternative |
| Drawer/modal | Rounded raised panel with context | Moves focus in; returns focus to opener on close |
| Notification | Small dropdown row with icon, time and record link | Deep-links to permitted record; no permanent notification sidebar |

### 6.3 Icon and badge discipline

- Green checkmark = genuinely completed/verified **within the mock scenario**, not legal/safety approval.
- Outlined green ring = currently active step, not verified completion.
- Neutral grey ring = pending.
- Red = verified blocked condition or explicit high-priority alert, according to its label and evidence.
- Amber = at risk / review required / overdue, according to its specific label.
- Grey = unknown/pending/stale as explicitly labelled. Do not collapse these distinct states into the same word.
- Use **both** icon and readable text; do not rely on red/green alone.

## 7. Interactions, routes and data coherence

### 7.1 The screenshot is the Overview route

Implement the visual shell and priority dashboard as `/overview`. Use the AFD routes:

| Interaction | Expected destination |
|---|---|
| Open hero priority issue / action plan | `/exceptions/[id]` |
| Open operational map | `/map` |
| Open selected equipment | `/equipment/[id]` |
| Inspect spare-parts readiness | `/resources/[activityId]` |
| View shift handover | `/shifts/[id]/handover` or `/shifts` |
| Inspect production or other report | `/reports/[reportKey]` |
| Change demo site/persona/subscription/scenario | `/demo` or corresponding documented selector |

Other documented workspace routes: `/exceptions`, `/equipment`, `/resources`, `/shifts`, `/reports`, `/admin`. **Do not create actual network backend routes based on this table**. Route access must check demo persona, organisation/site scope, entitlement and record ownership. Browser back/forward should restore contextual filters and scroll where appropriate.

### 7.2 Priority journey to demonstrate

1. Load VESPER in persistent **DEMO / SIMULATED DATA** mode, Mine Manager persona, a fictional permitted site and a deterministic incident fixture.
2. Read priority constraint in hero; inspect source and rationale.
3. Open linked issue details; view accountable owner and blocking dependency.
4. Open related map area and show its correctly evidenced operational state.
5. Perform an **authorised fictional** issue update; validate, show pending, then update the single mock domain record.
6. Return to Overview. Hero, action plan, map, notifications, handover and relevant reports reflect the **same canonical issue ID and status**.
7. Reported resolution remains separate from independent verification and final closure. Any safety or equipment release is always outside this prototype's real-world authority.

### 7.3 Shared mock state

TRD baseline: browser-only deterministic MSW mock service with **one domain source of truth**; TanStack Query for data/query cache; Zustand for selected persona, site, scenario and UI shell settings. Do not maintain separate copies of mutable issue/equipment/parts data inside individual cards. Site switching clears stale area/drawer context and resets site-scoped filters; scenario resets should be explicit and deterministic.

### 7.4 Search, bell, site switcher and filters

- Global search returns only fictional, role/site-permitted records; selecting a result deep-links to its source.
- Bell shows a **dropdown**, not a permanent notification column; badge count derives from demo unread items.
- Site selector changes all site-scoped surfaces, including hero, map, KPIs, actions and reports. Prompt before discarding unsaved work.
- Date and shift selectors use the demo fixture calendar and clearly label the time basis.
- Map chips are filtered views of the same records; do not produce independent contradictory statuses.
- When a feature is unavailable under the demo tier, show a clear entitlement explanation and safe return path rather than a dead link or fake data.

## 8. Responsive behaviour

### 8.1 Desktop, 1440 px and above

- Target the screenshot's 1536 px composition as a **visual reference**.
- Header remains stable. Sidebar approximately 216-240 px open and collapsible.
- Hero/recovery on one row; five KPI cards on one row; map/actions on one row; four lower cards on one row, provided text remains legible.
- Use CSS Grid fractions; allow card height growth with wrapped text or expanded status labels. Avoid fixed 1024 px dashboard height.

### 8.2 Laptop, 1024-1439 px

- Keep fixed header and collapsible sidebar.
- Reduce image/card padding slightly, not typography below readable sizes.
- KPI strip may be a 3+2 or 2+3 grid when five columns would truncate labels.
- Map/action columns can remain side by side while useful; lower four cards can become a 2x2 grid.
- Horizontal overflow of operational tables must be intentional and accessible, not a layout accident.

### 8.3 Management tablet, 768-1023 px

- Use a collapsible/drawer sidebar and condensed header actions.
- Stack or use an adaptive 2-column layout for hero and recovery.
- KPI cards use 2 columns (with a natural remainder).
- Map is full-width or paired with a collapsible contextual action drawer; maintain comfortable touch controls.
- Action plan becomes a full-width section below the map when necessary.
- This is still VESPER, not a separately branded tablet product.

### 8.4 Field mobile, typically 360-767 px

**The screenshot does not define a mobile layout.** The PRD/TRD/AFD specify a separate task-focused **mobile browser experience**, not a squeezed copy of the desktop dashboard and not a native application.

- Navigation focuses on **My Shift, My Work, Report, Notifications**, with Profile reached from the application shell (mobile header/menu) rather than the primary tab bar.
- Primary interaction order: **Report -> Act -> Track**.
- Avoid the full desktop KPI/hero/map composition as the landing experience.
- Use one focused task per view; prefills and short forms; touch targets around 44 x 44 CSS px while meeting WCAG 2.2 AA requirements.
- Show offline simulation explicitly as `Pending Synchronisation` until a controlled mock sync succeeds; never claim that a supervisor has received an unsynchronised report.
- Use an accessible list/detail alternative rather than tiny precision polygons on mobile.
- Account for safe-use restrictions in real mining areas; mobile mockups do not authorise device use underground or in prohibited zones.

## 9. Motion, feedback and accessibility

### 9.1 Motion target budgets (from TRD)

| Interaction | Target | Behaviour |
|---|---|---|
| Button hover/press | 100-160 ms | Subtle tint/shadow; immediate press response |
| Card/row hover | 140-200 ms | Small elevation/tint, no row/card scaling |
| Dropdown/tooltip | 120-190 ms | Controlled fade and tiny translation |
| Sidebar collapse | 200-260 ms | Coordinated resize without layout distortion |
| Route content transition | 180-280 ms | Animate main content only; shell stays mounted |
| Drawer/modal | 200-300 ms | Focus-trapped appropriately; predictable close |
| Toast/notification | 150-220 ms | Non-blocking entrance and exit |
| Map selection | 100-180 ms | Immediate readable outline and details |

Respect `prefers-reduced-motion`. No ambient pulsing, bounce-heavy transitions, scroll hijacking, animation-only alerts or delayed critical state changes.

### 9.2 Accessibility contract

- Target **WCAG 2.2 AA** where applicable.
- Use semantic headings, landmark regions and keyboard-operable controls.
- Provide visible focus states on topbar, sidebar, filters, buttons, drawers and polygons.
- Display text/icon alternatives for red/amber/green/grey; never rely on colour alone.
- Charts need labelled axes, units, tooltips and tabular alternatives.
- If a card is not interactive, it must not look clickable.
- Give map polygons and interactive icon-only controls descriptive accessible names.
- Over image backgrounds, maintain contrast with a robust dark gradient.
- Field-level form errors must remain visible and preserve entered data; no false success toast.
- At 200% zoom, allow reflow without losing task access; test narrow 320 CSS px where applicable.
- Modal/dialog focus returns to the initiator when closed; no inaccessible overlay traps.

## 10. Demonstration content and cross-card consistency

### 10.1 Example scenario from screenshot (fictional; NOT verified operational data)

| Object | Illustrative value in image | Consistency requirement |
|---|---|---|
| Mine/site | Riverside Mine, Open Pit - Gold | Adopted as the fictional fixture for the existing Equipment Breakdown scenario (AFD Section 17.4, BSD Section 18.2); no new scenario |
| Persona | John Dlamini, Mine Manager | Fictional identity, role and site entitlement |
| Demo date | Thu, 24 Apr 2025 | Fixture clock; not real current date |
| Shift | Shift A, 06:00-14:00 | Must match selected site/time zone |
| Primary issue | Crusher C-02 - Feed Interruption | One stable fictional issue ID across all cards |
| Affected area | North Pit / Crusher C-02 context | Status derived from documented rules and simulated evidence; apply Blocked only when verified scope warrants it |
| Report age | 42 min | Must use fixture clock and event timestamp |
| Reported impact | -3,600 t | Screenshot-only illustrative figure; formula/source required or omit |
| KPI actual / plan | 156,200 t / 162,000 t | Both must share same interval; illustrative |
| Variance | -5,800 t / -3.6% | Derive, not separately hardcode |
| Equipment availability | 92% | Show only with defined sample and formula |
| Recovery progress | 72% shown | **Not used**; display completed and in-progress steps separately |
| Recovery value | R2.7M shown | **Not displayed**; no unvalidated financial recovery estimates |
| Handover | 3 open items | Derive from unresolved fixture records |

These values are useful for **visual fidelity fixtures**, not evidence that VESPER is operating at a mine. The screenshot's `Updated 2 min ago` is also illustrative. Do not seed real customer or employee data.

### 10.2 State separation

Maintain two independent dimensions:

- **Operational area status:** `On Plan`, `At Risk`, `Blocked`, `Unknown`.
- **Information quality:** `Reported`, `Verified`, `Pending`, `Stale`, `Conflicting`, `Unknown`, `Pending Synchronisation`.

Example: an issue may be `Reported` and the area `At Risk`; that does **not** make the area `Blocked`. Unknown data is never automatically green. A resolved equipment fault is not proof that production recovered. Chart trend, map colour, hero status and step completion must all be derived or explicitly qualified.

## 11. Screenshot-to-PRD reconciliation register

This table protects VESPER from accidentally inheriting unapproved screen features.

| Visible in screenshot | Risk / mismatch | Required treatment |
|---|---|---|
| Header and sidebar show several separate Production/People/Contractors/Recovery links | Conflicts with approved eight-workspace information architecture | **Keep styling; align actual links with AFD routes and PRD workspaces.** No new modules |
| Header `Live` and `Live Operational Map` | Prototype cannot claim live mine data | Display persistent **DEMO / SIMULATED DATA**; name module `Operational Map` |
| `72% / On Track` recovery ring | No defined computation in screenshot; inconsistent with visible step count | Display completed and in-progress steps separately; no percentage or `On Track` label |
| `-3,600 t`, `3,600 t`, `R2.7M`, `1h 18 min` | Could imply measured loss, validated recovery or live prediction | Hero impact: label as illustrative with its basis, or show `Impact requires review`. Recovery Opportunity: `Opportunity not quantified`; no financial estimate, recovery window or countdown |
| `Execute Recovery Plan` CTA | Suggests real-world operational execution | Relabel `Review Recovery Actions`; opens mock issue/actions only |
| `Safety authorisation / HSE` dependency | Could imply VESPER confers operational safety permission | Fixed label `Safety authorisation - managed outside VESPER (demo reference only)`; informational prerequisite only; no approval/clearance functionality or approval-style status |
| Green `Active`, amber `Reduced Output`, red `Feed Interruption` polygons/markers | Descriptive labels are not canonical evidence-based area states | Show canonical operational status + separate descriptive context |
| Work Orders, Requests, Integrations, Contractor entries | Screenshot alone cannot authorise production workflows or connectors | Use PRD P0 views and simulated references; defer extra workflows |
| Completed check shown next to `Overdue (5 min)` row | Visual state contradiction | Correct icon/status based on recorded event and deadline |
| North Pit shown green `Active` while the hero reports limited throughput across the North Pit | Operational status contradiction | Derive North Pit and all area statuses from documented rules and simulated evidence; never copy statuses from the screenshot |
| Repair crew `ETA 09:05` in green while the Action Plan shows `Mobilise repair team` as Pending | Cross-card state contradiction | Derive both from the same fixture record |
| Site selector in both the top bar and the sidebar site card | Duplicate site control | Top-bar selector only; sidebar site card is display-only |
| Chart and KPI metrics without source freshness | Misleading sense of precision | Accessible source, date, quality and definition in detail/tooltip |

**Escalation rule:** The reference screenshot is a visual reference only: it never overrides the PRD, TRD, Backend Schema or AFD and cannot introduce functionality. If a pixel-identical mockup would contradict those documents, prioritise the documented product/technical boundary and record the deliberate visual divergence for leadership approval. Do not quietly invent a product decision.

## 12. Prototype-specific copy and safety rules

- Persistent visible indicator: **`DEMO / SIMULATED DATA`**.
- Optional disclosure: `This is a demonstration. All mine sites, users, events, figures and actions are fictional.`
- Map note: `Illustrative site map - not live GPS, surveyed positioning or safety clearance.`
- Metric tooltip for hypotheticals: `Illustrative scenario value, not a verified operating or financial result. View assumptions.`
- Action confirmation: `Demo action recorded. No real equipment, procurement or operational system was changed.`
- Offline report: `Pending Synchronisation - this report has not been received centrally.`
- Unavailable evidence: `Status requires confirmation`; `No verified reading available`; `Lead time unconfirmed`.
- Error: `This demo action could not be completed. Your entered information has been preserved.`
- Not entitled: `This demonstration feature is unavailable for the selected subscription or role.`

Do not use text that implies a demo issued an HSE clearance, approved an order, dispatched a real crew, restarted a machine, sent an emergency alert or recovered money.

## 13. Suggested component implementation references (not an instruction to code yet)

The TRD identifies **Next.js App Router, React, strict TypeScript, Tailwind CSS v4, HIMARK-controlled shadcn/ui/Radix, Motion for React, Lucide, Recharts, TanStack Query, Zustand, MSW and Leaflet CRS.Simple** as the greenfield reference stack. The Stage 0 repository audit found an existing monorepo with no frontend code, so the greenfield Next.js architecture is adopted inside it (TRD ADR-11), with shared contracts in `packages/api-contracts/` (TRD ADR-12); technical lead sign-off is pending. No production backend or actual API endpoints are required.

Recommended design organisation for later approved implementation:

```text
apps/
  mine-operator/          # VESPER prototype application (web, tablet and mobile views)
    src/
      app/                # Routes, layouts, loading and error views
      components/
        ui/               # Accessible primitives
        vesper/           # Shared shell, status, KPI and timeline components
      design-system/      # Tokens, typography, motion presets
      features/
        overview/         # The composition specified here
        map/              # Fictional local-plan map and area details
        exceptions/       # Issue details, action/dependency states
        equipment/        # Asset and maintenance detail
        resources/        # Parts and readiness review
        shifts/           # Shift and handover journeys
        reports/          # Charts, definitions and accessible tables
        admin/            # Demo persona/site/entitlements
      domain/             # Calculations and selectors consuming shared contracts
      services/           # Typed demo query/mutation interfaces
      mocks/              # Deterministic fictional fixtures and MSW handlers
      test/               # Unit helpers and integration fixtures
    e2e/                  # Playwright journeys
    public/demo/          # Approved fictional imagery; no client-sensitive files
packages/
  api-contracts/          # Shared typed domain contracts and Zod schemas
```

This tree mirrors TRD Section 4.2 and is **not** permission to create folders, restructure the existing VESPER workspace or start writing code. Do not convert this specification into unapproved features or modify repository paths without instruction.

## 14. Design QA and acceptance checklist

A reviewer should be able to verify the following once implementation is authorised.

### 14.1 Visual fidelity

- [ ] At a 1536 x 1024 reference viewport, the hierarchy matches: obsidian header; white contextual sidebar; hero + recovery; five KPIs; map + action plan; four lower cards.
- [ ] The hero is visually dominant; the map is the next most prominent element.
- [ ] Design tokens match the approved obsidian/white/emerald system; neumorphism remains subtle.
- [ ] Component borders, corners, icon sizes, spacing and shadow depth are consistent.
- [ ] Text remains readable over the hero photo and map overlays.
- [ ] Cards do not clip values, action pills, longer names or status labels.
- [ ] The same style carries to tablet and mobile without inventing a new brand.

### 14.2 Functional coherence (mock only)

- [ ] A persistent **DEMO / SIMULATED DATA** indicator is visible on every route.
- [ ] Site/role/tier/shift switching updates visible records consistently and obeys guards.
- [ ] Priority hero links to the correct simulated issue ID.
- [ ] Map, action plan, handover and reports agree about the linked issue after changes.
- [ ] Unknown, stale and conflicting information never defaults to green or zero.
- [ ] No misleading recovery percentage, ROI, ETA or cost is displayed without explicit source/assumptions.
- [ ] Reported repair, independent verification, release record and operation resumption remain distinct.
- [ ] No button approves real procurement, dispatches a crew or grants operational safety clearance.
- [ ] Errors preserve form inputs; success follows a completed canonical mock mutation.
- [ ] No user encounters dead links to invented modules.

### 14.3 Usability, responsiveness and accessibility

- [ ] Overview is scannable; the primary constraint and next action are clear without hunting through reports.
- [ ] At 1024 px, no horizontal clipping; five KPIs reorganise when necessary.
- [ ] At 768 px, map/action content and navigation remain touch-accessible.
- [ ] Mobile follows **My Shift / My Work / Report / Notifications**, not a miniature dashboard.
- [ ] Keyboard and screen reader users can reach all actions and map information.
- [ ] Status colour has text/icon equivalents and meets accessibility contrast.
- [ ] Reduced-motion mode removes nonessential animation.
- [ ] Info quality, updated time, calculation basis and assumptions are inspectable.

## 15. Implementation handoff instruction

**Recommended instruction when this file and the reference screenshot are supplied to an implementation agent:**

> Use `VESPER_3.0_UI_UX_Design_Specification.md` as the visual design handoff for the **VESPER Overview / Command Centre screen**, together with `VESPER v3.0 Operational Recovery Dashboard.png` as a visual reference only. Compare it to the VESPER PRD, TRD, Backend Schema and App Flow. The Markdown describes how the interface should look and behave; it does not approve additional features, and the screenshot does not override any document. Preserve the premium, predominantly light interface with restrained minimalist neumorphism, obsidian-black top navigation, white contextual sidebar, mineral-white working surfaces, emerald-green accents, card hierarchy, map and action timeline. Follow the reconciliation register whenever screenshot content conflicts with the documents. First give a short fidelity plan and list any conflicts or missing assets. **Do not edit files or begin coding until approval is given.** This phase is frontend/UI/UX with simulated data only.

## 16. Known unknowns / items for review

1. **Final interface asset library:** The provided screenshot gives appearance but not separately licensed/raw hero, aerial mine-plan, thumbnail, logos or font files. Implementation agents must use approved assets or clearly marked fictional substitutes; it must not assume a screenshot crop is a production asset.
2. **Screenshot metrics and recovery claims:** No verified recovery-benefit calculation accompanies the image. Values cannot become business requirements by copying them into code.
3. **Screenshot navigation mismatch:** Approved eight-workspace navigation should govern P0 until HIMARK explicitly changes the PRD/AFD.
4. **Single-screen evidence:** Only one desktop design mockup currently exists. It does **not** demonstrate responsive states, hover/focus, deeper issue views or mobile screens. Tablet and mobile designs remain to be developed; until then those layouts follow the PRD/TRD/AFD and must be reviewed as designs, not inferred as existing artefacts.
5. **Document approvals:** The PRD, TRD, Backend Schema and AFD carry draft/approval-pending status. This specification preserves that status and does not claim final executive sign-off.

---

**End of VESPER 3.0 UI/UX Design Reference Specification - v1.1**  
**Deliverable scope:** Documentation only. Version 1.1 updated the five VESPER specification files in `docs/` as part of the documentation reconciliation; no application code, application folders or dependencies were changed.
