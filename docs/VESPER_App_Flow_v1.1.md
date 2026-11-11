# VESPER 3.0 — App Flow Document

**HIMARK SGC**  
**PRODUCT EXPERIENCE / MINING OPERATIONS**

**THE MINING OPERATING SYSTEM**

Identify delays. Prevent avoidable waiting.  
Recover productive time.

| **VERSION** | **1.1**                              |
|-------------|--------------------------------------|
| **DATE**    | **10 NOVEMBER 2026**                 |
| **STATUS**  | **REVISED DRAFT - APPROVAL PENDING** |

**CURRENT DEVELOPMENT AUTHORISATION**

Interactive UX flows and simulated operational states only.  
No live backend, mine integrations or operational deployment.

## Document control

| **ORGANISATION**     | HIMARK SGC                                                                                         |
|----------------------|----------------------------------------------------------------------------------------------------|
| **PRODUCT**          | VESPER - The Mining Operating System                                                               |
| **DOCUMENT**         | Application Flow and Interaction Specification                                                     |
| **VERSION / STATUS** | 1.1 / Revised draft - approval pending                                                             |
| **PREPARED ON**      | 2 November 2026                                                                                    |
| **CURRENT PHASE**    | UI/UX application journeys and interaction contracts                                               |
| **NEXT DELIVERABLE** | Implement approved UI screens and scenario journeys                                                |
| REVISION 1.1         | 10 November 2026 - Core Mobile routes, role/site guards, navigation and E2E-15 acceptance updated. |

## Contents

| **01** Purpose, Authority and Flow Standards             | **11** Resource Readiness and Spare Parts Early Warning      |
|----------------------------------------------------------|--------------------------------------------------------------|
| **02** App Entry, Demo Bootstrap and Context Selection   | **12** Shift Control and Handover                            |
| **03** Personas and Role-Based Entry Paths               | **13** VESPER Mobile: Report, Act, Track                     |
| **04** Information Architecture and Screen Route Map     | **14** Reports and Operational Intelligence Flow             |
| **05** Shared App Shell and Global Interactions          | **15** Administration, Site Access and Subscription Flow     |
| **06** Overview / Command Centre Flow                    | **16** Notifications, Search and Deep Links                  |
| **07** Live Operational Map Flow                         | **17** Shared Domain Events and Cross-Module Synchronisation |
| **08** Work & Exceptions: New Issue Reporting            | **18** Universal Exception, Empty and Offline Flows          |
| **09** Work & Exceptions: Triage, Actions and Resolution | **19** Motion, Responsive and Accessibility Flow Rules       |
| **10** Equipment & Maintenance and Delay Intelligence    | **20** Flow Acceptance Tests, Traceability and Sign-Off      |


## 1. Purpose, Authority and Flow Standards

### 1.1 Document Purpose

This Application Flow Document (AFD) defines how a person moves through VESPER, the decisions the interface presents, which screens lead to which actions, and what changes after each interaction. It is the bridge between the PRD's business requirements, the TRD's frontend architecture, and the Backend Schema's domain entities. Designers and developers must be able to build and test the priority flows directly from this document.

**Current implementation authority is limited to an interactive frontend prototype.** All incidents, notifications, updates, site statuses, inventory checks, handovers, access decisions and reports are simulated. No real mine system, procurement service, identity provider, safety workflow or production backend may be connected during this phase.

### 1.2 Document Precedence

| **Document**                          | **Governs**                                                                                   | **This AFD must not override**             |
|---------------------------------------|-----------------------------------------------------------------------------------------------|--------------------------------------------|
| Product Requirements Document (PRD)   | Customer problem, approved scope, priorities, business outcomes and acceptance criteria       | P0/P1/P2 release decisions                 |
| Technical Requirements Document (TRD) | Framework, routing approach, design system, motion, mocked APIs and frontend testing          | No-backend boundary or technical standards |
| Backend Schema Document (BSD)         | Entity meaning, identifier scope, data quality, timestamps and relationships                  | System-of-record ownership and integrity   |
| Application Flow Document (AFD)       | Navigation, role-specific journeys, UI transitions, state feedback and cross-screen behaviour | Any higher-authority requirement           |

Differences between documents require an explicit change note and approval before implementation. A screen mockup does not independently authorise a feature.

### 1.3 Mandatory Interaction Principles

- **Actionable before comprehensive:** important constraints and next actions take precedence over decorative analytics.

- **One operational truth:** a single simulated issue has one canonical identifier and consistent status across the application.

- **Role and site context:** every navigation destination is interpreted within the selected persona, organisation, site and subscription.

- **Uncertainty is visible:** reported, verified, stale, conflicting and unknown data have distinct interpretations.

- **Human controls remain authoritative:** simulated acknowledgment is not purchasing approval, equipment clearance or safety permission.

- **Desktop and mobile serve different tasks:** mobile prioritises Report -\> Act -\> Track; desktop supports coordination and analysis.

- **No dead ends:** every detailed state provides a clear way back, a contextual next step, or a useful restricted/error message.

- **Accessibility is part of the flow:** keyboard, focus, reduced motion and non-colour state cues are required.

### 1.4 Flow Notation

| **Symbol / term**   | **Meaning**                                                               |
|---------------------|---------------------------------------------------------------------------|
| Screen              | Named route with identifiable purpose and primary actions                 |
| Drawer / modal      | Focused overlay; closing it returns to its previous context               |
| Decision            | Condition that changes the next screen or available action                |
| Guard               | Role, site, tier, validation or data-state requirement for a route/action |
| Domain mutation     | Simulated action that changes the single mock domain store                |
| Derived view        | Dashboard, map, report or notification calculated from that store         |
| Manual verification | A separate authorised-human confirmation represented as a demo action     |
| P0 / P1 / P2        | Current prototype / subsequent prototype / future production scope        |

## 2. App Entry, Demo Bootstrap and Context Selection

### 2.1 Entry Flow

The prototype opens in a visibly marked **DEMO / SIMULATED DATA** state. There is no real email/password login, biometric verification, SSO, enterprise session or production account provisioning in this phase.

1. Load the application shell and initialise the browser mock worker before any domain request.

2. Display a deterministic bootstrap state while the shared demo store and fixture scenario are prepared.

3. Present the Demo Launch experience or restore a clearly identifiable demo context, where supported.

4. Select a fictional persona, eligible subscription configuration, authorised mine site and demonstration scenario.

5. Validate route visibility using both selected role/site and subscription features.

6. Enter the appropriate default workspace; display the persistent **DEMO / SIMULATED DATA** indicator.

7. Any context change must update all visible site-scoped records and query caches together.

### 2.2 Context Selection Contract

| **Context**  | **Initial behaviour**                                           | **Change handling**                                                  |
|--------------|-----------------------------------------------------------------|----------------------------------------------------------------------|
| Persona      | Mine Manager is the recommended desktop demonstration default   | Re-evaluate permissions and redirect restricted views                |
| Subscription | Operations - Single Site is the recommended standard scenario   | Re-evaluate mobile, site allowance and reporting entitlements        |
| Mine site    | Select from the current persona's permitted demonstration sites | Reset site-specific filters, map selections and stale detail drawers |
| Scenario     | Normal Operations or a named seeded incident scenario           | Rebuild the entire fixture graph, clear queries and confirm reset    |
| Demo clock   | Deterministic fixture time for timestamps and deadlines         | Recalculate all simulated time-sensitive statuses consistently       |

