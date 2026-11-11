import { z } from "zod";

export const operationalStatusSchema = z.enum([
  "on_plan",
  "at_risk",
  "blocked",
  "unknown",
]);

export const informationQualitySchema = z.enum([
  "reported",
  "verified",
  "pending",
  "stale",
  "conflicting",
  "unknown",
  "pending_sync",
]);

export const issueWorkflowStateSchema = z.enum([
  "reported",
  "reviewed",
  "action_assigned",
  "in_progress",
  "awaiting_dependency",
  "resolution_reported",
  "verified",
  "closed",
  "reopened",
  "cancelled",
  "duplicate",
]);

export const demoSourceSchema = z.object({
  label: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
  quality: informationQualitySchema,
});

export const actionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().min(1),
  team: z.string().min(1),
  state: z.enum(["pending", "in_progress", "complete", "overdue"]),
  dueAt: z.string().datetime({ offset: true }).nullable(),
});

export const operationalIssueSchema = z.object({
  id: z.string().min(1),
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  issueNumber: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  equipmentId: z.string().nullable(),
  areaId: z.string().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  workflowState: issueWorkflowStateSchema,
  quality: informationQualitySchema,
  operationalStatus: operationalStatusSchema,
  owner: z.string().nullable(),
  reportedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  source: demoSourceSchema,
  actions: z.array(actionSchema),
});

export const mapAreaSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  name: z.string().min(1),
  status: operationalStatusSchema,
  rationale: z.string().min(1),
  source: demoSourceSchema,
});

export const readinessActivitySchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  equipmentId: z.string().min(1),
  title: z.string().min(1),
  scheduledFor: z.string().datetime({ offset: true }),
  status: z.enum(["ready", "review_inbound", "potential_shortage", "needs_confirmation", "overdue"]),
  quality: informationQualitySchema,
  reviewState: z.enum(["not_reviewed", "reviewed"]),
  parts: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      required: z.number().nonnegative(),
      onHand: z.number().nonnegative().nullable(),
      reserved: z.number().nonnegative().nullable(),
      inbound: z.number().nonnegative().nullable(),
      leadTimeDays: z.number().nonnegative().nullable(),
      quality: informationQualitySchema,
    }),
  ),
});

export const demoContextSchema = z.object({
  persona: z.string().min(1),
  role: z.string().min(1),
  siteId: z.string().min(1),
  siteName: z.string().min(1),
  tier: z.enum(["core", "operations_single", "operations", "enterprise", "group"]),
  scenario: z.enum([
    "normal_operations",
    "equipment_breakdown",
    "spare_parts_risk",
    "unknown_inventory",
    "shift_handover",
    "stale_map",
    "entitlement_restriction",
    "offline_report",
  ]),
  demoNow: z.string().datetime({ offset: true }),
});

export const apiEnvelope = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema,
    meta: z.object({
      demo: z.literal(true),
      generatedAt: z.string().datetime({ offset: true }),
    }),
  });

export type OperationalStatus = z.infer<typeof operationalStatusSchema>;
export type InformationQuality = z.infer<typeof informationQualitySchema>;
export type IssueWorkflowState = z.infer<typeof issueWorkflowStateSchema>;
export type DemoSource = z.infer<typeof demoSourceSchema>;
export type Action = z.infer<typeof actionSchema>;
export type OperationalIssue = z.infer<typeof operationalIssueSchema>;
export type MapArea = z.infer<typeof mapAreaSchema>;
export type ReadinessActivity = z.infer<typeof readinessActivitySchema>;
export type DemoContext = z.infer<typeof demoContextSchema>;
