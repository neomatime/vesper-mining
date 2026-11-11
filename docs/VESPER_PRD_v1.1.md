# VESPER 3.0 — Product Requirements Document

**HIMARK SGC**  
**PRODUCT STRATEGY / MINING TECHNOLOGY**

**THE MINING OPERATING SYSTEM**

Identify delays. Prevent avoidable waiting.  
Recover productive time.

| **VERSION** | **1.1**                              |
|-------------|--------------------------------------|
| **DATE**    | **10 NOVEMBER 2026**                 |
| **STATUS**  | **REVISED DRAFT - APPROVAL PENDING** |

**DEVELOPMENT AUTHORISATION**

Product definition and interactive UI/UX prototype only.  
No production backend, live integrations or operational deployment.

## Document control

| **ORGANISATION**     | HIMARK SGC                                                                                                                    |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **PRODUCT**          | VESPER - The Mining Operating System                                                                                          |
| **DOCUMENT**         | Product Requirements Document (PRD)                                                                                           |
| **VERSION / STATUS** | 1.1 / Revised draft - leadership approval pending                                                                             |
| **PREPARED ON**      | 2 November 2026                                                                                                               |
| **CURRENT PHASE**    | Product definition and UI/UX prototype                                                                                        |
| **NEXT DELIVERABLE** | Technical Requirements Specification (TRS)                                                                                    |
| REVISION 1.1         | 10 November 2026 - Core now includes essential VESPER Mobile field workflows; advanced access remains tier- and role-guarded. |

## Contents

| **01** Executive Summary                                | **11** User Access and Commercial Entitlements |
|---------------------------------------------------------|------------------------------------------------|
| **02** Product Vision and Objectives                    | **12** Key User Journeys                       |
| **03** Target Market and Users                          | **13** Business Rules and Data Integrity       |
| **04** Product Architecture and Experience              | **14** UI/UX Requirements                      |
| **05** Release Scope and Prioritisation                 | **15** Current UI/UX Development Scope         |
| **06** Functional Requirements                          | **16** Success Metrics and Validation          |
| **07** Resource Readiness and Spare Parts Early Warning | **17** Risks, Dependencies and Constraints     |
| **08** Shift Control and Handover                       | **18** Acceptance and Sign-Off                 |
| **09** VESPER Mobile                                    | **19** Open Decisions Requiring Validation     |
| **10** Reports and Intelligence                         | **20** Final Product Definition                |


## 1. Executive Summary

### 1.1 Product Overview

VESPER is an integrated mining operations platform designed to help mining companies identify operational constraints, prevent avoidable delays, coordinate corrective actions and protect productive time.

The platform connects operational information across production, maintenance, workforce management, stores, procurement and other relevant functions.

Rather than replacing existing enterprise systems, VESPER is intended to provide a coordinated operational experience using information captured directly through VESPER or received from approved external systems.

Its central objective is to reduce the unnecessary waiting and operational friction that occur before, during and after important mining activities.

**Product Value Proposition:**

*Identify delays. Prevent avoidable waiting. Recover productive time.*

### 1.2 The Problem

Mining operations depend on equipment, personnel, materials, information and decisions being available at the appropriate time.

When one of these requirements is missing, productive work may be delayed.

Examples include:

- Maintenance activities delayed by unavailable spare parts.

- Equipment remaining unavailable after repairs because required verification is outstanding.

- Production teams waiting for updates from maintenance or other departments.

- Planned work beginning without all required resources.

- Operational issues remaining unresolved between shifts.

- Management receiving incomplete or outdated information about operational constraints.

These are potential customer problems to validate, not claims that every mining operation experiences them or lacks adequate solutions.

### 1.3 VESPER's Proposed Solution

VESPER will focus on three connected capabilities.

**Operational Visibility:** Help users understand what is happening, where operational constraints exist and whether the underlying information is current and trustworthy.

**Operational Coordination:** Reveal unresolved dependencies, enable accountable actions and preserve continuity between departments and shifts.

**Delay Prevention:** Identify upcoming maintenance requirements, missing resources and potential spare-parts shortages before they disrupt planned work.

The platform will also support analysis of recorded delays and operational outcomes to help mines identify improvement opportunities.

### 1.4 Product Principles

1. **Human First. Tools Second.** Software supports human expertise, judgement and accountability.

2. **Operational value before features.** Every capability must address a meaningful user need or documented hypothesis.

3. **Enter information once.** Reuse existing information wherever appropriate and authorised.

4. **Action before information overload.** Prioritise the next useful action rather than displaying excessive data.

5. **Prevention before reaction.** Identify missing prerequisites early enough for appropriate intervention.

6. **Trustworthy information.** Distinguish verified information, reports, estimates and unknown conditions.

7. **One product, multiple experiences.** Web, tablet and mobile remain part of VESPER.

8. **Standardised by default.** Customer configuration should not require separate application codebases.

9. **Integration before duplication.** Existing enterprise systems remain authoritative where appropriate.

10. **Measurable outcomes.** Product success must ultimately be demonstrated through operational and commercial evidence.

## 2. Product Vision and Objectives

### 2.1 Vision Statement

To become a trusted operational coordination platform that helps mining companies reduce avoidable waiting, improve execution readiness and protect productive time.

### 2.2 Primary Product Objective

Help mining operations identify and reduce controllable delays that occur because information, resources, dependencies or operational actions are not available when required.

### 2.3 Supporting Objectives

- Improve visibility of unresolved operational constraints.

- Reduce unnecessary administrative effort.

- Strengthen coordination between production, maintenance and supporting departments.

- Improve readiness for scheduled maintenance.

- Identify potential spare-parts shortages before planned work.

- Preserve accountability across shift handovers.

- Provide evidence-supported operational reporting.

- Improve the usability of operational software for relevant mine personnel.

### 2.4 Objectives for the Current Development Phase

The present phase is successful when HIMARK has:

- An approved PRD.

