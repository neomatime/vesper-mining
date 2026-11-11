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

const timestampSchema = z.string().datetime({ offset: true });

export const actionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().min(1),
  team: z.string().min(1),
  state: z.enum(["pending", "in_progress", "complete", "overdue"]),
  dueAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable().default(null),
  removedAt: timestampSchema.nullable().default(null),
});

export const issueEventTypeSchema = z.enum([
  "reported",
  "edited",
  "state_changed",
  "owner_changed",
  "priority_changed",
  "action_added",
  "action_updated",
  "action_removed",
  "action_restored",
  "dependency_added",
  "dependency_updated",
  "comment_added",
  "verification_recorded",
]);

export const issueEventSchema = z.object({
  id: z.string().min(1),
  type: issueEventTypeSchema,
  summary: z.string().min(1),
  actor: z.string().min(1),
  actorRole: z.string().min(1),
  occurredAt: timestampSchema,
  previousState: issueWorkflowStateSchema.nullable().default(null),
  nextState: issueWorkflowStateSchema.nullable().default(null),
  note: z.string().nullable().default(null),
});

export const dependencyKindSchema = z.enum([
  "parts",
  "contractor",
  "internal_team",
  "permit_reference",
  "information",
]);

export const dependencySchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  kind: dependencyKindSchema,
  blockedActionId: z.string().nullable(),
  owner: z.string().min(1),
  state: z.enum(["open", "resolved", "bypassed"]),
  raisedAt: timestampSchema,
  reviewBy: timestampSchema.nullable(),
  resolutionNote: z.string().nullable(),
});

export const attachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["photo", "document", "other"]),
  sizeLabel: z.string(),
});

export const commentSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  role: z.string().min(1),
  body: z.string().min(1),
  createdAt: timestampSchema,
  attachments: z.array(attachmentSchema).default([]),
});

export const verificationSchema = z.object({
  id: z.string().min(1),
  result: z.enum(["confirmed", "rejected"]),
  verifier: z.string().min(1),
  note: z.string().min(1),
  verifiedAt: timestampSchema,
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
  version: z.number().int().positive().default(1),
  resolutionReportedBy: z.string().nullable().default(null),
  dependencies: z.array(dependencySchema).default([]),
  comments: z.array(commentSchema).default([]),
  verifications: z.array(verificationSchema).default([]),
  events: z.array(issueEventSchema).default([]),
});

export const mapAreaSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  name: z.string().min(1),
  status: operationalStatusSchema,
  rationale: z.string().min(1),
  source: demoSourceSchema,
});

export const readinessDecisionSchema = z.enum(["confirm_stock", "purchase_review", "escalate", "defer"]);

export const readinessReviewSchema = z.object({
  id: z.string().min(1),
  decision: readinessDecisionSchema,
  note: z.string().min(1),
  reviewer: z.string().min(1),
  role: z.string().min(1),
  reviewedAt: timestampSchema,
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
      confirmedBy: z.string().nullable().default(null),
      confirmedAt: timestampSchema.nullable().default(null),
      sourceNote: z.string().nullable().default(null),
    }),
  ),
  reviews: z.array(readinessReviewSchema).default([]),
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
export type IssueEvent = z.infer<typeof issueEventSchema>;
export type IssueEventType = z.infer<typeof issueEventTypeSchema>;
export type IssueDependency = z.infer<typeof dependencySchema>;
export type DependencyKind = z.infer<typeof dependencyKindSchema>;
export type IssueAttachment = z.infer<typeof attachmentSchema>;
export type IssueComment = z.infer<typeof commentSchema>;
export type IssueVerification = z.infer<typeof verificationSchema>;
export type ReadinessDecision = z.infer<typeof readinessDecisionSchema>;
export type ReadinessReview = z.infer<typeof readinessReviewSchema>;
export type OperationalIssue = z.infer<typeof operationalIssueSchema>;
export type MapArea = z.infer<typeof mapAreaSchema>;
export type ReadinessActivity = z.infer<typeof readinessActivitySchema>;
export type DemoContext = z.infer<typeof demoContextSchema>;