Switching persona or site while a form has unsaved changes must prompt for confirmation. Do not silently discard work or carry record detail from the previous site into the new site.

### 2.3 Bootstrap and Guard States

| **Condition**                | **User-visible result**                                 | **Next action**                                  |
|------------------------------|---------------------------------------------------------|--------------------------------------------------|
| Worker and fixture loaded    | Enter role-appropriate landing page                     | Normal navigation                                |
| Mock worker fails to start   | 'Demo unavailable' state, no fallback to a real API     | Retry setup / return to demo launch              |
| No permitted site            | Site access not available message                       | Choose another demo persona/site                 |
| Feature outside subscription | Clear entitlement-restricted view                       | Return to available workspace / change demo tier |
| Route outside role scope     | Restricted access message without leaking record detail | Return to role's home                            |
| Unknown route or ID          | Not-found state                                         | Return to relevant register                      |

### 2.4 Default Landing

Desktop/tablet Mine Manager, Production Manager and Shift Supervisor enter **Overview** unless their demonstration task opens a deep link. Maintenance Planner may enter **Equipment & Maintenance** or **Resource Readiness**; Stores/Procurement may enter **Resource Readiness**; Field Employee enters **My Shift** on mobile. These are demo defaults, not evidence of validated customer preferences.

## 3. Personas and Role-Based Entry Paths

### 3.1 Roles and Their First Useful Action

| **Demo persona**              | **Entry view**     | **Primary flow**                                          | **Management visibility**                 |
|-------------------------------|--------------------|-----------------------------------------------------------|-------------------------------------------|
| Mine Manager                  | Overview           | Priority constraint -\> evidence -\> accountable action   | Significant site risks and outcomes       |
| Production Manager            | Overview           | Production deviation -\> area/issue -\> recovery tracking | Shift and area coordination               |
| Shift Supervisor              | Shift Control      | Current shift -\> outstanding issue -\> handover          | Assigned shift and work                   |
| Maintenance Manager           | Equipment          | Equipment fault -\> readiness -\> verified restoration    | Maintenance coordination                  |
| Maintenance Planner           | Resource Readiness | Upcoming service -\> parts check -\> review               | Maintenance-related delays                |
| Stores / Inventory Controller | Resource Readiness | Stock confirmation -\> shortage assessment                | Parts and inventory references            |
| Procurement User              | Resource Readiness | Purchase-review warning -\> evidence -\> review action    | Purchasing dependencies, no real ordering |
| Field Employee                | Mobile My Shift    | My Work / Report -\> progress                             | Own tasks and reported issues             |
| Organisation Administrator    | Administration     | Demo users/sites -\> access/entitlements                  | Configuration views only                  |
| Executive Viewer              | Reports            | Reporting -\> source -\> issue drill-down                 | Entitled aggregate views                  |

### 3.2 Navigation Access Matrix

**V = view; A = demonstrated role-appropriate action; - = not a primary entry.** This is an initial UX matrix, not a production authorisation policy. Site and subscription constraints still apply.

| **Workspace**           | **Primary action personas**                                | **Supporting / read personas**                                |
|-------------------------|------------------------------------------------------------|---------------------------------------------------------------|
| Overview                | Mine Manager, Production Manager                           | Supervisors, planners and entitled executives                 |
| Operational Map         | Mine Manager, Production Manager                           | Supervisors, maintenance and entitled viewers                 |
| Work & Exceptions       | Supervisor, owner, relevant maintenance or production user | Management; field reporter through Mobile                     |
| Equipment & Maintenance | Maintenance Manager and Planner                            | Production management, supervisors and authorised viewers     |
| Resource Readiness      | Maintenance Planner, Stores, Procurement                   | Site management for material production risks                 |
| Shift Control           | Shift Supervisor                                           | Production management and assigned field users through Mobile |
| Reports                 | Entitled management / analyst viewer                       | Other permitted role-specific viewers                         |
| Administration          | Organisation Administrator                                 | No general user access                                        |

### 3.3 Permission Guard Order

Evaluate in this order: (1) demo context exists, (2) organisation/site selection is valid, (3) selected persona has relevant role capability, (4) subscription permits the feature, and (5) record belongs to the permitted site. An unavailable capability must not reveal data merely because the user guesses a detail URL.

## 4. Information Architecture and Screen Route Map

### 4.1 Primary Desktop Navigation

The global top bar is stable. A collapsible contextual white sidebar contains the eight primary workspaces. Module-specific details use within-workspace tabs, drawers, drill-downs and stable routes. Advanced analytics remain under **Reports**, never in a separately branded application.

**Figure 1 follows:** A high-level route flow from Demo Launch through context selection to desktop and mobile experiences. It represents UX navigation, not actual service deployment.

![Application navigation flow: Demo Launch, persona/site/subscription scope, shared shell, then eight web workspaces or VESPER Mobile field tabs. Restricted routes offer a safe return path.](VESPER_assets/App_Flow/media/image1.png)

Figure 1. Demo entry, role/site/tier guards and primary app destinations.

### 4.2 Canonical Routes

Routes are proposed stable frontend paths aligned to the TRD. All paths are protected by demo guards. The existing repository should be audited before route refactoring.

| **Route**                     | **Screen**                     | **Entry / exit behaviour**                              |
|-------------------------------|--------------------------------|---------------------------------------------------------|
| /demo                         | Demo launch / scenario context | Select persona, site, tier and fixture; open product    |
| /overview                     | Command Centre                 | Open priority issue, area, equipment or shift           |
| /map                          | Operational Map                | Area polygon -\> detail panel -\> linked issue          |
| /exceptions                   | Work & Exceptions register     | Filters -\> issue details / new issue                   |
| /exceptions/new               | Report issue                   | Validate -\> simulated submit -\> detail                |
| /exceptions/\[id\]            | Issue detail                   | Timeline, actions, dependencies, evidence and next step |
| /equipment                    | Equipment register             | Select equipment -\> detail                             |
| /equipment/\[id\]             | Equipment detail               | Maintenance, linked issues and delay timeline           |
| /equipment/\[id\]/maintenance | Equipment maintenance          | Service requirement -\> readiness record                |
| /resources                    | Resource Readiness overview    | Select activity or shortage warning                     |
| /resources/\[activityId\]     | Activity readiness detail      | Parts / staff / tools status, review actions            |
| /shifts                       | Shift Control                  | Select current or incoming shift                        |
| /shifts/\[id\]                | Shift detail                   | Assignments, unresolved issues and handover             |
| /shifts/\[id\]/handover       | Handover detail                | Review -\> acknowledge where authorised                 |
| /reports                      | Reports hub                    | Filters, entitled metrics and drill-down                |
| /reports/\[reportKey\]        | Report detail                  | Select measure -\> supporting source record             |
| /admin                        | Administration                 | Demo users, sites, permissions, tier review             |
| /mobile/my-shift              | Mobile shift landing           | My Work, outstanding issues and report                  |
| /mobile/my-work               | Mobile assigned work           | Task details -\> update status                          |
| /mobile/report                | Mobile issue report            | Report -\> review -\> submit/pending sync               |
| /mobile/notifications         | Mobile alert list              | Alert -\> permitted record                              |
| /mobile/profile               | Mobile persona/settings        | View demo identity, scenario status                     |

