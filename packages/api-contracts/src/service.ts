/**
 * Service providers, service requests, invitations and quotes: the records behind asking approved contractors to quote.
 */
import { z } from "zod";
import { equipmentCategorySchema } from "./equipment";

const timestamp = z.string().datetime({ offset: true });

export const serviceProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  registration: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string(),
  categories: z.array(equipmentCategorySchema),
  /** Last day the provider is approved to work at this mine, as a date. Empty means no end date. */
  approvedUntil: z.string(),
  /** True only while approval is "approved". Kept so existing checks keep working; the store sets it from `approval`. */
  active: z.boolean(),
  /** Pending until an authorised person approves it; inactive providers keep their history but cannot be given new work. */
  approval: z.enum(["pending", "approved", "inactive"]),
  /** What they are known for, in words, for example "Crushers, conveyors, processing equipment". */
  specialisation: z.string(),
  serviceAreas: z.array(z.string()),
  /** The expected or contracted response time in hours. Null when not agreed. */
  responseHours: z.number().positive().nullable(),
  /** Certifications and supporting documents. Only the names are kept in this prototype. */
  documents: z.array(z.object({ name: z.string().min(1), sizeLabel: z.string() })),
  notes: z.string(),
  history: z.array(z.object({ id: z.string().min(1), at: timestamp, actor: z.string().min(1), summary: z.string().min(1), note: z.string().nullable() })),
  createdAt: timestamp,
  version: z.number().int().min(1),
});

export const quoteSchema = z.object({
  amount: z.number().nonnegative().nullable(),
  reference: z.string(),
  availableFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  notes: z.string(),
  recordedAt: timestamp,
  recordedBy: z.string().min(1),
});

export const inviteStateSchema = z.enum(["sent", "quoted", "declined", "accepted", "not_selected"]);

export const serviceInviteSchema = z.object({
  id: z.string().min(1),
  /** The private reply link the provider uses. The mine never enters a quote for them. */
  token: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  state: inviteStateSchema,
  sentAt: timestamp,
  declinedReason: z.string().nullable(),
  quote: quoteSchema.nullable(),
});

export const requestStatusSchema = z.enum(["open", "awarded", "scheduled", "completed", "cancelled"]);

export const serviceRequestEventSchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  actor: z.string().min(1),
  summary: z.string().min(1),
});

export const serviceRequestSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  equipmentId: z.string().min(1),
  planId: z.string().nullable(),
  title: z.string().min(1),
  description: z.string(),
  urgency: z.enum(["routine", "urgent", "critical"]),
  preferredDate: z.string().nullable(),
  status: requestStatusSchema,
  invites: z.array(serviceInviteSchema),
  awardedInviteId: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  completedAt: timestamp.nullable(),
  cancelledReason: z.string().nullable(),
  createdBy: z.string().min(1),
  createdAt: timestamp,
  events: z.array(serviceRequestEventSchema),
  version: z.number().int().min(1),
});

export type ServiceProvider = z.infer<typeof serviceProviderSchema>;
export type ServiceProviderApproval = ServiceProvider["approval"];
export type Quote = z.infer<typeof quoteSchema>;
export type InviteState = z.infer<typeof inviteStateSchema>;
export type ServiceInvite = z.infer<typeof serviceInviteSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type ServiceRequestEvent = z.infer<typeof serviceRequestEventSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