- An approved Technical Requirements Specification.

- A consistent, responsive VESPER design system.

- A functional frontend prototype demonstrating the prioritised workflows.

- Realistic, clearly labelled simulated operational data.

- Role-specific web, tablet and mobile experiences.

- Defined subscription-entitlement demonstrations.

- A prototype suitable for structured evaluation by mining stakeholders.

**The current phase is not intended to deliver production-ready mining software.**

### 2.5 Commercial Hypotheses

The product will initially test the following assumptions:

**H1:** Avoidable waiting during maintenance and operational recovery is financially meaningful for the initial customer segment.

**H2:** Existing systems do not always provide sufficient cross-department visibility into the delays that matter most.

**H3:** Better resource-readiness information and timely alerts can help prevent certain maintenance delays.

**H4:** A simpler, action-oriented experience can reduce the administrative effort required to coordinate operational responses.

**H5:** Relevant mining buyers will consider paying for VESPER when it demonstrates sufficient measurable value.

These hypotheses must be validated through research and subsequent customer testing.

## 3. Target Market and Users

### 3.1 Initial Customer Profile

**Recommended initial segment:** Mid-sized South African surface mining operators.

Initial customer research should prioritise organisations with:

- Approximately one to three managed mining sites.

- Shift-based operations.

- Material use of mobile mining equipment.

- Structured maintenance processes.

- Multiple departments or external parties contributing to operational execution.

- Recurring operational constraints that may be improved through better coordination.

- An identifiable operational sponsor.

This segment is provisional and must be tested against market evidence.

### 3.2 Primary Stakeholders

| **Stakeholder**               | **Principal Need**                                            | **VESPER Experience**                            |
|-------------------------------|---------------------------------------------------------------|--------------------------------------------------|
| Mine General Manager          | Understand production constraints and operational performance | Command Centre, Reports, Operational Map         |
| Production Manager            | Understand delays and coordinate recovery                     | Shift Control, Work & Exceptions                 |
| Shift Supervisor              | Manage daily work and handovers                               | Shift Control, Actions, Mobile where appropriate |
| Maintenance Manager           | Improve equipment readiness and coordination                  | Equipment, Maintenance, Delay Intelligence       |
| Maintenance Planner           | Prepare upcoming maintenance                                  | Maintenance Due, Resource Readiness              |
| Stores / Inventory Controller | Identify parts availability and shortages                     | Parts Readiness, Stock Alerts                    |
| Procurement Personnel         | Review authorised purchasing requirements                     | Purchase Review, Supplier Lead Times             |
| Field Employee                | Access assigned work and report operational problems          | VESPER Mobile                                    |
| IT / OT Stakeholder           | Assess integration, data security and operational suitability | Administration and technical assurance           |
| Executive / Corporate User    | Review authorised operational trends                          | Reports                                          |

### 3.3 Economic Buyer

The probable economic sponsor is a Mine General Manager, Operations Director or equivalent operational executive.

The final buying process may also require approval from finance, procurement, IT, cybersecurity and corporate leadership.

The actual buying authority must be confirmed during customer discovery.

### 3.4 Core User Needs

**A site manager needs to:**

- See significant operational constraints.

- Understand which problems are genuinely affecting production.

- Identify unresolved dependencies.

- Recognise decisions requiring management intervention.

- Review credible operational outcomes.

**A maintenance planner needs to:**

- Know which equipment is approaching scheduled maintenance.

- Understand the required parts and other prerequisites.

- Identify missing resources early.

- See which purchasing requirements need review.

**A shift supervisor needs to:**

- Review planned and outstanding work.

- Understand operational problems affecting the shift.

- Coordinate responses.

- Carry unresolved issues into the next shift.

**A field employee needs to:**

- Understand assigned work.

- Report an operational problem quickly.

- Supply relevant updates or evidence.

- Avoid unnecessary duplicate administration.

## 4. Product Architecture and Experience

### 4.1 Single Product Strategy

VESPER is one commercial product and one software brand.

It is accessed through:

| **Experience** | **Primary Purpose**                                      |
|----------------|----------------------------------------------------------|
| VESPER Web     | Operational management, administration and reporting     |
| VESPER Tablet  | Shift supervision and operational control                |
| VESPER Mobile  | Field execution, issue reporting and shift participation |

There will be no separately branded VESPER S or VESPER ONE application.

Advanced reporting and intelligence belong inside VESPER's **Reports** module.

The three device experiences must share a common conceptual identity, permission and operational data model.

### 4.2 Proposed Information Architecture

The following eight workspaces form the initial application structure:

1. **Overview / Command Centre**

2. **Live Operational Map**

3. **Work & Exceptions**

4. **Equipment & Maintenance**

5. **Resource Readiness**

6. **Shift Control & Handover**

7. **Reports**

8. **Administration**

Mobile navigation should expose only the workflows relevant to its intended users rather than duplicating the complete desktop menu.

### 4.3 Operational Process

The standard workflow follows:

**Identify -\> Assess -\> Coordinate -\> Act -\> Verify -\> Handover -\> Improve**

- **Identify:** An operational problem or missing prerequisite is recorded.

- **Assess:** Its relevance, affected area, current status and possible impact are established.

- **Coordinate:** Required actions and dependencies are made visible.

- **Act:** Responsible personnel perform authorised work.

- **Verify:** The appropriate person confirms the outcome.

- **Handover:** Outstanding matters continue into the next shift.

- **Improve:** Operational records contribute to reports and future prevention.

This process must support, not replace, the mine's established procedures.

## 5. Release Scope and Prioritisation

Requirements will use the following classifications:

- **P0 - Required in the current interactive UI/UX prototype**

- **P1 - Subsequent prototype enhancement, subject to validation**

- **P2 - Future product capability, outside the current implementation phase**

A P0 designation means the user interaction must be demonstrated. It does **not** authorise production backend implementation.

### 5.1 P0 Prototype Capabilities