\[id\], \[activityId\] and \[reportKey\] are stable fictional identifiers. Mock APIs use the separate /\_demo/api/v1 namespace; **do not create actual backend routes from this navigation table**.

### 4.3 URL and History Rules

- Register filters, selected site context and report periods should remain stable when opening and returning from a detail route, using URL query parameters or an explicit view-state strategy.

- A browser Back action must return to the prior meaningful context; closing a drawer must not navigate to an unrelated module.

- Direct links reopen the same fictional record when the currently selected persona and site permit it.

- If an issue is not visible after a role/site switch, show a restricted/not-found state rather than rendering a record from a previously cached site.

- The top-level application shell remains mounted across module navigation.

## 5. Shared App Shell and Global Interactions

### 5.1 Shell Components

| **Component**            | **User action**                                     | **UI response**                            | **Edge behaviour**                             |
|--------------------------|-----------------------------------------------------|--------------------------------------------|------------------------------------------------|
| Obsidian top bar         | Search, site selection, notifications, demo persona | Persistent global controls                 | Preserve context through route changes         |
| White contextual sidebar | Select workspace                                    | Active state and contextual navigation     | Collapsible; tooltips on collapsed icons       |
| Breadcrumbs              | Select parent                                       | Return to related register or entity       | Do not imply inaccessible parents              |
| Primary action           | Start a role-permitted task                         | Open page, drawer or short form            | Disabled with clear reason when unavailable    |
| Context drawer           | Inspect related record                              | Side panel with linked source and actions  | Close restores original scroll and focus       |
| Filters and tabs         | Change visible records                              | Update one domain-backed view              | Empty state distinct from loading state        |
| Notification dropdown    | Open relevant alert                                 | Link to source record                      | Avoid separate permanent notification sidebar  |
| Demo indicator           | Inspect demo disclosure                             | Explain mocked data, limitations and reset | Always visible, never masquerade as production |

### 5.2 Interaction Feedback Sequence

For all P0 mutations: **Initiate -\> Validate -\> Show pending -\> Apply one mock mutation -\> Confirm canonical result -\> Refresh dependent views**. A failed mutation must preserve input values, show an actionable error and never display a success toast.

### 5.3 Motion Integration

Use the shared Motion presets defined in the TRD: short hover feedback, coordinated sidebar resizing and controlled drawer/page transitions. The shell must not flash or re-mount on navigation. Status changes on the Operational Map must become visible immediately enough for correct interpretation; visual easing may not defer critical warnings. Reduced-motion settings replace decorative movement with instant or subdued changes.

### 5.4 Global Context Changes

When the selected site changes, VESPER clears the previously selected area, selected equipment drawer, site-scoped search results, stale optimistic items and invalid report filters. When subscription or persona changes, the UI evaluates route guards and takes the user to an appropriate safe landing with a clear reason for any redirect.

## 6. Overview / Command Centre Flow

### 6.1 Goal and Entry

**Goal:** A manager can identify a meaningful constraint and reach its evidence and next action within a short, explainable path. Entry routes: /overview, a high-priority notification, or returning from an issue detail.

### 6.2 Primary Flow

| **Step** | **User / interface interaction**        | **Decision or data guard**            | **Resulting view**                                  |
|----------|-----------------------------------------|---------------------------------------|-----------------------------------------------------|
| OVR-01   | Select permitted site and current shift | Relevant demo context exists          | Role-specific Command Centre loads                  |
| OVR-02   | Scan priority operational cards         | Each card has a stated evidence basis | Constraints shown with status, source and freshness |
| OVR-03   | Open a priority constraint              | Relevant issue is visible to persona  | Issue summary / detail route                        |
| OVR-04   | Inspect blocker and accountable action  | There may be unresolved dependencies  | Show next step, owner and evidence                  |
| OVR-05   | Follow equipment or area link           | Both records belong to same site      | Equipment detail or map selection                   |
| OVR-06   | Return to Overview                      | The scenario may have changed         | Cards update from canonical mock records            |

### 6.3 Branching and Acceptance

- If production evidence is stale or absent, show Unknown or 'data requires confirmation', not a green achievement state.

- Prioritisation should display its rationale (e.g., verified blocked critical process) and avoid unsupported financial rankings.

- If a problem is reported but not confirmed as production-blocking, highlight the issue without declaring the whole mining area blocked.

- **Acceptance:** The selected issue ID, equipment state and map highlight agree; the user can return without losing selected site and shift.

## 7. Live Operational Map Flow

### 7.1 Goal and Entry

**Goal:** Explain the operational state of a mine area using an approved-style site-plan image, clickable polygons and provenance-rich issue links. Entry route: /map; contextual links from Overview, Equipment and Issues.

### 7.2 Primary Flow

| **Step** | **User / interface interaction** | **Decision or data guard**            | **Resulting view**                         |
|----------|----------------------------------|---------------------------------------|--------------------------------------------|
| MAP-01   | Enter Operational Map            | Site plan and polygons available      | Interactive 2D mine map appears            |
| MAP-02   | Select an operating-area polygon | Area belongs to current site          | Side panel shows area summary              |
| MAP-03   | Review operational status        | On-plan, at-risk, blocked or unknown  | Reason, source and last update are visible |
| MAP-04   | Open linked issue                | Issue scope and role guard pass       | Issue detail with contextual back path     |
| MAP-05   | Review an issue mutation         | Single mock store emits updated state | Affected polygon and card re-evaluate      |
| MAP-06   | Pan, zoom or reset               | Local site-plan coordinates only      | View remains within supported demo bounds  |

### 7.3 Area Status Decision Flow

1. **No usable or sufficiently recent evidence?** Show **Grey / Unknown**.

2. **Verified active blocker affecting the defined area's operation?** Show **Red / Blocked**.

3. **Meaningful emerging risk or deviation supported by the current evidence?** Show **Yellow / At Risk**.

4. **Reliable current evidence supports defined on-plan conditions?** Show **Green / On Plan**.

5. Otherwise show **Grey / Unknown**.

This priority order is the initial demonstration rule and must be changed only through an approved rule specification. It is not safety clearance. The map does not display claimed live truck GPS positions, CCTV, machine control or surveyed location accuracy.

### 7.4 Exceptions and Acceptance

- Missing site image: show a titled map-unavailable state and a safe navigation path.

- Source disagreement: show Conflicting and a review action; do not silently choose the more favourable colour.

- A repaired component does not turn the area green until the evidence supports the area's operational condition.

- Polygon selected by mouse, keyboard or touch must reveal equivalent information.

- **Acceptance:** One simulated issue event changes all linked status surfaces without inconsistent 'live' claims.

## 8. Work & Exceptions: New Issue Reporting

### 8.1 Purpose and Entry

**Goal:** Report a meaningful operational exception with minimum friction and record it once. Entry: desktop /exceptions/new, a map/equipment contextual Report action, or mobile /mobile/report.

### 8.2 New Report Flow

