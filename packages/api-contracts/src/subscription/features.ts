import type { FeatureCode } from "./types";

/**
 * What each feature is, and how far it exists today. This is the register of "what already exists" against the product's
 * intended entitlements, kept as data so it cannot be forgotten and a test can check it covers every feature.
 *
 *   built      the capability exists in the prototype
 *   partial    part of it exists
 *   not_built  intended, not built. The plan lists it so the entitlement is recorded. Nothing was built to fill it.
 *
 *   enforced   the prototype's interface responds to this feature (navigation, a route or a section)
 *   configured the feature is in the plan, but the interface has no separate boundary to switch it on and off
 *   not_applicable  there is nothing to enforce yet
 */
export type FeatureStatus = "built" | "partial" | "not_built";
export type FeatureEnforcement = "enforced" | "configured" | "not_applicable";

export type FeatureInfo = {
  label: string;
  /** What it means in the product's own words. */
  summary: string;
  status: FeatureStatus;
  enforcement: FeatureEnforcement;
  /** What exists, or what is outstanding. */
  note: string;
};

export const featureCatalogue: Record<FeatureCode, FeatureInfo> = {
  // ---- Core: operational visibility
  overview: { label: "Operational overview", summary: "The Overview and each role's home.", status: "built", enforcement: "configured", note: "In every subscription." },
  operational_map: { label: "Operational map", summary: "A basic live operational map with explainable area statuses.", status: "built", enforcement: "configured", note: "In every subscription." },
  issue_tracking: { label: "Report and track issues", summary: "Report operational issues and follow them to closure.", status: "built", enforcement: "configured", note: "In every subscription. The Backend Schema (5.2) forbids denying basic issue reporting or tracking because a plan is Core." },
  equipment_visibility: { label: "Essential equipment visibility", summary: "The equipment register, each unit's details and whether it is available.", status: "built", enforcement: "configured", note: "In every subscription." },
  assigned_tasks: { label: "Assigned tasks and updates", summary: "My Work and shift tasks, with notes and evidence when finished.", status: "built", enforcement: "configured", note: "In every subscription." },
  shift_basic: { label: "Basic shift information", summary: "Shifts, crew, work, the calendar and the allocation sheet.", status: "built", enforcement: "configured", note: "In every subscription." },
  administration: { label: "Administration", summary: "People, roles, site and company details and the plan.", status: "built", enforcement: "configured", note: "In every subscription. Not named in either edition's list, so it is assumed to be needed by all." },
  mobile_field_essential: { label: "Essential VESPER Mobile", summary: "My Shift, My Work, Report and Notifications.", status: "built", enforcement: "configured", note: "In every subscription. Cannot be overridden off." },

  // ---- Operations: operational coordination
  work_coordination: { label: "Advanced work and exception coordination", summary: "Action ownership, dependencies and escalation.", status: "built", enforcement: "configured", note: "Exists, but it is part of the issue lifecycle (an issue cannot move or close without its actions), so it has no separate boundary to switch off. A Core rule for the lifecycle is outstanding." },
  shift_handover: { label: "Detailed shift handovers", summary: "Handover notes, the draft from shift records, publish and acknowledge.", status: "built", enforcement: "enforced", note: "The handover page and the links to it. Closing a shift with unresolved items still asks for a handover, so a Core rule for closing a shift is outstanding." },
  equipment_maintenance: { label: "Equipment downtime and maintenance coordination", summary: "Maintenance plans, the service log, the downtime record and contractor service requests.", status: "built", enforcement: "enforced", note: "The equipment page sections and the maintenance and service-request routes." },
  resource_readiness: { label: "Resource Readiness and spare-parts early warning", summary: "Parts against planned work, with warnings before work is due.", status: "built", enforcement: "enforced", note: "The workspace, its navigation, and readiness items elsewhere." },
  digital_inspections: { label: "Structured digital inspections and checklists", summary: "Inspections and checklists completed on a phone.", status: "not_built", enforcement: "not_applicable", note: "Not built. Outstanding. See the administrative workflows assessment (pre-start inspection)." },
  mobile_field_expanded: { label: "Expanded Mobile workflows", summary: "Mobile workflows that support the Operations capabilities.", status: "not_built", enforcement: "not_applicable", note: "Not built. Outstanding." },

  // ---- Enterprise
  advanced_analytics: { label: "Advanced operational analytics", summary: "Advanced analytical reports.", status: "partial", enforcement: "enforced", note: "One advanced report exists (Delay analytics, indicative data). More are outstanding." },
  multi_site_comparison: { label: "Multi-site performance comparisons", summary: "Compare sites against each other.", status: "not_built", enforcement: "not_applicable", note: "Not built. The prototype has one site." },
  management_oversight: { label: "Advanced reporting and management oversight", summary: "Management-level reporting across the operation.", status: "not_built", enforcement: "not_applicable", note: "Not built beyond the advanced report above." },
  contracted_integrations: { label: "Contracted integrations", summary: "Integrations agreed in the client's contract.", status: "not_built", enforcement: "not_applicable", note: "Not built. Integration connectors are excluded from the current phase." },
  customer_configurations: { label: "Approved customer-specific configurations", summary: "Client-specific entitlements and settings, held as configuration, not code.", status: "partial", enforcement: "configured", note: "The client entitlement record, its validation and its audit trail exist, with mock records. Secure storage and backend enforcement are outstanding." },

  // ---- Group
  group_dashboards: { label: "Consolidated group dashboards", summary: "Group-level operational dashboards.", status: "not_built", enforcement: "not_applicable", note: "Not built." },
  cross_site_oversight: { label: "Cross-site performance oversight", summary: "Oversight of performance across all licensed sites.", status: "not_built", enforcement: "not_applicable", note: "Not built." },
  group_administration: { label: "Group-level administration and governance", summary: "Administration and governance across the group.", status: "not_built", enforcement: "not_applicable", note: "Not built." },
  contracted_extensions: { label: "Contractually agreed enterprise extensions", summary: "Extensions written into the Group agreement.", status: "partial", enforcement: "configured", note: "Carried by the same client entitlement record as customer configurations. No extension exists yet." },
};

/** Every feature the product intends but has not built, for the outstanding list. */
export function outstandingFeatures(): FeatureCode[] {
  return (Object.keys(featureCatalogue) as FeatureCode[]).filter((code) => featureCatalogue[code].status !== "built");
}