- Role-specific Command Centre.

- Simulated mine-site selection.

- Interactive 2D Operational Map.

- Operational exception reporting and details.

- Action ownership and dependency tracking.

- Status changes and simulated escalations.

- Equipment details and recorded delay timeline.

- Scheduled-maintenance visibility.

- Resource Readiness.

- Spare Parts Early Warning.

- Digital shift handovers.

- VESPER Mobile field interactions.

- Essential reporting.

- Tier-based feature-access demonstration.

- Simulated notifications and deep linking.

- Clear source, timestamp and verification indicators.

### 5.2 P1 Capabilities

- Editable mine-area boundary configuration.

- Expanded equipment-inspection workflows.

- More detailed maintenance-readiness checklists.

- Additional report filters and exports.

- Configurable escalation thresholds.

- Advanced role-specific dashboard personalisation.

- More detailed supplier and purchase-status views.

- Extended offline simulation and conflict scenarios.

### 5.3 P2 Capabilities

- Production backend.

- Live mining-system APIs and integrations.

- Actual GPS and equipment telemetry integration.

- Enterprise authentication and operational multi-tenancy.

- Production-grade offline synchronisation.

- Advanced cross-site intelligence.

- Predictive maintenance.

- Condition-based spare-parts forecasting.

- AI-supported recommendations using verified operational data.

- Production billing, procurement and financial integrations.

## 6. Functional Requirements

### 6.1 Overview / Command Centre

**Purpose:** Allow management to understand operational priorities and determine where attention is required.

| **ID**         | **Requirement**                                                | **Priority** |
|----------------|----------------------------------------------------------------|--------------|
| **VES-FR-001** | Display a role-appropriate operational dashboard               | **P0**       |
| **VES-FR-002** | Display the selected mining site and current shift             | **P0**       |
| **VES-FR-003** | Highlight significant operational constraints                  | **P0**       |
| **VES-FR-004** | Show affected equipment, areas and operational context         | **P0**       |
| **VES-FR-005** | Present outstanding decisions and unresolved dependencies      | **P0**       |
| **VES-FR-006** | Display production-versus-plan information where available     | **P0**       |
| **VES-FR-007** | Provide direct navigation to relevant issue details            | **P0**       |
| **VES-FR-008** | Display simulated updates from the shared prototype data store | **P0**       |

#### Acceptance Criteria

- A manager can identify the highest-priority displayed constraint without searching through multiple modules.

- Every highlighted issue links to its supporting record.

- A constraint has a defined reason for its priority or is clearly labelled as requiring review.

- Reported and estimated information is distinguishable from verified information.

- Updates made during a prototype workflow appear in relevant dashboard components without manually refreshing the page.

- The dashboard does not display fabricated production savings as confirmed financial results.

- No ambiguous recovery percentage is shown without a documented calculation.

### 6.2 Live Operational Map

**Purpose:** Make operational conditions and affected work areas easy to understand spatially.

| **ID**         | **Requirement**                                                 | **Priority** |
|----------------|-----------------------------------------------------------------|--------------|
| **VES-FR-009** | Display a mine-approved-style demo image or site plan           | **P0**       |
| **VES-FR-010** | Overlay interactive operating-area polygons                     | **P0**       |
| **VES-FR-011** | Support green, yellow, red and grey operational statuses        | **P0**       |
| **VES-FR-012** | Update area status using simulated operational events and rules | **P0**       |
| **VES-FR-013** | Allow selection of an area to display details                   | **P0**       |
| **VES-FR-014** | Show relevant issues and associated actions                     | **P0**       |
| **VES-FR-015** | Display the reason for each status                              | **P0**       |
| **VES-FR-016** | Display source and last-update information                      | **P0**       |
| **VES-FR-017** | Provide an area-boundary configuration experience               | **P1**       |

#### Status Definitions

| **Status**       | **Meaning**                                                                                    |
|------------------|------------------------------------------------------------------------------------------------|
| Green - On Plan  | Sufficient current information supports the area's defined operational-performance conditions  |
| Yellow - At Risk | A meaningful deviation, emerging constraint or required review may affect operational progress |
| Red - Blocked    | Verified information confirms a blocking condition affecting the defined operation             |
| Grey - Unknown   | Information is missing, outdated, conflicting or insufficient to determine status reliably     |

#### Business Rules

**VES-BR-001:** Green must not be assigned merely because no issue has been reported.

**VES-BR-002:** A single equipment fault must not automatically make an entire mining area red unless the defined operation is actually blocked.

**VES-BR-003:** Grey must be available whenever reliable operational status cannot be established.

**VES-BR-004:** Every colour must have an explainable cause, relevant timestamp and information source.

**VES-BR-005:** Map colours indicate operational status, not mine safety clearance, personal safety or permission to work.

**VES-BR-006:** Equipment positions must not be presented as live GPS positions unless supported by an actual approved location source in a future deployment.

#### Acceptance Criteria

- Clicking a polygon opens the matching area details.

- A simulated verified blocking event changes the affected area to red when the configured demonstration rule applies.

- An unverified event does not silently become a confirmed blocking condition.

- Resolving an issue does not automatically turn an area green unless all required operational conditions are satisfied.

- Missing or stale information produces an appropriate unknown state.

- A user can determine why an area has its displayed colour.

- The initial prototype requires no cameras, GPS equipment or external GIS service.

### 6.3 Work & Exceptions

**Purpose:** Coordinate operational problems without forcing employees to duplicate the mine's existing work-management processes.