| **Step** | **Actor / screen**                          | **Data or decision**                                         | **Next state**                                          |
|----------|---------------------------------------------|--------------------------------------------------------------|---------------------------------------------------------|
| ISS-01   | Open Report Issue                           | Capture current site/persona/shift context                   | Short form visible                                      |
| ISS-02   | Choose equipment or operating area          | Only permitted current-site records offered                  | Context fields prefilled                                |
| ISS-03   | Select issue category and enter description | Required fields validated with Zod                           | Draft remains editable                                  |
| ISS-04   | Optionally attach permitted demo evidence   | File input is simulated; no production upload                | Evidence preview / metadata                             |
| ISS-05   | Review entered information                  | Warn on likely duplicate reference where fixture supports it | Confirm / revise                                        |
| ISS-06   | Submit                                      | Online simulated and validation passes                       | Canonical issue created; event appended                 |
| ISS-07   | Show acknowledgment                         | Only after mock mutation succeeds                            | Issue details with stable ID and 'Reported' status      |
| ISS-08   | Inspect related surfaces                    | Equipment/area relation exists                               | Work list, overview and map reflect issue appropriately |

### 8.3 Decision Paths

**Validation fails:** Remain on the form, preserve all inputs and show field-level messages. **Mutation fails:** Display retry and do not invent an issue ID. **Simulated offline mobile:** Represent submission as local Pending Synchronisation only; no central issue or manager alert until explicit simulated sync. **Suspected duplicate:** Prompt the user to review and open a related existing issue; do not silently merge incidents.

### 8.4 Acceptance

- Minimal mandatory fields are sufficient to complete a credible report.

- The created record has a stable fictional ID and correct site/equipment/area association.

- No success is shown before the canonical mock result is returned.

- Source and verification stay as Reported until the authorised simulated review occurs.

- Opening and closing the record preserves useful return navigation.

## 9. Work & Exceptions: Triage, Actions and Resolution

### 9.1 End-to-End Issue Coordination

**Figure 2 follows:** Issue lifecycle from report through triage, accountability, dependency handling, independent verification and closure. This is not a safety authorisation flow.

![Issue lifecycle: Report, Review, Assign, Act or Wait on dependency, Resolution Reported, Independent Verification, then Verified and Closed; rejected verification reopens the issue.](VESPER_assets/App_Flow/media/image2.png)

Figure 2. Incident coordination: review, dependency, verification and closure.

### 9.2 State Transition Contract

| **Current state**   | **Allowed next state**                    | **Required demonstration condition**                            |
|---------------------|-------------------------------------------|-----------------------------------------------------------------|
| Reported            | Reviewed / Duplicate / Cancelled          | Appropriate reviewer makes a recorded decision                  |
| Reviewed            | Action Assigned                           | Accountable owner selected, action defined                      |
| Action Assigned     | In Progress / Awaiting Dependency         | Owner acknowledges or required prerequisite identified          |
| In Progress         | Awaiting Dependency / Resolution Reported | Status and supporting note recorded                             |
| Awaiting Dependency | In Progress / Resolution Reported         | Blocker resolved, bypassed with justification or work completed |
| Resolution Reported | Verified / Reopened                       | Independent appropriate verification or rejection recorded      |
| Verified            | Closed / Reopened                         | Final close recorded; subsequent evidence may reopen            |
| Closed              | Reopened (controlled)                     | Explicit authorised reason and audit event                      |

Cancellation/duplicate outcomes should preserve their original identifiers and history. Do not delete operational history from the prototype merely because an issue was closed.

### 9.3 Action and Dependency Flow

1. Reviewer opens issue from register, map or notification and assesses scope and available evidence.

2. Reviewer selects one **accountable owner**; contributing teams or persons may own separate actions.

3. Owner records acknowledgement or the next action; time and source appear in the activity stream.

4. Where resources or another department are needed, create a dependency with a reason, related action and review deadline.

5. Escalation is demonstrated only when its configured rule and data quality justify it.

6. A contributing action may complete without resolving the parent issue.

7. A reporter may record 'repair complete', but final verification and operational resumption remain separate events.

8. A verified/closed issue remains accessible through immutable demo history and report drill-downs.

### 9.4 Explicit Forbidden Shortcuts

- One person completing a task must not auto-close the parent issue.

- No repair action grants permission to operate equipment.

- Reported data must not silently become Verified.

- Missing owner/deadline must not be treated as a successfully assigned action.

- An issue with unresolved safety or operational release conditions must not be presented as confirmed restored.

### 9.5 Acceptance

For the Equipment Breakdown scenario, a change to Awaiting Dependency appears in issue detail, priority list and shift handover. After Resolution Reported, the UI still requires simulated verification. A rejected verification returns the issue to an appropriate non-closed state with an explanation; all statuses and linked views remain consistent.

## 10. Equipment & Maintenance and Delay Intelligence

### 10.1 Equipment Navigation Flow

/equipment -\> search/filter by site and status -\> /equipment/\[id\] -\> inspect linked issues, maintenance plan, last meter observation, downtime timeline -\> open relevant issue or readiness activity -\> contextual return to equipment.

### 10.2 Equipment Detail Interactions

| **Step** | **Interaction**            | **Evidence / guard**                             | **Expected result**                      |
|----------|----------------------------|--------------------------------------------------|------------------------------------------|
| EQP-01   | Open equipment register    | Site scope filters records                       | List displays current demo equipment     |
| EQP-02   | Open selected asset        | Asset belongs to selected site                   | Details show ID, state, area and source  |
| EQP-03   | Open maintenance tab       | A plan/work-order reference exists or is missing | Schedule or explicit missing-data state  |
| EQP-04   | Open Downtime / Delay view | Events are ordered and valid where available     | Stage timeline with interval explanation |
| EQP-05   | Open linked issue          | Issue belongs to asset and site                  | Work & Exceptions detail                 |
| EQP-06   | Follow readiness risk      | Upcoming service requirement exists              | Resource Readiness detail                |

### 10.3 Delay Stage Sequence

Fault Detected -\> Reported -\> Response Started -\> Assessment Complete -\> Resources Ready -\> Repair Complete -\> Authorised Release Recorded -\> Operation Resumed.

An event has occurrence time, source and quality state. Calculations use valid timestamps and do not double-count overlapping periods. If timestamps are absent or out of order, show **Incomplete / Requires Review** and do not fabricate precise durations.

### 10.4 Critical State Distinctions

- **Equipment unavailable** does not automatically equal **production target missed**.

- **Repair completed** does not automatically equal **authorised release**.

- **Authorised release recorded** does not automatically equal **equipment actually resumed work**.

- **Downtime recorded** does not automatically equal **avoidable delay or cash recovered**.

### 10.5 Maintenance Due Flow

Show the approved next service threshold and current reliable meter reading. For an hour-based plan, calculate hours remaining and an indicative days-to-service estimate only when average daily operating hours are positive and the input is sufficiently current. Calendar-based plans use their scheduled date. Past-due services show Overdue. Unknown or stale readings suppress false countdowns. The user can open the applicable parts readiness activity directly.

## 11. Resource Readiness and Spare Parts Early Warning

### 11.1 Goal

Make it easy for a maintenance planner to see upcoming scheduled work, check whether its prerequisites are ready and identify a credible purchasing-review risk **before** a shortage causes avoidable waiting. The flow is not a procurement or automated-purchasing system.

**Figure 3 follows:** The readiness decision flow distinguishes adequate stock, verified inbound stock, shortage risk, uncertain information and overdue work.

![Spare-parts readiness: planned maintenance, validation of meter stock and order evidence, readiness evaluation, then one of Ready, Review inbound, Purchasing review or Confirm data.](VESPER_assets/App_Flow/media/image3.png)