| **ID**         | **Requirement**                                                              | **Priority** |
|----------------|------------------------------------------------------------------------------|--------------|
| **VES-FR-018** | Provide a streamlined operational issue reporting form                       | **P0**       |
| **VES-FR-019** | Prefill relevant site, equipment or shift information in simulated scenarios | **P0**       |
| **VES-FR-020** | Display operational exception details                                        | **P0**       |
| **VES-FR-021** | Show accountable owner and current response status                           | **P0**       |
| **VES-FR-022** | Record simulated status changes and acknowledgements                         | **P0**       |
| **VES-FR-023** | Track outstanding dependencies between teams                                 | **P0**       |
| **VES-FR-024** | Present the next required action                                             | **P0**       |
| **VES-FR-025** | Demonstrate overdue-action escalation                                        | **P0**       |
| **VES-FR-026** | Show recorded action history                                                 | **P0**       |
| **VES-FR-027** | Support resolution evidence and verification states                          | **P0**       |

#### Proposed Issue Lifecycle

Reported -\> Reviewed -\> Action Assigned -\> In Progress -\> Awaiting Dependency -\> Resolution Reported -\> Verified -\> Closed

The interface must also support a cancelled or duplicate outcome where appropriate.

Not every issue requires every intermediate stage.

#### Acceptance Criteria

- A user can submit a demo issue using a minimal set of relevant fields.

- An assigned user can acknowledge or update the issue within the prototype.

- The issue details show what is currently blocking progress.

- The accountable owner and contributing teams remain distinguishable.

- Significant status changes appear in the history.

- A resolution reported by a user is not automatically treated as an authorised operational clearance.

- An unresolved issue remains visible in the next shift's handover.

### 6.4 Equipment & Maintenance

**Purpose:** Support maintenance coordination and provide useful information about equipment availability and operational delays.

| **ID**         | **Requirement**                                                              | **Priority** |
|----------------|------------------------------------------------------------------------------|--------------|
| **VES-FR-028** | Display a searchable equipment register                                      | **P0**       |
| **VES-FR-029** | Show equipment identity, assigned area and reported status                   | **P0**       |
| **VES-FR-030** | Show linked operational issues                                               | **P0**       |
| **VES-FR-031** | Display scheduled maintenance requirements                                   | **P0**       |
| **VES-FR-032** | Show operating-hour readings where available in demo data                    | **P0**       |
| **VES-FR-033** | Show a downtime-stage timeline                                               | **P0**       |
| **VES-FR-034** | Categorise recorded waiting and active-work stages                           | **P0**       |
| **VES-FR-035** | Distinguish repair completion, authorised release and operational resumption | **P0**       |
| **VES-FR-036** | Link to a simulated external maintenance work-order reference                | **P0**       |

#### Delay Intelligence

The prototype must support a visual timeline of events such as:

Fault Detected -\> Reported -\> Response Started -\> Assessed -\> Resources Ready -\> Repair Completed -\> Release Verified -\> Operation Resumed

Each demonstrated stage must contain an event time and an identifiable source.

The interface must not incorrectly double-count overlapping events.

Waiting time must not automatically be described as avoidable or financially recoverable.

#### Acceptance Criteria

- Selecting equipment opens its maintenance and operational records.

- The user can see upcoming service requirements.

- The downtime timeline identifies elapsed periods and relevant waiting reasons.

- Repair completion, operational clearance and actual return to productive work are displayed as separate concepts.

- An incomplete record does not present an exact total without an appropriate explanation.

- Relevant issues can be opened directly from the equipment record.

## 7. Resource Readiness and Spare Parts Early Warning

### 7.1 Purpose

Help mining operations identify missing resources before planned maintenance or other scheduled work is disrupted.

This is one of VESPER's priority differentiation hypotheses.

### 7.2 Functional Requirements

| **ID**         | **Requirement**                                                       | **Priority** |
|----------------|-----------------------------------------------------------------------|--------------|
| **VES-FR-037** | Display upcoming planned maintenance activities                       | **P0**       |
| **VES-FR-038** | Display required parts and other prerequisites                        | **P0**       |
| **VES-FR-039** | Display known, unavailable or unconfirmed resource status             | **P0**       |
| **VES-FR-040** | Estimate upcoming service dates from relevant demo inputs             | **P0**       |
| **VES-FR-041** | Display supplier lead times                                           | **P0**       |
| **VES-FR-042** | Compare required parts against simulated available and reserved stock | **P0**       |
| **VES-FR-043** | Consider simulated existing purchase orders                           | **P0**       |
| **VES-FR-044** | Identify potential purchasing-deadline risks                          | **P0**       |
| **VES-FR-045** | Present a purchase-review recommendation                              | **P0**       |
| **VES-FR-046** | Demonstrate escalation for materially important shortages             | **P0**       |

### 7.3 Maintenance Due Calculation

For hour-based preventive maintenance, the prototype may estimate time to service using:

**Operating hours remaining = Next scheduled service threshold - Current verified operating hours**

**Estimated days remaining = Operating hours remaining / Average operating hours per day**

A service date may alternatively come directly from an approved maintenance plan.

If the readings or usage assumptions are unavailable, the interface must clearly state that the estimate cannot be established.

An overdue service must not be represented as a future requirement.

#### Example Demonstration Scenario

- Equipment: Excavator EX-204.

- Current operating hours: 800.

- Next scheduled service: 1,000 hours.

- Average usage: 10 hours per day.

- Estimated time until service: 20 days.

- Supplier lead time: 14 days.

- Planning buffer: 3 days.

- Indicative remaining ordering window: 3 days.

All values are illustrative.

### 7.4 Spare Parts Business Rules

**VES-BR-007:** The system must check known stock, reservations and outstanding orders before recommending a new purchase review.

**VES-BR-008:** An unknown inventory status must not be treated as zero stock.

**VES-BR-009:** Supplier lead times must have an identifiable source and last-confirmed date.

**VES-BR-010:** The system must distinguish a confirmed parts shortage from a possible shortage.

**VES-BR-011:** Purchase recommendations must be reviewable by authorised personnel.

**VES-BR-012:** VESPER must not automatically approve or submit actual purchases in the current or initial production scope.

**VES-BR-013:** Routine purchasing alerts should be directed to relevant maintenance, stores or procurement personnel. Senior management should see material operational risks rather than every replenishment requirement.