Figure 3. Spare-parts readiness decisions and authorised review outcomes.

### 11.2 Primary Navigation Flow

| **Step** | **Actor / interaction**              | **Guard or decision**                                     | **Result**                                 |
|----------|--------------------------------------|-----------------------------------------------------------|--------------------------------------------|
| RES-01   | Planner opens /resources             | Current site and scheduled activity exist                 | Readiness overview                         |
| RES-02   | Select upcoming maintenance activity | Scope and schedule inputs available                       | Activity detail and prerequisite list      |
| RES-03   | Inspect due date and meter basis     | Reading, service threshold and usage rate validated       | Date estimate / Overdue / Unknown          |
| RES-04   | Inspect required approved parts      | Part requirement verified or provisional                  | Requirement, quantity and basis visible    |
| RES-05   | Inspect stock and reservations       | Available, allocated and reserved definitions consistent  | Potentially allocable stock / Unknown      |
| RES-06   | Inspect expected inbound orders      | Confirmed quantity and arrival evidence                   | Viable / uncertain / late incoming supply  |
| RES-07   | Inspect supplier lead time           | Source, calendar convention and last-confirmed date exist | Indicative latest-order date if calculable |
| RES-08   | Review recommendation                | Relevant role and evidence sufficient                     | Simulated review acknowledgement           |
| RES-09   | Inspect linked records               | Related equipment or work exists                          | Equipment, issue and reports linked views  |

### 11.3 Warning Decision Matrix

| **Condition**                                                | **On-screen status**                 | **Primary action**                                      |
|--------------------------------------------------------------|--------------------------------------|---------------------------------------------------------|
| Verified allocable stock is sufficient                       | Ready                                | View stock evidence; no duplicate purchasing suggestion |
| Insufficient stock; confirmed inbound can meet required date | Incoming / Review Delivery           | Confirm arrival details, not 'Buy Again'                |
| Insufficient stock and no timely confirmed inbound delivery  | Potential Shortage / Review Required | Review purchasing requirement with authorised personnel |
| Current stock unknown, stale or conflicting                  | Needs Confirmation                   | Confirm inventory data; do not assert stock is zero     |
| Component requirement not verified                           | Verify Requirement                   | Confirm maintenance scope / approved parts list         |
| Required date already passed                                 | Overdue                              | Escalate for review; no misleading future deadline      |
| Supplier lead time missing or untrusted                      | Lead Time Unknown                    | Confirm supplier lead time                              |

### 11.4 Calculation Presentation

For a validated hour-based service: hoursRemaining = nextServiceThreshold - currentMeterHours. If average daily use is reliable and greater than zero, estimatedDays = hoursRemaining / averageDailyUse. For stock, show source-specific onHand, allocated, reserved and incoming values; avoid subtracting overlapping allocation categories twice. For purchasing, indicativeOrderBy = requiredDate - confirmedLeadTime - buffer, using a defined business-day/calendar-day convention.

Do not invent a date if any critical input is unavailable. Present the underlying assumptions beside the estimate. A purchasing-review recommendation is not proof of commercial benefit.

### 11.5 Ownership and Escalation

- **Maintenance Planner:** sees approaching service and incomplete resource readiness.

- **Stores / Inventory Controller:** confirms stock, allocations, reservations and incoming records.

- **Procurement User:** investigates supplier lead time and reviews a potential requisition.

- **Site Manager:** sees only a material operational exposure with its evidence and rationale.

A click on **Record Review** changes only the simulated review state. The interface must not display **Purchase Approved**, **Order Placed** or **Part Received** unless the action is explicitly a separate, labelled fictional scenario event.

### 11.6 Primary Acceptance

In the seeded EX-204 example, a missing verified part triggers a review warning where the available evidence supports it. Adding a confirmed, timely inbound record through the controlled demo scenario changes the recommendation to delivery review and removes duplicate-purchase messaging. Setting the stock value to Unknown changes the warning to Confirm Stock without asserting zero stock. A reset restores the original scenario consistently across Resource Readiness, Equipment, Overview and notifications.

## 12. Shift Control and Handover

### 12.1 Goal

Provide a clear current-shift view and preserve unresolved issues when operating responsibility transfers to the incoming shift. Original issues must not be duplicated or automatically closed.

**Figure 4 follows:** The handover flow from current work through outgoing review, published handover and incoming acknowledgment.

![Shift handover: current shift open issues, review handover, publish, incoming supervisor acknowledges, continue the original issue without automatic closure.](VESPER_assets/App_Flow/media/image4.png)

Figure 4. Shift handover without creating or closing another issue.

### 12.2 Shift Control Flow

| **Step** | **Actor / interaction**            | **Decision**                               | **Outcome**                                   |
|----------|------------------------------------|--------------------------------------------|-----------------------------------------------|
| SHF-01   | Supervisor opens /shifts           | Permitted site and shift scope             | Current / upcoming shift list                 |
| SHF-02   | Open /shifts/\[id\]                | Shift exists                               | Crew, assigned work, constraints and status   |
| SHF-03   | Review unresolved issues           | Canonical issues linked to shift           | Outstanding list with owner and dependencies  |
| SHF-04   | Open handover draft                | End-of-shift context or permitted review   | Draft assembled from unresolved items         |
| SHF-05   | Add handover notes                 | Validation and scope checks                | Notes saved to demo draft                     |
| SHF-06   | Confirm handover details           | No required blocker silently omitted       | Handover published in mock store              |
| SHF-07   | Incoming supervisor opens handover | Incoming shift/persona permitted           | Read-only previous notes and unresolved links |
| SHF-08   | Acknowledge receipt                | All required acknowledgment conditions met | Timestamped simulated acknowledgement         |
| SHF-09   | Continue outstanding action        | Issue remains open                         | Same issue linked to incoming shift           |

### 12.3 Business Rules

- Handover acknowledgement confirms receipt of the handover information, not resolution or safety clearance.

- Pending issues preserve original issue IDs, severity, evidence, timestamps and accountable owner unless an explicit action changes them.

- Draft and published handovers are visually distinct; the incoming supervisor cannot acknowledge an unpublished draft.

- A published handover can refer to an issue subsequently updated; its historical snapshot and current linked issue status must be distinguishable.

- If no unresolved items exist, the UI shows a valid zero-issues summary, not a failure or blank page.

### 12.4 Failure Cases and Acceptance

If the handover mutation fails, retain the draft and allow retry. If a role switch invalidates access, show a restricted state rather than exposing the previous supervisor's private notes. **Acceptance:** The seeded issue appears in both outgoing and incoming contexts via the same record; receiving a handover never changes that issue to Closed.

## 13. VESPER Mobile: Report, Act, Track

### 13.1 Scope and Navigation

VESPER Mobile is a **responsive browser-based field experience** in the same product. It is not a native app, a second software brand or a separate operational data system. Primary tabs: **My Shift, My Work, Report, Notifications**; Profile is reached from the mobile header/menu. Core flow: **Report -\> Act -\> Track**.

### 13.2 My Shift and My Work