### 7.5 Acceptance Criteria

- The prototype shows when a service is approaching.

- Required spare parts are visible.

- An unconfirmed or unavailable required part generates an appropriate readiness warning.

- A sufficient confirmed stock allocation does not generate a duplicate purchase suggestion.

- An existing purchase order is visible in the decision context.

- An illustrative ordering deadline is displayed when the required information exists.

- The user can inspect the basis of the recommendation.

- No demonstration control performs an actual purchase.

## 8. Shift Control and Handover

### 8.1 Purpose

Preserve operational continuity and relevant accountability when responsibility transfers between shifts.

### 8.2 Requirements

| **ID**         | **Requirement**                                        | **Priority** |
|----------------|--------------------------------------------------------|--------------|
| **VES-FR-047** | Display current and upcoming shifts                    | **P0**       |
| **VES-FR-048** | Show relevant crew and work assignments                | **P0**       |
| **VES-FR-049** | Display work progress and unresolved constraints       | **P0**       |
| **VES-FR-050** | Produce a structured handover view                     | **P0**       |
| **VES-FR-051** | Carry unresolved demo issues into the incoming shift   | **P0**       |
| **VES-FR-052** | Allow a supervisor to acknowledge a simulated handover | **P0**       |
| **VES-FR-053** | Preserve the handover event history                    | **P0**       |

#### Acceptance Criteria

- A supervisor can review unresolved issues before closing a shift.

- Relevant information remains associated with the original issue.

- The incoming supervisor can see outstanding actions, dependencies and recorded status.

- A handover acknowledgement does not automatically close the underlying issue.

- The prototype does not create duplicate operational records for the same unresolved problem.

## 9. VESPER Mobile

### 9.1 Product Role

VESPER Mobile is the field-focused extension of VESPER.

It is not a separate software product or brand.

Its purpose is to let authorised employees complete essential work interactions with minimal administrative effort.

### 9.2 Initial Mobile Navigation

**My Shift \| My Work \| Report \| Notifications \| Profile**

### 9.3 Requirements

| **ID**         | **Requirement**                                      | **Priority** |
|----------------|------------------------------------------------------|--------------|
| **VES-FR-054** | Display assigned shift information                   | **P0**       |
| **VES-FR-055** | Display assigned work                                | **P0**       |
| **VES-FR-056** | Allow a simple simulated issue report                | **P0**       |
| **VES-FR-057** | Allow relevant task-status updates                   | **P0**       |
| **VES-FR-058** | Support optional demo attachments and evidence       | **P0**       |
| **VES-FR-059** | Show relevant issue progress                         | **P0**       |
| **VES-FR-060** | Display simulated offline and synchronisation states | **P0**       |
| **VES-FR-061** | Provide role-relevant notifications                  | **P0**       |
| **VES-FR-062** | Support expanded digital inspections                 | **P1**       |

### 9.4 Mobile UX Rules

- Prefill known information.

- Minimise required fields.

- Use large, clear touch targets.

- Support straightforward navigation.

- Display clear submission confirmation.

- Distinguish local saving from successful server receipt.

- Avoid duplicate clock-in where approved attendance systems already exist.

- Do not assume personal smartphones can be used in every mining work area.

- Do not use ordinary mobile notifications as substitutes for approved emergency communications.

#### Acceptance Criteria

- A field employee can report an equipment problem in a short, understandable flow.

- The submitted demo issue appears in the shared prototype state.

- An offline simulation clearly shows the report as pending rather than received.

- Synchronisation simulation updates the status when the demonstration reconnects.

- Critical information remains legible on smaller mobile screens.

## 10. Reports and Intelligence

### 10.1 Purpose

Provide operational information that helps mine personnel understand trends, monitor performance and evaluate improvement opportunities.

Reporting remains inside the main VESPER application.

### 10.2 Reporting Requirements

| **ID**         | **Requirement**                                          | **Priority** |
|----------------|----------------------------------------------------------|--------------|
| **VES-FR-063** | Display essential shift reports                          | **P0**       |
| **VES-FR-064** | Display operational exception summaries                  | **P0**       |
| **VES-FR-065** | Display equipment downtime and recorded delay categories | **P0**       |
| **VES-FR-066** | Compare selected production information against targets  | **P0**       |
| **VES-FR-067** | Show maintenance and resource-readiness summaries        | **P0**       |
| **VES-FR-068** | Display advanced analytical views for entitled tiers     | **P0**       |
| **VES-FR-069** | Provide period and site filters                          | **P0**       |
| **VES-FR-070** | Display relevant data sources and definitions            | **P0**       |
| **VES-FR-071** | Demonstrate extended report exports                      | **P1**       |
| **VES-FR-072** | Demonstrate cross-site comparisons                       | **P1**       |

### 10.3 Reporting Standards

Reports must distinguish:

- Actual operational figures.

- Manually reported observations.

- Calculated indicators.

- Estimated outcomes.

- Missing or stale data.

Where financial benefits or recovery opportunities are displayed, the assumptions must be accessible.

**Recorded downtime is not automatically equivalent to lost production.**

The prototype must not describe a hypothetical financial estimate as a verified saving.

## 11. User Access and Commercial Entitlements

### 11.1 Subscription Structure

VESPER uses one subscription agreement per mining organisation with a defined site allowance.

The current commercial hypotheses are:

| **Subscription**         | **Site Allowance** | **VESPER Mobile**                    | **Reporting Access** | **Proposed Monthly Price** |
|--------------------------|--------------------|--------------------------------------|----------------------|----------------------------|
| Core                     | 1                  | Included - essential field workflows | Essential            | **R45,000**                |
| Operations - Single Site | 1                  | Included                             | Operational          | **R70,000**                |
| Operations               | Up to 3            | Included                             | Operational          | **R95,000**                |
| Enterprise               | Up to 6            | Included                             | Advanced             | **From R180,000**          |
| Group                    | 7+                 | Included                             | Group-level          | **Custom**                 |

Prices exclude VAT and implementation fees.

Operations - Single Site is a capacity configuration of Operations, not a separate product tier.

**These prices and allowances are provisional and must be validated commercially.**

### 11.2 Entitlement Requirements

**VES-BR-014: Core customers are entitled to essential VESPER Web and Mobile workflows at one authorised site, subject to role and site permissions.**

**VES-BR-015: All active tiers include the dedicated VESPER Mobile field experience. Operations and above may unlock approved expanded workflows such as digital inspections; essential reporting and offline-state clarity must not be premium-gated.**

**VES-BR-016:** Advanced analytical reporting is restricted to Enterprise and Group.

**VES-BR-017:** Site allowances apply to the subscribed mining organisation.

**VES-BR-018:** Permissions must also consider the individual user's role and authorised sites.

**VES-BR-019:** Hidden interface elements must not be treated as sufficient production security enforcement. Actual entitlement enforcement belongs in future backend services.

### 11.3 HIMARK Reserve Offering

The proposed HIMARK Reserve benefit is one VESPER Operations - Single Site licence at no additional recurring licence fee for an eligible Reserve retainer client, subject to written commercial approval.

Implementation, additional sites, bespoke engineering and exceptional support remain separately scoped.

This benefit must not promise production access before VESPER has passed the required operational, technical and commercial readiness gates.

### 11.4 Prototype Requirements

The UI prototype must demonstrate changing between subscription configurations and appropriately altering available application features.

The simulated entitlements are for user-experience validation only; they are not production billing or access controls.

## 12. Key User Journeys

### 12.1 Journey A - An Operational Problem Delays Production

**Persona:** Shift Supervisor / Production Manager

**Starting condition:** An excavator experiences an operational fault.

**Journey:**

1. A field employee submits a simulated equipment-fault report.

2. VESPER creates an operational exception.

3. The relevant equipment record updates.

4. The Operational Map highlights the affected equipment or operating area according to the demonstrated status rules.

5. The supervisor opens the issue details.

6. The responsible maintenance team is shown.

7. The response reveals a dependency involving a required spare part.

8. The outstanding dependency becomes visible to the appropriate personnel.

9. An authorised user records a simulated response update.

10. The issue timeline reflects the change.

11. If the issue remains unresolved, it carries into shift handover.

12. When the relevant verification conditions are met, the issue can be closed.

13. Reports reflect the recorded delay and completed response.

**Success condition:** A user can follow the issue from initial report to the current dependency or verified outcome without searching across disconnected demonstration screens.

### 12.2 Journey B - Preventing a Maintenance Delay

**Persona:** Maintenance Planner

**Starting condition:** Excavator EX-204 is approaching its next scheduled maintenance activity.

**Journey:**

1. The planner opens Resource Readiness.

2. VESPER identifies the upcoming maintenance activity using simulated service data.

3. Required parts are displayed.

4. A component's available stock is unconfirmed.

5. VESPER checks the simulated purchase-order and lead-time information.

6. A possible delivery risk is identified.

7. The planner opens the Parts Readiness details.

8. The UI explains the expected requirement, source information and indicative ordering deadline.

9. The planner records a simulated review action.

10. The alert status changes appropriately.

11. The updated readiness position appears in the related maintenance record and relevant dashboard.

**Success condition:** The planner can identify a potential shortage, understand why it matters and determine the next appropriate review action without navigating an unrelated procurement application.

### 12.3 Journey C - Shift Handover

**Persona:** Incoming Shift Supervisor

**Journey:**

1. The outgoing supervisor reviews the unresolved work.

2. VESPER generates a structured demonstration handover.

3. The incoming supervisor reviews outstanding constraints.

4. The supervisor acknowledges receipt.

5. The original issues remain open where unresolved.

6. Relevant actions continue into the incoming shift.

**Success condition:** No demonstrated unresolved issue disappears simply because a shift has ended.

### 12.4 Journey D - Subscription Feature Access

**Persona:** Mining Organisation Administrator

**Journey:**

1. Select a simulated Core subscription.

2. Verify that essential VESPER Web and Mobile capabilities are available at the authorised site.

3. Verify that essential mobile routes and field reporting are available to the Core field persona.

4. Select Operations.

5. Verify that Operations retains essential mobile access and exposes only entitled expanded workflows.

6. Select Enterprise.

7. Verify that advanced analytics become available within Reports.

**Success condition:** Subscription capabilities are demonstrated consistently across navigation, screens and user context.

## 13. Business Rules and Data Integrity

### 13.1 General Rules

- Operational information must remain associated with its mine site.

- Access to information must respect intended user roles and site scope.

- An assigned owner is not necessarily the person performing every contributing action.

- An action completed by one department must not automatically resolve the overall operational constraint.

- A reported repair completion must not be treated as permission to operate equipment.

- An operational improvement must not be claimed without appropriate evidence.

- Calculated values must use defined methods and identifiable inputs.

- Source conflicts must be made visible rather than silently concealed.

- An absent report must not be interpreted as evidence that everything is functioning correctly.

### 13.2 Required Information States

The product must visually distinguish at least:

| **State**               | **Interpretation**                                             |
|-------------------------|----------------------------------------------------------------|
| Reported                | Information submitted by a user or source                      |
| Verified                | Information confirmed through an approved verification process |
| Pending                 | Action or confirmation has not yet occurred                    |
| Stale                   | Information is older than the applicable freshness requirement |
| Conflicting             | Available sources disagree                                     |
| Unknown                 | Reliable information is insufficient                           |
| Pending Synchronisation | Information has not yet been received by the central system    |

### 13.3 Demonstration Data Model

The future TRS must define the technical representation of the following entities:

- Organisation

- Mining Site

- Operating Area

- Employee / User

- Role and Permission

- Shift

- Equipment

- Operational Event

- Operational Constraint