| **Step** | **Screen / action**           | **Guard**                                                               | **Visible outcome**                                        |
|----------|-------------------------------|-------------------------------------------------------------------------|------------------------------------------------------------|
| MOB-01   | Open My Shift                 | Active Core-or-higher plan, authorised site and permitted field persona | Current demo shift, assigned area and priority information |
| MOB-02   | Tap My Work                   | Work assigned to fictional user                                         | Concise task list                                          |
| MOB-03   | Open assigned action          | Same site and owner/role scope                                          | Task detail with issue link and due state                  |
| MOB-04   | Update appropriate task state | Allowed transition / validation                                         | Simulated action event and confirmation                    |
| MOB-05   | Review status                 | Updated canonical action available                                      | Current progress, source and last update                   |

### 13.3 Mobile Report Flow

1. Tap **Report** from My Shift, My Work or the navigation bar.

2. Confirm prefilled site/shift/equipment where known, with permitted corrections.

3. Select issue category; enter a concise description and optional fictional attachment.

4. Review the summary, including the currently simulated connection state.

5. If demo online, submit via MSW; show the issue ID and central Received/Reported confirmation only after success.

6. If demo offline, show **Saved in this demonstration / Pending Synchronisation**. Do not generate central alerts or pretend that an emergency message was delivered.

7. On explicit simulation of reconnection, process the pending submission deterministically, reject invalid/duplicate transitions and show the canonical result.

8. Open **Track** from the confirmation or My Work to see permitted updates and remaining actions.

### 13.4 Mobile Exceptions

- **Core tier: essential mobile field routes are available to permitted users. Only explicitly higher-tier workflows show a subscription restriction; no cross-role/site record disclosure is permitted.**

- **No allowed phone usage on site:** this is a deployment constraint for future validation; the prototype must not assume universal phone permission.

- **Offline:** no real storage, service worker push or guaranteed background sync is implemented in this phase.

- **No attendance shortcut:** mobile does not introduce clock-in; existing mine attendance systems remain authoritative.

- **No safety promise:** submitting a fault does not automatically dispatch emergency response or grant permission to work.

### 13.5 Acceptance

The mobile report is available from Core and higher tiers, uses short forms and appropriate touch targets, maintains clear back/cancel behaviour, supports reduced motion and displays a distinct Pending Synchronisation state until the simulation deliberately completes. All central views then use the same resulting issue ID.

## 14. Reports and Operational Intelligence Flow

### 14.1 Primary Flow

/reports -\> select permitted site/period/report family -\> view summary with unit, source, update time and metric definition -\> select a data point -\> open linked source issue/equipment/shift/readiness record -\> return to the report with filters intact.

### 14.2 Report Families and Drill-Downs

| **Report**             | **Starting view**                         | **Drill-down source**            | **Essential rule**                     |
|------------------------|-------------------------------------------|----------------------------------|----------------------------------------|
| Shift performance      | Shift activity and unresolved handovers   | Shift / handover record          | No invented completion                 |
| Operational exceptions | Counts, durations and status categories   | Issue detail and event history   | Source and state explicit              |
| Equipment and downtime | Availability and delay stages             | Equipment / maintenance timeline | No automatic production-loss inference |
| Production vs plan     | Fictional actual/target context           | Area / metric definition         | No unsupported savings claim           |
| Resource readiness     | Upcoming services and potential shortages | Readiness / part requirement     | Unknown stock is not zero              |
| Advanced intelligence  | Entitled cross-site or advanced views     | Defined source and measure       | Enterprise/Group guards applied        |

### 14.3 Filtering and Quality Branches

- Invalid date ranges prompt correction before a report loads.

- Missing records produce an explanatory empty state.

- Stale data displays a freshness warning, not a misleading live headline.

- Missing calculation inputs suppress unsupported values.

- Different site access must not leak previous site's report cards, rows or cached details.

- Charts should have usable legends and a table/accessible text alternative where applicable.

### 14.4 Subscription Guards

Core displays essential reporting; Operations displays operational reporting; Enterprise and Group enable advanced/cross-site views according to entitlement. A lower-tier deep link to restricted analytics must render a clear restricted view, not a blank report or a success-looking placeholder.

## 15. Administration, Site Access and Subscription Flow

### 15.1 Purpose

Administration in this phase demonstrates what configuration and access would feel like. It does not provision production identities, create real mine tenants, generate invoices or process payment.

### 15.2 Administration Flow

| **Step** | **Admin interaction**             | **Guard**                                   | **Outcome**                                   |
|----------|-----------------------------------|---------------------------------------------|-----------------------------------------------|
| ADM-01   | Open /admin                       | Organisation Administrator demo persona     | Configuration navigation                      |
| ADM-02   | Inspect sites                     | Demo tenant and subscription site allowance | Current allowed site list                     |
| ADM-03   | Inspect fictional users/roles     | Same demo organisation                      | Role and site grants overview                 |
| ADM-04   | Choose subscription scenario      | Change is demo-only                         | Feature flags and nav visibility re-evaluated |
| ADM-05   | Open blocked feature example      | Higher tier needed                          | Explicit entitlement-state demonstration      |
| ADM-06   | Reset demonstration configuration | Confirm destructive reset                   | Fixture and scenario restored                 |

### 15.3 Entitlement Rules

| **Plan**                 | **Site allowance** | **Mobile field navigation**      | **Reports** |
|--------------------------|--------------------|----------------------------------|-------------|
| Core                     | 1                  | Included - essential field flows | Essential   |
| Operations - Single Site | 1                  | Included                         | Operational |
| Operations               | Up to 3            | Included                         | Operational |
| Enterprise               | Up to 6            | Included                         | Advanced    |
| Group                    | 7+                 | Included                         | Group-level |

Operations - Single Site is a capacity option, not a separately branded tier. HIMARK Reserve's proposed inclusion of one Operations - Single Site licence may appear as a simulated commercial scenario but must not override role/site guards and is not a promise of production service.

### 15.4 Acceptance

Changing tier preserves essential mobile navigation for Core and above, and updates guards only for genuinely tier-restricted capabilities. Changing site grants changes all site-scoped lists, counts and map context. Restricted detail links never show a flash of another tenant's record before replacing it with a guard screen.

## 16. Notifications, Search and Deep Links

### 16.1 Notification Dropdown Flow

1. A seeded event creates or updates a role/site-relevant mock notification.

2. The top-bar bell shows an accurate unread count.

3. Clicking the bell opens a **dropdown**, not a permanent notification sidebar.

4. A notification displays category, readable title, timestamp, source reference and read/unread state.

5. Selecting it marks it read through the mock service and navigates to its permitted destination.

6. The destination opens its linked record with the same site/persona guard, optionally preserving an origin=notification return context.

7. If the event becomes no longer relevant, the notification transitions to a resolved or superseded state per the demo rule; it must not misleadingly remain a current urgent alert.

### 16.2 Notification Cases

| **Trigger**                          | **Recipient**                             | **Destination**               |
|--------------------------------------|-------------------------------------------|-------------------------------|
| Issue assigned                       | Accountable demo owner                    | /exceptions/\[id\]            |
| Dependency overdue                   | Relevant supervisor / owner               | /exceptions/\[id\]            |
| Maintenance due soon                 | Maintenance Planner                       | /equipment/\[id\]/maintenance |
| Parts readiness risk                 | Planner / Stores / Procurement by context | /resources/\[activityId\]     |
| Material confirmed production impact | Site management                           | /overview or linked issue     |
| Shift handover published             | Incoming supervisor                       | /shifts/\[id\]/handover       |

### 16.3 Search Flow

Global search is a scoped demonstration lookup, not internet or enterprise-wide retrieval. The user enters a fictional equipment code, issue ID or area name; results are filtered by current persona and site. Selecting a result navigates to the stable route. Empty results show suggestions and a Clear Search action. Access-restricted records do not appear in results.

### 16.4 Deep-Link Rules

- Direct-link reload reconstructs the selected scenario or shows a clear demo-context requirement.

- A role/entitlement/site restriction is checked **before** showing record detail.

- The Back action restores search/filter context where feasible.

- Stale or deleted fictional IDs show not found with a safe route to the register.

- All links point to existing P0 pages or display an explicit planned-feature stub; no decorative controls masquerade as working actions.

## 17. Shared Domain Events and Cross-Module Synchronisation

### 17.1 Canonical Prototype State

Mutable domain data belongs to **one deterministic MSW-backed mock domain store**. TanStack Query manages browser query results and invalidation. Zustand holds only shell/demo-control state (persona, site, scenario, sidebar, optional UI selections). Each approved mutation appends a simulated event, updates its canonical record and re-derives affected views. The UI must not create disconnected local copies of operational truth.

### 17.2 Event-to-View Propagation Matrix

| **Simulated event**       | **Canonical update**                                  | **Dependent views that must change**                               |
|---------------------------|-------------------------------------------------------|--------------------------------------------------------------------|
| issue.reported            | Create issue and event with Reported quality          | Work register, equipment link, appropriate map/overview indication |
| issue.assigned            | Set accountable owner and action reference            | Issue, owner My Work, notifications                                |
| dependency.blocked        | Create/update unresolved dependency                   | Issue, Overview priority, shift outstanding items                  |
| action.updated            | Append action history and new action state            | Issue, Mobile My Work, handover where linked                       |
| issue.resolution_reported | Record claimed resolution, not verification           | Issue and relevant pending-verification indicators                 |
| issue.verified            | Append independent verification                       | Issue, equipment, map rule evaluation, reports                     |
| equipment.resumed         | Record actual return-to-operation demonstration event | Equipment timeline, relevant area, derived reports                 |
| readiness.assessed        | Update evidence-based readiness result                | Resource detail, Equipment, Overview and alerts                    |
| parts.warning_changed     | Add/update/resolve review warning                     | Resources, relevant notification, management risk list             |
| handover.published        | Create handover and linked unresolved items           | Outgoing/incoming shifts, notification to incoming role            |
| handover.acknowledged     | Timestamp receipt only                                | Handover history and acknowledgment state                          |
| scenario.reset            | Replace fixture graph and demo clock                  | All modules and query caches return to baseline                    |

### 17.3 Event Integrity Requirements

- Each event has stable fictional ID, site, canonical record ID, actor/source, event time and received time.

- Event handling is deterministic; users can demonstrate the same scenario repeatedly from reset.

- Invalid state transitions are rejected with a mock CONFLICT or VALIDATION_ERROR, without partial success.

- Derived operational map status is recalculated using quality and area-impact rules, not simply from a raw fault count.

- Mobile Pending Synchronisation does not enter the central event stream until the mock sync is explicitly completed.

- A simulated procurement review creates only a review event; never a real purchase order.

### 17.4 Scenario Catalogue

| **Scenario**                   | **Required starting state**                         | **Demonstrable outcome**                              |
|--------------------------------|-----------------------------------------------------|-------------------------------------------------------|
| Normal Operations              | Verified on-plan conditions, valid freshness        | Green status justified, no invented blockers          |
| Equipment Breakdown            | One fault linked to equipment/area and action       | Cross-screen incident and dependency progression      |
| Spare Parts Risk               | Planned service, insufficient confirmed stock       | Purchasing-review warning with transparent inputs     |
| Unknown Inventory              | Missing/stale stock observation                     | Needs Confirmation rather than Out of Stock           |
| Shift Handover                 | Original issue remains unresolved                   | Same issue follows incoming shift without duplication |
| Stale Operational Map          | Source exceeds fixture freshness threshold          | Grey Unknown status with reason                       |
| Entitlement Restriction        | Higher-tier-only feature or restricted persona/site | Blocked route, no record disclosure                   |
| Simulated Offline Field Report | Disconnected demo network                           | Pending Synchronisation until explicit reconnection   |

## 18. Universal Exception, Empty and Offline Flows

### 18.1 Application State Matrix

| **State**               | **Visual behaviour**                                        | **Permitted action / recovery**                 |
|-------------------------|-------------------------------------------------------------|-------------------------------------------------|
| Initial loading         | Stable skeletons and meaningful page title                  | Wait; do not show incorrect prior-site data     |
| Empty register          | Explain that no matching records exist                      | Clear filters or go to permitted creation route |
| Validation error        | Inline message on exact field; preserve form                | Correct and retry                               |
| Simulated server error  | Specific non-success feedback and context                   | Retry or return to safe screen                  |
| Not found               | Explain unknown or unavailable fictional record             | Back to register                                |
| Role restricted         | Explicit access-state page                                  | Return to persona's permitted landing           |
| Subscription restricted | Explain required entitlement                                | Return/change demo tier                         |
| Stale observation       | Display source age and Unknown/Needs Review when applicable | Inspect source, request review in demo          |
| Conflicting evidence    | Surface conflict rather than normal status                  | Open evidence and simulated review              |
| Demo offline            | Clear offline banner and pending local state                | Simulate reconnection; no central receipt claim |
| Unsaved draft           | Confirm navigation or context switch                        | Stay / discard carefully                        |
| Mutation conflict       | Keep prior canonical state and show reason                  | Reload / retry allowed step                     |

### 18.2 Safety-Relevant Language

Avoid false phrases such as 'Mine safe', 'Equipment cleared', 'Order placed', 'GPS live', 'Manager alerted' or 'Revenue recovered' when no authoritative event or real external system exists. Prefer 'Reported', 'Requires Verification', 'Purchasing Review Recommended', 'Simulated Alert', 'Last Confirmed' and 'Estimated' where appropriate. The prototype cannot be used for emergency response or operational clearance.

### 18.3 Draft Preservation

A failed submission retains the data in the current browser session where feasible; this is a prototype usability behaviour, not a guarantee of durable offline storage. Context switching with unsaved input requires confirmation. Error overlays must not trap focus or prevent returning to an accessible route.

## 19. Motion, Responsive and Accessibility Flow Rules

### 19.1 Design Fidelity

Maintain the approved VESPER direction: stable obsidian top bar, white contextual collapsible sidebar, mineral-white work surfaces, restrained emerald emphasis and premium minimalist neuromorphism. Icons remain visually restrained; red and amber communicate material statuses rather than decorating unrelated controls.

### 19.2 Motion Budgets

| **Interaction**             | **Initial duration target**        | **Required behaviour**                             |
|-----------------------------|------------------------------------|----------------------------------------------------|
| Button hover/focus response | 140 ms                             | Subtle feedback; keyboard focus remains obvious    |
| Actionable card hover       | 180 ms                             | Small elevation / shadow only; no dramatic lifting |
| Dropdown reveal             | 170 ms                             | Short entrance; no content jump                    |
| Sidebar collapse            | 230 ms                             | Sidebar and main content resize coherently         |
| Main content transition     | 240 ms                             | Shell persists; no entire-page flash               |
| Modal / drawer transition   | 280 ms                             | Focus management and predictable dismissal         |
| Map status update           | No intentional critical-data delay | Information state immediately understandable       |