- Corrective Action

- Dependency

- Maintenance Plan

- Service Requirement

- Part Requirement

- Inventory Status

- Purchase Order Reference

- Supplier Lead Time

- Verification Record

- Shift Handover

- Notification

- Report Metric

- Subscription Entitlement

The current prototype may represent these entities using structured mock datasets.

Each relevant operational record should support an identifier, site association, appropriate event timestamps, source information and status history.

## 14. UI/UX Requirements

### 14.1 Design Direction

VESPER must maintain HIMARK's approved premium enterprise aesthetic.

**Primary visual identity:**

- Obsidian or near-black top navigation.

- Mineral-white working surfaces.

- White contextual inner sidebar.

- Restrained emerald-green accents.

- Minimalist, subtle neuromorphism.

- Clean typography.

- Strong information hierarchy.

- Consistent components and spacing.

- Fluid, controlled animations.

The interface must feel premium without sacrificing operational clarity.

### 14.2 Interface Principles

**UX-001 - Action First:** Show important operational decisions and constraints before secondary analytics.

**UX-002 - Reduced Cognitive Load:** Avoid displaying every module or metric simultaneously.

**UX-003 - Consistency:** Identical concepts must use consistent status labels, icons and interactions.

**UX-004 - Progressive Disclosure:** Show essential information initially and expose details when requested.

**UX-005 - Role Relevance:** Present workflows according to the user's responsibility.

**UX-006 - Visible System State:** Show loading, saving, pending, success, failure, stale and unknown states.

**UX-007 - Responsive Experience:** Design for desktop, management tablet and workforce mobile usage.

**UX-008 - Appropriate Motion:** Use subtle feedback and respect reduced-motion accessibility preferences.

**UX-009 - Meaningful Colour:** Preserve amber and red for meaningful warnings and exceptional states. Ordinary icons should remain visually restrained.

**UX-010 - Explainability:** Users must be able to understand why a recommendation, warning or status is displayed.

### 14.3 Accessibility

The design should target WCAG 2.2 AA accessibility criteria where applicable.

The UI should support:

- Appropriate text contrast.

- Keyboard-accessible desktop interactions.

- Visible focus states.

- Clearly labelled inputs.

- Accessible status information beyond colour alone.

- Readable charts and legends.

- Sufficient mobile touch-target sizing.

- Reduced-motion preferences.

### 14.4 Performance Targets for the Prototype

The intended experience should:

- Navigate between local prototype screens without unnecessary full-page reloads.

- Respond promptly to user input.

- Avoid disruptive layout shifts.

- Use skeletons or clear loading indicators where relevant.

- Handle demonstrated error and empty states gracefully.

Quantitative frontend performance targets and test-device profiles must be finalised in the Technical Requirements Specification.

## 15. Current UI/UX Development Scope

### 15.1 What HIMARK Will Build Now

The frontend development phase includes:

- Reusable VESPER design system.

- Complete prioritised screen layouts.

- Functional navigation.

- Demo user and role selection.

- Simulated mine-site selection.

- Interactive Operational Map.

- Simulated issue reporting.

- Simulated status updates and action tracking.

- Simulated resource-readiness warnings.

- Simulated maintenance calculations.

- Interactive handover experiences.

- Demo notifications.

- Demonstration reporting and chart interactions.

- Responsive desktop, tablet and mobile interfaces.

- Mock subscription entitlements.

- Controlled offline/synchronisation simulations.

- Demonstration loading, empty, error and permission states.

### 15.2 What HIMARK Will Not Build Now

The current phase expressly excludes:

- Production backend infrastructure.

- Live operational databases.

- Actual customer authentication.

- Real biometric integrations.

- Actual ERP or maintenance-system connectors.

- Actual supplier or inventory connections.

- Production GPS tracking.

- CCTV integration.

- Real equipment telemetry.

- Actual operational event streaming.

- Real mobile offline synchronisation.

- Actual procurement transactions.

- Real payment or subscription billing.

- Production predictive-maintenance models.

- Safety-critical equipment control.

- Live mining operation deployment.

All interactions requiring these capabilities must be simulated or represented through clearly identified demonstration data.

### 15.3 Prototype Integrity Requirements

**VES-PR-001:** Demonstration operational data must be labelled appropriately.

**VES-PR-002:** The prototype must not claim to be connected to actual mine equipment or systems.

**VES-PR-003:** Simulated alerts must behave consistently with documented business rules.

**VES-PR-004:** The demonstration must not imply that purchasing, equipment release or safety authorisation has occurred in a real mine.

**VES-PR-005:** Future integration points must be documented for the TRS without implementing the actual integrations.

**VES-PR-006:** The frontend must not contain exposed production credentials or genuine sensitive employee or mine data.

## 16. Success Metrics and Validation

### 16.1 Current Phase Success Metrics

The UI/UX phase will be evaluated using:

| **Measure**                   | **Proposed Success Standard**                                                                     |
|-------------------------------|---------------------------------------------------------------------------------------------------|
| Functional Prototype Coverage | All approved P0 interactions demonstrable                                                         |
| Navigation Completeness       | No critical dead-end journeys                                                                     |
| Visual Consistency            | All priority workspaces use the approved design system                                            |
| Workflow Traceability         | Both primary scenarios can be completed end-to-end                                                |
| Data Trust Representation     | All critical demo statuses include appropriate source or verification context                     |
| Responsive Design             | Priority flows work across agreed device sizes                                                    |
| Entitlement Demonstration     | Core, Operations and Enterprise feature differences behave as specified                           |
| Critical Usability            | Target at least 90% unassisted completion of agreed essential tasks during representative testing |

These are targets, not current achievements.

### 16.2 Future Operational Pilot Metrics

Once real customer integration and an approved pilot become possible, the product should evaluate:

- Time from issue report to acknowledgement.

- Time from acknowledgement to corrective action.

- Recorded waiting time by category.

- Percentage of maintenance activities starting with required resources confirmed.

- Delays attributable to unavailable parts.

- Unresolved handover issues without accountable ownership.

- Supervisor time spent reconstructing operational information.

- Data completeness and freshness.

- Relevant verified production and economic outcomes.

Improvement claims must be measured against an appropriate baseline.

### 16.3 Customer Discovery Requirements

Before committing to production backend development, HIMARK should aim to:

- Interview approximately 15-20 relevant stakeholders across several mining operations.

- Examine approximately 20-30 suitable historical operational incidents, where access is approved.

- Identify the most expensive realistically controllable sources of waiting.

- Understand existing technology and procedures.

- Determine which stakeholders hold budget and purchasing authority.

- Validate the prototype with actual or representative mining personnel.

- Investigate the feasibility and economics of a customer-approved pilot.

## 17. Risks, Dependencies and Constraints

| **Risk**                            | **Potential Impact**                    | **Mitigation**                                             |
|-------------------------------------|-----------------------------------------|------------------------------------------------------------|
| Unvalidated customer problem        | Product fails to attract paying buyers  | Conduct mining discovery and review actual incidents       |
| Competitor feature overlap          | Weak differentiation                    | Test measurable advantages over existing workflows         |
| Poor mining domain understanding    | Incorrect workflows and assumptions     | Involve experienced mining professionals                   |
| Inaccessible operational data       | Incomplete or unreliable functionality  | Validate source availability and integration feasibility   |
| Misleading operational status       | Unsafe or poor management decisions     | Implement explicit information quality and status rules    |
| Overcomplicated UI                  | Weak user adoption                      | Apply progressive disclosure and usability testing         |
| Excessive feature scope             | Delayed delivery and increased cost     | Enforce P0/P1/P2 prioritisation                            |
| Unprofitable implementation         | Weak commercial sustainability          | Separately model onboarding, integration and support costs |
| Incorrect inventory recommendations | Unnecessary purchasing or missing parts | Check reservations, orders, lead times and evidence        |
| Safety-critical misuse              | Operational or legal exposure           | Keep established mine safety procedures authoritative      |

Future production deployment will require appropriate assessment of South African privacy, mining safety, contractual, cybersecurity and industrial technology obligations.

The UI prototype is not a substitute for those assessments.

## 18. Acceptance and Sign-Off

### 18.1 Product Definition Approval

The PRD is ready for approval when HIMARK leadership has accepted:

- The initial customer profile.

- Product problem and value proposition.

- P0 scope and explicit exclusions.

- Core user journeys.

- Feature priorities.

- Subscription entitlement assumptions for the prototype.

- Business-rule definitions.

- Required usability and information-integrity standards.

### 18.2 Technical Specification Handover

Following PRD approval, the TRD must define:

- Frontend architecture and project structure.

- Reusable component architecture.

- State management and simulated data services.

- Proposed future domain and API contracts.

- Role and entitlement modelling.

- Rules-engine interface definitions.

- Map interaction and polygon data structure.

- Maintenance and parts-warning calculation contracts.

- Responsive design standards.

- Accessibility and frontend performance test requirements.

- Future backend and integration boundaries.

- Testing strategy and acceptance test mapping.

The TRS must not silently expand the approved product scope.

### 18.3 UI/UX Prototype Definition of Done

The prototype will be considered complete when:

1. All approved P0 screens have been implemented.

2. The two primary demonstration journeys work end-to-end.

3. Simulated operational changes remain consistent across screens.

4. The Operational Map responds appropriately to demonstrated events.

5. Resource-readiness and parts-warning scenarios function as specified.

6. Role and subscription differences are visible and consistent.

7. Responsive layouts have been reviewed across agreed devices.

8. Important empty, loading, error and unknown states are covered.

9. The prototype has been tested against agreed usability scenarios.

10. Critical defects have been resolved and outstanding limitations documented.

Completion of the prototype does not authorise use in live mining operations.

## 19. Open Decisions Requiring Validation

The following remain unresolved and must not be treated as confirmed requirements:

| **Decision**                          | **Current Position**                                                    |
|---------------------------------------|-------------------------------------------------------------------------|
| Highest-priority buyer pain point     | Avoidable maintenance and operational waiting is the leading hypothesis |
| Initial mine type                     | Mid-sized surface mining operators proposed                             |
| Preferred existing-system integration | To be determined with a potential design partner                        |
| Best commercial starting package      | Operations - Single Site is the recommended primary offer               |
| Final subscription prices             | Pending buyer validation                                                |
| Real inventory data availability      | Unknown until customer discovery                                        |
| Equipment usage-data availability     | Unknown until integration assessment                                    |
| Operational-map status thresholds     | Must be defined with a representative mine                              |
| Financial recovery calculations       | Require mine-specific validated assumptions                             |
| HIMARK Reserve VESPER inclusion       | Proposed benefit requiring final commercial approval                    |

## 20. Final Product Definition

**VESPER is an integrated mining operations platform designed to help mining companies identify operational constraints, prevent avoidable waiting and coordinate the actions needed to keep productive work moving.**

It connects relevant operational information, equipment maintenance requirements, resource readiness, cross-department dependencies and shift execution within one coherent platform.

Its purpose is not to replace mining professionals or the specialised software they already use.

Its purpose is to help them make better-informed decisions, prevent avoidable delays and improve operational continuity with less administrative effort.

### Core Product Promise

**Identify delays. Prevent avoidable waiting. Recover productive time.**

### Product Experience Standard

**The complexity belongs to the system. The clarity belongs to the user.**

### HIMARK Operating Principle

**Human First. Tools Second.**

**End of PRD v1.1**

**Next Document:** VESPER 3.0 - Technical Requirements Specification (TRS)

**Authorised Implementation Sequence:** PRD Approval -\> TRD / BSD / App Flow Review -\> UI/UX Prototype Development -\> User Validation -\> Production Investment Decision.