These are tuning budgets, not guaranteed performance results. Animations must be skipped or reduced for users requesting reduced motion, and must not make warnings ambiguous or prevent fast use.

### 19.3 Device-Specific Behaviour

| **Desktop**                                           | **Tablet**                                         | **Mobile**                                                               |
|-------------------------------------------------------|----------------------------------------------------|--------------------------------------------------------------------------|
| Persistent top bar and collapsible contextual sidebar | Adaptive panel widths and clear touch interactions | Bottom/tab navigation for My Shift, My Work, Report and Notifications    |
| Detailed registers, side panels and reports           | Simplified grids and appropriately sized map       | One task per focused view; concise forms                                 |
| Keyboard navigation and useful hover affordances      | Touch-first controls without hover dependence      | High-contrast states, large touch targets and visible offline indication |

### 19.4 Accessibility Contract

- Target WCAG 2.2 AA where applicable and support keyboard paths across all P0 journeys.

- A modal or drawer moves focus into its content and restores focus on close.

- Status is communicated with text/icon as well as colour; map polygons have accessible alternative detail lists.

- Report charts provide meaningful labels and accessible alternative representations.

- Touch-heavy actions aim for approximately 44 x 44 CSS pixels while satisfying WCAG requirements.

- Avoid infinite shimmer, ambient motion, parallax and uncontrolled scroll effects in operational views.

## 20. Flow Acceptance Tests, Traceability and Sign-Off

### 20.1 Mandatory End-to-End Flow Tests

| **Test ID** | **Starting condition and action**         | **Required outcome**                                                                             |
|-------------|-------------------------------------------|--------------------------------------------------------------------------------------------------|
| AFD-E2E-01  | Launch valid demo context                 | Shell, selected site, role and demo indicator visible                                            |
| AFD-E2E-02  | Change site while viewing records         | All site-scoped surfaces switch together; no prior-site leak                                     |
| AFD-E2E-03  | Submit valid desktop issue                | One canonical issue; matching views refresh                                                      |
| AFD-E2E-04  | Submit invalid report                     | Field errors and preserved input; no issue created                                               |
| AFD-E2E-05  | Assign issue and add dependency           | Owner, issue, notifications and shift views agree                                                |
| AFD-E2E-06  | Mark issue resolution reported            | Not automatically Verified or Closed                                                             |
| AFD-E2E-07  | Verify then close issue                   | Events retained; map re-evaluated by actual area rules                                           |
| AFD-E2E-08  | Open map area and linked issue            | Correct site, status rationale and return path                                                   |
| AFD-E2E-09  | Use scheduled service meter inputs        | Correct due calculation or clearly unknown/overdue state                                         |
| AFD-E2E-10  | Simulate shortage with verified inputs    | Purchasing review warning with rationale and no order placement                                  |
| AFD-E2E-11  | Change stock from insufficient to unknown | Confirm Stock, not Out of Stock                                                                  |
| AFD-E2E-12  | Add viable confirmed inbound supply       | Removes duplicate purchasing recommendation                                                      |
| AFD-E2E-13  | Publish and acknowledge handover          | Same unresolved issue persists in incoming shift                                                 |
| AFD-E2E-14  | Submit mobile report offline              | Pending sync until explicit simulated reconnection                                               |
| AFD-E2E-15  | Select Core then open Mobile              | Core field routes accessible; appropriate role/site guards; higher-tier features stay restricted |
| AFD-E2E-16  | Select Enterprise Reports                 | Advanced views available to entitled demo persona                                                |
| AFD-E2E-17  | Click notification deep link              | Correct record opens and unread count updates                                                    |
| AFD-E2E-18  | Force mock service error                  | Clear error; no false success or partial state update                                            |
| AFD-E2E-19  | Reset scenario                            | All cross-module mutations and caches return to baseline                                         |
| AFD-E2E-20  | Enable reduced motion / keyboard-only use | Core flows remain functional and understandable                                                  |

### 20.2 PRD-to-App-Flow Traceability

| **PRD functional group**                       | **AFD sections** | **Prototype proof**                               |
|------------------------------------------------|------------------|---------------------------------------------------|
| **VES-FR-001 to 008: Command Centre**          | 2, 5, 6, 17      | Priorities, context and drill-down                |
| **VES-FR-009 to 017: Operational Map**         | 7, 17, 18        | Polygon selection and status integrity            |
| **VES-FR-018 to 027: Work & Exceptions**       | 8, 9, 17         | Submit, assign, depend, verify                    |
| **VES-FR-028 to 036: Equipment & Maintenance** | 10, 17           | Equipment and delay timeline                      |
| **VES-FR-037 to 046: Resource Readiness**      | 11, 17           | Due service and parts-risk warning                |
| **VES-FR-047 to 053: Shift Control**           | 12, 17           | Handover without issue duplication                |
| **VES-FR-054 to 062: Mobile**                  | 13, 18           | Field report, task and offline demo               |
| **VES-FR-063 to 072: Reports**                 | 14, 17           | Evidence-linked and tier-aware reports            |
| Cross-cutting permissions and UI rules         | 3-5, 15-19       | Guards, accessible navigation and consistent data |

### 20.3 Definition of Done for App Flow Implementation

The interactive app flow is acceptable only when all approved P0 routes have defined entry/exit behaviour, no visible control leads to a dead end, both flagship scenario journeys complete end-to-end, role and tier guards behave consistently, every mutation updates one canonical domain store, and all critical state/error branches are demonstrated and tested. Visual polish alone is not a completion criterion.

### 20.4 Decisions Still Requiring Validation

- Exact priority calculation and escalation thresholds: mine-specific evidence required.

- Final map area-status rules and freshness thresholds: validate with representative operational personnel.

- Service interval sources and inventory-stock definitions: validate against actual authoritative systems before production.

- Device permission, offline requirements and user role grants: confirm at pilot mines.

- Buyer workflows and navigation preferences: confirm through structured usability interviews.

- Commercial tier and HIMARK Reserve inclusions: remain subject to commercial sign-off.

### 20.5 Approval and Handover

**Leadership owner:** HIMARK CEO / delegated product owner. **Technical owner:** VESPER engineering lead. **UX owner:** VESPER UI/UX lead. **Domain reviewers:** mining production, maintenance and stores/procurement specialists.

**Approval sequence:** PRD scope check -\> TRD and Backend Schema consistency check -\> AFD journey review -\> design/component implementation -\> seeded-scenario tests -\> mining user validation. A production build or mine-site deployment requires its own future authorisation.

### 20.6 Approval Register

The following decisions remain open until recorded by authorised HIMARK stakeholders. A Pending status is not an approval.

| **Approval role**       | **Decision required**                                 | **Status**     |
|-------------------------|-------------------------------------------------------|----------------|
| HIMARK Product Owner    | Product scope, navigation and P0 journeys             | Pending        |
| VESPER Engineering Lead | Technical alignment with TRD and backend contracts    | Pending        |
| VESPER UI/UX Lead       | Design patterns, motion and accessibility             | Pending        |
| Mining Domain Reviewers | Operational, maintenance and procurement flow realism | Pending review |

**Final authorisation:** Once approved, this App Flow Document governs interactive UI/UX prototype implementation only; production backend work remains out of scope.

**End of VESPER 3.0 Application Flow Document v1.1.**
